// Genera un historial de deals MT5 de ejemplo para probar la app sin conectar una cuenta real.

const SYMBOLS = [
  { symbol: 'EURUSD', price: 1.085, pip: 0.0001, vol: [0.1, 0.5, 1] },
  { symbol: 'GBPUSD', price: 1.27, pip: 0.0001, vol: [0.1, 0.3, 0.5] },
  { symbol: 'USDJPY', price: 151.2, pip: 0.01, vol: [0.2, 0.5] },
  { symbol: 'XAUUSD', price: 2650, pip: 0.1, vol: [0.05, 0.1, 0.2] },
  { symbol: 'NAS100', price: 20500, pip: 1, vol: [0.5, 1] },
  { symbol: 'US30', price: 43000, pip: 1, vol: [0.5, 1] },
];
const SETUPS = ['Breakout', 'Pullback', 'Reversal', 'Range', 'News'];

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function generateDemoDeals(days = 90, seed = 42) {
  const rand = rng(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const deals = [];
  const setups = {};
  let ticket = 1000, position = 50000;
  const start = Date.now() - days * 86400_000;

  deals.push({ ticket: ticket++, type: 'DEAL_TYPE_BALANCE', time: Math.floor(start / 1000) - 3600, profit: 10000, comment: 'Depósito inicial' });

  for (let d = 0; d < days; d++) {
    const day = new Date(start + d * 86400_000);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    const n = Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      const s = pick(SYMBOLS);
      const long = rand() > 0.45;
      const volume = pick(s.vol);
      const openTs = Math.floor(day.setUTCHours(7 + Math.floor(rand() * 10), Math.floor(rand() * 60), 0, 0) / 1000);
      const duration = Math.floor(120 + rand() * 4 * 3600);
      const win = rand() < 0.56;
      const pips = win ? 5 + rand() * 40 : -(4 + rand() * 25);
      const entry = s.price * (1 + (rand() - 0.5) * 0.04);
      const exit = entry + (long ? 1 : -1) * pips * s.pip;
      const profit = Math.round(pips * volume * (s.pip < 0.01 ? 10 : s.pip < 1 ? 7 : 1) * 100) / 100;
      const commission = -Math.round(volume * 7 * 100) / 100 / 2;
      const sl = entry - (long ? 1 : -1) * 20 * s.pip;
      const tp = entry + (long ? 1 : -1) * 40 * s.pip;
      const pid = position++;
      deals.push({ ticket: ticket++, order: ticket, position_id: pid, time: openTs, type: long ? 'DEAL_TYPE_BUY' : 'DEAL_TYPE_SELL', entry: 'DEAL_ENTRY_IN', symbol: s.symbol, volume, price: entry, commission, sl, tp });
      deals.push({ ticket: ticket++, order: ticket, position_id: pid, time: openTs + duration, type: long ? 'DEAL_TYPE_SELL' : 'DEAL_TYPE_BUY', entry: 'DEAL_ENTRY_OUT', symbol: s.symbol, volume, price: exit, profit, commission, swap: duration > 3 * 3600 ? -0.8 : 0, sl, tp });
      if (rand() < 0.6) setups[pid] = pick(SETUPS);
    }
  }
  return { deals, setups };
}
