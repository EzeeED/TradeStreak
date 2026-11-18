# TradeStreak

Diario de trading (estilo Tradezella / TradesViz) conectado a **MetaTrader 5**.
Registra tus operaciones automáticamente, analiza tu rendimiento y construye rachas de disciplina.

## Funcionalidades

- **Conexión con MT5 por servidor**: el usuario conecta su cuenta con su login, el servidor del broker y la contraseña de inversor (solo lectura). Se hace a través de [MetaApi](https://metaapi.cloud) y requiere configurar `METAAPI_TOKEN` en el servidor. La contraseña se envía a MetaApi y nunca se guarda en TradeStreak. Mientras no esté configurado, la opción aparece desactivada y se puede usar la cuenta demo.
- **Dashboard**: P&L neto, win rate, profit factor, ratio ganancia/pérdida, días positivos, curva de P&L con drawdown, P&L diario y trades recientes.
- **Rachas**: racha actual de trades, mejor y peor racha, y días positivos seguidos.
- **TradeStreak Score** (0-100), que combina win rate, profit factor, ratio G/P, recuperación, consistencia y disciplina.
- **Calendario** mensual con P&L por día y por semana.
- **Trades**: filtros por símbolo, lado, resultado, setup y etiqueta. En el detalle de cada trade se ven sus ejecuciones, el R múltiple, notas, setup, etiquetas, errores y una valoración.
- **Reportes** por símbolo, long/short, día de la semana, hora y setup.
- **Diario** diario con estado de ánimo y una plantilla de plan y revisión.
- **Multi-cuenta** y cuenta **demo** con datos generados para probar la app.

## Puesta en marcha

Requiere Node.js 22.13 o superior. En local la base de datos es SQLite (`node:sqlite`); en producción, Cloudflare D1. El mismo backend (Hono) corre en los dos.

```bash
npm install
npm run dev          # API en :4000 + web en http://localhost:5173
npm test             # tests del backend
```

Producción (el API sirve también la web compilada):

```bash
npm run build
JWT_SECRET=... METAAPI_TOKEN=... npm start
```

Las variables de entorno están descritas en `.env.example`.

## Conectar MT5

1. Crea una cuenta en https://metaapi.cloud y genera un token de API.
2. Arranca el servidor con `METAAPI_TOKEN=<tu token>` (y opcionalmente `METAAPI_REGION`).
3. En TradeStreak, **Cuentas MT5 → Conectar cuenta MT5** e introduce el login, el servidor y la contraseña de inversor.
4. La primera conexión puede tardar unos minutos. Después, **Sincronizar ahora** descarga el historial.

Las notas y etiquetas que escribas se conservan aunque el trade se vuelva a sincronizar.

## Despliegue en Cloudflare (delorrio.com/app)

Producción corre en un Cloudflare Worker con base de datos D1, publicado en `delorrio.com/app/*` (ver `server/wrangler.toml`). La web compilada va embebida en el Worker.

```bash
export CLOUDFLARE_API_TOKEN=...   # permisos: Workers Scripts, Workers Routes, D1
npm run deploy:cf                 # compila, aplica migraciones D1 y despliega
```

Secretos del Worker (una sola vez): `cd server && npx wrangler secret put JWT_SECRET`, y `METAAPI_TOKEN` cuando se active la conexión por servidor.

Para probar el Worker en local: `npm run build:cf`, luego en `server/` crea `.dev.vars` con `JWT_SECRET=...`, ejecuta `npx wrangler d1 migrations apply tradestreak --local` y `npm run dev:cf`.

## Desplegar en otro servidor (Node / Docker)

La app también puede correr como servidor Node bajo una subruta definida con `BASE_PATH`. Hay que usar el mismo valor al compilar la web y al arrancar:

```bash
BASE_PATH=/app npm run build
BASE_PATH=/app JWT_SECRET=... METAAPI_TOKEN=... npm start   # http://localhost:4000/app/dashboard
```

O con Docker: `docker build -t tradestreak --build-arg BASE_PATH=/app .`

## Arquitectura

```
server/   API Hono: Node (node:sqlite) o Cloudflare Worker (D1)
  src/worker.js         entrada de Cloudflare Workers
  src/index.js          entrada de Node
  migrations/           esquema SQL (compartido por SQLite y D1)
  src/lib/mt5.js        normalización de deals MT5 → trades (agrupados por position_id)
  src/lib/importers.js  parser del informe HTML de MT5 (UTF-16) y de CSV
  src/lib/stats.js      métricas, rachas y TradeStreak Score
  src/lib/metaapi.js    conector con MetaApi (conexión por servidor)
web/      React + Vite + Tailwind + Recharts
```

Las horas se guardan y se muestran en la hora del servidor del broker, igual que en MT5.
