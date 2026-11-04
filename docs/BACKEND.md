# MissionTwin: Readiness Domino Map

**Know before it breaks the mission.** A read-only layer that reads a ship's data (CASREPs, maintenance, supply, crew quals, schedule, daily reports), builds a mission dependency graph, and forecasts each upcoming mission's chance of being ready. It names the next domino and ranks fixes by their effect on the whole squadron. The captain decides.

All data here is **SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA**. Fictional hulls DDG-991/992/993.

## Quick start

Run these commands from the repository root.

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt        # Windows (use .venv/bin on Linux/macOS)
.venv/Scripts/python -m missiontwin.generate          # writes data/synthetic/ (already committed; deterministic)
.venv/Scripts/python -m uvicorn missiontwin.api:app --port 8000 --workers 1
# second terminal
cd web && npm install && npm run dev                  # http://localhost:5173 (proxies /api to :8000)
.venv/Scripts/python -m pytest -q tests               # full test suite
```

**Windows on ARM with Smart App Control on:** use **x64** Python 3.12. The ARM64 build of `pydantic-core` is blocked by the app-control policy; the x64 build runs under emulation. `npm run build` puts the UI in `web/dist`, which the API serves at `/`.

## How it works

| Module | Job |
|---|---|
| `missiontwin/domain.py` | Clock (Zulu, day 0 = 2026-11-04T08:00Z), squadron, mission tree, assumptions ledger defaults, file contract |
| `missiontwin/generate.py` | Writes every mock file in `data_sources/` (CSV, CASREP/MOVREP/LOGREQ message text, JSON, daily-report PDFs) |
| `missiontwin/ingest.py` | Parses each record on its own; bad records become issues, never crashes (R10). Knowledge-at-time view. Contradiction detector X1-X10 |
| `missiontwin/engine.py` | Event-sourced scenario (R4), seeded vectorized Monte Carlo with common random numbers, deterministic planned case (R1), next domino, memo cache (R13) |
| `missiontwin/fixes.py` | Fix candidates (borrow, cannibalize, wholesale/program office, expedite, crew loan, training, schedule shift, and pairs) ranked by net squadron missions in green, then own-ship uplift, then donor cost |
| `missiontwin/llm.py` | Optional OpenAI-compatible LLM: fact extraction (span-verified), plain English to JSON action, brief rewrite. Content-hash cache (R9), timeout + fallback (R5), PII redaction + guard |
| `missiontwin/brief.py` | Deterministic brief with a citation on every claim |
| `missiontwin/api.py` | FastAPI. Shared scenario, every write carries `base_version`, stale write returns 409 (R8) |

The data contract is `data_sources/00_README.md` plus specs 01-20. `tests/test_data_contract.py` fails if generated files drift from the specs.

### LLM (optional)

Provider setup, the DEV 2 API contract, evaluation, and offline replay are documented in [docs/DEV2.md](DEV2.md).
Copy `.env.example` to `.env`, then fill in `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY` if required.
The app and commands load `.env` automatically; process environment variables take precedence.
Without an endpoint, CASREPs and daily reports use clearly labeled deterministic extraction and briefs use the template.

```powershell
.\.venv\Scripts\python.exe -m missiontwin.llm warm --report logs/llm-live-eval.json
.\.venv\Scripts\python.exe -m missiontwin.evaluate --offline --require-cache --report logs/llm-offline-eval.json
```

Warming covers both extraction paths and fails on rules fallback or an expected-fact mismatch. After offline evaluation passes,
set `MISSIONTWIN_DEMO_MODE=1` and restart the app. Keep the same model identifier and package `cache/llm/` with the demo.
No live model or populated cache is implied by installation. Names become `[M-0007]` tokens before extraction prompts are built,
and a guard rejects surviving known roster surnames.

## API (frontend contract: `web/src/api.ts`)

DEV 2: `GET /results` returns the versioned forecast and graph nodes with 30 daily `p_ready` values each.
`POST /scenario` accepts a versioned change and returns `{change, version, results}` after recomputing.
The default forecast uses 500 runs and seed 20261104. The existing `/api/*` routes remain available.

`GET /api/state` · `/api/scenario/version` (poll 2s) · `/api/forecast` · `/api/graph/{ship}?event_id=` · `/api/facts` · `/api/issues` · `/api/source?file=&loc=&span=` · `/api/assumptions` · `/api/fixes/{ship}` (ranking, about 3-5s) · `/api/actions/schema` · `/api/log`
`POST /api/events/play` · `/api/changes` (action, set_assumption, confirm_fact) · `/api/fixes/decide` · `/api/undo` · `/api/reset` · `/api/actions/parse` · `/api/brief`
Every POST takes `base_version`.

Key forecast fields per mission: `p_ready`, `band`, `planned` (`result` MAKE/MISS, `margin_days`, `chain`), `next_domino`, `gates[]` (each with `p_ok`, `uplift`, `items[]` with `sources[]`), `curve` (P(ready) if the mission were held on each day). Per ship: `areas` (MFOM-style index and capability by day), `systems` (mean score by day).

## Demo script (what the data does today, seed 20261104)

| Step | Kessler Mission A (Group Sail, AW) |
|---|---|
| Baseline | ~93% GREEN |
| E1 CASREP: SPY-1D cooling pump, CAT 3 | ~85% |
| E2 Supply BB to BC, ETR slips to 22 NOV | ~20% RED; planned MISS by ~6 days |
| E3 Daily report: 2 of 3 SPY-qualified FCs leave 10 NOV | 0%; next domino becomes the people |
| E4 Schedule change pulls Group Sail to 13 NOV | 0%; planned MISS by ~10.6 days |
| Approve top fix: borrow Varnell's spare pump + loan FC2 M-0412 from Ashby | ~98%; Mission B ~88%; Varnell's cost shown (below allowance, X5) |

These numbers come from the engine and the assumptions ledger. Nothing is tuned toward an outcome. Change an assumption (for example CONUS transit days) and the numbers move.

**Manual baseline (for the pitch):** one teammate answers "is Kessler ready for Mission A, and what fixes it?" by hand from `data/synthetic/KESSLER/` and `data/synthetic/squadron/` with a stopwatch. Record the time, then compare it with the tool's time to the same answer plus the brief.

## Packaging (R6)

```
docker build -t missiontwin:0.1.0 .
zarf package create .            # one component: image + deploy/k8s.yaml (1 replica)
```
Not yet verified on this machine (no Docker here). Confirm packaging expectations with Defense Unicorns staff on site.

## Status and next steps

Implemented: generator, ingest, 30-day Monte Carlo forecasts, fix ranking, brief, CASREP/daily-report extraction with evidence validation and disk caching, versioned results/scenario API, and extraction evaluation. Tests cover the golden demo, data contracts, X1-X10, PII, invalid model output, cache replay, and performance budgets.

Open:
- **Frontend:** `web/` is a placeholder page that exercises the API. The Captain view, Commodore view, domino graph and source panel are the frontend dev's. The R12 frontend smoke test (open Captain view, click a warning, see the source) goes with that UI.
- **LLM deployment:** supply provider settings in `.env`, pass live extraction evaluation, then pass cache-only evaluation for all 26 documents. See [DEV 2 setup](DEV2.md).
- **Packaging:** build the image and `zarf package create` on a machine with Docker.
- Items to verify before the demo: `data_sources/00_README.md` section 9.
