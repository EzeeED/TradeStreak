import { db } from '../db.js';
import { HttpError } from '../auth.js';

/** Devuelve la cuenta si pertenece al usuario, o lanza 404. */
export function ownedAccount(userId, accountId) {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(Number(accountId), userId);
  if (!acc) throw new HttpError(404, 'Cuenta no encontrada');
  return acc;
}

/** IDs de cuentas a consultar: una concreta (validando propiedad) o todas las del usuario. */
export function accountIds(userId, accountId) {
  if (accountId && accountId !== 'all') return [ownedAccount(userId, accountId).id];
  return db.prepare('SELECT id FROM accounts WHERE user_id = ?').all(userId).map((r) => r.id);
}

export const placeholders = (arr) => arr.map(() => '?').join(',') || 'NULL';

export function parseTrade(t) {
  return { ...t, tags: JSON.parse(t.tags || '[]'), mistakes: JSON.parse(t.mistakes || '[]') };
}
