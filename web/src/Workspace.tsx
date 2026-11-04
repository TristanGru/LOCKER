import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  FlaskConical,
  GitBranch,
  Layers3,
  ListChecks,
  Menu,
  Pause,
  Play,
  Radar,
  RotateCcw,
  Search,
  ShieldCheck,
  Ship,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { api, StaleError } from "./api";
import ReadinessTimeline from './ReadinessTimeline';
import type {
  Dashboard,
  Gate,
  Mission,
  SourceDocument,
  SourceRef,
} from "./types";
import {
  Loading,
  SourceButton,
  Status,
  dateLabel,
  percent,
  tone,
  toneLabel,
} from "./ui";
import { BriefPanel, EvidencePanel, FixesPanel, WhatIfPanel } from "./Panels";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "./styles.css";

const ShipView = lazy(() => import("./ShipView"));
const DominoGraph = lazy(() => import("./DominoGraph"));

type View =
  | "missions"
  | "ship"
  | "dominoes"
  | "fixes"
  | "evidence"
  | "whatif"
  | "brief"
  | "activity";
const eventRisk = (mission: Mission) => mission.p_assessed;
const priority = (mission: Mission) => mission.p_assessed ?? -1;
const navigation = [
  { id: "missions", title: "Mission overview", icon: Layers3 },
  { id: "ship", title: "Ship overview", icon: Ship },
  { id: "dominoes", title: "Dominoes", icon: GitBranch },
  { id: "fixes", title: "Fix comparison", icon: ListChecks },
  { id: "evidence", title: "Evidence & feed", icon: Search },
  { id: "whatif", title: "What-if lab", icon: FlaskConical },
  { id: "brief", title: "Readiness brief", icon: FileText },
  { id: "activity", title: "Activity log", icon: Activity },
] as const;

export default function Workspace() {
  const [data, setData] = useState<Dashboard | null>(null),
    [view, setView] = useState<View>("missions"),
    [ship, setShip] = useState("KESSLER"),
    [eventId, setEventId] = useState("EVT-KESSLER-01"),
    [system, setSystem] = useState<string | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [menu, setMenu] = useState(false);
  const [source, setSource] = useState<SourceDocument | null>(null),
    [sourceLoading, setSourceLoading] = useState(false),
    [sourceError, setSourceError] = useState(""),
    [drawer, setDrawer] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    action: () => Promise<unknown>;
  } | null>(null);
  const currentVersion = useRef(-1),
    currentHealth = useRef(''),
    refreshSequence = useRef(0),
    sourceSequence = useRef(0),
    playRef = useRef(false);
  async function refresh() {
    const sequence = ++refreshSequence.current;
    try {
      const next = await api.dashboard();
      if (sequence !== refreshSequence.current) return;
      currentVersion.current = next.state.version;
      currentHealth.current = next.sources.last_attempt.at;
      setData(next);
      setShip(current => next.forecast.missions.some(item => item.ship_id === current) ? current : next.forecast.missions[0]?.ship_id || '');
      setEventId(current => next.forecast.missions.some(item => item.event_id === current) ? current : next.forecast.missions[0]?.event_id || '');
    } catch (failure) {
      setPlaying(false);
      setError(String(failure));
    }
  }
  useEffect(() => {
    refresh();
    const timer = setInterval(async () => {
      try {
        const version = await api.version();
        if (version.version !== currentVersion.current || version.source_health_at !== currentHealth.current) await refresh();
      } catch {
        setError(
          "The local API is unavailable. Existing results may be out of date.",
        );
        setPlaying(false);
      }
    }, 2500);
    return () => {
      clearInterval(timer);
      refreshSequence.current++;
    };
  }, []);
  useEffect(() => {
    playRef.current = playing;
  }, [playing]);
  useEffect(() => {
    if (!playing || !data?.state.next_event || busy) return;
    const timer = setTimeout(() => {
      if (playRef.current) mutate(() => api.play(currentVersion.current));
    }, 4000);
    return () => clearTimeout(timer);
  }, [playing, data?.state.version, busy]);
  useEffect(() => {
    if (data && !data.state.next_event) setPlaying(false);
  }, [data?.state.next_event]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawer(false);
        setConfirmation(null);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  useEffect(() => {
    if (!drawer && !confirmation) return;
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => [
      ...(dialog?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), a[href], input, select, textarea, summary",
      ) || []),
    ];
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable(),
        first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog?.addEventListener("keydown", trap);
    return () => {
      dialog?.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [drawer, Boolean(confirmation)]);
  useEffect(() => {
    sourceSequence.current++;
    setDrawer(false);
    setSource(null);
    setSystem(null);
    setConfirmation(null);
    setPlaying(false);
  }, [data?.state.source_revision]);
  async function mutate(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setConfirmation(null);
    try {
      await action();
    } catch (failure) {
      setPlaying(false);
      setError(
        failure instanceof StaleError
          ? "The exercise changed in another session. Results refreshed; review and confirm again."
          : String(failure),
      );
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  async function openSource(reference: SourceRef) {
    const sequence = ++sourceSequence.current;
    setDrawer(true);
    setSource(null);
    setSourceError("");
    setSourceLoading(true);
    try {
      const document = await api.source(
        reference.file,
        reference.loc,
        reference.span,
        reference.profile,
      );
      if (sequence === sourceSequence.current) setSource(document);
    } catch (failure) {
      if (sequence === sourceSequence.current) setSourceError(String(failure));
    } finally {
      if (sequence === sourceSequence.current) setSourceLoading(false);
    }
  }
  function selectShip(next: string) {
    setShip(next);
    setSystem(null);
    setEventId(
      data?.forecast.missions.find((item) => item.ship_id === next)?.event_id ||
        "",
    );
  }
  function focusMission(mission: Mission, destination: View) {
    setShip(mission.ship_id);
    setEventId(mission.event_id);
    setSystem(
      mission.next_domino?.startsWith("system:")
        ? mission.next_domino.split(":")[1]
        : null,
    );
    setView(destination);
  }
  if (!data)
    return (
      <div className="boot">
        <Radar size={40} />
        <h1>LOCKER</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={refresh}>Retry connection</button>
          </>
        ) : (
          <Loading />
        )}
      </div>
    );
  const bands = data.forecast.bands,
    missions = data.forecast.missions.filter((item) => item.ship_id === ship);
  const mission =
      missions.find((item) => item.event_id === eventId) || missions[0],
    selectedShip = data.state.ships.find((item) => item.ship_id === ship)!;
  const staleCount = Object.keys(data.issues.stale).length,
    attention = [...missions].sort(
      (left, right) => priority(left) - priority(right),
    )[0];
  const limiting = attention?.gates.find(
    (item) => item.gate_id === attention.next_domino,
  );
  const selectedSystem = system
      ? data.visualization.component_to_system[system] || system
      : null,
    selectedGate = mission?.gates.find(
      (item) => item.gate_id === `system:${selectedSystem}`,
    );
  if (!attention || !selectedShip) return <Loading text="Selecting active profile events" />;
  return (
    <div className="app-shell">
      <div className="exercise-banner">
        <ShieldCheck size={12} /> SYNTHETIC EXERCISE{" "}
        <span>
          Not real Navy data or an operational readiness determination
        </span>
      </div>
      <header className="topbar">
        <button
          className="icon-button mobile-menu"
          aria-label="Toggle navigation"
          onClick={() => setMenu(!menu)}
        >
          <Menu size={20} />
        </button>
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setView("missions");
          }}
        >
          <Radar size={28} />
          <strong>LOCKER</strong>
          <span>READINESS</span>
        </a>
        <label className="ship-picker">
          <Ship size={17} />
          <select
            aria-label="Selected ship"
            value={ship}
            onChange={(event) => selectShip(event.target.value)}
          >
            {data.state.ships.map((item) => (
              <option key={item.ship_id} value={item.ship_id}>
                {item.name} / {item.hull}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`freshness ${staleCount ? "watch" : "ready"}`}
          onClick={() => setView("evidence")}
        >
          <Clock3 size={15} />
          {staleCount ? `${staleCount} stale sources` : "Sources current"}
        </button>
        <button
          className="pause-button"
          title="Pause automatic playback; does not cancel an in-flight request"
          onClick={() => {
            playRef.current = false;
            setPlaying(false);
          }}
        >
          <Pause size={15} />
          {playing ? "Pause playback" : "Playback paused"}
        </button>
      </header>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="nav-label">EXERCISE WORKSPACE</div>
        <nav aria-label="Workspace">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => {
                setView(item.id);
                setMenu(false);
              }}
            >
              <item.icon size={18} />
              <span>{item.title}</span>
              {view === item.id && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="connection-dot" />
          Local exercise /{" "}
          {data.state.llm.configured ? data.state.llm.model : "offline rules"}
          <small>
            Version {data.state.version} / seed {data.state.seed}
          </small>
          <button
            className="text-button"
            onClick={() =>
              setConfirmation({
                title: "Reset this shared exercise?",
                description:
                  "This clears the active scenario for everyone connected. Original source files remain unchanged.",
                action: () => api.reset(data.state.version),
              })
            }
          >
            <RotateCcw size={15} />
            Reset exercise
          </button>
        </div>
      </aside>
      <main className="workspace">
        <div className="scenario-toolbar">
          <div>
            <span className="eyebrow">INFORMATION KNOWN AT</span>
            <strong>{data.state.cursor_dtg}</strong>
          </div>
          <div className="playback-controls">
            <span className="mono">
              {data.state.feed.filter((item) => item.played).length} /{" "}
              {data.state.feed.length} events
            </span>
            <button
              className="icon-button"
              title="Undo last exercise change"
              aria-label="Undo last change"
              disabled={busy || !data.log.changes.length}
              onClick={() => mutate(() => api.undo(data.state.version))}
            >
              <Undo2 size={17} />
            </button>
            <button
              className="secondary compact"
              disabled={busy || !data.state.next_event}
              onClick={() => mutate(() => api.play(data.state.version))}
            >
              <ChevronRight size={16} />
              Next event
            </button>
            <button
              className="icon-button"
              title={
                playing ? "Pause replay" : "Play events every four seconds"
              }
              aria-label={playing ? "Pause replay" : "Start automatic replay"}
              disabled={busy || !data.state.next_event}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
            </button>
          </div>
        </div>
        {data.sources.last_attempt.status === 'failed' && <div className="error-banner" role="alert">Source refresh failed. Showing the last usable snapshot ({data.state.source_revision}). Review Evidence & feed.</div>}
        {error && (
          <div className="error-banner" role="alert">
            <TriangleAlert size={18} />
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {busy && (
          <div className="working-bar" role="status">
            Updating shared exercise
          </div>
        )}
        {view === "missions" && (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {selectedShip.hull} / MISSION OVERVIEW
                </div>
                <h1>
                  {(eventRisk(attention) ?? -1) < bands.green ? (
                    <>
                      <span className={tone(eventRisk(attention), bands)}>
                        {attention.label}
                      </span>{" "}
                      needs attention.
                    </>
                  ) : (
                    "A clear view of the next event."
                  )}
                </h1>
                <p>
                  {attention.name} / {dateLabel(attention.start)} /{" "}
                  <strong>
                    {percent(attention.p_ready)} at start;{" "}
                    {percent(attention.interval_p_ready)} across interval checks
                  </strong>
                  {limiting ? ` / ${limiting.label}` : ""}
                </p>
              </div>
              <div className="heading-stat">
                <span className="mono">
                  {missions.length.toString().padStart(2, "0")}
                </span>
                <small>scheduled events</small>
              </div>
            </div>
            <div className="mission-summary">
              {['unknown', 'risk', 'watch', 'ready'].map((status) => (
                <span key={status} className={status}>
                  <strong>
                    {
                      missions.filter(
                        (item) => tone(eventRisk(item), bands) === status,
                      ).length
                    }
                  </strong>{" "}
                  {toneLabel[status]}
                </span>
              ))}
              <span className="threshold-key">
                Includes interval checks / Watch {percent(bands.amber)} / Ready{" "}
                {percent(bands.green)}
              </span>
            </div>
            <div className="mission-list">
              {[...missions]
                .sort((left, right) => priority(left) - priority(right))
                .map((item) => (
                  <MissionRow
                    key={item.event_id}
                    mission={item}
                    data={data}
                    onFocus={(destination) => focusMission(item, destination)}
                    onSource={openSource}
                  />
                ))}
            </div>
            <ReadinessTimeline data={data} mission={mission} />
            <section className="squadron-section">
              <div className="section-heading">
                <h2>Squadron context</h2>
                <span>Receiver and donor events</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Ship / event</th>
                      <th>Start</th>
                      <th>Interval status / start odds</th>
                      <th>Interval checks*</th>
                      <th>Planned at start only</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.forecast.missions.map((item) => (
                      <tr key={item.event_id}>
                        <td>
                          <strong>{item.ship_id}</strong>
                          <small>{item.name}</small>
                        </td>
                        <td className="mono">{dateLabel(item.start)}</td>
                        <td>
                          <Status value={item.p_assessed} bands={bands} />{" "}
                          <span className="mono">{percent(item.p_ready)}</span>
                        </td>
                        <td className={tone(item.interval_p_ready, bands)}>
                          {percent(item.interval_p_ready)}
                        </td>
                        <td>{item.planned?.result}</td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Open ${item.ship_id} ${item.label}`}
                            onClick={() => focusMission(item, "dominoes")}
                          >
                            <ArrowRight size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="fine-print">
                * Six-hour samples plus known personnel and expiry boundaries.
                Not a continuous-availability guarantee.
              </p>
            </section>
          </>
        )}
        {(view === "ship" || view === "dominoes") && (
          <>
            <div className="page-heading compact-heading">
              <div>
                <div className="eyebrow">
                  {selectedShip.name} /{" "}
                  {view === "ship" ? "SHIP OVERVIEW" : "EVENT DEPENDENCIES"}
                </div>
                <h1>
                  {view === "ship"
                    ? "The ship behind the assessment."
                    : mission?.name}
                </h1>
              </div>
              <label className="field inline-field">
                Selected event
                <select
                  value={mission?.event_id || ""}
                  onChange={(event) => setEventId(event.target.value)}
                >
                  {missions.map((item) => (
                    <option value={item.event_id} key={item.event_id}>
                      {item.label} / {dateLabel(item.start)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="visual-layout">
              <div className="visual-main">
                <Suspense fallback={<Loading text="Loading visualization" />}>
                  {view === "ship" ? (
                    <ShipView
                      key={data.state.source_revision}
                      registry={data.visualization}
                      forecast={data.forecast}
                      mission={mission}
                      ship={selectedShip}
                      selected={system}
                      onSelect={setSystem}
                    />
                  ) : (
                    <DominoGraph
                      ship={ship}
                      eventId={mission.event_id}
                      version={data.state.version}
                      bands={bands}
                      onSelect={(eic, sources) => {
                        setSystem(eic);
                        if (!eic && sources.length) openSource(sources[0]);
                      }}
                    />
                  )}
                </Suspense>
              </div>
              <aside className="system-inspector">
                <div className="eyebrow">SELECTED DEPENDENCY</div>
                <h2>
                  {system
                    ? data.visualization.systems.find(
                        (item) => item.eic === system,
                      )?.name || system
                    : "Event requirements"}
                </h2>
                {system && <span className="record-id">{system}</span>}
                {selectedGate && (
                  <>
                    <div className="inspector-score">
                      <strong>{percent(selectedGate.p_ok)}</strong>
                      <span>meets requirement across event interval</span>
                    </div>
                    <Status value={selectedGate.p_ok} bands={bands} />
                  </>
                )}
                {(selectedGate ? [selectedGate] : mission?.gates || []).map(
                  (gate) => (
                    <GateEvidence
                      key={gate.gate_id}
                      gate={gate}
                      onSource={openSource}
                      onSelect={(gateId) =>
                        setSystem(
                          gateId.startsWith("system:")
                            ? gateId.split(":")[1]
                            : null,
                        )
                      }
                    />
                  ),
                )}
                {system && !selectedGate && (
                  <p className="muted">
                    This system is not a gate for the selected event.
                  </p>
                )}
                <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() =>
                      setView(view === "ship" ? "dominoes" : "ship")
                    }
                  >
                    {view === "ship" ? "Open graph" : "Locate on ship"}
                  </button>
                  <button className="primary" onClick={() => setView("fixes")}>
                    Compare options
                    <ArrowRight size={16} />
                  </button>
                </div>
              </aside>
            </div>
          </>
        )}
        {view === "fixes" && (
          <FixesPanel
            ship={ship}
            data={data}
            onConfirm={(fix, decision, delay) =>
              setConfirmation({
                title:
                  decision === "approve"
                    ? "Apply this package to the exercise?"
                    : "Record rejection of this package?",
                description: `${fix.title}. This is a shared synthetic scenario decision, not real operational authorization.`,
                action: () =>
                  api.decide(data.state.version, fix.fix_id, decision, delay),
              })
            }
          />
        )}
        {view === "whatif" && (
          <WhatIfPanel
            key={data.state.source_revision}
            ship={ship}
            mission={mission}
            data={data}
            onApply={(proposal) =>
              setConfirmation({
                title: "Apply this preview to the shared exercise?",
                description:
                  "The current scenario will change for every connected viewer. Original source records remain read-only.",
                action: () => api.change(data.state.version, proposal),
              })
            }
          />
        )}
        {view === "evidence" && (
          <EvidencePanel
            ship={ship}
            data={data}
            onSource={openSource}
            onRefresh={(reset) => setConfirmation({
              title: 'Refresh source snapshot?',
              description: reset ? 'A changed snapshot will reset playback and all what-if decisions. Source records stay read-only.' : 'Validate and activate changed source files. Playback is preserved; existing what-if decisions block activation.',
              action: () => api.refreshSources(data.state.version, reset),
            })}
            onConfirmFact={(factId, include) =>
              setConfirmation({
                title: include
                  ? "Include this fact in the exercise model?"
                  : "Exclude this fact from the exercise model?",
                description:
                  "Review the original passage and contradictory records before changing how this claim affects the scenario.",
                action: () =>
                  api.change(data.state.version, {
                    kind: "confirm_fact",
                    fact_id: factId,
                    include,
                  }),
              })
            }
          />
        )}
        {view === "brief" && (
          <BriefPanel
            ship={ship}
            version={data.state.version}
            onSource={openSource}
          />
        )}
        {view === "activity" && (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">SHARED SCENARIO</div>
                <h1>Every decision, in context.</h1>
                <p>Exercise changes only. Source records remain read-only.</p>
              </div>
            </div>
            {!data.log.changes.length ? (
              <div className="empty-state">
                <Activity size={28} />
                <h2>No exercise changes yet</h2>
              </div>
            ) : (
              <ol className="activity-list">
                {[...data.log.changes].reverse().map((change) => (
                  <li key={change.seq}>
                    <span className="sequence mono">
                      {String(change.seq).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{change.kind.replaceAll("_", " ")}</h3>
                      <p className="mono">
                        {change.scenario_time} / {change.actor}
                      </p>
                      <details>
                        <summary>Recorded payload</summary>
                        <pre>{JSON.stringify(change.payload, null, 2)}</pre>
                      </details>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
        <footer className="workspace-footer">
          <span>EXERCISE MODEL / {data.state.runs.toLocaleString()} runs</span>
          <span>Source-backed decisions / human review required</span>
        </footer>
      </main>
      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
          <aside
            className="source-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Source evidence"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <span className="eyebrow">{source?.meta?.original_file ? 'NORMALIZED SOURCE RECORD' : 'ORIGINAL EVIDENCE'}</span>
                <h2>
                  {source?.kind === "pdf"
                    ? `Report / page ${source.page}`
                    : "Source record"}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close source evidence"
                onClick={() => setDrawer(false)}
              >
                <X />
              </button>
            </div>
            {sourceLoading ? (
              <Loading text="Opening source record" />
            ) : sourceError ? (
              <p className="error-banner" role="alert">
                {sourceError}
              </p>
            ) : (
              source && (
                <>
                  <p className="source-path mono">{source.file}</p>
                  {source.meta?.original_file && <p>Mapped by {source.meta.adapter}. <SourceButton source={{file: source.meta.original_file, key: 'Open raw export'}} onOpen={openSource} /></p>}
                  <dl className="source-meta">
                    <dt>Source</dt>
                    <dd>{source.meta?.real_system || "Exercise record"}</dd>
                    <dt>As of</dt>
                    <dd>{source.meta?.as_of || "See record timestamp"}</dd>
                    <dt>Steward</dt>
                    <dd>{source.meta?.steward || "Exercise team"}</dd>
                  </dl>
                  {source.meta?.stale && (
                    <div className="warning-line">
                      <Clock3 size={15} />
                      Stale evidence: confirm before relying on it.
                    </div>
                  )}
                  <div className="source-lines">
                    {source.lines.map((line, index) => (
                      <div
                        key={index}
                        className={
                          source.highlight === source.line_numbers?.[index] ||
                          (source.highlight_text &&
                            line.includes(source.highlight_text))
                            ? "highlight"
                            : ""
                        }
                      >
                        <span>{source.line_numbers?.[index] || index + 1}</span>
                        <code>{line}</code>
                      </div>
                    ))}
                  </div>
                </>
              )
            )}
          </aside>
        </div>
      )}
      {confirmation && (
        <div className="modal-backdrop">
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
          >
            <FlaskConical size={28} />
            <h2 id="confirmation-title">{confirmation.title}</h2>
            <p>{confirmation.description}</p>
            <div className="dialog-actions">
              <button
                className="secondary"
                autoFocus
                onClick={() => setConfirmation(null)}
              >
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  setPlaying(false);
                  mutate(confirmation.action);
                }}
              >
                <Check size={16} />
                Confirm exercise change
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MissionRow({
  mission,
  data,
  onFocus,
  onSource,
}: {
  mission: Mission;
  data: Dashboard;
  onFocus: (view: View) => void;
  onSource: (source: SourceRef) => void;
}) {
  const status = tone(eventRisk(mission), data.forecast.bands),
    baseline = data.baseline.missions.find(
      (item) => item.event_id === mission.event_id,
    );
  const delta = baseline?.p_assessed != null && mission.p_assessed != null
      ? Math.round((mission.p_assessed - baseline.p_assessed) * 100)
      : null,
    days = Math.round(
      (Date.parse(mission.start.slice(0, 10)) -
        Date.parse(data.state.cursor.slice(0, 10))) /
        86400000,
    );
  const next = mission.gates.find(
    (gate) => gate.gate_id === mission.next_domino,
  );
  const stale = mission.gates
    .flatMap((gate) => gate.items || [])
    .flatMap((item) => item.sources || [])
    .some((reference) =>
      Object.keys(data.issues.stale).some((path) =>
        reference.file.startsWith(path),
      ),
    );
  return (
    <article className={`mission-row ${status}`}>
      <div className="mission-identity">
        <Status value={mission.p_assessed} bands={data.forecast.bands} />
        <h2>{mission.label}</h2>
        <p>{mission.name}</p>
        {mission.coverage_issues.length > 0 && <details><summary>Insufficient evidence</summary>{mission.coverage_issues.map(issue => <p key={issue}>{issue}</p>)}</details>}
        <span className="mono">
          {days} days out / {dateLabel(mission.start)}
        </span>
        {stale && (
          <span className="stale-badge">
            <Clock3 size={12} />
            Uses stale evidence
          </span>
        )}
      </div>
      <div className="mission-assessment">
        <div className="odds">
          <strong>{percent(mission.p_assessed)}</strong>
          <span className={delta != null && delta < 0 ? "risk" : "muted"}>
            {delta == null
              ? "No baseline"
              : `${delta > 0 ? "+" : ""}${delta} pts vs baseline`}
          </span>
        </div>
        <div className="probability-bar">
          <div style={{ width: percent(mission.p_assessed ?? 0) }} />
          <i style={{ left: percent(data.forecast.bands.amber) }} />
          <i style={{ left: percent(data.forecast.bands.green) }} />
        </div>
        <div className="assessment-detail">
          <span>Across event interval*</span>
          <span>
            At start: <b>{percent(mission.p_ready)}</b>
          </span>
        </div>
        <p className="planned-case">
          Planned at start only: <strong>{mission.planned?.result}</strong>
          {mission.planned?.margin_days != null &&
            ` / ${Math.abs(mission.planned.margin_days).toFixed(1)} days ${mission.planned.margin_days < 0 ? "late" : "margin"}`}
        </p>
      </div>
      <div className="mission-action">
        <span className="eyebrow">NEXT DOMINO</span>
        <h3>{next?.label || "No binding requirement"}</h3>
        <p>
          {next
            ? `${percent(next.p_ok)} meets this requirement across the event interval`
            : mission.coverage_issues.length ? 'Insufficient evidence; readiness is unknown' : 'No material intervention identified'}
        </p>
        <button
          className={status === "risk" ? "primary" : "secondary"}
          onClick={() => onFocus("dominoes")}
        >
          Inspect dependencies
          <ArrowRight size={16} />
        </button>
        <div className="source-chips">
          {mission.sources.slice(0, 1).map((reference) => (
            <SourceButton
              key={reference.file}
              source={reference}
              onOpen={onSource}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function GateEvidence({
  gate,
  onSource,
  onSelect,
}: {
  gate: Gate;
  onSource: (source: SourceRef) => void;
  onSelect: (gate: string) => void;
}) {
  return (
    <details className="gate-evidence" open={(gate.p_ok ?? 0) < 0.6 || undefined}>
      <summary>
        <span>{gate.label}</span>
        <b className="mono">{percent(gate.p_ok)}</b>
      </summary>
      <button className="text-button" onClick={() => onSelect(gate.gate_id)}>
        <Radar size={14} />
        Focus requirement
      </button>
      {gate.items?.length ? (
        gate.items.map((item) => (
          <div className="evidence-item" key={item.key}>
            <strong>{item.title}</strong>
            {item.planned_ready && (
              <small>Planned restoration {dateLabel(item.planned_ready)}</small>
            )}
            {item.ready_p10 && item.ready_p90 && (
              <small>
                Model P10-P90: {dateLabel(item.ready_p10)} to{" "}
                {dateLabel(item.ready_p90)}
              </small>
            )}
            {item.explain?.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <div className="source-chips">
              {item.sources?.map((reference, index) => (
                <SourceButton
                  key={`${reference.file}-${index}`}
                  source={reference}
                  onOpen={onSource}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="muted">No additional record detail is available.</p>
      )}
    </details>
  );
}
