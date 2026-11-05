import { motion } from 'framer-motion';
import type { Mission, MissionDelta } from '../../api/types';
import clsx from '../../lib/clsx';
import { STATUS, getBands } from '../../theme/status';
import { OddsNumber } from '../ui/OddsNumber';

/** Live odds per mission, with a ghost bar showing where it stood before the last event. */
export function ImpactStrip({
  missions,
  deltas,
  focus,
  onFocus,
}: {
  missions: Mission[];
  deltas: MissionDelta[] | null;
  focus: string;
  onFocus: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {missions.map((m) => {
        const meta = STATUS[m.status];
        const Icon = meta.icon;
        const d = deltas?.find((x) => x.missionId === m.id);
        const moved = d && Math.abs(d.after - d.before) >= 0.005;
        const pts = d ? Math.round((d.after - d.before) * 100) : 0;
        const active = focus === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onFocus(m.id)}
            aria-pressed={active}
            className={clsx(
              'glass relative overflow-hidden px-4 py-3 text-left transition',
              active ? 'border-accent/70 shadow-focus' : clsx(meta.border, 'hover:border-line-strong'),
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Icon className={clsx('h-4 w-4', meta.text)} aria-hidden />
                <span className="font-bold text-ink">{m.code}</span>
                <span className="num text-xs text-ink-dim">D+{m.daysOut}</span>
              </span>
              <span className={clsx('text-xs font-semibold', meta.text)}>{meta.label}</span>
            </div>
            <div className="mt-1 flex items-end justify-between gap-2">
              <OddsNumber value={m.odds} className={clsx('text-[2.2rem] font-bold leading-none', meta.text)} />
              {moved && (
                <motion.span
                  key={`${m.id}-${pts}-${d!.after}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={clsx('num rounded-md px-2 py-0.5 text-sm font-bold', pts < 0 ? 'bg-risk-soft text-risk' : 'bg-ready-soft text-ready')}
                >
                  {pts > 0 ? '+' : ''}
                  {pts} pts
                </motion.span>
              )}
            </div>
            <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.08]">
              {moved && <div className="absolute inset-y-0 left-0 rounded-full bg-ink/20" style={{ width: `${d!.before * 100}%` }} />}
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                initial={false}
                animate={{ width: `${m.odds * 100}%`, backgroundColor: meta.hex }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              />
              <div className="absolute inset-y-0 w-px bg-ready/70" style={{ left: `${getBands().green*100}%` }} title="Backend ready threshold" />
              <div className="absolute inset-y-0 w-px bg-risk/70" style={{ left: `${getBands().yellow*100}%` }} title="Backend watch threshold" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
