# Sakie-style connected captain workspace

## Delivered in this integration increment

The default frontend now uses the layout and components imported from Sakie's frontend commit `4c40467`, under `web/src/captain/`. React 19 and the existing backend are retained. The browser mock server/calculation engine is not used by the connected application.

- Top-level ship selector uses the backend registry: Kessler, Varnell and Ashby in the default profile. Selection remounts the workspace, clears selected dependencies, and loads the selected ship's actual events.
- DDG is the fixed ship model; hull-class selection has been removed. Cutaway, interior, projected labels and SVG fallback are retained.
- Display names map canonical events to TIDEWATCH, SEASHIELD, DEEP LANTERN and IRON HORIZON. IDs and event requirements remain unchanged; alternate events retain their configured labels.
- Mission odds and comparisons use `p_assessed` (sampled event interval), never the mock engine's deterministic formula. Thresholds are obtained from the backend.
- System pins show the worst scheduled interval requirement where one exists. Otherwise they show the backend's material-capability probability (score >= 0.6) at the cursor-nearest forecast sample. This is not an interval mission claim. Missing evidence remains Unknown. Helo deck maps to the real `HELO` system, not an invented green fixture.
- Graphs, source records, fixes, cross-ship mission consequences, events, briefs and logs are mapped from the existing Python API. Source records show actual extracted lines, not bundled mock record summaries.
- Source refresh, explicit reset-on-refresh, source usage/health, reported baseline and undo are available under **Sources / controls**.
- `/api/captain/preview` translates typed UI edits into validated canonical actions on a disposable scenario fork. Multi-change previews do not change version, log or sources. New hypothetical casualties explicitly assume a seven-day repair estimate; source CASREP cancellation is not a what-if action.
- Fix approval uses the version of the displayed comparison. STOP is explicitly a local browser pause, not an operational/server-wide stop.

## Advanced workspace removed

The previous connected workspace at `/?legacy=1` (assumption editor, structured action preview/apply, report-fact review, source comparison, detailed timeline) has been removed along with its browser tests (`dashboard.spec.ts`, `sources.spec.ts`). The captain UI is the only front end; its browser tests are in `web/tests/captain.spec.ts`. The backend endpoints those screens used are unchanged and still covered by the Python test suite.

## Shore

**Shore Overview** is a separate tab for labeled mock naval installations, with a 3D base layout and list fallback. See [shore implementation](SHORE.md).

## Remaining integration work — not claimed complete

This is the frontend integration increment, not completion of every item in the proposed cross-branch merge sequence:

- STW profile additions have not yet been ported.
- Some richer advanced-workspace tools remain on the advanced route rather than being restyled into captain screens.
- Captain fix modification controls are not offered without a backend-supported package-edit contract; use the advanced preview workflow instead.
- Browser-local pause and print/download actions are not persisted as shared operational audit decisions. Actual scenario mutations remain backend-logged.
- Further UI polish should improve detailed contradiction presentation, historical fix display and temporal graph animations without inventing model outputs.

## Merged from main (DEV2 extraction and forecast API)

Merging `main` brought in the DEV2 extraction evaluator, typed CASREP grounding and cache workflow, the `/results` and `/scenario` endpoints, and per-node 30-day `p_ready` series. The two sides' semantics were reconciled as follows:

- **Interval assessment stays the decision number.** `p_assessed`, band, next domino and uplift still use sampled event-interval readiness. The new per-day `p_ready` series on missions, gates, items and graph nodes is display data.
- **Fixed 30-day daily window.** `grid_dates` is now 30 daily samples starting 12 hours after the scenario cursor, per `docs/DEV2.md`. Interval columns are sampled separately, so events ending beyond the window are still fully assessed. The planned case extends to the last event's end.
- **Prerequisite timing.** A prerequisite counts only if its event ends before the dependent event starts. This applies to both start-time and interval readiness. A shift that puts a prerequisite after its dependent is now accepted as a what-if, and the dependent event scores 0. Previously such a shift was rejected as invalid.
- **Unknown evidence.** Daily series for UNKNOWN missions are null, not zero. Extraction-review issues on CASREP messages do not mark a ship UNKNOWN, because the standardized CASREP parser remains authoritative for engine records.
- **Data contract.** Source CSVs no longer carry a `# SYNTHETIC` banner line, and the band threshold key is `yellow` (was `amber`). Ingest, normalization, JSON export, the JSON adapter, and both frontends accept the new form.

## Validation

Verified after this increment:

- **74 backend tests passed**, including combined-preview isolation, invalid/stale preview rejection, and concurrent lazy initialization.
- **11 browser tests passed**: 3 for the connected captain UI and 8 retained advanced-workspace regressions.
- Frontend typecheck and production build passed.
- Existing backend performance budgets remain enforced. The cold browser fix-comparison wait allows 45 seconds while the UI shows its loading state.

Run sequentially (the frontend build replaces `web/dist`):

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts/check_demo.py
```

The isolated browser runner uses disposable sources and an owned API process. Do not run standalone Playwright against an active presenter session unless resetting that session is intended.

The frontend bundle still carries large Three.js/chart chunks. npm reported two moderate advisories during dependency installation; no forced major-version audit fix was applied as part of this integration.
