# LOCKER MVP review and implementation plan

## Goal

Deliver a working, read-only decision-support demonstration using synthetic data now. Later, authorized source adapters should replace the synthetic inputs without rewriting the forecast engine or UI.

The demonstration should answer: **Which event is at risk, why, what could improve it, what does that cost other ships, and which records support the assessment?** It must also demonstrate that new source data changes the assessment.

**Delivery status:** the five core implementation items below are now implemented on `feature/locker-readiness-dashboard`. The existing application was extended, not rebuilt. Source replacement is demonstrated with live refresh and a second synthetic export adapter. This is a synthetic prototype, not an operational integration platform.

## Implementation delivered

| Core item | Delivered behavior / implementation |
| --- | --- |
| Replaceable sources and refresh | `sources.py` supplies read-only directory and JSON-export adapters, fingerprinted staging, immutable snapshots, source revisions, and explicit coverage classifications. `/api/sources/refresh` validates/evaluates before activation, retains the active snapshot on failure, preserves compatible playback, and requires explicit reset for changed sources with overlays. Unchanged imports are no-ops. |
| Profile-driven configuration | `profile.py` loads snapshot-local units, equipment/dependencies/weights, watchstations, scenario clock, critical-child cap, schema/mapping version, and optional visual mappings. Tests replace a unit and equipment identity, clock, weights, and input format without engine/UI edits. Unmapped visual equipment stays inspectable without a fabricated mount. |
| Consistent readiness | `p_assessed`/`interval_p_ready` drives headlines, bands, graph, blockers, options, donor comparisons, and briefs. `p_ready` retains its explicitly labeled start-time meaning. The deterministic planned case is labeled start-only. Interval-only blockers are ranked even with `detail=False`; prerequisite interval risk propagates; the material grid covers event ends. |
| Missing/invalid evidence | Required-feed failures and unresolved joins produce `null`/`UNKNOWN`, visible coverage warnings, and withheld fix rankings rather than optimistic results. Latest-known natural-key selection and duplicate-qualification handling prevent inflated personnel counts. |
| Semantic validation | Shared source/world validation checks distributions, thresholds, finite values, profile/entity references, event/prerequisite intervals and cycles, inventory/eligibility, and personnel assignments. Preview and mutation evaluate disposable forks first. Invalid proposals do not change version/log/state; unknown action ships and invalid PDF pages return 422. `/api/ready` complements liveness. |

Additional showcase work delivered:

- Source-health/refresh UI, failed-refresh banners, reported-baseline comparison, and source-health polling independent of scenario version.
- Movement-message constraints on schedule-derived transfer windows; wholesale release/transit/engineering eligibility; explicit modeled/partial/review-only/context/not-modeled labels for remaining feeds.
- Readiness-over-time SVG/table with clearly distinguished point-in-time versus interval probability.
- Current `README.md`, presenter walkthrough, replacement-source exercise, `docs/SOURCES.md`, offline launcher/preflight, JSON-export helper, and isolated browser runner. The old design handoff is preserved in `docs/DESIGN_HANDOFF.md`.
- Direct dependency pins in `requirements-demo.txt` and a GitHub Actions workflow. Hosted CI and container/cluster execution remain unverified.
- Additional extracted date/member/span checks, explicit fact inclusion/exclusion behavior, and numeric/citation preservation guards for optional brief wording. These are not a factual-equivalence or comprehensive PII guarantee.

### Verification after implementation

| Check | Result |
| --- | --- |
| `.venv/Scripts/python.exe -m pytest -q` | **70 passed**; existing Starlette/httpx deprecation warning |
| `npm run typecheck` | **Passed** |
| `npm run build` | **Passed**; large Three.js chunk warning remains |
| `.venv/Scripts/python.exe scripts/check_demo.py` | **8 browser tests passed**, including changed/failed refresh, invalid preview, timeline, and no-WebGL evidence access |
| Offline launcher smoke test | **Passed**, even with `LLM_BASE_URL` configured; readiness OK, 0 ingest issues, 0 configuration errors |
| `git diff --check` | Passed after whitespace cleanup |

The final backend/browser checks ran sequentially. Browser tests owned a temporary dataset, activity log, and API on a free loopback port; they did not reset or modify the existing server on 8000. The source-change acceptance test edits only its disposable copy, observes live revision/forecast changes, generates a current brief, rejects a malformed subsequent import, and restores the copy. The launcher smoke test also used a separate port/log and was shut down afterward.

No real-system connector, live LLM endpoint, hosted CI run, or container/cluster deployment was exercised. Scenario state remains process-local; restart resets it, and the log is not recovery storage. Delayed approvals are validated before applying but do not yet have a separate delay-adjusted comparison UI. Broader 3D/schematic polish, workforce/watchbill optimization, and INSURV scoring remain follow-on scope.

## Original review and verification (before implementation)

Reviewed the application backend, frontend, tests, deployment files, root design handoff, numbered source specifications, synthetic-package README, and the two consolidated research reports. The HTML designs describe additional visual behavior; they are not the deployed application.

Executed against the working tree:

| Check | Result |
| --- | --- |
| `.venv/Scripts/python.exe -m pytest -q` | 42 passed |
| `npm run build` in `web/` | Passed; large Three.js chunk warning |
| `npm run typecheck` in `web/` | Passed |
| `npm run test:e2e` in `web/` | 5 passed |
| Active `data/synthetic` ingestion | 0 ingest issues, 0 configuration errors |

Browser tests used a separate API on port 8011, the existing synthetic data, offline LLM mode, and a temporary activity log. The existing server on port 8000 was not reset or modified. Browser coverage includes source drill-down, ship selection, 3D rendering and clipping, mobile layout, preview/apply/undo, stale-write rejection, four-event replay, ranked fixes, and brief download.

These results establish that the scripted happy path works, not that arbitrary replacement datasets are supported. Container/cluster deployment and a live LLM endpoint were not exercised.

## What already works

- **Synthetic source generation:** `missiontwin/generate.py` generates source-shaped CSV, JSON, text messages, and PDFs.
- **Ingestion and provenance:** `missiontwin/ingest.py` parses records, preserves source references and knowledge times, detects malformed records, and surfaces X1–X10 data-quality cases.
- **Forecasting:** `missiontwin/engine.py` implements seeded Monte Carlo, a deterministic planned case, system and personnel requirements, training/certification checks, availability risk, and event prerequisites.
- **Scenario control:** ordered event playback, shared version checks, isolated previews, apply, undo, reset, and an activity log.
- **Options:** `missiontwin/fixes.py` evaluates parts transfers, program-office/wholesale sourcing, cannibalization, personnel loans, training, and schedule shifts with donor consequences.
- **UI:** `web/src/Workspace.tsx` and `Panels.tsx` provide mission overview, squadron context, evidence, options, what-if proposals, briefs, and activity history.
- **Visuals:** `ShipView.tsx` provides an illustrative DDG with interactive pins, cameras, X-ray, section clipping, and a material-date slider. `DominoGraph.tsx` provides an interactive dependency graph.
- **Offline operation:** rules-based document extraction, structured actions, and template briefs work without a model endpoint. LLM output does not calculate readiness probabilities.
- **Packaging foundations:** a combined frontend/backend Dockerfile, Kubernetes manifest, and Zarf configuration exist.

### Original observed demonstration, not a target to hard-code

With the current canonical dataset and default 10,000-run forecast, Mission A's start-time probability progresses approximately:

`93.2% baseline -> 85.0% casualty -> 19.5% supply delay -> 0% personnel news -> 0% earlier schedule`

After all four events, the top package is the Varnell spare pump plus an Ashby qualified-person loan. Applying it produced approximately **98.3% at Mission A start and 95.5% across its sampled interval**. These are illustrative model estimates under the current assumptions, not operational performance claims. The ranker uses 2,000 runs, so its displayed result differs slightly from the 10,000-run dashboard.

## Important data-profile distinction

There are two different exercises, not two interchangeable copies of one dataset:

| Path | Current role |
| --- | --- |
| `data/synthetic/` | Active forecast input generated by `missiontwin.generate` |
| `data_sources/Synthetic Data/` | Separate reference exercise with different equipment identities and temporal formats |
| `data/normalized/` | Review-only normalization output; not consumed by the forecast |

The current normalization report contains **7,721 records**, including **763 with record-level review reasons**. Every normalized record is deliberately `forecast_eligible: false`.

`missiontwin/normalize.py` verifies reference-package hashes and records compatibility issues. It does not implement a production ingestion adapter or activate this dataset. Keep the reference exercise separate until equipment/qualification mappings and historical timestamps are explicitly reconciled. Do not silently merge it into the canonical exercise.

## Source coverage: parsed is not the same as used

| Source family | Current runtime use | Remaining scope |
| --- | --- | --- |
| CASREP + OMMS-NG/CSMP | Active equipment impairments, repair chains, evidence | Multi-part jobs, shared physical assets, broader lifecycle validation |
| R-Supply/MILSTRIP + onboard stock | Arrival forecasts, inventory, supported status histories, latest-known revisions | New source vocabularies still require explicit mapping; no arbitrary MILSTRIP schema support |
| Wholesale/program-office stock | Stock eligibility, release/transit/engineering delays and fix candidates | Supported synthetic fields only; not a real allocation/authorization workflow |
| R-ADM roster + qualifications | Latest-known personnel/qualification rows, gaining/absence/transfer status, expiry, supported report facts | Not a general personnel-order ingestion or watchbill optimization service |
| Watchbills + FLTMPS billets | Data-quality checks | Not a sustainable watch-rotation or NEC staffing forecast |
| SKED/PMS | Lost-PMS hazard multiplier and contradiction checks | Maintenance labor competition, IEM availability, reporting-quality prior not implemented |
| MFOM tree + ROC/POE | Runtime tree/weights/cap loaded from validated profile; ROC/POE assignment context | New rollup algorithms and automatic cross-system identity resolution are not supported |
| DRRS-like baseline | Reported values displayed separately in Evidence & feed | Not a calibration target or forecast probability; reset baseline remains an independent calculation |
| Training + certifications + availabilities | Forecast requirements, expiration, availability completion | Not a full scheduler that propagates all certification dates |
| OFRP schedule | Mission dates, transfer windows, prerequisite/interval validation | Not a full resource-constrained operational scheduler |
| MOVREP/LOGREQ + positions | Movement messages constrain schedule-derived transfer/delivery windows | Positions are explicitly context-only; no route or speed model |
| Daily reports | PDF extraction, selected personnel/assist facts, date/member/span guards, explicit inclusion/exclusion | Broader formats and full semantic equivalence remain outside scope |
| INSURV | Parsed | Optional material prior not implemented; not needed for the core demo |
| Catalog + assumptions | Source health, parsed/issue counts, extract freshness, revisions, coverage classifications, cross-field constraints | Real connector operational health and durable ingestion history remain future integration work |

## Original must-fix findings — all five addressed

The evidence and implementation requests in this section describe the **pre-implementation review**, retained to explain the changes. The delivered behavior and current verification are recorded above; the old failure examples are now regression cases, not claims about current behavior.

### 1. Make source replacement a demonstrated feature

**Evidence:** `AppState.__init__` in `missiontwin/api.py` calls `load_baseline` once. The UI polls scenario version, not source changes. There is no import/reload endpoint or ingestion scheduler. `MISSIONTWIN_DATA` changes the directory, but requires the same demo contract and a new app state/process. `/api/data-contract` still reports the literal canonical path even with a different configured directory.

Implement:

- A versioned source/profile contract and a file-backed adapter around the current loader.
- An explicit **Refresh sources** operation, with optional polling later.
- Stage and validate a new snapshot before activating it atomically.
- Retain the last usable snapshot when a refresh fails; clearly mark failures and stale results.
- Separate source revision from scenario revision; include both in caches and API responses.
- Define what happens to what-if overlays when the underlying sources change. Do not silently discard or blindly reapply incompatible decisions.
- Add source status, record counts, last successful refresh, rejected-record counts, and whether each source influences the model.

**Acceptance:** change a supply estimate in a second synthetic snapshot, refresh it, and observe changed mission odds, graph, ship assessment, source evidence, and brief without restarting or editing application code. Reimporting the same snapshot must not duplicate records.

### 2. Separate domain configuration from demo constants

**Evidence:** `missiontwin/domain.py` hard-codes ships, systems, components, watchstations, areas, and scenario time. `load_baseline` rejects a mission tree that differs from `mission_tree_json()`. `visualization.py` has a fixed DDG system/mount registry.

Implement a validated profile containing the unit registry, equipment hierarchy, mission assignments, identities, scenario clock, and visual mappings. Keep the current configuration as the default demo profile. Preserve string identifiers and UTC dates; track schema/mapping versions.

**Acceptance:** a compatible alternate profile or differently shaped synthetic export can be adapted without changing the engine/UI. Unknown equipment is explicitly unmapped, not silently treated as ready. This does not require supporting every ship class in the MVP.

### 3. Make readiness meaning consistent across screens and ranking

**Observed:** at reset, Mission A is about **93.2% ready at start but 0% across the interval**. Its original schedule is 16–22 November, spanning the AW training expiration and a gap before refresh. This is a genuine modeled interval blocker, not necessarily a wrong probability.

However:

- `Workspace.tsx` sorts and highlights using the worse of start/interval readiness.
- `MissionRow` displays its status badge using start-time readiness.
- `next_domino`, graph nodes, the planned case, and fix ranking use start-time requirements.
- `fixes.py` skips missions whose start probability is green, even if their interval is at risk.
- Ranking calls `forecast(..., detail=False)`, which does not calculate interval readiness.
- The material date grid ends on 29 November while Mission B ends on 5 December: `horizon_days` uses the last event start plus three days.

Choose and document a primary assessment basis. Display both measures if useful, but align the headline, status, blocker explanation, graph, ranking, and brief with the chosen basis. Include interval-only blockers in options. Extend the visible forecast horizon through event ends. Explain existing baseline risk rather than tuning data to force an all-green opening.

**Acceptance:** an event that starts healthy but loses training or personnel mid-event is consistently flagged and explained; its fix comparison evaluates that failure too.

### 4. Prevent missing or invalid data from looking healthy

**Evidence:** `_system_scores` in `engine.py` defaults components without impairment evidence to score `1.0`. That is reasonable only when a complete source snapshot is known to represent all current deficiencies. Missing or quarantined records can otherwise remove evidence of a failure without making the resulting uncertainty explicit.

Implement completeness/coverage state separately from readiness. Required source failures and unresolved equipment joins must propagate an unknown or insufficient-evidence assessment. Do not assign a manufactured probability to missing information. Select the latest known revision per entity; avoid counting repeated qualifications as additional people.

**Acceptance:** missing maintenance data or an unknown mission-critical EIC produces a visible coverage warning/unknown assessment, not improved readiness.

### 5. Validate changes before committing them

**Reproduced:** the preview endpoint accepts `repair_after_part_days.min = 3` while mode remains 2, generating an invalid-square-root warning. It also accepts `bands.amber = 0.99` while green remains 0.80. An unknown ship sent to `/api/actions/parse` returns 500 rather than a client validation error.

Implement shared semantic validation for preview and apply:

- `min <= mode <= max`, valid distribution ranges, finite numbers, `amber <= green`.
- Valid entity references, event time ranges, prerequisite cycles/missing prerequisites, and appropriate JSON-record isolation.
- Resource/eligibility checks for transfers, personnel loans, and combined packages.
- Candidate evaluation before committing a shared mutation; failed validation must not alter version/log/state.
- Configuration/readiness health checks in addition to a process-alive endpoint.

**Acceptance:** invalid proposals and malformed source records return actionable errors and never poison the shared scenario.

## Showcase follow-ons and delivered portions

1. **Guided demo and timeline — delivered.** Presenter walkthrough and explicit point-in-time SVG/table are included. A dedicated before/after injection animation is optional polish.
2. **Fix comparison — interval logic and validation delivered.** Source-linked receiver/donor comparisons remain available. Separate delay-adjusted previews, richer before/after inventory presentation, and transfer-date visualization are still follow-ons; the immediate-comparison warning remains explicit.
3. **Source-specific connections — selectively delivered/labeled.** Movement constraints, wholesale eligibility/lead times, roster status/expiry and qualification revisions, and reported baseline display are implemented. Other feeds are explicitly classified rather than claiming every loaded record affects readiness. General personnel-order adapters remain future work.
4. **Explanation chain — existing source-linked graph retained and interval-aligned.** A more granular physical-asset/part/requisition ontology is optional; current items carry repair-chain sources and explanations.
5. **3D polish — safe unmapped-mount handling and tested fallback delivered.** The current fallback remains a message plus an interactive system/evidence list, not a new 2D ship schematic. Projected labels and richer print geometry remain follow-ons.
6. **Runbook/reproducibility — delivered locally.** README, source contract, launcher/preflight, isolated runner, direct dependency pins and CI workflow exist. Restart-reset behavior is documented. A transitive hash lock, hosted CI validation, container smoke testing, and save/load are not claimed.
7. **Optional LLM hardening — bounded guards delivered.** Offline mode is verified, extraction checks dates/member/span support, brief rewriting must preserve numeric/citation tokens, and fallback method is visible. These guards do not prove factual equivalence or comprehensive PII removal.

## Deliberately defer

- Full walk-in compartments, animated split hulls, section-cap equipment art, and all nine hull classes from `README.md` / `Ship 3D.html`.
- Photorealistic or authoritative ship geometry; current geometry must remain labeled illustrative.
- A live connector to every Navy system. Their official schemas and access arrangements are not established by this repository's research.
- Full watchbill optimization, maintenance workforce scheduling, and INSURV calibration.
- Fleet-scale deployment, multi-tenant workflow, and operational approval automation.

The prototype must remain synthetic and read-only. Authentication, authorization, stronger data handling, approved hosting, classification review, and authorized access are requirements before real-data use, not capabilities conferred by the existing Kubernetes/Zarf files.

## Recommended architecture: evolve the current code

```text
Synthetic files now / authorized exports or APIs later
                          |
                 Source-specific adapter
                          |
    Validation + identity mapping + provenance + known/effective time
                          |
          Versioned canonical snapshot + ingestion report
                          |
       Existing forecast engine + isolated scenario overlays
                          |
              Existing FastAPI -> React workspace
```

Start with a lightweight adapter boundary, not a new integration platform. Reuse `Baseline`, `SourceRef`, the API boundary, and the existing tests where possible. A second synthetic adapter/export format is enough to demonstrate interchangeability. Real-source adapters will still need approved schemas, mappings, and temporal semantics.

## Original implementation sequence and current definition of done

1. **Done:** readiness consistency, semantic validation, unknown-data handling and regressions.
2. **Done:** profile/adapter boundary, atomic refresh and source health.
3. **Done:** alternate JSON export, alternate unit/equipment/clock/weights, and live replacement proof.
4. **Done for the core showcase:** guided sequence, forecast timeline, interval fix trade-offs, safe mount handling and tested non-WebGL list. Richer delay previews and visual polish remain explicitly scoped above.
5. **Done locally:** launcher/runbook, CI definition, direct pins, offline/preflight checks and browser rehearsal. Hosted CI/container validation remains unperformed.

MVP acceptance checklist:

- [x] One documented command starts a usable offline demo.
- [x] Reset produces a reproducible baseline; no external model/network is required.
- [x] The four events visibly update the assessment and explain the changes.
- [x] Critical modeled claims link to source records or labeled assumptions.
- [x] A hypothetical package is compared before human confirmation; donor effects are visible.
- [x] Start-time and interval readiness use consistent labels and decision logic.
- [x] A source refresh changes the assessment without restart or UI/engine edits.
- [x] Duplicate, malformed, unmapped, missing, and stale inputs have tested behavior.
- [x] Source files remain read-only; scenario overlays can be undone/reset.
- [x] A current brief can be downloaded with evidence and synthetic markings.
- [x] The demo remains usable without WebGL or a live LLM.

Regression additions are in `tests/test_source_refresh.py`, `tests/test_llm_guards.py`, and `web/tests/sources.spec.ts`; the existing scenario assertion now compares interval-to-interval rather than start-to-interval. `scripts/check_demo.py` makes the refresh proof reproducible without touching an existing demo session. This review is tracked alongside the implementation on `feature/locker-readiness-dashboard`.
