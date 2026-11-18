export function money(n, currency = 'USD', { sign = false, compact = false } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const f = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: compact && Math.abs(n) >= 1000 ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
    notation: compact && Math.abs(n) >= 10000 ? 'compact' : 'standard',
  }).format(n);
  return sign && n > 0 ? `+${f}` : f;
}

export const pct = (n, digits = 1) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(digits)}%`);
export const num = (n, digits = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: digits }));

export function price(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 2 : abs >= 10 ? 3 : 5;
  return Number(n).toFixed(digits);
}

export function duration(sec) {
  if (sec === null || sec === undefined) return '—';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// Las horas vienen en hora del servidor del broker (sin zona): se muestran tal cual.
export function dateTime(iso) {
  if (!iso) return '—';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
}
export function date(iso) {
  if (!iso) return '—';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function longDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00Z');
  const s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const lots = (n) => `${num(n)} ${Number(n) === 1 ? 'lote' : 'lotes'}`;

export const pnlColor = (n) => (n > 0 ? 'text-win' : n < 0 ? 'text-loss' : 'text-muted');

export function ymd(d) {
  return d.toISOString().slice(0, 10);
}

export function relativeTime(sqliteDate) {
  if (!sqliteDate) return 'nunca';
  const t = Date.parse(sqliteDate.replace(' ', 'T') + 'Z');
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'hace unos segundos';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} días`;
}

/** Importe muy corto para celdas pequeñas: +1.2k, -85 */
export function shortMoney(n) {
  if (n === null || n === undefined) return '—';
  const a = Math.abs(n);
  const body = a >= 1000 ? `${(a / 1000).toFixed(1).replace('.0', '')}k` : String(Math.round(a));
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${body}`;
}
