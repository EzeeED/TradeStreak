import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: '30d' });
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.userId = Number(payload.sub);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
