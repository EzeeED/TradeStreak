export default function Logo({ size = 28, withText = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="ts-g" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="#151c33" />
        <path d="M5 23l6-7 5 4 9-11" fill="none" stroke="url(#ts-g)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="25" cy="9" r="2.6" fill="#10b981" />
      </svg>
      {withText && (
        <span className="text-lg font-bold tracking-tight">
          Trade<span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">Streak</span>
        </span>
      )}
    </div>
  );
}
