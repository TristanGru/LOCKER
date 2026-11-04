import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  FlaskConical,
  ListChecks,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { api } from "./api";
import type {
  Dashboard,
  Fix,
  Mission,
  Preview,
  Proposal,
  Ranking,
  SourceRef,
} from "./types";
import { dateLabel, Loading, percent, SourceButton, tone } from "./ui";

export function FixesPanel({
  ship,
  data,
  onConfirm,
}: {
  ship: string;
  data: Dashboard;
  onConfirm: (fix: Fix, decision: "approve" | "reject", delay: number) => void;
}) {
  const [ranking, setRanking] = useState<Ranking | null>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(0),
    [delay, setDelay] = useState(0);
  useEffect(() => {
    let live = true;
    setRanking(null);
    setError("");
    setSelected(0);
    api
      .fixes(ship)
      .then((value) => {
        if (live) setRanking(value);
      })
      .catch((failure) => {
        if (live) setError(String(failure));
      });
    return () => {
      live = false;
    };
  }, [ship, data.state.version]);
  const fix = ranking?.candidates[selected];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{ship} / HUMAN DECISION REQUIRED</div>
          <h1>Resolve the blockers. See the trade-offs.</h1>
          <p>
            Ranked by squadron outcomes, receiver improvement, and donor cost.
          </p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="error-banner">
          {error}
        </p>
      ) : !ranking ? (
        <Loading text="Comparing exercise options across all three ships" />
      ) : !fix ? (
        <div className="empty-state">
          <ListChecks size={28} />
          <h2>No fix candidates for this state</h2>
          <p>Advance the scenario or inspect the current requirements.</p>
        </div>
      ) : (
        <div className="comparison-layout">
          <div className="candidate-list">
            {ranking.candidates.map((candidate, index) => (
              <button
                key={candidate.fix_id}
                className={selected === index ? "selected" : ""}
                onClick={() => setSelected(index)}
              >
                <span className="mono">
                  {String(candidate.rank).padStart(2, "0")}
                </span>
                <span>
                  <strong>{candidate.title}</strong>
                  <small>
                    {candidate.net_green > 0 ? "+" : ""}
                    {candidate.net_green} squadron events green
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <section className="comparison-detail">
            <span className="eyebrow">PROPOSED PACKAGE / NOT APPLIED</span>
            <h2>{fix.title}</h2>
            {fix.why?.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {fix.missions.map((mission) => (
                    <tr key={mission.event_id}>
                      <td>
                        {mission.ship_id}
                        <small>{mission.label}</small>
                      </td>
                      <td className="mono">{percent(mission.p_before)}</td>
                      <td className="mono">{percent(mission.p_after)}</td>
                      <td
                        className={
                          mission.p_after - mission.p_before < 0
                            ? "risk"
                            : "ready"
                        }
                      >
                        {Math.round((mission.p_after - mission.p_before) * 100)}{" "}
                        pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Donor consequences</h3>
            {Object.entries(fix.donor_effects).length ? (
              Object.entries(fix.donor_effects).map(([donor, effect]) => (
                <p key={donor} className="warning-line">
                  <TriangleAlert size={16} />
                  <span>
                    {donor}: event probability change{" "}
                    {(effect.mission_p_delta * 100).toFixed(1)} pts; modeled
                    capability change{" "}
                    {(effect.capability_delta * 100).toFixed(1)} pts
                  </span>
                </p>
              ))
            ) : (
              <p className="muted">
                No donor impact detected by this exercise model.
              </p>
            )}
            <details>
              <summary>Package steps and assumptions</summary>
              <pre>{JSON.stringify(fix.steps, null, 2)}</pre>
            </details>
            <label className="field">
              Approval delay (days)
              <input
                aria-label="Approval delay days"
                type="number"
                min="0"
                max="30"
                value={delay}
                onChange={(event) => setDelay(Number(event.target.value))}
              />
            </label>
            {delay > 0 && (
              <p className="warning-line">
                The comparison assumes immediate approval. Delayed application
                will recalculate the scenario and may produce a different
                result.
              </p>
            )}
            <div className="button-row">
              <button
                className="primary"
                disabled={delay < 0 || delay > 30}
                onClick={() => onConfirm(fix, "approve", delay)}
              >
                <Check size={16} />
                Apply to exercise
              </button>
              <button
                className="secondary"
                onClick={() => onConfirm(fix, "reject", delay)}
              >
                Record rejection
              </button>
            </div>
            <p className="fine-print">
              {ranking.runs_per_candidate.toLocaleString()} common-seed runs per
              candidate. No real transfers or approvals are issued.
            </p>
          </section>
        </div>
      )}
    </>
  );
}

export function WhatIfPanel({
  ship,
  mission,
  data,
  onApply,
}: {
  ship: string;
  mission: Mission;
  data: Dashboard;
  onApply: (proposal: Proposal) => void;
}) {
  const [kind, setKind] = useState("shift_mission"),
    [record, setRecord] = useState(""),
    [days, setDays] = useState(2),
    [when, setWhen] = useState("2026-11-10T00:00"),
    [until, setUntil] = useState(""),
    [category, setCategory] = useState(3);
  const [key, setKey] = useState("transit_days_conus_default"),
    [value, setValue] = useState(7);
  const [preview, setPreview] = useState<Preview | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [text, setText] = useState("");
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const inputVersion = useRef(0);
  useEffect(() => {
    api
      .schema()
      .then((schema) =>
        setActionTypes(
          schema.types.filter((type: string) => type !== "apply_fix"),
        ),
      )
      .catch((failure) => setError(String(failure)));
  }, []);
  useEffect(() => {
    inputVersion.current++;
    setPreview(null);
  }, [
    kind,
    record,
    days,
    when,
    until,
    key,
    value,
    ship,
    mission?.event_id,
    data.state.version,
    category,
    text,
  ]);
  const assumption = data.assumptions.editable.find(
    (item) => item.path === key,
  );
  async function calculate(proposal?: Proposal) {
    setLoading(true);
    setError("");
    const generation = inputVersion.current;
    try {
      let action: Record<string, unknown> = { type: kind, ship_id: ship };
      if (kind === "shift_mission")
        action = { type: kind, event_id: mission.event_id, days };
      if (kind === "delay_part")
        action = { ...action, doc_number: record, days };
      if (kind === "remove_person")
        action = {
          ...action,
          member_id: record,
          from_time: `${when}:00Z`,
          until_time: until ? `${until}:00Z` : null,
          reason: "Exercise preview",
        };
      if (kind === "add_casrep")
        action = {
          ...action,
          eic: record || "SPY1D-CW",
          category,
          etr: `${when}:00Z`,
        };
      const result = await api.preview(
        data.state.version,
        proposal ||
          (kind === "assumption"
            ? { kind: "set_assumption", key, value }
            : { kind: "action", action }),
      );
      if (generation === inputVersion.current) setPreview(result);
    } catch (failure) {
      setError(String(failure));
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ISOLATED PREVIEW</div>
          <h1>Test a change before committing.</h1>
          <p>
            The shared exercise and its source files remain untouched until you
            apply a proposal.
          </p>
        </div>
      </div>
      <div className="whatif-layout">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            calculate();
          }}
          className="proposal-form"
        >
          <label className="field">
            Proposal
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setRecord("");
              }}
            >
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
              <option value="assumption">Change model assumption</option>
            </select>
          </label>
          {kind === "shift_mission" && (
            <p>
              {mission.label} / {mission.name}
            </p>
          )}
          {["delay_part", "remove_person"].includes(kind) && (
            <label className="field">
              {kind === "delay_part"
                ? "Requisition document number"
                : "Synthetic member ID"}
              <input
                required
                value={record}
                onChange={(event) => setRecord(event.target.value)}
                placeholder={
                  kind === "delay_part" ? "R991016308A001" : "M-0019"
                }
              />
            </label>
          )}
          {kind === "add_casrep" && (
            <>
              <label className="field">
                System or component
                <select
                  value={record || "SPY1D-CW"}
                  onChange={(event) => setRecord(event.target.value)}
                >
                  {[
                    ...new Set([
                      ...data.visualization.systems.map((item) => item.eic),
                      ...Object.keys(data.visualization.component_to_system),
                    ]),
                  ].map((eic) => (
                    <option key={eic}>{eic}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Category
                <select
                  value={category}
                  onChange={(event) => setCategory(Number(event.target.value))}
                >
                  {[2, 3, 4].map((number) => (
                    <option key={number}>{number}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {["shift_mission", "delay_part"].includes(kind) && (
            <label className="field">
              Days to shift
              <input
                type="number"
                required
                min={kind === "delay_part" ? -60 : -30}
                max={kind === "delay_part" ? 365 : 60}
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              />
            </label>
          )}
          {["remove_person", "add_casrep"].includes(kind) && (
            <label className="field">
              {kind === "remove_person"
                ? "Absence begins (UTC)"
                : "Estimated repair (UTC)"}
              <input
                required
                type="datetime-local"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
              />
            </label>
          )}
          {kind === "remove_person" && (
            <label className="field">
              Return (UTC, optional)
              <input
                type="datetime-local"
                value={until}
                onChange={(event) => setUntil(event.target.value)}
              />
            </label>
          )}
          {kind === "assumption" && (
            <>
              <label className="field">
                Editable parameter
                <select
                  value={key}
                  onChange={(event) => {
                    setKey(event.target.value);
                    setValue(
                      data.assumptions.editable.find(
                        (item) => item.path === event.target.value,
                      )?.value || 0,
                    );
                  }}
                >
                  {data.assumptions.editable.map((item) => (
                    <option value={item.path} key={item.path}>
                      {item.path}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Proposed value
                <input
                  type="number"
                  step="any"
                  min={assumption?.min}
                  max={assumption?.max}
                  value={value}
                  onChange={(event) => setValue(Number(event.target.value))}
                />
              </label>
              <p className="fine-print">
                {assumption?.tag} / {assumption?.source}
              </p>
            </>
          )}
          <button className="primary" disabled={loading}>
            {loading ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <FlaskConical size={16} />
            )}
            Calculate preview
          </button>
          <details className="language-proposal">
            <summary>Propose in plain language</summary>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              aria-label="Plain language proposal"
            />
            <button
              type="button"
              className="secondary"
              disabled={loading || !text.trim()}
              onClick={async () => {
                setError("");
                try {
                  const response = await api.parse(text, ship);
                  if (response.action && response.action.type !== "apply_fix")
                    await calculate({
                      kind: "action",
                      action: response.action,
                    });
                  else
                    setError(
                      response.note || "Use the structured proposal fields.",
                    );
                } catch (failure) {
                  setError(String(failure));
                }
              }}
            >
              Parse and preview
            </button>
          </details>
        </form>
        <section className="preview-results">
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          {preview ? (
            <>
              <div className="eyebrow">
                PREVIEW ONLY / BASE VERSION {preview.base_version}
              </div>
              <h2>Consequences across the squadron</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Start odds before</th>
                      <th>After</th>
                      <th>Interval after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.after.missions.map((item) => (
                      <tr key={item.event_id}>
                        <td>
                          {item.ship_id}
                          <small>
                            {item.label} / {dateLabel(item.start)}
                          </small>
                        </td>
                        <td>
                          {percent(
                            preview.before.missions.find(
                              (before) => before.event_id === item.event_id,
                            )?.p_ready,
                          )}
                        </td>
                        <td className={tone(item.p_ready, preview.after.bands)}>
                          {percent(item.p_ready)}
                        </td>
                        <td>{percent(item.interval_p_ready)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details open>
                <summary>Exact proposed change</summary>
                <pre>{JSON.stringify(preview.proposal, null, 2)}</pre>
              </details>
              <button
                className="primary"
                disabled={preview.base_version !== data.state.version}
                onClick={() => onApply(preview.proposal)}
              >
                <Check size={16} />
                Review and apply
              </button>
            </>
          ) : (
            <div className="empty-state">
              <FlaskConical size={32} />
              <h2>No proposal calculated</h2>
              <p>
                Current exercise version {data.state.version} remains unchanged.
              </p>
            </div>
          )}
        </section>
      </div>
      <details className="assumptions-ledger">
        <summary>Model assumptions and provenance</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {data.assumptions.rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    {row.key}
                    {row.edited && <small>Edited in exercise</small>}
                  </td>
                  <td>
                    <code>{JSON.stringify(row.value)}</code>
                  </td>
                  <td>
                    {row.tag}
                    <small>{row.source}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

interface Fact {
  fact_id: string;
  type: string;
  status: string;
  feeds_engine: boolean;
  corroboration: string;
  doc: string;
  page: number;
  span: string;
  method: string;
  reason: string;
  corroboration_note: string;
}
interface Contract {
  active_path: string;
  catalog: { file: string; real_system: string }[];
  reference: {
    activation: string;
    normalized_record_count: number;
    quarantined_record_count: number;
    reference_only_systems: string[];
    canonical_only_systems: string[];
    required_before_activation: string[];
    datasets: { file: string; record_count: number }[];
  } | null;
}

function DataProfiles({ onSource }: { onSource: (source: SourceRef) => void }) {
  const [contract, setContract] = useState<Contract | null>(null),
    [profile, setProfile] = useState<"canonical" | "reference">("canonical"),
    [file, setFile] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    api
      .dataContract()
      .then(setContract)
      .catch((failure) => setError(String(failure)));
  }, []);
  const files = (
    profile === "canonical"
      ? contract?.catalog || []
      : contract?.reference?.datasets || []
  ).filter((item) => !item.file.endsWith("/") && !item.file.endsWith(".pdf"));
  return (
    <section className="data-profiles">
      <div className="section-heading">
        <h2>Data profiles</h2>
        <span>Explicit source separation</span>
      </div>
      {error && <p role="alert">{error}</p>}
      {contract && (
        <>
          <div className="profile-controls">
            <label className="field">
              Profile
              <select
                aria-label="Profile"
                value={profile}
                onChange={(event) => {
                  setProfile(event.target.value as "canonical" | "reference");
                  setFile("");
                }}
              >
                <option value="canonical">Canonical / active forecast</option>
                <option value="reference">
                  Earlier synthetic package / review only
                </option>
              </select>
            </label>
            <label className="field">
              Dataset
              <select
                aria-label="Dataset"
                value={file || files[0]?.file || ""}
                onChange={(event) => setFile(event.target.value)}
              >
                {files.map((item) => (
                  <option key={item.file} value={item.file}>
                    {item.file}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary"
              disabled={!files.length}
              onClick={() => onSource({ file: file || files[0].file, profile })}
            >
              <FileText size={15} />
              Open source
            </button>
          </div>
          {profile === "reference" && contract.reference ? (
            <>
              <p className="warning-line">
                REVIEW ONLY /{" "}
                {contract.reference.normalized_record_count.toLocaleString()}{" "}
                normalized records;{" "}
                {contract.reference.quarantined_record_count.toLocaleString()}{" "}
                require record-level review. None are merged into the active
                exercise.
              </p>
              <details>
                <summary>Compatibility and activation requirements</summary>
                <p className="fine-print">
                  Reference-only systems:{" "}
                  {contract.reference.reference_only_systems.join(", ")}.
                  Canonical-only systems:{" "}
                  {contract.reference.canonical_only_systems.join(", ")}.
                </p>
                <ul>
                  {contract.reference.required_before_activation.map(
                    (requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ),
                  )}
                </ul>
              </details>
            </>
          ) : (
            <p className="fine-print">
              Active scenario: {contract.active_path}. Five mission areas;
              canonical identifiers and versioned source records.
            </p>
          )}
        </>
      )}
    </section>
  );
}
export function EvidencePanel({
  ship,
  data,
  onSource,
  onConfirmFact,
}: {
  ship: string;
  data: Dashboard;
  onSource: (source: SourceRef) => void;
  onConfirmFact: (factId: string, include: boolean) => void;
}) {
  const [facts, setFacts] = useState<Fact[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setFacts(null);
    api
      .facts(ship)
      .then((result) => {
        if (live) setFacts(result.facts);
      })
      .catch((failure) => {
        if (live) setError(String(failure));
      });
    return () => {
      live = false;
    };
  }, [ship, data.state.version]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PROVENANCE / REVIEW</div>
          <h1>Know what the assessment rests on.</h1>
          <p>
            Source timestamps, conflicting records, and tentative claims remain
            visible.
          </p>
        </div>
      </div>
      <DataProfiles onSource={onSource} />
      <section>
        <div className="section-heading">
          <h2>Exercise change feed</h2>
          <span>
            {data.state.feed.filter((item) => item.played).length} applied
          </span>
        </div>
        <div className="feed-list">
          {data.state.feed.map((event) => (
            <article
              key={event.event_id}
              className={event.played ? "played" : ""}
            >
              {event.played ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}
              <div>
                <span className="eyebrow">
                  {event.event_id} / {event.known_dtg}
                </span>
                <h3>{event.title}</h3>
                {event.played && (
                  <div className="source-chips">
                    {event.refs.map((reference) => {
                      const [file, loc] = reference.split("#");
                      return (
                        <SourceButton
                          key={reference}
                          source={{ file, loc }}
                          onOpen={onSource}
                        />
                      );
                    })}
                  </div>
                )}
                {!event.played && (
                  <small className="muted">
                    Scheduled exercise injection; not yet used in the
                    assessment.
                  </small>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section>
        <div className="section-heading">
          <h2>Review queue</h2>
          <span>
            {data.issues.contradictions.length +
              data.issues.ingest_issues.length}{" "}
            items
          </span>
        </div>
        {[...data.issues.contradictions, ...data.issues.ingest_issues].map(
          (issue, index) => (
            <article className="review-row" key={index}>
              <TriangleAlert size={19} />
              <div>
                <h3>{issue.id || issue.kind || "Source issue"}</h3>
                <p>{issue.detail || issue.reason}</p>
                <div className="source-chips">
                  {(
                    issue.sources ||
                    (issue.file ? [{ file: issue.file, loc: issue.loc }] : [])
                  ).map((reference, position) => (
                    <SourceButton
                      key={position}
                      source={reference}
                      onOpen={onSource}
                    />
                  ))}
                </div>
              </div>
            </article>
          ),
        )}
        {!data.issues.contradictions.length &&
          !data.issues.ingest_issues.length && (
            <p className="muted">
              No contradictions detected in the information known at this point.
            </p>
          )}
      </section>
      <section>
        <div className="section-heading">
          <h2>Source freshness</h2>
          <span>{Object.keys(data.issues.stale).length} stale extracts</span>
        </div>
        {Object.entries(data.issues.stale).map(([file, metadata]) => (
          <div className="freshness-row" key={file}>
            <Clock3 size={16} />
            <SourceButton source={{ file }} onOpen={onSource} />
            <span className="mono">
              {metadata.age_days == null
                ? "Stale"
                : `${Number(metadata.age_days).toFixed(1)} days old`}
            </span>
          </div>
        ))}
      </section>
      <section>
        <div className="section-heading">
          <h2>Report facts / {ship}</h2>
          <span>Extracted evidence, not test fixtures</span>
        </div>
        {error && <p role="alert">{error}</p>}
        {facts === null ? (
          <Loading text="Loading report facts" />
        ) : facts.length === 0 ? (
          <p className="muted">
            No report facts are known at this scenario time.
          </p>
        ) : (
          facts.map((fact) => (
            <article className="fact-row" key={fact.fact_id}>
              <div>
                <span
                  className={`fact-tag ${fact.feeds_engine ? "ready" : "watch"}`}
                >
                  {fact.feeds_engine ? "USED BY MODEL" : "NOT USED"}
                </span>
                <h3>{fact.type.replaceAll("_", " ")}</h3>
                <p>{fact.span}</p>
                <small>
                  {fact.status} / {fact.corroboration} / {fact.method}
                </small>
                {fact.reason && <p>{fact.reason}</p>}
                <div className="source-chips">
                  <SourceButton
                    source={{
                      file: fact.doc,
                      loc: `page ${fact.page}`,
                      span: fact.span,
                    }}
                    onOpen={onSource}
                  />
                </div>
              </div>
              <div className="button-row">
                <button
                  className="secondary compact"
                  onClick={() => onConfirmFact(fact.fact_id, true)}
                >
                  Confirm inclusion
                </button>
                <button
                  className="text-button"
                  onClick={() => onConfirmFact(fact.fact_id, false)}
                >
                  Exclude
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}

export function BriefPanel({
  ship,
  version,
  onSource,
}: {
  ship: string;
  version: number;
  onSource: (source: SourceRef) => void;
}) {
  const [brief, setBrief] = useState<{
      text: string;
      citations: SourceRef[];
      source: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setBrief(null);
  }, [ship, version]);
  function download() {
    if (!brief) return;
    const url = URL.createObjectURL(
      new Blob([brief.text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `LOCKER-${ship}-exercise-v${version}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{ship} / CITED EXERCISE SUMMARY</div>
          <h1>A brief ready for review.</h1>
          <p>
            Based on the current exercise version, including recorded decisions.
          </p>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            const request = generation.current;
            setBusy(true);
            setError("");
            try {
              const result = await api.brief(ship);
              if (request === generation.current) setBrief(result);
            } catch (failure) {
              setError(String(failure));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <FileText size={16} />
          )}
          Generate brief
        </button>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {brief ? (
        <>
          <div className="brief-toolbar">
            <span className="mono">
              Version {version} / {brief.source}
            </span>
            <button className="secondary" onClick={download}>
              <Download size={16} />
              Download text
            </button>
            <button className="secondary" onClick={() => window.print()}>
              <FileText size={16} />
              Print / PDF
            </button>
          </div>
          <article className="brief-document">
            <div className="eyebrow">
              SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA
            </div>
            <pre>{brief.text}</pre>
          </article>
          <section className="brief-citations">
            <h2>Source citations</h2>
            {brief.citations.map((reference, index) => (
              <SourceButton key={index} source={reference} onOpen={onSource} />
            ))}
          </section>
        </>
      ) : (
        !busy && (
          <div className="empty-state">
            <FileText size={32} />
            <h2>No brief generated for this version</h2>
            <p>
              Generate a current brief after reviewing the event and its
              supporting records.
            </p>
          </div>
        )
      )}
    </>
  );
}
