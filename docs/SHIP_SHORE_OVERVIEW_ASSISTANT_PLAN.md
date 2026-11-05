# Ship and Shore Overview assistant — implementation plan

**Status:** Roadmap with an initial bounded implementation now present. See [implemented behavior, setup and remaining limitations](OVERVIEW_ASSISTANT.md). Unchecked roadmap items below are not claims of completed functionality. The initial release includes shared projections, typed visible record evidence/counts, overview panels, constrained LLM fact selection and real local MiniLM/Transformers.js inference; advanced query types and persistent indexing remain deferred.

**Scope:** Source-backed summaries and bounded questions on **Ship Overview** and **Shore Overview** only.

**Related roadmap:** [Captain decision assistant](CAPTAIN_DECISION_ASSISTANT_PLAN.md). This is the standalone implementation scope for the overview feature; it does not require delivery of that broader roadmap.

## 1. Outcome

Help the captain understand the selected ship or installation without manually opening every record:

- What needs attention on this unit?
- Why does this system or shore capability have this displayed status?
- Which loaded records support that explanation?
- Which ship missions or shore support dependencies are already linked to it?
- What is missing, stale, uncertain or contradictory?

Provide a short deterministic summary immediately, with optional LLM explanation and bounded follow-ups. Every material factual claim must link to a loaded source record or an identified calculation with input provenance.

### Included

- Shared assistant panel in the existing Ship/Installation Overview component.
- Unit-wide and selected system/capability context, including explicit active status filters.
- Read-only queries over the accepted loaded data, respecting exercise time and scenario overlays.
- Exact record lookups, deterministic CSV aggregates, source cards and evidence tables.
- Explanations of existing status metrics and already-modeled ship/shore dependencies.
- An existing OpenAI-compatible endpoint, accessed only through the Python backend.
- Template fallback with no endpoint configured or when model output fails validation.
- Exact/lexical retrieval first; optional browser semantic retrieval as a later enhancement.

### Excluded

- New mission decision screens, fix ranking/comparison, recommended action selection, or what-if simulations.
- Approving actions, changing scenarios, confirming extracted facts or editing source files.
- General chat across the repository, arbitrary filesystem access, uploads and new Office/OCR parsers.
- Durable chat/review history, “since my last review,” exports and multi-user deployment.
- A new operational database, independent RAG source import, model hosting or replacement forecast engine.

Existing navigation to mission/dependency detail can remain available, but the overview assistant must not calculate new fixes or simulate recovery effects.

## 2. Existing integration points

| Component | Integration |
| --- | --- |
| `web/src/captain/screens/ShipOverview.tsx` | Already renders ships and installations using `domain`; embed one shared panel for both |
| `web/src/captain/api/api.ts` | Currently maps backend data into overview counts/status; migrate the relevant projection to a shared backend service while preserving displayed semantics |
| `web/src/captain/api/types.ts` | Add typed overview facts, identity, evidence and assistant responses |
| `web/src/captain/state/store.tsx` / `useApi.ts` | Follow selected unit and state updates; discard late responses from previous contexts |
| `missiontwin/api.py:AppState` | Capture accepted baseline, scenario, cursor, version and source revision under its lock |
| `missiontwin/ingest.py:Baseline` / `View` | Loaded typed rows, document facts, provenance and exercise-time visibility |
| `missiontwin/sources.py` | Accepted snapshot and refresh lifecycle |
| `missiontwin/engine.py` | Existing status/dependency calculations; remain authoritative for modeled values |
| `/api/source` | Existing source display patterns; add assistant evidence resolution with revision checks rather than silently opening current data for an old citation |
| `missiontwin/llm.py` | Reuse backend transport/configuration patterns, redaction and cache concepts with an overview-specific task/schema |

**Important:** Current LOCKER reads CSV/JSON/documents into in-memory records. “Directly from the database” means using that same accepted loaded state, not assuming an existing SQL database or pointing a model at arbitrary CSV files.

## 3. Data architecture and authority

```text
Accepted adapter snapshot
        |
Loaded baseline + exercise-time View + validated scenario overlays
        |
Shared overview projection and bounded record queries
        +-- Existing overview counts, system statuses and metric bases
        +-- Assistant fact packet and complete-set aggregates
        +-- Exact original record/span evidence
        +-- Derived lexical / optional semantic search cache
                     |
          Template summary / validated LLM explanation
                     |
          Ship or Shore Overview assistant panel
```

### Authoritative state

- Query accepted snapshot records, not the editable input directory or a separately uploaded knowledge base.
- Respect knowledge time, superseded records and visible supply-status history. A future event date can be known now; a future report cannot be exposed early.
- Apply scenario overlays through existing model/view behavior. Label a modeled overlay separately from its original recorded value.
- Exclude expected-fact fixtures, hidden feed events and the reference-only dataset from decision evidence.
- An index is a disposable search cache, never the authority for facts or arithmetic.
- A future database adapter must supply a consistent snapshot/watermark and stable record identifiers before activation; no direct unrestricted SQL access for the model.

### Shared overview projection

Create a backend projection used by both the overview UI and assistant. Extract and test current mapping rules before replacing frontend mapping:

- Counts for Ready, Watch, At risk and Unknown; total systems; unit kind and identity.
- Per-system/capability status, displayed reason, source references and metric basis.
- Whole-unit counts distinct from filtered visible counts.
- Existing mission and shore prerequisite links, without new simulation.
- Explicit empty/unknown behavior and source health.

**Do not describe ready-system share as mission success probability.** It is a count-based overview metric. Preserve distinctions among worst scheduled event-interval gates, nearest material-capability samples and reported values. An installation without usable evidence is not healthy merely because no failures were found. Illustrative geometry and regional public hazard assumptions are not observations of real facility condition.

### Snapshot capture and concurrency

Bind each request/response to:

`session_epoch`, `source_revision`, `scenario_version`, `scenario_digest`, `exercise_cursor`, `unit_id`, `unit_kind`, optional `entity_id`, explicit filters, projection/query schema version and packet hash.

Under the application lock, validate context and capture immutable typed facts and required evidence text. Release the lock before model/network calls. Source refresh currently deletes old temporary snapshots: copy the needed data or hold an explicit managed lifetime, never rely on a stale file path.

Recheck identity before returning a generated response. Return a structured `409` when the state changed; do not silently substitute newer data. Unit/filter changes must also invalidate pending browser responses. Fetch expensive existing engine output once per captured state where possible; do not add fix ranking to overview load.

## 4. CSV records and numbers

### Retrieval/query routing

| User request | Execution | Answer source |
| --- | --- | --- |
| “What status and ETA are recorded for this requisition?” | Exact typed record lookup | Visible source fields and record citation |
| “How many displayed systems are at risk?” | Shared overview projection | Count, total/filter and classification basis |
| “Which open work records concern this capability?” | Allowlisted filter/join across visible loaded records | Matching records, completeness and provenance |
| “Which qualifications expire in this date range?” | Typed date comparison across the full eligible set | Matching rows and date/time interpretation |
| “Why is this system at risk?” | Existing status/dependency results plus linked source records | Modeled reason and separately cited recorded facts |
| “What does the casualty narrative say?” | Exact/lexical, optionally semantic passage retrieval | Eligible quoted spans |
| “Which ship events depend on this shore capability?” | Existing validated dependency graph | Linked modeled dependencies, not predicted recovery effects |

The model must not count rows, add quantities or calculate probabilities from semantic snippets. Similarity results are incomplete by design and cannot establish totals.

### Table registry and bounded operations

For each supported table define its logical name, owning unit, stable record key, join keys/cardinality, typed fields, units, null policy, knowledge/effective timestamps and original-source locator. Reuse ingest normalization instead of creating a second interpretation of the files.

Begin with explicit server-side operations:

- `get_overview_status`
- `get_record`
- `list_linked_work`
- `get_requisition_status`
- `list_expiring_qualifications`
- `get_existing_dependencies`
- `get_source_health`

These are proposed service names. M0 must map each operation to supported loaded tables/fields and existing model references; unsupported relationships must not be guessed from text similarity. Resolve ambiguous entity names with clarification.

Validate arguments with strict schemas. Allowlist fields/operators, enforce unit ownership and linked cross-unit scope, bound date ranges/result sizes and use parameterized queries if a database projection is introduced. Never execute model-generated SQL, Python or dataframe expressions.

### Numerical rules

- Keep equipment codes, NIINs, document numbers and other identifiers as strings, including leading zeroes.
- Distinguish missing, zero, no matching records, incomplete data and unreadable sources.
- Use integers/decimal arithmetic where appropriate for source quantities; preserve engine probability precision and round only at presentation.
- Carry units with every quantitative value. Preserve probability versus percentage versus percentage-point delta distinctions.
- Compare timezone-aware dates/times; distinguish recorded ETA, actual completion and modeled completion.
- Resolve status histories at the exercise cursor before returning values.
- Prevent join fan-out and duplicate counting; declare distinct keys and report unmatched rows.
- Aggregates scan the **complete eligible population before pagination**. Display limits must not silently change totals.
- Return query ID/version, filters, units, numerator/denominator when meaningful, contributing record references, exclusions and completeness status.
- Use existing engine eligibility rules when describing availability; stock quantity alone does not establish transfer eligibility or readiness.

### CSV representation for search

For lexical/optional semantic retrieval, serialize eligible rows with table name, headers, units, identifiers and source location. Keep quantity attached to item/unit, dates attached to the correct status and narrative cells linked to their parent row. Split long narrative text only with preserved record identity.

Search returns record IDs. Hydrate final values from the typed query service; do not trust embedding text as the factual record. Filter mixed-time rows/paragraphs before indexing or sending browser embedding batches. If safe visibility cannot be determined, exclude that content and disclose the gap.

## 5. Direct source evidence

Every material claim exposes a **Loaded source** link, opening a source drawer with:

- Source system/steward, adapter, unit and accepted revision.
- Stable record key and relative file plus field/row, or page/line/set/span locator.
- Relevant permitted raw fields/excerpt and any normalized representation, clearly labeled.
- Knowledge/as-of timestamp, freshness, extraction certainty and conflicts.
- Evidence role: feeds the engine, reported context, assumption or scenario overlay.
- Original-export linkage where supplied by the adapter.

For calculated claims, show the calculation/query identity and input provenance. A modeled status is not literally stated in one CSV row: expose the rule/metric basis and contributing records rather than implying that it is a source quote.

Aggregates show filters, distinct key, completeness and a paginated list of contributing references. One example row cannot substantiate a whole-table total. Count claims derived from the overview projection link to contributing system assessments and their source chains.

Evidence IDs are issued and resolved by the server, scoped to the captured packet and permitted records. Reject path traversal, unauthorized entities and stale revision resolution. Return `409`/`410` for unavailable old evidence rather than opening newer text under an old citation. Apply redaction/access rules to the source drawer, not just model prompts.

### Refresh behavior

Accepted refresh activates source records and overview/query projections together. Rejected refresh preserves prior authority. Clear affected packet/query/model caches by identity. A semantic index may rebuild later, but must not return previous-revision facts; use current structured/lexical results with an explicit partial-index indicator.

## 6. UI behavior

Embed `OverviewAssistantPanel` in the shared `ShipOverview.tsx` component. Keep existing status cards, filters, 3D view and system lists intact.

### Common panel layout

1. **Unit brief:** up to three supported attention items, with a deterministic ordering policy and visible basis—not an invented mission priority.
2. **Why this status:** source-linked explanation for the unit or selected system/capability.
3. **Loaded sources:** concise evidence table/drawer, freshness and coverage warnings.
4. **Existing dependencies:** affected events or linked units already present in model results.
5. **Ask about this unit:** bounded input and context-specific suggested questions.

Show unit name/kind, exercise “as of,” source revision, active focus/filter and response mode (`template`, `cache`, `llm`). Generation time must not masquerade as source freshness.

### Ship-specific context

Selected ship, department/system focus, linked work/requisitions/qualification evidence and existing shore prerequisites. Suggested questions:

- “What needs attention on this ship?”
- “Show the records behind this system's status.”
- “Which shore dependencies are linked to this ship?”

### Shore-specific context

Selected installation, capability/facility focus, linked work/supply/staff/training evidence and existing dependent ship events. Suggested questions:

- “Which support capabilities need attention?”
- “Which work records explain this capability warning?”
- “Which ship events depend on this support capability?”

Retain mock-installation markings. Do not present regional hazard assumptions or illustrative assets as verified real-world facility conditions.

### Interaction rules

- Initial summary and sources work without a model; do not block overview rendering on generation.
- Clicking a system/capability explicitly scopes the panel; clearing focus restores unit scope.
- Filtered questions display their filter and both filtered/whole-unit totals where appropriate.
- Unit/domain/focus/filter/state changes invalidate context; prevent out-of-order responses from overwriting the new selection.
- Mark old answers stale and offer regeneration; never silently reuse a previous unit's conversation.
- Use plain text or sanitized rendering, keyboard-accessible citations, readable tables and a collapsible narrow-screen layout.
- Keep chat session-local. Decline requests for changes, fixes or simulations and direct users to existing application workflows without performing an action.

## 7. API and file plan

Names are proposed; preserve existing APIs.

### Endpoints

- `POST /api/overview-assistant/brief`: validated unit/kind, optional entity/filter, expected version/revision; returns overview packet, deterministic summary and optionally validated explanation.
- `POST /api/overview-assistant/ask`: server-issued packet ID, expected identity and bounded question; server loads authoritative context.
- `GET /api/overview-assistant/evidence/{evidence_id}`: authorized revision-checked record or calculation evidence.
- `GET /api/overview-assistant/status`: safe capability/mode/coverage information, never credentials.

Use typed errors for invalid/ambiguous scope, stale state, unsupported question and unavailable evidence. Template fallback is a successful degraded response, not an unexplained empty answer.

### Core schemas

`OverviewIdentity`, `OverviewAssessment`, `OverviewFact`, `StructuredQueryResult`, `OverviewEvidence`, `OverviewPacket`, `OverviewExplanation`, request models and typed errors.

Facts distinguish `reported`, `modeled`, `aggregate`, `assumption` and `overlay`. Values are typed/nullable with units, metric basis and evidence/calculation references. The model can reference only issued fact/query/evidence IDs. Critical values, dates, labels and citations are inserted by the UI from typed results, not copied from generated prose.

### Implementation files

| File | Responsibility |
| --- | --- |
| `missiontwin/overview_models.py` | Strict contracts |
| `missiontwin/overview.py` | Shared overview projection, immutable packets and template summary |
| `missiontwin/loaded_queries.py` | Read-only typed queries, joins, complete-set aggregates and lineage |
| `missiontwin/overview_assistant.py` | Bounded intent routing, context assembly, explanation validation and fallback |
| `missiontwin/retrieval.py` | Eligible lexical search; optional semantic fusion later |
| `missiontwin/api.py` | Thin routes and snapshot/cache lifecycle integration |
| `missiontwin/llm.py` | Overview task transport/cache/timeout integration |
| `web/src/captain/components/overview-assistant/` | Shared panel, source drawer and evidence/query tables |
| `web/src/captain/screens/ShipOverview.tsx` | Embed the panel for both domains |
| `web/src/captain/api/{api,types}.ts` | Typed transport and shared-projection mapping |
| `tests/test_overview_assistant.py`, `tests/test_loaded_queries.py` | Backend acceptance |
| `web/tests/overview-assistant.spec.ts` | Ship/Shore browser acceptance |

Use shared Python services rather than internal HTTP calls. No new runtime dependency should be needed for the initial structured/lexical release.

## 8. LLM endpoint and local secrets

Use the already-running OpenAI-compatible service. Confirm actual support for the current client's `/chat/completions`, JSON-object output, `temperature` and token-limit parameters; implement an explicit adapter if needed. Native tool calling is not required: start with server-side intent routing and a fixed allowlisted pipeline.

### Local configuration

Create repository-root `.env` from `.env.example` only if it does not exist. Store the actual key there, never in documentation, chat or committed examples:

```text
LLM_BASE_URL=<approved-existing-service-base>
LLM_MODEL=<exact-model-id>
LLM_API_KEY=<local-secret-if-required>
MISSIONTWIN_DEMO_MODE=0
```

- Existing ignore rules exclude `.env`/`.env.*` and allow `.env.example` with placeholders.
- Verify `git check-ignore .env`; `git ls-files -- .env` must return no tracked file.
- Never use `VITE_*` secrets or send the key to browser storage, bundles, status APIs, source cards, prompts, logs, caches or exports.
- The Python backend alone reads the key and contacts the provider. Restrict local permissions; omit secrets from backup/sharing bundles.
- Git ignore does not prevent OneDrive sync. For strict local-only secret storage, use a non-synced checkout; otherwise explicitly approve the sync exposure.
- Environment variables override `.env` in the existing loader. Restart after configuration changes. Rotate a key immediately if exposed or committed; deleting the latest copy does not remove history.

The existing `missiontwin.demo` launcher deliberately forces offline behavior. Use the documented direct API startup on a separate local port for live integration tests; do not disrupt the demo on 8000. Live mode also permits existing extraction calls, so test with isolated synthetic sources/logs. Introduce a separately documented overview-assistant enablement flag if needed, without weakening global offline behavior.

### Model response controls

Send a minimal redacted packet, selected evidence and the question—not whole tables or the entire baseline. Bound question size, context bytes/tokens, output length, concurrency, retries and elapsed time. Never hold the application lock across provider calls.

Validate JSON, permitted fact/evidence references, claim support and preserved qualifications. Correct numbers do not prove correct causality. Reject invented fields, metrics, relationships or instructions; return the deterministic summary and a safe fallback explanation. Start without streaming so unvalidated claims are not displayed as accepted answers.

Cache by full packet/context identity, model, task/prompt/schema/policy versions and question hash. Apply current validation/redaction rules on cache reads. Expose method and degradation reason; hide raw provider errors and credentials.

## 9. Optional semantic retrieval: limited Keystone port

This enhancement must not delay the structured overview feature. Candidate patterns from the supplied Keystone guide are provenance-aware chunks, keyword/meaning fusion, a browser embedding worker, CPU fallback, local assets and index-progress UI. Actual code reuse requires source/license/test verification; the guide alone is not a verified code port.

If added:

- Retain exact identifiers and complete-set queries as authoritative paths.
- Server issues bounded eligible chunk batches with hashes, revision/model fingerprints and short-lived leases; validate returned dimensions, finite values, norms, membership and sizes.
- Run Transformers.js/ONNX in a Vite worker with self-hosted assets; CPU-first, optional tested WebGPU with watchdog/fallback.
- Coordinate tabs; publish versioned indexes atomically. Never mix model versions or upload hidden future text to the browser.
- Browser closure, unavailable assets or partial indexes must preserve lexical/template functionality.
- Store optional LanceDB indexes outside OneDrive in a local cache directory. Treat them as rebuildable, never source data.
- Validate actual Windows/Python/browser compatibility before pinning optional dependencies. Do not add Flask, Office parsers or server-side PyTorch for this feature.

Similarity is a retrieval signal, not numerical accuracy or confidence in a status.

## 10. Security boundary

- Read-only operation allowlist; no shell, arbitrary URLs/files, unrestricted SQL or scenario mutation tools.
- Retrieved documents and CSV cells are untrusted data, not instructions. Test prompt injection and unsupported-action requests.
- Apply unit scope, knowledge-time restrictions and privacy rules before retrieval/model context and again during evidence resolution.
- Loopback is not authentication. Test host allowlisting and same-origin/Origin protections; add a local session/CSRF mechanism for relevant POSTs before release. Do not use wildcard CORS.
- Enforce parser/query/result/context limits. Missing or unreadable evidence yields uncertainty, not a healthy default.
- Log minimal metadata: identity, operation/evidence IDs, model/prompt version, latency and validation/fallback outcome. Review existing raw-prompt diagnostics before enabling broader data use.
- Cloud endpoint use requires explicit data-policy approval; a local `.env` does not mean model requests stay local. Strict offline mode forbids external model calls and asset downloads.

## 11. Delivery sequence and acceptance

### M0 — Data and metric contract

- [ ] Map existing Ship/Shore Overview projection rules and record links.
- [ ] Define table/field/join/unit/time contracts for supported queries.
- [ ] Select KESSLER and NSNORFOLK fixtures, with an existing cross-unit dependency.
- [ ] Define packet/evidence schemas and deterministic attention ordering.
- [ ] Check endpoint capabilities with approved synthetic inputs and verify secret handling without logging the key.

**Exit:** Reviewed contracts and baseline parity fixtures; no application behavior changes.

### M1 — Loaded-data backend and deterministic brief

- [ ] Implement shared overview projection and bounded loaded-record queries.
- [ ] Capture immutable unit/focus/filter packets with direct source and calculation lineage.
- [ ] Add structured aggregate completeness and lexical evidence lookup.
- [ ] Implement brief/evidence/status routes, stale-state handling and safe refresh invalidation.
- [ ] Add numerical, temporal, join, provenance and projection parity tests.

**Exit:** Both selected units produce source-backed deterministic overview summaries; values match loaded records/current overview semantics. No model or new runtime dependency required.

### M2 — Ship and Shore Overview UI

- [ ] Add shared panel, source drawer, focus/filter context and existing-dependency links.
- [ ] Consume the shared backend projection without changing metric meaning.
- [ ] Handle Unknown/empty states, loading, errors, stale answers and rapid selection changes.
- [ ] Add isolated browser tests covering both domains and accepted/rejected source refresh.

**Exit:** A user can understand a displayed status and open its supporting records from either overview without navigating the raw corpus.

### M3 — Existing LLM and bounded questions

- [ ] Add overview explanation task, strict response validation and template fallback.
- [ ] Implement supported lookup/aggregate/narrative questions with server-side routing.
- [ ] Add context budgets, backend-only credentials, redaction and minimal audit metadata.
- [ ] Test mock failures/injection and run opt-in evaluation against the actual endpoint.

**Exit:** Real-model answers explain verified facts, cite evidence and abstain appropriately; unsupported output degrades to the deterministic experience. Mock responses alone do not establish live quality.

### M4 — Optional browser semantic search

- [ ] Verify Keystone code candidates/licenses or implement the patterns independently.
- [ ] Add worker/assets, authorized batches, optional vector storage and coverage UI.
- [ ] Benchmark retrieval against lexical baseline; test offline/browser/OneDrive failure paths.

**Exit:** Paraphrase retrieval improves or matches baseline without weakening exact lookup, numerical fidelity, visibility or revision isolation. Feature remains usable with semantic search disabled.

## 12. Release checks

| Area | Acceptance |
| --- | --- |
| Overview parity | Ready/Watch/At-risk/Unknown counts and metric bases match the shared projection for ship and shore, including filtered/empty states |
| Numeric fidelity | Recorded values equal typed loaded fields; modeled values equal captured engine results at documented display precision |
| CSV completeness | Counts/aggregates use the full eligible set; tests cover leading zeroes, missing vs zero, fan-out joins, nulls, units, boundaries and pagination |
| Evidence | Exact record/span resolution, calculation lineage and complete aggregate references; stale IDs never silently resolve to new records |
| Visibility | No future-event, hidden-history, expected-fixture or reference-corpus leaks, including mixed-time rows/pages |
| Cross-unit scope | Only validated linked shore/ship evidence is included; no source from a previously selected unit appears after a context switch |
| Refresh | Accepted refresh changes overview and assistant together; rejected refresh preserves prior authority; semantic lag uses current structured/lexical fallback |
| Read-only | Brief/question requests do not change scenario version/overlays, source bytes or decision log; separate assistant audit metadata is allowed |
| LLM safety | Invalid JSON, unsupported claims/causality, injection, timeout and unavailable provider produce bounded safe fallback |
| Secrets | `.env` ignored/untracked; placeholders only in committed examples; no key in browser assets/storage, response/prompt/log/cache/export fixtures |
| UI | Keyboard-accessible evidence, narrow layout, domain/focus/filter switches, stale banners and out-of-order responses tested |
| Performance | Baseline cold/warm timings recorded; structured overview remains responsive independent of provider latency; bounded provider timeout/fallback verified |

Run backend tests, frontend typecheck/build and isolated Playwright checks. Own temporary sources, logs, caches, mocked endpoints and free ports; never reset the user's server on 8000. Use independent source/engine expectations, not the assistant's own generated answer as the test oracle.

Record live model/version/prompt identity, source revision, supported/unsupported claims, citation failures, abstentions, latency and fallback rates. Require zero critical numerical, visibility or unauthorized-action failures in the release fixture suite and human review of explanations. Synthetic tests are not operational certification.

**First pull request:** Shared overview/query contracts and projection parity tests, followed by deterministic unit packets and direct evidence routes. Then implement the shared Ship/Shore panel. Add LLM wording only after that boundary is reliable.
