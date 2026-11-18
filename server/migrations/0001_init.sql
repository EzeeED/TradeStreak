-- Esquema de TradeStreak (SQLite / Cloudflare D1)

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  platform           TEXT NOT NULL DEFAULT 'mt5',
  connection_type    TEXT NOT NULL,            -- 'ea' | 'metaapi' | 'import' | 'demo'
  broker             TEXT,
  server             TEXT,
  login              TEXT,
  currency           TEXT DEFAULT 'USD',
  balance            REAL,
  equity             REAL,
  sync_token         TEXT UNIQUE,
  metaapi_account_id TEXT,
  status             TEXT NOT NULL DEFAULT 'pending', -- pending | connected | error
  status_message     TEXT,
  last_sync_at       TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Deals crudos tal como vienen de MT5 (fuente de verdad para reconstruir trades)
CREATE TABLE IF NOT EXISTS deals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ticket      TEXT NOT NULL,
  order_id    TEXT,
  position_id TEXT,
  time        TEXT NOT NULL,          -- hora del servidor del broker, ISO sin zona
  type        TEXT NOT NULL,          -- buy | sell | balance | credit | other
  entry       TEXT,                   -- in | out | inout | out_by
  symbol      TEXT,
  volume      REAL DEFAULT 0,
  price       REAL DEFAULT 0,
  sl          REAL,
  tp          REAL,
  profit      REAL DEFAULT 0,
  commission  REAL DEFAULT 0,
  swap        REAL DEFAULT 0,
  fee         REAL DEFAULT 0,
  magic       INTEGER,
  comment     TEXT,
  UNIQUE (account_id, ticket)
);
CREATE INDEX IF NOT EXISTS idx_deals_position ON deals(account_id, position_id);

CREATE TABLE IF NOT EXISTS trades (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  position_id  TEXT NOT NULL,
  symbol       TEXT NOT NULL,
  side         TEXT NOT NULL,          -- long | short
  status       TEXT NOT NULL,          -- open | closed
  volume       REAL NOT NULL,
  open_time    TEXT NOT NULL,
  close_time   TEXT,
  entry_price  REAL,
  exit_price   REAL,
  sl           REAL,
  tp           REAL,
  profit       REAL DEFAULT 0,
  commission   REAL DEFAULT 0,
  swap         REAL DEFAULT 0,
  net_profit   REAL DEFAULT 0,
  duration_sec INTEGER,
  -- Campos del diario (los edita el usuario, nunca se sobrescriben al sincronizar)
  notes        TEXT,
  setup        TEXT,
  tags         TEXT NOT NULL DEFAULT '[]',
  mistakes     TEXT NOT NULL DEFAULT '[]',
  rating       INTEGER,
  UNIQUE (account_id, position_id)
);
CREATE INDEX IF NOT EXISTS idx_trades_close ON trades(account_id, close_time);

-- Preferencias de interfaz por usuario (p. ej. diseño del dashboard)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dashboard_layout TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,           -- YYYY-MM-DD
  content    TEXT NOT NULL DEFAULT '',
  mood       INTEGER,                 -- 1..5
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, date)
);
