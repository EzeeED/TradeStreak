import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';

const router = Router();

// Diseño del dashboard: lista ordenada de widgets con su ancho (en columnas de 12) y visibilidad.
const layoutSchema = z
  .array(
    z.object({
      id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
      span: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(12)]),
      hidden: z.boolean().default(false),
    }),
  )
  .max(40);

router.get('/', (req, res) => {
  const row = db.prepare('SELECT dashboard_layout FROM user_settings WHERE user_id = ?').get(req.userId);
  res.json({ dashboardLayout: row?.dashboard_layout ? JSON.parse(row.dashboard_layout) : null });
});

router.put('/dashboard', (req, res) => {
  const layout = req.body.layout === null ? null : layoutSchema.parse(req.body.layout);
  db.prepare(`INSERT INTO user_settings (user_id, dashboard_layout) VALUES (?, ?)
              ON CONFLICT (user_id) DO UPDATE SET dashboard_layout = excluded.dashboard_layout, updated_at = datetime('now')`)
    .run(req.userId, layout ? JSON.stringify(layout) : null);
  res.json({ dashboardLayout: layout });
});

export default router;
