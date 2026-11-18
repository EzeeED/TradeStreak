import { Hono } from 'hono';
import { z } from 'zod';
import { signToken, requireAuth, HttpError, hashPassword, verifyPassword } from '../auth.js';
import { body, getDb } from './helpers.js';

const router = new Hono();

const registerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200),
});

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, created_at: u.created_at });

router.post('/register', async (c) => {
  const db = getDb(c);
  const data = registerSchema.parse(await body(c));
  if (await db.first('SELECT 1 AS x FROM users WHERE email = ?', [data.email])) {
    throw new HttpError(409, 'Ya existe una cuenta con ese email');
  }
  const { lastId } = await db.run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [
    data.name, data.email, await hashPassword(data.password),
  ]);
  const user = await db.first('SELECT * FROM users WHERE id = ?', [lastId]);
  return c.json({ token: await signToken(user, c.get('config').jwtSecret), user: publicUser(user) }, 201);
});

router.post('/login', async (c) => {
  const { email, password } = z.object({ email: z.string().trim().toLowerCase(), password: z.string() }).parse(await body(c));
  const user = await getDb(c).first('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new HttpError(401, 'Email o contraseña incorrectos');
  }
  return c.json({ token: await signToken(user, c.get('config').jwtSecret), user: publicUser(user) });
});

router.get('/me', requireAuth, async (c) => {
  const user = await getDb(c).first('SELECT * FROM users WHERE id = ?', [c.get('userId')]);
  if (!user) throw new HttpError(401, 'Usuario no encontrado');
  return c.json({ user: publicUser(user) });
});

export default router;
