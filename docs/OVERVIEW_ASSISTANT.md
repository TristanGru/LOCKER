# Ship and Shore Overview assistant

The overview pages include a floating **Ask LOCKER** button in the lower-right corner. It opens a non-modal **Command brief** side panel backed by the same accepted dataset and status projection as the overview cards. The assistant starts collapsed, takes no dashboard layout space, and loads data only when opened. Close/minimize it or press Escape to return focus to the launcher; closing also stops its embedding worker. It is read-only and marked as a synthetic exercise.

## Use

1. Open Ship Overview or Shore Overview, select a unit, and click **Ask LOCKER**.
2. Read the verified system counts and attention items. Unknown and At-risk systems are ordered before healthy ones.
3. Select a system/capability focus or apply an overview status filter.
4. Expand **Loaded sources** for exact permitted recorded fields, file/row references and effective times. These fields are not predictions.
5. Ask about status, loaded work/requisition records, record counts or existing dependencies.
6. Optionally enable **local MiniLM semantic search** to rank relevant source records by meaning.

The panel regenerates when unit, focus, filter, source or scenario context changes. A stale request is rejected instead of mixing revisions. Refresh the brief if a question reports that its context changed. Evidence is delivered inline in the captured packet and can also be resolved through `/api/overview-assistant/evidence/{id}` with the packet's unit/context/version/revision parameters. `/api/overview-assistant/status` reports safe mode and local-model capability metadata. Neither endpoint is an unrestricted raw-file browser.

## Local embedding setup

With frontend dependencies installed, run once on a connected machine:

```powershell
cd web
npm ci
cd ..
.\.venv\Scripts\python.exe scripts/bundle_overview_embeddings.py
npm --prefix web run build
```

The script downloads **`Xenova/all-MiniLM-L6-v2`**, pinned to revision `751bff37182d3f1213fa05d7196b954e230abad9`, with the quantized ONNX model and tokenizer files. It copies matching WASM assets from **Transformers.js 3.8.1**. A manifest records artifact SHA-256 hashes and configuration.

Generated assets live in `web/public/models/` and `web/public/wasm/`, are copied into `web/dist/` by Vite, and are ignored by Git. For an air-gapped machine, copy these generated directories from a trusted connected build before building, or transfer the complete built `web/dist`. Do not assume a fresh checkout already contains model weights. Retain the upstream model/runtime licenses with any redistributed bundle; the model card is at https://huggingface.co/Xenova/all-MiniLM-L6-v2.

Runtime inference runs in a browser Web Worker through Transformers.js, using **CPU/WASM**, 384-dimensional vectors, mean pooling and normalization. Remote-model downloads are disabled. No WebGPU is enabled in this release. Vectors are packet-scoped in browser memory, unloaded after five idle minutes; there is **no persistent LanceDB index or browser-to-server vector upload**. The server accepts only eligible evidence IDs as semantic ranking hints, never client-provided numerical facts.

The first semantic question loads the local model; expect a cold-start delay. The worker has a timeout and record/context bounds. If assets are absent, inference fails, the corpus is too large, or the browser cannot run the worker, the panel falls back to exact/lexical retrieval. Semantic retrieval ranks a bounded subset (up to 300 records), not an entire-population numerical query.

The transitive Node-only `sharp` dependency is overridden to `0.35.5` to avoid the audited older-libvips advisories; this application uses the browser text feature-extraction path, not Node image processing. Existing React Router moderate audit findings remain outside this change.

## LLM configuration

The embedding model and generation endpoint are separate. MiniLM runs locally; optional generation uses the backend's existing OpenAI-compatible service.

Create `.env` from `.env.example` only if `.env` does not already exist. Set `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` and `MISSIONTWIN_DEMO_MODE=0`. Never commit actual values or use a `VITE_*` secret. The backend reads the key; the browser does not. `.env` is ignored by Git, but OneDrive may still sync it—use a non-synced checkout for strict local-only storage.

The `missiontwin.demo` launcher intentionally remains offline. To allow live model calls, build the frontend and run the direct API on an available loopback port:

```powershell
.\.venv\Scripts\python.exe -m uvicorn missiontwin.api:app --host 127.0.0.1 --port 8011
```

Live mode can also activate existing document extraction. Use approved synthetic data and an approved endpoint. Local key storage does not make cloud requests local.

In this initial release the LLM **selects and orders verified fact/evidence IDs**, rather than generating unrestricted prose or numbers. This intentionally prevents invented metrics and unsupported causal statements. Invalid output, unavailable service or oversized context returns template facts. No live endpoint quality claim is made by the mock tests.

## Numerical and evidence boundary

- Status and count calculations come from the shared backend projection, not embeddings or the LLM.
- Recorded CSV values are hydrated from exercise-time visible typed rows.
- Requisition histories are resolved at the current exercise cursor; raw future history strings are never returned.
- Supported evidence tables: work (`csmp`), requisitions, training, certifications, onboard allowance and hazard model. Fields are explicitly allowlisted; the panel does not expose whole files or roster names.
- A loaded row is not necessarily a modeled blocker. Where no supported row links to a modeled system assessment, the brief explicitly discloses that gap.
- Whole-unit counts differ from filtered/focused counts. Table row counts cover the complete eligible rows after focus linkage, not top-k semantic matches. They are **not** counts of only open jobs, transfer-eligible stock or expired qualifications.
- Ready-system share is not mission success probability. Material samples and event-interval gates retain distinct labels.
- Current scenario overlays influence modeled status, while recorded source values remain unchanged.

## Current limitations / remaining plan work

This is the first bounded overview implementation, not completion of every roadmap item. It does not provide arbitrary joins/sums/date-range queries, qualification searches, narrative/PDF RAG, free-form generated explanations, persistent vector indexes, full calculation-input lineage for every gate, durable chat, or operational authentication. Source gaps and unsupported requests are disclosed rather than guessed. It does not apply actions, rank fixes or run what-if simulations.

The overview POST rejects cross-origin browser requests and validates unit/focus/version/revision/packet identity. Broader host/session/CSRF hardening and access controls remain required before any nonlocal or operational deployment. Do not expose the demo to an untrusted network.

## Verification

Local verification on Windows/Edge: **146 backend tests passed**, frontend typecheck/build passed, and the isolated acceptance runner passed **15 browser tests**, including real MiniLM/WASM inference with no external HTTP requests. The CI workflow now explicitly bundles model assets before browser acceptance; hosted CI and a live generation endpoint have not been verified in this change.


```powershell
.\.venv\Scripts\python.exe -m pytest -q
npm --prefix web run typecheck
npm --prefix web run build
```

`web/tests/overview-assistant.spec.ts` tests ship/shore source cards, refusal of actions and actual local MiniLM inference. Run it against an owned isolated server using `LOCKER_URL`; it does not reset the server's exercise. The semantic test requires the bundled assets and a supported browser. It monitors requests to verify that inference makes no external HTTP requests.
