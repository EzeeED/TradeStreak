import { HttpError } from '../auth.js';

export const getDb = (c) => c.get('db');

/** Cuerpo JSON de la petición ({} si viene vacío). */
export async function body(c) {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

/** Devuelve la cuenta si pertenece al usuario, o lanza 404. */
export async function ownedAccount(db, userId, accountId) {
  const acc = await db.first('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [Number(accountId), userId]);
  if (!acc) throw new HttpError(404, 'Cuenta no encontrada');
  return acc;
}

/** IDs de cuentas a consultar: una concreta (validando propiedad) o todas las del usuario. */
export async function accountIds(db, userId, accountId) {
  if (accountId && accountId !== 'all') return [(await ownedAccount(db, userId, accountId)).id];
  return (await db.all('SELECT id FROM accounts WHERE user_id = ?', [userId])).map((r) => r.id);
}

export const placeholders = (arr) => arr.map(() => '?').join(',') || 'NULL';

export function parseTrade(t) {
  return { ...t, tags: JSON.parse(t.tags || '[]'), mistakes: JSON.parse(t.mistakes || '[]') };
}
