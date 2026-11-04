import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import type { OddsPoint, Status } from '../../api/types';
import { STATUS, pct } from '../../theme/status';

/** Odds trend since the baseline: one point per event or approval. */
export function OddsSparkline({ points, status, id, bare = false }: { points: OddsPoint[]; status: Status; id: string; bare?: boolean }) {
  const color = STATUS[status].hex;
  // A single point still draws a flat line.
  const data = (points.length === 1 ? [points[0], { ...points[0], label: 'Now' }] : points).map((p, i) => ({ ...p, i }));
  return (
    <div className={bare ? 'h-8 w-full' : 'h-16 w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={bare ? 0.2 : 0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="i" hide />
          <YAxis domain={[0, 1]} hide />
          {!bare && <ReferenceLine y={0.82} stroke="rgba(52,211,153,0.35)" strokeDasharray="4 4" />}
          {!bare && <ReferenceLine y={0.5} stroke="rgba(251,77,93,0.35)" strokeDasharray="4 4" />}
          <Tooltip content={<SparkTip />} cursor={{ stroke: 'rgba(140,180,220,0.3)' }} />
          <Area
            type="monotone"
            dataKey="odds"
            stroke={color}
            strokeWidth={bare ? 2 : 2.5}
            fill={`url(#spark-${id})`}
            dot={bare ? false : { r: 3, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SparkTip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as OddsPoint;
  return (
    <div className="rounded-lg border border-line-strong bg-abyss-800/95 px-3 py-2 text-sm shadow-glass">
      <div className="num font-bold text-ink">{pct(p.odds)}</div>
      <div className="text-xs text-ink-muted">{p.label}</div>
    </div>
  );
}
