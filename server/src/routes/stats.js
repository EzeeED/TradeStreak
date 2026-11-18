import { Hono } from 'hono';
import { computeStats } from '../lib/stats.js';
import { getDb } from './helpers.js';
import { tradeFilters } from './trades.js';

const router = new Hono();

router.get('/', async (c) => {
  const db = getDb(c);
  const { sql, params } = await tradeFilters(db, c.get('userId'), c.req.query());
  const trades = await db.all(`SELECT * FROM trades t WHERE ${sql}`, params);
  return c.json(computeStats(trades));
});

export default router;
