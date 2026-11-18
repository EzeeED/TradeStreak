import { Router } from 'express';
import { db } from '../db.js';
import { computeStats } from '../lib/stats.js';
import { tradeFilters } from './trades.js';

const router = Router();

router.get('/', (req, res) => {
  const { sql, params } = tradeFilters(req.userId, req.query);
  const trades = db.prepare(`SELECT * FROM trades t WHERE ${sql}`).all(...params);
  res.json(computeStats(trades));
});

export default router;
