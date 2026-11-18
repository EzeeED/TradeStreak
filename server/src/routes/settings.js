import { Hono } from 'hono';
import { z } from 'zod';
import { body, getDb } from './helpers.js';

const router = new Hono();

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

router.get('/', async (c) => {
  const row = await getDb(c).first('SELECT dashboard_layout FROM user_settings WHERE user_id = ?', [c.get('userId')]);
  return c.json({ dashboardLayout: row?.dashboard_layout ? JSON.parse(row.dashboard_layout) : null });
});

router.put('/dashboard', async (c) => {
  const input = await body(c);
  const layout = input.layout === null ? null : layoutSchema.parse(input.layout);
  await getDb(c).run(
    `INSERT INTO user_settings (user_id, dashboard_layout) VALUES (?, ?)
     ON CONFLICT (user_id) DO UPDATE SET dashboard_layout = excluded.dashboard_layout, updated_at = datetime('now')`,
    [c.get('userId'), layout ? JSON.stringify(layout) : null],
  );
  return c.json({ dashboardLayout: layout });
});

export default router;
