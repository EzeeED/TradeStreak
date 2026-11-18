// Servidor Node: API + frontend compilado. Base de datos SQLite local (node:sqlite).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.js';
import { makeConfig } from './config.js';
import { openSqlite } from './db/sqlite.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = makeConfig(process.env);
const db = openSqlite(process.env.DB_PATH || path.join(root, 'data', 'tradestreak.db'));
const app = createApp({ basePath: config.basePath, resolve: () => ({ db, config }) });

// Frontend compilado (web/dist), servido bajo la misma subruta.
const webDist = path.resolve(root, '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  const base = config.basePath;
  const indexHtml = fs.readFileSync(path.join(webDist, 'index.html'), 'utf8');
  if (base) app.get('/', (c) => c.redirect(`${base}/dashboard`));
  app.use(`${base}/*`, serveStatic({ root: path.relative(process.cwd(), webDist), rewriteRequestPath: (p) => p.slice(base.length) || '/' }));
  app.get(`${base}/*`, (c) => c.html(indexHtml));
  if (base) app.get(base, (c) => c.redirect(`${base}/dashboard`));
}

const port = Number(process.env.PORT || 4000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`TradeStreak escuchando en http://localhost:${port}${config.basePath || ''}`);
});
