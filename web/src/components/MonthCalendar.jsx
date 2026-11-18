import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS, money, shortMoney } from '../lib/format.js';
import { cx } from './ui.jsx';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Calendario mensual con P&L por día y resumen semanal. */
export default function MonthCalendar({ month, onMonthChange, daily, currency, onSelectDay, selected, compact }) {
  const [y, m] = month.split('-').map(Number);
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthDays = daily.filter((d) => d.date.startsWith(month));
  const monthPnl = monthDays.reduce((s, d) => s + d.pnl, 0);
  const maxAbs = Math.max(1, ...monthDays.map((d) => Math.abs(d.pnl)));
  const shift = (delta) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    onMonthChange(d.toISOString().slice(0, 7));
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="rounded-lg p-1.5 text-muted hover:bg-panel-2 hover:text-white" aria-label="Mes anterior"><ChevronLeft size={18} /></button>
          <h3 className="min-w-36 text-center font-semibold">{MONTHS[m - 1]} {y}</h3>
          <button onClick={() => shift(1)} className="rounded-lg p-1.5 text-muted hover:bg-panel-2 hover:text-white" aria-label="Mes siguiente"><ChevronRight size={18} /></button>
        </div>
        <div className="text-sm text-muted">
          Mes: <span className={cx('font-semibold tabular-nums', monthPnl > 0 ? 'text-win' : monthPnl < 0 ? 'text-loss' : 'text-slate-300')}>{money(monthPnl, currency, { sign: true })}</span>
          <span className="ml-2">· {monthDays.length} días</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-8">
        {DOW.map((d) => <div key={d} className="pb-1 text-center text-xs font-medium text-muted">{d}</div>)}
        <div className="hidden pb-1 text-center text-xs font-medium text-muted sm:block">Semana</div>
        {weeks.map((week, wi) => {
          const wDays = week.filter(Boolean).map((d) => byDate.get(d)).filter(Boolean);
          const wPnl = wDays.reduce((s, d) => s + d.pnl, 0);
          return [
            ...week.map((day, di) => {
              if (!day) return <div key={`${wi}-${di}`} />;
              const d = byDate.get(day);
              const intensity = d ? 0.12 + 0.4 * Math.min(1, Math.abs(d.pnl) / maxAbs) : 0;
              const bg = d ? (d.pnl >= 0 ? `rgba(52,211,153,${intensity})` : `rgba(225,29,72,${intensity})`) : undefined;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onSelectDay?.(day)}
                  style={{ background: bg }}
                  title={d ? `${day}: ${money(d.pnl, currency, { sign: true })} · ${d.trades} trades` : day}
                  className={cx(
                    'flex flex-col rounded-xl border p-1.5 text-left transition hover:border-slate-400 sm:p-2',
                    compact ? 'min-h-14' : 'min-h-16 sm:min-h-24',
                    selected === day ? 'border-brand ring-1 ring-brand' : d ? (d.pnl >= 0 ? 'border-emerald-500/30' : 'border-rose-500/30') : 'border-line bg-bg/40',
                  )}
                >
                  <span className={cx('text-xs', day === today ? 'rounded bg-brand px-1 font-semibold text-white' : 'text-muted')}>{Number(day.slice(8))}</span>
                  {d && (
                    <span className="mt-auto">
                      <span className="block truncate text-[11px] font-semibold tabular-nums text-white sm:text-xs lg:text-sm">{compact ? shortMoney(d.pnl) : money(d.pnl, currency, { sign: true, compact: true })}</span>
                      {!compact && <span className="hidden text-[11px] text-slate-300 sm:block">{d.trades} trade{d.trades !== 1 ? 's' : ''} · {Math.round((d.wins / d.trades) * 100)}%</span>}
                    </span>
                  )}
                </button>
              );
            }),
            <div key={`w${wi}`} className={cx('hidden flex-col justify-center rounded-xl border border-line bg-panel-2/50 p-2 text-center sm:flex', compact ? 'min-h-14' : 'min-h-24')}>
              <span className="text-[11px] text-muted">S{wi + 1}</span>
              <span className={cx('text-sm font-semibold tabular-nums', wPnl > 0 ? 'text-win' : wPnl < 0 ? 'text-loss' : 'text-muted')}>{wDays.length ? (compact ? shortMoney(wPnl) : money(wPnl, currency, { sign: true, compact: true })) : '—'}</span>
              {wDays.length > 0 && !compact && <span className="text-[11px] text-muted">{wDays.length} días</span>}
            </div>,
          ];
        })}
      </div>
    </div>
  );
}
