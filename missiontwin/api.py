"""FastAPI app. One shared scenario per server (R8): every write carries base_version; stale -> 409.

    uvicorn missiontwin.api:app --port 8000          (1 worker; the built frontend is served at /)
"""
from __future__ import annotations

import os
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
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
from .models import ACTION_TYPES, ActionAdapter, BriefBody, ChangeBody, FixDecisionBody, ParseBody, VersionBody, action_schema


class AppState:
    def __init__(self, data_dir: Path | None = None, log_path: Path | None = None, client: LLMClient | None = None):
        self.lock = threading.RLock()
        self.data_dir = Path(data_dir or os.environ.get("MISSIONTWIN_DATA", DATA_DIR))
        self.client = client or LLMClient()
        self.baseline = load_baseline(self.data_dir, self.client)
        self.scenario = Scenario(self.baseline, log_path=log_path)
        self.rankings: dict = {}

    def world(self):
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
        """Resolve model/user-supplied references before changing the scenario."""
        ship_id = action.get("ship_id")
        if ship_id is not None:
            _ship(ship_id)
        w = self.world()
        kind = action["type"]
        if kind == "remove_person":
            ids = {h.member_id for hs in w.ships[ship_id].holders.values() for h in hs}
            ids |= {r["member_id"] for r in self.view().rows(ship_id, "roster.csv")}
            if action["member_id"] not in ids:
                raise HTTPException(422, "member_id not found on this ship")
        elif kind == "delay_part":
            if action["doc_number"] not in {it.doc_number for it in w.ships[ship_id].items if it.doc_number}:
                raise HTTPException(422, "requisition not found among this ship's open jobs")
        elif kind == "add_casrep" and action["eic"] not in set(SYSTEMS) | set(COMPONENT_TO_SYSTEM):
            raise HTTPException(422, "eic not found in the mission tree")
        elif kind == "shift_mission":
            if not any(m.event_id == action["event_id"] for sw in w.ships.values() for m in sw.missions):
                raise HTTPException(422, "event_id not found")


def create_app(state: AppState | None = None) -> FastAPI:
    app = FastAPI(title="MissionTwin", version="0.1.0", description=BANNER)
    holder = {"s": state}
    init_lock = threading.Lock()

    def S() -> AppState:
        if holder["s"] is None:
            with init_lock:
                if holder["s"] is None:
                    holder["s"] = AppState()
        return holder["s"]

    app.state.get = S

    # ------------------------------------------------------------ read
    @app.get("/api/health")
    def health():
        return {"ok": True, "banner": BANNER}

    @app.get("/api/scenario/version")
    def version():
        s = S()
        return {"version": s.scenario.version, "cursor": iso(s.scenario.cursor_dt())}

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
            return {"banner": BANNER, "version": sc.version, "scenario_now": iso(SCENARIO_NOW), "cursor": iso(cur),
                    "cursor_dtg": format_dtg(cur), "cursor_local": local_label(cur), "seed": pval(sc.params(), "seed"),
                    "runs": pval(sc.params(), "runs"), "ships": [{"ship_id": k, **v} for k, v in SHIPS.items()], "feed": feed,
                    "next_event": nxt["event_id"] if nxt else None, "llm": s.client.status(),
                    "extraction_methods": s.baseline.extraction_methods, "ingest_issues": len(s.baseline.issues),
                    "changes": len(sc.changes), "cache": CACHE_STATS,
                    "systems": {k: {"name": v["name"], "critical": v["critical"]} for k, v in SYSTEMS.items()},
                    "watchstations": WATCHSTATIONS}

    @app.get("/api/forecast")
    def get_forecast():
        s = S()
        with s.lock:
            return s.fc()

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

    @app.get("/api/source")
    def source(file: str, loc: str = "", span: str = ""):
        s = S()
        base = s.data_dir.resolve()
        if file.startswith("logs/"):
            return {"file": file, "kind": "note", "lines": ["What-if or approved fix recorded in the app's own activity log (not a source record)."], "highlight": None}
        p = (base / file).resolve()
        if base not in p.parents and p != base:
            raise HTTPException(400, "path outside data directory")
        if not p.exists() or p.is_dir():
            raise HTTPException(404, f"{file} not found")
        cat = next((c for c in s.baseline.catalog if file.startswith(c["file"].rstrip("/"))), None)
        meta = {"real_system": cat["real_system"], "steward": cat["steward"], "as_of": cat["as_of"],
                "fielded_access_path": cat["fielded_access_path"], "spec": cat["spec"]} if cat else {}
        stale = s.view().stale_files(pval(s.scenario.params(), "staleness_threshold_days"))
        meta["stale"] = next((v for k, v in stale.items() if file.startswith(k.rstrip("/"))), None)
        if p.suffix == ".pdf":
            pages = read_pdf_pages(p)
            n = int(loc.split()[-1]) if loc.startswith("page") else 1
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
        return {"types": ACTION_TYPES, "schema": action_schema(), "ships": SHIP_IDS,
                "eics": sorted(set(SYSTEMS) | set(COMPONENT_TO_SYSTEM))}

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
                c = s.scenario.apply("play_event", {})
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
                c = s.scenario.apply("action", a)
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
                c = s.scenario.apply("set_assumption", {"key": body.key, "value": val})
            elif body.kind == "confirm_fact":
                fact = next((f for f in s.view().facts() if f.fact_id == body.fact_id), None)
                if fact is None:
                    raise HTTPException(422, "fact_id not found at the scenario time")
                if body.include and fact.status == "NEEDS_REVIEW":
                    raise HTTPException(422, "invalid evidence must be corrected before confirmation")
                c = s.scenario.apply("confirm_fact", {"fact_id": body.fact_id, "include": bool(body.include)})
            elif body.kind == "play_event":
                try:
                    c = s.scenario.apply("play_event", {"event_id": body.event_id} if body.event_id else {})
                except ValueError as e:
                    raise HTTPException(400, str(e))
            return {"change": c, "version": s.scenario.version}

    @app.post("/scenario")
    def scenario(body: ChangeBody):
        s = S()
        with s.lock:
            applied = change(body)
            return {**applied, "results": {**s.fc(), "version": s.scenario.version}}

    def _decide(s: AppState, fix_id: str, decision: str, delay: float, note: str):
        fix = None
        for ship in SHIP_IDS:
            r = s.rankings.get((s.scenario.digest(), ship))
            if r:
                fix = next((c for c in r["candidates"] if c["fix_id"] == fix_id), None)
                if fix:
                    break
        if fix is None:
            for ship in SHIP_IDS:
                fix = next((c for c in s.ranking(ship)["candidates"] if c["fix_id"] == fix_id), None)
                if fix:
                    break
        if fix is None:
            raise HTTPException(404, f"fix {fix_id} not in the current ranking; refresh")
        payload = {"decision": decision, "approval_delay_days": delay, "note": note,
                   "fix": {"fix_id": fix["fix_id"], "title": fix["title"], "steps": fix["steps"]},
                   "expected": {m["event_id"]: m["p_after"] for m in fix["missions"]}}
        c = s.scenario.apply("fix_decision", payload)
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
        with s.lock:
            fc = s.fc(detail=False)
            ctx = {"ship_id": body.ship_id, "scenario_now": fc["cursor"], "events": [m["event_id"] for m in fc["missions"]],
                   "ships": SHIP_IDS, "open_requisitions": [it.doc_number for it in s.world().ships[body.ship_id].items if it.doc_number]}
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
            if path and f.exists() and f.is_file():
                return FileResponse(f)
            return FileResponse(dist / "index.html")

    return app


def _ship(ship_id: str):
    if ship_id not in SHIPS:
        raise HTTPException(404, f"unknown ship {ship_id}")


app = create_app()
