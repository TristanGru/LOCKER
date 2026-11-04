import { motion } from 'framer-motion';
import { Package, UserRoundMinus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { GraphNode, Mission } from '../../api/types';
import clsx from '../../lib/clsx';
import { STATUS, pct } from '../../theme/status';

const DAYS = 30;
const frac = (days: number) => Math.min(1, Math.max(0, days / DAYS));
const x = (days: number) => `${frac(days) * 100}%`;

interface Marker {
  key: string;
  days: number;
  label: string;
  kind: 'part' | 'person';
  status: GraphNode['status'];
  ids: string[];
  lane: number;
}

const LANE_TOP = ['6.05rem', '7.7rem'];

/** 30-day strip: mission dates above the axis, flagged part ETAs and sailor departures below. */
export function TimelineStrip({
  missions,
  nodes,
  focus,
  onOpen,
}: {
  missions: Mission[];
  nodes: GraphNode[];
  focus: string | 'all';
  onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1400);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  // Group flagged ETAs / departures that land on the same half-day.
  const groups = new Map<string, Omit<Marker, 'lane'>>();
  for (const n of nodes) {
    if (!n.when || n.status === 'ready' || n.when.hours / 24 > DAYS) continue;
    const kind = n.kind === 'part' ? 'part' : 'person';
    const key = `${kind}:${Math.round((n.when.hours / 24) * 2) / 2}`;
    const g = groups.get(key);
    if (g) {
      g.ids.push(n.id);
      g.label = kind === 'person' ? `${g.ids.length} sailors leave` : `${g.ids.length} parts due`;
      if (n.status === 'risk') g.status = 'risk';
    } else {
      groups.set(key, {
        key,
        days: n.when.hours / 24,
        kind,
        status: n.status,
        ids: [n.id],
        label: kind === 'person' ? `${n.label.split(' ').slice(-1)[0]} leaves` : `${n.label} ETA`,
      });
    }
  }

  // Greedy lane assignment so labels never overlap (estimated label width in px).
  const laneEnds = [-Infinity, -Infinity];
  const markers: Marker[] = Array.from(groups.values())
    .sort((a, b) => a.days - b.days)
    .map((m) => {
      const w = m.label.length * 7.6 + 46;
      const center = frac(m.days) * width;
      const left = center - w / 2;
      let lane = laneEnds.findIndex((end) => left > end + 10);
      if (lane === -1) lane = laneEnds[0] <= laneEnds[1] ? 0 : 1;
      laneEnds[lane] = center + w / 2;
      return { ...m, lane };
    });
  const lanesUsed = markers.length === 0 ? 0 : Math.max(...markers.map((m) => m.lane)) + 1;
  const height = lanesUsed === 0 ? '5.6rem' : lanesUsed === 1 ? '7.55rem' : '9.2rem';

  return (
    <div className="glass relative px-6 pb-2 pt-3" aria-label="30-day timeline">
      <div className="mb-1 flex items-center justify-between">
        <span className="label-caps">Next 30 days</span>
        <span className="text-xs text-ink-dim">Missions above · flagged part ETAs and departures below</span>
      </div>
      <motion.div ref={ref} className="relative" initial={false} animate={{ height }} transition={{ duration: 0.4 }}>
        {/* axis */}
        <div className="absolute left-0 right-0 top-[4.4rem] h-px bg-line-strong" />
        {Array.from({ length: DAYS + 1 }, (_, d) => (
          <div key={d} className="absolute top-[4.4rem]" style={{ left: x(d) }}>
            <div className={clsx('-translate-x-1/2 bg-line-strong', d % 5 === 0 ? 'h-2.5 w-px' : 'h-1.5 w-px opacity-60')} />
            {d % 5 === 0 && d > 0 && <div className="num absolute top-3 -translate-x-1/2 text-[0.68rem] text-ink-dim">D+{d}</div>}
          </div>
        ))}
        {/* now */}
        <div className="absolute top-[2.9rem] flex -translate-x-1/2 flex-col items-center" style={{ left: 0 }}>
          <span className="num rounded bg-accent px-1.5 text-[0.65rem] font-bold text-abyss-950">NOW</span>
          <span className="h-4 w-px bg-accent" />
        </div>

        {missions.map((m) => {
          const meta = STATUS[m.status];
          const Icon = meta.icon;
          const dim = focus !== 'all' && focus !== m.id;
          return (
            <motion.button
              key={m.id}
              type="button"
              onClick={() => onOpen(m.id)}
              initial={false}
              animate={{ left: x(m.daysOut), opacity: dim ? 0.45 : 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="group absolute top-0 flex -translate-x-1/2 flex-col items-center"
              title={`${m.code}: ${pct(m.odds)} ready, D+${m.daysOut}`}
            >
              <span className={clsx('flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-sm font-bold transition group-hover:brightness-125', meta.border, meta.bg, meta.text)}>
                <Icon className="h-4 w-4" aria-hidden />
                {m.code}
                <span className="num font-semibold text-ink">{pct(m.odds)}</span>
              </span>
              <span className="num mt-0.5 text-[0.68rem] text-ink-dim">D+{m.daysOut}</span>
              <span className="h-[0.9rem] w-0.5" style={{ background: meta.hex }} />
              <span className="h-3 w-3 rotate-45 border-2" style={{ borderColor: meta.hex, background: '#060b14' }} />
            </motion.button>
          );
        })}

        {markers.map((mk) => {
          const meta = STATUS[mk.status];
          const Icon = mk.kind === 'part' ? Package : UserRoundMinus;
          return (
            <motion.div key={mk.key} initial={false} animate={{ left: x(mk.days) }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} className="absolute inset-y-0">
              {/* dot on the axis + stem down to the lane */}
              <span className="absolute top-[4.1rem] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2" style={{ borderColor: meta.hex, background: '#060b14' }} />
              <span className="absolute w-px -translate-x-1/2 opacity-70" style={{ background: meta.hex, top: '4.75rem', height: `calc(${LANE_TOP[mk.lane]} - 4.75rem)` }} />
              <button
                type="button"
                onClick={() => onOpen(mk.ids[0])}
                className={clsx(
                  'absolute flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[0.75rem] font-semibold hover:brightness-125',
                  meta.border,
                  meta.bg,
                  meta.text,
                )}
                style={{ top: LANE_TOP[mk.lane] }}
                title={mk.label}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {mk.label}
              </button>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
