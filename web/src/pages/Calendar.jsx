import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFilters } from '../context/FiltersContext.jsx';
import { useApi } from '../lib/useApi.js';
import { longDate, money, pnlColor } from '../lib/format.js';
import { Card, ErrorBox, Spinner, cx } from '../components/ui.jsx';
import MonthCalendar from '../components/MonthCalendar.jsx';
import TradeTable from '../components/TradeTable.jsx';

export default function Calendar() {
  const { query, currency, version } = useFilters();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [day, setDay] = useState(null);
  const stats = useApi('/stats', { accountId: query.accountId }, [version]);
  const dayTrades = useApi(day ? '/trades' : null, { accountId: query.accountId, from: day, to: day, limit: 100 }, [version]);

  if (stats.loading && !stats.data) return <Spinner />;
  if (stats.error) return <ErrorBox error={stats.error} />;
  const d = stats.data.daily.find((x) => x.date === day);

  return (
    <div className="space-y-6">
      <Card>
        <MonthCalendar month={month} onMonthChange={setMonth} daily={stats.data.daily} currency={currency} onSelectDay={setDay} selected={day} />
      </Card>
      {day && (
        <Card
          title={<span className="capitalize">{longDate(day)}</span>}
          padded={false}
          action={
            <div className="flex items-center gap-4 text-sm">
              {d && <span className={cx('font-semibold', pnlColor(d.pnl))}>{money(d.pnl, currency, { sign: true })}</span>}
              <Link to={`/journal?date=${day}`} className="text-violet-300 hover:text-violet-200">Abrir diario →</Link>
            </div>
          }
        >
          {dayTrades.data?.trades.length ? <TradeTable trades={dayTrades.data.trades} /> : <p className="p-5 text-sm text-muted">{dayTrades.loading ? 'Cargando…' : 'Sin trades este día.'}</p>}
        </Card>
      )}
    </div>
  );
}
