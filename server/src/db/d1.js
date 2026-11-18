// Adaptador de base de datos para Cloudflare D1. Misma interfaz que el de node:sqlite.
export function d1Adapter(d1) {
  const prep = (sql, params) => (params.length ? d1.prepare(sql).bind(...params) : d1.prepare(sql));
  return {
    async first(sql, params = []) { return (await prep(sql, params).first()) ?? null; },
    async all(sql, params = []) { return (await prep(sql, params).all()).results; },
    async run(sql, params = []) {
      const r = await prep(sql, params).run();
      return { changes: r.meta.changes, lastId: r.meta.last_row_id };
    },
    /** D1 ejecuta un batch como una transacción atómica. */
    async batch(statements) {
      if (statements.length) await d1.batch(statements.map(([sql, params = []]) => prep(sql, params)));
    },
  };
}
