import { motion } from 'framer-motion';
import type { Status } from '../../api/types';
import clsx from '../../lib/clsx';
import { STATUS, getBands } from '../../theme/status';
import { OddsNumber } from '../ui/OddsNumber';

const START = 225; // degrees clockwise from 12 o'clock; 270° sweep leaves the gap at the bottom
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const s = polar(cx, cy, r, from);
  const e = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/** 270° readiness gauge with threshold ticks at 50% (watch) and 82% (ready). */
export function OddsGauge({ odds, status, size = 220 }: { odds: number; status: Status; size?: number }) {
  const meta = STATUS[status];
  const c = 100;
  const r = 82;
  const track = arc(c, c, r, START, START + SWEEP);
  const tick = (p: number) => {
    const a = polar(c, c, r - 13, START + SWEEP * p);
    const b = polar(c, c, r + 13, START + SWEEP * p);
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(230,238,248,0.45)" strokeWidth={1.5} />;
  };
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
        <defs>
          <filter id={`glow-${status}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={track} fill="none" stroke="rgba(140,180,220,0.12)" strokeWidth={14} strokeLinecap="round" />
        <motion.path
          d={track}
          fill="none"
          stroke={meta.hex}
          strokeWidth={14}
          strokeLinecap="round"
          filter={`url(#glow-${status})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Number.isFinite(odds) ? Math.max(0.001, odds) : 0, stroke: meta.hex }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
        {tick(getBands().yellow)}
        {tick(getBands().green)}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <OddsNumber value={odds} className={clsx('font-bold leading-none tracking-tight', meta.text)} style={{ fontSize: size * 0.24 }} />
        <span className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-dim">odds ready</span>
      </div>
    </div>
  );
}
