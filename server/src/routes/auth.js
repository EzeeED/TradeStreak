import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { signToken, requireAuth, HttpError } from '../auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200),
});

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, created_at: u.created_at });

router.post('/register', async (req, res) => {
  const data = registerSchema.parse(req.body);
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(data.email)) {
    throw new HttpError(409, 'Ya existe una cuenta con ese email');
  }
  const hash = await bcrypt.hash(data.password, 10);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(data.name, data.email, hash);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().trim().toLowerCase(), password: z.string() })
    .parse(req.body);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Email o contraseña incorrectos');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) throw new HttpError(401, 'Usuario no encontrado');
  res.json({ user: publicUser(user) });
});

export default router;
