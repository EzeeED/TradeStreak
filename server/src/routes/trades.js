import { Hono } from 'hono';
import { z } from 'zod';
import { HttpError } from '../auth.js';
import { accountIds, body, getDb, placeholders, parseTrade } from './helpers.js';

const router = new Hono();

const SORTS = {
  close_time: 'COALESCE(t.close_time, t.open_time)',
  open_time: 't.open_time',
  net_profit: 't.net_profit',
  symbol: 't.symbol',
  volume: 't.volume',
  duration_sec: 't.duration_sec',
};

/** Construye el WHERE común a listado y estadísticas a partir de los filtros de la query. */
export async function tradeFilters(db, userId, q) {
  const ids = await accountIds(db, userId, q.accountId);
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

router.get('/', async (c) => {
  const db = getDb(c);
  const q = c.req.query();
  const { sql, params } = await tradeFilters(db, c.get('userId'), q);
  const sort = SORTS[q.sort] || SORTS.close_time;
  const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(500, Math.max(1, Number(q.limit) || 50));
  const page = Math.max(1, Number(q.page) || 1);
  const total = await db.first(`SELECT COUNT(*) AS n, COALESCE(SUM(net_profit),0) AS pnl FROM trades t WHERE ${sql}`, params);
  const rows = await db.all(
    `SELECT t.*, a.name AS account_name, a.currency FROM trades t JOIN accounts a ON a.id = t.account_id
     WHERE ${sql} ORDER BY ${sort} ${dir}, t.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit],
  );
  return c.json({ trades: rows.map(parseTrade), total: total.n, pnl: Math.round(total.pnl * 100) / 100, page, limit });
});

router.get('/filters', async (c) => {
  const db = getDb(c);
  const ids = await accountIds(db, c.get('userId'), c.req.query('accountId'));
  const ph = placeholders(ids);
  const [symbols, setups, tags, mistakes] = await Promise.all([
    db.all(`SELECT DISTINCT symbol AS v FROM trades WHERE account_id IN (${ph}) ORDER BY 1`, ids),
    db.all(`SELECT DISTINCT setup AS v FROM trades WHERE setup IS NOT NULL AND setup != '' AND account_id IN (${ph}) ORDER BY 1`, ids),
    db.all(`SELECT DISTINCT j.value AS v FROM trades t, json_each(t.tags) j WHERE t.account_id IN (${ph}) ORDER BY 1`, ids),
    db.all(`SELECT DISTINCT j.value AS v FROM trades t, json_each(t.mistakes) j WHERE t.account_id IN (${ph}) ORDER BY 1`, ids),
  ]);
  const vals = (rows) => rows.map((r) => r.v);
  return c.json({ symbols: vals(symbols), setups: vals(setups), tags: vals(tags), mistakes: vals(mistakes) });
});

async function ownedTrade(db, userId, id) {
  const t = await db.first(
    `SELECT t.*, a.name AS account_name, a.currency FROM trades t JOIN accounts a ON a.id = t.account_id
     WHERE t.id = ? AND a.user_id = ?`,
    [Number(id), userId],
  );
  if (!t) throw new HttpError(404, 'Trade no encontrado');
  return t;
}

router.get('/:id', async (c) => {
  const db = getDb(c);
  const trade = await ownedTrade(db, c.get('userId'), c.req.param('id'));
  const deals = await db.all('SELECT * FROM deals WHERE account_id = ? AND position_id = ? ORDER BY time', [trade.account_id, trade.position_id]);
  return c.json({ trade: parseTrade(trade), deals });
});

const tagList = z.array(z.string().trim().min(1).max(40)).max(30);
const patchSchema = z.object({
  notes: z.string().max(20000).nullable().optional(),
  setup: z.string().trim().max(60).nullable().optional(),
  tags: tagList.optional(),
  mistakes: tagList.optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

router.patch('/:id', async (c) => {
  const db = getDb(c);
  const trade = await ownedTrade(db, c.get('userId'), c.req.param('id'));
  const data = patchSchema.parse(await body(c));
  await db.run('UPDATE trades SET notes = ?, setup = ?, tags = ?, mistakes = ?, rating = ? WHERE id = ?', [
    data.notes !== undefined ? data.notes : trade.notes,
    data.setup !== undefined ? data.setup || null : trade.setup,
    data.tags ? JSON.stringify([...new Set(data.tags)]) : trade.tags,
    data.mistakes ? JSON.stringify([...new Set(data.mistakes)]) : trade.mistakes,
    data.rating !== undefined ? data.rating : trade.rating,
    trade.id,
  ]);
  return c.json({ trade: parseTrade(await ownedTrade(db, c.get('userId'), trade.id)) });
});

export default router;
