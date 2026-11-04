# Source profiles, adapters, refresh, and assessment semantics

## Boundary

```text
read-only export -> adapter staging -> canonical validation + provenance
                 -> immutable source snapshot -> engine + scenario overlays -> API/UI
```

`missiontwin.sources.SourceAdapter.stage(source: Path, destination: Path)` materializes a canonical input tree in an empty staging directory. Register a connector in `ADAPTERS`; do not put connector-specific field handling in React or forecast calculations. The two included adapters are synthetic, file-backed demonstrations, not authorized Navy connectors.

- **directory:** copies the canonical tree without modifying inputs.
- **json-export:** copies the tree, then converts each `name.csv.json` into `name.csv` inside staging. The JSON object has `columns` (unique field names) and `rows` (objects matching those columns). Identifiers remain strings, including NIINs, watchstation codes, member IDs, UICs, and document numbers. Numeric IDs are rejected instead of losing leading zeros. JSON/date/message/PDF artifacts otherwise keep the canonical contract. Both original JSON and derived CSV are retained in the active snapshot.

Use `python -m missiontwin.export --output data/demo-json` to produce a complete working second-format export. It requires a new output directory outside the source tree, and never overwrites the input or an existing destination.

## Canonical contract, version 1

Start from `data/synthetic/` or its generator; replacing a root directory alone is not a schema-mapping strategy.

- `squadron/mission_equipment_tree.json`: hierarchy of mission areas/tasks/functional areas/systems/components/parts; required qualifications; critical flags; weights that sum to one per mission area. Equipment IDs are explicit joins, not fuzzy name matching.
- Optional `squadron/dataset_profile.json`: unit registry, exercise clock, mapping version, watchstations, visual mappings.
- `squadron/events_missions.json`: event identities, intervals, requirements, and acyclic prerequisites.
- `squadron/scenario_feed.json`: ordered exercise injections with unique IDs and knowledge timestamps.
- `squadron/assumptions.yaml`: supported calculation parameters, values, and provenance. It is the runtime authority for bands, status-score values, duration distributions, and sample counts. The mission tree controls dependency weights and its critical-child cap; its status-score/band descriptions are not another override layer.
- `squadron/data_catalog.json`: source metadata and extract freshness used by source health. Keep the catalog in sync with exports; catalog counts are not a completeness attestation for a real connector.
- Per-unit and squadron CSVs use the column lists in `missiontwin/domain.py:COLUMNS`. Every declared schema column must be present, even when a value is legitimately empty. Extra `known_at` may explicitly separate knowledge time from effective/report time. The demo requires its synthetic header/banner.
- CASREP, MOVREP/LOGREQ, and PDF reports retain the documented synthetic formats. Unknown formats must be mapped or rejected, not passed off as compatible.

Example optional profile (illustrative fragment; preserve the full matching tree and feeds):

```json
{
  "schema_version": 1,
  "name": "alternate-synthetic",
  "mapping_version": "2026-01",
  "scenario_now": "2026-11-04T08:00:00Z",
  "ships": {
    "ORION": {"name": "USS Orion", "hull": "DDG-991", "uic": "99101", "dodaac": "R99101"}
  },
  "watchstations": {"4310": "Air search radar operator"},
  "mounts": {"radar": [0, 20, 0]},
  "system_mounts": {"RADARX": ["radar"]}
}
```

Omitted fields retain the demo defaults. A non-default unit needs a matching directory, rows, events, and references; a non-default equipment tree needs matching EICs throughout the data. Unknown equipment does **not** become a silently healthy new system. Visual mount coordinates are optional: unmapped systems remain in the system/evidence lists but do not get a fabricated DDG location. This does not generate a new ship-class geometry.

The separate `data_sources/Synthetic Data/` reference exercise and `data/normalized/` review output are not compatible active snapshots. Their `forecast_eligible: false` status is intentional. Reconcile identities, historical timestamps, and feed completeness before writing an adapter for them.

## Identity and temporal handling

- Preserve string IDs; keep distinct source natural keys and reference paths/row/page spans.
- All timestamp strings require a timezone and are normalized to UTC. Date-only fields retain the contract's modeled day-boundary interpretation.
- `known_at` gates when information is visible. Without it, the loader uses source-specific knowledge/as-of rules. Historical backfills require an explicit mapping of knowledge versus effective time; changing only a date string is not sufficient.
- Qualification revisions are selected by person + station. Roster, jobs, inventory, certifications, training, schedule, and supported squadron tables also select latest-known natural-key revisions.
- Exact duplicate qualification rows do not inflate qualified headcounts; their first equivalent evidence reference is retained. Conflicting same-knowledge-time roster/qualification/job rows raise issues. This is not a universal entity-resolution system for arbitrary external duplicates.
- Requisition histories are sorted and repeated history timestamps are rejected. Unknown supply statuses are rejected, not optimistically mapped.

Required maintenance, supply, inventory, roster/qualification, training/certification, schedule/availability and PMS feed failures make the affected ship's assessment insufficient-evidence. A missing casualty-feed directory is a failure; an explicitly empty, valid export is different from a missing export. Missing wholesale evidence conservatively affects all units. Prerequisite uncertainty propagates to dependent events. Incomplete data suppresses ranked fixes so donor risk is not hidden.

## Atomic refresh and revisions

`POST /api/sources/refresh` accepts:

```json
{"base_version": 12, "reset_scenario": false}
```

The server locks the shared state, fingerprints/copies the input, validates the staged copy, and evaluates a candidate scenario before activation. The source directory is fingerprinted before/after staging, and the raw staged copy must match its input fingerprint. Symlinks are rejected. Export writers should publish complete, stable batches; this is not a substitute for a transactional upstream source.

- The source revision derives from adapter identity and source content/paths. The scenario digest additionally includes this revision and scenario overlays.
- Changed successful imports replace the baseline/scenario together, increment scenario version, and invalidate rankings and baseline forecasts. The browser also polls source-health attempt timestamps so failed refreshes are visible even without a version change.
- Identical input content is a no-op, with no version increment or duplicate record accumulation.
- Compatible played event IDs survive a changed refresh only if their timestamps still match the new feed. Hypothetical/decision overlays block activation by default.
- Explicit reset permits a changed snapshot with clean playback/decisions. An unchanged snapshot remains a no-op even if reset was checked; use the exercise Reset action to reset unchanged inputs.
- Validation failure keeps the active snapshot, forecast, evidence, and scenario version. Source health records the failure and the UI warns that the previous snapshot is still in use. A stale `base_version` returns 409; invalid input/proposals return 422.
- The first incomplete snapshot has no prior usable fallback: forecasts are unknown or blocked by configuration errors. Inspect `/api/sources` and `/api/ready` or run the launcher preflight.

`GET /api/sources` reports profile/mapping/adapter/revision, configured directory, last successful refresh, latest attempt, coverage gaps, configuration errors, and catalog source statuses. For CSVs, counts are parsed rows before latest-revision selection; for artifact directories they are files. Issue counts include parse/validation/join failures and are not necessarily a count of distinct rejected entities. Freshness follows exercise time. Required gaps and freshness are separate concepts: old evidence is warned about, not silently replaced with an invented probability.

Snapshots are process-local temporary directories and are replaced on refresh. Source records remain read-only; the activity log records exercise actions separately. There is no automatic connector polling, durable snapshot archive, or restart recovery in this MVP.

## Readiness semantics

- `p_ready`: modeled probability at event start (kept for API compatibility).
- `p_assessed` and `interval_p_ready`: probability that requirements and prerequisite intervals are satisfied across the sampled event interval. Headlines, status, blockers, graph nodes, ranking and briefs use this measure.
- `curve`: point-in-time requirement probability at each `grid_dates` entry. The UI timeline plots this curve; it is **not** itself sustained interval probability.
- Material system/area scores and reported readiness ratings are not probabilities. The reported baseline is shown separately from a fresh, no-overlay model baseline.
- `null` and `UNKNOWN`: insufficient evidence, not zero readiness. Coverage explanations accompany these values.
- The deterministic planned case is explicitly labeled **at start only**. Interval sampling includes daily checks and known training/personnel transitions but is not a continuous-time reliability proof. The material grid extends through all event ends.

The ranker and dashboard use different Monte Carlo sample counts; compare within the documented sampling tolerance. Fix validation enforces available stock, cannibalization eligibility, personnel identity/availability/expiry, and event constraints before mutation. Delayed-approval rankings are not separately previewed in the UI; delays are validated/evaluated on a disposable fork before actual application.

## Honest source coverage

The UI classifies sources as `modeled`, `partial`, `review_only`, `comparison`, `context_only`, or `not_modeled` and explains why. In particular:

- Movement messages constrain schedule-derived port/transfer windows. Ship positions are context, not route/travel prediction.
- Wholesale stock, release/transit times and engineering delay affect supported options. This is not a real allocation/authorization service.
- Personnel roster statuses, latest qualifications/expiry and selected verified report facts influence availability. Watchbills and NEC billets are not a sustainable rotation optimizer.
- PMS contributes a lost-maintenance hazard modifier, not workforce competition or IEM scheduling.
- CASREP/CSMP repair links are not a complete multi-part/serialized-asset maintenance scheduler.
- INSURV remains explicitly not modeled.

## Regression proof

`tests/test_source_refresh.py` covers changed/no-op/failed refreshes, stale writes, overlay reset, immutable evidence, invalid parameters, unmapped/missing inputs, duplicate and temporal qualification rows, alternate JSON exports, alternate units/equipment/clock/weights, prerequisite cycles, reported-baseline separation, and interval-only blockers. The browser suite refreshes a changed disposable source and verifies live updates, then attempts a malformed import and verifies retained-snapshot warnings. `scripts/check_demo.py` owns and cleans up the isolated server/data/log used for that proof.

Real-data use remains gated on authorized access, connector-specific schemas, identity/time mappings, completeness policies, authentication/authorization, approved handling/hosting, and security/classification review.
