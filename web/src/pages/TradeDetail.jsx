import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Star, Save } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { dateTime, duration, money, num, pnlColor, price } from '../lib/format.js';
import { Button, Card, ErrorBox, Field, Input, Spinner, TagInput, Textarea, cx } from '../components/ui.jsx';
import { SideBadge } from '../components/TradeTable.jsx';

const SUGGESTED_MISTAKES = ['FOMO', 'Sin stop loss', 'Sobreapalancado', 'Revenge trade', 'Salida temprana', 'Moví el SL', 'Fuera del plan'];

function Rating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(value === n ? null : n)} aria-label={`${n} estrellas`} className="text-amber-300 transition hover:scale-110">
          <Star size={22} fill={value >= n ? 'currentColor' : 'none'} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

export default function TradeDetail() {
  const { id } = useParams();
  const { data, loading, error } = useApi(`/trades/${id}`);
  const options = useApi('/trades/filters');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (data) setForm({ notes: data.trade.notes || '', setup: data.trade.setup || '', tags: data.trade.tags, mistakes: data.trade.mistakes, rating: data.trade.rating });
  }, [data]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const { trade: t, deals } = data;
  const c = t.currency;

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await api(`/trades/${t.id}`, { method: 'PATCH', body: form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  const risk = t.sl && t.entry_price ? Math.abs(t.entry_price - t.sl) : null;
  const rMultiple = risk && t.exit_price ? ((t.side === 'long' ? 1 : -1) * (t.exit_price - t.entry_price)) / risk : null;
  const facts = [
    ['Cuenta', t.account_name],
    ['Apertura', dateTime(t.open_time)],
    ['Cierre', dateTime(t.close_time)],
    ['Duración', duration(t.duration_sec)],
    ['Volumen', `${num(t.volume)} lotes`],
    ['Precio entrada', price(t.entry_price)],
    ['Precio salida', price(t.exit_price)],
    ['Stop loss', price(t.sl)],
    ['Take profit', price(t.tp)],
    ['R múltiple', rMultiple === null ? '—' : `${rMultiple.toFixed(2)}R`],
    ['Beneficio bruto', money(t.profit, c)],
    ['Comisión', money(t.commission, c)],
    ['Swap', money(t.swap, c)],
    ['Posición MT5', `#${t.position_id}`],
  ];

  return (
    <div className="space-y-6">
      <Link to="/trades" className="inline-flex items-center gap-1 text-sm text-muted hover:text-white"><ArrowLeft size={16} />Volver a trades</Link>
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-bold">{t.symbol}</h2>
        <SideBadge side={t.side} />
        <span className={cx('ml-auto text-3xl font-bold tabular-nums', pnlColor(t.net_profit))}>
          {t.status === 'open' ? 'Abierto' : money(t.net_profit, c, { sign: true })}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Detalles" className="lg:col-span-2">
          <dl className="space-y-2.5 text-sm">
            {facts.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right font-medium tabular-nums">{v}</dd></div>)}
          </dl>
          {deals.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Ejecuciones (deals)</h4>
              <div className="space-y-1.5 text-xs">
                {deals.map((d) => (
                  <div key={d.id} className="flex justify-between gap-2 rounded-lg bg-panel-2/60 px-2.5 py-1.5 tabular-nums">
                    <span className="text-muted">{dateTime(d.time)}</span>
                    <span>{d.entry === 'in' ? 'Entrada' : 'Salida'} {d.type} {num(d.volume)} @ {price(d.price)}</span>
                    <span className={pnlColor(d.profit)}>{d.profit ? money(d.profit, c) : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {form && (
          <Card title="Diario del trade" className="lg:col-span-3">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Setup / estrategia">
                  <Input value={form.setup} list="setups" onChange={(e) => setForm({ ...form, setup: e.target.value })} placeholder="Ej. Breakout, Pullback" />
                  <datalist id="setups">{options.data?.setups.map((s) => <option key={s} value={s} />)}</datalist>
                </Field>
                <Field label="Valoración de la ejecución"><Rating value={form.rating} onChange={(rating) => setForm({ ...form, rating })} /></Field>
              </div>
              <Field label="Etiquetas" hint="Enter para añadir">
                <TagInput value={form.tags} onChange={(tags) => setForm({ ...form, tags })} suggestions={options.data?.tags || []} placeholder="Ej. A+, Sesión Londres" />
              </Field>
              <Field label="Errores">
                <TagInput value={form.mistakes} onChange={(mistakes) => setForm({ ...form, mistakes })} suggestions={[...new Set([...SUGGESTED_MISTAKES, ...(options.data?.mistakes || [])])]} placeholder="Ej. FOMO, Revenge trade" />
              </Field>
              <Field label="Notas">
                <Textarea rows={8} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="¿Por qué entraste? ¿Seguiste tu plan? ¿Qué harías distinto?" />
              </Field>
              <ErrorBox error={saveError} />
              <div className="flex items-center justify-end gap-3">
                {saved && <span className="text-sm text-win">Guardado ✓</span>}
                <Button icon={Save} loading={saving} onClick={save}>Guardar</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
