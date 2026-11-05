# Ship and Shore assistant: conversational summaries with inline citations

**Status:** Approved and implemented as a bounded local overview-chat release. This document retains the original design/delivery checklist as a reference; see [current behavior and limitations](OVERVIEW_ASSISTANT.md). Generated summaries, typed inline citations, session-only follow-ups, historical evidence retention, failure guards and backend/browser acceptance coverage are present. Citation structure does not prove semantic entailment, and broader operational assurance remains out of scope.

**Scope:** Upgrade the existing floating Ask Davy assistant on Ship and Shore Overview. Preserve read-only behavior, local `.env` credentials, loaded-data authority and optional local MiniLM search.

## 1. Why the current experience is not useful enough

The API connection now works, but the current feature intentionally restricts the LLM to selecting `fact_ids` and `evidence_ids`. The UI then displays prewritten backend fact strings. Consequently:

- The LLM cannot actually summarize the situation or explain it in conversational language.
- A question can return counts or a generic fact list instead of answering the user's intent.
- The interface replaces a single answer rather than maintaining a visible conversation.
- Some system facts have no linked supported source row, and dependency statements lack complete input lineage.
- Retrieved evidence can be relevant without demonstrating the specific causal claim the user asked about.

This is a product/grounding limitation, not just an endpoint or model problem. Simply allowing arbitrary prose would improve fluency but could create unsupported explanations.

**Proposed change:** Let the LLM write concise explanations over an improved evidence packet, with claim-level support references rendered as inline citations.

## 2. Target experience

### On opening Ask Davy

Keep the floating launcher and expandable side panel. Display a short assistant welcome with a **Summarize this ship** or **Summarize this installation** button. Generate the live summary only when requested, avoiding repeated provider calls whenever the drawer opens.

A default summary should answer, in roughly 120–220 words when evidence supports it:

1. **Bottom line:** What needs attention, or what is currently unknown?
2. **Why:** The leading supported causes or contributing factors.
3. **Dependencies:** Existing ship/shore relationships relevant to the selected unit.
4. **Uncertainty:** What cannot be established from the loaded records?

Avoid listing every system, repeating internal schema labels or describing zero rows as proof of readiness. If no abnormality is supported, say so with the assessment basis and remaining limitations rather than manufacturing urgency.

### Conversation

- User and assistant message bubbles in chronological order.
- A multiline composer: Enter sends; Shift+Enter adds a line; explicit Send button.
- Suggested follow-ups such as “Explain that risk,” “Show the source records,” and “Which linked ships are affected?”
- Loading state, Retry, cancel-display behavior and New conversation controls.
- Concise answers first; detailed record lists available on request.
- Inline citation buttons immediately after supported claims: `[1]`, `[2]`.
- Citation buttons open an evidence drawer with exact permitted fields, locators and calculation provenance.
- Method labels distinguish live LLM, cached LLM and deterministic fallback. A template fallback must not look like a successful generated summary.

Illustrative format only; these are not assertions about the current dataset:

> The selected ship's primary concern is the modeled requirement associated with **[system]**. [1] Its currently visible supply record reports **[recorded status/date]**, which is an input—not a guarantee of recovery. [2] The existing dependency graph also links the event to **[shore capability]**. [3] The loaded evidence does not establish an operational recovery decision.

## 3. Grounding contract: improve the packet before adding prose

### Build three distinct evidence classes

| Evidence class | Content | What it can support |
| --- | --- | --- |
| Recorded source | Time-filtered typed CSV fields and eligible document spans | What a source actually reports |
| Model assessment | Existing system/gate result, metric basis, assumptions and linked inputs | What the existing model estimates and why the model associates inputs |
| Calculation/query | Complete-set aggregate, filters, units, distinct keys and contributing records | Counts, totals and comparisons actually computed by the backend |

Do not call an engine result a source quote. Do not cite an unrelated CSV row simply because it contains the same equipment identifier. A calculation citation can be valid even when no single record literally states its result, but it must disclose its method and underlying evidence availability.

### Required packet improvements

- Give each overview assessment, query, dependency edge and source record a stable packet-scoped support ID.
- Include typed values, units, timestamps, qualifiers and explicit relationships, not only formatted fact strings.
- Associate systems with the actual existing gate/item input references; retain modeled item explanations and relevant assumptions.
- Represent ship/shore dependencies with event/unit IDs and the existing supporting relationship, plus source references where available.
- Label partial lineage. If only an engine result is available, cite it as a model assessment and say the supporting raw-record chain is incomplete.
- Include source revision, scenario version/digest, exercise cursor, focus/filter and packet hash throughout.
- Carry source health, stale/conflicting/missing evidence and distinctions between recorded values and scenario overlays.
- Keep full tables and sensitive/unneeded fields out of prompts. Preserve the current visibility/redaction rules.

The initial prose release should use the currently supported structured records and model assessments. PDF narrative retrieval and new source formats are separate extensions, not prerequisites. A question requiring unavailable evidence must get a clear limitation rather than an improvised answer.

## 4. Answer generation with inline citations

### Proposed structured response

Have the LLM generate structured prose segments, not raw HTML, invented URLs or free-form Markdown citation numbers:

```json
{
  "answer_status": "supported",
  "sections": [
    {
      "heading": "Bottom line",
      "sentences": [
        {
          "segments": [
            {"type": "text", "text": "The current assessment identifies "},
            {"type": "value", "support_id": "assessment-a", "field": "display_name"},
            {"type": "text", "text": " as needing attention."}
          ],
          "support_ids": ["assessment-a"]
        }
      ]
    }
  ],
  "limitations": []
}
```

Field names and IDs above are illustrative. Final schemas must be strict, bounded and versioned. Status values should distinguish supported, partial, insufficient evidence and out of scope.

### Rendering and validation

1. Validate output shape, lengths and status before display.
2. Resolve support IDs only against the captured server packet. Reject unknown IDs, invalid field paths and incompatible evidence kinds.
3. Insert quantitative values, dates, identifiers and status labels from typed packet fields through `value` segments. The model provides connecting prose, not new numerical facts.
4. Require support for factual assertions and preserve critical qualifiers: unknown, estimated, reported, modeled, stale and partial.
5. Assign visible citation numbers server-side per assistant message in first-use order; reuse a number when the same support is repeated.
6. Bind each citation to its support object and full state identity. Do not let the model choose file paths or direct source URLs.
7. Render citation buttons immediately after the relevant sentence, not only in a Sources list at the end.
8. On invalid output, allow at most one bounded correction attempt with a precise validation error; then provide a visibly labeled cited template answer.

Critical values can be validated deterministically. **Citations and schema validity do not prove that prose is entailed by the evidence.** Test negation, qualifiers, wrong entity attachment and causal overstatement. Use conservative wording and human-reviewed evaluation; do not claim a second model or a token-matching check guarantees factuality. Unsupported causal explanations should become uncertainty statements or fall back to a known supported claim.

Initially display only fully validated responses. Real-time token streaming is deferred; a loading indicator is preferable to streaming unsupported claims. If streaming is added later, validation must gate accepted factual content and citations.

## 5. Citation interaction

Each message owns its immutable citation map; `[1]` in one answer need not refer to `[1]` in another.

Selecting an inline citation opens a source view inside the assistant showing:

- Source title/system/steward or model/query title.
- Unit, record key, file and row/field or page/span where applicable.
- Relevant permitted excerpt/fields, with the cited value emphasized.
- Exercise knowledge time, accepted source revision and freshness warnings.
- Evidence class and role: reported fact, model assessment, assumption, overlay or aggregate.
- For calculations: rule/basis, filters, input references and completeness status.
- For linked model inputs: drill-down to source records where available.

Historical citations must not silently open current replacement records. Prefer rendering the redacted evidence captured with that message; if it is no longer retained, explicitly mark it unavailable. A derived evidence view must not imply that a full raw source file was retrieved.

Include keyboard navigation, accessible names and a Back to conversation action. Keep long tables and locators out of the message bubble unless requested.

## 6. Multi-turn conversation and retrieval

### Session design

Use a bounded server-managed in-memory conversation for the initial release. Issue unguessable session IDs scoped to a local browser session token; do not treat conversation IDs alone as future multi-user authorization. Keep no durable chat history initially.

- Record user/assistant turns, captured identity, support/citation maps and response method.
- Proposed initial bounds: 20 turns, 30-minute idle expiry, bounded sessions and global memory. Return explicit expiry behavior.
- Send a small recent-turn window to the model. Old generated prose is conversational context, **not new evidence**.
- Resolve “that issue” or “the second system” to structured entity/support references from prior turns. Ask for clarification when ambiguous.
- Re-retrieve current eligible evidence for each question; never rely on the model's memory of record values.
- Reject stale source/scenario requests. Preserve old messages as historical, mark them stale, and require an explicit refresh/new context before a new current-state answer.
- Unit/domain/focus/filter changes start a clearly identified new context rather than silently mixing units or populations.
- Closing the panel should retain the conversation for the current browser session, stop browser embedding work and avoid new calls while closed. The UI must explicitly show when an in-flight response was canceled; it may finish on the server but must not appear in a different context.

### Replace coarse question blocking

The current keyword gate is too restrictive: a harmless question such as “What changed in this view?” can be rejected because it lacks an expected word, while irrelevant questions can pass by including one.

Replace it with a bounded intent schema: overview summary, explanation, exact record lookup, supported aggregate, existing dependency, clarification and out of scope. An LLM may propose an intent, but the backend validates entity references and only dispatches allowlisted read-only operations.

Support open-ended phrasing within these capabilities. Do not expose mutation tools. Explain why a request is unsupported instead of presenting a generic fact list. “What changed” requires a supported comparison snapshot; until available, state that limitation and offer the current summary.

### Retrieval

- Preserve exact identifiers and structured query results as authoritative.
- Use lexical/MiniLM retrieval for relevant supporting evidence, not arithmetic.
- Keep explicit source links and model-input relationships ahead of merely similar rows.
- Filter by accepted revision, exercise visibility, selected context and permitted dependencies before ranking.
- Include relevant contradictory/stale evidence instead of hiding it to make a coherent story.
- Retrieval scores are not confidence in an operational conclusion.

## 7. API, implementation and configuration

Proposed endpoints; preserve the existing overview packet/evidence APIs during migration:

- `POST /api/overview-assistant/conversations`: create a context-bound session, optionally request the initial summary.
- `POST /api/overview-assistant/conversations/{id}/messages`: send a bounded user message with expected state identity; return validated assistant sections and citation map.
- `GET /api/overview-assistant/conversations/{id}`: restore the current bounded session after the drawer reopens.
- `DELETE /api/overview-assistant/conversations/{id}`: explicitly clear the session.
- Citation resolution uses server-issued supports and retained redacted evidence; extend the existing resolver for model/query supports rather than allowing arbitrary files.

Use same-origin/local-session safeguards, size limits, rate/concurrency limits, expiry and safe errors. Do not log raw chats, source text, provider errors or credentials by default.

### File-level work

| File | Change |
| --- | --- |
| `missiontwin/overview.py` | Improve typed support/lineage packet; replace selection-only generation with grounded summary service |
| `missiontwin/overview_chat.py` (new) | Strict message/segment/citation models, conversation lifecycle, bounded intent routing and output validation |
| `missiontwin/api.py` | Conversation routes, local-session protections, state checks and evidence resolution |
| `missiontwin/llm.py` | Dedicated summary task, compatible provider parameters, task-specific budgets and error categories |
| `web/src/captain/components/overview-assistant/` | Chat transcript, composer, inline citation buttons, source drawer and session restoration |
| Existing embedding worker | Reuse eligible record ranking; no change to numerical authority |
| Backend/browser tests | Grounding, conversation, citations, privacy, failure and usability coverage |

Reuse the current OpenAI-compatible endpoint and local `.env`. Do not expose keys to the browser or push `.env`. The API transport compatibility fixes remain necessary, but are distinct from summary quality. Version summary prompts/schemas/cache keys independently from extraction; do not replay a cached ID-selection response as a generated explanation. Include context, question/history references, evidence hash, model and policy versions in cache identity.

## 8. Delivery milestones

### A. Grounded support packet and fixtures

- [ ] Capture current examples of weak answers on both ship and shore.
- [ ] Add typed support objects for assessments, counts, dependencies and source records.
- [ ] Establish model/input lineage and explicit partial-evidence behavior.
- [ ] Freeze response/citation schemas and independent expected claims.

**Exit:** Every proposed summary claim has valid support or is explicitly classified as unknown/partial.

### B. One-turn LLM summary with inline citations

- [ ] Add real summary generation through the existing endpoint.
- [ ] Implement typed value insertion, support validation and citation numbering.
- [ ] Render readable sections and inline citation buttons in the floating panel.
- [ ] Add source/model/query evidence drawer and labeled deterministic fallback.
- [ ] Evaluate actual live answers on approved synthetic examples.

**Exit:** Both ship and shore produce a concise, useful explanation rather than a selected fact list, with working claim-level citations.

### C. Multi-turn chat

- [ ] Add bounded server sessions and local browser-session scoping.
- [ ] Add transcript, composer, suggested prompts, Retry/New conversation and reopen restoration.
- [ ] Resolve conversational references through structured context; improve intent routing.
- [ ] Enforce stale-context, expiry, cancellation and unit/focus/filter transition behavior.

**Exit:** A captain can ask an explanation follow-up and inspect its sources without losing context or mixing revisions.

### D. Hardening and review

- [ ] Exercise prompt injection, unsupported inference, incomplete evidence and provider failures.
- [ ] Verify numerical fidelity, citation support, temporal isolation and read-only behavior.
- [ ] Validate desktop/mobile/keyboard interactions and bounded performance.
- [ ] Document shipped capability, remaining limitations and live evaluation results.

**Exit:** Reviewed acceptance evidence; no claim that finite synthetic tests certify operational reliability.

## 9. Review and acceptance criteria

| Area | Acceptance |
| --- | --- |
| Summary usefulness | Directly answers the question; prioritizes supported attention items; distinguishes current concern from background records; avoids schema-label dumps |
| Inline citations | Material factual sentences have resolvable support; clicking a citation opens the correct record/calculation and identity |
| Numbers | Values/dates/identifiers match typed evidence; no LLM arithmetic; count-based status share is never mission probability |
| Causality | A relevant record is not presented as proof of causality; reported, modeled, assumed and incomplete evidence remain distinct |
| Missing evidence | Unknown/partial/stale/conflicting records produce appropriate qualification or abstention, not invented detail |
| Chat | Follow-ups resolve unambiguously or ask for clarification; reopen restores the session; New conversation clears it |
| State safety | No cross-unit, future-event or source-revision leakage; historical citations do not resolve to replacement data silently |
| Failure behavior | Invalid output gets bounded correction/fallback; fallback is visibly distinct; safe reasons distinguish provider, timeout, schema and evidence failures |
| Read-only/privacy | No source/scenario changes, credentials in browser, arbitrary tool execution or raw prompt/chat logging |
| UX | Floating panel remains unobtrusive, responsive, keyboard accessible and usable on mobile |

Use fixtures for at least: ship overview, shore overview, existing cross-unit dependency, exact requisition lookup, filtered counts, unknown assessment, missing lineage, conflicting evidence, ambiguous follow-up, unit switch and source refresh. Include adversarial cases with correct numbers attached to the wrong entity and real citation IDs attached to unsupported conclusions.

Run mock transport tests, backend regression tests, isolated Playwright tests and opt-in live endpoint evaluation. A fluent answer with valid citation syntax is not sufficient; review factual support and usefulness. Do not modify the user's active exercise during acceptance tests.

## 10. Recommended approval

Approve **A → B first**, then review actual ship and shore summaries before adding C. This addresses the current information-quality problem before investing in conversation polish.

Recommended defaults:

1. Concise generated summaries and inline citations, not unrestricted generic chat.
2. Real chat follow-ups within the loaded overview evidence boundary.
3. Evidence drill-down for reported, modeled and calculated claims.
4. Session-only history, no durable chat storage initially.
5. Fully validated responses before display; no token streaming initially.
6. No new database, embedding model or external service required.

**Delivery record:** Implementation is in `missiontwin/overview_chat.py` and the shared overview chat components. `scripts/evaluate_overview_chat.py` provides explicit opt-in live summary/follow-up checks without resetting the exercise. The legacy selection-only brief API remains available for compatibility; the floating chat now uses the generated-summary conversation API.
