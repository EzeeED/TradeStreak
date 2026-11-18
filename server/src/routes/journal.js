import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';

const router = Router();
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : null;
  const rows = month
    ? db.prepare("SELECT * FROM journal_entries WHERE user_id = ? AND substr(date, 1, 7) = ? ORDER BY date DESC").all(req.userId, month)
    : db.prepare('SELECT * FROM journal_entries WHERE user_id = ? ORDER BY date DESC LIMIT 60').all(req.userId);
  res.json({ entries: rows });
});

router.get('/:date', (req, res) => {
  const date = z.string().regex(dateRe).parse(req.params.date);
  const entry = db.prepare('SELECT * FROM journal_entries WHERE user_id = ? AND date = ?').get(req.userId, date);
  res.json({ entry: entry ?? { date, content: '', mood: null } });
});

router.put('/:date', (req, res) => {
  const date = z.string().regex(dateRe).parse(req.params.date);
  const { content, mood } = z
    .object({ content: z.string().max(50000).default(''), mood: z.number().int().min(1).max(5).nullable().optional() })
    .parse(req.body);
  db.prepare(`INSERT INTO journal_entries (user_id, date, content, mood) VALUES (?, ?, ?, ?)
              ON CONFLICT (user_id, date) DO UPDATE SET content = excluded.content, mood = excluded.mood, updated_at = datetime('now')`)
    .run(req.userId, date, content, mood ?? null);
  res.json({ entry: db.prepare('SELECT * FROM journal_entries WHERE user_id = ? AND date = ?').get(req.userId, date) });
});

export default router;
