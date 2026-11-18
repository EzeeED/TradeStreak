import { useState } from 'react';
import { ListOrdered } from 'lucide-react';
import { useFilters } from '../context/FiltersContext.jsx';
import { useApi } from '../lib/useApi.js';
import { money, pnlColor } from '../lib/format.js';
import { Button, Card, Empty, ErrorBox, Select, Spinner, cx } from '../components/ui.jsx';
import TradeTable from '../components/TradeTable.jsx';

const EMPTY = { symbol: '', side: '', result: '', setup: '', tag: '', status: '' };

export default function Trades() {
  const { query, currency, version } = useFilters();
  const [f, setF] = useState(EMPTY);
  const [sort, setSort] = useState({ sort: 'close_time', dir: 'desc' });
  const [page, setPage] = useState(1);
  const options = useApi('/trades/filters', { accountId: query.accountId }, [version]);
  const list = useApi('/trades', { ...query, ...f, ...sort, page, limit: 50 }, [version]);

  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  const onSort = (key) => setSort((s) => ({ sort: key, dir: s.sort === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const o = options.data || { symbols: [], setups: [], tags: [] };
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.limit)) : 1;
  const active = Object.values(f).some(Boolean);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Select value={f.symbol} onChange={set('symbol')} aria-label="Símbolo"><option value="">Todos los símbolos</option>{o.symbols.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select value={f.side} onChange={set('side')} aria-label="Lado"><option value="">Long y short</option><option value="long">Long</option><option value="short">Short</option></Select>
        <Select value={f.result} onChange={set('result')} aria-label="Resultado"><option value="">Ganadores y perdedores</option><option value="win">Ganadores</option><option value="loss">Perdedores</option></Select>
        <Select value={f.status} onChange={set('status')} aria-label="Estado"><option value="">Abiertos y cerrados</option><option value="closed">Cerrados</option><option value="open">Abiertos</option></Select>
        <Select value={f.setup} onChange={set('setup')} aria-label="Setup"><option value="">Todos los setups</option>{o.setups.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select value={f.tag} onChange={set('tag')} aria-label="Etiqueta"><option value="">Todas las etiquetas</option>{o.tags.map((s) => <option key={s}>{s}</option>)}</Select>
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 text-sm">
          <span className="text-muted">
            {list.data ? <>{list.data.total} trades · P&L <span className={cx('font-semibold', pnlColor(list.data.pnl))}>{money(list.data.pnl, currency, { sign: true })}</span></> : 'Cargando…'}
          </span>
          {active && <Button variant="ghost" onClick={() => { setF(EMPTY); setPage(1); }}>Limpiar filtros</Button>}
        </div>
        <ErrorBox error={list.error} />
        {list.loading && !list.data ? <Spinner /> : list.data?.trades.length ? (
          <TradeTable trades={list.data.trades} sort={sort.sort} dir={sort.dir} onSort={onSort} />
        ) : (
          <Empty icon={ListOrdered} title="No hay trades con estos filtros" />
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span className="text-muted">Página {page} de {pages}</span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
