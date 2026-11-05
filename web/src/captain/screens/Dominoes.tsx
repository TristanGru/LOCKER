import { ReactFlowProvider } from '@xyflow/react';
import { Clock, Crosshair, Filter, GitCompareArrows, Layers, Network, SearchX, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/api';
import type { DaveyProposedLink, DaveyProposedNode } from '../api/types';
import { DominoGraph } from '../components/graph/DominoGraph';
import { TimelineStrip } from '../components/graph/TimelineStrip';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import { MissionTabs } from '../components/ui/MissionTabs';
import { FILTER_KEYS, FILTER_LABEL, countMatches, filterView, type FilterKey } from '../components/graph/filters';
import { STATUS } from '../theme/status';
import clsx from '../lib/clsx';
import { useStore } from '../state/store';
import { useDavey } from '../state/davey';
import { useApi } from '../state/useApi';

const NO_PROPOSED_NODES: DaveyProposedNode[] = [];
const NO_PROPOSED_LINKS: DaveyProposedLink[] = [];

export function Dominoes() {
  const { focus, setFocus, panel, openNode, closePanel, cascade } = useStore();
  const davey = useDavey();
  const { data, error, loading, reload } = useApi(() => api.getGraph(focus), [focus]);
  // Mission list for the selector, independent of the focused graph.
  const { data: all } = useApi(() => api.getMissions());
  const missions = all?.missions ?? data?.missions ?? [];
  const activeSuggestions = Boolean(davey.graph.answer && (focus === 'all' || focus === davey.graph.answer.event_id));
  const proposedNodes = activeSuggestions ? davey.graph.proposedNodes : NO_PROPOSED_NODES;
  const proposedLinks = activeSuggestions ? davey.graph.proposedLinks : NO_PROPOSED_LINKS;
  const selectedId = panel?.kind === 'node' ? panel.id : activeSuggestions ? davey.traceNodeId : null;
  const [showAll, setShowAll] = useState(false);
  useEffect(()=>{if(proposedNodes.length>0||proposedLinks.length>0)setShowAll(true);},[proposedNodes.length,proposedLinks.length]);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const counts = useMemo(() => countMatches(data?.nodes ?? []), [data?.nodes]);
  // Drop filters that no longer match anything (e.g. after switching mission) so the graph never goes blank silently.
  const active = useMemo(() => new Set([...filters].filter((k) => counts[k] > 0)), [filters, counts]);
  const shown = useMemo(() => (data && active.size ? filterView(data.nodes, data.edges, active) : null), [data, active]);
  const toggle = (k: FilterKey) =>
    setFilters((cur) => {
      const n = new Set(cur);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

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
          <FilterChips counts={counts} active={active} onToggle={toggle} />
        </div>
        {shown && data && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-abyss-800 px-4 py-2 text-sm">
            <span className="text-ink">
              Showing <b className="num">{shown.matched}</b> of <span className="num">{data.nodes.length}</span> items:{' '}
              <span className="font-semibold">{[...active].map((k) => FILTER_LABEL[k]).join(' or ')}</span>
            </span>
            {shown.context.size > 0 && <span className="text-ink-muted">Faded cards connect each match to the mission it affects.</span>}
            <button type="button" onClick={() => setFilters(new Set())} className="ml-auto inline-flex items-center gap-1 font-semibold text-accent hover:underline">
              <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
            </button>
          </div>
        )}
        <div className="relative min-h-0 flex-1">
        {loading && <Loading label="Tracing dependencies" className="h-full" />}
        {error != null && !data && <ErrorState error={error} onRetry={reload} className="h-full" />}
        {data && data.nodes.length === 0 && (
          <EmptyState icon={Network} title="Nothing to show" className="h-full">
            This mission has no linked equipment yet.
          </EmptyState>
        )}
        {shown && shown.nodes.length === 0 && (
          <EmptyState icon={SearchX} title="No items match these filters" className="h-full">
            Try fewer filters, or clear them to see the whole chain.
          </EmptyState>
        )}
        {data && data.nodes.length > 0 && !(shown && shown.nodes.length === 0) && (
          <ReactFlowProvider>
            <DominoGraph
              graph={data}
              showAll={showAll}
              selectedId={selectedId}
              onSelect={id=>{davey.closeDrawer();davey.clearTrace();openNode(id);}}
              onClear={()=>{closePanel();davey.clearTrace();davey.selectGraphSuggestion(null);}}
              onExpand={() => setShowAll(true)}
              cascade={cascade}
              proposedNodes={proposedNodes}
              proposedLinks={proposedLinks}
              reviewed={davey.graph.reviewed}
              onProposedSelect={davey.selectGraphSuggestion}
              filters={active}
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
            showAll === o.v ? 'bg-abyss-800 text-ink shadow-[inset_0_-3px_0_rgb(var(--accent))]' : 'text-ink-muted hover:text-ink',
          )}
        >
          <o.icon className="h-4 w-4" aria-hidden />
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The legend doubles as the filter: each chip shows how many items match and toggles them on and off. */
function FilterChips({ counts, active, onToggle }: { counts: Record<FilterKey, number>; active: Set<FilterKey>; onToggle: (k: FilterKey) => void }) {
  const look: Record<FilterKey, { icon: typeof Clock; cls: string }> = {
    risk: { icon: STATUS.risk.icon, cls: 'border-risk/70 text-risk' },
    watch: { icon: STATUS.watch.icon, cls: 'border-watch/70 text-watch' },
    ready: { icon: STATUS.ready.icon, cls: 'border-ready/70 text-ready' },
    stale: { icon: Clock, cls: 'stale-stripes border-stale/60 text-ink-muted' },
    disagree: { icon: GitCompareArrows, cls: 'border-watch/60 text-watch' },
    domino: { icon: Crosshair, cls: 'border-risk text-risk' },
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter the graph">
      <span className="mr-1 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-dim">Filter</span>
      {FILTER_KEYS.map((k) => {
        const on = active.has(k);
        const Icon = look[k].icon;
        const none = counts[k] === 0;
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            disabled={none}
            onClick={() => onToggle(k)}
            title={none ? `No ${FILTER_LABEL[k].toLowerCase()} items in this view` : on ? `Stop filtering by ${FILTER_LABEL[k].toLowerCase()}` : `Show only ${FILTER_LABEL[k].toLowerCase()} items`}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[0.74rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35',
              look[k].cls,
              on ? 'bg-abyss-800 shadow-[inset_0_-3px_0_rgb(var(--accent))] ring-1 ring-inset ring-current' : 'bg-abyss-900 hover:bg-abyss-800',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {FILTER_LABEL[k]}
            <span className="num rounded-sm bg-ink/[0.07] px-1 text-[0.7rem] text-ink">{counts[k]}</span>
          </button>
        );
      })}
    </div>
  );
}
