// API de TradeStreak (Hono). La misma app corre en Node (node:sqlite) y en Cloudflare Workers (D1).
import { Hono } from 'hono';
import { ZodError } from 'zod';
import { requireAuth, HttpError } from './auth.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import tradeRoutes from './routes/trades.js';
import statsRoutes from './routes/stats.js';
import journalRoutes from './routes/journal.js';
import settingsRoutes from './routes/settings.js';

/**
 * @param {{ basePath?: string, resolve: (c) => { db, config } }} opts
 *   resolve devuelve la base de datos y la configuración para cada petición.
 */
export function createApp({ basePath = '', resolve }) {
  const app = new Hono();

  app.use('*', async (c, next) => {
    const { db, config } = resolve(c);
    c.set('db', db);
    c.set('config', config);
    await next();
  });

  const api = new Hono();
  api.get('/health', (c) => c.json({ ok: true }));
  api.route('/auth', authRoutes);
  for (const p of ['/accounts', '/trades', '/stats', '/journal', '/settings']) {
    api.use(p, requireAuth);
    api.use(`${p}/*`, requireAuth);
  }
  api.route('/accounts', accountRoutes);
  api.route('/trades', tradeRoutes);
  api.route('/stats', statsRoutes);
  api.route('/journal', journalRoutes);
  api.route('/settings', settingsRoutes);
  api.all('*', (c) => c.json({ error: 'Ruta no encontrada' }, 404));

  app.route(`${basePath}/api`, api);

  app.onError((err, c) => {
    if (err instanceof ZodError) {
      return c.json({ error: err.issues[0]?.message || 'Datos inválidos', issues: err.issues }, 400);
    }
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  });

  return app;
}
