import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { backend, currentShip, selectShip } from '../api/api';
import type { NodeChange } from '../api/types';

export type PanelTarget = { kind: 'node'; id: string } | { kind: 'record'; id: string };

export interface Cascade {
  changes: NodeChange[];
  at: number;
  source: string;
}

interface StoreValue {
  ship: string;
  changeShip: (id: string) => void;
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
  const [ship, setShip] = useState(currentShip());
  const changeShip = useCallback((id: string) => { selectShip(id); setShip(id); setStack([]); setFocus('all'); setCascade(null); setVersion(v=>v+1); }, []);
  useEffect(() => {
    let prior = ''; let live = true;
    const timer = setInterval(async () => { try { const s = await backend('scenario/version'); const key=JSON.stringify(s); if(live && prior && key!==prior) setVersion(v=>v+1); prior=key; } catch { /* Requests surface connection errors in each view. */ } }, 2500);
    return () => { live=false; clearInterval(timer); };
  }, []);
  const [stopped, setStopped] = useState(false);
  // ?open=<nodeId> opens that item's detail panel on load (handy for demos and links).
  const [stack, setStack] = useState<PanelTarget[]>(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    return id ? [{ kind: 'node', id }] : [];
  });
  const [focus, setFocus] = useState<string | 'all'>('all');
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
    () => ({ ship, changeShip, version, bump, stopped, setStopped, panel, canGoBack, openNode, openRecord, backPanel, closePanel, focus, setFocus, cascade, setCascade }),
    [ship, changeShip, version, bump, stopped, panel, canGoBack, openNode, openRecord, backPanel, closePanel, focus, cascade],
  );
  return <Ctx.Provider value={value}><div key={ship} className="h-full">{children}</div></Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}
