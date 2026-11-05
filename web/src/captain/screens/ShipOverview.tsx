import { motion } from 'framer-motion';
import { Anchor, Building2, Gauge, LayoutGrid, Ship } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { api, backend } from '../api/api';
import type { ShipPayload, Status } from '../api/types';
import { AttentionPanel } from '../components/ship/AttentionPanel';
import { SystemsTable } from '../components/ship/SystemsTable';
import { Panel } from '../components/ui/Panel';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import clsx from '../lib/clsx';
import { useStore } from '../state/store';
import { useApi } from '../state/useApi';
import { STATUS } from '../theme/status';
import { OverviewAssistantPanel } from '../components/overview-assistant/OverviewAssistantPanel';

// three.js is large: load the 3D view as its own chunk (bundled locally, works offline).
const ShipModel3D = lazy(() => import('../components/ship3d/ShipModel3D').then((m) => ({ default: m.ShipModel3D })));
const BaseModel3D = lazy(() => import('../components/base3d/BaseModel3D').then((m) => ({ default: m.BaseModel3D })));

type Filter = 'all' | Status;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'risk', label: 'At risk' },
  { id: 'watch', label: 'Watch' },
  { id: 'ready', label: 'Ready' },
];

const COUNT_CARDS: { status: Status; title: string; desc: string }[] = [
  { status: 'ready', title: 'Ready', desc: 'Meets the displayed model criterion' },
  { status: 'watch', title: 'On watch', desc: 'Degraded, or the records disagree' },
  { status: 'risk', title: 'At risk', desc: 'Below the assessed readiness threshold' },
];

type Domain = ShipPayload['kind'];

/** The last unit viewed on each tab, so moving between Ship and Shore returns to where you were. */
const lastUnit: Partial<Record<Domain, string>> = {};

export function ShipOverview({ domain }: { domain: Domain }) {
  // Refetches whenever a demo event, approval or reset bumps the store version.
  const { data: payload, error, loading: fetching, reload } = useApi(() => api.getShip());
  const { openNode, ship: selected, changeShip } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const ashore = domain === 'installation';

  // Each tab shows only its own kind of unit, so opening it selects a unit of that kind.
  useEffect(() => {
    let live = true;
    backend('state').then((state) => {
      if (!live) return;
      const units = state.ships.filter((unit: any) => (unit.kind || 'ship') === domain).map((unit: any) => unit.ship_id);
      if (units.includes(selected)) lastUnit[domain] = selected;
      else if (units.length) changeShip(units.includes(lastUnit[domain]) ? lastUnit[domain]! : units[0]);
    }).catch(() => { /* the data request below surfaces connection errors */ });
    return () => { live = false; };
  }, [domain, selected, changeShip]);

  const data = payload?.kind === domain ? payload : null;
  const loading = fetching || (payload != null && data == null);

  return (
    <div className="mx-auto max-w-[120rem] space-y-5 px-8 pb-10 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2.2rem] font-bold leading-tight tracking-tight">{ashore ? 'Installation Overview' : 'Ship Overview'}</h1>
          <p className="mt-1 flex items-center gap-2 text-lg text-ink-muted">
            {ashore ? <Building2 className="h-5 w-5" aria-hidden /> : <Anchor className="h-5 w-5" aria-hidden />}
            {data ? (
              <span>
                <span className="font-semibold text-ink">{data.name}</span> · {data.hull} · {data.className}
              </span>
            ) : (
              'Loading systems…'
            )}
          </p>
        </div>
      </div>

      {error != null && !payload && <ErrorState error={error} onRetry={reload} className="glass" />}
      {loading && <LoadingSkeleton />}
      {data && data.systems.length === 0 && (
        <EmptyState icon={Ship} title="No systems reported" className="glass">
          This unit has not reported any systems yet.
        </EmptyState>
      )}
      {data && <OverviewAssistantPanel filter={filter} domain={domain} />}
      {data && data.systems.length > 0 && <Body ship={data} filter={filter} setFilter={setFilter} onOpen={openNode} />}
    </div>
  );
}

function Body({ ship, filter, setFilter, onOpen }: { ship: ShipPayload; filter: Filter; setFilter: (f: Filter) => void; onOpen: (id: string) => void }) {
  const shown = useMemo(() => (filter === 'all' ? ship.systems : ship.systems.filter((s) => s.status === filter)), [ship.systems, filter]);
  const depts = ship.departments.filter((d) => shown.some((s) => s.department === d.id));
  const overallStatus: Status = ship.counts.risk ? 'risk' : ship.counts.watch ? 'watch' : 'ready';
  const ashore = ship.kind === 'installation';
  const grouping = ashore ? 'capability area' : 'department';

  return (
    <>
      {/* 1. summary row */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={clsx('glass relative overflow-hidden px-4 py-3', STATUS[overallStatus].border)}>
          <div className="label-caps flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5" aria-hidden /> System status summary
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="num text-[2.15rem] font-bold leading-none text-ink">
              {Math.round(ship.overall.readyShare * 100)}
              <span className="opacity-60">%</span>
            </span>
            <span className="text-sm text-ink-muted">
              <span className="num font-semibold text-ink">{ship.overall.ready}</span> of <span className="num">{ship.overall.total}</span> systems Ready
            </span>
          </div>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
            {(['ready', 'watch', 'risk'] as const).map((s) =>
              ship.counts[s] ? <motion.div key={s} initial={false} animate={{ width: `${(ship.counts[s] / ship.overall.total) * 100}%` }} transition={{ duration: 0.6 }} style={{ background: STATUS[s].hex }} /> : null,
            )}
          </div>
        </motion.div>

        {COUNT_CARDS.map((c, i) => {
          const meta = STATUS[c.status];
          const Icon = meta.icon;
          const n = ship.counts[c.status];
          return (
            <motion.button
              key={c.status}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * (i + 1) }}
              onClick={() => setFilter(filter === c.status ? 'all' : c.status)}
              aria-pressed={filter === c.status}
              className={clsx('glass flex items-center gap-3 px-4 py-3 text-left transition hover:brightness-110', n ? meta.border : 'opacity-70', filter === c.status && 'shadow-focus')}
            >
              <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-full border-2', meta.bg)} style={{ borderColor: meta.hex }}>
                <Icon className={clsx('h-4 w-4', meta.text)} strokeWidth={2.6} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className={clsx('text-sm font-bold', meta.text)}>{c.title}</span>
                  <span className="num text-[1.65rem] font-bold leading-none text-ink">{n}</span>
                  <span className="text-xs text-ink-muted">{n === 1 ? 'system' : 'systems'}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-dim">{c.desc}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <Panel
        title={ashore ? 'Base layout · 3D model' : 'Ship profile · 3D model'}
        icon={ashore ? <Building2 className="h-4 w-4" /> : <Ship className="h-4 w-4" />}
        actions={<span className="text-xs text-ink-muted">{ship.hullType} · procedural model, approximate</span>}
        bodyClassName="!p-0"
      >
        <Suspense fallback={<Skeleton className="m-5 h-[34rem]" />}>
          {ashore ? <BaseModel3D unit={ship} onOpen={onOpen} /> : <ShipModel3D ship={ship} onOpen={onOpen} />}
        </Suspense>
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="min-w-0">
          <section aria-label={`All systems by ${grouping}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="label-caps flex items-center gap-2 !text-ink-muted">
                <LayoutGrid className="h-4 w-4 text-accent" aria-hidden /> All systems by {grouping}
              </h2>
              <div role="tablist" aria-label="Filter systems" className="flex gap-1 rounded-xl border border-line bg-abyss-900/70 p-1">
                {FILTERS.map((f) => {
                  const n = f.id === 'all' ? ship.systems.length : ship.counts[f.id];
                  const Icon = f.id === 'all' ? null : STATUS[f.id].icon;
                  return (
                    <button
                      key={f.id}
                      role="tab"
                      aria-selected={filter === f.id}
                      onClick={() => setFilter(f.id)}
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition',
                        filter === f.id ? 'bg-abyss-800 text-ink shadow-[inset_0_-3px_0_rgb(var(--accent))]' : 'text-ink-muted hover:text-ink',
                      )}
                    >
                      {Icon && <Icon className={clsx('h-4 w-4', f.id !== 'all' && STATUS[f.id].text)} aria-hidden />}
                      {f.label}
                      <span className="num rounded-sm bg-ink/[0.08] px-1.5 text-xs">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {depts.length === 0 ? (
              <EmptyState icon={LayoutGrid} title={`No systems are ${FILTERS.find((f) => f.id === filter)!.label.toLowerCase()}`} className="glass">
                Pick another filter to see the rest of this unit.
              </EmptyState>
            ) : (
              <SystemsTable departments={depts} systems={shown} onOpen={onOpen} />
            )}
          </section>
        </div>

        <AttentionPanel ship={ship} />
      </div>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-[26rem]" />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Skeleton className="h-[20rem]" />
        <Skeleton className="h-[20rem]" />
      </div>
    </div>
  );
}
