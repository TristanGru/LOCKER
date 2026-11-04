import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Mission, OddsPoint, Status } from '../../api/types';
import clsx from '../../lib/clsx';
import { useStore } from '../../state/store';
import { STATUS, pct, getBands } from '../../theme/status';
import { OddsSparkline } from '../charts/OddsSparkline';
import { OddsNumber } from '../ui/OddsNumber';
import { RecordId } from '../ui/RecordId';
import { StatusBadge } from '../ui/StatusBadge';

const ACTION: Record<Status, { label: string; to: string; solid: boolean }> = {
  unknown: { label: 'Inspect evidence', to: '/dominoes', solid: false },
  risk: { label: 'Open dominoes', to: '/dominoes', solid: true },
  watch: { label: 'Review fixes', to: '/fixes', solid: false },
  ready: { label: 'View', to: '/dominoes', solid: false },
};

/** One mission as a ranked row: status, odds on a 50/82 bar, trend, next domino, one action. */
export function MissionRow({ mission: m, history, index }: { mission: Mission; history: OddsPoint[]; index: number }) {
  const meta = STATUS[m.status];
  const navigate = useNavigate();
  const { setFocus, openNode } = useStore();
  const date = new Date(m.date);
  const first = history[0]?.odds ?? m.odds;
  const delta = Math.round((m.odds - first) * 100);
  const action = ACTION[m.status];
  const emphasized = m.status === 'risk';
  const when = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const go = () => {
    setFocus(m.id);
    navigate(action.to);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={clsx(
        'grid items-center gap-x-8 gap-y-4 rounded-2xl border bg-[#0c1624] px-6',
        emphasized ? 'border-risk/45 py-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)_minmax(0,1fr)]' : 'border-line py-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1fr)]',
      )}
      style={{ boxShadow: `inset 4px 0 0 0 ${meta.hex}` }}
    >
      <div className="min-w-0">
        <StatusBadge status={m.status} size={emphasized ? 'md' : 'sm'} />
        <h2 className={clsx('mt-2 font-extrabold leading-none tracking-wide text-ink', emphasized ? 'text-[1.85rem]' : 'text-[1.45rem]')}>{m.code}</h2>
        <p className="mt-1 truncate text-sm text-ink-muted" title={m.name}>
          {m.name}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          <span className="num font-semibold text-ink">{m.daysOut}</span> days
          <span className="mx-1.5 text-ink-dim">·</span>
          <span className="num">{when}</span>
          <span className="mx-1.5 text-ink-dim">·</span>
          <span className="num">{m.flaggedCount}</span> flagged
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <OddsNumber value={m.odds} className={clsx('font-bold leading-none', emphasized ? 'text-[3.4rem]' : 'text-[2.6rem]')} style={{ color: meta.hex }} />
          <span className={clsx('num text-sm font-bold', delta < 0 ? 'text-risk' : delta > 0 ? 'text-ready' : 'text-ink-muted')}>
            {delta > 0 ? '+' : ''}
            {delta} pts since baseline
          </span>
        </div>
        <ThresholdBar odds={m.odds} color={meta.hex} />
        <div className="mt-1">
          <OddsSparkline points={history} status={m.status} id={m.id} bare />
        </div>
      </div>

      <div className="min-w-0">
        <div className="label-caps">Next domino</div>
        {m.nextDominoId ? (
          <button type="button" onClick={() => openNode(m.nextDominoId!)} className="mt-1 block max-w-full text-left">
            <span className={clsx('block font-bold leading-tight text-ink hover:text-accent', emphasized ? 'text-xl' : 'text-lg')}>{m.nextDominoLabel}</span>
            {m.nextDominoReason && <span className={clsx('mt-1 block text-sm leading-snug text-ink-muted', emphasized ? 'line-clamp-3' : 'line-clamp-2')}>{m.nextDominoReason}</span>}
          </button>
        ) : (
          <p className="mt-1 flex items-center gap-2 text-sm text-ink">
            <ShieldCheck className="h-4 w-4 text-ready" aria-hidden /> No domino in sight.
          </p>
        )}
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={go}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition',
              action.solid ? 'bg-accent text-[#042028] hover:brightness-110' : 'border border-line-strong text-ink hover:border-ink-muted hover:bg-white/[0.04]',
            )}
          >
            {action.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <RecordId id={m.recordId} />
        </div>
        <p className="sr-only">{pct(m.odds)} {meta.label}. {m.flaggedCount} flagged items.</p>
      </div>
    </motion.article>
  );
}

/** Linear odds bar with the same 50% and 82% marks on every mission, so rows compare at a glance. */
function ThresholdBar({ odds, color }: { odds: number; color: string }) {
  const width = Number.isFinite(odds) ? Math.max(0, Math.min(100, Math.round(odds * 100))) : 0;
  return (
    <div className="relative mt-3 h-2.5" role="img" aria-label={`Interval readiness ${pct(odds)}. Watch ${pct(getBands().yellow)}, ready ${pct(getBands().green)}.`}>
      <div className="absolute inset-0 rounded-full bg-white/[0.08]" />
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${width}%`, background: color }} />
      <span className="absolute -top-1 bottom-[-4px] w-px bg-white/55" style={{ left: `${getBands().yellow*100}%` }} />
      <span className="absolute -top-1 bottom-[-4px] w-px bg-white/70" style={{ left: `${getBands().green*100}%` }} />
    </div>
  );
}
