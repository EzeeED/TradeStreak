// Importadores de historial: informe HTML de MT5 ("Historial" -> clic derecho -> "Informe")
// y CSV genérico.

import { parse } from 'node-html-parser';
import { toServerTime } from './mt5.js';

/** Los informes de MT5 se guardan en UTF-16 LE con BOM. */
export function decodeReport(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.subarray(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  return buffer.toString('utf8').replace(/^﻿/, '');
}

const num = (s) => {
  if (s === undefined || s === null) return 0;
  const n = Number(String(s).replace(/[\s ]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const isDate = (s) => /^\d{4}[.-]\d{2}[.-]\d{2}[ T]\d{2}:\d{2}/.test(s);
const isNum = (s) => s !== '' && /^-?[\d\s ]+([.,]\d+)?$/.test(s);

/**
 * Extrae la sección "Posiciones" de un informe HTML de MT5.
 * Columnas: Hora | Posición | Símbolo | Tipo | Volumen | Precio | S/L | T/P | Hora | Precio | Comisión | Swap | Beneficio
 * Se detectan por estructura (no por idioma) para funcionar con terminales en cualquier idioma.
 */
export function parseMt5HtmlReport(html) {
  const root = parse(html);
  const trades = [];
  const meta = {};

  for (const tr of root.querySelectorAll('tr')) {
    const cells = tr
      .querySelectorAll('td')
      .filter((td) => !/\bhidden\b/.test(td.getAttribute('class') || ''))
      .map((td) => td.text.trim());

    // Cabecera del informe: "Cuenta:" / "Account:" y "Empresa"/"Company"
    if (cells.length >= 2 && /^(account|cuenta|conta|compte|konto)\s*:?$/i.test(cells[0])) meta.account = cells[1];
    if (cells.length >= 2 && /^(company|empresa|compagnie|firma)\s*:?$/i.test(cells[0])) meta.company = cells[1];

    if (cells.length < 13) continue;
    const [openTime, position, symbol, type, volume, openPrice, sl, tp, closeTime, closePrice, commission, swap, profit] = cells;
    const side = type.toLowerCase();
    if (!isDate(openTime) || !isDate(closeTime) || !/^(buy|sell)$/.test(side)) continue;
    if (!isNum(closePrice) || !isNum(profit) || volume.includes('/')) continue; // descarta filas de "Órdenes"

    const o = toServerTime(openTime);
    const c = toServerTime(closeTime);
    const p = num(profit);
    const com = num(commission);
    const sw = num(swap);
    trades.push({
      position_id: position,
      symbol,
      side: side === 'buy' ? 'long' : 'short',
      status: 'closed',
      volume: num(volume),
      open_time: o,
      close_time: c,
      entry_price: num(openPrice),
      exit_price: num(closePrice),
      sl: num(sl) || null,
      tp: num(tp) || null,
      profit: p,
      commission: com,
      swap: sw,
      net_profit: Math.round((p + com + sw) * 100) / 100,
      duration_sec: Math.round((Date.parse(c + 'Z') - Date.parse(o + 'Z')) / 1000),
    });
  }
  // El login suele venir como "12345678 (USD, ...)"
  if (meta.account) {
    const m = meta.account.match(/(\d+)/);
    meta.login = m?.[1];
    meta.currency = meta.account.match(/\(([A-Z]{3})/)?.[1];
  }
  return { trades, meta };
}

function splitCsvLine(line, sep) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (ch === sep && !quoted) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const CSV_ALIASES = {
  position_id: ['position', 'position_id', 'ticket', 'id', 'posicion', 'posición'],
  symbol: ['symbol', 'simbolo', 'símbolo', 'instrument'],
  side: ['side', 'type', 'tipo', 'direction'],
  volume: ['volume', 'lots', 'volumen', 'size', 'lotes'],
  open_time: ['open_time', 'opentime', 'open time', 'entry_time', 'hora apertura', 'apertura'],
  close_time: ['close_time', 'closetime', 'close time', 'exit_time', 'hora cierre', 'cierre'],
  entry_price: ['entry_price', 'open_price', 'open price', 'precio apertura', 'entry'],
  exit_price: ['exit_price', 'close_price', 'close price', 'precio cierre', 'exit'],
  sl: ['sl', 's/l', 'stop_loss', 'stoploss'],
  tp: ['tp', 't/p', 'take_profit', 'takeprofit'],
  commission: ['commission', 'comision', 'comisión'],
  swap: ['swap'],
  profit: ['profit', 'pnl', 'beneficio', 'p&l', 'ganancia'],
};

/** CSV genérico: una fila por trade cerrado. Detecta separador y nombres de columna comunes. */
export function parseTradesCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { trades: [], meta: {} };
  const sep = [';', ',', '\t'].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const header = splitCsvLine(lines[0], sep).map((h) => h.toLowerCase());
  const idx = {};
  for (const [key, aliases] of Object.entries(CSV_ALIASES)) {
    idx[key] = header.findIndex((h) => aliases.includes(h));
  }
  const missing = ['symbol', 'side', 'open_time', 'profit'].filter((k) => idx[k] < 0);
  if (missing.length) throw new Error(`Faltan columnas en el CSV: ${missing.join(', ')}`);

  const trades = lines.slice(1).map((line, i) => {
    const c = splitCsvLine(line, sep);
    const get = (k) => (idx[k] >= 0 ? c[idx[k]] : undefined);
    const open = toServerTime(get('open_time'));
    const close = toServerTime(get('close_time')) || open;
    const profit = num(get('profit'));
    const commission = num(get('commission'));
    const swap = num(get('swap'));
    const sideRaw = (get('side') || '').toLowerCase();
    return {
      position_id: get('position_id') || `csv-${open}-${i}`,
      symbol: get('symbol'),
      side: /^(buy|long|compra)/.test(sideRaw) ? 'long' : 'short',
      status: 'closed',
      volume: num(get('volume')) || 1,
      open_time: open,
      close_time: close,
      entry_price: num(get('entry_price')) || null,
      exit_price: num(get('exit_price')) || null,
      sl: num(get('sl')) || null,
      tp: num(get('tp')) || null,
      profit,
      commission,
      swap,
      net_profit: Math.round((profit + commission + swap) * 100) / 100,
      duration_sec: Math.round((Date.parse(close + 'Z') - Date.parse(open + 'Z')) / 1000),
    };
  });
  return { trades: trades.filter((t) => t.symbol && t.open_time), meta: {} };
}
