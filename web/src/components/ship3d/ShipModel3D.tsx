import { DoorOpen, ExternalLink, FlipHorizontal2, LogOut, Scissors, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { HullType, ShipPayload, ShipSystem } from '../../api/types';
import clsx from '../../lib/clsx';
import { STATUS } from '../../theme/status';
import { ShipProfile } from '../ship/ShipProfile';
import { CUT_LEGEND } from './cutaway';
import { HULLS, HULL_ORDER, hullDef } from './hulls';
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
  const [hullType, setHullType] = useState<HullType>(ship.hullType in HULLS ? ship.hullType : 'DDG');
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
  const groups = useMemo(() => {
    const out: Record<string, HullType[]> = {};
    for (const t of HULL_ORDER) {
      const d = HULLS[t];
      if (d) (out[d.group] ||= []).push(t);
    }
    return out;
  }, []);

  return (
    <div className="flex flex-col lg:h-[38rem] lg:flex-row">
      <div ref={hostRef} className="s3-stage relative h-[30rem] min-w-0 flex-1 overflow-hidden lg:h-auto lg:rounded-bl-2xl">
        <div ref={overlayRef} className="s3-overlay" />
        {!cut && !inside && (
          <div className="pointer-events-none absolute left-4 top-4 flex max-w-[30rem] items-start gap-2 rounded-[10px] border border-accent/40 bg-[rgba(6,11,20,.8)] px-3.5 py-2 text-sm font-semibold leading-snug text-[#cfe8f3]">
            <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span>
              Click a pin to cut the ship open at that system, or click the hull to cut anywhere. Drag to orbit, scroll to zoom.
            </span>
          </div>
        )}
        {cut && !inside && <CutPanel cut={cut} scene={sceneRef} onOpen={onOpen} />}
        {inside && (
          <div className="absolute bottom-4 left-4 right-4 flex justify-center" role="status">
            <div className="pointer-events-auto max-w-[36rem] rounded-[14px] border border-[rgba(140,180,220,.26)] bg-[rgba(6,11,20,.92)] px-4 py-3">
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
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3.5 overflow-auto border-t border-line bg-[#060b14] p-5 lg:w-[19rem] lg:border-l lg:border-t-0" aria-label="3D view controls">
        <Block label="Hull type" sub="· read from ship record">
          <div className="flex flex-col gap-2">
            {Object.entries(groups).map(([g, ts]) => (
              <div key={g}>
                <div className="mb-1 text-[12.5px] text-ink-muted">{g}</div>
                <div className="flex flex-wrap gap-2">
                  {ts.map((t) => (
                    <Btn key={t} on={hullType === t} onClick={() => setHullType(t)}>
                      {t}
                    </Btn>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">
            {hullDef(hullType).note}
            {hullType !== ship.hullType && <> Preview only: the ship record says {ship.hullType}.</>}
          </p>
        </Block>
        <Block label="View">
          <Btn on={view === 'sky'} onClick={() => pick('sky')}>
            Sky view
          </Btn>
          <Btn on={view === 'iso'} onClick={() => pick('iso')}>
            Isometric
          </Btn>
          <Btn on={view === 'side'} onClick={() => pick('side')}>
            Side
          </Btn>
        </Block>
        <Block label="Hull">
          <Btn on={xray} onClick={() => setXray((v) => !v)}>
            X-ray (below deck)
          </Btn>
          <Btn on={sea} onClick={() => setSea((v) => !v)}>
            Sea
          </Btn>
        </Block>
        <Block label="Cut direction">
          <Btn on={cutMode === 'x'} onClick={() => setCutMode('x')}>
            Across
          </Btn>
          <Btn on={cutMode === 'z'} onClick={() => setCutMode('z')}>
            Lengthwise
          </Btn>
        </Block>
        <Block label="Cut-section key">
          <div className="grid w-full grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px] text-[#c3d0e0]">
            {CUT_LEGEND.map(([n, c]) => (
              <span key={n} className="flex items-center gap-2">
                <i className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: c }} aria-hidden />
                {n}
              </span>
            ))}
          </div>
        </Block>
        <Block label="Pins">
          <ul className="flex w-full flex-col gap-1.5">
            {rows.map((s) => {
              const has = mounts.has(s.mount!);
              const meta = STATUS[s.status];
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!has}
                    onClick={() => cutAt(s.id)}
                    aria-label={has ? `${s.name}: ${meta.label}. Cut the ship open here.` : `${s.name}: no mount on this hull`}
                    className={clsx(
                      'flex w-full items-center gap-2.5 rounded-[10px] border border-line px-2.5 py-1.5 text-left text-sm transition',
                      has ? 'hover:border-line-strong hover:bg-white/[0.03]' : 'cursor-default opacity-80',
                      s.isNextDomino && has && 'border-risk/70',
                      cut?.focusId === s.id && 'border-accent/60 bg-accent/[0.08]',
                    )}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: has ? meta.hex : '#6b7d95' }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-ink" title={s.name}>
                      {s.name}
                    </span>
                    <span className="shrink-0 text-[13px] font-bold" style={{ color: has ? meta.hex : '#9fb0c6' }}>
                      {has ? meta.label : 'No mount on this hull'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Block>
      </aside>
    </div>
  );
}

/** Top-right panel while the ship is cut open. */
function CutPanel({ cut, scene, onOpen }: { cut: CutState; scene: RefObject<ShipScene | null>; onOpen: (id: string) => void }) {
  const meta = cut.status ? STATUS[cut.status] : null;
  return (
    <div className="absolute right-4 top-4 w-[15.75rem] rounded-[14px] border border-[rgba(140,180,220,.26)] bg-[rgba(6,11,20,.92)] p-4" role="region" aria-label="Cut section">
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

function Block({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
        {sub && <span className="ml-1 font-normal normal-case tracking-normal">{sub}</span>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
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
        'whitespace-nowrap rounded-[10px] border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        small ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-[9px] text-sm',
        on ? 'border-accent/60 bg-accent/[0.12] text-accent' : 'border-[rgba(140,180,220,.26)] text-ink-muted hover:border-[rgba(140,180,220,.5)] hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
