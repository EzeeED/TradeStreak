import { useState } from 'react';
import { Bot, Cloud, Copy, Check, Download, FileUp, RefreshCw, Sparkles, Trash2, Wallet, Plus, KeyRound, AlertTriangle, CircleCheck, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import { money, relativeTime, pnlColor } from '../lib/format.js';
import { useFilters } from '../context/FiltersContext.jsx';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, cx } from '../components/ui.jsx';

const METHODS = [
  { id: 'ea', icon: Bot, title: 'Expert Advisor', badge: 'Recomendado', text: 'Sincronización automática en tiempo real instalando nuestro EA en tu MT5. Gratis y sin compartir contraseñas.' },
  { id: 'metaapi', icon: Cloud, title: 'Login + servidor', badge: 'Sin instalar nada', text: 'Conecta con tu número de cuenta, contraseña investor y servidor a través de MetaApi.' },
  { id: 'import', icon: FileUp, title: 'Importar informe', badge: 'Manual', text: 'Sube el informe HTML exportado desde la pestaña Historial de MT5, o un CSV.' },
];

const CONNECTION_LABEL = { ea: 'Expert Advisor', metaapi: 'MetaApi', import: 'Importación', demo: 'Demo' };

function StatusBadge({ account }) {
  if (account.status === 'connected') return <Badge tone="win"><CircleCheck size={12} /> Conectada</Badge>;
  if (account.status === 'error') return <Badge tone="loss"><AlertTriangle size={12} /> Error</Badge>;
  return <Badge tone="warn"><Clock size={12} /> Esperando datos</Badge>;
}

function CopyField({ label, value, secret }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <code className="flex-1 truncate rounded-xl border border-line bg-bg px-3.5 py-2.5 font-mono text-xs text-zinc-200">
          {shown ? value : '•'.repeat(Math.min(40, value.length))}
        </code>
        {secret && <Button variant="secondary" type="button" onClick={() => setShown(!shown)}>{shown ? 'Ocultar' : 'Mostrar'}</Button>}
        <Button
          variant="secondary"
          type="button"
          icon={copied ? Check : Copy}
          onClick={async () => {
            try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setShown(true); }
          }}
          aria-label={`Copiar ${label}`}
        />
      </div>
    </Field>
  );
}

function EaInstructions({ account, onRegenerate }) {
  const steps = [
    <>Descarga <a className="font-medium text-crimson-300 underline" href="/api/downloads/TradeStreakSync.mq5" download>TradeStreakSync.mq5</a>. En MT5 abre <b>Archivo → Abrir carpeta de datos</b> y cópialo en <code>MQL5/Experts</code>. Reinicia MT5 o pulsa "Actualizar" en el Navegador.</>,
    <>Ve a <b>Herramientas → Opciones → Asesores Expertos</b>, activa <b>"Permitir WebRequest para las URL listadas"</b> y añade: <code className="break-all">{new URL(account.sync_url).origin}</code></>,
    <>Arrastra <b>TradeStreakSync</b> a cualquier gráfico, activa <b>"Permitir Algo Trading"</b> y pega tu <b>URL</b> y <b>token</b> en la pestaña Parámetros.</>,
    <>¡Listo! El EA envía tu historial completo y luego cada nueva operación al instante. Sólo lee datos: nunca abre ni cierra operaciones.</>,
  ];
  return (
    <div className="space-y-4">
      <CopyField label="URL de sincronización" value={account.sync_url} />
      <CopyField label="Token de sincronización" value={account.sync_token} secret />
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm text-zinc-300">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/20 text-xs font-semibold text-crimson-200">{i + 1}</span>
            <span className="[&_code]:rounded [&_code]:bg-panel-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs">{s}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2 pt-1">
        <a href="/api/downloads/TradeStreakSync.mq5" download><Button type="button" icon={Download}>Descargar EA</Button></a>
        {onRegenerate && <Button type="button" variant="secondary" icon={KeyRound} onClick={onRegenerate}>Regenerar token</Button>}
      </div>
    </div>
  );
}

function ImportForm({ account, onDone }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api(`/accounts/${account.id}/import`, { method: 'POST', body: fd });
      setResult(r);
      onDone?.();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl border border-line bg-panel-2/40 p-4 text-sm text-zinc-300">
        En MT5 abre la pestaña <b>Historial</b> (Caja de herramientas), selecciona el periodo <b>"Todo el historial"</b>, haz clic derecho y elige
        <b> Informe → HTML (Internet Explorer)</b>. Sube aquí ese archivo. También aceptamos CSV con columnas
        <code className="mx-1 rounded bg-panel-2 px-1 text-xs">symbol, type, volume, open_time, close_time, open_price, close_price, commission, swap, profit</code>.
      </div>
      <label className={cx('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition', file ? 'border-brand/60 bg-brand/5' : 'border-line hover:border-zinc-500')}>
        <FileUp className="text-crimson-300" />
        <span className="text-sm font-medium">{file ? file.name : 'Haz clic para elegir el informe (.html, .htm o .csv)'}</span>
        <input type="file" accept=".html,.htm,.csv,.txt" className="hidden" onChange={(e) => { setFile(e.target.files[0]); setResult(null); }} />
      </label>
      <ErrorBox error={error} />
      {result && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Se importaron {result.imported} operaciones.</div>}
      <Button type="submit" loading={loading} disabled={!file} icon={FileUp}>Importar</Button>
    </form>
  );
}

function AddAccountModal({ open, onClose, onCreated, metaapiEnabled }) {
  const [method, setMethod] = useState('ea');
  const [form, setForm] = useState({ name: '', login: '', server: '', broker: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const reset = () => {
    setMethod('ea'); setForm({ name: '', login: '', server: '', broker: '', password: '' }); setError(null); setCreated(null);
  };
  const close = () => { reset(); onClose(); };

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = { ...form, connection_type: method };
      if (method !== 'metaapi') delete body.password;
      const { account } = await api('/accounts', { method: 'POST', body });
      onCreated(account);
      if (method === 'metaapi') {
        await api(`/accounts/${account.id}/sync`, { method: 'POST' }).catch(() => {});
        onCreated(account);
        close();
      } else setCreated(account);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title={created ? `Conecta "${created.name}"` : 'Añadir cuenta MT5'} wide>
      {created ? (
        <div className="space-y-5">
          {created.connection_type === 'ea' ? <EaInstructions account={created} /> : <ImportForm account={created} onDone={() => onCreated(created)} />}
          <div className="flex justify-end border-t border-line pt-4"><Button variant="secondary" onClick={close}>Terminar</Button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {METHODS.map(({ id, icon: Icon, title, badge, text }) => {
              const disabled = id === 'metaapi' && !metaapiEnabled;
              return (
                <button
                  type="button"
                  key={id}
                  disabled={disabled}
                  onClick={() => setMethod(id)}
                  className={cx('rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40',
                    method === id ? 'border-crimson-500/70 bg-gradient-to-b from-crimson-600/15 to-transparent ring-1 ring-crimson-500/40' : 'border-white/[0.08] hover:border-crimson-500/40')}
                >
                  <div className="flex items-center justify-between"><Icon size={20} className="text-crimson-300" /><Badge tone={id === 'ea' ? 'brand' : 'default'}>{badge}</Badge></div>
                  <div className="mt-3 font-semibold">{title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted">{disabled ? 'No disponible: el administrador debe configurar METAAPI_TOKEN en el servidor.' : text}</div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre de la cuenta"><Input required value={form.name} onChange={set('name')} placeholder="Ej. FTMO 100k, Personal IC Markets" /></Field>
            <Field label="Broker (opcional)"><Input value={form.broker} onChange={set('broker')} placeholder="Ej. IC Markets" /></Field>
            {method === 'metaapi' && (
              <>
                <Field label="Login (número de cuenta)"><Input required inputMode="numeric" pattern="\d+" value={form.login} onChange={set('login')} placeholder="51234567" /></Field>
                <Field label="Servidor"><Input required value={form.server} onChange={set('server')} placeholder="ICMarketsSC-Demo" /></Field>
                <div className="sm:col-span-2">
                  <Field label="Contraseña investor (solo lectura)" hint="Se envía cifrada a MetaApi para conectar la cuenta y no se guarda en TradeStreak. Usa la contraseña de inversor para que nadie pueda operar.">
                    <Input required type="password" value={form.password} onChange={set('password')} autoComplete="off" />
                  </Field>
                </div>
              </>
            )}
            {method === 'ea' && (
              <Field label="Login (opcional)" hint="Si lo indicas, el EA sólo podrá sincronizar esa cuenta.">
                <Input inputMode="numeric" pattern="\d*" value={form.login} onChange={set('login')} placeholder="51234567" />
              </Field>
            )}
          </div>
          <ErrorBox error={error} />
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
            <Button type="submit" loading={loading} icon={Plus}>{method === 'metaapi' ? 'Conectar cuenta' : 'Crear y continuar'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function AccountCard({ account, onChange }) {
  const [panel, setPanel] = useState(null); // 'ea' | 'import'
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const run = (key, fn) => async () => {
    setBusy(key);
    setError(null);
    try { await fn(); await onChange(); } catch (err) { setError(err); } finally { setBusy(null); }
  };

  const remove = run('delete', async () => {
    if (!window.confirm(`¿Eliminar "${account.name}" y todos sus trades? Esta acción no se puede deshacer.`)) return;
    await api(`/accounts/${account.id}`, { method: 'DELETE' });
  });
  const sync = run('sync', () => api(`/accounts/${account.id}/sync`, { method: 'POST' }));
  const regenerate = run('token', async () => {
    if (!window.confirm('El token anterior dejará de funcionar. Tendrás que actualizarlo en el EA. ¿Continuar?')) return;
    await api(`/accounts/${account.id}/regenerate-token`, { method: 'POST' });
  });

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-start gap-4 p-5">
        <div className="rounded-xl bg-gradient-to-br from-crimson-600/25 to-crimson-900/20 p-3 text-crimson-300 ring-1 ring-crimson-500/30"><Wallet size={22} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{account.name}</h3>
            <StatusBadge account={account} />
            <Badge>{CONNECTION_LABEL[account.connection_type]}</Badge>
          </div>
          <div className="mt-1 text-sm text-muted">
            {[account.broker, account.login && `#${account.login}`, account.server].filter(Boolean).join(' · ') || 'MetaTrader 5'}
          </div>
          <div className="mt-1 text-xs text-muted">Última sincronización: {relativeTime(account.last_sync_at)}</div>
          {account.status_message && <div className="mt-2 text-xs text-amber-300">{account.status_message}</div>}
        </div>
        <div className="grid w-full grid-cols-3 gap-4 border-t border-line pt-4 sm:w-auto sm:gap-6 sm:border-0 sm:pt-0 sm:text-right">
          <div><div className="text-xs text-muted">Balance</div><div className="font-display font-semibold tabular-nums">{money(account.balance, account.currency)}</div></div>
          <div><div className="text-xs text-muted">P&L neto</div><div className={cx('font-semibold tabular-nums', pnlColor(account.net_pnl))}>{money(account.net_pnl, account.currency, { sign: true })}</div></div>
          <div><div className="text-xs text-muted">Trades</div><div className="font-semibold tabular-nums">{account.trade_count}</div></div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
        {account.connection_type === 'ea' && <Button variant="secondary" icon={Bot} onClick={() => setPanel(panel === 'ea' ? null : 'ea')}>Configurar EA</Button>}
        {account.connection_type === 'metaapi' && <Button variant="secondary" icon={RefreshCw} loading={busy === 'sync'} onClick={sync}>Sincronizar ahora</Button>}
        {account.connection_type !== 'demo' && <Button variant="secondary" icon={FileUp} onClick={() => setPanel(panel === 'import' ? null : 'import')}>Importar informe</Button>}
        <Button variant="danger" icon={Trash2} loading={busy === 'delete'} onClick={remove} className="ml-auto">Eliminar</Button>
      </div>
      {error && <div className="px-5 pb-4"><ErrorBox error={error} /></div>}
      {panel && (
        <div className="border-t border-line bg-bg/40 p-5">
          {panel === 'ea' ? <EaInstructions account={account} onRegenerate={regenerate} /> : <ImportForm account={account} onDone={onChange} />}
        </div>
      )}
    </Card>
  );
}

export default function Accounts() {
  const { accounts, refreshAccounts, metaapiEnabled } = useFilters();
  const [adding, setAdding] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState(null);

  async function createDemo() {
    setDemoLoading(true);
    setError(null);
    try { await api('/accounts/demo', { method: 'POST' }); await refreshAccounts(); } catch (err) { setError(err); } finally { setDemoLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Conecta tus cuentas de MetaTrader 5 para que tus operaciones aparezcan automáticamente en tu diario.</p>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Sparkles} loading={demoLoading} onClick={createDemo}>Cuenta demo</Button>
          <Button icon={Plus} onClick={() => setAdding(true)}>Añadir cuenta MT5</Button>
        </div>
      </div>
      <ErrorBox error={error} />
      {accounts.length === 0 ? (
        <Card>
          <Empty
            icon={Wallet}
            title="Aún no tienes cuentas conectadas"
            action={<div className="flex gap-2"><Button icon={Plus} onClick={() => setAdding(true)}>Añadir cuenta MT5</Button><Button variant="secondary" icon={Sparkles} loading={demoLoading} onClick={createDemo}>Probar con datos demo</Button></div>}
          >
            Añade tu cuenta de MT5 con nuestro Expert Advisor, con tu login y servidor, o importando tu informe de historial.
          </Empty>
        </Card>
      ) : (
        <div className="space-y-4">{accounts.map((a) => <AccountCard key={a.id} account={a} onChange={refreshAccounts} />)}</div>
      )}
      <AddAccountModal open={adding} onClose={() => setAdding(false)} onCreated={() => refreshAccounts()} metaapiEnabled={metaapiEnabled} />
    </div>
  );
}
