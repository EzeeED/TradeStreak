import { BarChart3 } from 'lucide-react';
import { useFilters } from '../context/FiltersContext.jsx';
import { useApi } from '../lib/useApi.js';
import { duration, money, pct, pnlColor } from '../lib/format.js';
import { Card, Empty, ErrorBox, Spinner, Stat, cx } from '../components/ui.jsx';
import { PnlBars } from '../components/charts.jsx';

function BreakdownTable({ rows, currency, label }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-4 font-medium">{label}</th>
            <th className="py-2 pr-4 text-right font-medium">Trades</th>
            <th className="py-2 pr-4 text-right font-medium">Win rate</th>
            <th className="py-2 text-right font-medium">P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line/50 last:border-0">
              <td className="py-2 pr-4 font-medium">{r.label ?? r.key}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-zinc-300">{r.trades}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-zinc-300">{pct(r.winRate)}</td>
              <td className={cx('py-2 text-right font-semibold tabular-nums', pnlColor(r.pnl))}>{money(r.pnl, currency, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const { query, currency, version } = useFilters();
  const { data, loading, error } = useApi('/stats', query, [version]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  if (!data.summary.totalTrades) return <Card><Empty icon={BarChart3} title="Sin datos en este periodo" /></Card>;
  const s = data.summary;
  const sideLabel = { long: 'Long', short: 'Short' };
  const hours = data.byHour.map((h) => ({ ...h, label: `${String(h.key).padStart(2, '0')}:00` }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Duración media" value={duration(s.avgDurationSec)} hint={<>Ganadores {duration(s.avgWinDurationSec)} · Perdedores {duration(s.avgLossDurationSec)}</>} />
        <Stat label="Drawdown máximo" value={money(s.maxDrawdown, currency)} tone="text-loss" />
        <Stat label="Comisiones" value={money(s.commissions, currency)} hint={`Swap: ${money(s.swaps, currency)}`} />
        <Stat label="Esperanza" value={money(s.expectancy, currency, { sign: true })} tone={pnlColor(s.expectancy)} hint="P&L medio por trade" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Por símbolo">
          <PnlBars data={data.bySymbol} xKey="key" currency={currency} />
          <div className="mt-4"><BreakdownTable rows={data.bySymbol} currency={currency} label="Símbolo" /></div>
        </Card>
        <Card title="Long vs Short">
          <PnlBars data={data.bySide.map((x) => ({ ...x, label: sideLabel[x.key] }))} xKey="label" currency={currency} />
          <div className="mt-4"><BreakdownTable rows={data.bySide.map((x) => ({ ...x, label: sideLabel[x.key] }))} currency={currency} label="Dirección" /></div>
        </Card>
        <Card title="Por día de la semana (apertura)">
          <PnlBars data={data.byWeekday} xKey="label" currency={currency} />
        </Card>
        <Card title="Por hora de apertura (hora del broker)">
          <PnlBars data={hours} xKey="label" currency={currency} />
        </Card>
        {data.bySetup.length > 0 && (
          <Card title="Por setup" className="lg:col-span-2">
            <div className="grid gap-6 lg:grid-cols-2">
              <PnlBars data={data.bySetup} xKey="key" currency={currency} />
              <BreakdownTable rows={data.bySetup} currency={currency} label="Setup" />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
