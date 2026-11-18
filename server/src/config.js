import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET es obligatorio en producción');
}

export const config = {
  port: Number(process.env.PORT || 4000),
  dbPath: process.env.DB_PATH || path.join(root, 'data', 'tradestreak.db'),
  jwtSecret: process.env.JWT_SECRET || crypto.createHash('sha256').update('tradestreak-dev-secret').digest('hex'),
  // URL pública del API, la usa el EA de MT5 para enviar operaciones.
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`,
  // MetaApi (opcional): conecta cuentas MT5 con login/contraseña/servidor.
  metaapi: {
    token: process.env.METAAPI_TOKEN || '',
    region: process.env.METAAPI_REGION || 'new-york',
  },
  webDist: path.resolve(root, '..', 'web', 'dist'),
  mt5Dir: path.resolve(root, '..', 'mt5'),
};
