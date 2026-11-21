import express from 'express';
import cors from 'cors';
import { db, initDatabase, parseUser } from './db.ts';
import { attachUser } from './auth.ts';
import { resourcesRouter } from './routes/resources.ts';
import { collectionsRouter } from './routes/collections.ts';
import { previewRouter } from './routes/preview.ts';
import { integrationsRouter } from './routes/integrations.ts';

initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin: allowedOrigin,
    allowedHeaders: ['Content-Type', 'X-User-Id'],
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(attachUser);

app.get('/', (_req, res) => {
  res.json({
    service: 'Picsart Academy Library API',
    status: 'ok',
    health: '/api/health',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'academy-library-api' });
});

app.get('/api/users', (_req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY id ASC').all() as Record<string, unknown>[];
  res.json({ users: rows.map(parseUser) });
});

app.use('/api/resources', resourcesRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/link-preview', previewRouter);
app.use('/api/integrations', integrationsRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Academy Library API running on http://0.0.0.0:${PORT}`);
});
