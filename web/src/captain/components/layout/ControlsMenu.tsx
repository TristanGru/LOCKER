import { ChevronDown, ChevronRight, CircleAlert, CircleCheck, RefreshCw, RotateCcw, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { backend } from '../../api/api';
import clsx from '../../lib/clsx';
import { useAuth } from '../../state/auth';
import { useStore } from '../../state/store';

type Busy = 'refresh' | 'reset' | 'undo' | null;

/**
 * "Data & controls": source status, the three data actions (each explained), readiness thresholds, and the
 * ship's own reported readiness. Replaces the old wall-of-text panel; the full feed list lives in the
 * freshness menu next to it.
 */
export function ControlsMenu({ snapshot, ship }: { snapshot: any; ship: string }) {
  const { bump } = useStore();
  const { isFleet } = useAuth(); // source refresh is fleet-only
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showBaseline, setShowBaseline] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const src = snapshot?.sources;
  const ok = src ? src.last_attempt?.status === 'loaded' && !(src.configuration_errors?.length) : false;
  const feeds: any[] = src?.sources ?? [];
  const stale = feeds.filter((f) => f.status !== 'loaded').length;
  const bands = snapshot?.forecast?.bands;
  const baseline: any[] = snapshot?.forecast?.reported_baseline?.[ship] ?? [];
  const when = src?.last_successful_refresh ? new Date(src.last_successful_refresh) : null;

  async function run(kind: Exclude<Busy, null>) {
    if (!snapshot) return;
    if (kind === 'refresh' && !confirm('Re-read all source files now? Approved decisions and playback are kept. Changed files that conflict with an active decision are not imported.')) return;
    if (kind === 'reset' && !confirm('Re-read all source files and, if any changed, clear played events and decisions? This cannot be undone.')) return;
    setBusy(kind);
    setMsg(null);
    try {
      const v = snapshot.state.version;
      if (kind === 'undo') {
        const r = await backend('undo', { base_version: v });
        setMsg({ ok: true, text: r.undone ? `Undid: ${describe(r.undone)}.` : 'Nothing to undo.' });
      } else {
        await backend('sources/refresh', { base_version: v, ...(kind === 'reset' ? { reset_scenario: true } : {}) });
        setMsg({ ok: true, text: kind === 'reset' ? 'Sources re-read. Playback and decisions were reset if files changed.' : 'Sources re-read.' });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
      bump();
    }
  }

  return (
    <div ref={ref} className="relative text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink"
      >
        Data &amp; controls
        <ChevronDown className={clsx('h-4 w-4 transition', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="theme-surface glass-strong absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[min(78vh,40rem)] w-[25rem] flex-col text-ink" role="dialog" aria-label="Data and controls">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* status */}
            <section className="border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                {ok ? <CircleCheck className="h-4 w-4 text-ready" aria-hidden /> : <CircleAlert className="h-4 w-4 text-risk" aria-hidden />}
                <span className="font-semibold">{ok ? 'Sources loaded' : 'Source problem'}</span>
                <span className="ml-auto num text-xs text-ink-muted">{feeds.length} feeds{stale ? ` · ${stale} stale` : ''}</span>
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                {when ? <>Last refreshed {when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</> : 'Not refreshed yet'}
                {src?.source_revision ? <span className="font-mono"> · rev {String(src.source_revision).slice(0, 8)}</span> : null}
              </div>
              {!ok && (src?.last_attempt?.error || src?.configuration_errors?.length) && (
                <p className="mt-1.5 text-xs text-risk">{src.last_attempt?.error || src.configuration_errors.join('; ')}</p>
              )}
              {stale > 0 && <p className="mt-1.5 text-xs text-ink-muted">Which feeds are stale: open the feed list button to the left.</p>}
            </section>

            {/* actions */}
            <section className="border-b border-line px-2 py-2">
              {isFleet && <Action icon={RefreshCw} title="Refresh sources" note="Re-read the source files. Decisions and playback are kept." busy={busy === 'refresh'} disabled={!!busy} onClick={() => run('refresh')} />}
              <Action icon={Undo2} title="Undo last change" note="Reverse the most recent decision or played event." busy={busy === 'undo'} disabled={!!busy} onClick={() => run('undo')} />
              {isFleet && <Action icon={RotateCcw} title="Refresh and reset" note="Re-read files and clear playback and decisions if anything changed." danger busy={busy === 'reset'} disabled={!!busy} onClick={() => run('reset')} />}
              {msg && <p className={clsx('mx-2 mb-1 mt-1.5 rounded-sm border px-2.5 py-1.5 text-xs', msg.ok ? 'border-ready/40 text-ink' : 'border-risk/50 text-risk')}>{msg.text}</p>}
            </section>

            {/* thresholds */}
            {bands && (
              <section className="border-b border-line px-4 py-3">
                <div className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-muted">Readiness thresholds</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span><b className="text-ready">Ready</b> ≥ {Math.round(bands.green * 100)}%</span>
                  <span><b className="text-watch">Watch</b> ≥ {Math.round(bands.yellow * 100)}%</span>
                  <span><b className="text-risk">At risk</b> below {Math.round(bands.yellow * 100)}%</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">Where evidence is missing the status is Unknown, not a guess.</p>
              </section>
            )}

            {/* reported baseline */}
            {baseline.length > 0 && (
              <section className="px-2 py-2">
                <button type="button" onClick={() => setShowBaseline((v) => !v)} aria-expanded={showBaseline} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-abyss-800">
                  <ChevronRight className={clsx('h-4 w-4 text-ink-dim transition', showBaseline && 'rotate-90')} aria-hidden />
                  <span className="font-semibold">Ship&apos;s own reported readiness</span>
                  <span className="ml-auto text-xs text-ink-muted">{baseline.length} areas</span>
                </button>
                {showBaseline && (
                  <div className="px-2 pb-1">
                    <p className="mb-1.5 text-xs text-ink-muted">As reported in the readiness system; context only, not LOCKER&apos;s forecast.</p>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-line-strong text-left text-ink-muted">
                          <th className="py-1 pr-2 font-semibold">Area</th>
                          <th className="py-1 pr-2 font-semibold">Rating</th>
                          <th className="py-1 pr-2 font-semibold">Band</th>
                          <th className="py-1 pr-2 text-right font-semibold">MFOM</th>
                          <th className="py-1 font-semibold">Limiting</th>
                        </tr>
                      </thead>
                      <tbody>
                        {baseline.map((b, i) => (
                          <tr key={i} className="border-b border-line last:border-0">
                            <td className="py-1 pr-2 font-semibold">{b.mission_area}</td>
                            <td className="py-1 pr-2">{b.rating}</td>
                            <td className={clsx('py-1 pr-2 font-semibold', b.band === 'GREEN' ? 'text-ready' : b.band === 'YELLOW' ? 'text-watch' : b.band === 'RED' ? 'text-risk' : '')}>{titleCase(b.band)}</td>
                            <td className="num py-1 pr-2 text-right">{b.mfom_index}</td>
                            <td className="py-1 text-ink-muted">{b.limiting_factor || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>

          <footer className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">{src?.notice ?? 'Read-only: refresh never writes source records.'}</footer>
        </div>
      )}
    </div>
  );
}

function Action({ icon: Icon, title, note, onClick, busy, disabled, danger }: { icon: typeof RefreshCw; title: string; note: string; onClick: () => void; busy: boolean; disabled: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="group flex w-full items-start gap-3 rounded-sm px-2 py-2 text-left transition hover:bg-abyss-800 disabled:cursor-wait disabled:opacity-60">
      <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', danger ? 'text-risk' : 'text-accent', busy && 'animate-spin')} aria-hidden />
      <span>
        <span className={clsx('block font-semibold', danger && 'text-risk')}>{busy ? `${title}…` : title}</span>
        <span className="block text-xs text-ink-muted">{note}</span>
      </span>
    </button>
  );
}

const titleCase = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');

/** Plain-language summary of an undone change. */
function describe(c: any): string {
  const p = c?.payload ?? {};
  if (c?.kind === 'fix_decision') return `${p.decision === 'approve' ? 'approval' : 'rejection'} of "${p.fix?.title ?? 'a fix'}"`;
  if (c?.kind === 'play_event') return `event "${p.title ?? p.event_id}"`;
  return String(c?.kind ?? 'change').replace(/_/g, ' ');
}
