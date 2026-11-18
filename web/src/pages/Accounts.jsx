import { useState } from 'react';
import { Server, RefreshCw, Sparkles, Trash2, Wallet, Plus, AlertTriangle, CircleCheck, Clock, ShieldCheck, Info } from 'lucide-react';
import { api } from '../lib/api.js';
import { money, relativeTime, pnlColor } from '../lib/format.js';
import { useFilters } from '../context/FiltersContext.jsx';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, cx } from '../components/ui.jsx';

const CONNECTION_LABEL = { metaapi: 'Servidor MT5', demo: 'Demo', ea: 'Expert Advisor', import: 'Importación' };

function StatusBadge({ account }) {
  if (account.status === 'connected') return <Badge tone="win"><CircleCheck size={12} /> Conectada</Badge>;
  if (account.status === 'error') return <Badge tone="loss"><AlertTriangle size={12} /> Error</Badge>;
  return <Badge tone="warn"><Clock size={12} /> Conectando</Badge>;
}

function NotEnabledNotice() {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <Info size={18} className="mt-0.5 shrink-0 text-amber-300" />
      <span>Todavía estamos terminando la conexión con MT5. Mientras tanto, puedes probar todo con una <b>cuenta demo</b>.</span>
    </div>
  );
}

const EMPTY_FORM = { name: '', login: '', server: '', broker: '', password: '' };

function ConnectModal({ open, onClose, onCreated, enabled }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const close = () => { setForm(EMPTY_FORM); setError(null); onClose(); };

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { account } = await api('/accounts', { method: 'POST', body: form });
      // La primera conexión puede tardar; si aún no está lista, la cuenta queda "Conectando".
      await api(`/accounts/${account.id}/sync`, { method: 'POST' }).catch(() => {});
      await onCreated();
      close();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Conectar cuenta MT5">
      <form onSubmit={submit} className="space-y-4">
        {!enabled && <NotEnabledNotice />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Login (número de cuenta)"><Input required inputMode="numeric" pattern="\d+" value={form.login} onChange={set('login')} placeholder="51234567" /></Field>
          <Field label="Servidor"><Input required value={form.server} onChange={set('server')} placeholder="ICMarketsSC-Live07" /></Field>
          <div className="sm:col-span-2">
            <Field label="Contraseña investor (solo lectura)">
              <Input required type="password" value={form.password} onChange={set('password')} autoComplete="off" />
            </Field>
          </div>
          <Field label="Nombre de la cuenta"><Input required value={form.name} onChange={set('name')} placeholder="Ej. Fondeo 100k" /></Field>
          <Field label="Broker (opcional)"><Input value={form.broker} onChange={set('broker')} placeholder="Ej. IC Markets" /></Field>
        </div>
        <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-muted">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#5aaeff]" />
          <span>
            Usa la <b className="text-zinc-300">contraseña de inversor</b>: con ella solo se puede ver el historial, no operar.
            Si no la tienes a mano, en MT5 puedes cambiarla en <b className="text-zinc-300">Herramientas → Opciones → Servidor</b>. No guardamos tu contraseña.
          </span>
        </div>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
          <Button type="submit" loading={loading} disabled={!enabled} icon={Server}>Conectar cuenta</Button>
        </div>
      </form>
    </Modal>
  );
}

function AccountCard({ account, onChange }) {
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

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-start gap-4 p-5">
        <div className="rounded-xl bg-gradient-to-br from-crimson-600/25 to-crimson-900/20 p-3 text-crimson-300 ring-1 ring-crimson-500/30"><Wallet size={22} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{account.name}</h3>
            <StatusBadge account={account} />
            <Badge>{CONNECTION_LABEL[account.connection_type] ?? account.connection_type}</Badge>
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
        {account.connection_type === 'metaapi' && <Button variant="secondary" icon={RefreshCw} loading={busy === 'sync'} onClick={sync}>Sincronizar ahora</Button>}
        <Button variant="danger" icon={Trash2} loading={busy === 'delete'} onClick={remove} className="ml-auto">Eliminar</Button>
      </div>
      {error && <div className="px-5 pb-4"><ErrorBox error={error} /></div>}
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
        <p className="text-sm text-muted">Conecta tu cuenta de MT5 y tus operaciones aparecen solas en el diario.</p>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Sparkles} loading={demoLoading} onClick={createDemo}>Cuenta demo</Button>
          <Button icon={Plus} onClick={() => setAdding(true)}>Conectar cuenta MT5</Button>
        </div>
      </div>
      {!metaapiEnabled && <NotEnabledNotice />}
      <ErrorBox error={error} />
      {accounts.length === 0 ? (
        <Card>
          <Empty
            icon={Server}
            title="Todavía no has conectado ninguna cuenta"
            action={<div className="flex flex-wrap justify-center gap-2"><Button icon={Plus} onClick={() => setAdding(true)}>Conectar cuenta MT5</Button><Button variant="secondary" icon={Sparkles} loading={demoLoading} onClick={createDemo}>Probar con datos demo</Button></div>}
          >
            Necesitas tu número de cuenta, el nombre del servidor de tu broker y la contraseña de inversor.
          </Empty>
        </Card>
      ) : (
        <div className="space-y-4">{accounts.map((a) => <AccountCard key={a.id} account={a} onChange={refreshAccounts} />)}</div>
      )}
      <ConnectModal open={adding} onClose={() => setAdding(false)} onCreated={refreshAccounts} enabled={metaapiEnabled} />
    </div>
  );
}
