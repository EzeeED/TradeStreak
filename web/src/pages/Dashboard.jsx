import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Target, Scale, TrendingUp, Sigma, CalendarCheck, Trophy, Plus, Sparkles, Pencil, Check, RotateCcw } from 'lucide-react';
import { api } from '../lib/api.js';
import WidgetGrid, { mergeLayout } from '../components/WidgetGrid.jsx';
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
    { label: 'Días positivos seguidos', value: s.currentDayStreakType === 'win' ? s.currentDayStreak : 0, sub: `récord: ${s.maxGreenDayStreak} días` },
    { label: 'Peor racha', value: s.maxLossStreak, sub: 'trades perdedores seguidos' },
  ];
  return (
    <Card className="relative h-full overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-crimson-600/20 blur-3xl" />
      <div className="mb-4 flex items-center gap-2">
        <Flame size={18} className={onWin ? 'text-crimson-400' : 'text-muted'} />
        <h3 className="text-sm font-semibold">Tus rachas</h3>
      </div>
      <div className="grid grid-cols-2 gap-4 @xl:grid-cols-4">
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
    <Card className="h-full" title="TradeStreak Score" action={<span className={cx('font-display text-2xl font-bold tabular-nums', tone)}>{score.total}<span className="text-sm text-muted">/100</span></span>}>
      <ScoreRadar factors={score.factors} />
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-gradient-to-r from-crimson-800 via-crimson-600 to-crimson-400" style={{ width: `${score.total}%` }} />
      </div>
    </Card>
  );
}

export const DEFAULT_LAYOUT = [
  { id: 'kpis', span: 12, hidden: false },
  { id: 'streaks', span: 12, hidden: false },
  { id: 'equity', span: 8, hidden: false },
  { id: 'score', span: 4, hidden: false },
  { id: 'daily', span: 6, hidden: false },
  { id: 'calendar', span: 6, hidden: false },
  { id: 'recent', span: 8, hidden: false },
  { id: 'summary', span: 4, hidden: false },
];

/** Carga y guarda en el servidor el diseño del dashboard del usuario. */
function useDashboardLayout() {
  const [saved, setSaved] = useState(DEFAULT_LAYOUT);
  const [draft, setDraft] = useState(null); // != null => modo edición
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/settings').then((d) => setSaved(mergeLayout(d.dashboardLayout, DEFAULT_LAYOUT))).catch(() => {});
  }, []);

  return {
    layout: draft ?? saved,
    editing: draft !== null,
    saving,
    error,
    edit: () => { setError(null); setDraft(saved); },
    change: setDraft,
    cancel: () => setDraft(null),
    reset: () => setDraft(DEFAULT_LAYOUT),
    save: async () => {
      setSaving(true);
      setError(null);
      try {
        await api('/settings/dashboard', { method: 'PUT', body: { layout: draft } });
        setSaved(draft);
        setDraft(null);
      } catch (err) {
        setError(err);
      } finally {
        setSaving(false);
      }
    },
  };
}

function EditToolbar({ dash }) {
  if (!dash.editing) {
    return (
      <div className="flex justify-end">
        <Button variant="secondary" icon={Pencil} onClick={dash.edit} aria-label="Personalizar dashboard">Personalizar</Button>
      </div>
    );
  }
  return (
    <div className="sticky top-[4.5rem] z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-crimson-500/40 bg-black/80 p-3 backdrop-blur-xl lg:top-20">
      <Pencil size={16} className="text-crimson-400" />
      <span className="mr-auto text-sm text-zinc-300">Arrastra cada bloque desde ⋮⋮ y acomódalo como quieras.</span>
      <Button variant="ghost" icon={RotateCcw} onClick={dash.reset}>Restablecer</Button>
      <Button variant="secondary" onClick={dash.cancel}>Cancelar</Button>
      <Button icon={Check} loading={dash.saving} onClick={dash.save}>Guardar</Button>
    </div>
  );
}

export default function Dashboard() {
  const { query, currency, accounts, version } = useFilters();
  const stats = useApi('/stats', query, [version]);
  const recent = useApi('/trades', { ...query, limit: 8 }, [version]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const dash = useDashboardLayout();

  if (!accounts.length) {
    return (
      <Card>
        <Empty
          icon={Sparkles}
          title="Empecemos por tu cuenta de MT5"
          action={<Link to="/accounts"><Button icon={Plus}>Conectar cuenta</Button></Link>}
        >
          En cuanto la conectes vas a ver aquí tus resultados, tus rachas y en qué estás fallando. Si solo quieres echar un vistazo, carga la cuenta demo desde Cuentas MT5.
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
        <Empty icon={Target} title="No hay trades cerrados en estas fechas">
          Prueba con otro periodo arriba, o revisa en <Link to="/accounts" className="text-crimson-300 underline">Cuentas MT5</Link> que la cuenta esté sincronizando.
        </Empty>
      </Card>
    );
  }

  const widgets = {
    kpis: { title: 'Métricas clave', render: () => (
      <div className="grid grid-cols-2 gap-4 @xl:grid-cols-3 @4xl:grid-cols-5">
        <Stat label="P&L neto" icon={TrendingUp} value={money(s.netPnl, currency, { sign: true })} tone={pnlColor(s.netPnl)} hint={`${s.totalTrades} trades · ${s.tradingDays} días`} className="col-span-2 @xl:col-span-1" />
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
        <Stat label="Días positivos" icon={CalendarCheck} value={pct(s.dayWinRate)} hint={`${s.greenDays} positivos · ${s.redDays} negativos`} />
      </div>
    ) },
    streaks: { title: 'Tus rachas', render: () => <StreakCard s={s} /> },
    score: { title: 'TradeStreak Score', render: () => (score ? <ScoreCard score={score} /> : null) },
    equity: { title: 'P&L acumulado', render: () => (
      <Card className="h-full" title="P&L acumulado" action={<span className="text-xs text-muted">Drawdown máx: <span className="text-loss">{money(s.maxDrawdown, currency)}</span></span>}>
        <EquityChart data={equity} currency={currency} />
      </Card>
    ) },
    summary: { title: 'Resumen', render: () => (
          <Card className="h-full" title="Resumen">
            <dl className="space-y-2.5 text-sm">
              {[
                ['Media por trade', money(s.expectancy, currency, { sign: true }), pnlColor(s.expectancy)],
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
    ) },
    daily: { title: 'P&L diario', render: () => (
      <Card className="h-full" title="P&L diario">
        <PnlBars data={daily.slice(-40)} xKey="date" currency={currency} labelFormatter={(d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`} />
      </Card>
    ) },
    calendar: { title: 'Calendario', render: () => (
      <Card className="h-full">
        <MonthCalendar month={month} onMonthChange={setMonth} daily={daily} currency={currency} compact />
      </Card>
    ) },
    recent: { title: 'Trades recientes', render: () => (
      <Card className="h-full" title="Trades recientes" padded={false} action={<Link to="/trades" className="text-sm text-crimson-300 hover:text-crimson-200">Ver todos →</Link>}>
        {recent.data ? <TradeTable trades={recent.data.trades} compact /> : <Spinner />}
      </Card>
    ) },
  };

  return (
    <div className="space-y-6">
      <EditToolbar dash={dash} />
      <ErrorBox error={dash.error} />
      <WidgetGrid layout={dash.layout} onChange={dash.change} widgets={widgets} editing={dash.editing} />

      <p className="flex items-center gap-2 text-xs text-muted"><Trophy size={12} />Las horas son las del servidor de tu broker, igual que en MT5.</p>
    </div>
  );
}
