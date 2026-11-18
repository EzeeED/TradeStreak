import { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

export const cx = (...c) => c.filter(Boolean).join(' ');

export function Card({ className, children, title, action, padded = true }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-panel', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone, icon: Icon, className }) {
  return (
    <div className={cx('rounded-2xl border border-line bg-panel p-4', className)}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        {Icon && <Icon size={14} />}
        {label}
      </div>
      <div className={cx('mt-2 text-2xl font-semibold tabular-nums', tone)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const variants = {
  primary: 'bg-brand text-white hover:bg-violet-500 shadow-lg shadow-violet-900/30',
  secondary: 'bg-panel-2 text-slate-200 border border-line hover:border-slate-500',
  ghost: 'text-slate-300 hover:bg-panel-2',
  danger: 'bg-rose-600/15 text-rose-300 border border-rose-500/30 hover:bg-rose-600/25',
};

export function Button({ variant = 'primary', loading, className, children, icon: Icon, ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-loss">{error}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25';

export const Input = (props) => <input {...props} className={cx(inputClass, props.className)} />;
export const Select = ({ children, ...props }) => (
  <select {...props} className={cx(inputClass, 'pr-8', props.className)}>{children}</select>
);
export const Textarea = (props) => <textarea {...props} className={cx(inputClass, 'min-h-28 resize-y', props.className)} />;

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-10" onMouseDown={onClose}>
      <div
        className={cx('w-full rounded-2xl border border-line bg-panel shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-panel-2 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'default', className }) {
  const tones = {
    default: 'bg-panel-2 text-slate-300 border-line',
    win: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    loss: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
    brand: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
    warn: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && <div className="mb-4 rounded-2xl bg-panel-2 p-4 text-brand"><Icon size={28} /></div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <div className={cx('flex items-center justify-center py-16 text-muted', className)}>
      <Loader2 className="animate-spin" />
    </div>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error.message || String(error)}</div>;
}

export function TagInput({ value, onChange, suggestions = [], placeholder }) {
  const add = (raw) => {
    const t = raw.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
  };
  return (
    <div className={cx(inputClass, 'flex flex-wrap items-center gap-1.5 py-2')}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-panel-2 px-2 py-0.5 text-xs">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="text-muted hover:text-white" aria-label={`Quitar ${t}`}><X size={12} /></button>
        </span>
      ))}
      <input
        list={suggestions.length ? 'tag-suggestions' : undefined}
        placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 bg-transparent outline-none placeholder:text-slate-500"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(e.currentTarget.value);
            e.currentTarget.value = '';
          } else if (e.key === 'Backspace' && !e.currentTarget.value && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={(e) => { add(e.currentTarget.value); e.currentTarget.value = ''; }}
      />
      {suggestions.length > 0 && <datalist id="tag-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
    </div>
  );
}
