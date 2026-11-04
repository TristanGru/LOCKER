# DEV 2: AI and predictive engine

## Configure your model

Copy `.env.example` to `.env` in the repository root, only if `.env` does not already exist. Fill in:

| Setting | Value |
|---|---|
| `LLM_BASE_URL` | Your provider's OpenAI-compatible API base, typically ending in `/v1` |
| `LLM_MODEL` | The exact model identifier accepted by that endpoint |
| `LLM_API_KEY` | Your API key, if the endpoint requires one |
| `MISSIONTWIN_DEMO_MODE` | `0` while generating responses; `1` for offline replay |

The app and CLI load `.env` automatically. Process environment variables take precedence. `.env` is ignored by Git.
The endpoint must support `/chat/completions`, JSON-object response format, `temperature: 0`, and `max_tokens`.
No provider is preselected and no live-model results are bundled.

## Prepare and verify the offline demo

From the repository root in PowerShell, after filling in `.env`:

```powershell
.\.venv\Scripts\python.exe -m missiontwin.llm warm --report logs/llm-live-eval.json
.\.venv\Scripts\python.exe -m missiontwin.evaluate --offline --require-cache --report logs/llm-offline-eval.json
```

Both commands must exit successfully. Warming covers 8 CASREP messages and 18 daily-report PDFs. Each response is
validated against its schema, grounded in source evidence, and evaluated against the expected-facts fixtures.
Missing or unexpected facts, invalid fields, missing document coverage, and rules fallback fail the live evaluation.
Reports contain per-document methods, coverage, precision, and recall. These are exact synthetic-fixture checks,
not a claim of general extraction accuracy.

After tuning a model or retrying a failed evaluation, add `--refresh` to the warm command to request fresh responses.
Facts that fail evidence validation are never added to the cache. A schema-valid but incomplete answer can still fail
the fixture evaluation; use `--refresh` to replace it rather than repeatedly replaying it.

Offline evaluation never contacts the endpoint and fails if any document misses the cache. Then set
`MISSIONTWIN_DEMO_MODE=1` and restart the API. Keep **the same `LLM_MODEL`**, because model identifiers are part of cache keys.
The cache also includes task, prompt version, redacted input, ship, and document time. Include `cache/llm/` in the demo;
the Dockerfile already copies it. Changing extraction prompts requires a `PROMPT_VERSION` bump and rewarming.

To evaluate the independent fallback path, use:

```powershell
.\.venv\Scripts\python.exe -m missiontwin.evaluate --rules --report logs/llm-rules-eval.json
```

That report is labeled `rules`. Mock-response tests verify transport and replay, not real model quality.
The warm command covers extraction; optional brief rewrites and plain-English actions retain their existing fallbacks.

## Extraction evidence

Daily-report facts carry the PDF page and a source span. CASREP facts carry the message, source line, and exact set,
including multiline AMPN/RMKS narratives. Typed CASREP fields cover status, equipment, category, repair timestamp,
part quantity/NIIN/requisition, and assistance. The standardized CASREP parser remains authoritative for engine records,
so extracted CASREP facts do not create duplicate casualties.

Validation checks nonempty source spans, date validity and quoted values, known member IDs, and agreement between CASREP
fields and their source sets. Uncertain language stays `UNCONFIRMED` even if the model marks it certain. Failed evidence
is `NEEDS_REVIEW` and cannot be confirmed into the engine. Known roster names are redacted before extraction requests.

The generator produces independent expected-fact fixtures for both document types under `data/synthetic/squadron/`.
The evaluator normalizes those fixtures to the public fact contract before comparison.

## Forecast API

- `GET /results`: forecast plus `version`, `nodes`, and `edges`.
- `POST /scenario`: versioned change; response `{change, version, results}` includes the recomputed forecast.
- `GET /api/fixes/KESSLER`: existing candidate ranking with donor costs and 2,000 runs per candidate.

Forecasts default to **500 runs**, seed **20261104**, and **30 daily samples**, starting 12 hours after the scenario cursor.
`grid_dates` contains the sample timestamps. `grid_days` contains offsets from the fixed scenario day zero.
The window moves with the scenario cursor. Scheduled mission-time probabilities are computed separately, including
missions outside that window. Existing `/api/forecast`, `/api/changes`, and `/api/graph/{ship}` clients still work.

Every exported node has `id`, `ship_id`, `kind`, and a 30-element `p_ready` array aligned with `grid_dates`.
The separate `p` field is its mission-time snapshot. Item readiness means absence of the impairment; person readiness
means availability; gates and missions evaluate their requirements. Hazard probabilities include repair. Prerequisite
gates require the predecessor to have completed. Edges use those same node IDs.

`ships[ship].systems` contains mean condition scores, not probabilities. Use `system_p_ok`, area `p_capable`, or node
`p_ready` for probability displays. Monte Carlo probabilities are conditional on the synthetic data and assumed distributions.

Example `POST /scenario` body; obtain `base_version` from `GET /results`:

```json
{
  "base_version": 0,
  "kind": "action",
  "action": {
    "type": "add_casrep",
    "ship_id": "KESSLER",
    "eic": "SPY1D",
    "category": 4,
    "etr": "2026-12-10T00:00:00Z"
  }
}
```

Unknown references are rejected before mutation. Stale scenario versions return 409. The API also accepts the existing
`set_assumption`, `confirm_fact`, and `play_event` change kinds. Source documents are never edited by scenario operations.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests
```

The tests exercise real generated fixtures, both extraction schemas, invalid model outputs, real disk cache replay,
forecast probabilities and recovery, scenario rejection/versioning, prerequisite timing, and fix-ranking mechanics.
