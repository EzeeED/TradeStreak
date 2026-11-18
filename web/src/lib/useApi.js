import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

/** Hook mínimo para cargar datos de la API y recargar cuando cambian las dependencias. */
export function useApi(path, query, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const key = JSON.stringify([path, query]);

  const load = useCallback(() => {
    if (!path) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { query })
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState((s) => ({ ...s, loading: false, error })));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  useEffect(() => load(), [load]);
  return { ...state, reload: load };
}
