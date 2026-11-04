import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import type { Fix } from '../../api/types';
import { STATUS, oddsStatus } from '../../theme/status';

interface Row {
  name: string;
  title: string;
  before: number;
  after: number;
}

/** Before vs after odds for every ranked fix, side by side. */
export function FixesChart({ fixes }: { fixes: Fix[] }) {
  const data: Row[] = fixes.map((f) => ({
    name: `#${f.rank}`,
    title: f.title,
    before: Math.round(f.oddsBefore * 100),
    after: Math.round(f.oddsAfter * 100),
  }));
  const height = Math.max(170, data.length * 64 + 56);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 22, right: 56, bottom: 4, left: 4 }} barGap={3} barCategoryGap={14}>
          <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} stroke="rgba(140,180,220,0.35)" tick={{ fill: '#6b7d95', fontSize: 12, fontFamily: 'JetBrains Mono' }} />
          <YAxis type="category" dataKey="name" width={40} stroke="rgba(140,180,220,0.35)" tick={{ fill: '#e6eef8', fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono' }} />
          <ReferenceLine x={82} stroke="rgba(52,211,153,0.6)" strokeDasharray="4 4" label={{ value: 'Ready 82%', position: 'top', fill: '#34d399', fontSize: 11 }} />
          <ReferenceLine x={50} stroke="rgba(251,77,93,0.6)" strokeDasharray="4 4" label={{ value: 'At risk <50%', position: 'top', fill: '#fb4d5d', fontSize: 11 }} />
          <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(140,180,220,0.06)' }} />
          <Bar dataKey="before" name="Now" fill="rgba(148,163,184,0.35)" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="before" position="right" formatter={(v: number) => `${v}%`} style={{ fill: '#9fb0c6', fontSize: 12, fontFamily: 'JetBrains Mono' }} />
          </Bar>
          <Bar dataKey="after" name="After fix" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.name} fill={STATUS[oddsStatus(d.after / 100)].hex} />
            ))}
            <LabelList dataKey="after" position="right" formatter={(v: number) => `${v}%`} style={{ fill: '#e6eef8', fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload as Row;
  return (
    <div className="max-w-xs rounded-lg border border-line-strong bg-abyss-800/95 px-3 py-2 text-sm shadow-glass">
      <div className="font-semibold text-ink">
        {r.name} {r.title}
      </div>
      <div className="num mt-1 text-ink-muted">
        {r.before}% → <span className="font-bold text-ink">{r.after}%</span> (+{r.after - r.before} pts)
      </div>
    </div>
  );
}
