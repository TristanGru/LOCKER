import dagre from '@dagrejs/dagre';
import type { GraphEdge, GraphNode, NodeKind, Status } from '../../api/types';

export type LayoutKind = NodeKind | 'summary' | 'fold';

export const NODE_SIZE: Record<LayoutKind, { w: number; h: number }> = {
  mission: { w: 320, h: 172 },
  equipment: { w: 300, h: 164 },
  part: { w: 300, h: 164 },
  person: { w: 270, h: 104 },
  summary: { w: 300, h: 128 }, // healthy equipment folded under a mission
  fold: { w: 270, h: 92 }, // healthy parts / sailors folded under equipment
};

const KIND_ORDER: Record<LayoutKind, number> = { mission: 0, equipment: 1, summary: 1.5, part: 2, person: 3, fold: 4 };
const STATUS_ORDER: Record<Status, number> = { unknown: -1, risk: 0, watch: 1, ready: 2 };

export interface LayoutItem {
  id: string;
  kind: LayoutKind;
  status: Status;
}

/** Left-to-right layout: missions -> equipment -> parts & people. */
export function layoutGraph(items: LayoutItem[], edges: { source: string; target: string }[]): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 22, ranksep: 120, marginx: 30, marginy: 30, ranker: 'network-simplex' });
  g.setDefaultEdgeLabel(() => ({}));

  // Stable insertion order: flagged items first so they sit near the top.
  const sorted = [...items].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.id.localeCompare(b.id),
  );
  for (const n of sorted) {
    const { w, h } = NODE_SIZE[n.kind];
    g.setNode(n.id, { width: w, height: h });
  }
  const ids = new Set(items.map((n) => n.id));
  for (const e of edges) if (ids.has(e.source) && ids.has(e.target)) g.setEdge(e.source, e.target);

  dagre.layout(g);

  const pos = new Map<string, { x: number; y: number }>();
  for (const n of items) {
    const p = g.node(n.id);
    const { w, h } = NODE_SIZE[n.kind];
    pos.set(n.id, { x: p.x - w / 2, y: p.y - h / 2 });
  }
  return pos;
}

/** All nodes connected to `id` upstream and downstream (its domino chain). */
export function chainOf(id: string, edges: { source: string; target: string }[]): Set<string> {
  const out = new Set<string>([id]);
  const walk = (start: string, dir: 'up' | 'down') => {
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const e of edges) {
        const next = dir === 'down' ? (e.source === cur ? e.target : null) : e.target === cur ? e.source : null;
        if (next && !out.has(next)) {
          out.add(next);
          stack.push(next);
        }
      }
    }
  };
  walk(id, 'down');
  walk(id, 'up');
  return out;
}

export interface Summary {
  id: string;
  parentId: string;
  kind: 'summary' | 'fold';
  noun: string;
  labels: string[];
}

const isFlagged = (n: GraphNode) => n.status !== 'ready' || n.nextDominoFor.length > 0 || n.contradictionCount > 0;

/**
 * Flagged view: keep missions and every flagged item with its parent chain.
 * Healthy equipment folds into one "N systems ready" card per mission, and the
 * healthy parts / sailors under a flagged item fold into one card per item.
 */
export function condense(nodes: GraphNode[], edges: GraphEdge[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const keepEquip = new Set(nodes.filter((n) => n.kind === 'equipment' && isFlagged(n)).map((n) => n.id));
  // A flagged part/sailor under healthy equipment still pulls its parent in.
  for (const e of edges) {
    const t = byId.get(e.target);
    const s = byId.get(e.source);
    if (t && s && s.kind === 'equipment' && t.kind !== 'equipment' && isFlagged(t)) keepEquip.add(s.id);
  }

  const keep = new Set<string>([...nodes.filter((n) => n.kind === 'mission').map((n) => n.id), ...keepEquip]);
  const folds = new Map<string, GraphNode[]>();
  for (const e of edges) {
    if (!keepEquip.has(e.source)) continue;
    const t = byId.get(e.target);
    if (!t) continue;
    if (isFlagged(t)) keep.add(t.id);
    else folds.set(e.source, [...(folds.get(e.source) ?? []), t]);
  }

  const summaries: Summary[] = [];
  for (const m of nodes.filter((n) => n.kind === 'mission')) {
    const folded = edges
      .filter((e) => e.source === m.id && !keepEquip.has(e.target))
      .map((e) => byId.get(e.target))
      .filter((n): n is GraphNode => Boolean(n));
    if (folded.length) {
      summaries.push({ id: `summary:${m.id}`, parentId: m.id, kind: 'summary', noun: folded.length === 1 ? 'system' : 'systems', labels: folded.map((n) => n.label) });
    }
  }
  for (const [parentId, kids] of folds) {
    // Don't fold a child that is also kept through another parent.
    const only = kids.filter((k) => !keep.has(k.id));
    if (!only.length) continue;
    const allPeople = only.every((k) => k.kind === 'person');
    const allParts = only.every((k) => k.kind === 'part');
    const one = only.length === 1;
    const noun = allPeople ? (one ? 'sailor' : 'sailors') : allParts ? (one ? 'part' : 'parts') : one ? 'item' : 'items';
    summaries.push({ id: `fold:${parentId}`, parentId, kind: 'fold', noun, labels: only.map((k) => k.label) });
  }

  return {
    nodes: nodes.filter((n) => keep.has(n.id)),
    edges: edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    summaries,
  };
}
