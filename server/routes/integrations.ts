import { Router } from 'express';
import { db, parseResource, syncResourceFts } from '../db.ts';
import { requireRole } from '../auth.ts';
import { invalidateFacetsCache } from './resources.ts';
import type { SkillMapResponse, SkillRecommendation } from '../../src/types.ts';

export const integrationsRouter = Router();

// Simulated incoming lesson recordings from Reel
const REEL_FEED = [
  {
    reel_recording_id: 'reel-rec-103',
    title: 'Week 7 Live Lesson: React Custom Hooks & Context',
    description:
      'Automatically imported from Reel. Covers extracting reusable hooks, avoiding prop drilling, and structuring state cleanly.',
    url: 'https://reel.academy.edu/recordings/js24-week7-custom-hooks',
    course: 'Web Development',
    topic: 'React State',
    level: 'Intermediate',
    tags: ['reel', 'react', 'hooks', 'context', 'js-24'],
    author: 'Prof. Aram Grigoryan',
    duration_or_pages: '1h 18m',
  },
  {
    reel_recording_id: 'reel-rec-104',
    title: 'Week 8 Live Lesson: Indexing & Full-Text Search in SQL',
    description:
      'Automatically imported from Reel. Live coding session building an FTS5 search engine and comparing query plans.',
    url: 'https://reel.academy.edu/recordings/py24-week8-sql-fts5',
    course: 'Backend Engineering',
    topic: 'SQL & Databases',
    level: 'Intermediate',
    tags: ['reel', 'sql', 'fts5', 'performance', 'py-24'],
    author: 'Nare Hovhannisyan',
    duration_or_pages: '56 min',
  },
];

// POST /api/integrations/reel/sync — Pulls new recordings from Reel automatically
integrationsRouter.post('/reel/sync', requireRole('lecturer', 'admin'), (req, res) => {
  const user = req.currentUser!;
  const imported: ReturnType<typeof parseResource>[] = [];

  for (const rec of REEL_FEED) {
    const exists = db
      .prepare('SELECT id FROM resources WHERE reel_recording_id = ?')
      .get(rec.reel_recording_id);

    if (exists) continue;

    const result = db
      .prepare(
        `INSERT INTO resources (
          title, description, url, source_type, resource_type,
          course, topic, level, tags, author,
          preview_domain, duration_or_pages, reel_recording_id,
          created_by, created_by_name
        ) VALUES (?, ?, ?, 'reel', 'recording', ?, ?, ?, ?, ?, 'reel.academy.edu', ?, ?, ?, ?)`
      )
      .run(
        rec.title,
        rec.description,
        rec.url,
        rec.course,
        rec.topic,
        rec.level,
        JSON.stringify(rec.tags),
        rec.author,
        rec.duration_or_pages,
        rec.reel_recording_id,
        user.id,
        user.name
      );

    const newId = Number(result.lastInsertRowid);
    syncResourceFts(newId);
    const created = db.prepare('SELECT * FROM resources WHERE id = ?').get(newId) as Record<
      string,
      unknown
    >;
    imported.push(parseResource(created));
  }

  if (imported.length > 0) {
    invalidateFacetsCache();
  }

  res.json({
    importedCount: imported.length,
    imported,
    message:
      imported.length > 0
        ? `Synced ${imported.length} new lesson recording(s) from Reel.`
        : 'All Reel lesson recordings are already up to date.',
  });
});

// GET /api/integrations/skill-map — Personalized recommendations for the current user
integrationsRouter.get('/skill-map', (req, res) => {
  const user = req.currentUser!;
  const gaps = user.skill_gaps;

  const allRows = db
    .prepare('SELECT * FROM resources ORDER BY created_at DESC, id DESC')
    .all() as Record<string, unknown>[];
  const allResources = allRows.map(parseResource);

  const recommendations: SkillRecommendation[] = [];

  for (const gap of gaps) {
    const matching = allResources.filter(
      (r) =>
        r.topic.toLowerCase() === gap.toLowerCase() ||
        r.tags.some((t) => gap.toLowerCase().includes(t.toLowerCase()))
    );

    for (const resource of matching.slice(0, 2)) {
      if (!recommendations.some((rec) => rec.resource.id === resource.id)) {
        recommendations.push({
          gap,
          reason: `Recommended by Skill Map to strengthen "${gap}" (${resource.level} ${resource.resource_type}).`,
          resource,
        });
      }
    }
  }

  const payload: SkillMapResponse = {
    user,
    skill_gaps: gaps,
    recommendations,
  };

  res.json(payload);
});

// POST /api/integrations/depot/:resourceId/borrow — Borrow a physical book copy
integrationsRouter.post('/depot/:resourceId/borrow', (req, res) => {
  const user = req.currentUser;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const id = Number(req.params.resourceId);
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }

  const resource = parseResource(row);
  if (!resource.is_physical) {
    res.status(400).json({ error: 'This resource is digital-only and not tracked in Depot.' });
    return;
  }
  if (resource.available_copies <= 0) {
    res.status(409).json({ error: 'No physical copies are currently available on the shelf.' });
    return;
  }
  if (resource.borrowed_by === user.id) {
    res.status(409).json({ error: 'You already have a borrowed copy of this book.' });
    return;
  }

  // Due in 14 days
  const due = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  db.prepare(
    `UPDATE resources
     SET available_copies = available_copies - 1,
         borrowed_by = ?,
         borrowed_by_name = ?,
         due_date = ?
     WHERE id = ?`
  ).run(user.id, user.name, due, id);

  const updated = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as Record<
    string,
    unknown
  >;
  res.json(parseResource(updated));
});

// POST /api/integrations/depot/:resourceId/return — Return a borrowed physical book copy
integrationsRouter.post('/depot/:resourceId/return', (req, res) => {
  const user = req.currentUser;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const id = Number(req.params.resourceId);
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }

  const resource = parseResource(row);
  if (!resource.is_physical) {
    res.status(400).json({ error: 'This resource is not tracked in Depot.' });
    return;
  }
  if (resource.available_copies >= resource.total_copies) {
    res.status(409).json({ error: 'All copies are already on the shelf.' });
    return;
  }
  if (resource.borrowed_by !== user.id && user.role !== 'admin') {
    res.status(403).json({ error: 'Only the borrower or an Admin can mark this book returned.' });
    return;
  }

  db.prepare(
    `UPDATE resources
     SET available_copies = MIN(total_copies, available_copies + 1),
         borrowed_by = NULL,
         borrowed_by_name = NULL,
         due_date = NULL
     WHERE id = ?`
  ).run(id);

  const updated = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as Record<
    string,
    unknown
  >;
  res.json(parseResource(updated));
});
