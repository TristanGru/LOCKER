import { ChevronDown, DoorOpen, ExternalLink, FlipHorizontal2, LogOut, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { HullType, ShipPayload, ShipSystem } from '../../api/types';
import clsx from '../../lib/clsx';
import { STATUS } from '../../theme/status';
import { ShipProfile } from '../ship/ShipProfile';
import { CUT_LEGEND } from './cutaway';
import { ShipScene, type CutState } from './ShipScene';
import type { CutMode, ViewKind } from './types';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Only what changes the pins; avoids rebuilding them when an unrelated field refetches. */
const pinKey = (systems: ShipSystem[]) => JSON.stringify(systems.map((s) => [s.id, s.status, s.isNextDomino, s.mount, s.deck, s.name]));

/**
 * 3D ship profile: a procedural model for the ship's hull type with live status pins.
 * Falls back to the flat sky-view SVG when WebGL is unavailable, fails, or the page is printed.
 */
export function ShipModel3D({ ship, onOpen }: { ship: ShipPayload; onOpen: (id: string) => void }) {
  const [webgl] = useState(hasWebGL);
  const [failed, setFailed] = useState(false);
  const fallback = <ShipProfile systems={ship.systems} onOpen={onOpen} />;
  if (!webgl || failed)
    return (
      <div className="p-5">
        <p className="mb-3 text-sm text-ink-muted">3D view unavailable on this display, showing the flat sky view.</p>
        {fallback}
      </div>
    );
  return (
    <>
      <div className="print:hidden">
        <Stage ship={ship} onOpen={onOpen} onFail={() => setFailed(true)} />
      </div>
      <div className="hidden p-5 print:block">{fallback}</div>
    </>
  );
}

function Stage({ ship, onOpen, onFail }: { ship: ShipPayload; onOpen: (id: string) => void; onFail: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ShipScene | null>(null);
  const hullType: HullType = 'DDG';
  const [mounts, setMounts] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewKind>('sky');
  const [xray, setXray] = useState(true);
  const [sea, setSea] = useState(true);
  const [cutMode, setCutMode] = useState<CutMode>('x');
  const [cut, setCut] = useState<CutState | null>(null);
  const [inside, setInside] = useState<string | null>(null);

  // latest props for scene callbacks
  const live = useRef({ onOpen, onFail, systems: ship.systems });
  live.current = { onOpen, onFail, systems: ship.systems };

  const hullNumber = (/-(\d+)/.exec(ship.hull)?.[1] ?? '00').padStart(2, '0');
  const key = pinKey(ship.systems);

  useEffect(() => {
    const host = hostRef.current;
    const overlay = overlayRef.current;
    if (!host || !overlay) return;
    let scene: ShipScene;
    try {
      scene = new ShipScene(host, overlay, {
        onHull: (_t, m) => setMounts(m),
        onView: (v) => setView(v),
        onCut: (c) => setCut(c),
        onInside: (title) => setInside(title),
        onError: (err) => {
          console.error('3D ship view failed, falling back to the sky view', err);
          live.current.onFail();
        },
      });
    } catch (err) {
      console.error('3D ship view could not start', err);
      live.current.onFail();
      return;
    }
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setHull(hullType, hullNumber, live.current.systems);
  }, [hullType, hullNumber]);

  const firstKey = useRef(true);
  useEffect(() => {
    if (firstKey.current) {
      firstKey.current = false;
      return;
    }
    sceneRef.current?.setSystems(live.current.systems);
  }, [key]);

  useEffect(() => sceneRef.current?.setXray(xray), [xray]);
  useEffect(() => sceneRef.current?.setSea(sea), [sea]);
  useEffect(() => sceneRef.current?.setCutMode(cutMode), [cutMode]);

  const pick = useCallback((v: ViewKind) => sceneRef.current?.setView(v), []);
  const cutAt = useCallback((id: string) => sceneRef.current?.cutAtSystem(id), []);

  const rows = useMemo(() => ship.systems.filter((s) => s.mount && s.deck !== 'none'), [ship.systems]);
  const [menu, setMenu] = useState<FilterMenuId | null>(null);

  return (
    <div ref={hostRef} className="s3-stage relative h-[38rem] overflow-hidden">
      <div ref={overlayRef} className="s3-overlay" />
      <FilterBar
        menu={menu}
        setMenu={setMenu}
        view={view}
        onView={pick}
        xray={xray}
        setXray={setXray}
        sea={sea}
        setSea={setSea}
        cutMode={cutMode}
        setCutMode={setCutMode}
        rows={rows}
        mounts={mounts}
        focusId={cut?.focusId}
        onCut={cutAt}
        showHint={!cut && !inside}
      />
      {cut && !inside && <CutPanel cut={cut} scene={sceneRef} onOpen={onOpen} />}
      {inside && (
        <div className="absolute bottom-4 left-4 right-4 z-30 flex justify-center" role="status">
          <div className="on-stage pointer-events-auto max-w-[36rem] rounded border border-[rgba(140,180,220,.26)] bg-[rgba(6,11,20,.92)] px-4 py-3">
            <div className="text-[15px] font-semibold text-ink">{inside}</div>
            <p className="mt-1 text-[13px] leading-snug text-ink-muted">Drag to look around. W A S D or the arrow keys walk. Hold Shift to move faster.</p>
            <div className="mt-2">
              <Btn small onClick={() => sceneRef.current?.leave()}>
                <LogOut className="mr-1 inline h-3 w-3" aria-hidden />
                Leave (Esc)
              </Btn>
            </div>
          </div>
        </div>
      )}
      {!inside && <ModelLegend />}
    </div>
  );
}

type FilterMenuId = 'view' | 'display' | 'cut' | 'systems';

const VIEWS: { id: ViewKind; label: string }[] = [
  { id: 'sky', label: 'Sky view' },
  { id: 'iso', label: 'Isometric' },
  { id: 'side', label: 'Side' },
];

const CUTS: { id: CutMode; label: string }[] = [
  { id: 'x', label: 'Across' },
  { id: 'z', label: 'Lengthwise' },
];

function FilterBar({
  menu,
  setMenu,
  view,
  onView,
  xray,
  setXray,
  sea,
  setSea,
  cutMode,
  setCutMode,
  rows,
  mounts,
  focusId,
  onCut,
  showHint,
}: {
  menu: FilterMenuId | null;
  setMenu: (id: FilterMenuId | null) => void;
  view: ViewKind;
  onView: (view: ViewKind) => void;
  xray: boolean;
  setXray: (value: boolean | ((value: boolean) => boolean)) => void;
  sea: boolean;
  setSea: (value: boolean | ((value: boolean) => boolean)) => void;
  cutMode: CutMode;
  setCutMode: (mode: CutMode) => void;
  rows: ShipSystem[];
  mounts: Set<string>;
  focusId?: string;
  onCut: (id: string) => void;
  showHint: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu, setMenu]);

  const displaySummary = [xray ? 'X-ray' : '', sea ? 'Sea' : ''].filter(Boolean).join(', ') || 'None';
  const toggle = (id: FilterMenuId) => setMenu(menu === id ? null : id);

  return (
    <div ref={barRef} className="on-stage pointer-events-none absolute inset-x-0 top-0 z-30 bg-[rgba(6,11,20,.78)] backdrop-blur-sm">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 px-3 py-2" role="toolbar" aria-label="3D model filters">
        <Drop label="View" value={VIEWS.find((item) => item.id === view)?.label ?? 'View'} open={menu === 'view'} onClick={() => toggle('view')}>
          {VIEWS.map((item) => (
            <ChoiceRow key={item.id} selected={view === item.id} onClick={() => { onView(item.id); setMenu(null); }}>
              {item.label}
            </ChoiceRow>
          ))}
        </Drop>
        <Drop label="Display" value={displaySummary} open={menu === 'display'} onClick={() => toggle('display')}>
          <CheckRow checked={xray} onChange={(checked) => setXray(checked)} label="X-ray (below deck)" />
          <CheckRow checked={sea} onChange={(checked) => setSea(checked)} label="Sea" />
        </Drop>
        <Drop label="Cut" value={CUTS.find((item) => item.id === cutMode)?.label ?? 'Cut'} open={menu === 'cut'} onClick={() => toggle('cut')}>
          {CUTS.map((item) => (
            <ChoiceRow key={item.id} selected={cutMode === item.id} onClick={() => { setCutMode(item.id); setMenu(null); }}>
              {item.label}
            </ChoiceRow>
          ))}
        </Drop>
        <Drop label="Systems" value={rows.find((row) => row.id === focusId)?.name ?? 'All pins'} open={menu === 'systems'} onClick={() => toggle('systems')} align="end" panelClassName="max-h-72 w-80 overflow-auto">
          {rows.map((system) => {
            const mounted = mounts.has(system.mount!);
            const meta = STATUS[system.status];
            return (
              <button
                key={system.id}
                type="button"
                disabled={!mounted}
                onClick={() => { onCut(system.id); setMenu(null); }}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm',
                  mounted ? 'hover:bg-white/10' : 'cursor-default opacity-60',
                  focusId === system.id && 'bg-white/10',
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: mounted ? meta.hex : '#9fb0c6' }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{system.name}</span>
                <span className="shrink-0 text-xs font-semibold" style={{ color: mounted ? meta.hex : '#c3d0e0' }}>
                  {mounted ? meta.label : 'No mount'}
                </span>
              </button>
            );
          })}
        </Drop>
      </div>
      {showHint && <p className="px-3 pb-2 text-xs text-[#c3d0e0]">Click a pin or the hull to cut. Drag to orbit, scroll to zoom.</p>}
    </div>
  );
}

function Drop({ label, value, open, onClick, align, panelClassName, children }: { label: string; value: string; open: boolean; onClick: () => void; align?: 'end'; panelClassName?: string; children: ReactNode }) {
  return (
    <div className={clsx('relative', align === 'end' && 'ml-auto')}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={onClick}
        className="inline-flex max-w-[16rem] items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-sm hover:border-white/40"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9fb0c6]">{label}</span>
        <span className="min-w-0 truncate font-semibold">{value}</span>
        <ChevronDown className={clsx('h-4 w-4 shrink-0 transition', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className={clsx('absolute top-full z-40 mt-1 min-w-[14rem] rounded-xl border border-white/15 bg-[rgba(6,11,20,.96)] p-1.5 shadow-glass', align === 'end' ? 'right-0' : 'left-0', panelClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}

function ChoiceRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={clsx('flex w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold', selected ? 'bg-white/15' : 'hover:bg-white/10')}>
      {children}
    </button>
  );
}

function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold hover:bg-white/10">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
      {label}
    </label>
  );
}

const PIN_LEGEND: [string, string][] = [
  ['Ready', '#34d399'],
  ['Watch', '#fbbf24'],
  ['At risk', '#fb4d5d'],
  ['No mount', '#9fb0c6'],
];

function ModelLegend() {
  return (
    <div className="on-stage pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-2 bg-[rgba(6,11,20,.78)] px-3 py-2 text-xs backdrop-blur-sm" aria-label="3D model legend">
      <LegendGroup title="Sections" items={CUT_LEGEND} shape="square" />
      <LegendGroup title="Pins" items={PIN_LEGEND} shape="circle" />
    </div>
  );
}

function LegendGroup({ title, items, shape }: { title: string; items: [string, string][]; shape: 'square' | 'circle' }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-semibold uppercase tracking-[0.12em] text-[#9fb0c6]">{title}</span>
      {items.map(([name, color]) => (
        <span key={name} className="inline-flex items-center gap-1.5">
          <i className={clsx('h-2.5 w-2.5 shrink-0', shape === 'circle' ? 'rounded-full' : 'rounded-[3px]')} style={{ background: color }} aria-hidden />
          {name}
        </span>
      ))}
    </div>
  );
}

/** Top-right panel while the ship is cut open. */
function CutPanel({ cut, scene, onOpen }: { cut: CutState; scene: RefObject<ShipScene | null>; onOpen: (id: string) => void }) {
  const meta = cut.status ? STATUS[cut.status] : null;
  return (
    <div className="on-stage absolute right-4 top-[4.75rem] z-20 w-[15.75rem] rounded border border-[rgba(140,180,220,.26)] bg-[rgba(6,11,20,.92)] p-4" role="region" aria-label="Cut section">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Cut section · {cut.mode === 'x' ? 'across' : 'lengthwise'}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Btn small onClick={() => scene.current?.enter()}>
          <DoorOpen className="mr-1 inline h-3 w-3" aria-hidden />
          Step inside
        </Btn>
        {cut.focusId && (
          <Btn small onClick={() => onOpen(cut.focusId!)}>
            <ExternalLink className="mr-1 inline h-3 w-3" aria-hidden />
            Details
          </Btn>
        )}
        <Btn small onClick={() => scene.current?.flip()}>
          <FlipHorizontal2 className="mr-1 inline h-3 w-3" aria-hidden />
          Flip
        </Btn>
        <Btn small onClick={() => scene.current?.close()}>
          <X className="mr-1 inline h-3 w-3" aria-hidden />
          Close (Esc)
        </Btn>
      </div>
      <div className="mb-1 mt-3 text-[15px] font-semibold leading-snug text-ink">
        {meta && cut.name ? (
          <>
            <span style={{ color: meta.hex }}>● {meta.label}</span> {cut.name}
          </>
        ) : (
          cut.title
        )}
      </div>
      <div className="text-[13px] leading-snug text-ink-muted">
        {meta ? cut.title : null}
        {cut.detail ? ` — ${cut.detail}` : null}
        {meta ? ' · ' : ''}
        {cut.where}
      </div>
    </div>
  );
}

export function Btn({ on, onClick, children, small, disabled }: { on?: boolean; onClick: () => void; children: ReactNode; small?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={clsx(
        'whitespace-nowrap rounded border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        small ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-[9px] text-sm',
        on ? 'border-accent/60 bg-accent/[0.12] text-accent' : 'border-[rgba(140,180,220,.26)] text-ink-muted hover:border-[rgba(140,180,220,.5)] hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
