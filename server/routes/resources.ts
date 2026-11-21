import { Router } from 'express';
import { db, parseResource, syncResourceFts } from '../db.ts';
import { canModifyOwnedItem, requireRole } from '../auth.ts';
import type { ResourceFacets } from '../../src/types.ts';

export const resourcesRouter = Router();

// Lightweight in-memory cache for filter facets (invalidated on any write)
let cachedFacets: ResourceFacets | null = null;

export function invalidateFacetsCache() {
  cachedFacets = null;
}

function getFacets(): ResourceFacets {
  if (cachedFacets) return cachedFacets;

  const allRows = db.prepare('SELECT course, topic, tags FROM resources').all() as {
    course: string;
    topic: string;
    tags: string;
  }[];

  const courseSet = new Set<string>();
  const topicSet = new Set<string>();
  const tagSet = new Set<string>();

  for (const row of allRows) {
    courseSet.add(row.course);
    topicSet.add(row.topic);
    try {
      const parsed = JSON.parse(row.tags) as string[];
      parsed.forEach((t) => tagSet.add(t.toLowerCase()));
    } catch {
      // ignore invalid JSON
    }
  }

  cachedFacets = {
    courses: Array.from(courseSet).sort(),
    topics: Array.from(topicSet).sort(),
    levels: ['Beginner', 'Intermediate', 'Advanced'],
    types: ['book', 'article', 'video', 'recording'],
    tags: Array.from(tagSet).sort(),
  };

  return cachedFacets;
}

function buildFtsQuery(raw: string): string | null {
  const tokens = raw
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replace(/"/g, '')}"*`).join(' ');
}

function validateLegitimateUrl(urlString: string): { ok: true; domain: string } | { ok: false; error: string } {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'URL must start with http:// or https://' };
    }
    const lower = urlString.toLowerCase();
    if (lower.endsWith('.torrent') || lower.includes('libgen') || lower.includes('piratebay')) {
      return {
        ok: false,
        error:
          'Academy Library only links to legitimate sources (publisher pages, open-access material, or licensed platforms).',
      };
    }
    return { ok: true, domain: parsed.hostname.replace(/^www\./, '') };
  } catch {
    return { ok: false, error: 'Please enter a valid URL (e.g. https://developer.mozilla.org/...)' };
  }
}

// GET /api/resources — Full-text search + multi-facet filtering
resourcesRouter.get('/', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const course = typeof req.query.course === 'string' ? req.query.course.trim() : '';
  const topic = typeof req.query.topic === 'string' ? req.query.topic.trim() : '';
  const level = typeof req.query.level === 'string' ? req.query.level.trim() : '';
  const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim().toLowerCase() : '';
  const physicalOnly = req.query.physicalOnly === 'true';
  const availableOnly = req.query.availableOnly === 'true';

  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  const ftsQuery = q ? buildFtsQuery(q) : null;
  let fromClause = 'FROM resources r';
  let orderClause = 'ORDER BY r.created_at DESC, r.id DESC';

  if (ftsQuery) {
    fromClause = 'FROM resources r JOIN resources_fts fts ON r.id = fts.rowid';
    whereClauses.push('resources_fts MATCH ?');
    params.push(ftsQuery);
    orderClause = 'ORDER BY bm25(resources_fts) ASC, r.id DESC';
  }

  if (course) {
    whereClauses.push('r.course = ?');
    params.push(course);
  }
  if (topic) {
    whereClauses.push('r.topic = ?');
    params.push(topic);
  }
  if (level) {
    whereClauses.push('r.level = ?');
    params.push(level);
  }
  if (type) {
    whereClauses.push('r.resource_type = ?');
    params.push(type);
  }
  if (physicalOnly) {
    whereClauses.push('r.is_physical = 1');
  }
  if (availableOnly) {
    whereClauses.push('r.is_physical = 1 AND r.available_copies > 0');
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `SELECT r.* ${fromClause} ${whereSql} ${orderClause}`;

  let rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  let resources = rows.map(parseResource);

  if (tag) {
    resources = resources.filter((item) => item.tags.some((t) => t.toLowerCase() === tag));
  }

  res.json({
    resources,
    total: resources.length,
    facets: getFacets(),
    searchMode: ftsQuery ? 'fts5' : 'browse',
  });
});

// POST /api/resources — Create resource (Lecturer or Admin)
resourcesRouter.post('/', requireRole('lecturer', 'admin'), (req, res) => {
  const user = req.currentUser!;
  const {
    title,
    description,
    url,
    source_type = 'open-access',
    resource_type = 'article',
    course,
    topic,
    level = 'Beginner',
    tags = [],
    author = '',
    preview_image = null,
    duration_or_pages = null,
    is_physical = false,
    depot_shelf = null,
    total_copies = 0,
  } = req.body ?? {};

  if (!title || !description || !url || !course || !topic) {
    res.status(400).json({ error: 'Title, description, URL, course, and topic are required.' });
    return;
  }

  const urlCheck = validateLegitimateUrl(String(url));
  if (!urlCheck.ok) {
    res.status(400).json({ error: urlCheck.error });
    return;
  }

  const normalizedTags = Array.isArray(tags)
    ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    : String(tags)
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

  const copies = is_physical ? Math.max(1, Number(total_copies) || 1) : 0;

  const result = db
    .prepare(
      `INSERT INTO resources (
        title, description, url, source_type, resource_type,
        course, topic, level, tags, author,
        preview_image, preview_domain, duration_or_pages,
        is_physical, depot_shelf, total_copies, available_copies,
        created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(title).trim(),
      String(description).trim(),
      String(url).trim(),
      String(source_type),
      String(resource_type),
      String(course).trim(),
      String(topic).trim(),
      String(level),
      JSON.stringify(normalizedTags),
      String(author).trim(),
      preview_image ? String(preview_image) : null,
      urlCheck.domain,
      duration_or_pages ? String(duration_or_pages).trim() : null,
      is_physical ? 1 : 0,
      is_physical && depot_shelf ? String(depot_shelf).trim() : null,
      copies,
      copies,
      user.id,
      user.name
    );

  const newId = Number(result.lastInsertRowid);
  syncResourceFts(newId);
  invalidateFacetsCache();

  const created = db.prepare('SELECT * FROM resources WHERE id = ?').get(newId) as Record<
    string,
    unknown
  >;
  res.status(201).json(parseResource(created));
});

// PUT /api/resources/:id — Update resource (Owner Lecturer or Admin)
resourcesRouter.put('/:id', requireRole('lecturer', 'admin'), (req, res) => {
  const user = req.currentUser!;
  const id = Number(req.params.id);
  const existingRow = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;

  if (!existingRow) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }

  const existing = parseResource(existingRow);
  if (!canModifyOwnedItem(user, existing.created_by)) {
    res.status(403).json({
      error: 'You can only edit resources you created (unless you are an Admin).',
    });
    return;
  }

  const {
    title = existing.title,
    description = existing.description,
    url = existing.url,
    source_type = existing.source_type,
    resource_type = existing.resource_type,
    course = existing.course,
    topic = existing.topic,
    level = existing.level,
    tags = existing.tags,
    author = existing.author,
    preview_image = existing.preview_image,
    duration_or_pages = existing.duration_or_pages,
    is_physical = existing.is_physical,
    depot_shelf = existing.depot_shelf,
    total_copies = existing.total_copies,
  } = req.body ?? {};

  const urlCheck = validateLegitimateUrl(String(url));
  if (!urlCheck.ok) {
    res.status(400).json({ error: urlCheck.error });
    return;
  }

  const normalizedTags = Array.isArray(tags)
    ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    : String(tags)
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

  const copies = is_physical ? Math.max(1, Number(total_copies) || 1) : 0;
  const borrowedCount = existing.total_copies - existing.available_copies;
  const availableCopies = is_physical ? Math.max(0, copies - borrowedCount) : 0;

  db.prepare(
    `UPDATE resources SET
      title = ?, description = ?, url = ?, source_type = ?, resource_type = ?,
      course = ?, topic = ?, level = ?, tags = ?, author = ?,
      preview_image = ?, preview_domain = ?, duration_or_pages = ?,
      is_physical = ?, depot_shelf = ?, total_copies = ?, available_copies = ?
    WHERE id = ?`
  ).run(
    String(title).trim(),
    String(description).trim(),
    String(url).trim(),
    String(source_type),
    String(resource_type),
    String(course).trim(),
    String(topic).trim(),
    String(level),
    JSON.stringify(normalizedTags),
    String(author).trim(),
    preview_image ? String(preview_image) : null,
    urlCheck.domain,
    duration_or_pages ? String(duration_or_pages).trim() : null,
    is_physical ? 1 : 0,
    is_physical && depot_shelf ? String(depot_shelf).trim() : null,
    copies,
    availableCopies,
    id
  );

  syncResourceFts(id);
  invalidateFacetsCache();

  const updated = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as Record<
    string,
    unknown
  >;
  res.json(parseResource(updated));
});

// DELETE /api/resources/:id — Delete resource (Owner Lecturer or Admin)
resourcesRouter.delete('/:id', requireRole('lecturer', 'admin'), (req, res) => {
  const user = req.currentUser!;
  const id = Number(req.params.id);
  const existingRow = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;

  if (!existingRow) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }

  const existing = parseResource(existingRow);
  if (!canModifyOwnedItem(user, existing.created_by)) {
    res.status(403).json({
      error: 'You can only delete resources you created (unless you are an Admin).',
    });
    return;
  }

  // Remove from FTS5 before deleting from main table
  db.prepare(
    `INSERT INTO resources_fts(resources_fts, rowid, title, description, author, course, topic, tags)
     VALUES ('delete', ?, '', '', '', '', '', '')`
  ).run(id);
  db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  invalidateFacetsCache();

  res.json({ deleted: true, id });
});
