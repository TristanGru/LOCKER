"""FastAPI app. One shared scenario per server (R8): every write carries base_version; stale -> 409.

    uvicorn missiontwin.api:app --port 8000          (1 worker; the built frontend is served at /)
"""
from __future__ import annotations

import os
import copy
import json
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import BANNER
from .brief import build_brief
from .domain import (DATA_DIR, DEFAULT_PARAMS, EDITABLE_NUMERIC, ROOT, SCENARIO_NOW, SHIP_IDS, SHIPS, SYSTEMS, WATCHSTATIONS,
                     COMPONENT_TO_SYSTEM, format_dtg, iso, local_label)
from .engine import CACHE_STATS, Scenario, build_world, domino_graph, forecast, pval
from .fixes import rank_fixes
from .ingest import find_contradictions, load_baseline, read_pdf_pages
from .llm import LLMClient, llm_brief, nl_to_action
from .models import ACTION_TYPES, ActionAdapter, BriefBody, ChangeBody, FixDecisionBody, ParseBody, VersionBody, RefreshBody, CaptainPreviewBody, action_schema
from .visualization import registry
from .normalize import NORMALIZED_ROOT, REFERENCE_ROOT, normalize
from .sources import load_snapshot, source_health, utc_now
from .overview import OverviewRequest, packet as overview_packet, answer as overview_answer, projection as overview_projection


class AppState:
    def __init__(self, data_dir: Path | None = None, log_path: Path | None = None, client: LLMClient | None = None):
        self.lock = threading.RLock()
        self.data_dir = Path(data_dir or os.environ.get('MISSIONTWIN_DATA', DATA_DIR)).resolve()
        self.adapter = os.environ.get('MISSIONTWIN_ADAPTER', 'directory')
        self.client = client or LLMClient()
        self.baseline = load_snapshot(self.data_dir, self.adapter, self.client)
        self.last_success = utc_now()
        self.last_attempt = {'at': self.last_success, 'status': 'loaded'}
        self.scenario = Scenario(self.baseline, log_path=log_path)
        self.rankings: dict = {}
        self.initial_forecast = None

    def sources(self):
        result = source_health(self.baseline, self.data_dir, self.adapter, self.last_success, self.last_attempt)
        stale = self.view().stale_files(pval(self.scenario.params(), 'staleness_threshold_days'))
        for source in result['sources']:
            if source['status'] in ('loaded', 'stale'):
                source['status'] = 'stale' if source['file'] in stale else 'loaded'
        return result

    def commit(self, kind, payload):
        """Validate and evaluate a disposable fork before shared version/log changes."""
        candidate = self.scenario.fork()
        candidate.apply(kind, payload)
        forecast(build_world(candidate))
        return self.scenario.apply(kind, payload)

    def refresh_sources(self, reset_scenario=False):
        attempt = {'at': utc_now(), 'status': 'failed'}
        self.last_attempt = attempt
        candidate = None
        try:
            client = copy.copy(self.client)
            candidate = load_snapshot(self.data_dir, self.adapter, client)
            if candidate.configuration_errors:
                raise ValueError('; '.join(candidate.configuration_errors))
            gaps = [reason for reasons in candidate.coverage().values() for reason in reasons]
            if gaps:
                raise ValueError('Required evidence failed validation: ' + '; '.join(gaps[:8]))
            if candidate.source_revision == self.baseline.source_revision:
                attempt['status'] = 'unchanged'
                self.last_success = attempt['at']
                return {'changed': False, 'version': self.scenario.version, 'source_revision': self.baseline.source_revision}
            if not reset_scenario and any(c['kind'] != 'play_event' for c in self.scenario.changes):
                raise ValueError('Active what-if/decision overlays exist. Undo/reset them or explicitly confirm refresh with scenario reset.')
            replacement = Scenario(candidate, log_path=self.scenario.log_path, persist=False)
            if not reset_scenario:
                old_feed = {e['event_id']: e['known_at'] for e in self.baseline.feed.get('events', [])}
                new_feed = {e['event_id']: e['known_at'] for e in candidate.feed.get('events', [])}
                for event_id in self.scenario.played():
                    if old_feed[event_id] != new_feed.get(event_id):
                        raise ValueError('Played event timing changed. Refresh with explicit scenario reset.')
                    replacement.apply('play_event', {'event_id': event_id})
            forecast(build_world(replacement))
            replacement.version = self.scenario.version + 1
            replacement.persist = self.scenario.persist
            previous = self.baseline
            self.baseline, self.scenario, self.client = candidate, replacement, client
            candidate = None
            self.rankings.clear()
            self.initial_forecast = None
            self.last_success = attempt['at']
            attempt['status'] = 'loaded'
            self.scenario._log({'op': 'source_refresh', 'source_revision': self.baseline.source_revision,
                                'previous_revision': previous.source_revision, 'reset_scenario': reset_scenario})
            if previous.snapshot_owner: previous.snapshot_owner.cleanup()
            return {'changed': True, 'version': self.scenario.version, 'source_revision': self.baseline.source_revision}
        except (ValueError, OSError, KeyError, TypeError) as error:
            attempt['error'] = str(error)
            raise HTTPException(422, {'error': str(error), 'retained_source_revision': self.baseline.source_revision})
        finally:
            if candidate is not None and candidate.snapshot_owner: candidate.snapshot_owner.cleanup()

    def world(self):
        if self.baseline.configuration_errors:
            raise HTTPException(422, {"configuration_errors": self.baseline.configuration_errors})
        return build_world(self.scenario)

    def fc(self, detail=True):
        return forecast(self.world(), detail=detail)

    def view(self):
        return self.baseline.view(self.scenario.cursor_dt())

    def ranking(self, ship: str) -> dict:
        key = (self.scenario.digest(), ship)
        if key not in self.rankings:
            self.rankings = {k: v for k, v in self.rankings.items() if k[0] == key[0]}
            self.rankings[key] = rank_fixes(self.scenario, ship)
        return self.rankings[key]

    def check_version(self, v: int):
        if v != self.scenario.version:
            raise HTTPException(status_code=409, detail={"error": "scenario changed, refresh", "version": self.scenario.version})

    def validate_action(self, action: dict):
        ship = action.get("ship_id")
        if ship and ship not in self.baseline.profile.ships:
            raise HTTPException(422, "Unknown ship")
        kind = action["type"]
        if kind == "remove_person":
            if not any(row["member_id"] == action["member_id"] for row in self.baseline.r(ship, "roster.csv")):
                raise HTTPException(422, "Unknown member for selected ship")
            if action.get("until_time") and action["until_time"] <= action["from_time"]:
                raise HTTPException(422, "Return must follow absence start")
        elif kind == "delay_part" and not any(row["doc_number"] == action["doc_number"] for row in self.view().rows(ship, "requisition_status.csv")):
            raise HTTPException(422, "Requisition is not known for this ship at the scenario cursor")
        elif kind == 'add_casrep' and action['eic'] not in self.baseline.profile.eics_for(ship):
            raise HTTPException(422, "Unknown equipment identity for this unit")
        elif kind == "shift_mission" and not any(event["event_id"] == action["event_id"] for event in self.baseline.events):
            raise HTTPException(422, "Unknown event identity")


def reference_report(root: Path | None = None) -> dict | None:
    """The review-only import report for the reference package, without its quarantine detail.

    data/normalized is derived output and gitignored, so a fresh checkout (CI, a new clone) has none. It is
    built once from the checked-in reference package (deterministic, well under a second) instead of the
    profile silently showing no review information. None if the reference package cannot be normalized.
    """
    root = root or NORMALIZED_ROOT
    path = root / "import_report.json"
    if not path.exists():
        try:
            normalize(output=root)
        except (OSError, ValueError, KeyError):
            return None
    report = json.loads(path.read_text(encoding="utf-8"))
    return {key: value for key, value in report.items() if key != "quarantine"}


def create_app(state: AppState | None = None) -> FastAPI:
    app = FastAPI(title="MissionTwin", version="0.1.0", description=BANNER)
    holder = {"s": state}
    init_lock = threading.Lock()

    def S() -> AppState:
        if holder['s'] is None:
            with init_lock:
                if holder['s'] is None:
                    holder['s'] = AppState()
        return holder['s']

    app.state.get = S

    from urllib.parse import urlsplit
    overview_slots = threading.BoundedSemaphore(2)

    @app.get('/api/overview-assistant/status')
    def overview_status():
        s = S()
        return {'mode': 'live-capable' if s.client.configured else 'offline',
                'model': s.client.model, 'generation': 'verified_fact_selection_only',
                'embedding_model': 'Xenova/all-MiniLM-L6-v2', 'embedding_runtime': 'Transformers.js 3.8.1 / CPU WASM',
                'local_assets_bundled': (ROOT / 'web/dist/models/overview-manifest.json').is_file(),
                'vector_storage': 'browser_memory', 'fallback': 'structured_and_lexical'}

    @app.get('/api/overview-assistant/evidence/{evidence_id}')
    def overview_evidence(evidence_id: str, unit_id: str, base_version: int,
                          source_revision: str, packet_id: str, focus: str | None = None,
                          status_filter: str = 'all'):
        s = S()
        body = OverviewRequest(unit_id=unit_id, base_version=base_version, source_revision=source_revision,
                               packet_id=packet_id, focus=focus, status_filter=status_filter)
        with s.lock:
            _ship(unit_id)
            s.check_version(base_version)
            if source_revision != s.baseline.source_revision:
                raise HTTPException(409, 'Source revision changed')
            data = overview_packet(s, body, s.fc(), registry(s.baseline.profile))
            if packet_id != data['packet_id']:
                raise HTTPException(409, 'Evidence context changed; regenerate')
            source = next((e for e in data['evidence'] if e['id'] == evidence_id), None)
            if source is None:
                raise HTTPException(404, 'Evidence is not in this eligible packet')
            return {'identity': data['identity'], 'evidence': source}

    @app.post('/api/overview-assistant/brief')
    def overview_brief(body: OverviewRequest, request: Request):
        if urlsplit('http://' + request.headers.get('host', '')).hostname not in {'127.0.0.1', 'localhost', '::1', 'testserver'}:
            raise HTTPException(403, 'Overview assistant is local-only')
        origin = request.headers.get('origin')
        if origin and urlsplit(origin).netloc != request.headers.get('host'):
            raise HTTPException(403, 'Same-origin requests only')
        s = S()
        with s.lock:
            _ship(body.unit_id)
            s.check_version(body.base_version)
            if body.source_revision != s.baseline.source_revision:
                raise HTTPException(409, 'Source revision changed')
            data = overview_packet(s, body, s.fc(), registry(s.baseline.profile))
            if body.packet_id and body.packet_id != data['packet_id']:
                raise HTTPException(409, 'Overview context changed; regenerate')
            client = copy.copy(s.client)
            client.sent_prompts = []  # Do not retain overview prompts on the shared client.
            from .llm import redact
            body = body.model_copy(update={'question': redact(body.question, body.unit_id, s.baseline.name_index)[0]})
        if overview_slots.acquire(blocking=False):
            try:
                explanation = overview_answer(client, data, body)
            finally:
                overview_slots.release()
        else:
            explanation = overview_answer(client, data, body.model_copy(update={'explain': False}))
            explanation['note'] = 'Model capacity busy; showing verified template facts.'
        with s.lock:
            if data['identity']['digest'] != s.scenario.digest() or data['identity']['version'] != s.scenario.version or data['identity']['source_revision'] != s.baseline.source_revision:
                raise HTTPException(409, 'Overview changed during generation; regenerate')
        return {**data, 'answer': explanation}

    def _ship(ship_id):
        if ship_id not in S().baseline.profile.ships:
            raise HTTPException(422, 'Unknown ship identity')

    @app.exception_handler(ValueError)
    async def validation_error(request, error):
        return JSONResponse(status_code=422, content={'detail': str(error)})

    @app.get('/api/ready')
    def ready():
        s = S()
        with s.lock:
            errors, coverage = s.baseline.configuration_errors, s.baseline.coverage()
            ok = not errors and not any(coverage.values()) and s.last_attempt['status'] != 'failed'
            return JSONResponse(status_code=200 if ok else 503, content={'ok': ok, 'configuration_errors': errors,
                'coverage': coverage, 'source_revision': s.baseline.source_revision, 'last_attempt': s.last_attempt})

    @app.get('/api/sources')
    def sources():
        s = S()
        with s.lock: return s.sources()

    @app.post('/api/sources/refresh')
    def refresh_sources(body: RefreshBody):
        s = S()
        with s.lock:
            s.check_version(body.base_version)
            return s.refresh_sources(body.reset_scenario)

    # ------------------------------------------------------------ read
    @app.get("/api/health")
    def health():
        return {"ok": True, "banner": BANNER}

    @app.get("/api/scenario/version")
    def version():
        s = S()
        with s.lock:
            return {'version': s.scenario.version, 'cursor': iso(s.scenario.cursor_dt()), 'source_revision': s.baseline.source_revision,
                    'source_health_at': s.last_attempt['at']}

    @app.get("/api/state")
    def state_():
        s = S()
        with s.lock:
            sc = s.scenario
            played = set(sc.played())
            cur = sc.cursor_dt()
            feed = [{"event_id": e["event_id"], "title": e["title"], "kind": e["kind"], "ship_id": e["ship_id"], "known_at": iso(e["known_at"]),
                     "known_dtg": format_dtg(e["known_at"]), "refs": e["refs"], "played": e["event_id"] in played} for e in s.baseline.feed.get("events", [])]
            nxt = sc.next_event()
            return {"banner": BANNER, "version": sc.version, "scenario_now": iso(s.baseline.profile.now), "cursor": iso(cur),
                    "cursor_dtg": format_dtg(cur), "cursor_local": local_label(cur), "seed": pval(sc.params(), "seed"),
                    "runs": pval(sc.params(), "runs"), "ships": [{"ship_id": k, **v} for k, v in s.baseline.profile.ships.items()], "feed": feed,
                    "next_event": nxt["event_id"] if nxt else None, "llm": s.client.status(),
                    "extraction_methods": s.baseline.extraction_methods, "ingest_issues": len(s.baseline.issues),
                    "changes": len(sc.changes), "cache": CACHE_STATS,
                    "systems": {k: {"name": v["name"], "critical": v["critical"]} for k, v in s.baseline.profile.systems.items()},
                    'source_revision': s.baseline.source_revision, 'watchstations': s.baseline.profile.watchstations,
                    'berths': _berths(s.baseline, cur)}

    @app.get("/api/forecast")
    def get_forecast():
        s = S()
        with s.lock:
            return {**s.fc(), 'version': s.scenario.version, 'source_revision': s.baseline.source_revision}

    @app.get("/api/dashboard")
    def dashboard():
        state = S()
        with state.lock:
            if state.baseline.configuration_errors:
                raise HTTPException(422, {"configuration_errors": state.baseline.configuration_errors})
            if state.initial_forecast is None:
                state.initial_forecast = forecast(build_world(Scenario(state.baseline, persist=False)))
            fc = get_forecast()
            visual = registry(state.baseline.profile)
            return {"overview": {unit: overview_projection(fc, visual, unit) for unit in state.baseline.profile.ships},
                    "state": state_(), "forecast": fc,
                    "baseline": state.initial_forecast, "issues": issues(),
                    "assumptions": assumptions(), "log": log(), "visualization": registry(state.baseline.profile), 'sources': state.sources()}

    @app.get("/api/visualization")
    def visualization():
        return registry(S().baseline.profile)

    @app.get("/api/data-contract")
    def data_contract():
        report = reference_report()
        return {'active_profile': S().baseline.profile.name, 'active_path': str(S().data_dir),
                "reference": report, "catalog": S().baseline.catalog}

    @app.post("/api/preview")
    def preview(body: ChangeBody):
        state = S()
        with state.lock:
            state.check_version(body.base_version)
            scenario = state.scenario.fork()
            before = state.fc()
            if body.action is not None:
                state.validate_action(body.action.model_dump(mode="json"))
        if body.kind == "action" and body.action is not None:
            action = body.action.model_dump(mode="json")
            if action["type"] == "apply_fix":
                raise HTTPException(422, "Use the ranked fix comparison to preview a fix package")
            if action.get('ship_id') and action['ship_id'] not in state.baseline.profile.ships:
                raise HTTPException(422, "Unknown ship")
            scenario.apply("action", action, actor="preview")
        elif body.kind == "set_assumption" and body.key in EDITABLE_NUMERIC:
            low, high = EDITABLE_NUMERIC[body.key]
            try:
                value = float(body.value)
            except (TypeError, ValueError):
                raise HTTPException(422, "Numeric assumption required")
            if not low <= value <= high:
                raise HTTPException(422, "Assumption outside allowed range")
            scenario.apply("set_assumption", {"key": body.key, "value": value}, actor="preview")
        else:
            raise HTTPException(422, "Preview supports an action or editable assumption")
        try:
            after = forecast(build_world(scenario))
        except (KeyError, ValueError) as error:
            raise HTTPException(422, f"Invalid proposal: {error}")
        return {"base_version": body.base_version, "before": before, "after": after,
                "persisted": False, "proposal": body.model_dump(mode="json")}

    @app.post('/api/captain/preview')
    def captain_preview(body: CaptainPreviewBody):
        from datetime import timedelta
        s = S()
        with s.lock:
            s.check_version(body.base_version)
            _ship(body.ship_id)
            candidate = s.scenario.fork()
            before = s.fc()
            for change in body.changes:
                kind, node = change.get('kind'), str(change.get('node', ''))
                world = build_world(candidate)
                action = {'ship_id': body.ship_id}
                if kind == 'shiftMission':
                    event_id = change.get('mission')
                    if not any(m.event_id == event_id for m in world.ships[body.ship_id].missions):
                        raise HTTPException(422, 'Event is not assigned to the selected ship')
                    action = {'type': 'shift_mission', 'event_id': event_id, 'days': change.get('days')}
                elif kind == 'removePerson':
                    action.update(type='remove_person', member_id=node.split('member:')[-1], from_time=iso(candidate.cursor_dt()))
                elif kind == 'delayPart':
                    item = next((i for i in world.ships[body.ship_id].items if node.endswith('|' + i.key) and i.doc_number), None)
                    if item is None: raise HTTPException(422, 'This node has no linked active requisition to delay')
                    try: days = float(change['hours']) / 24
                    except (KeyError, TypeError, ValueError): raise HTTPException(422, 'A numeric delay is required')
                    action.update(type='delay_part', doc_number=item.doc_number, days=days)
                elif kind == 'casrep':
                    category = change.get('category')
                    if category not in ('C2', 'C3', 'C4'): raise HTTPException(422, 'Only hypothetical C2/C3/C4 casualties are supported; source cancellations are read-only')
                    eic = node.split('|system:')[-1].split('|')[0].removeprefix('system:')
                    action.update(type='add_casrep', eic=eic, category=int(category[1:]), etr=iso(candidate.cursor_dt() + timedelta(days=7)))
                else:
                    raise HTTPException(422, 'Unsupported preview change')
                action = ActionAdapter.validate_python(action).model_dump(mode='json')
                s.validate_action(action)
                candidate.apply('action', action, actor='preview')
            after = forecast(build_world(candidate))
            return {'base_version': body.base_version, 'before': before, 'after': after, 'persisted': False}

    @app.get("/results")
    def results():
        s = S()
        with s.lock:
            return {**s.fc(), "version": s.scenario.version}

    @app.get("/api/graph/{ship_id}")
    def graph(ship_id: str, event_id: str | None = None):
        s = S()
        _ship(ship_id)
        with s.lock:
            return domino_graph(s.fc(), ship_id, event_id)

    @app.get("/api/facts")
    def facts(ship_id: str | None = None):
        s = S()
        with s.lock:
            v = s.view()
            confirmed = {c["payload"]["fact_id"]: c["payload"]["include"] for c in s.scenario.changes if c["kind"] == "confirm_fact"}
            w = s.world()
            out = []
            for f in v.facts_with_corroboration(ship_id):
                d = f.model_dump(mode="json")
                d["confirmed"] = confirmed.get(f.fact_id)
                d["feeds_engine"] = f.fact_id in w.facts_used
                out.append(d)
            return {"facts": out}

    @app.get("/api/issues")
    def issues():
        s = S()
        with s.lock:
            v = s.view()
            thr = pval(s.scenario.params(), "staleness_threshold_days")
            return {"ingest_issues": [i.model_dump() for i in s.baseline.issues],
                    "contradictions": [c.model_dump() for c in find_contradictions(v)],
                    "stale": v.stale_files(thr)}

    @app.get('/api/source')
    def source(file: str, loc: str = '', span: str = '', profile: str = 'canonical'):
        with S().lock:
            return source_body(file, loc, span, profile)

    def source_body(file, loc, span, profile):
        s = S()
        if profile not in {"canonical", "reference"}:
            raise HTTPException(422, "Unknown data profile")
        base = REFERENCE_ROOT.resolve() if profile == 'reference' else s.baseline.data_dir.resolve()
        if file.startswith("logs/"):
            return {"file": file, "kind": "note", "lines": ["What-if or approved fix recorded in the app's own activity log (not a source record)."], "highlight": None}
        p = (base / file).resolve()
        if base not in p.parents and p != base:
            raise HTTPException(400, "path outside data directory")
        if not p.exists() or p.is_dir():
            raise HTTPException(404, f"{file} not found")
        cat = next((c for c in s.baseline.catalog if file.startswith(c["file"].rstrip("/"))), None) if profile == "canonical" else None
        meta = {"real_system": cat["real_system"], "steward": cat["steward"], "as_of": cat["as_of"],
                "fielded_access_path": cat["fielded_access_path"], "spec": cat["spec"]} if cat else {}
        stale = s.view().stale_files(pval(s.scenario.params(), "staleness_threshold_days"))
        meta['stale'] = next((v for k, v in stale.items() if file.startswith(k.rstrip('/'))), None)
        if profile == 'canonical' and file.endswith('.csv') and p.with_suffix('.csv.json').is_file():
            meta['original_file'] = file + '.json'
            meta['adapter'] = s.adapter
        if profile == "reference":
            meta = {"real_system": "Reference exercise / NOT used by forecast", "steward": "Synthetic package", "as_of": "See record timestamp", "stale": None}
        if p.suffix == ".pdf":
            pages = read_pdf_pages(p)
            n = int(loc.split()[-1]) if loc.startswith("page") else 1
            if not 1 <= n <= len(pages):
                raise HTTPException(422, 'Page outside document')
            return {"file": file, "kind": "pdf", "page": n, "lines": pages[n - 1].splitlines(), "highlight_text": span, "meta": meta}
        lines = p.read_text(encoding="utf-8").splitlines()
        hl = None
        if loc.startswith(("row ", "line ")):
            hl = int(loc.split()[1])
        elif loc:
            hl = next((i + 1 for i, l in enumerate(lines) if loc in l), None)
        if p.suffix == ".csv":
            lo = max(3, (hl or 3) - 4)
            window = lines[:2] + lines[lo - 1:(hl or 3) + 4]
            first = [1, 2] + list(range(lo, lo + len(window) - 2))
            return {"file": file, "kind": "csv", "lines": window, "line_numbers": first, "highlight": hl, "meta": meta}
        if len(lines) > 80 and hl:
            lo = max(1, hl - 20)
            return {"file": file, "kind": "text", "lines": lines[lo - 1:hl + 20], "line_numbers": list(range(lo, min(len(lines), hl + 20) + 1)),
                    "highlight": hl, "meta": meta}
        return {"file": file, "kind": "text", "lines": lines[:400], "line_numbers": list(range(1, min(len(lines), 400) + 1)),
                "highlight": hl, "highlight_text": span, "meta": meta}

    @app.get("/api/assumptions")
    def assumptions():
        s = S()
        p = s.scenario.params()
        rows = []
        for k, v in p.items():
            if not isinstance(v, dict) or "value" not in v:
                continue
            rows.append({"key": k, "value": v["value"], "tag": v.get("tag"), "source": v.get("source"), "edited": bool(v.get("edited")),
                         "default": DEFAULT_PARAMS.get(k, {}).get("value")})
        editable = []
        for path, (lo, hi) in EDITABLE_NUMERIC.items():
            editable.append({"path": path, "value": pval(p, path), "min": lo, "max": hi, "tag": p[path.split(".")[0]].get("tag"),
                             "source": p[path.split(".")[0]].get("source")})
        return {"rows": rows, "editable": editable}

    @app.get("/api/fixes/{ship_id}")
    def fixes(ship_id: str):
        s = S()
        _ship(ship_id)
        with s.lock:
            return s.ranking(ship_id)

    @app.get("/api/actions/schema")
    def schema():
        return {'types': ACTION_TYPES, 'schema': action_schema(), 'ships': S().baseline.profile.ship_ids,
                'eics': sorted(S().baseline.profile.all_eics)}

    @app.get("/api/log")
    def log():
        return {"changes": S().scenario.changes, "version": S().scenario.version}

    # ------------------------------------------------------------ write (versioned)
    @app.post("/api/events/play")
    def play(body: VersionBody):
        s = S()
        with s.lock:
            s.check_version(body.base_version)
            try:
                c = s.commit('play_event', {})
            except ValueError as e:
                raise HTTPException(400, str(e))
            return {"change": c, "version": s.scenario.version}

    @app.post("/api/changes")
    def change(body: ChangeBody):
        s = S()
        with s.lock:
            s.check_version(body.base_version)
            if body.kind == "action":
                if body.action is None:
                    raise HTTPException(422, "action required")
                a = body.action.model_dump(mode="json")
                s.validate_action(a)
                if a["type"] == "apply_fix":
                    return _decide(s, a["fix_id"], "approve", 0.0, "via plain-English action")
                c = s.commit('action', a)
            elif body.kind == "set_assumption":
                if body.key not in EDITABLE_NUMERIC:
                    raise HTTPException(422, f"{body.key} is not editable")
                lo, hi = EDITABLE_NUMERIC[body.key]
                try:
                    val = float(body.value)
                except (TypeError, ValueError):
                    raise HTTPException(422, "value must be a number")
                if not lo <= val <= hi:
                    raise HTTPException(422, f"value out of range [{lo}, {hi}]")
                c = s.commit('set_assumption', {'key': body.key, 'value': val})
            elif body.kind == "confirm_fact":
                fact = next((f for f in s.view().facts_with_corroboration() if f.fact_id == body.fact_id), None)
                if fact is None:
                    raise HTTPException(422, "Fact is not known at this scenario cursor")
                if body.include is None:
                    raise HTTPException(422, 'include must be explicitly true or false')
                if body.include and fact.status == "NEEDS_REVIEW":
                    raise HTTPException(422, "invalid evidence must be corrected before confirmation")
                c = s.commit('confirm_fact', {'fact_id': body.fact_id, 'include': body.include})
            elif body.kind == 'play_event':
                c = s.commit('play_event', {"event_id": body.event_id} if body.event_id else {})
            return {"change": c, "version": s.scenario.version}

    @app.post("/scenario")
    def scenario(body: ChangeBody):
        s = S()
        with s.lock:
            applied = change(body)
            return {**applied, "results": {**s.fc(), "version": s.scenario.version}}

    def _decide(s: AppState, fix_id: str, decision: str, delay: float, note: str):
        fix = None
        for ship in s.baseline.profile.ship_ids:
            r = s.rankings.get((s.scenario.digest(), ship))
            if r:
                fix = next((c for c in r["candidates"] if c["fix_id"] == fix_id), None)
                if fix:
                    break
        if fix is None:
            for ship in s.baseline.profile.ship_ids:
                fix = next((c for c in s.ranking(ship)["candidates"] if c["fix_id"] == fix_id), None)
                if fix:
                    break
        if fix is None:
            raise HTTPException(404, f"fix {fix_id} not in the current ranking; refresh")
        payload = {"decision": decision, "approval_delay_days": delay, "note": note,
                   "fix": {"fix_id": fix["fix_id"], "title": fix["title"], "steps": fix["steps"]},
                   "expected": {m["event_id"]: m["p_after"] for m in fix["missions"]}}
        c = s.commit('fix_decision', payload)
        return {"change": c, "version": s.scenario.version}

    @app.post("/api/fixes/decide")
    def decide(body: FixDecisionBody):
        s = S()
        with s.lock:
            s.check_version(body.base_version)
            return _decide(s, body.fix_id, body.decision, body.approval_delay_days, body.note)

    @app.post("/api/undo")
    def undo(body: VersionBody):
        s = S()
        with s.lock:
            s.check_version(body.base_version)
            c = s.scenario.undo()
            return {"undone": c, "version": s.scenario.version}

    @app.post("/api/reset")
    def reset(body: VersionBody):
        s = S()
        with s.lock:
            s.check_version(body.base_version)
            s.scenario.reset()
            return {"version": s.scenario.version}

    @app.post("/api/actions/parse")
    def parse(body: ParseBody):
        s = S()
        _ship(body.ship_id)
        with s.lock:
            fc = s.fc(detail=False)
            # Names let a request such as "shift SEASHIELD two days" resolve to an event id.
            ctx = {"ship_id": body.ship_id, "scenario_now": fc["cursor"],
                   "events": [{"event_id": m["event_id"], "codename": m.get("codename", ""), "label": m["label"], "name": m["name"]}
                              for m in fc["missions"]],
                   "ships": s.baseline.profile.ship_ids, "open_requisitions": [it.doc_number for it in s.world().ships[body.ship_id].items if it.doc_number]}
            act, src, badge = nl_to_action(s.client, body.text, ctx)
            return {"action": ActionAdapter.dump_python(act, mode="json") if act is not None else None, "source": src, "badge": badge,
                    "fallback": act is None, "note": "Proposed only. Confirm to run it." if act is not None else "Use the action picker."}

    @app.post("/api/brief")
    def brief(body: BriefBody):
        s = S()
        _ship(body.ship_id)
        with s.lock:
            fc = s.fc()
            v = s.view()
            thr = pval(s.scenario.params(), "staleness_threshold_days")
            cons = [c.model_dump() for c in find_contradictions(v)]
            decisions = [c for c in s.scenario.changes if c["kind"] == "fix_decision"]
            b = build_brief(fc, body.ship_id, s.ranking(body.ship_id), cons, v.stale_files(thr), decisions)
            text, src, badge = llm_brief(s.client, b["context"], b["text"], len(b["citations"]), s.scenario.digest())
            return {"text": text, "citations": b["citations"], "source": src, "badge": badge, "banner": BANNER}

    # ------------------------------------------------------------ static frontend
    dist = ROOT / "web" / "dist"
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}")
        def spa(path: str):
            f = dist / path
            if path and dist.resolve() in f.resolve().parents and f.exists() and f.is_file():
                return FileResponse(f)
            return FileResponse(dist / "index.html")

    return app


def _berths(baseline, cursor) -> list[dict]:
    """Where each ship is on the scenario date, from ship_positions.csv. Context for the shore view only."""
    out = []
    for row in baseline.view(cursor).squadron('ship_positions.csv'):
        if row['date'] == cursor.date() and row['ship_id'] in baseline.profile.ships:
            out.append({'ship_id': row['ship_id'], 'name': baseline.profile.ships[row['ship_id']]['name'],
                        'in_port': row['status'] == 'INPORT', 'pier': row['pier']})
    return out


def _ship(ship_id: str):
    if ship_id not in SHIPS:
        raise HTTPException(404, f"unknown ship {ship_id}")


app = create_app()
