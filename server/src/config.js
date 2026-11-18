// Configuración a partir de variables de entorno (process.env en Node, bindings en Workers).
export function makeConfig(env = {}) {
  if (!env.JWT_SECRET && env.NODE_ENV === 'production') throw new Error('JWT_SECRET es obligatorio en producción');
  return {
    // Subruta pública de la app (p. ej. '/app'). Debe coincidir con la usada al compilar la web.
    basePath: (env.BASE_PATH || '').replace(/\/+$/, ''),
    jwtSecret: env.JWT_SECRET || 'tradestreak-dev-secret-cambia-esto',
    // MetaApi: conexión de cuentas MT5 con login/contraseña/servidor.
    metaapi: { token: env.METAAPI_TOKEN || '', region: env.METAAPI_REGION || 'new-york' },
  };
}
