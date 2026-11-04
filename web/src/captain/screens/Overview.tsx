import { motion } from 'framer-motion';
import { Flag } from 'lucide-react';
import { api } from '../api/api';
import type { Mission, Status } from '../api/types';
import { MissionRow } from '../components/overview/MissionCard';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import clsx from '../lib/clsx';
import { useApi } from '../state/useApi';
import { STATUS, STATUS_ORDER, pct, getBands } from '../theme/status';

const RANK: Record<Status, number> = { unknown: -1, risk: 0, watch: 1, ready: 2 };

export function Overview() {
  const { data, error, loading, reload } = useApi(() => api.getMissions());
  const missions = data ? [...data.missions].sort((a, b) => RANK[a.status] - RANK[b.status] || a.daysOut - b.daysOut) : [];
  const counts = STATUS_ORDER.map((s) => [s, missions.filter((m) => m.status === s).length] as [Status, number]);
  const lead = missions[0];

  return (
    <div className="mx-auto max-w-[92rem] space-y-5 px-8 pb-10 pt-6">
      <div>
        <p className="label-caps">Mission overview · next 30 days</p>
        {lead ? (
          <Headline mission={lead} />
        ) : (
          <h1 className="mt-2 text-[2rem] font-extrabold leading-tight text-ink">{loading ? 'Loading the readiness picture…' : 'Mission Overview'}</h1>
        )}
        {data && missions.length > 0 && (
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
              <span className="inline-flex items-center gap-2">
                <i className="h-3.5 w-px bg-white/70" aria-hidden /> {pct(getBands().yellow)} watch
              </span>
              <span className="inline-flex items-center gap-2">
                <i className="h-3.5 w-px bg-white/80" aria-hidden /> {pct(getBands().green)} ready
              </span>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-line bg-[#0c1624] p-6">
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
          No missions are on the schedule for the next 30 days.
        </EmptyState>
      )}

      {data && missions.length > 0 && (
        <div className="space-y-4">
          {missions.map((m, i) => (
            <MissionRow key={m.id} mission={m} history={data.history[m.id] ?? []} index={i} />
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
    <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 max-w-[52rem] text-[2.15rem] font-extrabold leading-[1.15] tracking-tight text-ink">
      {m.status === 'risk' && (
        <>
          <span style={{ color: meta.hex }}>{m.code}</span> needs action: {odds} odds, {m.daysOut} days out.{' '}
          <span className="underline decoration-risk/80 decoration-2 underline-offset-[5px]">Fix the {domino} first.</span>
        </>
      )}
      {m.status === 'watch' && (
        <>
          <span style={{ color: meta.hex }}>{m.code}</span> is on watch: {odds} odds, {m.daysOut} days out. {domino} is next.
        </>
      )}
      {m.status === 'ready' && (
        <>
          Every mission is ready. <span className="text-ready">{m.code}</span> is closest, at {odds}, {m.daysOut} days out.
        </>
      )}
    </motion.h1>
  );
}
