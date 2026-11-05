# Ask Davy consistency: Ship/Shore, Mission Overview and Davy's Dominoes

Status: implemented after user authorization, against main at 1670527. Commit and publication to main were separately authorized; see Git history for publication status. No application deployment was performed.
Original comparison baseline: main at a2d8133; implementation revalidated against 1670527, including account-based authentication. Scope: consistent grounded conversational assistance, not a dashboard redesign.

## Delivery record

- Shared assistant-only policy in `missiontwin/assistant_policy.py` applies to overview chat/brief and the compatibility Mission endpoint. Explicit `0` disables fresh calls, `1` permits configured assistant calls independently of offline ingestion, and absent inherits shared live/demo state. Sanitized capability/status and actual per-answer methods remain distinct.
- `missiontwin/assistant_context.py` adapts the selected mission and optional graph node to captured typed forecast/source supports. The common conversation API accepts `view`, `event_id` and `node_id`, validates unit permissions and rich exercise identity, and retains bounded owner/account-scoped server histories. Idempotent message IDs protect completed retries.
- Common structured text/value answers and inline source/assessment citations now cover all views. The combined schema permits validated domain warnings and tentative proposals; existing domain safeguards remain in force. Prior assistant prose and proposals are not promoted to factual supports.
- Shared `AssistantPanel.tsx` shell and `OverviewChat.tsx` transcript/composer/worker/citation/session lifecycle replace the separate Mission chat UI. Mission and Dominoes remain separate conversations with explicit graph handoff. Existing graph review/dismiss/restore state remains local and cannot update engine outputs.
- Default bundled local semantic retrieval is reused across contexts with exact/lexical fallback and server-validated candidate IDs. Mission candidates are bounded to eligible redacted records.
- Shared transport adaptation handles explicitly unsupported token, temperature and strict-schema options. Strict output is preferred; recognized unsupported format responses may use JSON-object mode without relaxing server/domain validators. Cache hits are revalidated and labeled Cached LLM even when fresh calls are disabled.
- README and `.env.example` describe shared policy and the updated interface. The user's `.env` was not edited. No live provider call or production restart was performed during implementation. Commit and publication to main were subsequently authorized separately.

Verification: **197 backend tests passed**, **26 isolated browser tests passed**, frontend typecheck and production build passed. Final logs: `logs/assistant-consistency-backend-final.log` and `logs/assistant-consistency-browser-final.log`. Coverage includes real mocked transport invocation versus cache/fallback, ownership, rich stale context, inline citations, restoration, Mission-to-Dominoes handoff, review/dismiss/restore, and unchanged forecast outputs. Tests run against temporary sources/server rather than the user's exercise instance.

Bounded limits retained intentionally:
- `/api/davey/ask` and its legacy evidence endpoint remain compatibility APIs with the previous draft contract. The current UI uses the shared conversation path; removing the compatibility API is a later breaking-change decision.
- Mission context is one selected/resolved mission. Arbitrary cross-mission aggregate queries are not implemented; prompts and context explicitly disclose this scope instead of inventing totals.
- Assessment provenance is partial, not a complete calculation/formula lineage. Citation validity does not establish semantic entailment. Mission warnings/proposal cards retain their domain source/claim drill-downs alongside the shared inline-cited main answer.
- Expired sessions are not durable history. Browser display cancellation does not guarantee upstream request cancellation. Human live-model quality evaluation and operational certification were not performed.

The original findings/design below are retained as the design record, not descriptions of current behavior.

## 1. Findings from the current code

There are two independent assistant implementations, not one assistant with different screen context.

| Area | Ship/Shore Overview | Mission Overview / Davy's Dominoes |
| --- | --- | --- |
| UI | `OverviewAssistantPanel.tsx` + `OverviewChat.tsx` | `components/davey/AskDavey.tsx` + `state/davey.tsx` |
| Branding | Ask Davy | Ask Davey, static AI badge |
| Backend | `overview.py`, `overview_chat.py`; `/api/overview-assistant/conversations` | `davey.py`, `davey_models.py`, `davey_evidence.py`; `/api/davey/ask` |
| Live enablement | Shared application's `LLMClient.configured`; demo mode prevents fresh calls | Copies that client and overrides demo mode using `LOCKER_DAVEY_LIVE=1`; can be live even with offline ingestion |
| Provider transport | `LLMClient.run`, JSON-object response; existing token/temperature compatibility handling | `run_structured`, strict JSON-schema response; separate transport, completion-token parameter, deadline/retry handling |
| Answer format | Sections and sentences, supported text/value segments; backend inserts exact values | Free-text answer plus claim/evidence ID arrays, warnings and optional proposals; validators constrain prose |
| Citations | Inline sentence-level citations; records, assessments and calculations | Evidence buttons and forecast claim chips beneath an answer/warning, not sentence-level inline citations |
| Retrieval | Exact/lexical search plus default browser-local MiniLM semantic candidates and bounded selection | Backend exact/lexical ranking of eligible requisitions, maintenance, CASREPs and daily reports; no MiniLM path |
| Conversation | Bounded server conversations, recent turns and support references; sessionStorage ID restoration; owner cookie | React histories per tab, at most four retained answers; previous answer ID, truncated previous prose and proposal-label retrieval expansion; no equivalent session restoration |
| Specialized context | Selected ship/shore unit, domain/filter, assessment and query packets | Selected ship, one selected mission (or most urgent), optional selected graph node; forecast claims and graph targets |
| Specialized features | Explain existing dependencies; no graph proposals | Forecasted warnings vs emerging concerns, tentative nodes/links, trace into Dominoes; local review/dismiss state |
| Freshness | Packet identity, server conversation stale checks | Epoch, scenario version/digest, cursor, source revision/health identity checks before and after generation |

Key code anchors:
- `missiontwin/davey.py`: `_client`, `_generate`, `_capture`, `_fallback`, `validate_draft`, `ask`, `evidence`.
- `missiontwin/llm.py`: `configured`, `run`, `run_structured`.
- `missiontwin/overview_chat.py`: `generate`, `render_answer`, `Conversations`, `register_chat`.
- `web/src/captain/components/layout/AppShell.tsx`: mounts the separate Mission/Dominoes assistant only on those routes.
- `web/src/captain/screens/ShipOverview.tsx`: mounts the overview assistant (including shore-domain context).
- `web/src/captain/components/davey/AskDavey.tsx`: unconditional AI launcher badge, but dynamic generation labels/reasons inside answers.
- `web/src/captain/state/davey.tsx`: separate tab histories, prior-answer reference, cancellation and graph handoff.

### Is Mission Overview answering without an LLM?

For the inspected local `.env`, `LOCKER_DAVEY_LIVE` is not enabled, while the shared endpoint/key are configured and demo mode is not enabled. Therefore Mission/Dominoes do not make fresh model calls, even though Ship/Shore can. A valid existing model cache entry may still be used: `run_structured` checks cache before `configured`. Otherwise `_fallback` constructs generic modeled warnings directly from forecast gates and explicitly says emerging concerns were not assessed by the live model. This is not an LLM-written response to the question.

This is a configuration mismatch, not a missing Mission LLM implementation. Enabling the existing flag and restarting can enable its current live path, but does not solve the other inconsistencies. It also does not guarantee endpoint support for strict JSON-schema output. No live provider call was made as part of this inspection.

The static AI badge is misleading as an execution indicator. Existing answer labels already distinguish Live LLM, Cached AI and Rules-based fallback; retain and improve that honesty rather than implying all existing labels are absent.

## 2. Target contract

One Ask Davy product experience with context-specific capabilities:
1. Same floating collapsed launcher, name, theme, keyboard/mobile behavior and chat shell on all four views. Do not alter dashboard layouts.
2. Opening a drawer, changing a scope or selecting a suggestion never invokes generation. Explicit Send/Summarize does.
3. LLM writes concise grounded explanations when enabled and compatible. Live, cached and deterministic fallback are visibly distinct.
4. Every factual sentence has inline citations. Exact numbers, dates, identifiers and statuses are backend-rendered support values, not model arithmetic.
5. Same automatic local semantic search with exact/lexical fallback; embeddings retrieve evidence, not authoritative values.
6. Context-aware follow-ups and session-only restoration, with bounded storage, ownership, expiry and stale-context rejection.
7. Preserve Mission/Dominoes warnings and graph tracing as extensions. Proposals are tentative hypotheses, never accepted facts or modeled dependencies.
8. All four views remain read-only. Reviewing a suggestion is local UI state, not approval, simulation, ingestion or an engine update.

Consistency does not mean identical prompts or evidence corpora. Shore facility context must not be forced into a mission model, and mission selection must not disappear behind a generic overview packet.

## 3. Proposed architecture

Extract the reusable overview-chat foundations incrementally; do not replace Mission with the existing ship packet unchanged or copy/paste another chat stack.

### A. Common live policy, status and transport

- Resolve generation policy once for both services. Proposed backward-compatible behavior:
  - Explicit `LOCKER_DAVEY_LIVE=0`: no fresh assistant calls across views.
  - Explicit `LOCKER_DAVEY_LIVE=1`: allow assistant calls with valid server-side configuration, independently of offline ingestion.
  - Flag absent: inherit the shared configured/live state; offline demo remains offline.
- This proposed change permits Mission calls on explicit submissions in a normally configured non-demo instance. Document the migration and approve this behavior before rollout; do not silently edit local credentials or enable unrelated LLM workflows.
- Never let this policy enable ingestion, briefs or action parsing in offline demo mode.
- Add a common status response with capability (`live-capable`, `offline`, `unconfigured`), cache availability policy and sanitized reason codes. Capability is not proof a provider call succeeded; each answer records its actual method.
- Share request construction, token compatibility, deadlines, retry rules, privacy guard and sanitized error classification. Retain task-specific validators and cache namespaces.
- Support configured OpenAI-compatible providers without assuming strict JSON-schema support. Prefer strict schema where supported; use validated JSON-object mode only after a recognized unsupported-format response. Never weaken domain validation or retry every 400 indiscriminately.
- Distinguish disabled, missing configuration, unsupported provider format, timeout, refusal, invalid citations/answer and expired context without exposing provider payloads or secrets.
- Treat cache output as previously generated content, never as a fresh call. Revalidate against current support/context and policy before displaying it.

### B. Context adapters and support packets

Introduce shared context identity/support interfaces, with separate overview and mission/graph adapters (suggested new modules: `missiontwin/assistant_context.py`, `missiontwin/assistant_generation.py`). Reuse existing capture logic.

Context includes view kind, unit, mission selection semantics, optional graph node, current filters, source revision, scenario identity, exercise cursor and source-health identity. Server validates selections against loaded data; browser cannot supply authoritative claims or graph targets.

- Overview adapter: preserve current projection, evidence, assessment and complete-set query supports.
- Mission adapter: wrap `state.fc()` mission/gate/item claims and existing source references as typed supports; retain model assumptions and incomplete-lineage labels. Preserve most-urgent selection semantics and show the actual resolved mission.
- Dominoes adapter: extend mission context with the selected modeled node and existing graph neighborhood. Validate it belongs to the current mission. Explain modeled relationships separately from source-reported entities and proposed relationships.
- Convert eligible `davey_evidence` passages to the common record-support contract, retaining known-at time, uncertainty, supersession and parser annotations.
- Add engine assessment/calculation drill-downs for forecast claim citations, not only raw passage viewers. Document partial lineage rather than presenting it as complete proof.
- Any cross-mission count/comparison must use a bounded structured backend query over the requested complete set. A packet for the most urgent mission cannot answer 'all missions' by guessing. If unsupported, explain the scope or request clarification.

### C. Shared validated answer schema plus domain extensions

- Use overview-style sections/sentences and text/value segments as the common answer body, server-rendered through known support IDs.
- Add optional typed Mission/Dominoes extensions: warnings, trace targets, proposed nodes and links.
- Warnings must have cited grounded explanations and retain `forecasted` vs `emerging` distinctions and verification requirements.
- Continue all existing proposal validation: exact source phrases, allowed kinds, no duplicate modeled nodes, existing dependent to proposed dependency direction, target-linked evidence, no unsupported estimates, no certainty inflation and no reliance solely on superseded records.
- A proposal is not an authoritative support for future factual claims. Follow-ups can discuss it as a cited hypothesis and must re-check its underlying eligible sources.
- Keep the current semantic-entailment limitation explicit: valid support IDs do not prove every causal interpretation is true.
- Version schema/prompt and cache keys; invalidate incompatible prior outputs rather than rendering old free-text drafts as new structured answers.

### D. Shared sessions and evidence access

- Extend/extract the overview conversation manager to support all context adapters; retain existing loopback/origin protections and owner-cookie checks for every new route, not just overview endpoints.
- Keep conversations partitioned by view/context; Mission to Dominoes trace is an explicit handoff, not accidental sharing of histories. Carry the originating answer/support references with a valid current identity.
- Restore via opaque sessionStorage IDs only; keep answer/evidence content server-side, with the existing bounded memory/turn/idle limits. Enforce per-owner access for history, messages, deletion and evidence.
- Preserve Mission's richer identity dimensions and pre/post-generation checks, idempotent requests and capacity limits when adopting common lifecycle code.
- A stale conversation stays visibly historical; never attach a prior answer to a changed ship, mission, node or source state. New conversation must capture fresh context.
- Browser abort/cancellation suppresses late UI updates; do not promise it cancels an already executing upstream request. Prevent obsolete replies from appearing in another scope.

### E. Shared frontend shell and domain extensions

Suggested shared folder: `web/src/captain/components/ask-davy/`.

- Extract launcher/panel, transcript, composer, status labels, inline citation renderer, evidence/assessment/calculation viewer and advanced semantic-search controls from the overview implementation.
- Use a common conversation hook; thin route adapters provide context, summary action, placeholder and suggested questions.
- Standardize on **Ask Davy**; remove the unconditional AI pill or replace it with an accurate capability indicator. Per-answer labels: **Live LLM**, **Cached LLM**, **Deterministic fallback**.
- Fallback explicitly says no live analysis was performed and that emerging concerns were not assessed; do not market forecast templates as question-specific model answers.
- Mission adds scope selector, 'Summarize this mission', forecast/emerging-warning cards and trace actions.
- Dominoes adds selected-node context, 'Explain this dependency', tentative suggestion details and local review/dismiss controls.
- Preserve explicit Mission-to-Dominoes trace handoff without overwriting the Dominoes conversation.
- Restore full inspectable historical turns/citations, not only three-line summaries. Preserve stale labels and current-snapshot access rules.
- Preserve classification-banner clearance, theme tokens, Escape/focus behavior, accessibility, mobile sizing and print hiding. Mount exactly one launcher on each eligible route.

### F. Shared local retrieval, with scoped inputs

- Extract worker management from `OverviewChat.tsx`; reuse pinned bundled MiniLM/WASM assets, default-on behavior and Advanced control.
- Expose only bounded, redacted, currently eligible candidate records for the captured mission/node context. No future records, raw histories or secret fields in browser inputs.
- Validate semantic candidate IDs server-side against the packet. Apply exact identifier priority, mission/graph relevance, narrative diversity and supersession rules alongside semantic ranking.
- Worker/model failure falls back automatically to existing exact/lexical retrieval. No runtime remote model downloads, new persistent vector database or extra user configuration.

## 4. Incremental delivery

1. **Policy and truthful status:** common enablement/status/transport tests; remove misleading static AI badge; document migration. Existing two APIs can remain temporarily.
2. **Mission support adapter:** typed forecast/record supports and cited structured answer generation behind a feature flag; preserve existing validation and warnings/proposals.
3. **Shared conversation API:** context adapters, ownership, bounded histories, stale-state and idempotency tests; keep old endpoints as temporary compatibility wrappers, not independent long-term generation paths.
4. **Shared frontend:** first migrate Ship/Shore without behavior regression, then Mission and Dominoes with domain slots and explicit trace handoff.
5. **Semantic retrieval:** reuse worker and eligible candidates; verify fallback and time filtering.
6. **Verification and cleanup:** remove duplicate shell/transport/state code only after parity; update README, `.env.example` and assistant documentation. Do not overwrite the user's `.env`.

Each stage is independently testable. Do not combine a dashboard redesign or engine-model change with this work. No push or deployment is implied by this plan.

## 5. Verification and acceptance

Extend `tests/test_davey.py`, `tests/test_overview_chat.py`, `tests/test_overview_assistant.py`, `tests/test_llm_transport_compat.py` and browser assistant coverage.

Backend acceptance:
- Policy matrix: configured direct server, demo mode, explicit enable/disable, missing key/endpoint and cached responses. Cache tests prove zero provider requests; successful live tests prove an actual mocked transport invocation.
- Compatible strict-schema and JSON-object providers; recognized unsupported format/token parameters, timeout, refusal, malformed responses and citation failures are accurately classified.
- Mission and node questions produce grounded generated prose in live mode, not template summaries mislabeled as live.
- All values match engine/query/support values exactly; hallucinated estimates, unsupported dates, foreign support IDs and stale graph targets are rejected.
- Eligible time filtering, source redaction, superseded/hedged reports and parser uncertainty survive the adapter/retrieval changes.
- Session ownership, cross-owner evidence denial, stale identities, source-refresh failures, expiry, capacity, idempotency and concurrent state changes are covered.
- Queries, chat and local review actions do not change scenario version/digest, readiness, baseline records or modeled graph.

Browser acceptance on all four views:
- One collapsed Ask Davy launcher; opening and choosing suggestions make no generation request.
- Same transcript/composer/citation behavior; backend method labels distinguish live/cache/fallback; no static AI claim in offline mode.
- Summary plus follow-up such as 'Why?', 'Which source says that?' and 'Explain that dependency' retains the correct context and opens exact permitted evidence/calculation details.
- Refresh restores a valid session; context changes never reuse an invalid answer; cancellation/late results cannot leak across tabs.
- Semantic default, missing-model/worker fallback, light/dark, keyboard, mobile, banners and print work without dashboard layout changes.
- Trace a Mission warning into Dominoes; verify modeled nodes versus tentative proposals remain distinct, and local review does not change engine outputs.

Final local gates: backend suite, isolated Playwright suite, frontend typecheck and production build. Optional explicitly authorized live smoke: one summary and one follow-up for each context, with actual method, latency, citation opening and human review recorded without credentials or raw provider payloads. Local demo acceptance is not operational certification.

## 6. Non-goals

No assistant mutations, approvals, operational orders, simulations, durable review history, operational authentication, persistent vector database, arbitrary unrestricted SQL, new data authority or automatic acceptance of proposed graph relationships. Keep the demo bound to loopback; owner cookies are not a replacement for production authentication.
