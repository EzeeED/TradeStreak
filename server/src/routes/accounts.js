import { Hono } from 'hono';
import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { HttpError } from '../auth.js';
import { body, getDb, ownedAccount } from './helpers.js';
import { ingestDeals, upsertTrades } from '../lib/mt5.js';
import { decodeReport, parseMt5HtmlReport, parseTradesCsv } from '../lib/importers.js';
import { generateDemoDeals } from '../lib/demo.js';
import { metaapiClient } from '../lib/metaapi.js';

const router = new Hono();
const meta = (c) => metaapiClient(c.get('config').metaapi);

async function serialize(db, acc) {
  const stats = await db.first(
    `SELECT COUNT(*) AS trades, COALESCE(SUM(net_profit), 0) AS pnl, MIN(open_time) AS first_trade
     FROM trades WHERE account_id = ? AND status = 'closed'`,
    [acc.id],
  );
  return {
    ...acc,
    sync_token: undefined,
    trade_count: stats.trades,
    net_pnl: Math.round(stats.pnl * 100) / 100,
    first_trade: stats.first_trade,
  };
}

router.get('/', async (c) => {
  const db = getDb(c);
  const rows = await db.all('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at', [c.get('userId')]);
  return c.json({ accounts: await Promise.all(rows.map((r) => serialize(db, r))), metaapiEnabled: meta(c).enabled });
});

// Cuenta de demostración con datos generados (antes de '/:id' para no confundirla con un id)
router.post('/demo', async (c) => {
  const db = getDb(c);
  const { lastId } = await db.run(
    `INSERT INTO accounts (user_id, name, connection_type, broker, server, login, currency, status, last_sync_at)
     VALUES (?, 'Cuenta Demo', 'demo', 'TradeStreak Demo', 'Demo-Server', '10000001', 'USD', 'connected', datetime('now'))`,
    [c.get('userId')],
  );
  const { deals, setups } = generateDemoDeals();
  const result = await ingestDeals(db, lastId, deals);
  await db.batch(Object.entries(setups).map(([pid, setup]) => [
    'UPDATE trades SET setup = ? WHERE account_id = ? AND position_id = ?', [setup, lastId, pid],
  ]));
  const sum = (await db.first('SELECT COALESCE(SUM(net_profit), 0) AS s FROM trades WHERE account_id = ?', [lastId])).s;
  await db.run('UPDATE accounts SET balance = ?, equity = ? WHERE id = ?', [10000 + sum, 10000 + sum, lastId]);
  return c.json({ account: await serialize(db, await ownedAccount(db, c.get('userId'), lastId)), ...result }, 201);
});

router.get('/:id', async (c) => {
  const db = getDb(c);
  return c.json({ account: await serialize(db, await ownedAccount(db, c.get('userId'), c.req.param('id'))) });
});

const createSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre a la cuenta').max(80),
  connection_type: z.literal('metaapi').default('metaapi'),
  broker: z.string().trim().max(120).optional().nullable(),
  server: z.string().trim().max(120).optional().nullable(),
  login: z.string().trim().regex(/^\d*$/, 'El login de MT5 es numérico').max(20).optional().nullable(),
  password: z.string().max(200).optional(),
  currency: z.string().trim().length(3).optional(),
});

router.post('/', async (c) => {
  const db = getDb(c);
  const data = createSchema.parse(await body(c));
  const api = meta(c);
  if (!api.enabled) throw new HttpError(503, 'La conexión con servidores MT5 todavía no está activada en TradeStreak.');
  if (!data.login || !data.server || !data.password) throw new HttpError(400, 'Login, servidor y contraseña son obligatorios');
  let metaapiId;
  try {
    metaapiId = await api.createAccount({ login: data.login, password: data.password, server: data.server, name: data.name });
  } catch (err) {
    throw new HttpError(err.status === 202 ? 409 : 400, `MetaApi: ${err.message}`);
  }
  const { lastId } = await db.run(
    `INSERT INTO accounts (user_id, name, connection_type, broker, server, login, currency, metaapi_account_id, status)
     VALUES (?, ?, 'metaapi', ?, ?, ?, ?, ?, 'pending')`,
    [c.get('userId'), data.name, data.broker ?? null, data.server, data.login, (data.currency || 'USD').toUpperCase(), metaapiId],
  );
  return c.json({ account: await serialize(db, await ownedAccount(db, c.get('userId'), lastId)) }, 201);
});

router.patch('/:id', async (c) => {
  const db = getDb(c);
  const acc = await ownedAccount(db, c.get('userId'), c.req.param('id'));
  const data = z
    .object({ name: z.string().trim().min(1).max(80).optional(), broker: z.string().trim().max(120).nullable().optional(), currency: z.string().trim().length(3).optional() })
    .parse(await body(c));
  await db.run('UPDATE accounts SET name = COALESCE(?, name), broker = COALESCE(?, broker), currency = COALESCE(?, currency) WHERE id = ?', [
    data.name ?? null, data.broker ?? null, data.currency?.toUpperCase() ?? null, acc.id,
  ]);
  return c.json({ account: await serialize(db, await ownedAccount(db, c.get('userId'), acc.id)) });
});

router.delete('/:id', async (c) => {
  const db = getDb(c);
  const acc = await ownedAccount(db, c.get('userId'), c.req.param('id'));
  const api = meta(c);
  if (acc.metaapi_account_id && api.enabled) await api.deleteAccount(acc.metaapi_account_id).catch(() => {});
  // D1 no garantiza ON DELETE CASCADE en todas las configuraciones: borramos explícitamente.
  await db.batch([
    ['DELETE FROM deals WHERE account_id = ?', [acc.id]],
    ['DELETE FROM trades WHERE account_id = ?', [acc.id]],
    ['DELETE FROM accounts WHERE id = ?', [acc.id]],
  ]);
  return c.body(null, 204);
});

// Importar informe HTML de MT5 o CSV (disponible por API; la interfaz no lo muestra ahora mismo)
router.post('/:id/import', async (c) => {
  const db = getDb(c);
  const acc = await ownedAccount(db, c.get('userId'), c.req.param('id'));
  const form = await c.req.parseBody();
  const file = form.file;
  if (!file || typeof file === 'string') throw new HttpError(400, 'Adjunta un archivo');
  if (file.size > 20 * 1024 * 1024) throw new HttpError(413, 'El archivo es demasiado grande (máx. 20 MB)');
  const text = decodeReport(Buffer.from(await file.arrayBuffer()));
  const isHtml = /<html|<table/i.test(text.slice(0, 5000));
  const { trades, meta: info } = isHtml ? parseMt5HtmlReport(text) : parseTradesCsv(text);
  if (!trades.length) {
    throw new HttpError(422, 'No se encontraron operaciones cerradas. Exporta el informe desde MT5: pestaña Historial → clic derecho → Informe → HTML.');
  }
  const imported = await upsertTrades(db, acc.id, trades);
  await db.run(
    `UPDATE accounts SET status = 'connected', status_message = NULL, last_sync_at = datetime('now'),
     login = COALESCE(login, ?), broker = COALESCE(broker, ?), currency = COALESCE(?, currency) WHERE id = ?`,
    [info.login ?? null, info.company ?? null, info.currency ?? null, acc.id],
  );
  return c.json({ imported, format: isHtml ? 'mt5-html' : 'csv' });
});

// Sincronizar ahora (MetaApi)
router.post('/:id/sync', async (c) => {
  const db = getDb(c);
  const acc = await ownedAccount(db, c.get('userId'), c.req.param('id'));
  const api = meta(c);
  if (acc.connection_type !== 'metaapi') throw new HttpError(400, 'Esta cuenta no está conectada a un servidor MT5');
  if (!api.enabled) throw new HttpError(400, 'MetaApi no está configurado en el servidor');
  try {
    const info = await api.getAccount(acc.metaapi_account_id);
    if (info.state !== 'DEPLOYED' || info.connectionStatus !== 'CONNECTED') {
      const msg = `MetaApi: estado ${info.state} / ${info.connectionStatus}. La primera conexión puede tardar unos minutos.`;
      await db.run("UPDATE accounts SET status = 'pending', status_message = ? WHERE id = ?", [msg, acc.id]);
      return c.json({ pending: true, message: msg }, 202);
    }
    const last = (await db.first('SELECT MAX(time) AS t FROM deals WHERE account_id = ?', [acc.id])).t;
    const from = last ? new Date(Date.parse(last + 'Z') - 7 * 86400_000) : new Date('2000-01-01T00:00:00Z');
    const [deals, accountInfo] = await Promise.all([
      api.getHistoryDeals(acc.metaapi_account_id, info.region, from),
      api.getAccountInformation(acc.metaapi_account_id, info.region),
    ]);
    const result = await ingestDeals(db, acc.id, deals);
    await db.run(
      `UPDATE accounts SET status = 'connected', status_message = NULL, last_sync_at = datetime('now'),
       balance = ?, equity = ?, currency = COALESCE(?, currency), broker = COALESCE(?, broker) WHERE id = ?`,
      [accountInfo.balance ?? null, accountInfo.equity ?? null, accountInfo.currency ?? null, accountInfo.broker ?? null, acc.id],
    );
    return c.json(result);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    await db.run("UPDATE accounts SET status = 'error', status_message = ? WHERE id = ?", [err.message, acc.id]);
    throw new HttpError(502, `MetaApi: ${err.message}`);
  }
});

export default router;
