# Captain decision assistant — implementation plan

**Status:** Proposed; no assistant implementation or new dependencies delivered by this document.

**Starting point:** `main` at `0ffea93` (inspected during planning).

**First deliverable:** Source-backed assistant panels on Ship Overview and Shore Overview, with drill-down into a mission-specific decision brief and bounded follow-up questions.

**Updated scope:** Use the same loaded data and state identity as the overviews. Query structured CSV values deterministically; use narrative RAG for explanations, not as a calculator.

**Standalone overview scope:** See [Ship and Shore Overview assistant implementation plan](SHIP_SHORE_OVERVIEW_ASSISTANT_PLAN.md) for the overview-only delivery plan, excluding mission decisions, fixes and simulations.

**Model assumption:** An existing OpenAI-compatible LLM service; LOCKER is the client, not a model host.

## 1. Objective and product boundary

Reduce the captain's need to inspect every source and interpret every chart. Answer:

1. What needs my attention for this mission?
2. Why is it at risk, and what evidence supports that explanation?
3. Which **available, modeled** options improve it?
4. What happens to other ships, missions, or shore dependencies?
5. What decision or additional verification is needed?

Lead with a concise bottom line, options and trade-offs. Make evidence accessible by expanding a claim, not by requiring the captain to read a document collection first.

This remains **synthetic, read-only decision support**, not an operational authority. The captain decides. The assistant cannot issue orders, approve fixes, confirm extracted facts, edit sources, or apply scenarios. Existing explicit decision workflows remain separate.

### First-slice scope

- Both Ship Overview and Shore Overview: selected-unit summaries backed directly by loaded records, with optional mission/system/capability focus.
- Initial acceptance covers KESSLER and NSNORFOLK, including a ship-to-shore dependency and a source replacement/refresh.
- Structured current-state packet from the same loaded records, overview metrics, forecast, dependency chain, source health, and existing fix ranking. Reuse existing ranking results on demand rather than calculating all fixes during overview load.
- Deterministic brief that works without an LLM.
- Optional live-model explanation through the existing endpoint configuration.
- Source-linked evidence, with exact identifiers and lexical retrieval over eligible evidence.
- Bounded follow-ups: explain risk, show evidence, compare available options, explain donor consequences, identify missing information.
- Session-local conversation; explicit refresh/invalidation when the scenario or source changes.

### Deferred beyond the first slice

- General-purpose chat over arbitrary local folders or the whole repository.
- Arbitrary uploads, Office ingestion, OCR, operational connectors, durable multi-user conversations.
- Autonomous tool planning, assistant writes, automatic approvals, or executable model-generated code.
- A new optimization engine or claims of globally optimal action selection.
- Persistent “what changed since my last review” until review snapshots are implemented.
- Browser semantic search is a subsequent milestone, not a prerequisite for the brief.

## 2. Current LOCKER foundations and gaps

| Existing component | Reuse | Required change / limitation |
| --- | --- | --- |
| `missiontwin/api.py:AppState` | Active snapshot, scenario version, lock, forecast, cached ranking | Capture one immutable decision packet; do not make model calls under the shared state lock |
| `missiontwin/engine.py` | Mission/gate probabilities and dependency explanations | Remains authoritative for estimates; no LLM-generated readiness numbers |
| `missiontwin/fixes.py` | Ranked fixes, modeled benefit, donor effects | Filter and explain existing candidates; distinguish ship-level ranking from mission-specific comparison |
| `missiontwin/brief.py` | Deterministic cited brief | Add a structured mission-specific decision model; preserve existing brief endpoint |
| `missiontwin/llm.py` | OpenAI-compatible client, validation, caching, redaction, timeout/fallback pattern | New task and bounded response schema; stronger claim support than numeric-token preservation alone |
| `missiontwin/sources.py` | Immutable adapter snapshots and source revision | Retrieval indexes must follow accepted snapshot lifecycle, not the editable input directory |
| `missiontwin/ingest.py:Baseline` / `View` | Parsed records with `_src` provenance and exercise-time visibility | Shared read-only query service over the loaded corpus; prevent future-event and superseded-record leakage |
| `web/src/captain/screens/ShipOverview.tsx` | Shared Ship/Installation Overview implementation selected by `domain` | Add one shared assistant panel with unit-kind-specific prompts, source-linked metrics and optional focused system/capability |
| `/api/dashboard`, `/api/state` and captain API overview mapping | Existing overview inputs | Capture a common state identity and reconcile metrics; do not let frontend and assistant classify the same system differently |
| `/api/source` | Current source viewer and provenance | Add revision-aware evidence resolution; current endpoint resolves against the current snapshot |
| `/api/preview`, `/api/captain/preview` | Disposable what-if calculations | Reuse behind a bounded service in a later milestone, never assistant mutation endpoints |
| `web/src/captain/screens/Brief.tsx` | Captain-facing brief screen | Add concise decision cards, evidence drawer, follow-up panel, stale-state behavior |
| `web/src/captain/api/{api,types}.ts` | UI/API adaptation | Add typed decision responses rather than flattening the new brief to one text paragraph |
| `tests/`, `web/tests/`, `scripts/check_demo.py` | Existing offline and isolated test patterns | Extend with numerical, retrieval, stale-state, grounding and live-endpoint evaluations |

The current `/api/brief` builds a ship-level template and optionally rewrites it. This is not a general RAG assistant. Its existing guards do not establish full factual equivalence. The current demo launcher explicitly forces offline mode, even if model variables are set.

## 3. Keystone portability assessment

This assessment uses the **supplied user guide and requirements**, not inspected Keystone source. “Reuse” below means a design candidate, not a verified drop-in code port. Obtain a source checkout, exact revision, tests, license and third-party notices before copying implementation. The supplied guide describes MIT licensing; verify the actual files and assets being copied.

| Keystone capability / likely source | LOCKER decision | Adaptation / milestone |
| --- | --- | --- |
| Keyword + meaning search, `vector_index.py` | Reuse hybrid-search pattern | Exact equipment/requisition/mission identifiers first; semantic search later; filter by snapshot, exercise time, unit and evidence role |
| Heading/page/slide/sheet-aware document chunks | Reuse provenance-aware segmentation | Start with canonical CSV rows, CASREP sets, PDF pages and spans; never detach a value from its row headers or message context |
| `static/embed-worker.js`, local Transformers.js/ONNX | Candidate browser worker port | Convert to a Vite worker; self-host assets, fingerprint model/runtime; add server-controlled batch leases and validation |
| LanceDB vector storage | Optional later dependency | FastAPI service owns storage; clients never choose filesystem paths or database partitions |
| CPU fallback, WebGPU checks and idle unload | Reuse behavior and tests if available | CPU-first baseline; WebGPU opt-in after parity/health checks; reject nonfinite/invalid vectors; bounded worker timeouts |
| Index progress and per-file errors | Reuse UX pattern | Display lexical/semantic coverage, revision, pending/failed documents and fallback mode without blocking the brief |
| Page context and suggested prompts | Reuse product pattern | Selected unit, mission and version; server validates scope; explicit new context on selection changes |
| OpenAI-compatible profiles and backend key storage | Reuse client-side secrecy principle | Keep existing server environment configuration initially; no browser keys or profile editor required |
| Mock LLM server tests | Reuse test approach | Validate unsupported claims, malformed output, timeouts, cached replay and optional tool-call capability |
| Apply/reject and optimistic concurrency | Reuse safety concept | First slice has no writes; later previews remain isolated and approval stays in existing versioned UI |
| Immutable weekly status snapshots and template reports | Reuse snapshot-first reporting | Future “since last review” compares stored decision packets, not model memory |
| Local/offline bundle and dependency manifests | Reuse packaging approach | Match LOCKER Python/OS and optional browser assets; fail closed on offline downloads |
| Document cache, subprocess extraction, file-size limits | Reuse selectively | Extend beyond existing PDF/text only when needed; add bounded parsers and preserve source locators |
| OneDrive-aware cache relocation and lock retries | High-priority reuse | This checkout is in OneDrive; keep mutable indexes outside the synced tree by default |
| Vault writes, inbox filing, git commits, timesheets, plan scheduling | Do not port | Outside LOCKER's scope; no arbitrary filesystem tools or second scheduling engine |
| Flask and monolithic `static/index.html` | Do not port | Retain FastAPI and React/Vite; translate useful worker/UI logic rather than adding a parallel app |

### Dependency disposition

| Supplied requirement | Decision |
| --- | --- |
| `flask>=3.0` | Do not add; FastAPI already serves the app |
| `lancedb>=0.20` | Optional semantic milestone only; select and test a compatible pinned release, not an unverified minimum |
| `pypdf>=4.0` | Already covered by LOCKER's `pypdf>=4.3`; reuse existing PDF extraction |
| `python-docx>=1.1` | Defer until Word is an explicitly supported source format |
| `python-pptx>=0.6.23` | Defer; not needed for decision briefs or initial RAG |
| `openpyxl>=3.1` | Defer until spreadsheet adapters have an approved schema/provenance contract |

First slice should require **no new runtime package**: existing Pydantic, httpx, pypdf and Python standard library are sufficient. For lexical search, begin with normalized tokens and exact identifiers; evaluate SQLite FTS5 if needed, checking runtime availability and retaining a simple fallback. For the semantic milestone, introduce an optional requirements file and a locked browser dependency for `@huggingface/transformers` (exact version chosen after compatibility testing). Do not install server-side transformer/PyTorch packages just to support browser embeddings.

Keystone's reported throughput, memory use and model sizes are reference observations, not LOCKER guarantees. Benchmark on the target Windows/Edge machine. Account separately for quantized CPU and full-precision GPU assets; the smaller offline bundle is not automatically sufficient for both.

## 4. Architectural decisions

### 4.1 Separate facts, calculations and language

```text
Selected mission + question + expected state identity
                     |
              Decision service
       +-------------+---------------+
       |                             |
  Engine evidence              Retrieval service
  - interval/start estimates   - eligible source records
  - dependency chain           - exact + lexical search
  - ranked modeled options     - optional semantic results
  - donor consequences         - source health/provenance
       +-------------+---------------+
                     |
          Immutable decision packet
                     |
        Deterministic brief / optional LLM explanation
                     |
       Claim validation + current-state recheck
                     |
       Captain cards + citations + follow-up questions
```

The server assembles the packet. The LLM does not receive arbitrary file access, SQL access, shell access, or mutation tools. Start with deterministic intent routing and a fixed retrieval/comparison pipeline. Native LLM tool calling is optional later, not a requirement of the first release.

**Numbers are rendered from typed engine fields.** The model may select valid claim/evidence IDs and supply bounded wording, but cannot introduce new numeric facts. Facts, modeled estimates, assumptions, and suggestions are separate response categories. A citation existing somewhere in the packet does not prove that it supports a particular claim.

### 4.2 State identity, concurrency and lifetime

Every packet and answer carries:

- `source_revision`, `scenario_version`, `scenario_digest`, `exercise_cursor`;
- selected `ship_id`, `event_id`, source profile;
- engine/packet schema version, seed, run count, interval assessment basis;
- evidence-set hash; generation time separate from exercise time;
- for cached model wording: model, prompt version, question/context hash and policy version.

Under `AppState.lock`, validate identifiers/version and capture an immutable packet and eligible evidence text. Copy needed bytes before releasing the lock; source refresh currently cleans up the old temporary snapshot. Do not leave an in-flight answer holding paths to deleted snapshot files.

Release the lock before retrieval work that can be performed on captured data and before network/model calls. For expensive ranking, either use the existing cache or calculate from a detached fork, then publish only if identity still matches. Recheck state before returning an answer. A changed state returns `409` with structured identity information; never silently present the old answer as current. Avoid locking across slow client connections.

Use a process/session epoch in temporary answer and index-job IDs so restart cannot make a reused scenario version look like the same exercise. Long-term cache keys must include actual content/state identities, not just an integer version.

### 4.3 Temporal and provenance-safe retrieval

The accepted snapshot is the corpus authority, **not** all of `data/`, the repository, or a user's folder. The separately normalized reference package stays excluded from decision evidence by default. A future reference mode must be explicitly labeled and cannot support calculated readiness claims.

Index records with stable content-based chunk IDs and metadata:

`source_revision`, profile, adapter, relative file, record key, page/row/line/set, exact span, content hash, unit and linked entities, knowledge timestamp, validity/supersession information, usage classification, extraction status, stale/conflict flags.

Use `View` semantics to determine visibility at the exercise cursor. Future feed events, future facts, hidden status-history entries, future narrative paragraphs, and expected-fact/evaluation fixtures must not leak through retrieval. **A whole PDF page or CSV row can mix past and future information:** only expose eligible spans/fields; if visibility cannot be established, exclude the chunk from decision retrieval and report the gap. Upcoming scheduled mission dates that are already known are allowed; knowledge time is not the same as the event date.

Retrieval sequence:

1. Validate unit/mission against the active profile and resolve exact entity references.
2. Select mission dependencies and linked donor/shore entities; expand scope only for justified trade-offs.
3. Apply revision, profile, visibility and evidence-role filters **before ranking**.
4. Perform exact identifier and lexical retrieval; merge semantic matches when available.
5. Deduplicate by record/span; preserve corrections and contradictions with their relationship, rather than dropping inconvenient evidence.
6. Rank with a transparent fusion rule such as reciprocal-rank fusion; diversify so one long document cannot dominate.
7. Bound result count and context size; include relevant missing/stale/contradictory evidence warnings.
8. Produce claim-linked evidence references, not a loose bibliography.

A source timestamp being recent does not automatically make it authoritative. Preserve stewardship, corroboration, extraction certainty and supersession metadata. Similarity scores are not confidence in a decision.

### 4.4 Browser embeddings: optional acceleration, not authority

Port Keystone's browser model as a later optimization while keeping lexical mode fully functional:

- Use a dedicated Web Worker; keep generation credentials and LLM requests on the server.
- Server issues a bounded batch containing authorized, redacted eligible text, chunk hashes, model fingerprint and a short-lived lease. Cap bytes, chunks and outstanding work.
- Server validates upload lease, source revision, exact chunk membership/hash, vector dimension, dtype, finite values, norm, model/pooling/normalization version and payload size. Reject unsolicited vectors and obsolete jobs.
- Coordinate tabs with a server lease; avoid duplicate index writers. Publish completed revision indexes atomically; never mix vectors from different models.
- Embed queries with the same model and preprocessing; validate query vectors too. Browser vectors are untrusted input, not evidence. Structural checks cannot prove correct embeddings; support rebuilds and compare retrieval against lexical and CPU baselines.
- On timeout, unsupported WebAssembly/WebGPU, unavailable model, tab closure, partial index or bad output, return lexical results and show the reason. Do not block decision briefs waiting for semantic indexing.
- Start CPU-first. Only enable WebGPU after CPU/GPU parity tests and watchdogs; use distinct validated artifacts if precision differs.
- Self-host model, tokenizer, Transformers.js, ONNX/WASM and worker assets. Production/offline startup never depends on a CDN.
- Browser sessions receive only eligible content. Do not pre-embed hidden future text in the browser and assume filtering search results later protects it.
- Browser not open means no new browser embeddings. Completed eligible indexes can be reused, but semantic query embedding still needs a working browser worker; otherwise use lexical search. Server-side embeddings would be a separate future option.

Store derived indexes under `%LOCALAPPDATA%/LOCKER/index` on Windows or the platform's local cache directory, outside OneDrive by default. Provide a proposed `LOCKER_INDEX_DIR` override, single-writer coordination, bounded retries and safe rebuilds. Cache deletion must never delete source records. Retain only necessary revision partitions; rejected refresh candidates must never become searchable.

### 4.5 Loaded-data authority: what “directly from the database” means

**The assistant must use the same accepted loaded dataset as the overviews.** Current LOCKER is not backed by an operational SQL database: CSV/JSON/document adapters populate `Baseline` records and an exercise-time `View` in memory. The engine applies scenario overlays to that baseline. Do not add a separate uploaded corpus, manually maintained RAG knowledge base, or independently refreshed database as a competing source of truth.

Proposed flow:

```text
Accepted source adapter snapshot
        |
Baseline records + time-filtered View + validated scenario overlays
        |
Shared loaded-data query / overview projection service
        +-- Ship / Shore Overview metrics and details
        +-- Typed assistant facts, aggregates and dependencies
        +-- Evidence resolver -> exact original row / document span
        +-- Derived lexical / optional semantic index (disposable cache)
```

The server owns the query service. If SQLite or another database is later introduced, it is initially a read-only derived projection keyed to the accepted source revision, not a reason to reimport different source bytes. A future real database adapter must capture a consistent snapshot/transaction watermark and stable record/version identifiers before activation. Secrets, connection strings and database credentials never go to the model or browser.

For every assistant claim, provide an expandable **Loaded source** card:

- Source system/steward, unit, adapter, source revision and exercise “as of” time.
- Stable record key and file/row/column or document page/span locator; include raw-export linkage when the JSON adapter provides it.
- Only the relevant permitted fields and exact source excerpt; clearly distinguish raw recorded values from normalized values.
- Freshness, extraction certainty, contradictions and whether the record actually feeds the model or is context/review-only.
- For derived claims, the calculation/query ID, input record references, filters, units and method; distinguish scenario-overlay inputs from recorded facts.

The initial collapsed response is concise, but **each material factual/numerical claim has a direct source or calculation link**. A generic file-name bibliography is insufficient. Aggregate evidence can be paginated; show all contributing record IDs/counts and a reproducible query, not a misleading citation to one example row. Enforce authorization/redaction when opening raw records too.

Source refresh activates records and derived query projections together. Until activation succeeds, the old accepted dataset remains authoritative. Semantic indexing may lag, but the exact query service and source links must immediately match the accepted revision; mark semantic coverage partial and fall back to structured/lexical paths. A scenario overlay can change a modeled value without changing its original source row: display both and cite the overlay separately. Never pass the full raw baseline or unfiltered scenario history to the model.

### 4.6 CSV and numerical RAG: structured retrieval first

**Do not embed a CSV file as undifferentiated prose and ask the LLM to calculate from nearest-neighbor matches.** Similarity retrieval is useful for finding concepts, but cannot reliably count, join, compare dates, sum quantities or prove completeness.

Use three complementary paths:

| Question type | Authoritative execution | LLM role |
| --- | --- | --- |
| Exact lookup: requisition status, recorded ETA, qualification expiration | Typed lookup against visible loaded records | Explain the returned fields and cite the exact record |
| Count/sum/filter/date comparison: overdue work, eligible stock, expiring qualifications | Allowlisted server-side query over the full eligible record set | Summarize the result; no arithmetic over retrieved text |
| Readiness, uplift, donor effects, ship/shore propagation | Existing engine/ranking/preview service on captured state | Explain the modeled result and its assumptions |
| Narrative reason: casualty notes, daily report explanation | Exact/lexical + optional semantic passage retrieval | Summarize supported narrative with span citations |
| Mixed question: why a number changed or why a capability is at risk | Structured result + engine dependencies + supporting passages | Connect verified claims without inventing causal relationships |

#### Table and field contracts

- Register each supported table with its logical name, owner/unit kind, stable keys, join keys, field types, units, null policy, knowledge/effective timestamps and source locator rules. Reuse ingest normalization; do not introduce a second parser with different meanings.
- Treat NIINs, requisition/document numbers, hull IDs and equipment codes as strings, preserving leading zeroes. Missing does not mean zero; an empty set, unknown value and unreadable source are different states.
- Use timezone-aware timestamp comparisons; distinguish recorded ETA, actual completion and modeled completion. Resolve supply status histories using exercise-time rules before querying or rendering a row.
- Validate numeric input, finite values, ranges and units at ingestion/query boundaries. Use exact decimal/integer arithmetic where quantities require it; retain engine probability precision and round only for display. Percentage-point change is not relative percentage change.
- Join only on explicit validated keys and declared cardinalities. Prevent fan-out double counting across work orders, parts, staff and missions; report unmatched/duplicate keys and incomplete joins.
- Use engine-supported availability/eligibility logic rather than treating all stock rows as transferable or treating every expired training row as a modeled blocker.
- For counts and totals return numerator/denominator where meaningful, filters, distinct key, contributing records, excluded/missing rows, completeness status and calculation version. A top-k search result is never a complete population for an aggregate.

#### Semantic representation of CSV rows

When semantic search is added, serialize an eligible row or bounded entity bundle with table name, field names, units, identifiers and source locator, for example `table=requisition_status; unit=<unit>; doc_number=<string>; status=<visible code>; estimated_delivery=<date>`. Derive descriptions from actual schema/records, not model-generated facts. Row text is a search aid; the authoritative answer is hydrated from the typed query service using the returned record ID.

Chunk long narrative cells separately but retain the parent row/entity link. Never split a quantity from its item/unit or attach a date to the wrong requisition. Mixed-time fields must be filtered **before serialization and embedding**. Apply the same visibility rules to browser embedding batches.

#### Proposed bounded query interface

Start with explicit operations such as `get_record`, `list_open_work`, `get_requisition_status`, `list_expiring_qualifications`, `get_capability_dependencies` and `summarize_unit_status`. These are proposed service operations, not existing endpoints. Define exact supported tables and semantics in M0; unsupported queries must ask for clarification or abstain. The backend builds parameterized operations. No arbitrary model-generated SQL, Python, dataframe expressions or client-selected paths.

Return a typed `StructuredQueryResult` containing query ID/version, captured identity, scope, filters, typed values/units, completeness, warnings and evidence IDs. Aggregation scans the complete eligible set before pagination; row limits govern display, not silently truncate calculations. Bind selected entity references server-side and reject cross-unit mismatches. Model text references result IDs; the UI inserts authoritative values from those results.

Examples are acceptance question templates, not assertions about fixture contents:

- Ship: “Which open requisitions support this mission, and what are their currently reported delivery dates?”
- Ship: “How many displayed systems are at risk, and which records or modeled gates explain each one?”
- Shore: “Which capability is limiting ship support, and which work order, supply or staffing records support that finding?”
- Shore: “What changes for dependent ship missions if this capability recovers?” — use the engine/isolated preview, not a CSV sum.

## 5. First-slice decision experience

### UI

### Ship and Shore Overview entry points

Add a shared `OverviewAssistantPanel` to `ShipOverview.tsx`, which already renders both unit domains. Keep the existing system/capability summary and 3D layout; place a concise **Command brief / Ask about this unit** panel beside or below the summary, with a collapsible source drawer. Also reuse the panel's typed results in the existing captain brief screen.

- **Ship context:** selected ship, visible system/department, linked equipment/work/parts/staff records, affected missions and shore prerequisites. Prompts: “What needs attention?”, “Show the records behind this status”, “Which shore dependency affects us?”
- **Shore context:** selected installation, capability area or facility, work orders, supply/staff/training evidence, support windows and dependent ship missions. Prompts: “Which support capability is limiting?”, “Which ships are affected?”, “What loaded records explain this warning?”
- Do not infer real facility condition from illustrative 3D geometry or regional public hazard data. Preserve mock-installation labels and distinguish hazard assumptions from observed asset failures.
- Match the existing overview's actual metric basis. Its ready-system share is a count-based display metric, not mission success probability. Where systems use worst scheduled interval gates versus nearest material-capability samples, expose that basis per system; do not invent a single overall readiness probability.
- Centralize the status projection currently assembled in the captain API adapter into a shared tested backend projection for overview and assistant use, preserving behavior. Include Unknown counts and distinguish no systems from all systems ready.
- On first load, show deterministic unit facts and evidence without waiting for a model or expensive fix ranking. Fetch options for an explicitly selected mission on demand; an overview-wide brief must not silently pick a mission for a recommendation.
- Clicking a system/capability scopes the assistant and highlights its source records; clicking a mission opens the mission decision view. A user can ask a unit-level question without selecting a mission.
- Unit/domain/system/filter changes invalidate the context as appropriate. If a question follows a displayed status filter, show that filter explicitly; never confuse the filtered list count with the whole-unit total. Include linked external-unit evidence only through validated dependencies and label it.

### Mission decision drill-down

Reuse the same components in the existing captain brief screen instead of creating a disconnected chat application:

1. **Bottom line:** one or two sentences; mission, interval assessment, primary blocker.
2. **Why:** up to three dependency explanations with expandable evidence.
3. **Available options:** up to three existing candidates plus “no change”; show interval before/after, percentage-point delta, donor mission consequences, assumptions and execution limits.
4. **Decision needed:** review a modeled option, request verification, or state that no supported option meets the requested constraint.
5. **Uncertainty:** missing data, stale/conflicting reports, unsupported factors and model limitations.
6. **Ask about this decision:** suggested prompts and a short session-local thread scoped to this packet.

Numbers, dates, labels and citations render from structured fields. Keep estimated interval readiness distinct from start-time probability and material scores. Do not label an option “no donor cost” if the correct statement is “no donor effect modeled.” Preserve the immediate-approval caveat on current rankings; do not invent an approval deadline.

A mission selection change starts a new context. A scenario update, undo/reset, source refresh or restart marks the current thread stale and disables comparisons until regenerated. Preserve old answers only as clearly labeled historical content, not current recommendations. Sanitize any rendered rich text; prefer plain text in the first slice. Keyboard-accessible citations open a revision-checked evidence drawer.

### Recommendation policy

Initially say **“highest modeled benefit among the available candidates under the displayed ranking”**, not “best operational action.” Expose candidate count, scope and ranking basis. Do not silently reinterpret ship-level rank as selected-mission rank.

Support a small explicit objective schema later: maximize selected mission's interval readiness, optionally constrain modeled donor degradation. Only apply constraints to fields the engine actually provides; otherwise ask for clarification. No assumed mission priority weights. Never relax a captain's stated donor constraint silently. When no option qualifies, explain that and identify needed evidence or a broader authorized analysis.

### Bounded follow-ups

| Question | Authorized path |
| --- | --- |
| Why is this mission at risk? | Current dependency and forecast claims + source retrieval |
| Show the supporting report | Resolve eligible citation from this packet |
| Compare the first two options | Existing candidate outputs; clarify ambiguous references |
| Does this hurt the donor? | Modeled donor mission/capability fields, with modeling limits |
| What information is missing? | Coverage, conflicts, freshness, extraction certainty |
| Apply that fix | Explain read-only boundary; link to the existing review workflow, do not apply |
| What if delivery slips two days? | Initially identify preview capability; enable isolated simulation only in the later preview milestone |

## 6. Proposed contracts and file layout

Names below are proposed, not existing APIs. Keep existing endpoints compatible.

### Endpoints

- `POST /api/decision-brief`: explicit `scope` (`unit_overview` or `mission`), selected `ship_id` (legacy name covering ships and installations), validated `unit_kind`, optional system/capability focus and display filters, expected `base_version` and `source_revision`. Require `event_id` for mission scope; allow null for unit overview. Return typed overview/mission facts, metric basis, evidence and deterministic/validated explanation. Never infer a mission silently.
- `POST /api/decision-brief/ask`: short question, server-issued packet/session ID, expected identity; context is loaded server-side, not accepted as authoritative browser claims.
- `GET /api/decision-brief/evidence/{evidence_id}`: resolves only an eligible server-issued reference for a packet; returns `409`/`410` when no longer resolvable, never substitutes current text for an old citation.
- `GET /api/assistant/status`: mode, model identifier, capability checks, lexical/semantic coverage and fallback state; no keys or sensitive endpoint credentials.
- Later: bounded index status/batch/result APIs and an isolated assistant-preview endpoint. All POSTs require explicit schemas, size limits and origin protection.

Illustrative response shape (field names may be refined before implementation):

```json
{
  "packet_id": "server-issued-id",
  "identity": {
    "source_revision": "active-revision",
    "scenario_version": 4,
    "scenario_digest": "content-digest",
    "exercise_cursor": "2026-11-05T12:00:00Z",
    "ship_id": "KESSLER",
    "event_id": "validated-event-id"
  },
  "assessment_basis": "sampled_event_interval",
  "claims": [],
  "options": [],
  "evidence": [],
  "warnings": [],
  "explanation": {
    "method": "template",
    "bottom_line_claim_ids": [],
    "sections": [],
    "fallback_reason": null
  }
}
```

Extend packet identity with `scope`, `unit_kind`, optional focused entity and explicit filters; `event_id` is nullable only for unit-overview scope. Include these fields in packet, query and model-cache keys. The example above illustrates mission scope; an overview response sets `scope=unit_overview` and `event_id=null`.

Define Pydantic models for `DecisionIdentity`, `DecisionClaim`, `EvidenceRef`, `StructuredQueryResult`, `OverviewAssessment`, `DecisionOption`, `DecisionPacket`, `DecisionExplanation`, `AskDecisionBody` and typed errors. Claims carry a kind (`reported`, `modeled`, `assumption`, `suggestion`), source/engine references, nullable values and explicit units. Engine claims reference calculation identity and input provenance; not every numerical result is directly stated in a source document.

The LLM output schema may reference only enumerated claim/option/evidence IDs. For the initial brief, constrain it to ordering and connecting verified claims using short explanation slots. Render critical facts from templates. Free-form causal text still requires evaluation: schema validity and numeric preservation alone do not prove support. Reject unsupported causal additions, dangling references, altered qualifiers or advice outside modeled options; fall back to the deterministic brief.

### Proposed implementation files

| File | Responsibility |
| --- | --- |
| `missiontwin/decision_models.py` | Strict request/response/claim contracts |
| `missiontwin/decision.py` | State capture, overview/mission packets, objective policy, template brief |
| `missiontwin/loaded_queries.py` | Proposed read-only typed record lookups, complete-set aggregates, provenance and explicit join policies |
| `missiontwin/overview.py` | Proposed shared status/count/basis projection used by both overviews and assistant |
| `missiontwin/retrieval.py` | Eligible evidence corpus, exact/lexical search, fusion and provenance |
| `missiontwin/assistant.py` | Bounded intent routing, model explanation, validation and budgets |
| `missiontwin/semantic_index.py` | Later optional LanceDB lifecycle and browser batch validation |
| `missiontwin/api.py` | Thin routes and state integration |
| `missiontwin/llm.py` | New task timeout/cache plumbing and reusable transport |
| `web/src/captain/components/brief/` | Shared overview assistant panel, mission decision cards, options, citations, source tables and follow-ups |
| `web/src/captain/screens/ShipOverview.tsx` | Embed the shared assistant in both Ship and Shore Overview domains |
| `web/src/captain/api/{api,types}.ts` | Typed API integration |
| `web/src/captain/workers/embed.worker.ts` | Later self-hosted browser embedding worker |
| `scripts/evaluate_decision_assistant.py` | Offline/mock evaluation and opt-in live endpoint evaluation |
| `tests/test_decision_*.py`, `tests/test_retrieval.py` | Backend acceptance and regression tests |
| `web/tests/decision-brief.spec.ts` | Isolated browser acceptance |

Use shared services rather than making internal HTTP calls back into LOCKER. No changes to engine probability semantics are needed for this feature.

## 7. Existing LLM endpoint integration

### Local `.env` secret storage (required)

Store the actual API key only in the repository-root local `.env`, loaded by the Python backend. Copy `.env.example` only if `.env` does not already exist; never overwrite an existing user's configuration. Commit only placeholder names in `.env.example`, not a working credential. Never ask a user to paste a key into chat.

Current `.gitignore` already excludes `.env` and `.env.*` while allowing `.env.example`. Verify with `git check-ignore .env` and confirm `git ls-files -- .env` returns no tracked file before committing; ignore rules do not remove a previously tracked secret. If a key is ever committed, remove tracking and rotate it immediately—deleting the latest file does not remove Git history.

The key must never appear in `VITE_*` variables, browser bundles/storage, API status responses, source/evidence cards, prompts, caches, logs or exported briefs. Browser requests go to LOCKER; only the Python backend sends the key to the configured provider. Restrict local file permissions where feasible and exclude `.env` from backups/sharing packages. This checkout is in OneDrive: Git ignore does not prevent cloud sync; use a non-synced checkout for a strict local-only secret policy or explicitly approve the sync exposure. Backend process environment takes precedence over `.env`; changing the file requires a restart with current loading behavior.

### Reuse existing configuration

`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, and `MISSIONTWIN_DEMO_MODE` already exist. Confirm whether the running service is OpenAI itself or an OpenAI-compatible server. Record the exact model ID, context window, endpoint API shape, authentication and approved data policy. Never commit secrets or put a key in browser storage.

Current transport expects `/chat/completions`, JSON-object response format, `temperature: 0` and `max_tokens`. Some models/providers require different parameters; probe actual support rather than assuming every “OpenAI” service is interchangeable. If the endpoint is Responses-only or rejects these settings, implement an explicit tested transport adapter. Do not silently weaken response validation to make a connection test pass.

Capability checks should cover authentication, bounded completion, JSON output, timeout behavior, context limits and optional tool calling only when enabled. The first slice needs JSON output, **not native tool calling**.

### Live startup after the feature exists

The existing launcher `python -m missiontwin.demo` stays guaranteed offline. For a live endpoint use the documented direct API path, with these variables in the process environment or ignored `.env`:

```text
LLM_BASE_URL=<approved-existing-service-base-usually-ending-in-/v1>
LLM_MODEL=<exact-model-id>
LLM_API_KEY=<server-side-secret-if-required>
MISSIONTWIN_DEMO_MODE=0
```

Build with `npm --prefix web run build`, then start from PowerShell:

```powershell
.\.venv\Scripts\python.exe -m uvicorn missiontwin.api:app --host 127.0.0.1 --port 8011
```

Check that no inherited process environment overrides `.env` with offline mode. Do not stop the existing demo on 8000 merely to test the live assistant; use a separate port and isolated data/log configuration. Live mode can also enable existing LLM extraction, so validate its effects before treating it as a presentation-only change. Add independent proposed assistant enablement settings so the new feature can be disabled without removing legacy behavior; document their interaction with global offline mode.

Budget requests by prompt size, output tokens, elapsed time, question length, concurrency and number of retrieval/simulation calls. Add assistant-specific timeouts and task cache keys rather than borrowing extraction semantics. Start without streaming: validate the complete answer before display. If streaming is introduced later, do not stream unvalidated factual claims as accepted results.

Cache hits must satisfy current identity, policy and redaction rules. Return explicit `template`, `cache`, or `llm` method labels and a safe fallback reason. Keep provider errors and secrets out of user-visible output.

## 8. Security and privacy work required

- Loopback binding is not authentication. Add/test host allowlisting, same-origin/Origin checks for state/index POSTs, and a local session/CSRF mechanism before exposing new browser upload endpoints. Do not enable wildcard CORS.
- Separate model destination approval from source access. Default to approved local data and endpoint; cloud transmission requires explicit policy approval, not merely a syntactically valid URL.
- Apply redaction to questions, snippets, structured packets, prompts, cache and logs. Existing known-roster-name removal is useful but is not comprehensive PII detection. Avoid sending identifiers or raw source text not needed for the answer.
- Retrieved text is untrusted data. Delimit it, ignore embedded instructions, allowlist capabilities and validate outputs. Test malicious documents and questions. Do not rely on prompting alone.
- Resolve evidence IDs server-side, enforce snapshot-root containment and reject traversal/symlink escape. Never let model text or browser-supplied file names select arbitrary files.
- Limit source types, bytes/pages/rows, parser runtime and total context. Treat unsupported or unreadable documents as gaps, not silently empty authoritative evidence.
- No model access to API keys, environment, source writes, arbitrary URLs, shell, code execution or scenario mutation.
- Audit minimal metadata: request ID, identity, tool names, evidence IDs, model/prompt version, latency, fallback and validation failures. Avoid raw prompts by default; the existing client's in-memory sent-prompt trail needs review before broader data use.
- Configure retention and deletion for local chats and caches before durable history. Air-gapped mode must forbid external asset downloads and external model destinations; merely setting a download flag does not make a cloud model local.

## 9. Delivery milestones and implementation backlog

Each milestone ends with runnable acceptance evidence. Implement on a feature branch from current main; leave the existing demo usable. Effort sizing follows the endpoint/Keystone-source spike rather than an assumed calendar promise.

### M0 — Contract, endpoint and Keystone source spike

- [ ] Obtain Keystone source revision and relevant tests, if available: `vector_index.py`, `documents.py`, `assistant.py`, `static/embed-worker.js`, `offline_bundle.py`, dependency metadata and notices. No source access is required to implement the first slice independently.
- [ ] Verify live endpoint API shape/model capabilities using synthetic inputs; record safe configuration, latency and token limits without credentials.
- [ ] Trace ship/shore overview metric mapping, selected-unit/mission IDs, rankings, knowledge-time filters and citation resolution against current main.
- [ ] Define table/field contracts, stable record/join keys, units, completeness and provenance rules for the first ship and installation queries.
- [ ] Verify `.env` exclusion and backend-only credential flow without reading or logging the actual key.
- [ ] Freeze packet/claim schema, objective wording and first acceptance mission.
- [ ] Establish baseline brief/ranking latency and test runtime.

**Exit:** Reviewed schema, endpoint compatibility report, source-port inventory with license/tests, no engine behavior change.

### M1 — Deterministic decision-brief vertical slice (first coding milestone)

- [ ] Add typed packet models and immutable capture service with revision/version/epoch checks.
- [ ] Add shared loaded-record queries and overview projection; keep overview and assistant counts/status/metric bases identical.
- [ ] Build unit-overview claim ledgers for KESSLER and NSNORFOLK, with direct loaded-source cards and optional system/capability focus.
- [ ] Build mission-specific dependency explanations, warnings, on-demand options and no-change baseline.
- [ ] Preserve current candidate ranking basis; show mission-specific effects without relabeling the ranking.
- [ ] Add complete-set structured CSV queries plus eligible linked evidence and exact/lexical retrieval; enforce knowledge-time and reference-corpus exclusion.
- [ ] Return row/field provenance and reproducible aggregate lineage; separate original records, normalized values and scenario overlays.
- [ ] Add `POST /api/decision-brief` and revision-checked evidence resolution.
- [ ] Add the shared assistant panel to both Ship and Shore Overview and reuse its cards in the captain brief UI; include bottom line, source tables, uncertainty and mission drill-down for options/donor effects.
- [ ] Add stale-state/error handling; keep existing `/api/brief` and legacy UI working.
- [ ] Add backend and isolated browser acceptance tests.

**Exit:** Ship and Shore Overview each explain the selected unit's status using directly linked loaded records; counts and classifications match the displayed overview. A captain can drill into a supported mission, identify its blocker, compare modeled options and inspect evidence without navigating the raw corpus. Refreshing a source updates overview, assistant queries and citations together after activation. Recorded values match typed loaded data; modeled values match the engine. Everything works with no model configured.

### M2 — Existing live LLM explanation and bounded follow-ups

- [ ] Add assistant task configuration and endpoint capability/status checks.
- [ ] Explain the M1 claim packet with strict structured output and deterministic fallback.
- [ ] Add bounded follow-up intents and packet-scoped session history; clarify ambiguous option references.
- [ ] Add redaction, token/time/concurrency budgets and metadata-only audit events.
- [ ] Reject unsupported claim IDs/wording, changed qualifiers and invented metrics/options.
- [ ] Test timeout, invalid JSON, endpoint rejection, stale responses and injection; run opt-in live evaluation on approved synthetic cases.

**Exit:** One real endpoint completes the first mission workflow with grounded follow-ups; every tested numerical field remains engine-sourced. Bad/unavailable model output yields a usable deterministic answer. Mock tests alone do not satisfy live-model acceptance.

### M3 — Keystone-style optional browser semantic retrieval

- [ ] Add content/provenance chunking and optional vector storage with model/version partitioning.
- [ ] Port or independently implement a Vite worker, local assets, CPU fallback, model unload and status UI.
- [ ] Implement authorized batch leases, upload validation, incremental rebuilds, multi-tab coordination and atomic publish.
- [ ] Keep cache outside OneDrive; test Windows file locks and safe interrupted rebuilds.
- [ ] Implement exact/lexical/semantic fusion and rerun retrieval evaluation.
- [ ] Verify offline model/runtime bundle and network-disabled execution.

**Exit:** Semantic search improves paraphrase retrieval against the lexical baseline without breaking exact-ID results or temporal isolation. Unsupported browsers, partial indexes and closed tabs retain lexical functionality. LanceDB remains optional.

### M4 — Isolated what-if and explicit objectives

- [ ] Allow a small schema of preview intents backed by existing fork/preview services.
- [ ] Show before/after interval effects and modeled donor impacts from the engine, with unchanged shared state/log.
- [ ] Add explicit supported objectives/constraints; explain no qualifying candidate rather than inventing one.
- [ ] Link to the existing versioned decision review UI; no assistant approval tool.
- [ ] Address delayed-approval comparison explicitly before offering timing-sensitive recommendations.

**Exit:** A delivery-delay follow-up produces a reproducible isolated preview; no source/scenario state is changed. Unsupported assumptions are disclosed, not guessed.

### M5 — Review snapshots, broader coverage and release hardening

- [ ] Save explicit review snapshots; compare “since review X” with structured differences and revision provenance.
- [ ] Add retained historical evidence or clearly unavailable-evidence behavior for old snapshots; define retention limits.
- [ ] Expand corpus/formats only with tested locators, visibility rules and parser limits.
- [ ] Add optional shareable deterministic decision briefs with review-before-export and synthetic markings.
- [ ] Complete approved model/asset manifests, cross-platform setup, offline bundle, performance tests and security review.
- [ ] Update `README.md`, `docs/DEV2.md`, `docs/SOURCES.md` and `docs/UI_INTEGRATION.md` with shipped behavior, not planned claims.

**Exit:** Reproducible demo and evidence of deployment-specific tests. Operational data or network deployment requires a separate authorization, authentication/access-control and assurance effort.

## 10. Evaluation and release gates

Create an independent fixture set from checked-in synthetic sources and engine outputs. Expected answers should encode supported claims/evidence and allowable conclusions, not require one exact LLM phrasing. Include paraphrased questions and adversarial cases. Store model, prompt, source revision and evaluator version with reports.

| Area | Required cases / gate |
| --- | --- |
| Numerical fidelity | Every recorded value equals its typed loaded source field; every modeled probability, percentage-point delta, date and donor effect equals the captured engine value at documented precision; unsupported values rejected |
| CSV completeness and joins | Aggregates use the complete eligible set, not top-k matches; tests cover null vs zero, leading-zero identifiers, duplicate/fan-out joins, missing keys, units, timestamp boundaries and mixed-time status histories |
| Ship/Shore overview parity | Unit counts/status/metric bases match overview projection, including Unknown, zero systems, filtered lists and cross-domain switching; count-based ready share is never called mission probability |
| Direct source lineage | Record cards show exact permitted row/field/span, provenance and revision; normalized and overlay values are labeled; aggregates expose contributing records and calculation/filter lineage |
| Refresh consistency | Accepted replacement updates both overviews and assistant facts; rejected replacement preserves prior authority; semantic lag cannot serve previous-revision facts |
| Secret storage | `.env` is ignored/untracked, `.env.example` contains placeholders only, and keys are absent from browser assets/storage, prompts, responses, logs, caches and export fixtures |
| Assessment meaning | Interval vs start-time estimates and material scores never conflated; unknown remains unknown |
| Claim support | Citation IDs resolve, quoted spans match, qualifications survive; test negation, causality, units, conflicting evidence and correct numbers attached to the wrong mission |
| Exact retrieval | All curated exact equipment/requisition/mission-ID questions retrieve the gold record within top five |
| Paraphrase retrieval | Initial target: gold evidence recall@5 >= 90% on the versioned curated set; semantic mode must improve or match lexical baseline and report results separately |
| Temporal isolation | Zero future-event/hidden-history/expected-fixture leaks in the test corpus, including mixed-time pages and rows |
| Revision isolation | Refresh, undo, reset, concurrent questions, multi-tab jobs and restart cannot mix identities or silently resolve an old citation to new content |
| Trade-offs | All displayed donor claims match available model fields; no unsupported “safe/no impact” wording; no qualifying option is handled explicitly |
| Read-only behavior | Question/brief/preview operations leave scenario version, overlays, source bytes and decision log unchanged, apart from explicitly separate assistant audit metadata |
| Failure paths | Invalid output, malicious instructions, overlong context, timeout, missing model/index/worker and failed refresh all remain safe and visibly degraded |
| Privacy/security | No browser keys, path escape, unauthorized corpus access or raw sensitive prompt logging; origin/host/CSRF and size-limit tests pass |
| Browser UX | Mission switch, citations, option comparison, stale-state banner, keyboard use, narrow layout and offline fallback pass isolated Playwright tests |

Performance targets are provisional until M0 measurements: warm deterministic brief p95 <= 3 seconds excluding uncached fix ranking; retrieval p95 <= 500 ms on the canonical corpus; configured live explanation p95 <= 20 seconds on the selected endpoint. Measure cold ranking/build/model-start separately and show progress instead of hiding expensive work. A slow endpoint must hit a bounded fallback, not hold the shared application lock. Record hardware, corpus size, runs and sample counts; these are not promises for arbitrary datasets.

Run existing backend tests, frontend typecheck/build and isolated browser checks for every milestone. Tests own temporary datasets, logs, caches, free ports and mocked model endpoints; they must not reset the demo already on 8000. Optional-dependency tests may skip when absent, but at least one dedicated CI job must install and exercise the semantic path before M3 is declared complete.

Live-model release report should list supported/unsupported claims, citations, abstentions, numerical mismatches, unsafe suggestions, retrieval failures, latency and fallback rate. Require zero critical numerical, temporal-leak or unauthorized-action failures in the release fixture suite and a human review of explanations. Passing a finite synthetic suite does not prove operational reliability.

## 11. Immediate implementation order

1. Confirm endpoint address, exact model ID and approved synthetic-data use; acquire Keystone source if available.
2. Implement M1 packet contracts, loaded-data query/overview projection services and deterministic backend tests first.
3. Build shared Ship/Shore Overview assistant cards, direct source drill-down and mission brief navigation against the typed packet.
4. Add M2 model explanation and bounded follow-ups through the existing client.
5. Evaluate the actual model before widening the assistant's scope.
6. Add M3 browser embeddings only after the lexical/grounding baseline is measurable.
7. Enable isolated what-if, then review-history comparisons as separate increments.

**Recommended first pull request:** `DecisionPacket`/`StructuredQueryResult` schemas + immutable unit/mission capture + shared loaded-data/overview projection + deterministic brief endpoint + ship/shore source-lineage and CSV numerical tests. Follow with the shared overview panel before adding live LLM wording. No new dependencies, no model requirement, no scenario writes. This creates the trustworthy boundary on which both the LLM and Keystone-derived semantic search can safely build.
