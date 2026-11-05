# Ship and Shore Overview chat

Ask Davy now generates **natural-language summaries with inline citations** and supports bounded follow-up conversations. It remains read-only synthetic decision support, not an operational readiness authority.

Implementation/design reference: [conversational summaries and citations plan](OVERVIEW_CHAT_CITATIONS_PLAN.md).

## Using the assistant

1. Open Ship Overview or Shore Overview and select the unit.
2. Click the floating **Ask Davy** button. It stays collapsed by default and takes no dashboard layout space.
3. Choose **Summarize this ship/installation**, or enter your own question. Opening the panel does not automatically incur a generation request.
4. Read the concise bottom line, explanation, dependencies and uncertainty sections.
5. Click an inline citation such as **[1]**. The source view identifies the recorded fields, model assessment or calculation, source revision and exercise time.
6. Use **Back to conversation** and ask a follow-up. Enter sends; Shift+Enter inserts a line.

The panel supports system/capability focus and explicit status filters. **New conversation** clears the active context. Closing/minimizing or pressing Escape returns focus to the launcher and stops the embedding worker. Reopening restores the session, including historical citations. Cancel stops response display; a request already sent to the server may finish and be restored later.

A changed source/scenario marks the conversation historical. Start a new conversation before asking about current state. Historical citation evidence is retained with its message; it is never silently replaced with newer source contents.

## What the LLM can do

- Summarize the selected overview in plain language rather than selecting prewritten fact strings.
- Explain currently modeled statuses using available input explanations and recorded evidence.
- Answer supported record/count/dependency questions and conversational follow-ups.
- Identify missing, assumed, stale or partial evidence and ask for clarification.

There is no general-purpose tool loop or mutation capability. Chat cannot approve fixes, edit sources, run simulations or issue operational orders. Unsupported questions should receive limitations or clarification, not fabricated data. Existing application workflows remain separate.

## Citations and numerical fidelity

Every factual generated sentence must cite server-issued support IDs. The application validates the structured response and adds the visible citation numbers. The model never chooses arbitrary file paths or citation URLs.

Evidence classes:

- **Reported/assumed source:** exercise-time visible, allowlisted CSV fields with original file/row locators and freshness metadata.
- **Modeled assessment:** an existing system/gate result, its metric basis and available input explanations/references.
- **Calculated result:** backend counts and queries with filters, units and contributing record identifiers.
- **Coverage:** explicitly disclosed evidence limitations.

Dates, numeric values, identifiers and exact status values use typed value segments inserted from the captured backend support. Generated connecting text cannot contain numeric literals or URLs. Unknown supports, field references, headings and malformed output are rejected. One bounded correction attempt is allowed before a visibly labeled cited deterministic fallback.

Source views expose values, calculation filters, assumptions, input locators and underlying retained records where available. **Lineage is explicitly partial for model assessments/dependencies**; a related row is not by itself proof of causality. Valid citation syntax does not prove the generated prose follows from its evidence. Human-reviewed factual/usefulness evaluation remains necessary, particularly for causal interpretation.

Ready-system share is a count-based overview metric, not mission success probability. Material-capability samples, event-interval gates, reported values and scenario overlays remain distinct. Regional hazards are model assumptions, not observed real installation failures. Mock installation labels remain in effect.

## Conversation storage and privacy

- Conversations are stored in server memory only: up to 32 sessions, 20 user/assistant exchanges each, a 30-minute idle expiry and a global memory budget.
- A browser session cookie (`HttpOnly`, `SameSite=Strict`) scopes conversation ownership. Only opaque conversation IDs are kept in browser session storage to restore the panel.
- Recent user/assistant turns supply conversational context, not additional evidence. Each answer retrieves eligible supports again and checks state before returning.
- Host/origin/fetch-site checks protect chat routes. This local prototype is not authenticated multi-user deployment.
- No raw chat/prompt logging is enabled by the chat service. Requests to a configured cloud model do transmit the selected redacted context; local key storage does not make that traffic local.
- Restart loses in-memory conversations. Deleted/expired sessions are not recreated under their old IDs.

## Generation endpoint and `.env`

Keep `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` and `MISSIONTWIN_DEMO_MODE=0` in repository-root local `.env`. Do not overwrite an existing configuration, use `VITE_*` secrets, commit keys or paste them into chat. `.env` is Git-ignored; OneDrive may still sync it, so use a non-synced checkout for strict local-only secret storage.

The Python backend alone contacts the provider. The client supports explicit provider adaptations from `max_tokens` to `max_completion_tokens`, and omits temperature when the model requires its default. It does not drop output validation.

Build the frontend, then use the direct API launcher for live generation:

```powershell
npm --prefix web run build
.\.venv\Scripts\python.exe -m uvicorn missiontwin.api:app --host 127.0.0.1 --port 8000
```

The `missiontwin.demo` launcher intentionally forces offline behavior. Process environment overrides `.env`; restart the backend after configuration changes. Live mode can also enable existing document extraction. Use approved synthetic data and an approved endpoint.

Live, cached and template responses are visibly distinct. Safe fallback categories distinguish offline/context limits, invalid answers/citations, timeout, provider rejection/unavailability and privacy-guard failures. There is no token streaming: the answer is displayed only after validation.

## Local MiniLM / Transformers.js

Semantic retrieval is **enabled automatically by default** and uses **`Xenova/all-MiniLM-L6-v2`**, pinned revision `751bff37182d3f1213fa05d7196b954e230abad9`, through **Transformers.js 3.8.1** in a Web Worker. It uses quantized ONNX, CPU/WASM, 384-dimensional mean-pooled normalized vectors. Remote-model downloads are disabled at runtime.

For deployment/build maintainers (not everyday users), bundle assets once on a connected build machine. Distribute the resulting build with these assets so local semantic search works out of the box:

```powershell
cd web
npm ci
cd ..
.\.venv\Scripts\python.exe scripts/bundle_overview_embeddings.py
npm --prefix web run build
```

Generated model/runtime directories under `web/public/` are ignored by Git. The bundle script pins model revision, records hashes and copies runtime notices; retain applicable model/runtime licenses when redistributing. Copy the generated assets before an air-gapped build, or transfer the complete built `web/dist`.

Users do not need to enable or configure embeddings: asking a question automatically uses local semantic ranking alongside exact record matching. The technical toggle lives under **Advanced search settings**, not in the normal chat workflow. Missing assets, unsupported inference, worker timeout or an oversized corpus automatically fall back to standard record search without blocking the answer or asking the user to fix settings. After an inference failure, the current panel uses standard search until reopened or explicitly re-enabled, avoiding repeated failed loads. Vectors are packet-scoped browser memory only, unloaded after idle timeout or closing the panel. No LanceDB, persistent vector uploads or WebGPU are included.

Embeddings rank a bounded eligible-record subset, not a whole-table numerical population. All counts/values still come from backend queries or engine results. The Node-only `sharp` dependency is overridden to `0.35.5` to avoid older-libvips advisories; existing moderate React Router audit findings remain outside this change.

## API and implementation

- `POST /api/overview-assistant/conversations`: establish context and receive its packet.
- `GET /api/overview-assistant/conversations/{id}`: restore messages and report stale state.
- `POST /api/overview-assistant/conversations/{id}/messages`: answer a bounded question with validated prose/citations.
- `DELETE /api/overview-assistant/conversations/{id}`: clear that conversation.
- Existing overview brief/evidence/status endpoints remain compatible.

Main files: `missiontwin/overview_chat.py`, `missiontwin/overview.py`, `web/src/captain/components/overview-assistant/OverviewChat.tsx` and `OverviewAssistantPanel.tsx`.

## Verification

Local release checks after integrating `origin/main` at `4f39192`: **160 backend tests passed**, frontend typecheck/build passed, and **19 isolated browser tests passed**, including automatic local-search enablement, missing-model fallback, classification-banner spacing and print hiding. The latest main dashboard layout/styles/adapter are retained; the only edit to its existing Ship/Shore Overview screen is the Ask Davy import and mount. Opt-in live evaluation completed ship and shore summaries plus one follow-up each: all four returned `llm` responses with resolvable citation maps (roughly 14–31 seconds in that run). Model lineage was correctly labeled partial. One shore explanation was manually inspected for reported-versus-modeled qualifiers; this limited review is not a general factuality guarantee or operational certification. Hosted CI was not exercised locally.

Backend and browser tests cover schema/value/citation rejection, correction/fallback, read-only behavior, owner isolation, stale/expired conversations, bounded memory/busy requests, follow-up context, history restoration, source views, keyboard/mobile behavior and local MiniLM inference without external HTTP requests.

The backend regression suite isolates model environment variables automatically in `tests/conftest.py`, so a developer's live `.env` cannot accidentally turn ordinary tests into provider requests. Mock transport/configuration tests explicitly override those defaults as needed.

```powershell
.\.venv\Scripts\python.exe -m pytest -q
npm --prefix web run typecheck
.\.venv\Scripts\python.exe scripts/check_demo.py
```

`scripts/check_demo.py` owns temporary source copies, logs and its acceptance server; it does not reset an existing server on 8000.

Opt-in live smoke evaluation against an existing local server:

```powershell
.\.venv\Scripts\python.exe scripts/evaluate_overview_chat.py --allow-live
```

The evaluator creates/deletes its own conversations and reports method, citations, word count and latency only. It does not reset the exercise or print credentials/source excerpts. Structural success is not a substitute for factual support/usefulness review.

## Remaining limits

Arbitrary joins/sums/date-range queries, full PDF narrative RAG, durable review snapshots, persistent vector indexing and operational authentication remain outside this release. Free-form language can misinterpret evidence despite structural validation; review the cited source and model assumptions before relying on a conclusion. The interface must not be exposed to an untrusted network or loaded with operational/personnel data without a separate authorization and assurance effort.
