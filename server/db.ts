import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { Resource, User } from '../src/types.ts';

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(process.cwd(), 'academy-library.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);
export let hasFts5 = false;

// Enable foreign keys and WAL mode for reliability
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
`);

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('student', 'lecturer', 'admin')),
      group_name TEXT,
      skill_gaps TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      url TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK(source_type IN ('publisher', 'open-access', 'licensed', 'reel', 'depot')),
      resource_type TEXT NOT NULL CHECK(resource_type IN ('book', 'article', 'video', 'recording')),
      course TEXT NOT NULL,
      topic TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('Beginner', 'Intermediate', 'Advanced')),
      tags TEXT NOT NULL DEFAULT '[]',
      author TEXT NOT NULL DEFAULT '',
      preview_image TEXT,
      preview_domain TEXT,
      duration_or_pages TEXT,
      is_physical INTEGER NOT NULL DEFAULT 0,
      depot_shelf TEXT,
      total_copies INTEGER NOT NULL DEFAULT 0,
      available_copies INTEGER NOT NULL DEFAULT 0,
      borrowed_by INTEGER REFERENCES users(id),
      borrowed_by_name TEXT,
      due_date TEXT,
      reel_recording_id TEXT UNIQUE,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      group_name TEXT NOT NULL,
      course TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collection_items (
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (collection_id, resource_id)
    );

    -- Indexes for fast filtering, sorting, and Depot lookups
    CREATE INDEX IF NOT EXISTS idx_resources_course ON resources(course);
    CREATE INDEX IF NOT EXISTS idx_resources_topic ON resources(topic);
    CREATE INDEX IF NOT EXISTS idx_resources_level ON resources(level);
    CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
    CREATE INDEX IF NOT EXISTS idx_resources_physical ON resources(is_physical, available_copies);
    CREATE INDEX IF NOT EXISTS idx_resources_created_at ON resources(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_collection_items_resource ON collection_items(resource_id);
  `);

  // Enable SQLite FTS5 when compiled into the runtime; otherwise fall back gracefully
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS resources_fts USING fts5(
        title,
        description,
        author,
        course,
        topic,
        tags,
        content='resources',
        content_rowid='id'
      );
    `);
    hasFts5 = true;
  } catch {
    hasFts5 = false;
    console.warn('SQLite FTS5 module not available in this Node build; using SQL LIKE full-text search fallback.');
  }

  // Seed initial demo data if database is empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    seedDatabase();
  }
}

export function syncResourceFts(resourceId: number) {
  if (!hasFts5) return;

  const row = db
    .prepare('SELECT id, title, description, author, course, topic, tags FROM resources WHERE id = ?')
    .get(resourceId) as
    | {
        id: number;
        title: string;
        description: string;
        author: string;
        course: string;
        topic: string;
        tags: string;
      }
    | undefined;

  // Rebuild index cleanly for this row
  db.prepare(`INSERT INTO resources_fts(resources_fts, rowid, title, description, author, course, topic, tags)
              VALUES ('delete', ?, '', '', '', '', '', '')`).run(resourceId);

  if (row) {
    let tagsText = '';
    try {
      tagsText = (JSON.parse(row.tags) as string[]).join(' ');
    } catch {
      tagsText = row.tags;
    }
    db.prepare(
      `INSERT INTO resources_fts(rowid, title, description, author, course, topic, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(row.id, row.title, row.description, row.author, row.course, row.topic, tagsText);
  }
}

export function rebuildFtsIndex() {
  if (!hasFts5) return;
  db.exec(`INSERT INTO resources_fts(resources_fts) VALUES('rebuild');`);
}

export function parseUser(row: Record<string, unknown>): User {
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as User['role'],
    group_name: row.group_name ? String(row.group_name) : null,
    skill_gaps: safeParseArray(row.skill_gaps),
  };
}

export function parseResource(row: Record<string, unknown>): Resource {
  return {
    id: Number(row.id),
    title: String(row.title),
    description: String(row.description),
    url: String(row.url),
    source_type: row.source_type as Resource['source_type'],
    resource_type: row.resource_type as Resource['resource_type'],
    course: String(row.course),
    topic: String(row.topic),
    level: row.level as Resource['level'],
    tags: safeParseArray(row.tags),
    author: String(row.author ?? ''),
    preview_image: row.preview_image ? String(row.preview_image) : null,
    preview_domain: row.preview_domain ? String(row.preview_domain) : null,
    duration_or_pages: row.duration_or_pages ? String(row.duration_or_pages) : null,
    is_physical: Boolean(row.is_physical),
    depot_shelf: row.depot_shelf ? String(row.depot_shelf) : null,
    total_copies: Number(row.total_copies ?? 0),
    available_copies: Number(row.available_copies ?? 0),
    borrowed_by: row.borrowed_by != null ? Number(row.borrowed_by) : null,
    borrowed_by_name: row.borrowed_by_name ? String(row.borrowed_by_name) : null,
    due_date: row.due_date ? String(row.due_date) : null,
    reel_recording_id: row.reel_recording_id ? String(row.reel_recording_id) : null,
    created_by: Number(row.created_by),
    created_by_name: String(row.created_by_name),
    created_at: String(row.created_at),
  };
}

function safeParseArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function seedDatabase() {
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, role, group_name, skill_gaps)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'Ani Petrosyan',
    'ani@academy.edu',
    'student',
    'JS-24',
    JSON.stringify(['Async JavaScript', 'SQL & Databases', 'React State'])
  );
  insertUser.run(
    'Davit Sargsyan',
    'davit@academy.edu',
    'student',
    'PY-24',
    JSON.stringify(['REST APIs', 'Testing', 'System Design'])
  );
  insertUser.run(
    'Prof. Aram Grigoryan',
    'aram@academy.edu',
    'lecturer',
    'JS-24',
    JSON.stringify([])
  );
  insertUser.run(
    'Nare Hovhannisyan',
    'nare@academy.edu',
    'lecturer',
    'PY-24',
    JSON.stringify([])
  );
  insertUser.run('Mariam Hakobyan', 'admin@academy.edu', 'admin', null, JSON.stringify([]));

  const insertResource = db.prepare(`
    INSERT INTO resources (
      title, description, url, source_type, resource_type,
      course, topic, level, tags, author,
      preview_image, preview_domain, duration_or_pages,
      is_physical, depot_shelf, total_copies, available_copies,
      borrowed_by, borrowed_by_name, due_date, reel_recording_id,
      created_by, created_by_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedResources = [
    [
      'Eloquent JavaScript (4th Edition)',
      'A modern, open-access introduction to programming and JavaScript covering closures, async programming, Node.js, and browser APIs.',
      'https://eloquentjavascript.net/',
      'open-access',
      'book',
      'Web Development',
      'Async JavaScript',
      'Beginner',
      JSON.stringify(['javascript', 'promises', 'fundamentals', 'free-book']),
      'Marijn Haverbeke',
      'https://eloquentjavascript.net/img/cover.jpg',
      'eloquentjavascript.net',
      '472 pages',
      1,
      'Shelf A-1',
      3,
      2,
      1,
      'Ani Petrosyan',
      '2026-12-01',
      null,
      3,
      'Prof. Aram Grigoryan',
    ],
    [
      'MDN Guide: Using Promises & Async/Await',
      'Official Mozilla Developer Network guide explaining Promise chains, error handling, Promise.all, and async/await patterns with live examples.',
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises',
      'open-access',
      'article',
      'Web Development',
      'Async JavaScript',
      'Beginner',
      JSON.stringify(['javascript', 'async', 'promises', 'mdn']),
      'MDN Contributors',
      null,
      'developer.mozilla.org',
      '18 min read',
      0,
      null,
      0,
      0,
      null,
      null,
      null,
      null,
      3,
      'Prof. Aram Grigoryan',
    ],
    [
      'React Official Docs: Managing State',
      'Learn how to structure state cleanly, lift state up, preserve and reset state, and avoid redundant state bugs in React components.',
      'https://react.dev/learn/managing-state',
      'open-access',
      'article',
      'Web Development',
      'React State',
      'Intermediate',
      JSON.stringify(['react', 'state', 'hooks', 'architecture']),
      'React Team',
      null,
      'react.dev',
      '25 min read',
      0,
      null,
      0,
      0,
      null,
      null,
      null,
      null,
      3,
      'Prof. Aram Grigoryan',
    ],
    [
      'Designing Data-Intensive Applications',
      'Publisher page and physical office copies of Martin Kleppmann’s classic guide to databases, replication, partitioning, and distributed systems.',
      'https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/',
      'publisher',
      'book',
      'Computer Science',
      'System Design',
      'Advanced',
      JSON.stringify(['databases', 'distributed-systems', 'architecture', 'backend']),
      'Martin Kleppmann',
      null,
      'oreilly.com',
      '616 pages',
      1,
      'Shelf B-3',
      2,
      1,
      2,
      'Davit Sargsyan',
      '2026-11-28',
      null,
      4,
      'Nare Hovhannisyan',
    ],
    [
      'SQLite Full-Text Search (FTS5) Reference',
      'Complete reference for building fast full-text search indexes, ranking results with BM25, and highlighting snippets using SQLite FTS5.',
      'https://www.sqlite.org/fts5.html',
      'open-access',
      'article',
      'Backend Engineering',
      'SQL & Databases',
      'Intermediate',
      JSON.stringify(['sqlite', 'sql', 'search', 'fts5', 'indexing']),
      'SQLite Consortium',
      null,
      'sqlite.org',
      '30 min read',
      0,
      null,
      0,
      0,
      null,
      null,
      null,
      null,
      4,
      'Nare Hovhannisyan',
    ],
    [
      'Week 4 Live Lesson: Event Loop & Fetch API',
      'Recorded live session from JS-24 walking through the JavaScript call stack, microtask queue, and real-world API error handling.',
      'https://reel.academy.edu/recordings/js24-week4-event-loop',
      'reel',
      'recording',
      'Web Development',
      'Async JavaScript',
      'Beginner',
      JSON.stringify(['reel', 'event-loop', 'fetch', 'js-24']),
      'Prof. Aram Grigoryan',
      null,
      'reel.academy.edu',
      '1h 14m',
      0,
      null,
      0,
      0,
      null,
      null,
      null,
      'reel-rec-101',
      3,
      'Prof. Aram Grigoryan',
    ],
    [
      'Week 6 Live Lesson: Designing Clean REST APIs',
      'Recorded workshop covering HTTP status codes, pagination, filtering, authentication headers, and role-based permissions.',
      'https://reel.academy.edu/recordings/py24-week6-rest-apis',
      'reel',
      'recording',
      'Backend Engineering',
      'REST APIs',
      'Intermediate',
      JSON.stringify(['reel', 'rest', 'http', 'permissions', 'py-24']),
      'Nare Hovhannisyan',
      null,
      'reel.academy.edu',
      '1h 02m',
      0,
      null,
      0,
      0,
      null,
      null,
      null,
      'reel-rec-102',
      4,
      'Nare Hovhannisyan',
    ],
    [
      'Clean Code: A Handbook of Agile Software Craftsmanship',
      'Office library physical book with link to publisher catalogue. Covers naming, small functions, refactoring, and readable tests.',
      'https://www.pearson.com/en-us/subject-catalog/p/clean-code-a-handbook-of-agile-software-craftsmanship/P200000009044',
      'depot',
      'book',
      'Computer Science',
      'Testing',
      'Intermediate',
      JSON.stringify(['clean-code', 'refactoring', 'testing', 'best-practices']),
      'Robert C. Martin',
      null,
      'pearson.com',
      '464 pages',
      1,
      'Shelf A-2',
      2,
      2,
      null,
      null,
      null,
      null,
      5,
      'Mariam Hakobyan',
    ],
    [
      'Refactoring UI: Design Tips for Developers',
      'Practical visual hierarchy, spacing, color contrast, and typography principles for developers building clean product interfaces.',
      'https://www.refactoringui.com/',
      'licensed',
      'book',
      'UI/UX Design',
      'CSS & Design Systems',
      'Beginner',
      JSON.stringify(['ui', 'design', 'typography', 'tailwind']),
      'Adam Wathan & Steve Schoger',
      null,
      'refactoringui.com',
      '218 pages',
      1,
      'Shelf C-1',
      1,
      0,
      1,
      'Ani Petrosyan',
      '2026-11-25',
      null,
      3,
      'Prof. Aram Grigoryan',
    ],
    [
      'Testing JavaScript Applications — Intro Video',
      'Concise video walkthrough of unit tests, integration tests, mocking network requests, and testing user flows.',
      'https://www.youtube.com/watch?v=r9HdJ8P6GQI',
      'open-access',
      'video',
      'Backend Engineering',
      'Testing',
      'Beginner',
      JSON.stringify(['testing', 'vitest', 'jest', 'qa']),
      'Academind',
      null,
      'youtube.com',
      '38 min',
      0,
      null,
      0,
      0,
      null,
      null,
      null,
      null,
      4,
      'Nare Hovhannisyan',
    ],
    [
      'SQLBolt: Interactive SQL Lessons',
      'Hands-on browser exercises for SELECT, JOINs, aggregations, indexes, and schema design — ideal for building SQL fluency quickly.',
      'https://sqlbolt.com/',
      'open-access',
      'article',
      'Backend Engineering',
      'SQL & Databases',
      'Beginner',
      JSON.stringify(['sql', 'joins', 'interactive', 'databases']),
      'SQLBolt',
      null,
      'sqlbolt.com',
      '18 lessons',
      0,
      null,
      0,
      0,
      null,
      null,
      null,
      null,
      4,
      'Nare Hovhannisyan',
    ],
  ];

  for (const r of seedResources) {
    insertResource.run(...(r as Parameters<typeof insertResource.run>));
  }

  // Build FTS5 index from seeded rows
  rebuildFtsIndex();

  // Seed Group Collections
  const insertCollection = db.prepare(`
    INSERT INTO collections (title, description, group_name, course, created_by, created_by_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const c1 = insertCollection.run(
    'JS-24 Week 4–6 Essentials',
    'Core reading and recordings for mastering asynchronous JavaScript and React state management.',
    'JS-24',
    'Web Development',
    3,
    'Prof. Aram Grigoryan'
  );
  const c2 = insertCollection.run(
    'Backend & Database Starter Pack',
    'Everything PY-24 and full-stack students need for SQL, REST APIs, and clean testing habits.',
    'PY-24',
    'Backend Engineering',
    4,
    'Nare Hovhannisyan'
  );
  const c3 = insertCollection.run(
    'Office Bookshelf Must-Reads',
    'Physical books available in the academy office via Depot.',
    'All Groups',
    'Computer Science',
    5,
    'Mariam Hakobyan'
  );

  const insertItem = db.prepare(
    'INSERT INTO collection_items (collection_id, resource_id) VALUES (?, ?)'
  );
  insertItem.run(Number(c1.lastInsertRowid), 1);
  insertItem.run(Number(c1.lastInsertRowid), 2);
  insertItem.run(Number(c1.lastInsertRowid), 3);
  insertItem.run(Number(c1.lastInsertRowid), 6);

  insertItem.run(Number(c2.lastInsertRowid), 5);
  insertItem.run(Number(c2.lastInsertRowid), 7);
  insertItem.run(Number(c2.lastInsertRowid), 10);
  insertItem.run(Number(c2.lastInsertRowid), 11);

  insertItem.run(Number(c3.lastInsertRowid), 1);
  insertItem.run(Number(c3.lastInsertRowid), 4);
  insertItem.run(Number(c3.lastInsertRowid), 8);
  insertItem.run(Number(c3.lastInsertRowid), 9);
}
