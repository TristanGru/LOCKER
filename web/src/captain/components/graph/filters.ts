import type { GraphEdge, GraphNode } from '../../api/types';

export type FilterKey = 'risk' | 'watch' | 'ready' | 'stale' | 'disagree' | 'domino';

export const FILTER_KEYS: FilterKey[] = ['risk', 'watch', 'ready', 'stale', 'disagree', 'domino'];

export const FILTER_LABEL: Record<FilterKey, string> = {
  risk: 'At risk',
  watch: 'Watch',
  ready: 'Ready',
  stale: 'Stale data',
  disagree: 'Sources disagree',
  domino: 'Next domino',
};

/** Does a card match one filter? Cards carry everything needed; no backend call. */
export function matches(n: GraphNode, k: FilterKey): boolean {
  switch (k) {
    case 'risk':
    case 'watch':
    case 'ready':
      return n.status === k;
    case 'stale':
      return n.stale;
    case 'disagree':
      return n.contradictionCount > 0;
    case 'domino':
      return n.nextDominoFor.length > 0;
  }
}

export function countMatches(nodes: GraphNode[]): Record<FilterKey, number> {
  const out = { risk: 0, watch: 0, ready: 0, stale: 0, disagree: 0, domino: 0 } as Record<FilterKey, number>;
  for (const n of nodes) for (const k of FILTER_KEYS) if (matches(n, k)) out[k]++;
  return out;
}

/**
 * Filtered view: cards matching ANY active filter, plus the chain that connects each of them up to the
 * mission(s) it affects (so no match floats on its own). Chain cards that don't match are returned as
 * `context` and drawn faded. Everything else is hidden and the graph is laid out again.
 */
export function filterView(nodes: GraphNode[], edges: GraphEdge[], active: Set<FilterKey>) {
  const hit = new Set(nodes.filter((n) => [...active].some((k) => matches(n, k))).map((n) => n.id));
  const parents = new Map<string, string[]>();
  for (const e of edges) parents.set(e.target, [...(parents.get(e.target) ?? []), e.source]);
  const keep = new Set(hit);
  const stack = [...hit];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const p of parents.get(cur) ?? []) {
      if (!keep.has(p)) {
        keep.add(p);
        stack.push(p);
      }
    }
  }
  const context = new Set([...keep].filter((id) => !hit.has(id)));
  return {
    nodes: nodes.filter((n) => keep.has(n.id)),
    edges: edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    summaries: [],
    context,
    matched: hit.size,
  };
}
