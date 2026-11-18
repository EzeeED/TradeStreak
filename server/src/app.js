import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { config } from './config.js';
import { requireAuth, HttpError } from './auth.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import tradeRoutes from './routes/trades.js';
import statsRoutes from './routes/stats.js';
import journalRoutes from './routes/journal.js';
import settingsRoutes from './routes/settings.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  const r = express.Router();
  r.get('/api/health', (req, res) => res.json({ ok: true }));
  r.use('/api/auth', authRoutes);
  r.use('/api/accounts', requireAuth, accountRoutes);
  r.use('/api/trades', requireAuth, tradeRoutes);
  r.use('/api/stats', requireAuth, statsRoutes);
  r.use('/api/journal', requireAuth, journalRoutes);
  r.use('/api/settings', requireAuth, settingsRoutes);
  r.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // En producción servimos el frontend compilado
  if (fs.existsSync(config.webDist)) {
    r.use(express.static(config.webDist, { index: false }));
    r.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(config.webDist, 'index.html')));
  }

  const base = config.basePath;
  if (base) app.get('/', (req, res) => res.redirect(base + '/dashboard'));
  app.use(base || '/', r);

  app.use((err, req, res, next) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || 'Datos inválidos', issues: err.issues });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    const status = err.status || 500;
    if (status >= 500 && !(err instanceof HttpError)) console.error(err);
    const message = status < 500 || err instanceof HttpError ? err.message : 'Error interno del servidor';
    res.status(status).json({ error: message });
  });

  return app;
}
