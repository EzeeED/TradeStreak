import { useId } from 'react';

/** Ícono oficial de TradeStreak: calendario con una vela, en degradado azul. */
export function LogoIcon({ size = 28 }) {
  // Ids únicos: si dos logos comparten id y uno está oculto, los degradados desaparecen.
  const id = useId().replace(/:/g, '');
  const g = `tsg-${id}`, c = `tsc-${id}`, m = `tsm-${id}`;
  return (
    <svg width={size} height={size * (345 / 324)} viewBox="350 295 324 345" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0058ff" />
          <stop offset="0.45" stopColor="#1a8cff" />
          <stop offset="0.8" stopColor="#8fd0ff" />
          <stop offset="1" stopColor="#eef7ff" />
        </linearGradient>
        <linearGradient id={c} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#86dcff" />
          <stop offset="1" stopColor="#0086ff" />
        </linearGradient>
        <mask id={m}>
          <rect x="350" y="295" width="324" height="345" fill="#fff" />
          <rect x="415" y="294" width="40" height="86" rx="20" fill="#000" />
          <rect x="570" y="294" width="40" height="86" rx="20" fill="#000" />
        </mask>
      </defs>
      <rect x="356" y="330" width="312" height="304" rx="42" fill={`url(#${g})`} mask={`url(#${m})`} />
      <rect x="369" y="396" width="286" height="226" rx="24" fill="#000208" />
      <rect x="423" y="301" width="24" height="72" rx="12" fill={`url(#${g})`} />
      <rect x="578" y="301" width="24" height="72" rx="12" fill={`url(#${g})`} />
      <g fill="#1b3246">
        {[426, 485, 544].map((y) => [400, 459, 518].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="40" height="40" rx="9" />))}
      </g>
      <rect x="593" y="426" width="6" height="158" rx="3" fill={`url(#${c})`} />
      <rect x="573" y="474" width="46" height="74" rx="7" fill={`url(#${c})`} />
    </svg>
  );
}

export default function Logo({ size = 28, withText = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoIcon size={size} />
      {withText && (
        <span className="font-display text-lg font-semibold tracking-tight">
          Trade<span className="bg-gradient-to-r from-[#0a6cff] to-[#5ab8ff] bg-clip-text text-transparent">Streak</span>
        </span>
      )}
    </div>
  );
}
