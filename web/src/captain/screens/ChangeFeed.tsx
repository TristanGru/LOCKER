import { ReactFlowProvider } from '@xyflow/react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCheck, Maximize2, OctagonX, Radio, RotateCw, SkipForward } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import type { MissionDelta } from '../api/types';
import { EventCard } from '../components/feed/EventCard';
import { ImpactStrip } from '../components/feed/ImpactStrip';
import { DominoGraph } from '../components/graph/DominoGraph';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import clsx from '../lib/clsx';
import { useLagged } from '../lib/useLagged';
import { useStore } from '../state/store';
import { useApi } from '../state/useApi';

// The mission domino falls ~1.45 s after the event (part -> equipment -> mission),
// so the odds tiles wait for it.
const MISSION_LAG_MS = 1450;

export function ChangeFeed() {
  const { stopped, bump, cascade, setCascade, openNode, closePanel, panel, setFocus } = useStore();
  const navigate = useNavigate();
  const events = useApi(() => api.getEvents());
  const missionsQ = useApi(() => api.getMissions());
  const [graphFocus, setGraphFocus] = useState('all');
  const graph = useApi(() => api.getGraph(graphFocus), [graphFocus]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDeltas, setLastDeltas] = useState<MissionDelta[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  const delivered = events.data?.delivered ?? [];
  const remaining = events.data?.remaining ?? 0;
  const total = delivered.length + remaining;

  const cascading = Boolean(cascade && Date.now() - cascade.at < 4000);
  const liveMissions = useMemo(() => (missionsQ.data ? [...missionsQ.data.missions].sort((a, b) => a.daysOut - b.daysOut) : []), [missionsQ.data]);
  const missions = useLagged(liveMissions, cascading ? MISSION_LAG_MS : 0);
  const deltas = useLagged(lastDeltas ?? delivered[0]?.missionDeltas ?? null, cascading ? MISSION_LAG_MS : 0);

  const next = useCallback(async () => {
    if (busy || stopped || remaining === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.nextEvent();
      // Stay on the focused mission if this event touched it; otherwise follow the biggest mover.
      const moved = r.missionDeltas.filter((d) => Math.abs(d.after - d.before) >= 0.005);
      if (moved.length && !moved.some((d) => d.missionId === graphFocus)) {
        const top = [...moved].sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))[0];
        setGraphFocus(top.missionId);
      }
      setLastDeltas(r.missionDeltas);
      setCascade({ changes: r.changes, at: Date.now(), source: r.event.id });
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, stopped, remaining, graphFocus, setCascade, bump]);

  // Presenter shortcut: press N for the next event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        void next();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next]);

  const focusCode = missions.find((m) => m.id === graphFocus)?.code ?? graphFocus;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* header + control */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-bold leading-tight tracking-tight">Change Feed</h1>
          <p className="text-lg text-ink-muted">Ship systems report in. LOCKER re-scores every mission and shows what falls next.</p>
        </div>
        <div className="glass flex items-center gap-5 px-5 py-3">
          <div>
            <div className="label-caps">Demo events</div>
            <div className="mt-1.5 flex items-center gap-1.5" aria-label={`${delivered.length} of ${total} delivered`}>
              {Array.from({ length: total || 4 }, (_, i) => (
                <motion.span
                  key={i}
                  className={clsx('h-2.5 w-7 rounded-full', i < delivered.length ? 'bg-accent' : 'bg-white/10')}
                  animate={i === delivered.length - 1 ? { scale: [1, 1.25, 1] } : {}}
                  transition={{ duration: 0.5 }}
                />
              ))}
              <span className="num ml-2 text-sm text-ink-muted">
                {delivered.length}/{total || 4}
              </span>
            </div>
          </div>
          {stopped ? (
            <div className="flex items-center gap-2 rounded-xl border border-risk/60 bg-risk-soft px-4 py-3 font-semibold text-risk">
              <OctagonX className="h-5 w-5" aria-hidden /> Stopped. Resume to continue.
            </div>
          ) : remaining === 0 && events.data ? (
            <div className="flex items-center gap-2 rounded-xl border border-ready/40 bg-ready-soft px-4 py-3 font-semibold text-ready">
              <CheckCheck className="h-5 w-5" aria-hidden /> All events in. Reset demo to replay.
            </div>
          ) : (
            <button onClick={next} disabled={busy || !events.data} className="btn-accent px-6 py-3.5 text-lg">
              {busy ? <RotateCw className="h-5 w-5 animate-spin" aria-hidden /> : <SkipForward className="h-5 w-5" aria-hidden />}
              Next event
              <kbd className="num ml-1 rounded border border-accent/40 px-1.5 text-xs text-accent/80">N</kbd>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-risk/50 bg-risk-soft px-4 py-2.5 text-ink">
          <OctagonX className="h-5 w-5 text-risk" aria-hidden /> {error}
        </div>
      )}

      {missions.length > 0 && <ImpactStrip missions={missions} deltas={deltas} focus={graphFocus} onFocus={setGraphFocus} />}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(24rem,32rem)_1fr]">
        {/* feed */}
        <section aria-label="Incoming events" className="glass flex min-h-0 flex-col">
          <header className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Radio className="h-4 w-4 text-accent" aria-hidden />
            <h2 className="label-caps !text-ink-muted">Incoming</h2>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-dim">
              <span className={clsx('h-2 w-2 rounded-full', stopped ? 'bg-risk' : 'animate-blink bg-ready')} />
              {stopped ? 'Intake halted' : 'Listening'}
            </span>
          </header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {events.loading && <Loading label="Connecting to feeds" />}
            {events.error != null && !events.data && <ErrorState error={events.error} onRetry={events.reload} />}
            {events.data && delivered.length === 0 && (
              <EmptyState icon={Radio} title="Quiet so far">
                No new reports. Press <span className="font-semibold text-accent">Next event</span> (or <kbd className="num rounded border border-line px-1">N</kbd>) to receive the first one.
              </EmptyState>
            )}
            <AnimatePresence initial={false}>
              {delivered.map((ev, i) => (
                <EventCard key={ev.id} event={ev} latest={i === 0} />
              ))}
            </AnimatePresence>
            {events.data &&
              Array.from({ length: remaining }, (_, i) => (
                <div key={`pending-${i}`} className="rounded-2xl border border-dashed border-line px-5 py-4 text-sm text-ink-dim">
                  <span className="num">#{delivered.length + i + 1}</span> · waiting for the next report…
                </div>
              ))}
          </div>
        </section>

        {/* live graph */}
        <section aria-label="Live dependency view" className="glass flex min-h-[24rem] flex-col overflow-hidden">
          <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-2.5">
            <h2 className="label-caps !text-ink-muted">Live dominoes</h2>
            <span className="text-base font-bold text-ink">{focusCode}</span>
            <span className="text-xs text-ink-dim">Watch the change ripple: part, then equipment, then mission.</span>
            <button
              className="btn-ghost ml-auto !py-1.5"
              onClick={() => {
                setFocus(graphFocus);
                navigate('/dominoes');
              }}
            >
              <Maximize2 className="h-4 w-4" aria-hidden /> Full graph
            </button>
          </header>
          <div className="relative min-h-0 flex-1">
            {graph.loading && <Loading label="Tracing dependencies" className="h-full" />}
            {graph.error != null && !graph.data && <ErrorState error={graph.error} onRetry={graph.reload} className="h-full" />}
            {graph.data && (
              <ReactFlowProvider>
                <DominoGraph
                  graph={graph.data}
                  showAll={showAll}
                  selectedId={panel?.kind === 'node' ? panel.id : null}
                  onSelect={openNode}
                  onClear={closePanel}
                  onExpand={() => setShowAll(true)}
                  cascade={cascade}
                />
              </ReactFlowProvider>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
