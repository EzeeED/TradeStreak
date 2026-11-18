import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListOrdered, CalendarDays, BarChart3, NotebookPen, Wallet, LogOut, Menu, X } from 'lucide-react';
import Logo from './Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFilters, RANGES } from '../context/FiltersContext.jsx';
import { cx } from './ui.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/trades', label: 'Trades', icon: ListOrdered },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays },
  { to: '/reports', label: 'Reportes', icon: BarChart3 },
  { to: '/journal', label: 'Diario', icon: NotebookPen },
  { to: '/accounts', label: 'Cuentas MT5', icon: Wallet },
];

const TITLES = { '/': 'Dashboard', '/trades': 'Trades', '/calendar': 'Calendario', '/reports': 'Reportes', '/journal': 'Diario', '/accounts': 'Cuentas MT5' };

export default function Layout() {
  const { user, logout } = useAuth();
  const { accounts, accountId, setAccountId, range, setRange } = useFilters();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? (pathname.startsWith('/trades/') ? 'Detalle del trade' : '');
  const showFilters = pathname !== '/accounts' && pathname !== '/journal';

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive ? 'bg-brand/15 text-white ring-1 ring-brand/30' : 'text-slate-400 hover:bg-panel-2 hover:text-slate-200')
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  const userBox = (
    <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-panel-2/50 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-emerald-500 text-sm font-semibold">
        {user?.name?.[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{user?.name}</div>
        <div className="truncate text-xs text-muted">{user?.email}</div>
      </div>
      <button onClick={logout} className="rounded-lg p-1.5 text-muted hover:bg-panel-2 hover:text-white" title="Cerrar sesión" aria-label="Cerrar sesión">
        <LogOut size={16} />
      </button>
    </div>
  );

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-panel/60 p-4 lg:flex">
        <div className="mb-8 px-2 pt-1"><Logo /></div>
        {nav}
        {userBox}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-72 flex-col border-r border-line bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-8 flex items-center justify-between px-2 pt-1">
              <Logo />
              <button onClick={() => setOpen(false)} className="text-muted" aria-label="Cerrar menú"><X /></button>
            </div>
            {nav}
            {userBox}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur sm:px-8">
          <button className="rounded-lg p-1.5 text-slate-300 hover:bg-panel-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu /></button>
          <h1 className="mr-auto text-lg font-semibold">{title}</h1>
          {showFilters && (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand sm:flex-none"
                aria-label="Cuenta"
              >
                <option value="all">Todas las cuentas</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.login ? ` · ${a.login}` : ''}</option>)}
              </select>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand sm:flex-none"
                aria-label="Periodo"
              >
                {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
