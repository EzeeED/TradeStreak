// Autenticación portable (Web Crypto): funciona en Node y en Cloudflare Workers.
import { sign, verify } from 'hono/jwt';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const enc = new TextEncoder();
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ITERATIONS = 100_000; // máximo que admite PBKDF2 en Workers

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

/** Devuelve "pbkdf2$<iteraciones>$<salt>$<hash>". */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2(password, salt, ITERATIONS);
  return ['pbkdf2', ITERATIONS, toB64(salt), toB64(bits)].join('$');
}

export async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = String(stored).split('$');
  if (scheme !== 'pbkdf2') return false;
  const bits = new Uint8Array(await pbkdf2(password, fromB64(salt), Number(iter)));
  const expected = fromB64(hash);
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

export function signToken(user, secret) {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: user.id, email: user.email, iat: now, exp: now + 30 * 86400 }, secret, 'HS256');
}

/** Middleware Hono: exige "Authorization: Bearer <jwt>" y deja el id en c.get('userId'). */
export async function requireAuth(c, next) {
  const header = c.req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'No autenticado');
  try {
    const payload = await verify(token, c.get('config').jwtSecret, 'HS256');
    c.set('userId', Number(payload.sub));
  } catch {
    throw new HttpError(401, 'Sesión inválida o expirada');
  }
  await next();
}
