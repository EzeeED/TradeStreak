import { useId } from 'react';

export default function Logo({ size = 28, withText = true }) {
  // Id único: si dos logos comparten id y uno está oculto, el degradado desaparece.
  const gid = `ts-g-${useId().replace(/:/g, '')}`;
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#8c0a1d" />
            <stop offset="0.55" stopColor="#e10f2b" />
            <stop offset="1" stopColor="#ff4d61" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="#141416" />
        <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#3a0a12" />
        <path d="M5 23l6-7 5 4 9-11" fill="none" stroke={`url(#${gid})`} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="25" cy="9" r="2.6" fill="#ff4d61" />
      </svg>
      {withText && (
        <span className="font-display text-lg font-bold tracking-tight">
          Trade<span className="text-gradient-red">Streak</span>
        </span>
      )}
    </div>
  );
}
