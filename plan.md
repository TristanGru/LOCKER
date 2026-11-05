# Ask Davy consistency — high-level implementation plan

Status: implemented against main at 1670527 following explicit user authorization. Commit and publication to main were separately authorized; see Git history for publication status. See the detailed plan's delivery record for verification and bounded limitations.

Goal: one consistent Ask Davy experience across Ship Overview, Shore Overview, Mission Overview, and Davy's Dominoes, while preserving each screen's specialized context.

Detailed code comparison and implementation design: [ASK_DAVY_CONSISTENCY_IMPLEMENTATION_PLAN.md](docs/ASK_DAVY_CONSISTENCY_IMPLEMENTATION_PLAN.md). That document records findings against main at a2d8133; revalidate them against newer code before implementation.

## 1. Unify LLM configuration and status

- Use the same assistant live-generation policy and existing server-side endpoint/credentials across all views.
- Preserve offline demo behavior and keep ingestion policy separate.
- Distinguish Live LLM, Cached LLM, and Deterministic fallback accurately.
- Remove the misleading static AI badge.
- Share provider compatibility and sanitized error handling.

Result: no unexpected Mission-only configuration mismatch causing fallback while other assistants are live.

## 2. Use the same grounded answer format

- Adapt mission forecasts, gate results, graph context, and eligible source records to typed supports.
- Let the LLM write useful explanations, with exact numerical values rendered by the backend.
- Add inline citations beside supported statements.
- Open source records, forecast assessments, or available calculation details from citations.

Result: conversational explanations with inspectable evidence, not just generic calculated warnings.

## 3. Share chat interface and conversation lifecycle

- Reuse the Ship/Shore chat foundation across all views.
- Standardize Ask Davy branding, collapsed floating launcher, transcript, composer, loading states, citation viewer, and new-conversation behavior.
- Provide consistent follow-up context and session-only restoration.
- Reject stale context after unit, mission, node, exercise, or loaded-source changes.
- Preserve session ownership, bounded storage, cancellation guards, and existing local-access protections.

Result: one product experience without dashboard layout changes.

## 4. Preserve screen-specific capabilities

- Mission: selected mission scope, forecast summaries, emerging concerns, and warning explanations.
- Dominoes: selected-node explanations, dependency tracing, and tentative graph suggestions.
- Preserve explicit Mission-to-Dominoes handoff without overwriting independent conversations.
- Keep tentative proposals separate from modeled facts and readiness calculations.
- Review/dismiss actions remain local UI state, never operational approval or engine updates.

Result: shared foundations with context-specific capabilities, not identical answers everywhere.

## 5. Extend local semantic search

- Reuse the bundled local MiniLM worker for Mission/Dominoes evidence.
- Search only eligible, time-filtered, redacted records.
- Preserve exact identifier matching and mission relevance.
- Automatically fall back to standard search if local embeddings fail.

Result: better retrieval without extra user setup or runtime remote model downloads.

## 6. Test and consolidate

- Test actual mocked provider calls, cached responses, offline behavior, and provider failures.
- Verify citations, backend numerical authority, follow-ups, restoration, ownership, and stale-state handling.
- Test graph tracing and prove that chat/review actions do not modify readiness, source data, or the modeled graph.
- Verify keyboard, mobile, theme, classification-banner clearance, and print behavior.
- Run backend/browser suites, frontend typecheck, and production build.
- Remove duplicate code only after parity; update setup documentation without overwriting the user's .env.

## Delivery order

Configuration/status → grounded Mission answers → shared chat/session foundation → Dominoes integration → semantic search → regression testing and cleanup.

## Scope boundaries

Updated: assistant configuration, generation contracts, Mission/graph context adapters, shared chat components, conversation handling, retrieval, tests, and documentation.

Unchanged: dashboard layouts, forecast engine mathematics, loaded-data authority, existing operational workflows, and read-only restrictions.

Implementation and subsequent publication to main were explicitly authorized after this plan was saved. No application deployment, credential change, or live provider request was performed during implementation. Verification: 197 backend tests and 26 isolated browser tests passed; frontend typecheck and production build passed.
