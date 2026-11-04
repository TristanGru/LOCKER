import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { NodeChange } from '../api/types';

export type PanelTarget = { kind: 'node'; id: string } | { kind: 'record'; id: string };

export interface Cascade {
  changes: NodeChange[];
  at: number;
  source: string;
}

interface StoreValue {
  /** Bumped after any mutation; data hooks refetch when it changes. */
  version: number;
  bump: () => void;
  stopped: boolean;
  setStopped: (v: boolean) => void;
  /** Top of the detail-panel history (null = closed). */
  panel: PanelTarget | null;
  canGoBack: boolean;
  openNode: (id: string) => void;
  openRecord: (id: string) => void;
  backPanel: () => void;
  closePanel: () => void;
  focus: string | 'all';
  setFocus: (f: string | 'all') => void;
  cascade: Cascade | null;
  setCascade: (c: Cascade | null) => void;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [stopped, setStopped] = useState(false);
  // ?open=<nodeId> opens that item's detail panel on load (handy for demos and links).
  const [stack, setStack] = useState<PanelTarget[]>(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    return id ? [{ kind: 'node', id }] : [];
  });
  const [focus, setFocus] = useState<string | 'all'>('M1');
  const [cascade, setCascade] = useState<Cascade | null>(null);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const push = useCallback((t: PanelTarget) => {
    setStack((s) => {
      const top = s[s.length - 1];
      if (top && top.kind === t.kind && top.id === t.id) return s;
      return [...s.slice(-12), t];
    });
  }, []);
  const openNode = useCallback((id: string) => push({ kind: 'node', id }), [push]);
  const openRecord = useCallback((id: string) => push({ kind: 'record', id }), [push]);
  const backPanel = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const closePanel = useCallback(() => setStack([]), []);

  const panel = stack[stack.length - 1] ?? null;
  const canGoBack = stack.length > 1;

  const value = useMemo<StoreValue>(
    () => ({ version, bump, stopped, setStopped, panel, canGoBack, openNode, openRecord, backPanel, closePanel, focus, setFocus, cascade, setCascade }),
    [version, bump, stopped, panel, canGoBack, openNode, openRecord, backPanel, closePanel, focus, cascade],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}
