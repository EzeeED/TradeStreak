# TradeStreak

Diario de trading (estilo Tradezella / TradesViz) conectado a **MetaTrader 5**.
Registra tus operaciones automáticamente, analiza tu rendimiento y construye rachas de disciplina.

## Funcionalidades

- **Conexión con MT5** de tres formas:
  1. **Expert Advisor** (`mt5/TradeStreakSync.mq5`), el método recomendado. Es gratis, sincroniza en tiempo real y no hace falta compartir contraseñas. El EA solo lee el historial y envía los deals al API con un token propio de cada cuenta.
  2. **Login + contraseña investor + servidor** a través de [MetaApi](https://metaapi.cloud). Es opcional y requiere `METAAPI_TOKEN`. La contraseña se envía a MetaApi y nunca se guarda en TradeStreak.
  3. **Importación** del informe HTML de MT5 (Historial → clic derecho → Informe → HTML) o de un CSV.
- **Dashboard**: P&L neto, win rate, profit factor, ratio ganancia/pérdida, días verdes, curva de P&L con drawdown, P&L diario y trades recientes.
- **Rachas**: racha actual de trades, mejor y peor racha, y días verdes seguidos.
- **TradeStreak Score** (0-100), que combina win rate, profit factor, ratio G/P, recuperación, consistencia y disciplina.
- **Calendario** mensual con P&L por día y por semana.
- **Trades**: filtros por símbolo, lado, resultado, setup y etiqueta. En el detalle de cada trade se ven sus ejecuciones, el R múltiple, notas, setup, etiquetas, errores y una valoración.
- **Reportes** por símbolo, long/short, día de la semana, hora y setup.
- **Diario** diario con estado de ánimo y una plantilla de plan y revisión.
- **Multi-cuenta** y cuenta **demo** con datos generados para probar la app.

## Puesta en marcha

Requiere Node.js 22.13 o superior (se usa el SQLite integrado `node:sqlite`, sin dependencias nativas).

```bash
npm install
npm run dev          # API en :4000 + web en http://localhost:5173
npm test             # tests del backend
```

Producción (el API sirve también la web compilada):

```bash
npm run build
JWT_SECRET=... PUBLIC_URL=https://tu-dominio npm start
```

Las variables de entorno están descritas en `.env.example`.

## Conectar MT5 con el Expert Advisor

1. En TradeStreak ve a **Cuentas MT5 → Añadir cuenta → Expert Advisor**. Copia la URL y el token.
2. Descarga `TradeStreakSync.mq5` y cópialo en `MQL5/Experts` (MT5: Archivo → Abrir carpeta de datos). Compílalo en MetaEditor o reinicia MT5.
3. En MT5 ve a **Herramientas → Opciones → Asesores Expertos**, marca *Permitir WebRequest* y añade el dominio de TradeStreak.
4. Arrastra el EA a un gráfico y pega la URL y el token en los parámetros.

El EA envía todo el historial la primera vez y después cada deal nuevo al instante, además de una comprobación cada 60 s. El servidor es idempotente: reenviar deals no crea duplicados. Las notas y etiquetas que escribas se conservan aunque el trade se vuelva a sincronizar.

> En producción usa HTTPS y un dominio público en `PUBLIC_URL`. MT5 debe poder alcanzar esa URL.

## Arquitectura

```
server/   API Express + SQLite (node:sqlite)
  src/lib/mt5.js        normalización de deals MT5 → trades (agrupados por position_id)
  src/lib/importers.js  parser del informe HTML de MT5 (UTF-16) y de CSV
  src/lib/stats.js      métricas, rachas y TradeStreak Score
  src/lib/metaapi.js    conector opcional con MetaApi
  src/routes/sync.js    endpoint que recibe los datos del EA (auth por token)
web/      React + Vite + Tailwind + Recharts
mt5/      Expert Advisor TradeStreakSync.mq5
```

Las horas se guardan y se muestran en la hora del servidor del broker, igual que en MT5.
