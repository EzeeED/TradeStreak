import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { HttpError } from '../auth.js';
import { accountIds, placeholders, parseTrade } from './helpers.js';

const router = Router();

const SORTS = {
  close_time: 'COALESCE(t.close_time, t.open_time)',
  open_time: 't.open_time',
  net_profit: 't.net_profit',
  symbol: 't.symbol',
  volume: 't.volume',
  duration_sec: 't.duration_sec',
};

/** Construye el WHERE común a listado y estadísticas a partir de los filtros de la query. */
export function tradeFilters(userId, q) {
  const ids = accountIds(userId, q.accountId);
  const where = [`t.account_id IN (${placeholders(ids)})`];
  const params = [...ids];
  if (q.from) { where.push('substr(COALESCE(t.close_time, t.open_time), 1, 10) >= ?'); params.push(q.from); }
  if (q.to) { where.push('substr(COALESCE(t.close_time, t.open_time), 1, 10) <= ?'); params.push(q.to); }
  if (q.symbol) { where.push('t.symbol = ?'); params.push(q.symbol); }
  if (q.side) { where.push('t.side = ?'); params.push(q.side); }
  if (q.status) { where.push('t.status = ?'); params.push(q.status); }
  if (q.setup) { where.push('t.setup = ?'); params.push(q.setup); }
  if (q.result === 'win') where.push("t.status = 'closed' AND t.net_profit > 0");
  if (q.result === 'loss') where.push("t.status = 'closed' AND t.net_profit < 0");
  if (q.tag) { where.push('EXISTS (SELECT 1 FROM json_each(t.tags) WHERE value = ?)'); params.push(q.tag); }
  return { sql: where.join(' AND '), params };
}

router.get('/', (req, res) => {
  const { sql, params } = tradeFilters(req.userId, req.query);
  const sort = SORTS[req.query.sort] || SORTS.close_time;
  const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));
  const page = Math.max(1, Number(req.query.page) || 1);
  const total = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(net_profit),0) AS pnl FROM trades t WHERE ${sql}`).get(...params);
  const rows = db
    .prepare(`SELECT t.*, a.name AS account_name, a.currency FROM trades t JOIN accounts a ON a.id = t.account_id
              WHERE ${sql} ORDER BY ${sort} ${dir}, t.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);
  res.json({ trades: rows.map(parseTrade), total: total.n, pnl: Math.round(total.pnl * 100) / 100, page, limit });
});

router.get('/filters', (req, res) => {
  const ids = accountIds(req.userId, req.query.accountId);
  const ph = placeholders(ids);
  const symbols = db.prepare(`SELECT DISTINCT symbol FROM trades WHERE account_id IN (${ph}) ORDER BY symbol`).all(...ids).map((r) => r.symbol);
  const setups = db.prepare(`SELECT DISTINCT setup FROM trades WHERE setup IS NOT NULL AND setup != '' AND account_id IN (${ph}) ORDER BY setup`).all(...ids).map((r) => r.setup);
  const tags = db.prepare(`SELECT DISTINCT j.value AS tag FROM trades t, json_each(t.tags) j WHERE t.account_id IN (${ph}) ORDER BY 1`).all(...ids).map((r) => r.tag);
  const mistakes = db.prepare(`SELECT DISTINCT j.value AS m FROM trades t, json_each(t.mistakes) j WHERE t.account_id IN (${ph}) ORDER BY 1`).all(...ids).map((r) => r.m);
  res.json({ symbols, setups, tags, mistakes });
});

function ownedTrade(userId, id) {
  const t = db
    .prepare(`SELECT t.*, a.name AS account_name, a.currency FROM trades t JOIN accounts a ON a.id = t.account_id
              WHERE t.id = ? AND a.user_id = ?`)
    .get(Number(id), userId);
  if (!t) throw new HttpError(404, 'Trade no encontrado');
  return t;
}

router.get('/:id', (req, res) => {
  const trade = ownedTrade(req.userId, req.params.id);
  const deals = db.prepare('SELECT * FROM deals WHERE account_id = ? AND position_id = ? ORDER BY time').all(trade.account_id, trade.position_id);
  res.json({ trade: parseTrade(trade), deals });
});

const tagList = z.array(z.string().trim().min(1).max(40)).max(30);
const patchSchema = z.object({
  notes: z.string().max(20000).nullable().optional(),
  setup: z.string().trim().max(60).nullable().optional(),
  tags: tagList.optional(),
  mistakes: tagList.optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

router.patch('/:id', (req, res) => {
  const trade = ownedTrade(req.userId, req.params.id);
  const data = patchSchema.parse(req.body);
  const next = {
    notes: data.notes !== undefined ? data.notes : trade.notes,
    setup: data.setup !== undefined ? data.setup || null : trade.setup,
    tags: data.tags ? JSON.stringify([...new Set(data.tags)]) : trade.tags,
    mistakes: data.mistakes ? JSON.stringify([...new Set(data.mistakes)]) : trade.mistakes,
    rating: data.rating !== undefined ? data.rating : trade.rating,
  };
  db.prepare('UPDATE trades SET notes = :notes, setup = :setup, tags = :tags, mistakes = :mistakes, rating = :rating WHERE id = :id')
    .run({ ...next, id: trade.id });
  res.json({ trade: parseTrade(ownedTrade(req.userId, trade.id)) });
});

export default router;
