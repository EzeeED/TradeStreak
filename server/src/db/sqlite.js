// Adaptador de base de datos para Node (node:sqlite). Misma interfaz que el de D1.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

export function openSqlite(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  for (const f of fs.readdirSync(migrationsDir).filter((n) => n.endsWith('.sql')).sort()) {
    raw.exec(fs.readFileSync(path.join(migrationsDir, f), 'utf8'));
  }
  const prep = (sql) => raw.prepare(sql);
  return {
    raw,
    async first(sql, params = []) { return prep(sql).get(...params) ?? null; },
    async all(sql, params = []) { return prep(sql).all(...params); },
    async run(sql, params = []) {
      const r = prep(sql).run(...params);
      return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
    },
    /** Ejecuta varias sentencias de forma atómica. */
    async batch(statements) {
      raw.exec('BEGIN');
      try {
        for (const [sql, params = []] of statements) prep(sql).run(...params);
        raw.exec('COMMIT');
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  };
}
