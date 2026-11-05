# LOCKER — connected readiness demonstration

LOCKER connects synthetic maintenance, supply, personnel, training, and event data in a read-only decision-support workspace. It demonstrates **which event is at risk, why, what could improve it, the donor consequences, and the supporting source records**. Replacing source files and refreshing updates the same engine and UI without restarting.

Backend setup and architecture: [MissionTwin backend](docs/BACKEND.md). AI configuration and forecast API: [DEV 2 guide](docs/DEV2.md). Synthetic exercise dataset: [data guide](data_sources/Synthetic%20Data/README.md). Naval station support: [shore implementation](docs/SHORE.md).

Planned next increment: [Captain decision assistant implementation plan](docs/CAPTAIN_DECISION_ASSISTANT_PLAN.md) — a mission-specific decision brief, an existing OpenAI-compatible LLM endpoint, and optional Keystone-style browser semantic retrieval. This is a roadmap, not shipped functionality.

**Synthetic exercise only. Not an operational readiness authority.** There is no authentication or real-system connector. Do not expose this local demo to an untrusted network or load operational/personnel data into it.

## Start locally

Tested on Windows with Python **3.13**, Node.js **20+**, and Edge. The frontend is React 19, TypeScript, Vite, CSS, and Three.js; the backend is FastAPI/Python with seeded Monte Carlo calculations.

Install dependencies once (PowerShell, from the repository root):

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-demo.txt
cd web
npm ci
cd ..
```

Then one command builds, preflights the dataset, and starts the guaranteed offline demo:

```powershell
.\.venv\Scripts\python.exe -m missiontwin.demo
```

Open **http://127.0.0.1:8000**. Stop with Ctrl+C. Use `--port 8011` if another server already occupies 8000, and `--no-build` to reuse an existing frontend build.

On Linux/macOS use `python3.13 -m venv .venv` and `.venv/bin/python` in place of the Windows executable. `requirements-demo.txt` pins the direct dependency versions used for local verification; it is not a fully locked transitive dependency graph. `requirements.txt` contains the broader supported ranges.

The canonical synthetic dataset is checked in at `data/synthetic/`. There is no need to regenerate it. `python -m missiontwin.generate` deliberately rewrites that fixture and is intended for fixture development, not routine demo startup.

## Sign-in and access

The app opens on a sign-in screen. For now an account is a username only, with no password:

| Username | Sees | Can do |
|---|---|---|
| `fleet.commander@us.navy.mil` | Every ship and installation (the full site) | Everything, including playing the exercise feed, reset, source refresh, model assumptions and approving transfers between units |
| `co.kessler`, `co.varnell`, `co.ashby` | Their own ship only; no Shore tab | What-ifs, fact review and fix decisions for their own ship. A fix that takes a part or sailor from another unit needs fleet approval. Undo only their own last change |

The server enforces this, not the browser. Every `/api` request must carry the signed session cookie (HttpOnly, SameSite=Strict, 8 hours), and each route checks the account's units. Other units' records are removed before a response is sent, so they never reach a CO's browser. Only the built frontend files, `/api/login`, `/api/accounts`, `/api/health` and a status-only `/api/ready` answer without a session. Sign-ins, sign-outs and refused requests are written to `access.jsonl` next to the activity log, and every change in the activity log names the account that made it. There is one CO account per ship in the data profile, so a new ship gets one automatically (`missiontwin/auth.py`).

## Connected captain UI

The default route now uses Sakie's layout with a top-level ship selector, DDG-only cutaway/interior viewer, and named missions (TIDEWATCH, SEASHIELD, DEEP LANTERN and IRON HORIZON, read from each event's `codename` in `squadron/events_missions.json`). Its data comes from the Python backend, not the browser mock. **Sources / controls** exposes source refresh and undo.

The previous advanced workspace is retained at **`/?legacy=1`** for the full assumption editor, report-fact review and structured preview/apply workflow. The walkthrough below describes that advanced workspace where screen names differ. See [UI integration status and remaining merge work](docs/UI_INTEGRATION.md).

## Five-minute presenter walkthrough

1. **Mission overview:** explain Mission A's healthy start-time estimate but low **event-interval readiness**, caused by a training expiration inside its event window. The headline, status, options, and briefs assess the interval. The timeline plots *point-in-time requirement probability*, not material score or a continuous-time guarantee.
2. **Play next event:** replay the casualty, supply delay, personnel news, and earlier schedule. Observe changed probabilities, blockers, timestamps, and evidence. Use the playback controls in order; reset returns to the same-source baseline.
3. **Dependency chain / ship:** select Mission A and inspect its requirements and source records. The DDG geometry is illustrative, not an authoritative equipment drawing. Material-date colors and event-interval requirement colors are different views.
4. **Fixes & trade-offs:** compare packages, receiver effects, and donor consequences. Review sources and steps, then explicitly approve an exercise decision. Delayed approval is validated before application but the displayed ranking is an immediate-approval comparison; its delay warning must not be ignored.
5. **What-if lab:** preview an alternate assumption or schedule change. Preview is isolated; only explicit confirmation applies it. Undo/reset do not write back to source files.
6. **Evidence & feed:** inspect source revision, freshness, coverage classifications, reported readiness baseline, and ingestion errors. The reported baseline is not a probability and is separate from the model's baseline scenario.
7. **Readiness brief:** generate and download the current cited exercise brief. It is invalidated when the exercise/source version changes. No model endpoint is required.

## Demonstrate replacement sources

Work on a copy so the checked-in fixture remains untouched:

```powershell
Copy-Item data/synthetic data/demo-refresh -Recurse
.\.venv\Scripts\python.exe -m missiontwin.demo --data data/demo-refresh --port 8011
```

1. Play the first event (casualty).
2. In `data/demo-refresh/KESSLER/requisition_status.csv`, change `BB 2026-11-05` to `BB 2026-11-12` in the pump requisition's `status_history`.
3. Open **Evidence & feed → Refresh sources**, review the confirmation, and confirm.
4. The revision changes and the supply evidence and start-time readiness change without restart. Reopen the dependency chain, compare options, and generate a new brief. Interval readiness moves with the supply change; the CIC trainer refresh is scheduled in port (10 NOV), so training is not an independent blocker. A training refresh dated inside an underway block is rejected at refresh.
5. Refresh again without editing: it is an idempotent no-op. Remove a required source and refresh: the candidate is rejected, the prior snapshot remains active, and a failure banner appears.

Existing hypothetical decisions block activation of changed sources. The explicit **Reset exercise when activating changed sources** checkbox permits replacement with a clean scenario. Without overlays, compatible event playback is retained. See [source contracts and adapter details](docs/SOURCES.md).

A second input format uses JSON exports instead of CSV:

```powershell
.\.venv\Scripts\python.exe -m missiontwin.export --output data/demo-json
.\.venv\Scripts\python.exe -m missiontwin.demo --data data/demo-json --adapter json-export --port 8011
```

The adapter materializes canonical records in a temporary snapshot; it does not write CSV into the input export directory. The evidence drawer links normalized CSV rows to the preserved raw JSON export. Both formats use the same engine/UI.

## Checks and development

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts/check_demo.py
```

`check_demo.py` typechecks/builds the frontend, copies the dataset to a temporary directory, starts an offline API on a free local port with a temporary activity log, and runs Playwright. It exercises source replacement and then tears down only its own server. **It never resets an existing server on 8000.** Edge is used by default on Windows; on other platforms install Chromium with `cd web; npx playwright install --with-deps chromium`. Set `PLAYWRIGHT_CHANNEL=chromium` to select it explicitly.

Individual frontend commands: `npm run typecheck`, `npm run build`, `npm run dev`, and `npm run test:e2e` in `web/`. The last command defaults to an existing server on port 8000 and **resets that server's exercise**; prefer the isolated runner. Vite's development proxy defaults to the local API on 8000.

The GitHub Actions workflow runs backend and isolated browser checks. It is supplied but has not been exercised on hosted CI as part of local verification. Docker/Kubernetes/Zarf packaging exists but is not a verified production deployment.

## Configuration and behavior

| Setting | Purpose |
| --- | --- |
| `MISSIONTWIN_DATA` | Input directory for the configured adapter |
| `MISSIONTWIN_ADAPTER` | `directory` (default) or `json-export` |
| `MISSIONTWIN_DEMO_MODE=1` | Guaranteed offline extraction/actions/briefs; forced by the launcher |
| `MISSIONTWIN_ACTIVITY_LOG` | Optional activity-log path; see `missiontwin/domain.py` for the default |
| `MISSIONTWIN_SESSION_SECRET` | Optional key for signing session cookies. Without it each server start makes a new key, which signs everyone out |
| `LOCKER_URL` | Target URL for standalone browser tests |
| `PLAYWRIGHT_CHANNEL` | Optional browser channel override |

For direct API startup, set those variables and run `python -m uvicorn missiontwin.api:app --host 127.0.0.1 --port 8000`. API documentation is at `/docs` (sign in first); `/api/health` checks liveness and `/api/ready` checks source/configuration readiness (503 after a failed refresh or with insufficient evidence).

- One shared, in-memory scenario per process; use **one worker**. Writes require `base_version` and stale writes return 409.
- Sources are immutable inside the active snapshot. Changed input files have no effect until refresh. Scenario actions never modify inputs.
- Restart loads sources afresh and resets the in-memory exercise. The activity log is an audit trail, **not** restart recovery/save-load.
- Start-time probability remains `p_ready`; primary interval assessment is `p_assessed`/`interval_p_ready`. Missing required evidence yields `null`/`UNKNOWN`, not a fabricated zero or green value.
- Feed freshness is evaluated against exercise time, not today's wall clock. A stale record is still visible with a warning; a required missing/invalid feed causes insufficient coverage.
- The separately normalized reference package is review-only. Do not point the active adapter at it and assume it is equivalent to the canonical exercise.

## Troubleshooting

- **No frontend / stale UI:** run the launcher without `--no-build`, then hard-refresh the browser.
- **Port occupied:** use `--port 8011`; do not stop an unknown process.
- **Refresh rejected:** inspect the error and source health. Correct schemas/IDs/timestamps, or explicitly reset overlays before activating changed inputs. The prior usable snapshot is retained.
- **Missing evidence:** restore required files and joins, then refresh. For a malformed initial configuration use `/api/sources`/`/api/ready` or the launcher error; the main forecast is intentionally blocked.
- **No WebGL:** the system list and evidence actions remain available; no 3D requirement is imposed on forecasting. A richer schematic/print fallback is still follow-on work.
- **Warnings:** the Three.js chunk is large; this is a build warning, not failure. The installed Starlette test client emits an httpx deprecation warning.

## Project map and limits

- **Only the data is hardcoded.** Units, equipment, parts, watchstations, events, the scenario clock, the ship drawing layout,
  supply holder roles, source coverage and every model number come from the dataset (`squadron/dataset_profile.json`,
  `mission_equipment_tree.json`, `shore_profile.json`, `delay_model_params.yaml`, `data_catalog.json`,
  `status_code_reference.csv`). `missiontwin/synthetic_spec.py` is the generator's authoring input for the synthetic
  dataset and only the generators import it; `tests/test_data_only.py` enforces this.
- `missiontwin/profile.py`, `sources.py`, `ingest.py`, `validation.py`: profiles, adapters, snapshots, validation and provenance.
- `engine.py`, `fixes.py`, `brief.py`: calculations, package comparison, and cited output.
- `web/src/`: live workspace, source health, dependency graph, timeline, and illustrative ship.
- [MVP review and delivery status](MVP_REVIEW.md): original findings, implementation evidence, and explicit limitations.
- [Original design handoff](docs/DESIGN_HANDOFF.md): preserved aspirational design, **not** current installation instructions or implemented scope.
- `data_sources/`, `reports/`: source research and the separate reference exercise.

Movement messages constrain schedule-derived transfer windows; positions remain context-only. Watchbill optimization, maintenance labor competition/IEM, and INSURV scoring are not implemented and are labeled accordingly in source health. Real adapters still require approved schemas, identity/time mappings, authorized access, and security review. Live LLM wording has numeric/citation guards, but is not a factual-equivalence or comprehensive PII guarantee.
