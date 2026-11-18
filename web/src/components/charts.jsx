import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis, PolarGrid, Radar, RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, date, pct } from '../lib/format.js';

// Polaridad validada para daltonismo sobre la superficie oscura (ΔE deutan 17.7);
// además el signo +/− y la dirección de la barra codifican lo mismo.
export const WIN = '#34d399';
export const LOSS = '#e11d48';
export const BRAND = '#f21d38';
const GRID = '#1f1f23';
const AXIS = { stroke: '#8e8e98', fontSize: 11, tickLine: false, axisLine: false };

function TooltipBox({ title, rows }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#121214]/95 px-3 py-2 text-xs shadow-xl shadow-black/60 backdrop-blur">
      <div className="mb-1 font-medium text-zinc-300">{title}</div>
      {rows.map(([label, value, swatch]) => (
        <div key={label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted">
            {swatch && <span className="h-2 w-2 rounded-full" style={{ background: swatch }} />}
            {label}
          </span>
          <span className="font-semibold tabular-nums text-zinc-100">{value}</span>
        </div>
      ))}
    </div>
  );
}

const shortDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function EquityChart({ data, currency, height = 260 }) {
  const last = data[data.length - 1]?.pnl ?? 0;
  const color = last >= 0 ? WIN : LOSS;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="time" tickFormatter={shortDate} minTickGap={40} {...AXIS} />
        <YAxis tickFormatter={(v) => money(v, currency, { compact: true })} width={72} {...AXIS} />
        <ReferenceLine y={0} stroke="#34343a" />
        <Tooltip
          cursor={{ stroke: '#52525b', strokeDasharray: '3 3' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={date(payload[0].payload.time)}
                rows={[
                  ['P&L acumulado', money(payload[0].payload.pnl, currency, { sign: true }), color],
                  ['Drawdown', money(payload[0].payload.drawdown, currency)],
                ]}
              />
            ) : null
          }
        />
        <Area type="monotone" dataKey="pnl" stroke={color} strokeWidth={2} fill="url(#eq)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#0e0e10' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Barras con polaridad (verde positivo / rojo negativo). */
export function PnlBars({ data, xKey, currency, height = 240, labelFormatter = (v) => v, extraRows }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={labelFormatter} minTickGap={12} {...AXIS} />
        <YAxis tickFormatter={(v) => money(v, currency, { compact: true })} width={72} {...AXIS} />
        <ReferenceLine y={0} stroke="#34343a" />
        <Tooltip
          cursor={{ fill: 'rgba(225,15,43,0.08)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload;
            return (
              <TooltipBox
                title={labelFormatter(p[xKey], true)}
                rows={[
                  ['P&L', money(p.pnl, currency, { sign: true }), p.pnl >= 0 ? WIN : LOSS],
                  ['Trades', p.trades],
                  ...(p.winRate !== undefined ? [['Win rate', pct(p.winRate)]] : []),
                  ...(extraRows ? extraRows(p) : []),
                ]}
              />
            );
          }}
        />
        <Bar dataKey="pnl" radius={[4, 4, 4, 4]} maxBarSize={36}>
          {data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? WIN : LOSS} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const FACTOR_LABELS = {
  winRate: 'Win rate',
  profitFactor: 'Profit factor',
  winLossRatio: 'Ratio G/P',
  recovery: 'Recuperación',
  consistency: 'Consistencia',
  discipline: 'Disciplina',
};

export function ScoreRadar({ factors, height = 230 }) {
  const data = Object.entries(factors).map(([k, v]) => ({ factor: FACTOR_LABELS[k], value: v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="factor" tick={{ fill: '#8e8e98', fontSize: 11 }} />
        <Tooltip content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={payload[0].payload.factor} rows={[['Puntuación', `${payload[0].value}/100`, BRAND]]} /> : null)} />
        <Radar dataKey="value" stroke={BRAND} strokeWidth={2} fill={BRAND} fillOpacity={0.25} dot={{ r: 3, fill: BRAND }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function WinRateRing({ value, size = 64, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LOSS} strokeOpacity={0.85} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={WIN} strokeWidth={stroke} strokeDasharray={`${(v / 100) * c - 2} ${c}`} strokeLinecap="round" />
    </svg>
  );
}
