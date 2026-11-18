import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp } from '../src/app.js';
import { buildTrade, normalizeDeal, ingestDeals } from '../src/lib/mt5.js';
import { db } from '../src/db.js';
import { parseMt5HtmlReport } from '../src/lib/importers.js';

let server, base, token;

async function api(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch(base + path, {
    method,
    headers: { ...(auth && token ? { authorization: `Bearer ${token}` } : {}), ...(body && !isForm ? { 'content-type': 'application/json' } : {}), ...headers },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('buildTrade agrupa deals de entrada y salida parcial', () => {
  const deals = [
    { ticket: 1, position_id: 7, time: 1709547301, type: 0, entry: 0, symbol: 'EURUSD', volume: 1, price: 1.1, commission: -3.5 },
    { ticket: 2, position_id: 7, time: 1709550000, type: 1, entry: 1, symbol: 'EURUSD', volume: 0.5, price: 1.102, profit: 100, commission: -1.75 },
    { ticket: 3, position_id: 7, time: 1709553600, type: 1, entry: 1, symbol: 'EURUSD', volume: 0.5, price: 1.104, profit: 200, commission: -1.75 },
  ].map(normalizeDeal);
  const t = buildTrade('7', deals);
  assert.equal(t.side, 'long');
  assert.equal(t.status, 'closed');
  assert.equal(t.volume, 1);
  assert.ok(Math.abs(t.exit_price - 1.103) < 1e-9);
  assert.equal(t.net_profit, 293);
  assert.equal(t.duration_sec, 6299);

  const open = buildTrade('7', deals.slice(0, 2));
  assert.equal(open.status, 'open');
});

test('parsea informe HTML de MT5 ignorando órdenes y celdas ocultas', () => {
  const { trades, meta } = parseMt5HtmlReport(fs.readFileSync(new URL('./fixtures/report.html', import.meta.url), 'utf8'));
  assert.equal(trades.length, 2);
  assert.equal(meta.login, '51234567');
  assert.equal(trades[0].net_profit, 121.5);
  assert.equal(trades[1].side, 'short');
  assert.equal(trades[1].entry_price, 2110.5);
  assert.equal(trades[1].open_time, '2024-03-05T14:00:00');
});

test('flujo completo: registro, cuenta, deals, diario, stats', async () => {
  let r = await api('/api/auth/register', { method: 'POST', body: { name: 'Ana', email: 'ana@test.com', password: 'supersecreta' } });
  assert.equal(r.status, 201);
  token = r.data.token;

  r = await api('/api/auth/register', { method: 'POST', body: { name: 'Ana', email: 'ana@test.com', password: 'supersecreta' } });
  assert.equal(r.status, 409);

  // Sin METAAPI_TOKEN la conexión por servidor está desactivada
  r = await api('/api/accounts', { method: 'POST', body: { name: 'FTMO', login: '123', server: 'FTMO-Demo', password: 'x' } });
  assert.equal(r.status, 503);

  // Simulamos una cuenta conectada por servidor recibiendo deals de MT5
  const userId = db.prepare('SELECT id FROM users WHERE email = ?').get('ana@test.com').id;
  const accId = Number(db.prepare("INSERT INTO accounts (user_id, name, connection_type, login, status) VALUES (?, 'FTMO 100k', 'metaapi', '51234567', 'connected')").run(userId).lastInsertRowid);
  const deals = [
    { id: '10', positionId: '100', brokerTime: '2024-03-04 10:15:01.000', type: 'DEAL_TYPE_BUY', entryType: 'DEAL_ENTRY_IN', symbol: 'EURUSD', volume: 1, price: 1.1, commission: -3 },
    { id: '11', positionId: '100', brokerTime: '2024-03-04 11:00:00.000', type: 'DEAL_TYPE_SELL', entryType: 'DEAL_ENTRY_OUT', symbol: 'EURUSD', volume: 1, price: 1.102, profit: 200, commission: -3 },
    { id: '12', positionId: '101', brokerTime: '2024-03-05 11:00:00.000', type: 'DEAL_TYPE_SELL', entryType: 'DEAL_ENTRY_IN', symbol: 'XAUUSD', volume: 0.1, price: 2100 },
    { id: '13', positionId: '101', brokerTime: '2024-03-05 12:00:00.000', type: 'DEAL_TYPE_BUY', entryType: 'DEAL_ENTRY_OUT', symbol: 'XAUUSD', volume: 0.1, price: 2105, profit: -50 },
    { id: '14', positionId: '102', brokerTime: '2024-03-06 11:00:00.000', type: 'DEAL_TYPE_BUY', entryType: 'DEAL_ENTRY_IN', symbol: 'NAS100', volume: 1, price: 18000 },
    { id: '9', brokerTime: '2024-03-01 09:00:00.000', type: 'DEAL_TYPE_BALANCE', profit: 10000 },
  ];
  assert.equal(ingestDeals(accId, deals).trades, 3);
  ingestDeals(accId, deals); // idempotente

  r = await api('/api/trades');
  assert.equal(r.data.total, 3);
  const eurusd = r.data.trades.find((t) => t.symbol === 'EURUSD');
  assert.equal(eurusd.net_profit, 194);

  // Notas y tags del diario sobreviven a una nueva sincronización
  r = await api(`/api/trades/${eurusd.id}`, { method: 'PATCH', body: { notes: 'Buen trade', tags: ['A+', 'Londres'], setup: 'Breakout', rating: 5 } });
  assert.deepEqual(r.data.trade.tags, ['A+', 'Londres']);
  ingestDeals(accId, deals);
  r = await api(`/api/trades/${eurusd.id}`);
  assert.equal(r.data.trade.notes, 'Buen trade');
  assert.equal(r.data.deals.length, 2);

  r = await api('/api/trades?tag=Londres');
  assert.equal(r.data.total, 1);

  r = await api('/api/stats');
  assert.equal(r.data.summary.totalTrades, 2);
  assert.equal(r.data.summary.openTrades, 1);
  assert.equal(r.data.summary.winRate, 50);
  assert.equal(r.data.summary.netPnl, 144);
  assert.equal(r.data.summary.currentStreakType, 'loss');
  assert.ok(r.data.score.total >= 0 && r.data.score.total <= 100);

  // Diario
  r = await api('/api/journal/2024-03-04', { method: 'PUT', body: { content: 'Día disciplinado', mood: 4 } });
  assert.equal(r.data.entry.mood, 4);

  // Otro usuario no ve nada ajeno
  const other = await api('/api/auth/register', { method: 'POST', body: { name: 'Bob', email: 'bob@test.com', password: 'otraclave123' }, auth: false });
  const saved = token;
  token = other.data.token;
  r = await api(`/api/accounts/${accId}`);
  assert.equal(r.status, 404);
  r = await api(`/api/trades/${eurusd.id}`);
  assert.equal(r.status, 404);
  token = saved;

  // Demo
  r = await api('/api/accounts/demo', { method: 'POST' });
  assert.equal(r.status, 201);
  assert.ok(r.data.account.trade_count > 50);
});
