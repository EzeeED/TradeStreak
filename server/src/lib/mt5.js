// Normalización de datos de MetaTrader 5 y reconstrucción de trades a partir de deals.
//
// En MT5 una operación (posición) se compone de varios "deals": uno o más de entrada
// (DEAL_ENTRY_IN) y uno o más de salida (DEAL_ENTRY_OUT / OUT_BY). Todos comparten
// el mismo position_id. Aquí agrupamos esos deals en un trade por posición.

import { db, transaction } from '../db.js';

const DEAL_TYPES = {
  0: 'buy', 1: 'sell', 2: 'balance', 3: 'credit', 4: 'charge', 5: 'correction',
  6: 'bonus', 7: 'commission', 8: 'commission', 9: 'commission', 10: 'commission',
  11: 'commission', 12: 'interest', 13: 'canceled', 14: 'canceled', 15: 'dividend', 16: 'dividend',
  17: 'tax',
};
const DEAL_ENTRIES = { 0: 'in', 1: 'out', 2: 'inout', 3: 'out_by' };

function mapEnum(value, table, prefix) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) return table[Number(value)] ?? 'other';
  let s = String(value).toLowerCase().replace(prefix, '');
  if (s.endsWith('canceled')) return 'canceled';
  if (s.startsWith('buy')) return 'buy';
  if (s.startsWith('sell')) return 'sell';
  return s;
}

export const toDealType = (v) => mapEnum(v, DEAL_TYPES, /^deal_type_/);
export const toDealEntry = (v) => mapEnum(v, DEAL_ENTRIES, /^deal_entry_/);

/**
 * Convierte distintos formatos de fecha a 'YYYY-MM-DDTHH:MM:SS' (hora del servidor, sin zona).
 * Acepta: segundos unix (EA), milisegundos, '2024.01.05 10:20:30' (informe MT5),
 * '2024-01-05 10:20:30.123' (brokerTime de MetaApi) e ISO.
 */
export function toServerTime(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    let n = Number(value);
    if (n < 1e11) n *= 1000; // segundos -> ms
    return new Date(n).toISOString().slice(0, 19);
  }
  const s = String(value).trim().replace(/\./g, (m, i, str) => (i < 10 ? '-' : m)).replace(' ', 'T');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19);
  }
  return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}:${m[6] ?? '00'}`;
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[\s ]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const optNum = (v) => (v === null || v === undefined || v === '' || Number(v) === 0 ? null : num(v));

/** Normaliza un deal proveniente del EA, de MetaApi o de un import. */
export function normalizeDeal(raw) {
  const ticket = raw.ticket ?? raw.id ?? raw.deal;
  if (ticket === undefined || ticket === null) throw new Error('Deal sin ticket');
  return {
    ticket: String(ticket),
    order_id: raw.order ?? raw.orderId ?? raw.order_id ?? null,
    position_id: raw.position_id ?? raw.positionId ?? raw.position ?? null,
    time: toServerTime(raw.brokerTime ?? raw.time_msc ?? raw.time),
    type: toDealType(raw.type) ?? 'other',
    entry: toDealEntry(raw.entry ?? raw.entryType),
    symbol: raw.symbol || null,
    volume: num(raw.volume),
    price: num(raw.price),
    sl: optNum(raw.sl ?? raw.stopLoss),
    tp: optNum(raw.tp ?? raw.takeProfit),
    profit: num(raw.profit),
    commission: num(raw.commission),
    swap: num(raw.swap),
    fee: num(raw.fee),
    magic: raw.magic != null ? Number(raw.magic) : null,
    comment: raw.comment ?? null,
  };
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function weightedAvg(deals) {
  const vol = deals.reduce((s, d) => s + d.volume, 0);
  if (!vol) return null;
  return deals.reduce((s, d) => s + d.price * d.volume, 0) / vol;
}

/** Construye un trade a partir de los deals de una misma posición. */
export function buildTrade(positionId, deals) {
  const sorted = [...deals].sort((a, b) => a.time.localeCompare(b.time));
  const ins = sorted.filter((d) => d.entry === 'in');
  const outs = sorted.filter((d) => d.entry === 'out' || d.entry === 'out_by' || d.entry === 'inout');
  const first = ins[0] ?? sorted[0];
  if (!first || !first.symbol) return null;

  const inVol = ins.reduce((s, d) => s + d.volume, 0) || first.volume;
  const outVol = outs.reduce((s, d) => s + d.volume, 0);
  // Long si el deal de entrada es buy; si sólo tenemos la salida, la dirección es la contraria.
  const side = ins.length ? (first.type === 'buy' ? 'long' : 'short') : first.type === 'buy' ? 'short' : 'long';
  const closed = outs.length > 0 && outVol >= inVol - 1e-9;
  const lastOut = outs[outs.length - 1];

  const profit = sorted.reduce((s, d) => s + d.profit, 0);
  const commission = sorted.reduce((s, d) => s + d.commission + d.fee, 0);
  const swap = sorted.reduce((s, d) => s + d.swap, 0);
  const openTime = first.time;
  const closeTime = closed ? lastOut.time : null;
  const withStops = [...sorted].reverse().find((d) => d.sl || d.tp);

  return {
    position_id: String(positionId),
    symbol: first.symbol,
    side,
    status: closed ? 'closed' : 'open',
    volume: round(inVol, 4),
    open_time: openTime,
    close_time: closeTime,
    entry_price: weightedAvg(ins.length ? ins : [first]),
    exit_price: outs.length ? weightedAvg(outs) : null,
    sl: withStops?.sl ?? null,
    tp: withStops?.tp ?? null,
    profit: round(profit),
    commission: round(commission),
    swap: round(swap),
    net_profit: round(profit + commission + swap),
    duration_sec: closeTime ? Math.round((Date.parse(closeTime + 'Z') - Date.parse(openTime + 'Z')) / 1000) : null,
  };
}

const upsertTradeStmt = () =>
  db.prepare(`
    INSERT INTO trades (account_id, position_id, symbol, side, status, volume, open_time, close_time,
      entry_price, exit_price, sl, tp, profit, commission, swap, net_profit, duration_sec)
    VALUES (:account_id, :position_id, :symbol, :side, :status, :volume, :open_time, :close_time,
      :entry_price, :exit_price, :sl, :tp, :profit, :commission, :swap, :net_profit, :duration_sec)
    ON CONFLICT (account_id, position_id) DO UPDATE SET
      symbol = excluded.symbol, side = excluded.side, status = excluded.status, volume = excluded.volume,
      open_time = excluded.open_time, close_time = excluded.close_time, entry_price = excluded.entry_price,
      exit_price = excluded.exit_price, sl = excluded.sl, tp = excluded.tp, profit = excluded.profit,
      commission = excluded.commission, swap = excluded.swap, net_profit = excluded.net_profit,
      duration_sec = excluded.duration_sec`);

/** Inserta trades ya construidos (p. ej. desde el informe HTML), preservando notas/tags. */
export function upsertTrades(accountId, trades) {
  const stmt = upsertTradeStmt();
  return transaction(() => {
    for (const t of trades) stmt.run({ sl: null, tp: null, duration_sec: null, ...t, account_id: accountId });
    return trades.length;
  });
}

/**
 * Guarda deals (idempotente por ticket) y reconstruye los trades de las posiciones afectadas.
 * Devuelve cuántos deals se guardaron y cuántos trades se reconstruyeron.
 */
export function ingestDeals(accountId, rawDeals) {
  const deals = rawDeals.map(normalizeDeal).filter((d) => d.time);
  const insert = db.prepare(`
    INSERT INTO deals (account_id, ticket, order_id, position_id, time, type, entry, symbol, volume,
      price, sl, tp, profit, commission, swap, fee, magic, comment)
    VALUES (:account_id, :ticket, :order_id, :position_id, :time, :type, :entry, :symbol, :volume,
      :price, :sl, :tp, :profit, :commission, :swap, :fee, :magic, :comment)
    ON CONFLICT (account_id, ticket) DO UPDATE SET
      profit = excluded.profit, commission = excluded.commission, swap = excluded.swap, fee = excluded.fee`);
  const selectPos = db.prepare('SELECT * FROM deals WHERE account_id = ? AND position_id = ?');
  const upsert = upsertTradeStmt();

  return transaction(() => {
    let saved = 0;
    const positions = new Set();
    for (const d of deals) {
      const params = { ...d, account_id: accountId, order_id: d.order_id && String(d.order_id), position_id: d.position_id && String(d.position_id) };
      saved += Number(insert.run(params).changes);
      if ((d.type === 'buy' || d.type === 'sell') && d.position_id && d.position_id !== '0') positions.add(String(d.position_id));
    }
    let trades = 0;
    for (const pid of positions) {
      const trade = buildTrade(pid, selectPos.all(accountId, pid));
      if (trade) {
        upsert.run({ ...trade, account_id: accountId });
        trades++;
      }
    }
    return { received: deals.length, saved, trades };
  });
}
