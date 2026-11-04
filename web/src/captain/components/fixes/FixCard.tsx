import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, CircleUserRound, Gauge, SlidersHorizontal, Timer, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Fix } from '../../api/types';
import clsx from '../../lib/clsx';
import { useStore } from '../../state/store';
import { STATUS, oddsStatus, pct } from '../../theme/status';
import { RecordId } from '../ui/RecordId';

type Mode = 'idle' | 'approve' | 'reject' | 'modify';

export function FixCard({
  fix,
  busy,
  disabledReason,
  onApprove,
  onReject,
  onModify,
  index,
}: {
  fix: Fix;
  busy: boolean;
  disabledReason: string | null;
  onApprove: () => void;
  onReject: (note: string) => void;
  onModify: (value: number) => void;
  index: number;
}) {
  const { openNode } = useStore();
  const [mode, setMode] = useState<Mode>('idle');
  const [note, setNote] = useState('');
  const [value, setValue] = useState(fix.param?.value ?? 0);
  useEffect(() => setValue(fix.param?.value ?? 0), [fix.param?.value]);

  const after = STATUS[oddsStatus(fix.oddsAfter)];
  const before = STATUS[oddsStatus(fix.oddsBefore)];
  const gain = Math.round((fix.oddsAfter - fix.oddsBefore) * 100);
  const disabled = busy || Boolean(disabledReason);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.25 } }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 240, damping: 28 }}
      className={clsx('glass relative overflow-hidden p-5', fix.rank === 1 && 'border-accent/50')}
    >
      <div className="flex items-start gap-4">
        <div className={clsx('num grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-xl font-extrabold', fix.rank === 1 ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-ink-muted')}>
          #{fix.rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {fix.rank === 1 && <div className="label-caps !text-accent">Top recommendation</div>}
              <h3 className="text-xl font-semibold leading-snug text-ink">{fix.title}</h3>
            </div>
            <div className={clsx('num rounded-lg px-2.5 py-1 text-lg font-bold', gain > 0 ? 'bg-ready-soft text-ready' : 'bg-white/5 text-ink-muted')}>+{gain} pts</div>
          </div>
          <p className="mt-1 text-base text-ink">{fix.action}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{fix.rationale}</p>

          {/* before -> after bars */}
          <div className="mt-4 space-y-2" aria-label={`Odds ${pct(fix.oddsBefore)} to ${pct(fix.oddsAfter)}`}>
            <OddsBar label="Now" odds={fix.oddsBefore} color={before.hex} muted />
            <OddsBar label="After" odds={fix.oddsAfter} color={after.hex} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <CircleUserRound className="h-4 w-4" aria-hidden /> {fix.owner}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Timer className="h-4 w-4" aria-hidden /> Effort {fix.effort}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Gauge className="h-4 w-4" aria-hidden /> <span className="num">{pct(fix.confidence)}</span> assessed interval readiness after package
            </span>
            {fix.otherMissions.filter((o) => Math.abs(o.after - o.before) >= 0.005).map((o) => (
              <span key={o.missionId} className="num inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs">
                Also {o.code} {pct(o.before)} <ArrowRight className="h-3 w-3" aria-hidden /> {pct(o.after)}
              </span>
            ))}
          </div>

          {fix.externalApproval && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-watch/40 bg-[rgba(251,191,36,0.06)] px-3 py-1.5 text-sm text-watch">
              <AlertTriangle className="h-4 w-4" aria-hidden /> {fix.externalApproval}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {fix.targets.map((t) => (
              <button key={t} onClick={() => openNode(t)} className="rounded-md border border-line bg-abyss-900/60 px-2 py-0.5 font-mono text-xs text-ink-muted hover:border-line-strong hover:text-ink">
                {t}
              </button>
            ))}
            {fix.recordIds.map((r) => (
              <RecordId key={r} id={r} />
            ))}
          </div>

          {/* decision area */}
          <div className="mt-4 border-t border-line pt-4">
            <AnimatePresence mode="wait" initial={false}>
              {mode === 'idle' && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-2">
                  <button className="btn-ready px-5" disabled={disabled} onClick={() => setMode('approve')}>
                    <Check className="h-4 w-4" aria-hidden /> Approve
                  </button>
                  {fix.param && (
                    <button className="btn-ghost" disabled={disabled} onClick={() => setMode('modify')}>
                      <SlidersHorizontal className="h-4 w-4" aria-hidden /> Modify
                    </button>
                  )}
                  <button className="btn-ghost hover:!border-risk/60 hover:!text-risk" disabled={disabled} onClick={() => setMode('reject')}>
                    <X className="h-4 w-4" aria-hidden /> Reject
                  </button>
                  {disabledReason && <span className="text-sm font-semibold text-risk">{disabledReason}</span>}
                </motion.div>
              )}

              {mode === 'approve' && (
                <motion.div key="approve" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-ready/40 bg-ready-soft p-4">
                  <p className="text-base text-ink">
                    Approve <span className="font-semibold">{fix.title}</span>? The readiness plan updates to{' '}
                    <span className="num font-bold">{pct(fix.oddsAfter)}</span>. Ship records stay read-only, and the approval is logged.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button className="btn border-ready bg-ready px-5 text-abyss-950 hover:brightness-110" disabled={disabled} onClick={onApprove} autoFocus>
                      <Check className="h-4 w-4" aria-hidden /> Confirm approval
                    </button>
                    <button className="btn-ghost" onClick={() => setMode('idle')}>
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {mode === 'reject' && (
                <motion.div key="reject" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-risk/40 bg-risk-soft p-4">
                  <label className="block">
                    <span className="label-caps">Reason (optional, logged)</span>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onReject(note.trim())}
                      placeholder="e.g. Courier not available this week"
                      autoFocus
                      className="mt-2 w-full rounded-xl border border-line bg-abyss-950/60 px-4 py-2.5 text-base text-ink placeholder:text-ink-dim focus:border-accent/60 focus:outline-none"
                    />
                  </label>
                  <div className="mt-3 flex gap-2">
                    <button className="btn-risk px-5" disabled={disabled} onClick={() => onReject(note.trim())}>
                      <X className="h-4 w-4" aria-hidden /> Confirm rejection
                    </button>
                    <button className="btn-ghost" onClick={() => setMode('idle')}>
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {mode === 'modify' && fix.param && (
                <motion.div key="modify" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-accent/40 bg-accent/[0.06] p-4">
                  <label className="block">
                    <span className="flex items-baseline justify-between">
                      <span className="label-caps">{fix.param.label}</span>
                      <span className="num text-2xl font-bold text-accent">
                        {value} {fix.param.unit}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={fix.param.min}
                      max={fix.param.max}
                      step={fix.param.step}
                      value={value}
                      onChange={(e) => setValue(Number(e.target.value))}
                      className="mt-3 w-full accent-[#22d3ee]"
                    />
                    <span className="num flex justify-between text-xs text-ink-dim">
                      <span>
                        {fix.param.min} {fix.param.unit}
                      </span>
                      <span>
                        {fix.param.max} {fix.param.unit}
                      </span>
                    </span>
                  </label>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn-accent px-5"
                      disabled={disabled || value === fix.param.value}
                      onClick={() => {
                        onModify(value);
                        setMode('idle');
                      }}
                    >
                      <SlidersHorizontal className="h-4 w-4" aria-hidden /> Update projection
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setValue(fix.param!.value);
                        setMode('idle');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-ink-dim">Modifying only re-scores the fix. You still approve it separately.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function OddsBar({ label, odds, color, muted }: { label: string; odds: number; color: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-dim">{label}</span>
      <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${odds * 100}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: color, opacity: muted ? 0.45 : 1 }}
        />
        <div className="absolute inset-y-0 w-px bg-ready/80" style={{ left: '82%' }} />
        <div className="absolute inset-y-0 w-px bg-risk/80" style={{ left: '50%' }} />
      </div>
      <span className={clsx('num w-14 shrink-0 text-right text-lg font-bold', muted ? 'text-ink-muted' : 'text-ink')}>{pct(odds)}</span>
    </div>
  );
}
