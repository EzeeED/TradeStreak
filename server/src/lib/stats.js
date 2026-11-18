// Cálculo de métricas del diario de trading a partir de trades cerrados.

const r2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : null);
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function streaks(results) {
  // results: array de 1 (ganador), -1 (perdedor), 0 (break-even), en orden cronológico
  let maxWin = 0, maxLoss = 0, run = 0, runSign = 0;
  for (const r of results) {
    if (r === 0) continue;
    if (r === runSign) run++;
    else { runSign = r; run = 1; }
    if (r > 0) maxWin = Math.max(maxWin, run);
    else maxLoss = Math.max(maxLoss, run);
  }
  // Racha actual: desde el final hacia atrás
  let current = 0, currentType = null;
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i];
    if (r === 0) continue;
    if (currentType === null) currentType = r > 0 ? 'win' : 'loss';
    if ((r > 0 ? 'win' : 'loss') !== currentType) break;
    current++;
  }
  return { maxWin, maxLoss, current, currentType };
}

function groupBy(trades, keyFn) {
  const map = new Map();
  for (const t of trades) {
    const k = keyFn(t);
    if (!map.has(k)) map.set(k, { key: k, trades: 0, wins: 0, pnl: 0 });
    const g = map.get(k);
    g.trades++;
    g.pnl += t.net_profit;
    if (t.net_profit > 0) g.wins++;
  }
  return [...map.values()].map((g) => ({ ...g, pnl: r2(g.pnl), winRate: r2((g.wins / g.trades) * 100) }));
}

/**
 * TradeStreak Score (0-100): combinación de seis factores, inspirada en los "scores"
 * de otros journals. Cada factor se normaliza a 0-100.
 */
function score(m) {
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const factors = {
    winRate: clamp(m.winRate),                                         // % de aciertos
    profitFactor: clamp(m.profitFactor === null ? 100 : (m.profitFactor / 2.5) * 100), // 2.5+ = 100
    winLossRatio: clamp(m.avgWinLossRatio === null ? 100 : (m.avgWinLossRatio / 2) * 100), // 2+ = 100
    recovery: clamp(m.maxDrawdown === 0 ? 100 : (m.netPnl / Math.abs(m.maxDrawdown) / 3) * 100), // 3x DD = 100
    consistency: clamp(m.dayWinRate),                                  // % días positivos
    discipline: clamp(100 - m.maxLossStreak * 12),                     // penaliza rachas perdedoras largas
  };
  const weights = { winRate: 0.15, profitFactor: 0.25, winLossRatio: 0.2, recovery: 0.15, consistency: 0.15, discipline: 0.1 };
  const total = Object.entries(weights).reduce((s, [k, w]) => s + factors[k] * w, 0);
  return { total: Math.round(total), factors: Object.fromEntries(Object.entries(factors).map(([k, v]) => [k, Math.round(v)])) };
}

export function computeStats(allTrades) {
  const trades = allTrades
    .filter((t) => t.status === 'closed' && t.close_time)
    .sort((a, b) => a.close_time.localeCompare(b.close_time));

  const wins = trades.filter((t) => t.net_profit > 0);
  const losses = trades.filter((t) => t.net_profit < 0);
  const grossProfit = wins.reduce((s, t) => s + t.net_profit, 0);
  const grossLoss = losses.reduce((s, t) => s + t.net_profit, 0);
  const netPnl = grossProfit + grossLoss;
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;

  // Curva de equity acumulada y drawdown máximo (en dinero)
  let cum = 0, peak = 0, maxDrawdown = 0;
  const equity = trades.map((t) => {
    cum += t.net_profit;
    peak = Math.max(peak, cum);
    maxDrawdown = Math.min(maxDrawdown, cum - peak);
    return { time: t.close_time, pnl: r2(cum), drawdown: r2(cum - peak) };
  });

  // P&L por día (para calendario y gráfico diario)
  const dailyMap = new Map();
  for (const t of trades) {
    const day = t.close_time.slice(0, 10);
    const d = dailyMap.get(day) ?? { date: day, pnl: 0, trades: 0, wins: 0 };
    d.pnl += t.net_profit;
    d.trades++;
    if (t.net_profit > 0) d.wins++;
    dailyMap.set(day, d);
  }
  const daily = [...dailyMap.values()].map((d) => ({ ...d, pnl: r2(d.pnl) }));
  const greenDays = daily.filter((d) => d.pnl > 0).length;
  const redDays = daily.filter((d) => d.pnl < 0).length;

  const tradeStreak = streaks(trades.map((t) => Math.sign(t.net_profit)));
  const dayStreak = streaks(daily.map((d) => Math.sign(d.pnl)));

  const durations = trades.filter((t) => t.duration_sec != null);
  const avgDuration = (list) => (list.length ? Math.round(list.reduce((s, t) => s + t.duration_sec, 0) / list.length) : null);

  const summary = {
    totalTrades: trades.length,
    openTrades: allTrades.filter((t) => t.status === 'open').length,
    wins: wins.length,
    losses: losses.length,
    breakeven: trades.length - wins.length - losses.length,
    netPnl: r2(netPnl),
    grossProfit: r2(grossProfit),
    grossLoss: r2(grossLoss),
    winRate: trades.length ? r2((wins.length / trades.length) * 100) : 0,
    profitFactor: grossLoss ? r2(grossProfit / Math.abs(grossLoss)) : null,
    avgWin: r2(avgWin),
    avgLoss: r2(avgLoss),
    avgWinLossRatio: avgLoss ? r2(avgWin / Math.abs(avgLoss)) : null,
    expectancy: trades.length ? r2(netPnl / trades.length) : 0,
    largestWin: r2(Math.max(0, ...trades.map((t) => t.net_profit))),
    largestLoss: r2(Math.min(0, ...trades.map((t) => t.net_profit))),
    maxDrawdown: r2(maxDrawdown),
    commissions: r2(trades.reduce((s, t) => s + t.commission, 0)),
    swaps: r2(trades.reduce((s, t) => s + t.swap, 0)),
    tradingDays: daily.length,
    greenDays,
    redDays,
    dayWinRate: daily.length ? r2((greenDays / daily.length) * 100) : 0,
    avgDailyPnl: daily.length ? r2(netPnl / daily.length) : 0,
    avgDurationSec: avgDuration(durations),
    avgWinDurationSec: avgDuration(durations.filter((t) => t.net_profit > 0)),
    avgLossDurationSec: avgDuration(durations.filter((t) => t.net_profit < 0)),
    maxWinStreak: tradeStreak.maxWin,
    maxLossStreak: tradeStreak.maxLoss,
    currentStreak: tradeStreak.current,
    currentStreakType: tradeStreak.currentType,
    maxGreenDayStreak: dayStreak.maxWin,
    maxRedDayStreak: dayStreak.maxLoss,
    currentDayStreak: dayStreak.current,
    currentDayStreakType: dayStreak.currentType,
  };

  return {
    summary,
    score: trades.length ? score(summary) : null,
    equity,
    daily,
    bySymbol: groupBy(trades, (t) => t.symbol).sort((a, b) => b.pnl - a.pnl),
    bySide: groupBy(trades, (t) => t.side),
    byWeekday: groupBy(trades, (t) => new Date(t.open_time + 'Z').getUTCDay())
      .sort((a, b) => a.key - b.key)
      .map((g) => ({ ...g, label: WEEKDAYS[g.key] })),
    byHour: groupBy(trades, (t) => Number(t.open_time.slice(11, 13))).sort((a, b) => a.key - b.key),
    bySetup: groupBy(trades.filter((t) => t.setup), (t) => t.setup).sort((a, b) => b.pnl - a.pnl),
  };
}
