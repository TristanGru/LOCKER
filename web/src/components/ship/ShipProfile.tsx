import { motion } from 'framer-motion';
import { Crosshair, MapPin } from 'lucide-react';
import type { ShipSystem } from '../../api/types';
import clsx from '../../lib/clsx';
import { STATUS } from '../../theme/status';
import { HULL_ASPECT, ShipHull } from './ShipHull';

/**
 * Where each semantic mount sits on this top-down destroyer drawing (% of width / height).
 * The 3D model resolves mounts per hull type; this flat drawing is the DDG-only fallback
 * (no WebGL, or print). Mounts missing here get no pin.
 */
const SKY_MOUNTS: Record<string, { x: number; y: number; side?: 'up' | 'down' }> = {
  flight: { x: 13, y: 50, side: 'down' },
  vls_aft: { x: 35.8, y: 50, side: 'up' },
  sat: { x: 51, y: 33, side: 'up' },
  air_radar: { x: 61.5, y: 50, side: 'down' },
  vls_fwd: { x: 72.6, y: 50, side: 'up' },
  gun: { x: 84.4, y: 50, side: 'down' },
  engine_p: { x: 30, y: 0 },
  engine_s: { x: 40, y: 0 },
  genset_1: { x: 48, y: 0 },
  chill: { x: 58, y: 0 },
  genset_2: { x: 66, y: 0 },
  sonar: { x: 92, y: 0 },
};

type Placed = ShipSystem & { x: number; y: number; side?: 'up' | 'down' };

/** Sky view: hull drawing with deck pins on it and below-deck pins in a row under it. */
export function ShipProfile({ systems, onOpen }: { systems: ShipSystem[]; onOpen: (id: string) => void }) {
  const placed: Placed[] = systems.flatMap((s) => {
    const m = s.mount ? SKY_MOUNTS[s.mount] : undefined;
    return m ? [{ ...s, ...m }] : [];
  });
  const deck = placed.filter((s) => s.deck === 'top');
  const below = placed.filter((s) => s.deck === 'below').sort((a, b) => a.x - b.x);
  return (
    // Fixed-proportion drawing: scrolls sideways on narrow screens instead of squashing.
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[56rem]">
        <div className="relative w-full" style={{ aspectRatio: `${1 / HULL_ASPECT}` }}>
          <ShipHull className="absolute inset-0 h-full w-full" />
          {deck.map((s, i) => (
            <DeckPin key={s.id} s={s} index={i} onOpen={onOpen} />
          ))}
        </div>

        <div className="mt-2 border-t border-dashed border-line pt-3">
          <div className="label-caps mb-2 flex items-center gap-2">
            <span className="h-px w-6 bg-line-strong" /> Below deck
          </div>
          <div className="grid grid-cols-3 gap-2">
            {below.map((s, i) => (
              <BelowPin key={s.id} s={s} index={i} onOpen={onOpen} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dot({ s, size = 'md' }: { s: ShipSystem; size?: 'md' | 'sm' }) {
  const meta = STATUS[s.status];
  const Icon = meta.icon;
  return (
    <span
      className={clsx(
        'relative grid shrink-0 place-items-center rounded-full border-2 bg-abyss-900 transition-colors duration-500',
        size === 'md' ? 'h-9 w-9' : 'h-7 w-7',
        s.isNextDomino && 'animate-pulseRing',
      )}
      style={{ borderColor: meta.hex, boxShadow: s.isNextDomino ? undefined : `0 0 16px -4px ${meta.hex}` }}
    >
      <span className="absolute inset-1 rounded-full opacity-25" style={{ background: meta.hex }} />
      <Icon className={clsx('relative', size === 'md' ? 'h-5 w-5' : 'h-4 w-4', meta.text)} strokeWidth={2.6} aria-hidden />
    </span>
  );
}

function DeckPin({ s, index, onOpen }: { s: Placed; index: number; onOpen: (id: string) => void }) {
  const meta = STATUS[s.status];
  const Icon = meta.icon;
  const up = s.side === 'up';
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(s.id)}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.15 + index * 0.06, type: 'spring', stiffness: 300, damping: 20 }}
      className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none"
      style={{ left: `${s.x}%`, top: `${s.y}%` }}
      aria-label={`${s.name}: ${meta.label}${s.isNextDomino ? ', next domino' : ''}`}
    >
      <span className="block transition-transform group-hover:scale-110 group-focus-visible:scale-110">
        <Dot s={s} />
      </span>
      {/* stem + label */}
      <span className={clsx('pointer-events-none absolute left-1/2 h-3 w-px -translate-x-1/2', up ? 'bottom-full' : 'top-full')} style={{ background: meta.hex }} />
      <span
        className={clsx(
          'absolute left-1/2 flex -translate-x-1/2 flex-col items-center whitespace-nowrap rounded-lg border bg-abyss-900/95 px-2.5 py-1 text-left shadow-glass backdrop-blur-md transition group-hover:brightness-125',
          up ? 'bottom-[calc(100%+0.7rem)]' : 'top-[calc(100%+0.7rem)]',
          s.isNextDomino ? 'border-risk shadow-[0_0_22px_-6px_rgba(251,77,93,0.9)]' : meta.border,
        )}
      >
        {s.isNextDomino && (
          <span className="flex items-center gap-1 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-risk">
            <Crosshair className="h-3 w-3" aria-hidden /> Next domino
          </span>
        )}
        <span className="text-[0.82rem] font-semibold text-ink">{s.name}</span>
        <span className={clsx('flex items-center gap-1 text-[0.72rem] font-semibold', meta.text)}>
          <Icon className="h-3 w-3" aria-hidden /> {meta.label}
        </span>
      </span>
    </motion.button>
  );
}

function BelowPin({ s, index, onOpen }: { s: ShipSystem; index: number; onOpen: (id: string) => void }) {
  const meta = STATUS[s.status];
  const Icon = meta.icon;
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(s.id)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.05 }}
      className={clsx(
        'flex min-w-0 items-center gap-2.5 rounded-xl border bg-abyss-900/60 px-3 py-2 text-left transition hover:bg-white/[0.04]',
        s.isNextDomino ? 'border-risk shadow-[0_0_22px_-8px_rgba(251,77,93,0.9)]' : meta.border,
      )}
      aria-label={`${s.name} (${s.location}): ${meta.label}${s.isNextDomino ? ', next domino' : ''}`}
    >
      <Dot s={s} size="sm" />
      <span className="min-w-0">
        {s.isNextDomino && <span className="block text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-risk">Next domino</span>}
        <span className="block truncate text-[0.82rem] font-semibold text-ink" title={s.name}>
          {s.name}
        </span>
        <span className={clsx('flex items-center gap-1 text-[0.72rem] font-semibold', meta.text)}>
          <Icon className="h-3 w-3" aria-hidden /> {meta.label}
        </span>
        <span className="flex items-center gap-1 truncate text-[0.7rem] text-ink-dim" title={s.location}>
          <MapPin className="h-3 w-3 shrink-0" aria-hidden /> {s.location}
        </span>
      </span>
    </motion.button>
  );
}
