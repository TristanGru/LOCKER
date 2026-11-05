# Ask Davy: question-specific deterministic retrieval and answer templates

**Status:** implemented after explicit user authorization, with the bounded delivery/remaining work below. Commit and publication to main were subsequently authorized; see Git history for publication status. No application deployment was performed.
**Inspected baseline:** `7bbae00` (`docs: add screenshot walkthrough and Ask Davy architecture`), the current local main at review time.
**Scope:** assess the updated README/screenshots and improve deterministic answers across Ship, Shore, Mission and Dominoes without changing engine mathematics, dashboard layouts or operational permissions.

## Delivery record

Implemented the first useful deterministic release and guarded expanded-family responses:
- `assistant_intents.py`: validated deterministic question plans, dataset-derived aliases, exact identifiers, explicit status/population handling, cross-scope/negative-filter clarification and bounded structured follow-up resolution.
- `assistant_queries.py`: redacted allowlisted full query populations captured from the accepted `View`, existing forecast and source health. Open-job counts use the documented state set, preserve unclassified-state counts, and are independent of retrieval/presentation limits. Maintenance/requisition associations use recorded JCN equality.
- `assistant_retrieval.py`: stable exact/lexical ranking with validated optional semantic hints. Full eligible mission evidence remains server-side; the owner-scoped candidates endpoint ranks before the 300-record worker bound and gives each candidate population a distinct cache key. Mission worker records now contain searchable `text`.
- `assistant_templates.py`: versioned template registry, question-specific cited answers, filtered count calculation provenance, source quotation/uncertainty handling, no-match/clarification variants, scope/coverage metadata and follow-up suggestions. The generic first-five-facts chat fallback is removed from all provider/context-budget failure paths.
- `overview_chat.py`: explicit `deterministic_only` policy bypasses both provider and model cache. Completed-request fingerprints include policy/semantic IDs/context; permissions and freshness are rechecked before completed replay. Shared conversation/graph behavior and default cache/live/fallback order remain intact.
- Frontend: deterministic-only control, query-specific candidate retrieval, common source/calculation viewer, dynamic supported suggestions alongside existing summary controls. No dashboard layout or engine mathematics changed.

Verification: **321 backend tests passed**, **21 isolated browser tests passed**, frontend typecheck and production build passed. Logs: `logs/deterministic-backend-all.log`, `logs/deterministic-browser-all.log`. The routing suite contains 110 canonical/paraphrase cases; query/template tests include more than 300 records, exact/no-match IDs, distinct intents, complete-population counts, owner isolation, policy idempotency and a model client that fails if accessed in deterministic-only mode. Browser coverage runs actual Mission/Dominoes embedding candidates, repair/count answers and calculation drill-downs. These checks do not establish universal intent coverage or human semantic certification.

Bounded remaining work (not silently claimed as implemented):
- Training/certification templates report eligible recorded dates/statuses and explicitly mark full event-window/scheduled-refresh applicability as unavailable. Adding those rules requires a separately tested model adapter.
- Cross-mission/fleet comparisons, undefined late/negative filters and arbitrary historical snapshot differences ask for clarification or report unavailable data. At-start versus interval explanations use existing estimates, not new simulations.
- Dependency answers expose existing mission requirements/support-event IDs and available overview relationships, not arbitrary transitive graph traversal or complete formula lineage.
- Unknown multi-intent requests are not an unrestricted natural-language query engine. Full history storage, generalized joins and new report-derived risk hypotheses remain outside the deterministic guarantee.
- Existing README live screenshots are unchanged; no new provider call or shared-exercise manipulation was performed for screenshots. The running server has not been restarted as part of implementation. The user's `.env` and source records were not edited.

The original review/design below is retained as the baseline and phased roadmap, not as a description of every current behavior.

## 1. Executive assessment

The README's architecture is largely present: shared floating chat, bounded source retrieval, optional local embeddings, structured LLM explanations, backend-inserted values, inline citations, model cache, labeled fallback, conversation restoration and state/access guards. The pictured Live LLM response and citation viewer have corresponding code paths. A screenshot establishes an observed example, not general factual accuracy or broad question coverage.

The largest missing capability is **question-specific deterministic answering**. The fallback is a small safety summary, not a deterministic question-answer engine. Adding more retrieval alone will not fix it: the fallback must consume an explicit question plan, select the appropriate authoritative data, and render an intent-specific template.

Recommended design:

**Question → deterministic intent/entity/scope resolution → allowlisted structured query and/or eligible evidence retrieval → typed answer facts → versioned template → existing citation renderer.**

Use retrieval for relevant records and quotations; use the backend engine and complete-set queries for numerical facts. No LLM is needed to route or render the supported deterministic intents.

## 2. What is implemented today?

Assessment labels: **Implemented** means a corresponding code path exists; **Partial** means meaningful limits remain; **Not implemented** means the requested capability has no current general path. These are not percentage-completion or accuracy scores.

| Capability described in README | Assessment | Code evidence and limit |
| --- | --- | --- |
| One collapsed Ask Davy interface on four views | Implemented | Shared `AssistantPanel.tsx` and `OverviewChat.tsx`; Mission/graph context adapters preserve specialized controls. |
| Eligible, account-scoped, revisioned context | Implemented, bounded | `overview_chat.py` capture/session routes, auth checks, `OverviewRequest`/`ConversationRequest`, and time-filtered `View`; richer mission identity is retained. |
| Exact/lexical retrieval | Implemented | `overview.answer()` ranks overview records; `davey_evidence.retrieve()` ranks eligible mission passages. Relevance is not proof of causality. |
| Local MiniLM semantic retrieval | Partial | Bundled worker/default-on controls exist. Mission evidence lacks the worker's required `text` property; see prerequisite below. Both candidate budgets and absent assets can limit retrieval. |
| LLM-written sections and supported exact values | Implemented, bounded | `generate()`, `GeneratedAnswer`, `render_answer()` and support packets. Numerical/ID/schema guards are not semantic-entailment certification. |
| Inline record, assessment and calculation citations | Implemented, partial lineage | Shared source viewer; overview row-count calculation supports; mission model supports explicitly have partial lineage. Complete causal/formula provenance is not present. |
| Validated model cache and labeled actual method | Implemented | `LLMClient.run()` checks/validates cache before fresh generation; UI distinguishes Live LLM, Cached LLM and Deterministic fallback. |
| Provider/schema failure to fallback | Implemented | Bounded correction and fallback reasons in `generate()`. Reason classification remains broad. |
| Deterministic unit/system overview | Partial | `fallback()` displays first five backend facts, regardless of question. Useful as a safety summary, not a precise answer. |
| Deterministic mission/graph explanation | Partial | Mission packet facts mostly say to inspect a modeled assessment. Domain fallback adds up to three gate warnings, not a question-specific dependency explanation. |
| Deterministic source, ETA, repair, training and filtered-count answers | Not implemented as a template catalog | Some evidence/whole-visible-row supports exist; no general intent/query/template pipeline renders these answers. |
| Deterministic conversational references | Not implemented | Sessions retain messages, but `fallback()` does not consume history or structured referents. |
| Arbitrary joins, all-mission/fleet queries | Not implemented | Mission packet is one selected/resolved mission. Overview counts are specific complete visible-row calculations, not arbitrary filtered totals. |
| Deterministic emerging-risk reasoning or new graph hypotheses | Not implemented; retain boundary | Live domain extensions may propose tentative hypotheses; no safe equivalent inference engine exists in deterministic mode. |

### The exact fallback gap

`missiontwin/overview_chat.py::fallback(packet, supports, reason)`:
- selects `packet['facts'][:5]`;
- renders a single Bottom line section;
- adds citations to those facts;
- receives no question, intent, selected retrieval IDs or conversation history.

`generate()` retrieves question-related evidence before generation, but its fallback calls do not pass that selection into the renderer. Therefore a supply question, a source question and a dependency question can receive essentially the same fallback summary for the same packet.

Other bounded behavior:
- `overview.py::answer()` has simple keyword rules for counts, dependencies and four table topics, but those selected fact IDs are not used to choose the chat fallback's sentences.
- `assistant_context.py::mission_packet()` creates real typed forecast supports, but its fallback fact text is generic: `<label>: inspect the existing modeled assessment and its partial input lineage.`
- `davey.py::_fallback()` chooses at most three gates below the configured green threshold (including unknowns) and uses repeated generic explanations. Its displayed number is the number of selected warning cards, not necessarily the total number of deficient requirements.
- Mission evidence is initially capped at 300 corpus entries before question-specific selection. Corpus construction places requisitions and maintenance before narrative passages; relevant later documents can be omitted from supports even when full-corpus retrieval finds them.
- Ship/Shore overview supports expose allowlisted structured tables. They do not have the same narrative coverage as Mission's CASREP/daily-report corpus. Do not promise identical evidence coverage across views.

### Screenshots and documentation observations

- `docs/screenshots/10-ask-davy-answer.png` shows **Live LLM · partial**, a SEASHIELD answer, dependencies and uncertainty. The fleet page headline is IRON HORIZON, while chat follows KESSLER and resolves its most urgent mission to SEASHIELD. This is legitimate but easy to misunderstand; always display the resolved answer scope.
- `11-ask-davy-citation.png` shows the retained HF transceiver maintenance excerpt, revision, exercise time and flags. The source says one set is awaiting parts while the other carries all circuits; a deterministic answer must not translate this into a total communications outage.
- Neither screenshot demonstrates broad deterministic question coverage. README explicitly describes fallback as shorter and less question-specific; that limitation matches the code.
- `docs/OVERVIEW_ASSISTANT.md` contains older configuration/authentication descriptions and release-test counts. Update it during delivery to agree with current shared policy/account ownership and the new deterministic behavior. Do not treat historical counts as a new verification result.

## 3. Target user experience

When no fresh model answer is available, a supported question should still get a direct, useful answer:
1. Answer the asked question first, with unit/mission/node and relevant time basis explicit.
2. Present the relevant findings, exact recorded values or existing modeled assessment.
3. Put citations beside claims; let users open exact records, engine supports and query provenance.
4. Explain completeness, missing values, freshness, uncertainty and limits.
5. Offer two or three related **supported** follow-ups appropriate to the recognized intent.

Keep the existing response method `template` for API compatibility. Add metadata such as `intent`, `template_id`, `template_version`, `query_id`, `scope`, `coverage`, and structured referents. The UI can describe it as **Deterministic · retrieved records and backend calculations** without implying an offline LLM. Preserve fallback reason separately from answer usefulness.

Do not force every answer into a fixed summary. A lookup, count, dependency explanation and request for sources need different layouts and phrasing. Empty results, missing evidence and ambiguous requests need their own templates too.

## 4. Proposed architecture

### 4.1 Deterministic question planner

Suggested module: `missiontwin/assistant_intents.py`.

Return a validated `QuestionPlan` with:
- canonical intent and requested output (summary/list/count/explanation/source/quotation);
- resolved entities: permitted unit, mission, modeled node/system, job/JCN, requisition/document number, NIIN, training/certification requirement;
- typed filters: status, source kind, explicitly supported time window;
- current scope and any requested scope change;
- bounded structured referents from the last supported answer;
- matched rules and outcome: supported, clarification needed, unavailable data, out of scope.

Rules must use dataset-derived aliases/IDs, not hardcoded KESSLER, SEASHIELD, equipment names or scenario dates. Prefer exact identifiers and explicit named entities over fuzzy similarity. Detect intent from combinations of action/output words and domain terms, with tests for punctuation, pluralization, common paraphrases and negation.

Precedence: prohibited mutation execution → explicit ID/entity/scope → requested output (count/list/source) → domain-specific intent → summary → clarification. Distinguish read-only questions about recorded changes/approval status from instructions to change/approve something. Do not reject 'What changed?' merely because it contains 'change'.

For multiple intents, compose at most two compatible handlers (for example repair status plus linked requisition). Ask for clarification rather than silently discarding independent requests or guessing between two systems/missions.

### 4.2 Shared eligible evidence/retrieval contract

Suggested module: `missiontwin/assistant_retrieval.py`; reuse existing adapters/rankers rather than create a second corpus.

- Normalize `id`, `record_type`, typed `fields`, redacted searchable `text`, source locator, entity keys, `known_at`, effective time, stale/superseded/hedged flags and parser annotations.
- Fix Mission packet → worker compatibility: worker currently executes `r.text.slice(...)`; Mission records currently provide only `fields.excerpt`. Generate consistent allowlisted `text` for both views and test the actual worker against mission candidates.
- Rank eligible evidence before bounded prompt/browser packaging; do not simply take the first 300 records as the definitive searchable population. Preserve current resource/privacy limits; use query-specific bounded server candidates and a compatible packet/candidate identity for worker caches when needed.
- Exact keys and verified joins outrank lexical/semantic similarity. Use stable tie-breaking, deduplication, source diversity and latest-effective-record rules.
- Preserve uncertainties and supersession. Use older reports only when explicitly requested or clearly labeled historical; two different observations are not automatically a contradiction.
- Semantic IDs are optional relevance hints, validated against eligible records. Never use a top-k passage subset as a count population, a fabricated join, or a new source of truth.
- Do not add unrestricted document directories, network search or raw personnel names to browser evidence.

Call this **retrieval-assisted deterministic answering** when no generative model is used. The same retrieval/typed-query results may also improve the LLM path.

### 4.3 Allowlisted structured query and model adapters

Suggested module: `missiontwin/assistant_queries.py`.

Each operation has typed arguments, permission checks, exercise-time semantics, a bounded join plan, and a defined population. Execute against the same accepted `Baseline`/`View` and existing forecast used by the UI—not a second SQL database, regenerated fixture or raw future status history.

Initial operations:
- list/filter current modeled systems and their status bases;
- fetch selected mission/gates and leading modeled constraint;
- find exact record and its verified linked records;
- list/count current maintenance jobs by documented job-state mapping;
- list/count current requisitions and report recorded status/ESD;
- fetch existing modeled dependency paths and directly linked source inputs;
- inspect eligible source freshness, missing required coverage and assumptions.

Later allowlisted operations: training/certification expirations within an explicit event window, mission comparisons over an authorized complete set, and source/history differences only when both comparable states are actually retained.

A query result must include `value`/rows, population definition, filters, units, complete/incomplete status, contributing row keys, source revision, exercise cursor, scenario identity, missing/excluded counts and explanatory basis. Count the complete eligible population first, then paginate presentation. Preserve unknown/null distinctly from zero.

Requisition ESD is a reported estimate, not an arrival guarantee or repaired-system date. Use configured status-code references for interpretation. Numerical summaries never come from embeddings or model arithmetic.

### 4.4 Typed answer facts and template registry

Suggested module: `missiontwin/assistant_templates.py`.

Register templates with: stable ID/version, supported intents/views, required slots/support kinds, query handler, ordering rules, positive/empty/missing/ambiguous variants and permitted follow-ups.

Compose server-authored text/value segments and support references through the existing rendering/citation contract where possible. Add typed supports for a normalized next-domino/leading requirement and graph path: the current mission scalar filter drops dictionary-valued fields such as structured next-domino data, and graph targets currently appear as serialized text under limitations. Templates should not parse English labels or serialized graph strings to reconstruct numerical/causal facts.

Avoid generic raw dictionary dumps. Render friendly labels and include only the fields needed for the question, with full permitted detail available in citations. Keep model assessment, reported evidence, assumption and query result distinct.

## 5. Initial template catalog

Each row is a template family with success, no-match, missing-evidence and ambiguity variants—not one large universal prompt.

| Template family | Example questions/paraphrases | Authoritative inputs and response |
| --- | --- | --- |
| `unit_summary` | 'Summarize this ship'; 'Give me the shore picture' | Status projection, scoped counts, leading attention items, freshness; separate system-share from mission odds. |
| `mission_summary` | 'How is SEASHIELD looking?'; 'Summarize this mission' | Engine interval/start estimates, event dates, gates, resolved mission and leading constraint; qualified model basis. |
| `status_explanation` | 'Why is this system on Watch?'; 'What puts this mission at risk?' | Existing engine assessment/explanations and directly linked inputs; say when complete causal lineage is unavailable. |
| `status_list` | 'Which systems are at risk?'; 'Show unknown capabilities' | Complete scoped modeled list with status/basis; meaningful zero-result wording. |
| `filtered_count` | 'How many open jobs?'; 'How many requisitions are awaiting parts?' | Dedicated complete-set query and defined status mapping; cite count calculation and distinguish displayed rows from total. Clarify unsupported status semantics. |
| `record_lookup` | 'Show JCN …'; 'What is requisition …?' | Exact typed ID match, current permitted row fields, source and timestamp; no nearby-ID substitution. |
| `maintenance_status` | 'Which repairs are awaiting parts?'; 'What is wrong with the HF set?' | Current jobs plus verified JCN/requisition/system links; reported defect versus modeled effect stays separate. |
| `supply_status_eta` | 'Where is the part?'; 'What ESD is reported?'; 'When is it due?' | Current requisition status/ESD and visible effective time; explicitly avoid location or delivery claims unsupported by the record. |
| `dependency_trace` | 'What depends on this pier?'; 'Explain this dependency' | Existing directed graph path, selected node/event and linked supports. No path is 'none in the modeled graph', not proof of no real dependency. |
| `supporting_sources` | 'Which records support that?'; 'Show the evidence for communications' | Re-resolved support IDs/source locators for an identified claim; open current permitted records or explicitly historical captured citations. |
| `source_excerpt` | 'What does the CASREP say?'; 'Show the latest report about the pump' | Exact eligible quotations with record type/date, hedging, parser annotations and supersession; no new inferred emerging-risk claim. |
| `freshness_coverage` | 'What is stale?'; 'What data is missing?'; 'How reliable is this picture?' | Source-health checks against exercise time, required coverage, assumptions and lineage limits; no fabricated confidence score. |
| `training_certification_window` | 'What expires during this mission?'; 'Which certifications need attention?' | Eligible training/certification rows and event-window rules, with applicable scheduled refresh handling; no claim of full personnel qualification analysis. |
| `assessment_comparison` | 'Why do start and interval differ?'; 'Compare these two missions' | Same-state engine estimates and defined metric bases. Cross-mission comparison requires an authorized explicit multi-mission query, not one mission's packet. |
| `known_history` | 'What changed?'; 'Has this repair status changed?' | Only available comparable retained records/snapshots, with explicit before/after identity and provenance. Otherwise explain unavailability or request comparison scope. |
| `clarification_or_boundary` | 'Why?'; 'What about that one?'; 'Apply the fix' | Resolve one unambiguous structured referent, present bounded choices, or refuse execution and link to existing workflow. Never return unrelated first-five facts as if they answer. |

**First release priority:** unit/mission summary, status explanation/list, supporting sources, exact lookup, repair/supply status, freshness, dependency trace, and one clearly defined count family. Add later families only after their query semantics and provenance pass tests.

### Illustrative template shapes (placeholders, not current dataset assertions)

**Repair question:**
> For {equipment}, job {jcn} reports {job_state}. {bounded recorded remark}. [record] The linked requisition {doc_number} reports {status} with ESD {esd_or_unknown}. [requisition] This is a reported estimate; it does not establish repair completion. The existing model associates the job with {requirement}, with partial lineage. [assessment]

**Count question:**
> {count} jobs match {defined_open_state_set} for {unit} as of {exercise_time}. [calculation] Showing {displayed_count} of {count}; {missing_or_excluded_count} records could not be classified under this definition. These are maintenance jobs, not a count of mission blockers.

**Dependency question:**
> In the existing modeled graph, {mission} requires {support_event}, which uses {capability}. [path] The current requirement assessment is {assessment_or_unknown}. [assessment] Related source records report {supported_fields}. [records] This path does not establish that a regional hazard has occurred.

**No exact record:**
> No eligible record matching {typed_identifier} was found in {permitted_scope} at {exercise_time}. That does not prove the record does not exist outside this loaded snapshot. Check the identifier or choose an authorized scope.

**Ambiguous follow-up:**
> Do you mean {candidate_one} or {candidate_two}? Select one so I can show its current records.

## 6. Integration and mode behavior

1. Build a deterministic answer plan early, before assembling expensive LLM context. Reuse it for retrieval and structured supports.
2. Preserve current default policy: validated cache → configured live generation → deterministic fallback. The fallback receives the question plan, query results and selected evidence, not just packet facts.
3. Optionally add an explicit per-question **Deterministic only** preference after API review. It must bypass both model cache and provider calls; global `LOCKER_DAVEY_LIVE=0` alone does not guarantee this because valid model cache is allowed. Do not silently change default mode or existing labels.
4. Run prohibited-action/authorization checks before expensive retrieval or generation. Cache keys and idempotency fingerprints must include response policy, resolved scope, filters, query/template version and current identity.
5. Keep historical snapshots read-only. A deterministic question must not use a stale prior answer as the current calculation population.
6. Preserve graph trace/review behavior. Deterministic mode explains existing modeled paths and quotes reports; it does not manufacture new proposed graph nodes/links or assert modeled effects for unmodeled narrative concerns.
7. Derive follow-up chips from supported intents and available evidence. They should not advertise unavailable joins, comparisons or historical analysis.
8. Add bounded structured conversation referents (`intent`, resolved entities, query/filter IDs, cited supports), not copied assistant prose as evidence. 'Why?' can reuse one entity; ambiguous 'that' requires clarification. Revalidate references after every state/scope change.

## 7. Implementation touchpoints

| File/module | Planned update |
| --- | --- |
| `overview_chat.py` | Replace generic fallback dispatch; carry intent/query/template metadata and referents; preserve sessions, ownership, size limits and stale checks. |
| `overview.py` | Reuse projection and allowlisted records; expose precise query supports instead of overloading keyword-selected whole-table counts. |
| `assistant_context.py` | Add normalized searchable text, typed mission/leading-constraint/path supports, intentional candidate selection and coverage metadata. |
| `davey_evidence.py` | Share typed entity keys and stable relevance rules; preserve quote provenance, time eligibility and uncertainty. |
| New `assistant_intents.py` | Deterministic intent/entity/scope/reference planner and clarification rules. |
| New `assistant_queries.py` | Allowlisted complete-set queries and validated joins against existing View/forecast. |
| New `assistant_retrieval.py` | Shared candidate contract, eligibility/ranking fusion and retrieval provenance. |
| New `assistant_templates.py` | Versioned, typed template registry and variants using common citation rendering. |
| `OverviewChat.tsx` / embed worker | Align record contract, display resolved intent/scope/completeness, supported follow-ups, optional deterministic-only control; no dashboard redesign. |
| Tests/evaluation | Intent/query/template gold cases, property/security tests and actual worker integration. |
| README / assistant docs | Supported-question matrix, deterministic examples/screenshots, mode and limit explanations; reconcile stale setup descriptions. |

Do not add a cloud vector database, arbitrary SQL executor, persistent source index, new operational connector or LLM classifier for this scope.

## 8. Delivery sequence

### Phase 0 — Baseline and question inventory
- Record the current fallback outputs for a fixed snapshot across all four views.
- Create a reviewed question inventory: supported, ambiguous, missing-data, unauthorized and prohibited execution cases.
- Define query semantics and expected support IDs before coding templates.

### Phase 1 — Retrieval/support prerequisites
- Fix Mission/worker text contract and test local inference on Mission and Dominoes, including missing assets.
- Address pre-retrieval truncation, typed source/entity metadata and normalized leading-constraint/graph supports.
- Assert permission/time eligibility before any browser candidate exposure.

### Phase 2 — First useful deterministic release
- Implement intent router, typed query results, shared template renderer and priority catalog.
- Replace first-five-facts fallback on all failure paths, including context-budget failures.
- Implement explicit no-match/missing/ambiguous variants and complete-set count provenance.
- Keep a clearly labeled generic overview only as an offered summary, not a silent answer to an unrecognized question.

### Phase 3 — Follow-ups and expanded coverage
- Add structured referents and intent-derived suggestions.
- Add training/certification windows, authorized comparisons and available-history cases only with validated data semantics.
- Consider the explicit deterministic-only preference without breaking cache/mode contracts.

### Phase 4 — Evaluation and documentation
- Run isolated backend and browser suites; compare against Phase 0 for directness, correct scope and cited usefulness.
- Capture new deterministic screenshots using temporary sources/server without modifying the shared exercise.
- Update README question examples and publish an honest supported-question matrix. Review before rollout; no live provider call is necessary to validate deterministic behavior.

## 9. Acceptance and evaluation

Create `tests/test_assistant_intents.py`, `test_assistant_queries.py`, `test_assistant_templates.py`, plus existing chat/consistency/browser coverage. Suggested fixture inventory: at least 100 reviewed cases spanning the template families, all four views, paraphrases, exact IDs, ambiguous references and boundaries. This is a planned evaluation set, not a current measured result.

Required acceptance:
- Different intents over the same packet produce appropriately different answers and supports; a supply question cannot pass by returning system counts.
- Every supported template renders correctly for positive, empty, missing/unknown, stale, truncated and ambiguous cases.
- Every displayed numerical value equals its backend query/engine support. Count tests include more than 300 candidate records and more records than the displayed top-k.
- No-match and incomplete retrieval do not become 'zero in the full dataset' or 'no problem exists'.
- Citations resolve to the exact permitted captured records/query population/model supports; partial lineage and evidence class remain visible.
- No future requisition-history entries, post-cursor reports, unrelated-unit records, hidden personnel fields or unvalidated semantic IDs reach answers/browser candidates.
- Duplicate excerpts, superseded CASREPs, hedged language and parser annotations remain distinct from corroborated facts.
- Mission/graph worker tests exercise the actual candidate contract, not only the successful Ship/Shore path.
- Supported deterministic-only requests make **zero** provider calls and return no cached LLM answer; offline fallback tests isolate caches explicitly.
- Identical snapshot, question plan, template version and retrieval policy yield stable output. Optional embeddings may change evidence ranking; canonical counts and exact lookups remain invariant. Keep a stable lexical path for reproducible acceptance fixtures.
- Completed request retries are idempotent; session expiry/ownership, permission revocation, cancellation and state changes behave as before.
- Chat, source inspection, template rendering and graph review leave scenario digest/version, loaded sources and readiness outputs unchanged.
- No raw question/source/credential logging is introduced. Store only approved routing/performance metadata if diagnostics are added.

Proposed release gates: all canonical supported cases route correctly or ask a valid clarification; zero fabricated values/unauthorized disclosures in the reviewed suite; no regression in citation/state/security tests. Track intent accuracy, answer relevance, evidence precision, clarification/refusal appropriateness and latency separately. Do not collapse these into one misleading implementation percentage or claim universal natural-language coverage.

## 10. Boundaries and open decisions

- **Preferred count definitions:** agree what 'open', 'awaiting parts', 'late' and 'at risk' mean for each table. Readiness thresholds and job status are different concepts.
- **Scope expansion:** initial release stays in selected unit/mission/node; named cross-unit requests require explicit authorization and supported query scope, not silent expansion from the fleet page headline.
- **History:** session restoration and audit events are not a durable complete baseline store. Do not promise arbitrary before/after comparisons until captured inputs support them.
- **Narratives:** deterministic quotation is practical; arbitrary interpretation, causal synthesis and report-derived new risk hypotheses remain outside the deterministic guarantee.
- **Semantics of fallback:** separate an actual reason the LLM was unavailable from what the deterministic answer could or could not establish.
- **Operational limits:** synthetic exercise only; no approvals, source writes, simulations, orders or automatic graph promotion. Production authentication/assurance remains separate.

**Authorization record:** implementation was requested after the original planning-only review. No live provider call, credential edit, source-data mutation or production restart was performed during implementation. Commit and publication to main were subsequently requested separately.
