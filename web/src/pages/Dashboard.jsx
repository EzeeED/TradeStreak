import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Target, Scale, TrendingUp, Sigma, CalendarCheck, Trophy, Plus, Sparkles } from 'lucide-react';
import { useFilters } from '../context/FiltersContext.jsx';
import { useApi } from '../lib/useApi.js';
import { money, pct, num, pnlColor } from '../lib/format.js';
import { Button, Card, Empty, ErrorBox, Spinner, Stat, cx } from '../components/ui.jsx';
import { EquityChart, PnlBars, ScoreRadar, WinRateRing } from '../components/charts.jsx';
import MonthCalendar from '../components/MonthCalendar.jsx';
import TradeTable from '../components/TradeTable.jsx';

function StreakCard({ s }) {
  const onWin = s.currentStreakType === 'win';
  const items = [
    { label: 'Racha actual', value: s.currentStreak, sub: s.currentStreakType ? `${s.currentStreak === 1 ? 'trade' : 'trades'} ${onWin ? 'ganador' : 'perdedor'}${s.currentStreak === 1 ? '' : 'es'}` : 'sin trades', hot: onWin },
    { label: 'Mejor racha', value: s.maxWinStreak, sub: 'trades ganadores seguidos' },
    { label: 'Días verdes seguidos', value: s.currentDayStreakType === 'win' ? s.currentDayStreak : 0, sub: `récord: ${s.maxGreenDayStreak} días` },
    { label: 'Peor racha', value: s.maxLossStreak, sub: 'trades perdedores seguidos' },
  ];
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-crimson-600/20 blur-3xl" />
      <div className="mb-4 flex items-center gap-2">
        <Flame size={18} className={onWin ? 'text-crimson-400' : 'text-muted'} />
        <h3 className="text-sm font-semibold">Tus rachas</h3>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label}>
            <div className="text-xs text-muted">{it.label}</div>
            <div className={cx('font-display mt-1 flex items-baseline gap-1 text-3xl font-bold tabular-nums', it.hot && 'text-gradient-red')}>
              {it.value}
              {it.hot && it.value >= 3 && <Flame size={18} className="text-crimson-400" />}
            </div>
            <div className="text-xs text-muted">{it.sub}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScoreCard({ score }) {
  const tone = score.total >= 70 ? 'text-win' : score.total >= 45 ? 'text-amber-300' : 'text-loss';
  return (
    <Card title="TradeStreak Score" action={<span className={cx('font-display text-2xl font-bold tabular-nums', tone)}>{score.total}<span className="text-sm text-muted">/100</span></span>}>
      <ScoreRadar factors={score.factors} />
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-gradient-to-r from-crimson-800 via-crimson-600 to-crimson-400" style={{ width: `${score.total}%` }} />
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { query, currency, accounts, version } = useFilters();
  const stats = useApi('/stats', query, [version]);
  const recent = useApi('/trades', { ...query, limit: 8 }, [version]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  if (!accounts.length) {
    return (
      <Card>
        <Empty
          icon={Sparkles}
          title="Conecta tu primera cuenta de MT5"
          action={<Link to="/accounts"><Button icon={Plus}>Añadir cuenta</Button></Link>}
        >
          TradeStreak sincroniza tus operaciones de MetaTrader 5 y calcula tus métricas, rachas y TradeStreak Score. También puedes probar con una cuenta demo.
        </Empty>
      </Card>
    );
  }
  if (stats.loading && !stats.data) return <Spinner />;
  if (stats.error) return <ErrorBox error={stats.error} />;
  const { summary: s, score, equity, daily } = stats.data;

  if (!s.totalTrades) {
    return (
      <Card>
        <Empty icon={Target} title="Todavía no hay trades cerrados en este periodo">
          Cuando tu cuenta sincronice operaciones aparecerán aquí. Revisa el estado de la conexión en <Link to="/accounts" className="text-crimson-300 underline">Cuentas MT5</Link> o cambia el periodo.
        </Empty>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="P&L neto" icon={TrendingUp} value={money(s.netPnl, currency, { sign: true })} tone={pnlColor(s.netPnl)} hint={`${s.totalTrades} trades · ${s.tradingDays} días`} className="col-span-2 lg:col-span-1" />
        <div className="glass flex items-center justify-between rounded-2xl border border-white/[0.06] p-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted"><span className="rounded-md bg-crimson-600/15 p-1 text-crimson-400 ring-1 ring-crimson-500/20"><Target size={13} /></span>Win rate</div>
            <div className="font-display mt-2 text-2xl font-semibold tabular-nums">{pct(s.winRate)}</div>
            <div className="mt-1 text-xs text-muted"><span className="text-win">{s.wins}G</span> · <span className="text-loss">{s.losses}P</span>{s.breakeven ? ` · ${s.breakeven}BE` : ''}</div>
          </div>
          <WinRateRing value={s.winRate} />
        </div>
        <Stat label="Profit factor" icon={Scale} value={s.profitFactor === null ? '∞' : num(s.profitFactor)} tone={s.profitFactor === null || s.profitFactor >= 1 ? 'text-win' : 'text-loss'} hint={`${money(s.grossProfit, currency, { compact: true })} / ${money(s.grossLoss, currency, { compact: true })}`} />
        <Stat label="Ganancia / pérdida media" icon={Sigma} value={s.avgWinLossRatio === null ? '∞' : num(s.avgWinLossRatio)} hint={<><span className="text-win">{money(s.avgWin, currency)}</span> / <span className="text-loss">{money(s.avgLoss, currency)}</span></>} />
        <Stat label="Días verdes" icon={CalendarCheck} value={pct(s.dayWinRate)} hint={`${s.greenDays} verdes · ${s.redDays} rojos`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <StreakCard s={s} />
          <Card title="P&L acumulado" action={<span className="text-xs text-muted">Drawdown máx: <span className="text-loss">{money(s.maxDrawdown, currency)}</span></span>}>
            <EquityChart data={equity} currency={currency} />
          </Card>
        </div>
        <div className="space-y-6">
          {score && <ScoreCard score={score} />}
          <Card title="Resumen">
            <dl className="space-y-2.5 text-sm">
              {[
                ['Esperanza por trade', money(s.expectancy, currency, { sign: true }), pnlColor(s.expectancy)],
                ['Mejor trade', money(s.largestWin, currency, { sign: true }), 'text-win'],
                ['Peor trade', money(s.largestLoss, currency), 'text-loss'],
                ['P&L medio diario', money(s.avgDailyPnl, currency, { sign: true }), pnlColor(s.avgDailyPnl)],
                ['Comisiones + swap', money(s.commissions + s.swaps, currency), 'text-zinc-300'],
                ['Trades abiertos', s.openTrades, 'text-zinc-300'],
              ].map(([k, v, c]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className={cx('font-medium tabular-nums', c)}>{v}</dd></div>
              ))}
            </dl>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="P&L diario">
          <PnlBars data={daily.slice(-40)} xKey="date" currency={currency} labelFormatter={(d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`} />
        </Card>
        <Card>
          <MonthCalendar month={month} onMonthChange={setMonth} daily={daily} currency={currency} compact />
        </Card>
      </div>

      <Card title="Trades recientes" padded={false} action={<Link to="/trades" className="text-sm text-crimson-300 hover:text-crimson-200">Ver todos →</Link>}>
        {recent.data ? <TradeTable trades={recent.data.trades} compact /> : <Spinner />}
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted"><Trophy size={12} />Las horas se muestran en la hora del servidor de tu broker, igual que en MT5.</p>
    </div>
  );
}
