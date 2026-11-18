// Endpoint que recibe los datos del Expert Advisor TradeStreakSync.mq5 instalado en MT5.
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { HttpError } from '../auth.js';
import { ingestDeals } from '../lib/mt5.js';

const router = Router();

function accountFromToken(req) {
  const token = req.get('x-sync-token') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Falta el token de sincronización');
  const acc = db.prepare("SELECT * FROM accounts WHERE sync_token = ? AND connection_type = 'ea'").get(token);
  if (!acc) throw new HttpError(401, 'Token de sincronización inválido');
  return acc;
}

// El EA llama aquí al iniciar para comprobar conexión y saber desde qué fecha enviar.
router.get('/mt5', (req, res) => {
  const acc = accountFromToken(req);
  const last = db.prepare('SELECT MAX(time) AS t FROM deals WHERE account_id = ?').get(acc.id).t;
  res.json({ ok: true, account: acc.name, last_deal_time: last ? Math.floor(Date.parse(last + 'Z') / 1000) : 0 });
});

const payload = z.object({
  account: z
    .object({
      login: z.union([z.string(), z.number()]).optional(),
      server: z.string().optional(),
      company: z.string().optional(),
      currency: z.string().optional(),
      balance: z.number().optional(),
      equity: z.number().optional(),
    })
    .optional(),
  deals: z.array(z.record(z.string(), z.any())).max(5000).default([]),
});

router.post('/mt5', (req, res) => {
  const acc = accountFromToken(req);
  const { account, deals } = payload.parse(req.body);

  if (acc.login && account?.login && String(account.login) !== acc.login) {
    throw new HttpError(409, `Este token pertenece a la cuenta ${acc.login}, pero el EA está en la cuenta ${account.login}`);
  }
  const result = ingestDeals(acc.id, deals);
  db.prepare(`UPDATE accounts SET status = 'connected', status_message = NULL, last_sync_at = datetime('now'),
              login = COALESCE(login, ?), server = COALESCE(?, server), broker = COALESCE(?, broker),
              currency = COALESCE(?, currency), balance = COALESCE(?, balance), equity = COALESCE(?, equity) WHERE id = ?`)
    .run(
      account?.login != null ? String(account.login) : null, account?.server ?? null, account?.company ?? null,
      account?.currency ?? null, account?.balance ?? null, account?.equity ?? null, acc.id,
    );
  res.json({ ok: true, ...result });
});

export default router;
