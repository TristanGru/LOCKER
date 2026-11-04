import { ReactFlowProvider } from '@xyflow/react';
import { Clock, Crosshair, Filter, GitCompareArrows, Layers, Network } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/api';
import { DominoGraph } from '../components/graph/DominoGraph';
import { TimelineStrip } from '../components/graph/TimelineStrip';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import { MissionTabs } from '../components/ui/MissionTabs';
import { StatusBadge } from '../components/ui/StatusBadge';
import clsx from '../lib/clsx';
import { useStore } from '../state/store';
import { useApi } from '../state/useApi';

export function Dominoes() {
  const { focus, setFocus, panel, openNode, closePanel, cascade } = useStore();
  const { data, error, loading, reload } = useApi(() => api.getGraph(focus), [focus]);
  // Mission list for the selector, independent of the focused graph.
  const { data: all } = useApi(() => api.getMissions());
  const missions = all?.missions ?? data?.missions ?? [];
  const selectedId = panel?.kind === 'node' ? panel.id : null;
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-bold leading-tight tracking-tight">Davy's Dominoes</h1>
          <p className="text-lg text-ink-muted">What each mission depends on, and which small problem tips the rest over.</p>
        </div>
        <MissionTabs missions={missions} value={focus} onChange={setFocus} allowAll />
      </div>

      {data && <TimelineStrip missions={missions.length ? missions : data.missions} nodes={data.nodes} focus={focus} onOpen={openNode} />}

      <div className="glass relative flex min-h-[28rem] flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <ViewToggle showAll={showAll} onChange={setShowAll} />
          <Legend />
        </div>
        <div className="relative min-h-0 flex-1">
        {loading && <Loading label="Tracing dependencies" className="h-full" />}
        {error != null && !data && <ErrorState error={error} onRetry={reload} className="h-full" />}
        {data && data.nodes.length === 0 && (
          <EmptyState icon={Network} title="Nothing to show" className="h-full">
            This mission has no linked equipment yet.
          </EmptyState>
        )}
        {data && data.nodes.length > 0 && (
          <ReactFlowProvider>
            <DominoGraph
              graph={data}
              showAll={showAll}
              selectedId={selectedId}
              onSelect={openNode}
              onClear={closePanel}
              onExpand={() => setShowAll(true)}
              cascade={cascade}
            />
          </ReactFlowProvider>
        )}
        </div>
      </div>
    </div>
  );
}

function ViewToggle({ showAll, onChange }: { showAll: boolean; onChange: (v: boolean) => void }) {
  const opts: { v: boolean; label: string; icon: typeof Filter }[] = [
    { v: false, label: 'Flagged chain', icon: Filter },
    { v: true, label: 'Every item', icon: Layers },
  ];
  return (
    <div role="radiogroup" aria-label="Graph view" className="flex gap-1 rounded-xl border border-line bg-abyss-900/85 p-1">
      {opts.map((o) => (
        <button
          key={o.label}
          role="radio"
          aria-checked={showAll === o.v}
          onClick={() => onChange(o.v)}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
            showAll === o.v ? 'bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(34,211,238,0.5)]' : 'text-ink-muted hover:text-ink',
          )}
        >
          <o.icon className="h-4 w-4" aria-hidden />
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status="risk" size="sm" />
      <StatusBadge status="watch" size="sm" />
      <StatusBadge status="ready" size="sm" />
      <span className="stale-stripes inline-flex items-center gap-1 rounded-full border border-stale/50 px-2 py-0.5 text-[0.7rem] font-semibold text-slate-200">
        <Clock className="h-3 w-3" aria-hidden /> Stale data
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-watch/50 bg-watch-soft px-2 py-0.5 text-[0.7rem] font-semibold text-watch">
        <GitCompareArrows className="h-3 w-3" aria-hidden /> Sources disagree
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-risk bg-[#2a0b12] px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-risk">
        <Crosshair className="h-3 w-3" aria-hidden /> Next domino
      </span>
      <span className="text-[0.72rem] text-ink-dim">Click a card for details</span>
    </div>
  );
}
