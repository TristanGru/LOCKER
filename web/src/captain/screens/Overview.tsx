import { motion } from 'framer-motion';
import { Anchor, Building2, Flag } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/api';
import type { Mission, Status } from '../api/types';
import { MissionRow } from '../components/overview/MissionCard';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import { StatusBadge } from '../components/ui/StatusBadge';
import clsx from '../lib/clsx';
import { useApi } from '../state/useApi';
import { STATUS, STATUS_ORDER, pct, getBands } from '../theme/status';

const RANK: Record<Status, number> = { unknown: -1, risk: 0, watch: 1, ready: 2 };
type Scope = 'all' | 'ship' | 'installation';
const SCOPES: { id: Scope; label: string }[] = [{ id: 'all', label: 'All units' }, { id: 'ship', label: 'Ships' }, { id: 'installation', label: 'Shore' }];

/** Every ship and installation event in one ranked list, so a shore shortfall sits next to the ship event it holds up. */
export function Overview() {
  const { data, error, loading, reload } = useApi(() => api.getFleetMissions());
  const [scope, setScope] = useState<Scope>('all');
  const all = data ? [...data].sort((a, b) => RANK[a.status] - RANK[b.status] || a.daysOut - b.daysOut) : [];
  const missions = all.filter((m) => scope === 'all' || m.unitKind === scope);
  const counts = STATUS_ORDER.map((s) => [s, missions.filter((m) => m.status === s).length] as [Status, number]);
  const lead = missions[0];

  return (
    <div className="mx-auto max-w-[92rem] space-y-5 px-8 pb-10 pt-6">
      <div>
        <p className="label-caps">Mission overview · ships and shore · next 30 days</p>
        {lead ? (
          <Headline mission={lead} />
        ) : (
          <h1 className="mt-2 text-[2rem] font-extrabold leading-tight text-ink">{loading ? 'Loading the readiness picture…' : 'Mission Overview'}</h1>
        )}
        {data && all.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Mission status counts">
              {counts.map(([s, n]) => {
                const meta = STATUS[s];
                const Icon = meta.icon;
                return (
                  <span key={s} className={clsx('inline-flex items-center gap-1.5 text-sm font-bold', n ? meta.text : 'text-ink-muted')}>
                    <Icon className="h-4 w-4" aria-hidden />
                    <span className="num">{n}</span> {meta.label}
                  </span>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-muted">
              <div className="flex items-center gap-1 rounded-full border border-line p-0.5" role="group" aria-label="Show missions for">
                {SCOPES.map(({ id, label }) => {
                  const n = id === 'all' ? all.length : all.filter((m) => m.unitKind === id).length;
                  const Icon = id === 'installation' ? Building2 : id === 'ship' ? Anchor : null;
                  return (
                    <button key={id} type="button" aria-pressed={scope === id} onClick={() => setScope(id)}
                      className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition', scope === id ? 'bg-accent/15 text-ink' : 'text-ink-muted hover:text-ink')}>
                      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}{label} <span className="num text-xs text-ink-dim">{n}</span>
                    </button>
                  );
                })}
              </div>
              <span className="inline-flex items-center gap-2">
                <i className="h-3.5 w-px bg-ink/70" aria-hidden /> {pct(getBands().yellow)} watch
              </span>
              <span className="inline-flex items-center gap-2">
                <i className="h-3.5 w-px bg-ink/80" aria-hidden /> {pct(getBands().green)} ready
              </span>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-line bg-abyss-800 p-6">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      )}

      {error != null && !data && <ErrorState error={error} onRetry={reload} className="glass" />}

      {data && missions.length === 0 && (
        <EmptyState icon={Flag} title="No missions scheduled" className="glass">
          {all.length ? 'No events for these units in the next 30 days.' : 'No missions are on the schedule for the next 30 days.'}
        </EmptyState>
      )}

      {data && missions.length > 0 && (
        <div className="space-y-4">
          {missions.map((m, i) => (
            <MissionRow key={m.id} mission={m} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function Headline({ mission: m }: { mission: Mission }) {
  const meta = STATUS[m.status];
  const odds = pct(m.odds);
  const domino = m.nextDominoLabel ?? 'the next item';

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[2.15rem] font-extrabold leading-none tracking-tight" style={{ color: meta.hex }}>
          {m.code}
        </h1>
        <StatusBadge status={m.status} />
        <span className="text-sm font-semibold text-ink-muted">{m.unitName}</span>
      </div>
      <dl className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Interval</dt>
          <dd className="num text-2xl font-bold leading-none text-ink">{odds}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">At start</dt>
          <dd className="num text-2xl font-bold leading-none text-ink">{pct(m.oddsAtStart)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Days out</dt>
          <dd className="num text-2xl font-bold leading-none text-ink">{m.daysOut}</dd>
        </div>
      </dl>
      {m.status === 'risk' && (
        <p className="mt-3 max-w-[40rem] text-base font-semibold leading-snug text-ink">
          Fix the <span className="underline decoration-risk/80 decoration-2 underline-offset-[5px]">{domino}</span> first.
        </p>
      )}
      {m.status === 'watch' && (
        <p className="mt-3 max-w-[40rem] text-base font-semibold leading-snug text-ink">{domino} is next.</p>
      )}
      {m.status === 'ready' && (
        <p className="mt-3 max-w-[40rem] text-base font-semibold leading-snug text-ink">Closest mission. Every ship and shore event is ready.</p>
      )}
    </motion.div>
  );
}
