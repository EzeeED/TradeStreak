import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const FiltersContext = createContext(null);
const KEY = 'tradestreak.filters';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function FiltersProvider({ children }) {
  const { user } = useAuth();
  const saved = load();
  const [accountId, setAccountId] = useState(saved.accountId || 'all');
  const [range, setRange] = useState(saved.range || 'all');
  const [accounts, setAccounts] = useState([]);
  const [metaapiEnabled, setMetaapiEnabled] = useState(false);
  const [version, setVersion] = useState(0); // se incrementa para forzar recargas tras sincronizar

  const refreshAccounts = useCallback(async () => {
    const d = await api('/accounts');
    setAccounts(d.accounts);
    setMetaapiEnabled(d.metaapiEnabled);
    setVersion((v) => v + 1);
    return d.accounts;
  }, []);

  useEffect(() => {
    if (user) refreshAccounts().catch(() => {});
    else setAccounts([]);
  }, [user, refreshAccounts]);

  useEffect(() => {
    if (accountId !== 'all' && accounts.length && !accounts.some((a) => String(a.id) === String(accountId))) setAccountId('all');
  }, [accounts, accountId]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ accountId, range })); } catch { /* sin storage */ }
  }, [accountId, range]);

  const { from, to } = useMemo(() => rangeDates(range), [range]);
  const query = useMemo(() => ({ accountId: accountId === 'all' ? undefined : accountId, from, to }), [accountId, from, to]);
  const currency = accountId === 'all' ? accounts[0]?.currency || 'USD' : accounts.find((a) => String(a.id) === String(accountId))?.currency || 'USD';

  const value = { accountId, setAccountId, range, setRange, accounts, refreshAccounts, metaapiEnabled, query, currency, version };
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export const RANGES = [
  { id: 'all', label: 'Todo el historial' },
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: '90d', label: 'Últimos 90 días' },
  { id: 'ytd', label: 'Este año' },
];

function rangeDates(range) {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const daysAgo = (n) => new Date(today.getTime() - n * 86400_000);
  switch (range) {
    case 'today': return { from: iso(today), to: undefined };
    case 'week': return { from: iso(daysAgo((today.getUTCDay() + 6) % 7)), to: undefined };
    case 'month': return { from: iso(today).slice(0, 8) + '01', to: undefined };
    case '30d': return { from: iso(daysAgo(30)), to: undefined };
    case '90d': return { from: iso(daysAgo(90)), to: undefined };
    case 'ytd': return { from: `${today.getUTCFullYear()}-01-01`, to: undefined };
    default: return { from: undefined, to: undefined };
  }
}

export const useFilters = () => useContext(FiltersContext);
