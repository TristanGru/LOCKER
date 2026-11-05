# Ask Davy: answer questions about the current screen

**Status:** proposed implementation plan only. No application changes are part of this review.
**Baseline:** local main at `f0a7970`, including the deterministic template implementation.
**Primary case:** Davy's Dominoes, Flagged chain, user asks “How many at risk?” and expects the count represented by the current graph/status indicator—not a summary of one mission.

## 1. Answer to the product question

Yes, this request makes sense. Ask Davy should understand the user's current analytical screen context and answer supported questions about it in both LLM and deterministic modes.

**Do not implement this as screenshot reading, OCR, DOM scraping or sending the screen image to an LLM.** The application already has the structured nodes, statuses, relationships, filter state and numerical values that draw the screen. Share that context explicitly, and verify/recompute authoritative numerical results against the same permitted snapshot on the backend.

The assistant should be able to say, illustratively:

> There is **1 at-risk item** in the current Dominoes graph. [1] This counts graph items, not at-risk missions. The item is **{verified node label}**. [2]

This is the desired response shape, not a claim that the current running exercise was inspected and always contains that value. If the actual validated count is zero or another number, render that number. If the displayed badge and filtered view represent different populations, explain the difference rather than choosing a misleading total.

## 2. Current implementation and root cause

### What draws the screen

- `web/src/captain/screens/Dominoes.tsx` loads `api.getGraph(focus)`.
- Its `counts = countMatches(data.nodes)` drives the At risk/Watch/Ready/Stale data/Sources disagree/Next domino chips.
- `showAll` and status filters are **local component state**, not assistant context.
- `active` removes selected filters with zero matches; the assistant must use this effective filter set, not an obsolete checkbox selection.
- `components/graph/DominoGraph.tsx` chooses `filterView(...)` when any filter is active, otherwise Every item or `condense(...)` for Flagged chain.
- `filterView` uses **OR** between active filters and retains ancestor/context cards separately from direct matches.
- `layout.ts::condense()` folds healthy groups into summary cards. A folded group is not a new modeled risk item.
- Tentative proposals are added separately to the rendering and can automatically switch the view to Every item.

### What chat receives

- `components/davey/AskDavey.tsx` passes unit, `eventId`, optional `nodeId`, and `filter="all"` to `OverviewChat`.
- It does not pass graph view mode, active filters, graph revision, count population, node membership or current badge metrics.
- `focus === 'all'` becomes `eventId: null`. In the mission adapter, null means **resolve the most urgent mission**, not retain the graph's All missions selection.
- `assistant_intents.py` recognizes a count request, but an omitted noun has no table/population and requires clarification. The LLM path independently sees a selected-mission packet and can interpret an underspecified count as a mission count.
- `assistant_templates.py` has system and structured-record count branches, but no graph-node/status count operation.

The quoted response is consistent with this scope gap: it describes a selected mission's YELLOW status and declines a mission total. That is not evidence that the graph's at-risk indicator is unavailable; it is missing from the assistant's context and query vocabulary.

### Important: existing graph APIs are not automatically equivalent

The current captain graph is assembled in `web/src/captain/api/api.ts::graph()` from the dashboard/forecast response. It is not a simple rendering of `/api/graph/{ship_id}`.

The Python `engine.domino_graph()` has different node identifiers, edge direction, item treatment and shore expansion. The frontend adapter also has important presentation semantics:
- an active defect that does not lower a system below its requirement is shown as **Watch / Not limiting**, not a fabricated zero-percent risk;
- Ready events do not advertise a next-domino tag;
- only qualifying shore-support detail is expanded in the captain graph;
- status values use the current configured bands and Unknown handling.

Blindly counting nodes from `engine.domino_graph()` can therefore disagree with the visible captain graph. Fix the projection boundary first; do not create another approximate counting implementation.

## 3. Define what “on screen” means

Adopt explicit, testable populations:

| Population | Meaning |
| --- | --- |
| `graph_legend` | Canonical modeled nodes for the selected unit and graph mission scope, before local status filters/condensing. This is the current chip-count population. |
| `graph_view` | Canonical modeled nodes included by the current effective filter/view projection, including retained connector/context nodes. Excludes folded summary artifacts and tentative proposals. |
| `graph_matches` | Direct matches of the current OR filters, excluding faded connector-only nodes. |
| `graph_missions` | Distinct canonical mission nodes in an explicitly named graph population; not all node kinds or all missions in the fleet. |
| `graph_entities` | Distinct underlying entities only when verified canonical entity keys exist. Do not deduplicate unrelated nodes using display labels. |
| `graph_proposals` | Tentative UI suggestions, counted separately and labeled non-authoritative. Not readiness facts. |

“Current view” means the current analytical graph/filter selection, **not only the pixels inside the panned canvas or browser viewport**. Pan, zoom, scroll and temporary drawer occlusion must not change readiness totals. Requests about literal viewport geometry are separate and should ask clarification until explicitly supported.

### Default resolution policy

1. On Dominoes, a bare “How many at risk?” or “How many Watch?” maps to the matching status-chip metric, `graph_legend`, not to mission readiness or a maintenance table. This matches the user's reference to a displayed indicator.
2. “How many at-risk items in this Flagged chain/current filtered view?” maps to `graph_view`.
3. “How many match these filters?” maps to `graph_matches`.
4. “How many missions are at risk?” explicitly restricts kind to mission and retains the graph's selected mission scope. It must not count equipment/parts/people or silently broaden to fleet missions.
5. “Which ones?” follows the prior resolved query population and lists its exact matching members.
6. “How many unique parts?” requires a supported unique-entity key; a count of node instances is not a count of unique physical parts.
7. If the legend and filtered-view counts differ, a bare badge question states the legend count and may add: “Of these, {n} are included in your current filtered graph.” Both values must be independently supported.
8. When route/scope is unknown or two populations are equally plausible, ask a short clarification. Never infer a mission count just because a mission packet happens to be present.

Do not silently change the existing chip-count semantics as part of adding chat. If product design later wants chips to count only rendered matches, treat that as a separate coordinated UI change with parity tests.

## 4. Proposed solution: explicit screen context plus verified view queries

### 4.1 Versioned screen-context contract

Introduce a strict schema, for example `ScreenContext`:

```json
{
  "schema_version": "screen-context-v1",
  "screen": "dominoes",
  "unit_id": "<selected permitted unit>",
  "mission_scope": {"kind": "all_for_unit", "event_id": null},
  "graph_mode": "flagged",
  "active_filters": ["risk"],
  "selected_node_id": null,
  "projection_version": "captain-graph-v1",
  "snapshot": {
    "source_revision": "<revision>",
    "scenario_version": 0,
    "scenario_digest": "<digest>",
    "exercise_cursor": "<exercise time>"
  },
  "ui_context_revision": "<context revision>"
}
```

- Distinguish `selected_event`, `all_for_unit`, and `most_urgent_for_unit` explicitly. Null must not have incompatible meanings across graph and chat.
- Use effective filters actually applied to the graph, including automatic changes caused by proposal display.
- The browser may supply visible-node IDs/observed chip counts as **diagnostic consistency hints only**, with strict limits. Never trust browser-supplied numbers, probabilities, labels, source paths or membership as numerical authority.
- Do not send all DOM text, screenshot pixels, credentials, private browser state, or unrestricted source documents.
- Selected-node focus is an additional reference; selecting it must not silently reduce a graph-wide count to one node.

### 4.2 Publish screen context without changing the dashboard layout

Add a small screen-context registry/provider, scoped to the currently mounted route/account/unit.

`Dominoes.tsx` publishes the unit, explicit mission selection semantics, graph snapshot identity, settled view mode, effective filters and selected node. Clear its registration on unmount. Tag registrations with route/account identity so a late update from a previous screen cannot replace the current context.

`AskDavey.tsx`/`OverviewChat.tsx` read this context when initializing and submitting messages. Display a compact scope line such as:

> Dominoes · All missions on {unit} · Flagged chain · Filter: {filters_or_none}

On Dominoes, the assistant's mission selector should reflect the graph selector. Do not relabel graph All missions as Most urgent. Mission Overview can retain most-urgent behavior when explicitly selected, with resolved scope displayed.

A screen context that is loading or has failed to refresh is not a confirmed zero. Disable authoritative screen-count submission or return “The graph is still updating; retry when it finishes.”

### 4.3 Establish one canonical captain graph projection

Recommended authority: extract a read-only backend captain-graph projection from the existing frontend adapter, preserving the exact captain semantics. Suggested modules:
- `missiontwin/captain_graph.py`: canonical nodes/edges/statuses/source locators;
- `missiontwin/assistant_view_queries.py`: query/population projection and calculation supports.

Return a versioned canonical graph payload for both rendering and assistant queries. The UI may retain layout/animation locally, but must not independently reinterpret numerical status or silently change node membership.

Migration steps:
1. Capture representative frontend graph projection fixtures before moving logic.
2. Reproduce the captain adapter's IDs, kinds, item availability logic, Not limiting status, shore expansion, configured thresholds, stale flags and next-domino behavior on the backend.
3. Add parity tests against those fixtures.
4. Make `api.getGraph()` consume the canonical payload.
5. Define logical `filterView`/Flagged-chain membership and fold groups using the same versioned rules; backend query results and frontend rendering must agree.

If the backend and TypeScript need separate implementations of a pure view transformation, require shared JSON conformance fixtures and cross-language parity tests. Prefer a single backend-computed analytical membership result with frontend-only positioning, not two independently evolving versions of the same business rule.

Do not replace or mutate engine probabilities. This is a projection/query extraction, not a readiness-model change. Keep the older `/api/graph` contract separate or add an explicit versioned captain endpoint rather than silently breaking legacy graph consumers.

### 4.4 Screen query capture and verification

At request capture:
1. Verify account ownership, permitted unit and requested mission/node selections.
2. Check source revision, scenario identity, cursor and graph projection version.
3. Rebuild/get the canonical graph from the accepted loaded snapshot and current model outputs.
4. Apply view/filter rules to derive the named populations.
5. Resolve the question to one typed query and compute exact counts/lists over the complete relevant population.
6. Compare optional browser diagnostics with the verified result. If mismatched, mark screen context stale and refresh; do not invent an explanation for the discrepancy.
7. Check snapshot/context again before returning a response.

Keep access checks for supporting shore records and cross-unit dependencies. A Fleet Commander graph can show more than a CO graph. Browser evidence must not escape the same authorization boundary as the UI projection.

## 5. One numerical answer source for both LLM and deterministic modes

### Add typed view-query operations

Initial operations:
- `count_graph_nodes(population, status?, kind?)`;
- `list_graph_nodes(population, status?, kind?, limit)`;
- `count_graph_filter_matches(active_filters)`;
- `explain_graph_node(node_id)` using existing typed assessment/source supports.

Implement strict enum arguments and bounds. No arbitrary browser predicates, JavaScript execution, SQL, graph scripts or prompt-provided source paths.

Every result includes:
- operation, population name/definition and effective filters;
- unit/mission/view scope;
- exact value and units (`graph items`, `missions`, etc.);
- complete-set membership/contributing canonical node IDs;
- shown-page size separately from total;
- node-kind breakdown where useful;
- explicit inclusion/exclusion of connector nodes, folded summaries and proposals;
- projection/rule version, source revision, scenario identity and cursor.

Canonical node IDs count instances in the modeled graph. Shared physical equipment repeated under multiple mission paths can be multiple graph instances; never call those unique assets without a verified asset-key query.

### Deterministic path

- Extend `QuestionPlan` with `population`, `screen_metric`, `status`, `node_kind` and structured scope.
- Resolve “How many at risk?” from current screen defaults before record-table clarification rules.
- Add `graph_status_count`, `graph_status_list` and `graph_filter_summary` template families.
- Render the computed value, qualified population, membership list and existing citations.
- Preserve `deterministic_only` zero-provider/no-model-cache guarantees.
- Preserve typed graph-query referents for follow-ups such as “Which one?”, “Why is it at risk?” and “Does that include the mission?”

### LLM path

- Use the same question planner/query operation to supply a server-issued calculation support before generation.
- Include explicit screen scope and the query definition/result in the bounded model context.
- Require numerical counts to use the support's value segment. The model may explain the count but must not calculate it by reading snippets or assume an at-risk mission from a generic YELLOW assessment.
- For a recognized exact count, validate that the answer references the designated query support and renders its count; reject substitutions of another population or a fabricated “unavailable” claim. If correction fails, return the deterministic count template.
- Keep semantic entailment review limits: structural validation does not prove arbitrary explanatory prose. For simple count questions, prefer a backend-owned factual count sentence with optional validated LLM explanation.
- Model cache keys must include screen/query identity, population, filters, projection/template versions and response policy.

Embeddings/RAG retrieve explanations and source records for listed nodes. They are **not needed to calculate a graph count** and may not alter the exact numerical result.

## 6. Calculation citations and user-facing detail

The count citation should open a **Current graph calculation** view, not an unrelated CSV row or only a mission probability:

- Metric: At risk;
- Population: legend/current view/direct matches, explicitly named;
- Scope: selected unit, explicit mission scope, Flagged chain/Every item and active filters;
- Value and graph-item units;
- Matching node labels/kinds/statuses and canonical IDs;
- Excluded folded summaries/proposals and connector policy;
- Exercise time, source revision and projection version.

Each listed member links to its existing graph assessment/source details. Data provenance belongs to the backend; the browser cannot invent a citation support by submitting a displayed number.

Zero matches should say “No at-risk items in this verified graph population,” not “the unit has no risks.” Missing/stale context should say unavailable/updating, not zero.

## 7. Freshness, conversation and UI changes

Add analytical screen-context identity to session/message capture and completed-request replay checks. Keep cosmetic state separate: panning, zooming, theme and animation frames do not invalidate numerical context.

When graph filters/view mode/mission selection change:
- immediately mark prior view-scoped answers historical for the new selection;
- suppress late replies tied to the old context;
- retain captured citations with their original scope, never silently replace membership;
- preserve transcript where practical, but start a fresh context segment/new conversation for new screen questions;
- revalidate prior node references before reuse;
- do not generate an automatic new LLM answer merely because the user toggled a filter.

Count the settled analytical snapshot, not temporary cascade-animation colors. The UI can briefly display older colors during a domino animation; show an “updating” cue instead of treating animation state as another readiness population.

Any frontend registration/context update remains read-only. It cannot approve suggestions, simulate scenarios, change thresholds, refresh sources or modify model state.

## 8. Extend beyond Dominoes incrementally

The same mechanism can support other screens, with distinct population defaults:

| Screen | Default meaning of “How many at risk?” |
| --- | --- |
| Dominoes | Matching status-chip graph-item population, qualified as above. |
| Ship Overview | Systems in the selected ship's current analytical scope/filter, not mission nodes. |
| Shore Overview | Capabilities in the selected installation's analytical scope/filter. |
| Mission Overview | Mission cards in the authorized displayed fleet/unit/type/time filter population—not only the header-selected unit's most urgent mission. |

Reuse current screen projection functions and complete-set populations. A paginated/virtualized list still has a total filtered population; do not count mounted DOM elements. Unsupported screens should explain available scope rather than assume a generic mission answer.

Initial delivery should prioritize Dominoes and existing Ship/Shore scopes. Mission Overview's fleet/type/time population requires its own authorized projection/query contract before claiming parity there.

## 9. Files expected to change during implementation

- `web/src/captain/screens/Dominoes.tsx`: publish effective screen state and consume canonical projection/view membership.
- `components/graph/filters.ts`, `layout.ts`, `DominoGraph.tsx`: shared/versioned analytical population semantics; retain layout and animation behavior.
- `web/src/captain/api/api.ts` and `api/types.ts`: canonical graph/view-context API contracts; remove duplicate projection business logic after parity.
- New frontend screen-context registry/provider: route lifecycle, context revision, loading/error state.
- `components/davey/AskDavey.tsx` / `OverviewChat.tsx`: pass context, correct All missions semantics, scope label, context-change handling and calculation citations.
- New `missiontwin/captain_graph.py`: versioned rendering/query graph projection.
- New `missiontwin/assistant_view_queries.py`: exact count/list populations and supports.
- `missiontwin/assistant_intents.py`, `assistant_templates.py`: screen-aware resolution and graph templates.
- `missiontwin/assistant_context.py`, `overview_chat.py`: explicit mission scope, screen snapshot capture, support generation, stale checks, cache/idempotency identity.
- Backend/browser projection-parity and assistant tests; README/assistant docs with screen-count examples and limits.

## 10. Delivery phases and acceptance

### Phase 1: lock down the reported discrepancy
- Build an isolated fixture with a known at-risk graph item and a selected mission that is not itself Risk.
- Capture chip count, canonical node statuses, current view membership, graph mission scope and current chat payload.
- Establish whether the reported “1” is a badge metric or a filtered-view metric; do not hardcode 1.
- Add failing regression cases for bare count, explicit mission count and All missions versus most urgent.

### Phase 2: canonical projection and context plumbing
- Extract captain graph projection and conformance fixtures, including Not limiting defects and shore dependencies.
- Publish/validate versioned context; distinguish all-for-unit, selected-event and most-urgent scopes.
- Add exact graph count/list queries and calculation supports.

### Phase 3: deterministic and LLM answers
- Add screen-aware routing, templates and follow-up referents.
- Inject the same query support into LLM requests; enforce count/support use and deterministic fallback on mismatch.
- Add scope/calculation UI and context-change guards without dashboard redesign.

### Phase 4: parity, safety and rollout

Required tests:
- For the isolated reported case, both deterministic and mocked-LLM answers equal the actual risk indicator and identify graph items, not missions.
- Flagged chain/Every item, every status filter, OR combinations, zero-match filter removal, filtered direct matches and faded ancestor nodes are correct.
- Where badge and rendered-view counts differ, each operation returns its own defined population and labels the difference.
- Folded groups are not additional canonical nodes; underlying item totals and summary-card totals are never confused.
- Tentative proposals/review/dismiss state never affect authoritative readiness/status counts; explicit proposal counts remain labeled separately.
- Shared entities under multiple mission paths are counted by documented node-instance/unique-entity semantics.
- `all_for_unit` stays all-for-unit; a selected node does not silently narrow a graph-wide question; explicit mission-count questions count only mission nodes.
- Unknown status stays Unknown. Configured band changes and tolerated defects match graph rendering exactly.
- Large graphs/pagination/top-k retrieval do not reduce complete counts; pan/zoom and animations do not change analytical totals.
- Tampered browser counts, foreign node IDs, unsupported populations and cross-account context are rejected/recomputed safely.
- Mid-request filter/source/scenario changes cannot display or replay a reply for an obsolete context. Cached answers cannot cross view/filter boundaries.
- “Which ones?” preserves exact prior population; ambiguous references ask clarification.
- No generation occurs on panel opening/filter changes; deterministic-only mode performs zero model/cache calls; embedding failure does not change numerical results.
- All chat/view queries leave scenario digest, baseline records, readiness outputs and modeled graph unchanged.

Final checks: backend suite, cross-language graph conformance tests, isolated Playwright, frontend typecheck and production build. Capture new examples only against temporary sources/server; do not reset the user's exercise or call a live provider without separate approval.

## 11. Non-goals

No OCR/vision service, arbitrary browser-screen access, DOM scraping, operational orders, autonomous tool execution, new readiness mathematics, unrestricted fleet queries, automatic acceptance of tentative graph additions or removal of account scopes.

**Planning-only delivery:** only this document is added. No code, configuration, source data, running process or exercise state is changed; no provider calls, commits or pushes are performed.
