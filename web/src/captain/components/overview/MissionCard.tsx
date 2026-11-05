import { motion } from 'framer-motion';
import { Anchor, ArrowRight, Building2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Mission, Status } from '../../api/types';
import clsx from '../../lib/clsx';
import { useStore } from '../../state/store';
import { STATUS, pct, getBands } from '../../theme/status';
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
export function MissionRow({ mission: m, index }: { mission: Mission; index: number }) {
  const meta = STATUS[m.status];
  const navigate = useNavigate();
  const { ship, changeShip, setFocus, openNode } = useStore();
  const date = new Date(m.date);
  const delta = m.baselineDelta;
  const action = ACTION[m.status];
  const emphasized = m.status === 'risk';
  const when = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  // The other screens follow the selected unit, so opening another unit's event selects that unit first.
  const select = () => { if (m.unitId !== ship) changeShip(m.unitId); };
  const go = () => {
    select();
    setFocus(m.id);
    navigate(action.to);
  };
  const UnitIcon = m.unitKind === 'installation' ? Building2 : Anchor;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={clsx(
        'grid items-center gap-x-8 gap-y-4 rounded-2xl border bg-abyss-800 px-6',
        emphasized ? 'border-risk/45 py-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)_minmax(0,1fr)]' : 'border-line py-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1fr)]',
      )}
      style={{ boxShadow: `inset 4px 0 0 0 ${meta.hex}` }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge status={m.status} size={emphasized ? 'md' : 'sm'} />
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
            <UnitIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{m.unitName}</span>
          </span>
        </div>
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
          <span className="text-sm text-ink-muted">across the interval</span>
        </div>
        <ThresholdBar odds={m.odds} color={meta.hex} />
        <p className="mt-2 text-sm text-ink-muted">
          At start <span className="num font-semibold text-ink">{pct(m.oddsAtStart)}</span>
          {delta != null && (
            <>
              <span className="mx-1.5 text-ink-dim">·</span>
              <span className={clsx('num font-bold', delta < 0 ? 'text-risk' : delta > 0 ? 'text-ready' : 'text-ink-muted')}>
                {delta > 0 ? '+' : ''}
                {delta} pts vs baseline
              </span>
            </>
          )}
        </p>
      </div>

      <div className="min-w-0">
        <div className="label-caps">Next domino</div>
        {m.nextDominoId ? (
          <button type="button" onClick={() => { select(); openNode(m.nextDominoId!); }} className="mt-1 block max-w-full text-left">
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
              'inline-flex items-center gap-1.5 rounded-sm px-4 py-2 text-sm font-bold transition',
              action.solid ? 'bg-accent text-[color:var(--on-accent)] hover:brightness-110' : 'border border-line-strong text-ink hover:border-ink-muted hover:bg-ink/[0.06]',
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
      <div className="absolute inset-0 rounded-full bg-ink/10" />
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${width}%`, background: color }} />
      <span className="absolute -top-1 bottom-[-4px] w-px bg-ink/60" style={{ left: `${getBands().yellow*100}%` }} />
      <span className="absolute -top-1 bottom-[-4px] w-px bg-ink/70" style={{ left: `${getBands().green*100}%` }} />
    </div>
  );
}
