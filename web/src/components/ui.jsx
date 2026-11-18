import { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

export const cx = (...c) => c.filter(Boolean).join(' ');

export function Card({ className, children, title, action, padded = true }) {
  return (
    <section className={cx('glass rounded-2xl border border-white/[0.06]', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-crimson-400 to-crimson-700" />{title}</h3>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone, icon: Icon, className }) {
  return (
    <div className={cx('glass rounded-2xl border border-white/[0.06] p-4', className)}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        {Icon && <span className="rounded-md bg-crimson-600/15 p-1 text-crimson-400 ring-1 ring-crimson-500/20"><Icon size={13} /></span>}
        {label}
      </div>
      <div className={cx('font-display mt-2 text-2xl font-semibold tabular-nums', tone)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const variants = {
  primary: 'bg-gradient-to-b from-crimson-500 to-crimson-700 text-white hover:from-crimson-400 hover:to-crimson-600 glow-red',
  secondary: 'bg-panel-2/80 text-zinc-200 border border-line hover:border-crimson-500/50 hover:text-white',
  ghost: 'text-zinc-300 hover:bg-panel-2',
  danger: 'bg-transparent text-crimson-300 border border-crimson-500/30 hover:bg-crimson-600/15',
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
      {label && <span className="mb-1.5 block text-sm font-medium text-zinc-300">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-loss">{error}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25';

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
        className={cx('w-full rounded-2xl border border-white/[0.08] bg-panel shadow-2xl shadow-crimson-950/50', wide ? 'max-w-3xl' : 'max-w-lg')}
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
    default: 'bg-panel-2 text-zinc-300 border-line',
    win: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    loss: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
    brand: 'bg-crimson-600/15 text-crimson-200 border-crimson-500/30',
    warn: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && <div className="mb-4 rounded-2xl bg-crimson-600/10 p-4 text-crimson-400 ring-1 ring-crimson-500/25"><Icon size={28} /></div>}
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
        className="min-w-24 flex-1 bg-transparent outline-none placeholder:text-zinc-500"
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
