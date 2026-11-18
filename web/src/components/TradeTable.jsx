import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Star } from 'lucide-react';
import { dateTime, duration, lots, money, num, pnlColor, price } from '../lib/format.js';
import { Badge, cx } from './ui.jsx';

export function SideBadge({ side }) {
  return side === 'long' ? (
    <Badge tone="win"><ArrowUpRight size={12} />Long</Badge>
  ) : (
    <Badge tone="loss"><ArrowDownRight size={12} />Short</Badge>
  );
}

const COLUMNS = [
  { key: 'close_time', label: 'Fecha' },
  { key: 'symbol', label: 'Símbolo' },
  { key: null, label: 'Lado' },
  { key: 'volume', label: 'Lotes', right: true },
  { key: null, label: 'Entrada', right: true, hideSm: true },
  { key: null, label: 'Salida', right: true, hideSm: true },
  { key: 'duration_sec', label: 'Duración', right: true, hideSm: true },
  { key: null, label: 'Setup / Tags', hideSm: true },
  { key: 'net_profit', label: 'P&L neto', right: true },
];

export default function TradeTable({ trades, sort, dir, onSort, compact }) {
  const navigate = useNavigate();
  return (
    <>
      {/* Móvil: lista compacta con el P&L siempre visible */}
      <ul className="divide-y divide-white/[0.06] md:hidden">
        {trades.map((t) => (
          <li key={t.id}>
            <Link to={`/trades/${t.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-white/[0.04]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t.symbol}</span>
                  <SideBadge side={t.side} />
                  {t.status === 'open' && <Badge tone="warn">Abierto</Badge>}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted">
                  {dateTime(t.close_time || t.open_time)} · {lots(t.volume)}{t.setup ? ` · ${t.setup}` : ''}
                </div>
              </div>
              <div className={cx('text-right font-semibold tabular-nums', pnlColor(t.net_profit))}>
                {t.status === 'open' ? <span className="text-muted">—</span> : money(t.net_profit, t.currency, { sign: true })}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            {COLUMNS.filter((c) => !(compact && c.hideSm)).map((c) => (
              <th key={c.label} className={cx('px-4 py-3 font-medium', c.right && 'text-right', c.hideSm && 'hidden md:table-cell')}>
                {c.key && onSort ? (
                  <button className="hover:text-white" onClick={() => onSort(c.key)}>
                    {c.label}{sort === c.key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr
              key={t.id}
              onClick={() => navigate(`/trades/${t.id}`)}
              className="cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-panel-2/60"
            >
              <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                <Link to={`/trades/${t.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-white">{dateTime(t.close_time || t.open_time)}</Link>
                {t.status === 'open' && <Badge tone="warn" className="ml-2">Abierto</Badge>}
              </td>
              <td className="px-4 py-3 font-semibold">{t.symbol}</td>
              <td className="px-4 py-3"><SideBadge side={t.side} /></td>
              <td className="px-4 py-3 text-right tabular-nums">{num(t.volume)}</td>
              {!compact && (
                <>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-zinc-300 md:table-cell">{price(t.entry_price)}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-zinc-300 md:table-cell">{price(t.exit_price)}</td>
                  <td className="hidden px-4 py-3 text-right text-zinc-300 md:table-cell">{duration(t.duration_sec)}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex flex-wrap items-center gap-1">
                      {t.setup && <Badge tone="brand">{t.setup}</Badge>}
                      {t.tags.slice(0, 2).map((tag) => <Badge key={tag}>{tag}</Badge>)}
                      {t.rating && <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-amber-300"><Star size={11} fill="currentColor" />{t.rating}</span>}
                    </div>
                  </td>
                </>
              )}
              <td className={cx('px-4 py-3 text-right font-semibold tabular-nums', pnlColor(t.net_profit))}>
                {t.status === 'open' ? <span className="text-muted">—</span> : money(t.net_profit, t.currency, { sign: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
