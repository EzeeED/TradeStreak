import { Hono } from 'hono';
import { z } from 'zod';
import { body, getDb } from './helpers.js';

const router = new Hono();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

router.get('/', async (c) => {
  const db = getDb(c);
  const m = c.req.query('month') || '';
  const month = /^\d{4}-\d{2}$/.test(m) ? m : null;
  const entries = month
    ? await db.all('SELECT * FROM journal_entries WHERE user_id = ? AND substr(date, 1, 7) = ? ORDER BY date DESC', [c.get('userId'), month])
    : await db.all('SELECT * FROM journal_entries WHERE user_id = ? ORDER BY date DESC LIMIT 60', [c.get('userId')]);
  return c.json({ entries });
});

router.get('/:date', async (c) => {
  const date = dateSchema.parse(c.req.param('date'));
  const entry = await getDb(c).first('SELECT * FROM journal_entries WHERE user_id = ? AND date = ?', [c.get('userId'), date]);
  return c.json({ entry: entry ?? { date, content: '', mood: null } });
});

router.put('/:date', async (c) => {
  const db = getDb(c);
  const date = dateSchema.parse(c.req.param('date'));
  const { content, mood } = z
    .object({ content: z.string().max(50000).default(''), mood: z.number().int().min(1).max(5).nullable().optional() })
    .parse(await body(c));
  await db.run(
    `INSERT INTO journal_entries (user_id, date, content, mood) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, date) DO UPDATE SET content = excluded.content, mood = excluded.mood, updated_at = datetime('now')`,
    [c.get('userId'), date, content, mood ?? null],
  );
  return c.json({ entry: await db.first('SELECT * FROM journal_entries WHERE user_id = ? AND date = ?', [c.get('userId'), date]) });
});

export default router;
