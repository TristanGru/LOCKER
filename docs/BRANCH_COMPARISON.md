# Branch comparison: readiness dashboard vs. Sakie's frontend

## Scope and compared revisions

This report compares the following snapshots, not the moving tips of the branches:

| Branch | Reviewed commit |
| --- | --- |
| `feature/locker-readiness-dashboard` (current implementation) | `1be843cdec85a439655f9c90df686771f25e3d0a` — Complete LOCKER readiness MVP with source refresh and validation |
| `origin/Sakie's-Frontend` | `4c404676a4cea35428d276a40871a5f92c4c01fd` — Add the captain readiness frontend so the team can run it from web/ |

Common ancestor: `93b9b2862fb254890661c9cc62102c6a3a5b9652`.

Sakie's branch was fetched and inspected in an isolated detached worktree. The comparison did not merge either branch, switch the active feature branch, or change the running demo. Paths below refer to the branch named in the surrounding section; some files exist only on that branch.

To reproduce the code comparison after this documentation commit:

```bash
git fetch origin
git diff --stat 1be843c 4c40467
git diff 1be843c 4c40467 -- missiontwin web
```

## Executive conclusion

**The current branch is stronger as an integrated, source-driven prototype. Sakie's branch has a more extensive presentation layer and useful backend extraction improvements.**

Sakie's frontend and Python backend do **not** have a compatible end-to-end API contract. Its default frontend demonstration runs against a separate in-browser mock server and calculation engine. That mock is interactive and recalculates results; it is not merely a collection of static screens. However, it does not demonstrate that changes to the Python backend's source files update the displayed assessment.

The recommended approach is selective integration: retain the current source pipeline, validation, interval-readiness engine, and versioned scenario API; incorporate Sakie's extraction/evaluation improvements and visual components through an explicit data-contract mapping layer. Do not replace either branch wholesale.

## 1. Major differences

| Area | Current branch | Sakie's branch |
| --- | --- | --- |
| UI data connection | React calls Python for forecasts, evidence, options, and scenario changes | Defaults to an in-browser mock; real-backend mode exists but does not match the included Python API |
| Readiness calculations | Seeded Python Monte Carlo; event-interval readiness drives decisions | Browser uses separate deterministic formulas; Python separately calculates start-time readiness |
| Source replacement | Configurable profiles, directory/JSON adapters, atomic refresh, revision tracking | Python baseline loaded at startup; browser uses bundled JSON fixtures |
| Missing evidence | Explicit coverage gaps, null/UNKNOWN assessments, suppressed unsafe rankings | No equivalent required-source completeness/unknown propagation |
| Validation | Cross-field validation and disposable evaluation before shared mutation | Entity/reference validation exists, but several semantic protections are absent |
| 3D visualization | Interactive illustrative DDG, cameras, X-ray, clipping, material-date slider | Nine hull builders, split cutaways, compartment interiors, walk-in controls, projected labels |
| Non-WebGL/print fallback | Interactive system/evidence list | SVG ship-profile fallback, including print rendering |
| Frontend architecture | React 19 and CSS; comparatively large workspace/panel files | React 18, Tailwind, React Router, Framer Motion, Recharts; more granular components |
| Document extraction | Daily-report extraction, bounded grounding checks, brief numeric/citation guards | Expanded typed CASREP extraction, stronger extraction grounding/cache controls, evaluation tooling |
| Forecast API | Dashboard snapshot, source health, isolated previews, interval assessments | Additional `/results` and `/scenario` interfaces; node probability arrays over 30 daily samples |
| Testing and reproducibility | Backend tests, Playwright acceptance, isolated runner, offline launcher, CI definition | Backend tests and a browser-mock storyline script; no equivalent Playwright suite or isolated acceptance runner |

## 2. Critical integration gap in Sakie's branch

Its UI's data entry point is `web/src/api/api.ts`, which defaults to:

```ts
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
```

Setting `VITE_USE_MOCK=false` is **not sufficient** to connect the UI to its Python backend. The default API base is `/api`, but the client paths, payloads, identifiers, response shapes, and version handling differ from the Python contract.

### Reproduced requests against Sakie's Python backend

These probes used an isolated `AppState`/FastAPI test client, offline extraction, and a temporary activity log. They did not affect the running current-branch server.

| Frontend request | Observed response |
| --- | --- |
| `GET /api/ship` | 200, HTML application page rather than JSON |
| `GET /api/missions` | 200, HTML application page rather than JSON |
| `GET /api/graph` | 200, HTML application page rather than JSON |
| `GET /api/fixes?mission=M1` | 200, HTML application page rather than JSON |
| `GET /api/brief?mission=M1` | 200, HTML application page rather than JSON |
| `POST /api/events/next` | 405 |
| `POST /api/reset` without `base_version` | 422 |

The successful-looking GET statuses come from the frontend fallback route serving HTML for unrecognized paths. They are not working JSON endpoints. The built frontend was present during these probes.

The Python backend instead exposes routes such as:

- `GET /api/forecast`
- `GET /api/graph/{ship_id}`
- `GET /api/fixes/{ship_id}`
- `POST /api/events/play`
- `POST /api/brief`
- `POST /scenario`, rather than the frontend's default `/api/scenario`

Changing the base URL alone cannot fix all of these differences. An explicit adapter or a deliberately unified API contract is required.

## 3. Capabilities Sakie's branch has that the current branch lacks

### 3.1 More complete 3D presentation

Under `web/src/components/ship3d/`, Sakie's implements:

- DDG, CG, FFG, LCS, CVN, LHD, SSN, SSBN, and SSGN hull builders.
- Animated split cutaways and section caps.
- Equipment/compartment interiors.
- Step-inside navigation.
- Projected labels and next-domino annotations.
- SVG fallback and print support through `ShipProfile`.

The current `web/src/ShipView.tsx` does not provide this breadth. These models are procedural and approximate, not verified physical ship geometry. Their implementation was inspected and built, but all 3D interactions were not manually exercised during this comparison.

### 3.2 More modular frontend structure

Sakie's separates screens, layouts, detail views, charts, graph components, and ship components. The current `Workspace.tsx` and `Panels.tsx` are considerably larger. Its component structure is a useful refactoring reference, independent of whether the visual design is adopted wholesale.

### 3.3 Extraction and evaluation tooling

Useful additions include:

- `missiontwin/evaluate.py`.
- Typed CASREP fields and independent expected-fact fixtures, including `data/synthetic/squadron/casrep_expected_facts.json`.
- Precision/recall and document-coverage reports for the synthetic fixtures.
- Cache-required offline evaluation.
- Cache warming with refresh/report options.
- More extensive checks that extracted structured values agree with quoted evidence.
- Automatic `.env` loading, `.env.example`, and `docs/DEV2.md`.
- Extraction/cache tests in `tests/test_llm_extraction.py` and API/forecast contract tests in `tests/test_dev2_contract.py`.

The current branch has some grounding checks but not this complete evaluation workflow. Sakie's standardized CASREP parser remains authoritative for engine records; adding extracted facts does not mean creating a second casualty for the same message.

### 3.4 Per-node forecast series

Sakie's Python engine exports node-level probability arrays aligned to a 30-day grid and combined graph nodes/edges through `/results`.

The current branch has a mission readiness timeline but not that same generalized per-node time-series export contract. This is an opportunity to improve dependency-history visualization without replacing the current readiness semantics.

### 3.5 Additional default mission-area coverage

Sakie's adds Strike Warfare (`STW`) using VLS and changes the default ROC/POE mapping:

- Mobility weight changes from 0.20 to 0.15.
- STW is added with weight 0.05 and a secondary mission designation.

The current default exercise has five areas. Its profile loader provides a path to adopting this added area without reintroducing hard-coded runtime configuration. The fixture and model changes should be reviewed together, not treated as cosmetic labels.

## 4. Capabilities the current branch has that Sakie's lacks

### 4.1 Demonstrated end-to-end Python-backed UI

The current UI, forecast engine, source evidence, scenario operations, rankings, and briefs share a working backend contract. Sakie's browser demo uses a separate engine and dataset, despite also containing a Python backend.

### 4.2 Source profiles and atomic refresh

Sakie's lacks equivalents of:

- `missiontwin/profile.py`, `sources.py`, and `export.py`.
- Validated snapshot-local unit/equipment/clock configuration.
- Directory and JSON-export adapters.
- `/api/sources` and `/api/sources/refresh`.
- Source revisions, staged activation, failed-refresh recovery, and explicit overlay-reset policy.
- The connected source-health panel and replacement-source regression tests.

### 4.3 Interval-readiness consistency

The current branch uses `p_assessed`/`interval_p_ready` for headlines, bands, blockers, graph snapshots, option rankings, donor comparisons, and briefs. It separately labels `p_ready` as start-time probability.

Sakie's Python ranker uses start-time `p_ready`, including skipping start-green missions. It lacks the current interval assessment and interval-only blocker handling. Its forecast-series additions do not, by themselves, supply sustained event-interval readiness.

### 4.4 Required-evidence coverage and unknown propagation

The current branch explicitly distinguishes missing information from a healthy or failed system, propagates prerequisite uncertainty, and withholds rankings when required evidence is insufficient. Sakie's lacks this equivalent coverage contract.

### 4.5 Cross-field semantic validation

Both branches have some entity/reference validation. The current branch additionally validates cross-field assumptions and constructed scenarios before shared mutation.

A reproduced counterexample on Sakie's branch:

```json
{
  "base_version": 0,
  "kind": "set_assumption",
  "key": "bands.amber",
  "value": 0.99
}
```

Posting this to `/api/changes` returned **200** and advanced scenario version to **1**, although green remained 0.80. The current branch rejects this inconsistent threshold ordering.

### 4.6 Source health and reported baseline separation

Sakie's frontend has freshness indicators, but those are not a substitute for ingestion/snapshot health, required-source coverage, or the current reported-baseline display. The current branch explicitly separates reported material/rating values from forecast probabilities and the reset-scenario model baseline.

### 4.7 Regression and operating tooling

The current branch includes:

- `tests/test_source_refresh.py`.
- `tests/test_llm_guards.py`.
- Playwright configuration and browser acceptance tests.
- `scripts/check_demo.py`, which owns disposable data, log, and server resources.
- `missiontwin/demo.py` and an offline preflight.
- Direct dependency pins, CI workflow definition, and current source/setup documentation.

Sakie's has neither the same browser acceptance coverage nor these replacement-source operating tools.

### 4.8 Brief-rewrite numeric/citation guard

The current branch checks numeric/citation preservation when optionally rewriting a brief. Sakie's stronger extraction implementation should be combined with this protection, not substituted for it. Neither approach proves full factual equivalence of generated wording.

## 5. Incompatibilities to resolve before integration

### Models and thresholds

Sakie's browser engine in `web/src/api/engine.ts` uses deterministic rules such as fixed part-arrival probability bands and multiplication of equipment probabilities. It is not the Python Monte Carlo engine.

Its browser mission thresholds are **82% / 50%**, while Python defaults are **80% / 60%**. Browser odds must not be relabeled as equivalent to current interval-readiness probabilities. Choose a single backend authority for the integrated UI's scores and status bands.

### Exercise identities

Sakie's browser demo uses `M1`, `M2`, `M3` and missions such as TIDEWATCH, SEASHIELD, and DEEP LANTERN. The current backend uses canonical event and unit identities. Map IDs explicitly rather than substituting display labels.

### Simulation and time-grid defaults

| Setting | Current Python backend | Sakie's Python backend |
| --- | --- | --- |
| Default forecast runs | 10,000 | 500 |
| Ranking runs | 2,000 | 2,000 |
| Visible grid | Extended through event ends | Moving 30 daily samples from the scenario cursor |
| Primary decision readiness | Event interval | Event start |

Differences in output are therefore not necessarily regressions; the contracts and assumptions differ. Sampling budgets, horizon semantics, and score meanings need an intentional combined design.

### State ownership and concurrency

Sakie's mock state belongs to the browser session. The current exercise is shared by the server and protected by `base_version` checks.

A local frontend version bump or STOP control is not equivalent to server-side concurrency or workflow enforcement. Its other-mission effects also should not be mistaken for the current backend's explicit cross-ship donor-risk accounting without an actual mapping.

### Integration strategy

Do not copy the entire `web/` tree and assume it is connected. Do not overwrite `engine.py`, `api.py`, or `llm.py` wholesale: each branch contains improvements the other lacks.

## 6. Gaps remaining in both branches

Neither branch provides:

- Authorized real-system connectors with approved schemas and identity/knowledge-time/effective-time mappings.
- Production authentication, authorization, approved hosting, or operational data-handling controls.
- Durable scenario recovery/save-load across process restarts.
- Full maintenance workforce/IEM scheduling or sustainable watchbill optimization.
- Calibrated INSURV scoring.
- An authoritative physical-asset model or verified ship geometry.
- Demonstrated live-model extraction quality on real operational data.
- A verified production deployment.

Both remain synthetic demonstrations. Presentation quality, test success, and existing deployment manifests do not establish operational readiness or authorization to use real data.

## 7. Verification evidence and limits

### Sakie's branch: checks performed during this comparison

| Check | Result |
| --- | --- |
| Backend `pytest -q` | **55 passed**, with a Starlette/httpx deprecation warning |
| Frontend `npm ci` and `npm run build` | **Passed**; build includes TypeScript checking |
| `npm run check:engine` | **Completed successfully**, printing the browser-mock event/fix storyline |
| `python -m missiontwin.evaluate --rules` | **Passed**: 26 documents, 53 expected facts matched, no missing/unexpected/invalid facts |
| Representative UI-to-backend contract probes | Confirmed HTML responses/method/payload mismatches described above |
| Invalid amber/green ordering probe | Confirmed acceptance and shared scenario version advancement |

The backend tests used the existing Python virtual environment against Sakie's isolated checkout. Frontend dependencies were installed in that isolated checkout. This does not establish reproducibility from a newly created Python environment.

The rules evaluation covered 8 CASREP messages and 18 daily-report PDFs. Precision and recall of 1.0 apply to those exact synthetic fixtures and the rules path, not live-model or real-world performance.

`web/scripts/check-engine.ts` prints storyline outcomes; it is not a Playwright test or a substitute for an end-to-end backend-connected browser acceptance suite. No live LLM endpoint was tested, and Sakie's 3D interactions were not exhaustively exercised in a browser. npm also reported that Recharts 2.x is no longer an active release branch.

### Current branch: prior verification at the reviewed implementation

- **70 backend tests passed.**
- **8 isolated browser acceptance tests passed.**
- Frontend typecheck/build passed.
- Offline-launcher smoke test passed, including offline enforcement with a configured model URL.

These are the implementation verification results recorded in `MVP_REVIEW.md`; they were not rerun as a full current-branch suite during this comparison. The active feature working tree was clean after comparison, and the running demo was not reset or modified.

## 8. Recommended integration order

1. **Keep the current source pipeline, validation, interval engine, and versioned scenario API as the foundation.** Preserve missing-data behavior, source revisions, and refresh failure safety.
2. **Port Sakie's extraction/evaluation improvements selectively.** Retain the current brief guards and semantic validation; adapt extraction/cache context to configurable profiles and source snapshots.
3. **Define one frontend/backend contract.** Map identities, nullable probabilities, start versus interval measures, evidence references, versions, changes, and error responses. Ensure the UI never silently falls back to invented mock results in connected mode.
4. **Integrate visual components incrementally.** Start with the 3D viewer, semantic mount mapping, labels, and SVG fallback. Keep the current connected screens working while replacing components.
5. **Add per-node series and STW configuration deliberately.** Preserve interval assessments and event-end coverage while exposing the additional time series. Update fixtures and tests together.
6. **Run backend-connected browser acceptance on the combined application.** Include four-event replay, source drill-down, alternate profiles, changed/no-op/failed refresh, unknown data, donor effects, preview/apply/undo/reset, stale writes, briefs, and no-WebGL behavior.

**Bottom line:** use Sakie's visual and extraction improvements to extend the working prototype. Do not merge wholesale or assume `VITE_USE_MOCK=false` produces a working combined application.
