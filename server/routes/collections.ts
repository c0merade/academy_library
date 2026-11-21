import { Router } from 'express';
import { db, parseResource } from '../db.ts';
import { canModifyOwnedItem, requireRole } from '../auth.ts';
import type { Collection } from '../../src/types.ts';

export const collectionsRouter = Router();

function loadCollectionWithItems(row: Record<string, unknown>): Collection {
  const id = Number(row.id);
  const itemRows = db
    .prepare(
      `SELECT r.* FROM resources r
       JOIN collection_items ci ON ci.resource_id = r.id
       WHERE ci.collection_id = ?
       ORDER BY ci.added_at DESC`
    )
    .all(id) as Record<string, unknown>[];

  return {
    id,
    title: String(row.title),
    description: String(row.description ?? ''),
    group_name: String(row.group_name),
    course: String(row.course),
    created_by: Number(row.created_by),
    created_by_name: String(row.created_by_name),
    created_at: String(row.created_at),
    items: itemRows.map(parseResource),
  };
}

// GET /api/collections — Optimized batch query (no N+1)
collectionsRouter.get('/', (_req, res) => {
  const colRows = db
    .prepare('SELECT * FROM collections ORDER BY created_at DESC, id DESC')
    .all() as Record<string, unknown>[];

  const itemRows = db
    .prepare(
      `SELECT ci.collection_id, r.*
       FROM collection_items ci
       JOIN resources r ON r.id = ci.resource_id
       ORDER BY ci.added_at DESC`
    )
    .all() as Record<string, unknown>[];

  const itemsByCollection = new Map<number, ReturnType<typeof parseResource>[]>();
  for (const row of itemRows) {
    const colId = Number(row.collection_id);
    const list = itemsByCollection.get(colId) ?? [];
    list.push(parseResource(row));
    itemsByCollection.set(colId, list);
  }

  const collections: Collection[] = colRows.map((row) => {
    const id = Number(row.id);
    return {
      id,
      title: String(row.title),
      description: String(row.description ?? ''),
      group_name: String(row.group_name),
      course: String(row.course),
      created_by: Number(row.created_by),
      created_by_name: String(row.created_by_name),
      created_at: String(row.created_at),
      items: itemsByCollection.get(id) ?? [],
    };
  });

  res.json({ collections });
});

// POST /api/collections — Lecturer or Admin
collectionsRouter.post('/', requireRole('lecturer', 'admin'), (req, res) => {
  const user = req.currentUser!;
  const { title, description = '', group_name, course } = req.body ?? {};

  if (!title || !group_name || !course) {
    res.status(400).json({ error: 'Title, group name, and course are required.' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO collections (title, description, group_name, course, created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(title).trim(),
      String(description).trim(),
      String(group_name).trim(),
      String(course).trim(),
      user.id,
      user.name
    );

  const row = db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Record<string, unknown>;

  res.status(201).json(loadCollectionWithItems(row));
});

// POST /api/collections/:id/items — Add a resource to a collection
collectionsRouter.post('/:id/items', requireRole('lecturer', 'admin'), (req, res) => {
  const user = req.currentUser!;
  const collectionId = Number(req.params.id);
  const resourceId = Number(req.body?.resource_id);

  const col = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId) as
    | Record<string, unknown>
    | undefined;
  if (!col) {
    res.status(404).json({ error: 'Collection not found.' });
    return;
  }
  if (!canModifyOwnedItem(user, Number(col.created_by))) {
    res.status(403).json({ error: 'You can only modify your own collections.' });
    return;
  }

  const resource = db.prepare('SELECT id FROM resources WHERE id = ?').get(resourceId);
  if (!resource) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }

  db.prepare(
    'INSERT OR IGNORE INTO collection_items (collection_id, resource_id) VALUES (?, ?)'
  ).run(collectionId, resourceId);

  res.json(loadCollectionWithItems(col));
});

// DELETE /api/collections/:id/items/:resourceId — Remove a resource from a collection
collectionsRouter.delete('/:id/items/:resourceId', requireRole('lecturer', 'admin'), (req, res) => {
  const user = req.currentUser!;
  const collectionId = Number(req.params.id);
  const resourceId = Number(req.params.resourceId);

  const col = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId) as
    | Record<string, unknown>
    | undefined;
  if (!col) {
    res.status(404).json({ error: 'Collection not found.' });
    return;
  }
  if (!canModifyOwnedItem(user, Number(col.created_by))) {
    res.status(403).json({ error: 'You can only modify your own collections.' });
    return;
  }

  db.prepare('DELETE FROM collection_items WHERE collection_id = ? AND resource_id = ?').run(
    collectionId,
    resourceId
  );

  res.json(loadCollectionWithItems(col));
});

// DELETE /api/collections/:id
collectionsRouter.delete('/:id', requireRole('lecturer', 'admin'), (req, res) => {
  const user = req.currentUser!;
  const collectionId = Number(req.params.id);

  const col = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId) as
    | Record<string, unknown>
    | undefined;
  if (!col) {
    res.status(404).json({ error: 'Collection not found.' });
    return;
  }
  if (!canModifyOwnedItem(user, Number(col.created_by))) {
    res.status(403).json({ error: 'You can only delete your own collections.' });
    return;
  }

  db.prepare('DELETE FROM collections WHERE id = ?').run(collectionId);
  res.json({ deleted: true, id: collectionId });
});
