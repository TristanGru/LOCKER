import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { DemoEvent, NodeChange } from '../../api/types';
import clsx from '../../lib/clsx';
import { useStore } from '../../state/store';
import { STATUS, pct } from '../../theme/status';
import { KIND_META } from '../graph/kinds';
import { RecordId } from '../ui/RecordId';
import { EVENT_META } from './eventMeta';

/** One incoming event: what arrived, where it came from, and what it knocked over. */
export function EventCard({ event, latest }: { event: DemoEvent; latest: boolean }) {
  const meta = EVENT_META[event.type];
  const Icon = meta.icon;
  const worst = (event.changes ?? []).some((c) => c.to === 'risk') ? 'risk' : (event.changes ?? []).length ? 'watch' : 'ready';
  const tone = STATUS[worst];
  const moved = (event.missionDeltas ?? []).filter((d) => Math.abs(d.after - d.before) >= 0.005);
  const time = event.arrivedAt ? new Date(event.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: -40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={clsx(
        'relative overflow-hidden rounded-2xl border bg-abyss-850/80 p-5 backdrop-blur-md',
        latest ? clsx(tone.border, 'shadow-glass') : 'border-line opacity-80',
      )}
    >
      {latest && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.6 }}
          style={{ background: `radial-gradient(600px 160px at 0% 0%, ${tone.hex}55, transparent 70%)` }}
        />
      )}
      <div className="relative flex items-start gap-4">
        <div className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-xl border', tone.border, tone.bg)}>
          <Icon className={clsx('h-6 w-6', tone.text)} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="num rounded bg-ink/[0.08] px-1.5 py-0.5 font-bold text-ink-muted">#{event.seq}</span>
            <span className="font-semibold uppercase tracking-[0.14em] text-ink-dim">{meta.source}</span>
            {latest && <span className="rounded-sm bg-accent/15 px-2 py-0.5 font-bold uppercase tracking-wider text-accent">Just in</span>}
            <span className="num ml-auto text-ink-dim">{time}</span>
          </div>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">{event.title}</h3>
          <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-muted">{event.summary}</p>

          {moved.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {moved.map((d) => {
                const after = STATUS[d.statusAfter];
                const AfterIcon = after.icon;
                const down = d.after < d.before;
                return (
                  <span key={d.missionId} className={clsx('inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm', after.border, after.bg)}>
                    <AfterIcon className={clsx('h-4 w-4', after.text)} aria-label={after.label} />
                    <span className="font-semibold text-ink">{d.code}</span>
                    <span className="num text-ink-muted">{pct(d.before)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-ink-dim" aria-hidden />
                    <span className={clsx('num font-bold', down ? 'text-risk' : 'text-ready')}>{pct(d.after)}</span>
                  </span>
                );
              })}
            </div>
          )}

          {(event.changes ?? []).length > 0 && <ChangeChain changes={event.changes!} />}

          <div className="mt-3">
            <RecordId id={event.recordId} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/** The cascade, in order: parts/people first, then equipment, then missions. */
function ChangeChain({ changes }: { changes: NodeChange[] }) {
  const { openNode } = useStore();
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="What changed">
      {changes.map((c, i) => {
        const to = STATUS[c.to];
        const ToIcon = to.icon;
        const KindIcon = KIND_META[c.kind].icon;
        return (
          <li key={c.nodeId} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-dim">›</span>}
            <button
              onClick={() => openNode(c.nodeId)}
              className={clsx('inline-flex items-center gap-1.5 rounded-md border bg-abyss-900/70 px-2 py-1 text-xs transition hover:bg-ink/[0.08]', to.border)}
              title={`${c.label}: ${STATUS[c.from].label} -> ${to.label}`}
            >
              <KindIcon className="h-3.5 w-3.5 text-ink-dim" aria-hidden />
              <span className="font-medium text-ink">{c.label}</span>
              <ToIcon className={clsx('h-3.5 w-3.5', to.text)} aria-hidden />
              <span className={clsx('font-semibold', to.text)}>{to.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
