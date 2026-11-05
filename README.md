# LOCKER — connected readiness demonstration

LOCKER connects synthetic maintenance, supply, personnel, training, and event data in a read-only decision-support workspace. It demonstrates **which event is at risk, why, what could improve it, the donor consequences, and the supporting source records**. Replacing source files and refreshing updates the same engine and UI without restarting.

Backend setup and architecture: [MissionTwin backend](docs/BACKEND.md). AI configuration and forecast API: [DEV 2 guide](docs/DEV2.md). Synthetic exercise dataset: [data guide](data_sources/Synthetic%20Data/README.md). Naval station support: [shore implementation](docs/SHORE.md).

Ask Davey's first prototype is available on Mission Overview and Davy's Dominoes. The broader [Captain decision assistant plan](docs/CAPTAIN_DECISION_ASSISTANT_PLAN.md) remains a roadmap.

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

Then one command builds, preflights the dataset, and starts the demo with offline ingestion. Ask Davey also stays offline unless you enable its separate live switch:

```powershell
.\.venv\Scripts\python.exe -m missiontwin.demo
```

Open **http://127.0.0.1:8000**. Stop with Ctrl+C. Use `--port 8011` if another server already occupies 8000, and `--no-build` to reuse an existing frontend build.

On Linux/macOS use `python3.13 -m venv .venv` and `.venv/bin/python` in place of the Windows executable. `requirements-demo.txt` pins the direct dependency versions used for local verification; it is not a fully locked transitive dependency graph. `requirements.txt` contains the broader supported ranges.

The canonical synthetic dataset is checked in at `data/synthetic/`. There is no need to regenerate it. `python -m missiontwin.generate` deliberately rewrites that fixture and is intended for fixture development, not routine demo startup.

## Connected captain UI

The default route now uses Sakie's layout with a top-level ship selector, DDG-only cutaway/interior viewer, and named missions (TIDEWATCH, SEASHIELD, DEEP LANTERN and IRON HORIZON, read from each event's `codename` in `squadron/events_missions.json`). Its data comes from the Python backend, not the browser mock. **Sources / controls** exposes source refresh and undo.

The previous advanced workspace is retained at **`/?legacy=1`** for the full assumption editor, report-fact review and structured preview/apply workflow. The walkthrough below describes that advanced workspace where screen names differ. See [UI integration status and remaining merge work](docs/UI_INTEGRATION.md).

## Ask Davey prototype

Open **Mission Overview** or **Davy's Dominoes** and select the floating **Ask Davey · AI** button. It opens a compact popup above the button. Opening the popup or choosing a suggested question makes no model request; analysis starts when you press **Ask**. Davey searches currently eligible requisitions, maintenance records, CASREPs, and daily reports for the selected ship and mission, then combines those passages with the engine's forecast claims. Answers show their generation source, exercise time, citations, and source uncertainty.

Mission Overview and Davy's Dominoes keep separate chats. Switching pages closes the popup; reopen it to see that page's chat. **Clear chat** resets the active page's conversation. **Show in Dominoes** carries a Mission Overview graph suggestion into Dominoes for review while leaving the chat history on Mission Overview.

The default demo shows **Rules-based fallback** warnings from the readiness engine. To enable the live OpenAI response, copy [.env.example](.env.example) to an ignored `.env`, add your Platform key as `LLM_API_KEY`, and set `LOCKER_DAVEY_LIVE=1`. The example selects `gpt-4o-mini`, which supports [Chat Completions Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat). Start or restart the demo normally. `MISSIONTWIN_DEMO_MODE=1` keeps ingestion, action parsing, and briefs offline; Davey's separate opt-in permits a model call only after a submitted question. The key stays in server configuration and is never sent to the browser.

Live answers can identify **emerging concerns** and propose report-supported nodes and connections in Dominoes. These are labeled **AI-proposed** and can be inspected, marked reviewed, dismissed, or restored. Review changes only the visible overlay; it never changes readiness or applies an action. If the exercise or source snapshot changes, the answer is marked outdated and its evidence links are disabled until you ask again. A live answer requires a configured key and endpoint; this implementation was verified with a mocked OpenAI-compatible transport, without a real account call. See the [brainstorm](docs/ASK_DAVEY_BRAINSTORM.md) and [implementation plan](docs/ASK_DAVEY_IMPLEMENTATION_PLAN.md) for the selected walkthrough and limits.

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
| `LLM_BASE_URL` | OpenAI API base URL for live Davey (example: `https://api.openai.com/v1`) |
| `LLM_MODEL` | Structured-output model for live Davey (example: `gpt-4o-mini`) |
| `LLM_API_KEY` | Server-side OpenAI Platform API key; keep it in ignored `.env` or the process environment |
| `LOCKER_DAVEY_LIVE=1` | Allow a live Davey call after explicit submit; default is cached/fallback only |
| `MISSIONTWIN_ACTIVITY_LOG` | Optional activity-log path; see `missiontwin/domain.py` for the default |
| `LOCKER_URL` | Target URL for standalone browser tests |
| `PLAYWRIGHT_CHANNEL` | Optional browser channel override |

For direct API startup, set those variables and run `python -m uvicorn missiontwin.api:app --host 127.0.0.1 --port 8000`. API documentation is at `/docs`; `/api/health` checks liveness and `/api/ready` checks source/configuration readiness (503 after a failed refresh or with insufficient evidence).

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

- `missiontwin/profile.py`, `sources.py`, `ingest.py`, `validation.py`: profiles, adapters, snapshots, validation and provenance.
- `engine.py`, `fixes.py`, `brief.py`: calculations, package comparison, and cited output.
- `web/src/`: live workspace, source health, dependency graph, timeline, and illustrative ship.
- [MVP review and delivery status](MVP_REVIEW.md): original findings, implementation evidence, and explicit limitations.
- [Original design handoff](docs/DESIGN_HANDOFF.md): preserved aspirational design, **not** current installation instructions or implemented scope.
- `data_sources/`, `reports/`: source research and the separate reference exercise.

Movement messages constrain schedule-derived transfer windows; positions remain context-only. Watchbill optimization, maintenance labor competition/IEM, and INSURV scoring are not implemented and are labeled accordingly in source health. Real adapters still require approved schemas, identity/time mappings, authorized access, and security review. Live LLM wording has numeric/citation guards, but is not a factual-equivalence or comprehensive PII guarantee.
