import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo, useRef } from 'react';
import type { GraphPayload } from '../../api/types';
import type { Cascade } from '../../state/store';
import { STATUS } from '../../theme/status';
import { NodeCard, type CardNode } from './NodeCard';
import { SummaryCard, type SummaryNode } from './SummaryCard';
import { filterView, type FilterKey } from './filters';
import { chainOf, condense, layoutGraph, type LayoutItem } from './layout';

const nodeTypes: NodeTypes = { card: NodeCard, summary: SummaryCard };
const CASCADE_STEP = 0.55; // seconds between domino "rows"
const CASCADE_WINDOW_MS = 6000;
const NO_FILTERS: Set<FilterKey> = new Set();

export function DominoGraph({
  graph,
  showAll,
  selectedId,
  onSelect,
  onClear,
  onExpand,
  cascade,
  filters = NO_FILTERS,
}: {
  graph: GraphPayload;
  showAll: boolean;
  /** Active legend filters; empty = no filter. Filtering always works from the full graph (Ready items unfold). */
  filters?: Set<FilterKey>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  onExpand: () => void;
  cascade: Cascade | null;
}) {
  const rf = useReactFlow();

  const view = useMemo(() => {
    if (filters.size) return filterView(graph.nodes, graph.edges, filters);
    const v = showAll ? { nodes: graph.nodes, edges: graph.edges, summaries: [] } : condense(graph.nodes, graph.edges);
    return { ...v, context: new Set<string>() };
  }, [graph.nodes, graph.edges, showAll, filters]);

  const layoutEdges = useMemo(
    () => [
      ...view.edges.map((e) => ({ source: e.source, target: e.target })),
      ...view.summaries.map((s) => ({ source: s.parentId, target: s.id })),
    ],
    [view],
  );

  const positions = useMemo(() => {
    const items: LayoutItem[] = [
      ...view.nodes.map((n) => ({ id: n.id, kind: n.kind, status: n.status })),
      ...view.summaries.map((s) => ({ id: s.id, kind: s.kind, status: 'ready' as const })),
    ];
    return layoutGraph(items, layoutEdges);
  }, [view, layoutEdges]);

  const chain = useMemo(() => (selectedId ? chainOf(selectedId, layoutEdges) : null), [selectedId, layoutEdges]);
  const missionCodes = useMemo(() => Object.fromEntries(graph.missions.map((m) => [m.id, m.code])), [graph.missions]);
  const daysOut = useMemo(() => Object.fromEntries(graph.missions.map((m) => [m.id, m.daysOut])), [graph.missions]);

  // When an event just arrived, every card waits for its column's turn so the change
  // ripples part/sailor -> equipment -> mission like falling dominoes (odds included,
  // even where the status label does not change).
  const delays = useMemo(() => {
    const d = new Map<string, number>();
    if (cascade && Date.now() - cascade.at < CASCADE_WINDOW_MS) {
      const depth = { part: 0, person: 0, equipment: 1, mission: 2 } as const;
      for (const n of graph.nodes) d.set(n.id, 0.35 + depth[n.kind] * CASCADE_STEP);
    }
    return d;
  }, [cascade, graph.nodes]);

  const nodes: Node[] = useMemo(() => {
    const cards: CardNode[] = view.nodes.map((n) => ({
      id: n.id,
      type: 'card' as const,
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      draggable: false,
      data: {
        node: n,
        selected: n.id === selectedId,
        dimmed: Boolean(chain && !chain.has(n.id)),
        context: view.context.has(n.id),
        delay: delays.get(n.id) ?? 0,
        missionCodes,
        daysOut: n.kind === 'mission' ? daysOut[n.id] : undefined,
      },
    }));
    const sums: SummaryNode[] = view.summaries.map((s) => ({
      id: s.id,
      type: 'summary' as const,
      position: positions.get(s.id) ?? { x: 0, y: 0 },
      draggable: false,
      data: { labels: s.labels, noun: s.noun, size: s.kind, dimmed: Boolean(chain && !chain.has(s.id)) },
    }));
    return [...cards, ...sums];
  }, [view, positions, selectedId, chain, delays, missionCodes, daysOut]);

  const statusOf = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n.status])), [graph.nodes]);

  const edges: Edge[] = useMemo(() => {
    const real: Edge[] = view.edges.map((e) => {
      const target = statusOf.get(e.target) ?? 'ready';
      const inChain = chain ? chain.has(e.source) && chain.has(e.target) : false;
      const color = inChain ? 'rgb(var(--accent))' : e.critical ? STATUS[target].hex : 'rgba(140,180,220,0.3)';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'default',
        animated: e.critical && target === 'risk',
        focusable: false,
        style: {
          stroke: color,
          strokeWidth: inChain || (e.critical && target === 'risk') ? 2.8 : e.critical ? 2.2 : 1.5,
          opacity: chain && !inChain ? 0.15 : 1,
          transition: 'stroke 0.5s, opacity 0.3s',
        },
      };
    });
    const folded: Edge[] = view.summaries.map((s) => ({
      id: `${s.parentId}->${s.id}`,
      source: s.parentId,
      target: s.id,
      type: 'default',
      focusable: false,
      style: { stroke: 'rgba(52,211,153,0.35)', strokeWidth: 1.5, strokeDasharray: '5 5', opacity: chain && !chain.has(s.id) ? 0.15 : 1 },
    }));
    return [...real, ...folded];
  }, [view, statusOf, chain]);

  // Keep the selected card visible beside the detail panel (which covers the right side).
  useEffect(() => {
    if (!selectedId) return;
    const t = setTimeout(() => {
      const n = rf.getNode(selectedId);
      if (!n) return;
      const w = n.measured?.width ?? 300;
      const h = n.measured?.height ?? 150;
      const { zoom } = rf.getViewport();
      const panelPx = Math.min(32 * parseFloat(getComputedStyle(document.documentElement).fontSize), window.innerWidth * 0.92);
      rf.setCenter(n.position.x + w / 2 + panelPx / 2 / zoom, n.position.y + h / 2, { zoom, duration: 500 });
    }, 80);
    return () => clearTimeout(t);
  }, [selectedId, rf]);

  // Re-fit when the focus, view mode or set of nodes changes (not on every status change).
  const idsKey = `${graph.focus}|${showAll}|${[...filters].join('+')}|${nodes.map((n) => n.id).join(',')}`;
  const lastKey = useRef('');
  useEffect(() => {
    if (lastKey.current === idsKey) return;
    const first = lastKey.current === '';
    lastKey.current = idsKey;
    const t = setTimeout(() => rf.fitView({ padding: 0.12, maxZoom: 1.05, duration: first ? 0 : 650 }), 60);
    return () => clearTimeout(t);
  }, [idsKey, rf]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      colorMode="dark"
      minZoom={0.15}
      maxZoom={1.6}
      fitView
      fitViewOptions={{ padding: 0.12, maxZoom: 1.05 }}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      onNodeClick={(_, n) => (n.type === 'summary' ? onExpand() : onSelect(n.id))}
      onPaneClick={onClear}
      proOptions={{ hideAttribution: true }}
      className="locker-flow"
    >
      <Background variant={BackgroundVariant.Dots} gap={28} size={1.2} color="rgba(140,180,220,0.18)" />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}
