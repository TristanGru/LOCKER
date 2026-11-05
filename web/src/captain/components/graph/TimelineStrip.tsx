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
  const baseRem = lanesUsed === 0 ? 5.6 : lanesUsed === 1 ? 7.55 : 9.2;

  // Mission labels get the same greedy lanes: a label that would overlap its neighbour moves up a row.
  const missionEnds = [-Infinity, -Infinity, -Infinity];
  const missionLane = new Map<string, number>();
  for (const m of [...missions].sort((a, b) => a.daysOut - b.daysOut)) {
    const w = m.code.length * 8.6 + 92;
    const center = frac(m.daysOut) * width;
    let lane = missionEnds.findIndex((end) => center - w / 2 > end + 8);
    if (lane === -1) lane = missionEnds.indexOf(Math.min(...missionEnds));
    missionEnds[lane] = center + w / 2;
    missionLane.set(m.id, lane);
  }
  const LIFT = 2.6; // rem added above the axis for each extra row of mission labels
  const lift = Math.max(0, ...missionLane.values()) * LIFT;

  return (
    <div className="glass relative px-6 pb-2 pt-3" aria-label="30-day timeline">
      <div className="mb-1 flex items-center justify-between">
        <span className="label-caps">Next 30 days</span>
        <span className="text-xs text-ink-dim">Missions above · flagged part ETAs and departures below</span>
      </div>
      <motion.div ref={ref} className="relative" initial={false} animate={{ height: `${baseRem + lift}rem` }} transition={{ duration: 0.4 }}>
       <div className="absolute inset-x-0 bottom-0" style={{ top: `${lift}rem` }}>
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

        {/* Higher rows first, so a lower label paints over the stems that pass behind it. */}
        {[...missions].sort((a, b) => (missionLane.get(b.id) ?? 0) - (missionLane.get(a.id) ?? 0)).map((m) => {
          const meta = STATUS[m.status];
          const Icon = meta.icon;
          const dim = focus !== 'all' && focus !== m.id;
          const row = missionLane.get(m.id) ?? 0;
          return (
            <motion.button
              key={m.id}
              type="button"
              onClick={() => onOpen(m.id)}
              initial={false}
              animate={{ left: x(m.daysOut), opacity: dim ? 0.45 : 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="group absolute flex -translate-x-1/2 flex-col items-center"
              style={{ top: `-${row * LIFT}rem` }}
              title={`${m.code}: ${pct(m.odds)} ready, D+${m.daysOut}`}
            >
              <span className="rounded-lg bg-abyss-800">
                <span className={clsx('flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-sm font-bold transition group-hover:brightness-125', meta.border, meta.bg, meta.text)}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {m.code}
                  <span className="num font-semibold text-ink">{pct(m.odds)}</span>
                </span>
              </span>
              <span className="num mt-0.5 text-[0.68rem] text-ink-dim">D+{m.daysOut}</span>
              <span className="w-0.5" style={{ background: meta.hex, height: `${0.9 + row * LIFT}rem` }} />
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
       </div>
      </motion.div>
    </div>
  );
}
