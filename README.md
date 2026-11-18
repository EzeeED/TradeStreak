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

Requiere Node.js 22.13 o superior (se usa el SQLite integrado `node:sqlite`, sin dependencias nativas).

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

## Desplegar en una subruta (p. ej. delorrio.com/app)

La app puede vivir bajo una subruta definida con `BASE_PATH`. Hay que usar el mismo valor al compilar la web y al arrancar el servidor:

```bash
BASE_PATH=/app npm run build
BASE_PATH=/app JWT_SECRET=... METAAPI_TOKEN=... npm start   # http://localhost:4000/app/dashboard
```

Con Docker:

```bash
docker build -t tradestreak --build-arg BASE_PATH=/app .
docker run -d -p 4000:4000 -v tradestreak-data:/data -e JWT_SECRET=... -e METAAPI_TOKEN=... tradestreak
```

Después, en el servidor web del dominio, se reenvía `/app/` al contenedor sin quitar el prefijo. Ejemplo con nginx:

```nginx
location /app/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Arquitectura

```
server/   API Express + SQLite (node:sqlite)
  src/lib/mt5.js        normalización de deals MT5 → trades (agrupados por position_id)
  src/lib/importers.js  parser del informe HTML de MT5 (UTF-16) y de CSV
  src/lib/stats.js      métricas, rachas y TradeStreak Score
  src/lib/metaapi.js    conector con MetaApi (conexión por servidor)
web/      React + Vite + Tailwind + Recharts
```

Las horas se guardan y se muestran en la hora del servidor del broker, igual que en MT5.
