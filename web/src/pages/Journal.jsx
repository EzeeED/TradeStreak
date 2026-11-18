import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, NotebookPen } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useFilters } from '../context/FiltersContext.jsx';
import { longDate, money, pnlColor, ymd } from '../lib/format.js';
import { Button, Card, ErrorBox, Input, Textarea, cx } from '../components/ui.jsx';
import TradeTable from '../components/TradeTable.jsx';

const MOODS = [
  { v: 1, e: '😣', l: 'Muy mal' },
  { v: 2, e: '😕', l: 'Mal' },
  { v: 3, e: '😐', l: 'Neutral' },
  { v: 4, e: '🙂', l: 'Bien' },
  { v: 5, e: '🤩', l: 'Excelente' },
];

const TEMPLATE = `## Antes de operar
- ¿Qué espero del mercado hoy?
- Niveles que estoy mirando:
- Noticias:

## Al cerrar
- ¿Respeté el plan?
- Lo que salió bien:
- Lo que no repetiría:
`;

export default function Journal() {
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || ymd(new Date());
  const { currency, version } = useFilters();
  const entry = useApi(`/journal/${date}`);
  const recent = useApi('/journal', undefined, [version]);
  const trades = useApi('/trades', { from: date, to: date, limit: 100 }, [version]);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (entry.data) {
      setContent(entry.data.entry.content);
      setMood(entry.data.entry.mood);
    }
  }, [entry.data]);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      await api(`/journal/${date}`, { method: 'PUT', body: { content, mood } });
      setStatus('ok');
      recent.reload();
    } catch (err) {
      setStatus(err);
    } finally {
      setSaving(false);
    }
  }

  const dayPnl = trades.data?.pnl ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <Card
          title={longDate(date)}
          action={<Input type="date" value={date} onChange={(e) => e.target.value && setParams({ date: e.target.value })} className="w-auto py-1.5" aria-label="Fecha" />}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5" role="radiogroup" aria-label="Estado de ánimo">
                {MOODS.map((m) => (
                  <button
                    key={m.v}
                    type="button"
                    title={m.l}
                    aria-label={m.l}
                    aria-checked={mood === m.v}
                    role="radio"
                    onClick={() => setMood(mood === m.v ? null : m.v)}
                    className={cx('rounded-xl border px-2.5 py-1.5 text-xl transition', mood === m.v ? 'border-brand bg-brand/15' : 'border-line opacity-60 hover:opacity-100')}
                  >
                    {m.e}
                  </button>
                ))}
              </div>
              {trades.data && (
                <div className="text-sm text-muted">
                  {trades.data.total} trades · <span className={cx('font-semibold', pnlColor(dayPnl))}>{money(dayPnl, currency, { sign: true })}</span>
                </div>
              )}
            </div>
            <Textarea rows={14} value={content} onChange={(e) => setContent(e.target.value)} placeholder="¿Cómo te fue hoy? Qué tenías pensado, qué hiciste, cómo te sentiste…" className="font-mono text-[13px] leading-relaxed" />
            <ErrorBox error={status instanceof Error ? status : null} />
            <div className="flex items-center justify-between gap-3">
              {!content && <Button variant="ghost" onClick={() => setContent(TEMPLATE)}>Usar plantilla</Button>}
              <div className="ml-auto flex items-center gap-3">
                {status === 'ok' && <span className="text-sm text-win">Guardado ✓</span>}
                <Button icon={Save} loading={saving} onClick={save}>Guardar</Button>
              </div>
            </div>
          </div>
        </Card>
        {trades.data?.trades.length > 0 && (
          <Card title="Trades del día" padded={false}><TradeTable trades={trades.data.trades} compact /></Card>
        )}
      </div>

      <Card title="Entradas recientes" padded={false}>
        {recent.data?.entries.length ? (
          <ul className="divide-y divide-line/60">
            {recent.data.entries.map((e) => (
              <li key={e.id}>
                <button onClick={() => setParams({ date: e.date })} className={cx('flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-panel-2/60', e.date === date && 'bg-brand/10')}>
                  <span className="text-lg">{MOODS.find((m) => m.v === e.mood)?.e ?? '📝'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{e.date.split('-').reverse().join('/')}</span>
                    <span className="block truncate text-xs text-muted">{e.content.replace(/[#\-*]/g, '').trim().slice(0, 60) || 'Sin texto'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center px-5 py-10 text-center text-sm text-muted"><NotebookPen className="mb-2 text-crimson-300" />Aquí vas a ver lo que escribas cada día.</div>
        )}
      </Card>
    </div>
  );
}
