import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { HttpError } from '../auth.js';
import { ownedAccount } from './helpers.js';
import { ingestDeals, upsertTrades } from '../lib/mt5.js';
import { decodeReport, parseMt5HtmlReport, parseTradesCsv } from '../lib/importers.js';
import { generateDemoDeals } from '../lib/demo.js';
import * as metaapi from '../lib/metaapi.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const newToken = () => 'ts_' + crypto.randomBytes(24).toString('hex');

function serialize(acc) {
  const stats = db
    .prepare(`SELECT COUNT(*) AS trades, COALESCE(SUM(net_profit), 0) AS pnl, MIN(open_time) AS first_trade
              FROM trades WHERE account_id = ? AND status = 'closed'`)
    .get(acc.id);
  return {
    ...acc,
    sync_token: acc.connection_type === 'ea' ? acc.sync_token : undefined,
    sync_url: acc.connection_type === 'ea' ? `${config.publicUrl}/api/sync/mt5` : undefined,
    trade_count: stats.trades,
    net_pnl: Math.round(stats.pnl * 100) / 100,
    first_trade: stats.first_trade,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at').all(req.userId);
  res.json({ accounts: rows.map(serialize), metaapiEnabled: metaapi.metaapiEnabled() });
});

router.get('/:id', (req, res) => {
  res.json({ account: serialize(ownedAccount(req.userId, req.params.id)) });
});

const createSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre a la cuenta').max(80),
  connection_type: z.enum(['ea', 'metaapi', 'import']),
  broker: z.string().trim().max(120).optional().nullable(),
  server: z.string().trim().max(120).optional().nullable(),
  login: z.string().trim().regex(/^\d*$/, 'El login de MT5 es numérico').max(20).optional().nullable(),
  password: z.string().max(200).optional(),
  currency: z.string().trim().length(3).optional(),
});

router.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);
  let metaapiId = null;

  if (data.connection_type === 'metaapi') {
    if (!metaapi.metaapiEnabled()) throw new HttpError(400, 'La conexión con MetaApi no está configurada en el servidor (METAAPI_TOKEN).');
    if (!data.login || !data.server || !data.password) throw new HttpError(400, 'Login, servidor y contraseña son obligatorios');
    try {
      metaapiId = await metaapi.createAccount({ login: data.login, password: data.password, server: data.server, name: data.name });
    } catch (err) {
      throw new HttpError(err.status === 202 ? 409 : 400, `MetaApi: ${err.message}`);
    }
  }

  const { lastInsertRowid } = db
    .prepare(`INSERT INTO accounts (user_id, name, connection_type, broker, server, login, currency, sync_token, metaapi_account_id, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      req.userId, data.name, data.connection_type, data.broker ?? null, data.server ?? null, data.login ?? null,
      (data.currency || 'USD').toUpperCase(), data.connection_type === 'ea' ? newToken() : null, metaapiId,
      data.connection_type === 'import' ? 'connected' : 'pending',
    );
  res.status(201).json({ account: serialize(ownedAccount(req.userId, lastInsertRowid)) });
});

router.patch('/:id', (req, res) => {
  const acc = ownedAccount(req.userId, req.params.id);
  const data = z
    .object({ name: z.string().trim().min(1).max(80).optional(), broker: z.string().trim().max(120).nullable().optional(), currency: z.string().trim().length(3).optional() })
    .parse(req.body);
  db.prepare('UPDATE accounts SET name = COALESCE(?, name), broker = COALESCE(?, broker), currency = COALESCE(?, currency) WHERE id = ?')
    .run(data.name ?? null, data.broker ?? null, data.currency?.toUpperCase() ?? null, acc.id);
  res.json({ account: serialize(ownedAccount(req.userId, acc.id)) });
});

router.delete('/:id', async (req, res) => {
  const acc = ownedAccount(req.userId, req.params.id);
  if (acc.metaapi_account_id && metaapi.metaapiEnabled()) {
    await metaapi.deleteAccount(acc.metaapi_account_id).catch(() => {});
  }
  db.prepare('DELETE FROM accounts WHERE id = ?').run(acc.id);
  res.status(204).end();
});

router.post('/:id/regenerate-token', (req, res) => {
  const acc = ownedAccount(req.userId, req.params.id);
  if (acc.connection_type !== 'ea') throw new HttpError(400, 'Esta cuenta no usa el Expert Advisor');
  db.prepare('UPDATE accounts SET sync_token = ? WHERE id = ?').run(newToken(), acc.id);
  res.json({ account: serialize(ownedAccount(req.userId, acc.id)) });
});

// Importar informe HTML de MT5 o CSV
router.post('/:id/import', upload.single('file'), (req, res) => {
  const acc = ownedAccount(req.userId, req.params.id);
  if (!req.file) throw new HttpError(400, 'Adjunta un archivo');
  const text = decodeReport(req.file.buffer);
  const isHtml = /<html|<table/i.test(text.slice(0, 5000));
  const { trades, meta } = isHtml ? parseMt5HtmlReport(text) : parseTradesCsv(text);
  if (!trades.length) {
    throw new HttpError(422, 'No se encontraron operaciones cerradas. Exporta el informe desde MT5: pestaña Historial → clic derecho → Informe → HTML.');
  }
  const imported = upsertTrades(acc.id, trades);
  db.prepare(`UPDATE accounts SET status = 'connected', status_message = NULL, last_sync_at = datetime('now'),
              login = COALESCE(login, ?), broker = COALESCE(broker, ?), currency = COALESCE(?, currency) WHERE id = ?`)
    .run(meta.login ?? null, meta.company ?? null, meta.currency ?? null, acc.id);
  res.json({ imported, format: isHtml ? 'mt5-html' : 'csv' });
});

// Sincronizar ahora (MetaApi)
router.post('/:id/sync', async (req, res) => {
  const acc = ownedAccount(req.userId, req.params.id);
  if (acc.connection_type !== 'metaapi') throw new HttpError(400, 'Las cuentas con Expert Advisor se sincronizan solas desde MT5');
  if (!metaapi.metaapiEnabled()) throw new HttpError(400, 'MetaApi no está configurado en el servidor');
  try {
    const info = await metaapi.getAccount(acc.metaapi_account_id);
    if (info.state !== 'DEPLOYED' || info.connectionStatus !== 'CONNECTED') {
      const msg = `MetaApi: estado ${info.state} / ${info.connectionStatus}. La primera conexión puede tardar unos minutos.`;
      db.prepare("UPDATE accounts SET status = 'pending', status_message = ? WHERE id = ?").run(msg, acc.id);
      return res.status(202).json({ pending: true, message: msg });
    }
    const last = db.prepare('SELECT MAX(time) AS t FROM deals WHERE account_id = ?').get(acc.id).t;
    const from = last ? new Date(Date.parse(last + 'Z') - 7 * 86400_000) : new Date('2000-01-01T00:00:00Z');
    const [deals, accountInfo] = await Promise.all([
      metaapi.getHistoryDeals(acc.metaapi_account_id, info.region, from),
      metaapi.getAccountInformation(acc.metaapi_account_id, info.region),
    ]);
    const result = ingestDeals(acc.id, deals);
    db.prepare(`UPDATE accounts SET status = 'connected', status_message = NULL, last_sync_at = datetime('now'),
                balance = ?, equity = ?, currency = COALESCE(?, currency), broker = COALESCE(?, broker) WHERE id = ?`)
      .run(accountInfo.balance ?? null, accountInfo.equity ?? null, accountInfo.currency ?? null, accountInfo.broker ?? null, acc.id);
    res.json(result);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    db.prepare("UPDATE accounts SET status = 'error', status_message = ? WHERE id = ?").run(err.message, acc.id);
    throw new HttpError(502, `MetaApi: ${err.message}`);
  }
});

// Cuenta de demostración con datos generados
router.post('/demo', (req, res) => {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO accounts (user_id, name, connection_type, broker, server, login, currency, status, last_sync_at)
              VALUES (?, 'Cuenta Demo', 'demo', 'TradeStreak Demo', 'Demo-Server', '10000001', 'USD', 'connected', datetime('now'))`)
    .run(req.userId);
  const { deals, setups } = generateDemoDeals();
  const result = ingestDeals(Number(lastInsertRowid), deals);
  const setSetup = db.prepare('UPDATE trades SET setup = ? WHERE account_id = ? AND position_id = ?');
  for (const [pid, setup] of Object.entries(setups)) setSetup.run(setup, lastInsertRowid, pid);
  const balance = 10000 + db.prepare('SELECT SUM(net_profit) AS s FROM trades WHERE account_id = ?').get(lastInsertRowid).s;
  db.prepare('UPDATE accounts SET balance = ?, equity = ? WHERE id = ?').run(balance, balance, lastInsertRowid);
  res.status(201).json({ account: serialize(ownedAccount(req.userId, lastInsertRowid)), ...result });
});

export default router;
