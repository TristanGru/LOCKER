import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ShipPayload, ShipSystem } from '../../api/types';
import clsx from '../../lib/clsx';
import { STATUS } from '../../theme/status';
import { BaseScene, type BaseView } from './BaseScene';

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const pinKey = (systems: ShipSystem[]) => JSON.stringify(systems.map((s) => [s.id, s.status, s.isNextDomino, s.mount, s.name]));

const VIEWS: { id: BaseView; label: string }[] = [
  { id: 'overhead', label: 'Overhead' },
  { id: 'iso', label: 'Isometric' },
  { id: 'waterfront', label: 'Waterfront' },
];

const PIN_LEGEND: [string, string][] = [
  ['Ready', '#34d399'],
  ['Watch', '#fbbf24'],
  ['At risk', '#fb4d5d'],
];

/** 3D installation layout with live status pins. Falls back to a plain list without WebGL and in print. */
export function BaseModel3D({ unit, onOpen }: { unit: ShipPayload; onOpen: (id: string) => void }) {
  const [webgl] = useState(hasWebGL);
  const [failed, setFailed] = useState(false);
  const list = <FacilityList systems={unit.systems} onOpen={onOpen} />;
  if (!webgl || failed)
    return (
      <div className="p-5">
        <p className="mb-3 text-sm text-ink-muted">3D view unavailable on this display, showing the facility list.</p>
        <p className="mb-3 text-sm text-ink-muted">{NOTICE}</p>
        {list}
      </div>
    );
  return (
    <>
      <div className="print:hidden">
        <Stage unit={unit} onOpen={onOpen} onFail={() => setFailed(true)} />
      </div>
      <div className="hidden p-5 print:block">{list}</div>
    </>
  );
}

const NOTICE = 'Mock for demonstration. Facilities, failures and staff are invented. Not a site plan.';

function Stage({ unit, onOpen, onFail }: { unit: ShipPayload; onOpen: (id: string) => void; onFail: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BaseScene | null>(null);
  const [view, setView] = useState<BaseView>('iso');
  const [menu, setMenu] = useState<'view' | 'facilities' | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const live = useRef({ onOpen, onFail, systems: unit.systems });
  live.current = { onOpen, onFail, systems: unit.systems };
  const key = pinKey(unit.systems);
  const pointsKey = JSON.stringify({ points: unit.mountPoints ?? {}, layout: unit.layout ?? null });
  const berthKey = JSON.stringify(unit.berths ?? []);

  useEffect(() => {
    const host = hostRef.current;
    const overlay = overlayRef.current;
    if (!host || !overlay) return;
    let scene: BaseScene;
    try {
      const { points, layout } = JSON.parse(pointsKey);
      scene = new BaseScene(host, overlay, points, layout, (id) => live.current.onOpen(id), (error) => {
        console.error('3D base view failed, falling back to the facility list', error);
        live.current.onFail();
      });
    } catch (error) {
      console.error('3D base view could not start', error);
      live.current.onFail();
      return;
    }
    sceneRef.current = scene;
    scene.setSystems(live.current.systems);
    scene.setBerths(JSON.parse(berthKey));
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  useEffect(() => {
    sceneRef.current?.setBerths(JSON.parse(berthKey));
  }, [berthKey]);

  useEffect(() => {
    sceneRef.current?.setSystems(live.current.systems);
  }, [key]);

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
  }, [menu]);

  const atPier = unit.layout ? (unit.berths ?? []).filter((b) => b.in_port).map((b) => `${b.name} (${b.pier})`) : [];

  const pick = (next: BaseView) => {
    setView(next);
    setFocusId(null);
    setMenu(null);
    sceneRef.current?.setView(next);
  };

  return (
    <div ref={hostRef} data-testid="base-canvas" className="s3-stage relative h-[38rem] overflow-hidden">
      <div ref={overlayRef} className="s3-overlay" />
      <div ref={barRef} className="on-stage pointer-events-none absolute inset-x-0 top-0 z-30 bg-[rgba(6,11,20,.78)] backdrop-blur-sm">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 px-3 py-2" role="toolbar" aria-label="3D model filters">
          <Drop label="View" value={VIEWS.find((item) => item.id === view)?.label ?? 'View'} open={menu === 'view'} onClick={() => setMenu(menu === 'view' ? null : 'view')}>
            {VIEWS.map((item) => (
              <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => pick(item.id)} className={clsx('flex w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold', view === item.id ? 'bg-white/15' : 'hover:bg-white/10')}>
                {item.label}
              </button>
            ))}
          </Drop>
          <Drop
            label="Facilities"
            value={unit.systems.find((s) => s.id === focusId)?.name ?? 'All pins'}
            open={menu === 'facilities'}
            onClick={() => setMenu(menu === 'facilities' ? null : 'facilities')}
            end
          >
            <div className="max-h-72 w-72 overflow-auto">
              {unit.systems.map((s) => {
                const meta = STATUS[s.status];
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setFocusId(s.id);
                      setMenu(null);
                      sceneRef.current?.focus(s.id);
                    }}
                    className={clsx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-white/10', focusId === s.id && 'bg-white/10')}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.hex }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="shrink-0 text-xs font-semibold" style={{ color: meta.hex }}>
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Drop>
        </div>
        <p className="px-3 pb-2 text-xs text-[#c3d0e0]">Click a label for its evidence. Drag to orbit, scroll to zoom.</p>
      </div>
      <div className="on-stage pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-2 bg-[rgba(6,11,20,.78)] px-3 py-2 text-xs backdrop-blur-sm" aria-label="3D model legend">
        <span className="font-semibold uppercase tracking-[0.12em] text-[#9fb0c6]">Pins</span>
        {PIN_LEGEND.map(([name, color]) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
            {name}
          </span>
        ))}
        {atPier.length > 0 && <span className="text-[#c3d0e0]">At pier: {atPier.join(', ')}</span>}
        <span className="ml-auto text-right text-[#c3d0e0]">
          {NOTICE}
          {unit.layout && <> Piers and runways: {unit.layout.attribution}.</>}
        </span>
      </div>
    </div>
  );
}

function FacilityList({ systems, onOpen }: { systems: ShipSystem[]; onOpen: (id: string) => void }) {
  return (
    <ul className="flex w-full flex-col gap-1.5">
      {systems.map((s) => {
        const meta = STATUS[s.status];
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              aria-label={`${s.name}: ${meta.label}. Open its details.`}
              className={clsx('flex w-full items-center gap-2.5 rounded-[10px] border border-line px-2.5 py-1.5 text-left text-sm transition hover:border-line-strong hover:bg-ink/[0.06]', s.isNextDomino && 'border-risk/70')}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: meta.hex }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-ink" title={s.name}>
                {s.name}
              </span>
              <span className="shrink-0 text-[13px] font-bold" style={{ color: meta.hex }}>
                {meta.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Drop({ label, value, open, onClick, end, children }: { label: string; value: string; open: boolean; onClick: () => void; end?: boolean; children: ReactNode }) {
  return (
    <div className={clsx('relative', end && 'ml-auto')}>
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={onClick} className="inline-flex max-w-[16rem] items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-sm hover:border-white/40">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9fb0c6]">{label}</span>
        <span className="min-w-0 truncate font-semibold">{value}</span>
        <ChevronDown className={clsx('h-4 w-4 shrink-0 transition', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <div className={clsx('absolute top-full z-40 mt-1 min-w-[14rem] rounded-xl border border-white/15 bg-[rgba(6,11,20,.96)] p-1.5 shadow-glass', end ? 'right-0' : 'left-0')}>{children}</div>}
    </div>
  );
}
