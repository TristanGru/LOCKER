"""Engine: event-sourced scenario + pure forecast.

R4  Scenario(baseline, changes). forecast(world, runs, seed) is pure. Reset clears changes, Undo pops one,
    and the change list is the activity log (JSONL). Source files are never written.
R1  Seeded Monte Carlo (same inputs -> identical arrays; seed shown) plus a deterministic planned case
    (stated ETAs and point estimates, no randomness) with MAKE/MISS margin and source chain.
R13 forecast() is memoized by (changes digest, seed, runs). Common random numbers: every random item draws
    from its own generator keyed by (seed, item key), so a fix only changes the draws of the items it touches.

Dependency graph: mission -> gates (systems k-of-n people, certs, training, prerequisite events, availability)
-> components -> impairments (open 2-Kilos / CASREPs with supply chains) and background failure hazards.
Graph shape mirrors MFOM (spec 09); networkx is used for the exported domino graph.
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

from .domain import (AREAS, COMPONENT_TO_SYSTEM, CRITICAL_CAP, LOG_DIR, MONTHS, SCENARIO_NOW, SHIP_IDS, SHIPS, SYSTEMS,
                     UTC, WATCHSTATIONS, band, date_dt, day_of, dt_of, format_dtg, iso, local_label, parse_ts, parts_index)
from .ingest import Baseline, View, fact_date
from .models import SourceRef

REGIME_OF = {"BA": "NEAR", "BB": "DUE_IN", "BC": "LONG", "BV": "PROCUREMENT", "BZ": "PROCUREMENT", "B3": "LONG",
             "CB": "REJECTED", "CG": "REJECTED", "CJ": "REJECTED", "CU": "REJECTED"}
FASTER = {"PROCUREMENT": "LONG", "LONG": "DUE_IN", "DUE_IN": "NEAR", "NEAR": "NEAR"}
INF = 1e9


# ====================================================================== params
def pval(params: dict, path: str):
    key, *rest = path.split(".")
    v = params[key]["value"] if isinstance(params.get(key), dict) and "value" in params[key] else params[key]
    for r in rest:
        v = v[r]
    return v


def set_pval(params: dict, path: str, value) -> dict:
    p = copy.deepcopy(params)
    key, *rest = path.split(".")
    if not rest:
        p[key]["value"] = value
    else:
        node = p[key]["value"]
        for r in rest[:-1]:
            node = node[r]
        node[rest[-1]] = value
    if key in p and isinstance(p[key], dict):
        p[key]["edited"] = True
    return p


# ====================================================================== stages (durations, days)
@dataclass
class Stage:
    kind: str  # fixed | lognormal | triangular | uniform | bern_lognormal
    a: float = 0.0
    b: float = 0.0
    c: float = 0.0
    p: float = 1.0
    label: str = ""

    def sample(self, rng: np.random.Generator, n: int) -> np.ndarray:
        u = rng.random(n)
        z = rng.standard_normal(n)
        if self.kind == "fixed":
            return np.full(n, self.a)
        if self.kind == "lognormal":
            return self.a * np.exp(self.b * z)
        if self.kind == "uniform":
            return self.a + (self.b - self.a) * u
        if self.kind == "triangular":
            lo, mode, hi = self.a, self.b, self.c
            if hi <= lo:
                return np.full(n, lo)
            fc = (mode - lo) / (hi - lo)
            return np.where(u < fc, lo + np.sqrt(u * (hi - lo) * (mode - lo)), hi - np.sqrt((1 - u) * (hi - lo) * (hi - mode)))
        if self.kind == "bern_lognormal":
            return np.where(u < self.p, self.a * np.exp(self.b * z), 0.0)
        raise ValueError(self.kind)

    def point(self) -> float:
        if self.kind in ("fixed", "lognormal"):
            return self.a
        if self.kind == "uniform":
            return (self.a + self.b) / 2
        if self.kind == "triangular":
            return self.b
        if self.kind == "bern_lognormal":
            return self.a if self.p >= 0.5 else 0.0
        raise ValueError(self.kind)

    def describe(self) -> str:
        if self.kind == "fixed":
            return f"{self.label} {self.a:g}d"
        if self.kind == "lognormal":
            return f"{self.label} ~{self.a:g}d (lognormal, sigma {self.b:g})"
        if self.kind == "uniform":
            return f"{self.label} {self.a:g}-{self.b:g}d"
        if self.kind == "triangular":
            return f"{self.label} {self.a:g}/{self.b:g}/{self.c:g}d"
        return f"{self.label} {int(self.p * 100)}% chance of ~{self.a:g}d"


def rng_for(seed: int, key: str) -> np.random.Generator:
    h = int(hashlib.sha256(key.encode()).hexdigest()[:12], 16)
    return np.random.default_rng([int(seed), h])


@dataclass
class Item:
    """Something that degrades a component/system until it ends (open casualty, deferred job, what-if)."""
    key: str
    ship: str
    eic: str
    score: float
    start: float
    base: float
    stages: list
    title: str
    sources: list
    kind: str = "casualty"  # casualty | deferred | whatif | cannibalized
    persistent: bool = False
    not_before: float = -INF
    floor: float = -INF
    explain: list = field(default_factory=list)
    part_niin: str = ""
    doc_number: str = ""

    def sample_end(self, seed: int, n: int) -> np.ndarray:
        if self.persistent:
            return np.full(n, INF)
        rng = rng_for(seed, "item:" + self.key)
        e = np.full(n, self.base, dtype=float)
        for s in self.stages:
            e = e + s.sample(rng, n)
        return np.maximum(np.maximum(e, self.not_before), self.floor)

    def planned_end(self) -> float:
        if self.persistent:
            return INF
        e = self.base + sum(s.point() for s in self.stages)
        return max(e, self.not_before, self.floor)


@dataclass
class Hazard:
    key: str
    ship: str
    comp: str
    niin: str
    rate: float  # failures per day for the whole component
    score: float
    spare: bool
    down_spare: list
    down_nospare: list
    start: float
    sources: list


@dataclass
class Holder:
    member_id: str
    rate: str
    ws: str
    on_base: float = -INF
    on_stages: list = field(default_factory=list)
    on_until: float = INF
    off: list = field(default_factory=list)  # [(from, until, why, source)]
    sources: list = field(default_factory=list)
    note: str = ""
    loan_from: str = ""


@dataclass
class Mission:
    event_id: str
    label: str
    ship: str
    name: str
    start: float
    end: float
    req_systems: list
    teams: list
    certs: list
    areas: list
    prereqs: list
    avail_id: str
    block_id: str
    sources: list
    consequence: str = ""
    moved_note: str = ""


@dataclass
class ShipWorld:
    ship: str
    items: list = field(default_factory=list)
    hazards: list = field(default_factory=list)
    holders: dict = field(default_factory=dict)  # ws -> [Holder]
    missions: list = field(default_factory=list)
    stock: dict = field(default_factory=dict)  # niin -> {"on_hand", "allowance", "src"}
    blocks: list = field(default_factory=list)
    certs: dict = field(default_factory=dict)
    trainings: list = field(default_factory=list)
    avails: dict = field(default_factory=dict)
    notes: list = field(default_factory=list)


@dataclass
class World:
    cursor: float
    cursor_dt: datetime
    params: dict
    ships: dict
    wholesale: dict
    fixes: list
    notes: list
    facts_used: list
    digest: str


# ====================================================================== scenario (R4)
class Scenario:
    def __init__(self, baseline: Baseline, log_path: Path | None = None):
        self.b = baseline
        self.changes: list[dict] = []
        self.version = 0
        self.log_path = log_path or (LOG_DIR / "activity.jsonl")

    # derived state
    def played(self) -> list[str]:
        return [c["payload"]["event_id"] for c in self.changes if c["kind"] == "play_event"]

    def cursor_dt(self) -> datetime:
        t = SCENARIO_NOW
        played = set(self.played())
        for ev in self.b.feed.get("events", []):
            if ev["event_id"] in played:
                t = max(t, ev["known_at"])
        return t

    def next_event(self) -> dict | None:
        played = set(self.played())
        for ev in self.b.feed.get("events", []):
            if ev["event_id"] not in played:
                return ev
        return None

    def params(self) -> dict:
        p = copy.deepcopy(self.b.params)
        for c in self.changes:
            if c["kind"] == "set_assumption":
                p = set_pval(p, c["payload"]["key"], c["payload"]["value"])
        return p

    def digest(self) -> str:
        body = [id(self.b)] + [{k: c[k] for k in ("kind", "payload", "at_day")} for c in self.changes]
        return hashlib.sha256(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()[:16]

    # mutation (the only writes are the app's own log)
    def apply(self, kind: str, payload: dict, actor: str = "captain") -> dict:
        if kind == "play_event":
            nxt = self.next_event()
            if nxt is None:
                raise ValueError("no more events in the feed")
            if payload.get("event_id") and payload["event_id"] != nxt["event_id"]:
                raise ValueError(f"events play in order; next is {nxt['event_id']}")
            payload = {"event_id": nxt["event_id"], "title": nxt["title"]}
        at_day = day_of(self.cursor_dt()) if kind != "play_event" else day_of(nxt["known_at"])
        c = {"seq": len(self.changes) + 1, "kind": kind, "payload": payload, "actor": actor, "at_day": round(at_day, 4),
             "scenario_time": iso(dt_of(at_day)), "wall_time": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")}
        self.changes.append(c)
        self.version += 1
        self._log({"op": "apply", **c})
        return c

    def undo(self) -> dict | None:
        if not self.changes:
            return None
        c = self.changes.pop()
        self.version += 1
        self._log({"op": "undo", "seq": c["seq"], "kind": c["kind"]})
        return c

    def reset(self):
        self.changes = []
        self.version += 1
        self._log({"op": "reset"})

    def _log(self, rec: dict):
        try:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, default=str) + "\n")
        except OSError:
            pass


# ====================================================================== world construction
def _src(r) -> list:
    s = r.get("_src") if isinstance(r, dict) else None
    return [s] if s else []


def regime_for(req: dict) -> str:
    code = req["status_code"]
    if code == "B5":
        for _, c, _e in reversed(req["_history"][:-1]):
            if c != "B5":
                return REGIME_OF.get(c, "DUE_IN")
        return "DUE_IN"
    return REGIME_OF.get(code, "DUE_IN")


def arrival(req: dict, params: dict, cursor: float, expedited: bool, wholesale_on_hand: int) -> tuple[float, list, list]:
    """Requisition -> (base day, [stages], explanation lines). Arrival = base + sum(stages), floored at now."""
    reg = pval(params, "part_arrival_days_by_regime")
    transit = float(pval(params, "transit_days_conus_default"))
    regime = regime_for(req)
    explain = [f"{req['doc_number']}: status {req['status_code']} ({regime}) since {req['status_time']:%d %b %H%MZ}"]
    if regime == "REJECTED":
        base = day_of(req["status_time"]) + reg["REJECTED"]["re_requisition_add_days"]
        regime = reg["REJECTED"].get("then", "DUE_IN")
        explain.append(f"rejected: re-requisition +{reg['REJECTED']['re_requisition_add_days']}d, then {regime}")
    else:
        base = day_of(req["status_time"])
    if expedited and wholesale_on_hand > 0 and regime != "NEAR":
        explain.append(f"expedite: {regime} -> {FASTER[regime]} (wholesale on hand {wholesale_on_hand})")
        regime = FASTER[regime]
    elif expedited:
        explain.append("expedite requested but wholesale on hand is 0: no effect (ledger: expedite_effect)")
    sig = reg[regime]["sigma"]
    esd = req.get("esd")
    if esd is not None and not expedited:
        esd_day = day_of(date_dt(esd))
        if esd_day + transit < cursor and req["status_code"] == "BA":
            med = reg["NEAR"]["median_conus"]
            explain.append(f"ESD {esd:%d %b} passed with no update: arrival unknown, re-estimated from now (NEAR ~{med}d)")
            return cursor, [Stage("lognormal", med, reg["NEAR"]["sigma"], label="arrival (re-estimated)")], explain
        med = max(esd_day - base, 0.0) + transit
        explain.append(f"ESD {esd:%d %b} + {transit:g}d CONUS transit")
        return base, [Stage("lognormal", med, sig, label=f"arrival ({regime}, ESD-anchored)")], explain
    med = reg[regime].get("median", reg[regime].get("median_conus"))
    explain.append(f"no ESD: {regime} median {med}d")
    return base, [Stage("lognormal", med, sig, label=f"arrival ({regime})")], explain


def install_stage(params) -> Stage:
    r = pval(params, "repair_after_part_days")
    return Stage("triangular", r["min"], r["mode"], r["max"], label="install/repair")


def etr_slip_stage(params) -> Stage:
    s = pval(params, "etr_slip")
    return Stage("bern_lognormal", s["median"], s["sigma"], 0, s["p_slip"], label="ETR slip")


def inport_place(sw: ShipWorld, t: float) -> str | None:
    for b in sw.blocks:
        if b["s"] <= t < b["e"]:
            return b["place"] if b["code"] in ("UPK", "INPORT", "AVAIL", "HOLUPK", "RFS") else None
    return None


def build_world(scn: Scenario) -> World:
    b = scn.b
    cursor_dt = scn.cursor_dt()
    cursor = day_of(cursor_dt)
    v = b.view(cursor_dt)
    params = scn.params()
    lam = float(pval(params, "background_failure_rate_per_unit_day"))
    lost_mult = float(pval(params, "lost_pms_hazard_multiplier"))
    confirmed = {}
    for c in scn.changes:
        if c["kind"] == "confirm_fact":
            confirmed[c["payload"]["fact_id"]] = bool(c["payload"]["include"])
    wholesale = {}
    for w in v.squadron("wholesale_stock.csv"):
        wholesale.setdefault(w["niin"], []).append(dict(w))
    pidx = parts_index()
    ships = {}
    facts_used = []
    for s in SHIP_IDS:
        sw = ShipWorld(ship=s)
        # schedule blocks (current at cursor)
        for blk in v.schedule(s):
            sw.blocks.append({"s": day_of(date_dt(blk["start_date"])), "e": day_of(date_dt(blk["end_date"])) + 1,
                              "code": blk["employment_code"], "place": blk["oparea_or_port"], "event_id": blk["event_id"],
                              "block_id": blk["block_id"], "src": blk["_src"], "status": blk["status"]})
        sw.blocks.sort(key=lambda x: x["s"])
        # stock
        for r in v.rows(s, "onboard_allowance_cosal.csv"):
            if r["item_type"] == "STOREROOM":
                sw.stock[r["niin"]] = {"on_hand": r["on_hand_qty"], "allowance": r["allowance_qty"], "src": r["_src"]}
        # certs, training, avails
        for c in v.rows(s, "cert_status.csv"):
            sw.certs[c["cert_id"]] = {"status": c["status"], "expires": day_of(date_dt(c["expires"])) if c["expires"] else INF,
                                      "src": c["_src"], "name": c["cert_name"]}
        for t in v.rows(s, "training_readiness.csv"):
            sw.trainings.append({"id": t["requirement_id"], "area": t["mission_area"], "name": t["requirement_name"],
                                 "expires": day_of(date_dt(t["expires"])) + 1,
                                 "refresh": day_of(date_dt(t["scheduled_refresh"])) + 1 if t["scheduled_refresh"] else None,
                                 "src": t["_src"]})
        for aid, a in v.availabilities(s).items():
            done = a["actual_completion"] is not None
            sw.avails[aid] = {"done": done, "completion": day_of(date_dt(a["actual_completion"] or a["forecast_completion"])) + 1,
                              "planned": a["planned_completion"], "forecast": a["forecast_completion"], "src": a["_src"]}
        # missions from events + current schedule blocks
        for ev in b.events:
            if ev["ship_id"] != s:
                continue
            blk = next((x for x in sw.blocks if x["event_id"] == ev["event_id"]), None)
            start_dt = ev["start"]
            moved = ""
            srcs = [SourceRef(file="squadron/events_missions.json", loc=ev["event_id"], key=ev["event_id"])]
            if blk:
                tod = ev["start"] - date_dt(ev["start"].date())
                start_dt = date_dt((SCENARIO_NOW + timedelta(days=blk["s"])).date()) + tod
                srcs.append(blk["src"])
                if blk["status"] == "CHANGED":
                    moved = f"moved by schedule change {blk['src'].file}"
            dur = (ev["end"] - ev["start"]).total_seconds() / 86400 if ev.get("end") else 1
            st = day_of(start_dt)
            sw.missions.append(Mission(
                event_id=ev["event_id"], label=ev["label"], ship=s, name=ev["name"], start=st, end=st + dur,
                req_systems=[(r["eic"], float(r["min_status_score"])) for r in ev.get("required_systems", [])],
                teams=[(t["watchstation_code"], int(t["k"])) for t in ev.get("required_watch_teams", [])],
                certs=list(ev.get("prerequisite_certs", [])), areas=list(ev.get("mission_areas", [])),
                prereqs=list(ev.get("prerequisite_events", [])), avail_id=ev.get("prerequisite_avail") or "",
                block_id=blk["block_id"] if blk else "", sources=srcs, consequence=ev.get("consequence_if_missed", ""),
                moved_note=moved))
        # people: quals x roster x verified facts
        roster = {r["member_id"]: r for r in v.rows(s, "roster.csv")}
        for q in v.rows(s, "quals.csv"):
            if q["qual_status"] not in ("QUALIFIED", "INTERIM"):
                continue
            m = roster.get(q["member_id"])
            if not m:
                continue
            h = Holder(member_id=q["member_id"], rate=m["rate"], ws=q["watchstation_code"],
                       on_until=day_of(date_dt(q["requal_due"])) if q.get("requal_due") else INF, sources=[q["_src"], m["_src"]])
            st = m["onboard_status"]
            if st in ("TAD", "LEAVE", "TRANSFERRING") and m["status_start"]:
                a = day_of(date_dt(m["status_start"]))
                z = day_of(date_dt(m["status_end"])) if (m["status_end"] and st != "TRANSFERRING") else INF
                h.off.append((a, z, f"R-ADM {st}", m["_src"]))
            sw.holders.setdefault(h.ws, []).append(h)
        for f in v.facts(s):
            use = f.status == "VERIFIED" or (f.status == "UNCONFIRMED" and confirmed.get(f.fact_id))
            if f.status == "VERIFIED" and confirmed.get(f.fact_id) is False:
                use = False
            if not use:
                continue
            src = SourceRef(file=f.doc, loc=f"page {f.page}", span=f.span, key=f.fact_id)
            if f.type in ("personnel_transfer", "personnel_tad") and f.member_id:
                a = day_of(fact_date(f.date, f.known_at))
                z = day_of(fact_date(f.until, f.known_at)) if (f.type == "personnel_tad" and f.until) else INF
                why = "detaches (daily report)" if f.type == "personnel_transfer" else "TAD (daily report)"
                for ws, hs in sw.holders.items():
                    for h in hs:
                        if h.member_id == f.member_id:
                            h.off.append((a, z, why, src))
                facts_used.append(f.fact_id)
        sw.facts_assist = {}
        for f in v.facts(s):
            if f.type == "assist_eta" and (f.status == "VERIFIED" or confirmed.get(f.fact_id)) and f.date:
                sw.facts_assist[f.fact_id] = (day_of(fact_date(f.date, f.known_at)), SourceRef(file=f.doc, loc=f"page {f.page}", span=f.span, key=f.fact_id))
                facts_used.append(f.fact_id)
        # equipment items: CSMP jobs + CASREPs
        jobs = v.rows(s, "csmp.csv")
        reqs = {r["doc_number"]: r for r in v.requisitions(s)}
        casreps = v.casreps(s)
        cas_by_dtg = {c["initial_dtg"]: c for c in casreps}
        expedited = set()
        for j in jobs:
            if j["job_state"] in ("COMPLETED", "CANCELLED") or j["status_code"] == "0":
                continue
            score = float(pval(params, "status_score_map")[j["status_code"]])
            cas = cas_by_dtg.get(j.get("casrep_dtg") or "")
            if cas and cas["state"] == "CLOSED":
                continue
            start = day_of(date_dt(j["date_discovered"])) if j["date_discovered"] else -INF
            if cas:
                start = min(start, day_of(cas["initial_time"]))
            title = f"{j['equipment_noun']} (JCN {j['jcn']})"
            srcs = [j["_src"]] + ([cas["_src"]] if cas else [])
            docs = [d_ for d_ in (j.get("req_doc_numbers") or "").split(";") if d_ and d_ in reqs]
            item = Item(key=f"job:{j['jcn']}", ship=s, eic=j["eic"], score=score, start=start, base=0, stages=[], title=title,
                        sources=srcs, floor=cursor)
            if j["job_state"] == "OPEN_AWAITING_PARTS" and docs:
                r = reqs[docs[0]]
                ws_on = sum(w["on_hand_qty"] for w in wholesale.get(r["niin"], []) if w["holder"] in ("NAVSUP_WSS", "DLA"))
                base, stages, ex = arrival(r, params, cursor, r["doc_number"] in expedited, ws_on)
                item.base, item.stages, item.explain = base, stages + [install_stage(params)], ex + ["+ install/repair (ledger)"]
                item.part_niin, item.doc_number = r["niin"], r["doc_number"]
                item.sources.append(r["_src"])
                if cas and cas.get("assist"):
                    for fid, (ad, asrc) in sw.facts_assist.items():
                        item.not_before = max(item.not_before, ad + pval(params, "repair_after_part_days")["min"])
                        item.sources.append(asrc)
                        item.explain.append(f"tech assist not before {format_dtg(dt_of(ad))} (confirmed daily-report fact)")
            elif cas and cas["etr_history"]:
                etr = cas["etr_history"][-1]["etr"]
                item.base, item.stages = day_of(etr), [etr_slip_stage(params)]
                item.explain = [f"CASREP ETR {format_dtg(etr)} + ETR slip risk (ledger)"]
            else:
                item.persistent = True
                item.kind = "deferred"
                item.explain = [f"{j['job_state']} job, status {j['status_code']}: no completion date; persists across horizon"]
            sw.items.append(item)
        for cas in casreps:
            if cas["state"] != "OPEN" or (cas["jcn"] and any(j["jcn"] == cas["jcn"] for j in jobs)):
                continue
            sc = {2: 0.6, 3: 0.0, 4: 0.0}[cas["category"]]
            etr = cas["etr_history"][-1]["etr"] if cas["etr_history"] else None
            it = Item(key=f"casrep:{cas['casrep_id']}", ship=s, eic=cas["eic"], score=sc, start=day_of(cas["initial_time"]),
                      base=day_of(etr) if etr else cursor + 30, stages=[etr_slip_stage(params)],
                      title=f"CASREP {cas['casrep_id']} {cas['equipment']} (no 2-Kilo)", sources=[cas["_src"]], floor=cursor,
                      explain=[f"CASREP CAT {cas['category']} with no JCN; ETR {format_dtg(etr) if etr else 'unknown'} + slip risk"])
            sw.items.append(it)
        # background failure hazards (ledger: background_failure_rate_per_unit_day)
        lost = {r["eic"] for r in v.rows(s, "sked_schedule.csv") if r["status"] == "LOST" and r["periodicity"] not in ("D", "W", "R")}
        impaired = {it.eic for it in sw.items if it.score < 1}
        for niin, uses in pidx.items():
            for sys_eic, comp, inst, minw in uses:
                if comp in impaired:
                    continue
                rate = lam * inst * (lost_mult if comp in lost else 1.0)
                sc = 0.0 if inst - 1 < minw else 0.6
                ws_on = sum(w["on_hand_qty"] for w in wholesale.get(niin, []) if w["holder"] in ("NAVSUP_WSS", "DLA"))
                reg = pval(params, "part_arrival_days_by_regime")
                rg = "NEAR" if ws_on > 0 else "DUE_IN"
                med = reg[rg].get("median_conus", reg[rg].get("median"))
                sw.hazards.append(Hazard(key=f"hz:{s}:{comp}:{niin}", ship=s, comp=comp, niin=niin, rate=rate, score=sc,
                                         spare=sw.stock.get(niin, {}).get("on_hand", 0) > 0, down_spare=[install_stage(params)],
                                         down_nospare=[Stage("lognormal", med, reg[rg]["sigma"], label=f"replacement ({rg})"), install_stage(params)],
                                         start=cursor, sources=[sw.stock[niin]["src"]] if niin in sw.stock else []))
        ships[s] = sw

    world = World(cursor=cursor, cursor_dt=cursor_dt, params=params, ships=ships, wholesale=wholesale, fixes=[],
                  notes=[], facts_used=facts_used, digest=scn.digest())
    # actions and approved fixes, in order
    for c in scn.changes:
        if c["kind"] == "action":
            apply_action(world, c["payload"], c["at_day"])
        elif c["kind"] == "fix_decision" and c["payload"].get("decision") == "approve":
            apply_fix(world, c["payload"]["fix"], c["at_day"] + float(c["payload"].get("approval_delay_days", 0)))
    return world


# ====================================================================== actions and fixes
def _mission(world: World, event_id: str) -> Mission | None:
    for sw in world.ships.values():
        for m in sw.missions:
            if m.event_id == event_id:
                return m
    return None


def apply_action(world: World, a: dict, at: float):
    t = a["type"]
    if t == "remove_person":
        sw = world.ships[a["ship_id"]]
        fr = day_of(parse_ts(a["from_time"]) if isinstance(a["from_time"], str) else a["from_time"])
        un = a.get("until_time")
        un = day_of(parse_ts(un) if isinstance(un, str) else un) if un else INF
        src = SourceRef(file="logs/activity.jsonl", loc="what-if", key=a["member_id"])
        for hs in sw.holders.values():
            for h in hs:
                if h.member_id == a["member_id"]:
                    h.off.append((fr, un, f"what-if: {a.get('reason', 'removed')}", src))
    elif t == "delay_part":
        for it in world.ships[a["ship_id"]].items:
            if it.doc_number == a["doc_number"]:
                it.stages = it.stages + [Stage("fixed", float(a["days"]), label="what-if delay")]
                it.explain.append(f"what-if: +{a['days']}d")
    elif t == "add_casrep":
        etr = parse_ts(a["etr"]) if isinstance(a["etr"], str) else a["etr"]
        sw = world.ships[a["ship_id"]]
        sw.items.append(Item(key=f"whatif:{a['eic']}:{at}", ship=a["ship_id"], eic=a["eic"],
                             score={2: 0.6, 3: 0.0, 4: 0.0}[int(a["category"])], start=at, base=day_of(etr),
                             stages=[etr_slip_stage(world.params)], title=f"What-if CASREP CAT {a['category']} on {a['eic']}",
                             sources=[SourceRef(file="logs/activity.jsonl", loc="what-if")], kind="whatif", floor=at,
                             explain=[f"what-if ETR {format_dtg(etr)} + slip risk"]))
        sw.hazards = [h for h in sw.hazards if h.comp != a["eic"]]
    elif t == "shift_mission":
        m = _mission(world, a["event_id"])
        if m:
            m.start += float(a["days"])
            m.end += float(a["days"])
            m.moved_note = (m.moved_note + "; " if m.moved_note else "") + f"what-if shift {a['days']:+g}d"


def transfer_stages(world: World, donor: str, receiver: str, at: float) -> tuple[list, str]:
    cd = pval(world.params, "cross_deck_days")
    pd_ = inport_place(world.ships[donor], at)
    pr = inport_place(world.ships[receiver], at)
    if pd_ and pd_ == pr:
        return [Stage("fixed", float(cd["same_port"]), label="cross-deck (same port)")], f"same port ({pd_})"
    if pd_ and pr:
        r = cd["different_ports_conus"]
        return [Stage("uniform", r["min"], r["max"], label="ship between ports")], "different ports"
    r = cd["in_company"]
    return [Stage("uniform", r["min"], r["max"], label="cross-deck at sea")], "at sea / in company"


def first_common_port(world: World, a: str, b: str, frm: float, horizon: float = 40) -> float:
    t = frm
    while t < frm + horizon:
        pa, pb = inport_place(world.ships[a], t), inport_place(world.ships[b], t)
        if pa and pa == pb:
            return t
        t += 0.25
    return INF


def apply_fix(world: World, fix: dict, at: float):
    for st in fix["steps"]:
        k = st["kind"]
        if k == "part_transfer":
            recv = world.ships[st["receiver"]]
            item = next((i for i in recv.items if i.key == st["item_key"]), None)
            if item is None:
                continue
            src_kind = st["source_kind"]
            ins = install_stage(world.params)
            if src_kind in ("cross_deck", "cannibalize"):
                donor = world.ships[st["donor"]]
                t0 = max(at, first_common_port(world, st["donor"], st["receiver"], at)) if src_kind else at
                stages, how = transfer_stages(world, st["donor"], st["receiver"], t0)
                if src_kind == "cannibalize":
                    ce = pval(world.params, "cannibalize_extra_days")
                    stages = stages + [Stage("uniform", ce["min"], ce["max"], label="remove from donor")]
                item.base, item.stages = t0, stages + [ins]
                item.floor = at
                item.explain = [f"FIX: {src_kind.replace('_', '-')} NIIN {st['niin']} from {st['donor']} ({how})", "+ install/repair (ledger)"]
                item.sources.append(donor.stock.get(st["niin"], {}).get("src") or SourceRef(file="squadron/fleet_onboard_stock.csv"))
                if src_kind == "cross_deck":
                    if st["niin"] in donor.stock:
                        donor.stock[st["niin"]]["on_hand"] -= 1
                    for h in donor.hazards:
                        if h.niin == st["niin"]:
                            h.spare = donor.stock.get(st["niin"], {}).get("on_hand", 0) > 0
                else:
                    comp, inst, minw = st["donor_comp"], st["installed"], st["min_working"]
                    reg = pval(world.params, "part_arrival_days_by_regime")
                    ws_on = sum(w["on_hand_qty"] for w in world.wholesale.get(st["niin"], []) if w["holder"] in ("NAVSUP_WSS", "DLA"))
                    rg = "NEAR" if ws_on > 0 else "DUE_IN"
                    donor.items.append(Item(key=f"cannibal:{st['donor']}:{comp}", ship=st["donor"], eic=comp,
                                            score=0.0 if inst - 1 < minw else 0.6, start=t0, base=t0,
                                            stages=[Stage("lognormal", reg[rg].get("median_conus", reg[rg].get("median")), reg[rg]["sigma"],
                                                          label=f"donor replacement ({rg})"), ins],
                                            title=f"Cannibalized NIIN {st['niin']} for {st['receiver']}", kind="cannibalized",
                                            sources=[SourceRef(file="squadron/fleet_onboard_stock.csv", key=st["niin"])], floor=t0,
                                            explain=[f"donor degraded until its own replacement arrives ({rg})"]))
                    donor.hazards = [h for h in donor.hazards if h.comp != comp]
            elif src_kind == "wholesale":
                holder = st["holder"]
                stages = []
                if holder == "PROGRAM_OFFICE":
                    r = pval(world.params, "program_office_release_days")
                    v = pval(world.params, "engineering_validation_days")
                    stages = [Stage("uniform", r["min"], r["max"], label="program office release"),
                              Stage("uniform", v["min"], v["max"], label="engineering validation")]
                else:
                    stages = [Stage("fixed", 1, label="WSS release")]
                stages.append(Stage("fixed", float(pval(world.params, "transit_days_conus_default")), label="CONUS transit"))
                item.base, item.stages, item.floor = at, stages + [ins], at
                item.explain = [f"FIX: pull NIIN {st['niin']} from {holder}"] + [s.describe() for s in stages] + ["+ install/repair (ledger)"]
                item.sources.append(SourceRef(file="squadron/wholesale_stock.csv", key=st["niin"]))
                for w in world.wholesale.get(st["niin"], []):
                    if w["holder"] == holder and w["on_hand_qty"] > 0:
                        w["on_hand_qty"] -= 1
                        break
        elif k == "expedite":
            recv = world.ships[st["receiver"]]
            item = next((i for i in recv.items if i.key == st["item_key"]), None)
            if item and item.doc_number:
                ws_on = sum(w["on_hand_qty"] for w in world.wholesale.get(item.part_niin, []) if w["holder"] in ("NAVSUP_WSS", "DLA"))
                if ws_on > 0:
                    reg = pval(world.params, "part_arrival_days_by_regime")
                    item.stages = [Stage("lognormal", reg["NEAR"]["median_conus"], reg["NEAR"]["sigma"], label="arrival (expedited, NEAR)"),
                                   install_stage(world.params)]
                    item.base = at
                    item.explain.append("FIX: expedite (wholesale has stock): NEAR regime")
                else:
                    item.explain.append("FIX: expedite has no effect: wholesale on hand 0 (ledger: expedite_effect)")
        elif k == "crew_loan":
            donor, recv = world.ships[st["donor"]], world.ships[st["receiver"]]
            t0 = first_common_port(world, st["donor"], st["receiver"], at)
            stages, how = transfer_stages(world, st["donor"], st["receiver"], t0 if t0 < INF else at)
            ret = st.get("return_day", INF)
            src_h = None
            for hs in donor.holders.values():
                for h in hs:
                    if h.member_id == st["member_id"]:
                        h.off.append((t0, ret + 1, f"loaned to {st['receiver']}", SourceRef(file="logs/activity.jsonl", key=st["member_id"])))
                        if h.ws == st["ws"]:
                            src_h = h
            if src_h is None:
                continue
            recv.holders.setdefault(st["ws"], []).append(Holder(
                member_id=st["member_id"], rate=src_h.rate, ws=st["ws"], on_base=t0, on_stages=stages, on_until=ret,
                sources=src_h.sources, note=f"loan from {st['donor']} ({how})", loan_from=st["donor"]))
        elif k == "shift_mission":
            m = _mission(world, st["event_id"])
            if m:
                m.start += st["days"]
                m.end += st["days"]
                m.moved_note = (m.moved_note + "; " if m.moved_note else "") + f"FIX: shift {st['days']:+g}d"
        elif k == "schedule_training":
            sw = world.ships[st["ship"]]
            for t in sw.trainings:
                if t["id"] == st["requirement_id"]:
                    t["refresh"] = st["day"]
    world.fixes.append(fix)


# ====================================================================== forecast
def horizon_days(world: World) -> int:
    last = max(m.start for sw in world.ships.values() for m in sw.missions)
    return int(math.ceil(last)) + 3


def _items_scores(sw: ShipWorld, T: np.ndarray, n: int, seed: int, planned: bool):
    """Returns ({eic: (n,K) score}, item_info) where eic is a component or system eic."""
    K = len(T)
    scores: dict[str, np.ndarray] = {}
    info = []
    for it in sw.items:
        if planned:
            end = np.array([it.planned_end()])
        else:
            end = it.sample_end(seed, n)
        active = (it.start <= T[None, :]) & (T[None, :] < end[:, None])
        val = np.where(active, it.score, 1.0).astype(np.float32)
        scores[it.eic] = np.minimum(scores.get(it.eic, np.ones((n if not planned else 1, K), np.float32)), val)
        info.append((it, end))
    for hz in sw.hazards:
        if planned or hz.rate <= 0:
            continue
        rng = rng_for(seed, hz.key)
        u = rng.random(n)
        fail = hz.start - np.log(np.maximum(u, 1e-12)) / hz.rate
        down = np.zeros(n)
        for st in (hz.down_spare if hz.spare else hz.down_nospare):
            down = down + st.sample(rng, n)
        active = (fail[:, None] <= T[None, :]) & (T[None, :] < (fail + down)[:, None])
        val = np.where(active, hz.score, 1.0).astype(np.float32)
        scores[hz.comp] = np.minimum(scores.get(hz.comp, np.ones((n, K), np.float32)), val)
        info.append((hz, fail))
    return scores, info


def _system_scores(comp_scores: dict, n: int, K: int) -> dict[str, np.ndarray]:
    out = {}
    one = np.ones((n, K), np.float32)
    for eic, sy in SYSTEMS.items():
        comps = sy["components"]
        if comps:
            arrs = [comp_scores.get(c["eic"], one) for c in comps]
            v = sum(arrs) / len(arrs)
            crit0 = np.zeros((n, K), bool)
            for c, a in zip(comps, arrs):
                if c["critical"]:
                    crit0 |= (a <= 0.0)
            v = np.where(crit0, np.minimum(v, CRITICAL_CAP), v)
        else:
            v = one
        if eic in comp_scores:
            v = np.minimum(v, comp_scores[eic])
        out[eic] = v.astype(np.float32)
    return out


def _team_counts(sw: ShipWorld, ws: str, T: np.ndarray, n: int, seed: int, planned: bool) -> tuple[np.ndarray, list]:
    count = np.zeros((n, len(T)), np.int16)
    det = []
    for h in sw.holders.get(ws, []):
        if h.on_stages:
            if planned:
                on = np.array([h.on_base + sum(s.point() for s in h.on_stages)])
            else:
                rng = rng_for(seed, f"loan:{sw.ship}:{h.member_id}:{ws}")
                on = np.full(n, h.on_base)
                for s in h.on_stages:
                    on = on + s.sample(rng, n)
        else:
            on = np.full(n if not planned else 1, h.on_base)
        aboard = (on[:, None] <= T[None, :]) & (T[None, :] < h.on_until)
        for a, z, _why, _src in h.off:
            aboard &= ~((a <= T[None, :]) & (T[None, :] < z))
        count += aboard.astype(np.int16)
        det.append((h, aboard))
    return count, det


def _area_rollup(sys_scores: dict) -> dict[str, np.ndarray]:
    out = {}
    for area, (_name, members) in AREAS.items():
        v = sum(w * sys_scores[e] for e, w in members)
        crit = np.zeros_like(v, dtype=bool)
        for e, _w in members:
            if SYSTEMS[e]["critical"]:
                crit |= sys_scores[e] <= 0.0
        out[area] = np.where(crit, np.minimum(v, CRITICAL_CAP), v)
    return out


def _evaluate(world: World, T_by_ship: dict, n: int, seed: int, planned: bool):
    """Core vectorized evaluation. Returns per-ship dict of arrays."""
    res = {}
    for s, sw in world.ships.items():
        T = T_by_ship[s]
        comp_scores, info = _items_scores(sw, T, n if not planned else 1, seed, planned)
        nn = 1 if planned else n
        sys_scores = _system_scores(comp_scores, nn, len(T))
        teams = {}
        team_det = {}
        needed_ws = {q["watchstation_code"] for sy in SYSTEMS.values() for q in sy["required_quals"]}
        for m in sw.missions:
            needed_ws |= {w for w, _k in m.teams}
        for ws in needed_ws:
            teams[ws], team_det[ws] = _team_counts(sw, ws, T, n, seed, planned)
        # training refresh draws (CRN per requirement)
        p_ok = float(pval(world.params, "training_refresh_success"))
        tr_success = {}
        for t in sw.trainings:
            if planned:
                tr_success[t["id"]] = np.array([p_ok >= 0.5])
            else:
                tr_success[t["id"]] = rng_for(seed, f"train:{s}:{t['id']}").random(n) < p_ok
        avail_done = {}
        for aid, a in sw.avails.items():
            if a["done"]:
                avail_done[aid] = np.full(nn, -INF)
            else:
                sl = pval(world.params, "availability_slip")
                st = Stage("bern_lognormal", sl["median"], sl["sigma"], 0, sl["p_late"], label="availability slip")
                avail_done[aid] = a["completion"] + (np.array([st.point()]) if planned else st.sample(rng_for(seed, f"avail:{s}:{aid}"), n))
        res[s] = {"T": T, "sys": sys_scores, "teams": teams, "team_det": team_det, "info": info, "tr": tr_success,
                  "avail": avail_done}
    return res


def _gates(world: World, sw: ShipWorld, m: Mission, r: dict, cols) -> list[dict]:
    """Gate boolean arrays (n, len(cols)) for mission m evaluated at time columns `cols` (indices into r['T'])."""
    T = r["T"][cols]
    gates = []
    for eic, mn in m.req_systems:
        ok = r["sys"][eic][:, cols] >= mn - 1e-6
        gates.append({"id": f"system:{eic}", "kind": "system", "eic": eic, "label": f"{SYSTEMS[eic]['name']} >= {mn:g}", "ok": ok, "min": mn})
    for ws, k in m.teams:
        ok = r["teams"][ws][:, cols] >= k
        gates.append({"id": f"team:{ws}", "kind": "team", "ws": ws, "k": k,
                      "label": f"{k} qualified {WATCHSTATIONS.get(ws, ws)} ({ws}) aboard", "ok": ok})
    for cid in m.certs:
        c = sw.certs.get(cid)
        valid = np.array([(c is not None and c["status"] == "CERTIFIED" and c["expires"] >= t) for t in T])
        gates.append({"id": f"cert:{cid}", "kind": "cert", "cert_id": cid, "label": f"{cid} certified", "ok": np.broadcast_to(valid, (r["sys"]["SPY1D"].shape[0], len(T)))})
    for t in sw.trainings:
        if t["area"] not in m.areas:
            continue
        ok_exp = (t["expires"] >= T)[None, :]
        if t["refresh"] is not None:
            ok_ref = (t["refresh"] <= T)[None, :] & r["tr"][t["id"]][:, None]
            ok = ok_exp | ok_ref
        else:
            ok = np.broadcast_to(ok_exp, (r["sys"]["SPY1D"].shape[0], len(T)))
        if np.all(t["expires"] >= T) and t["refresh"] is None:
            continue  # always valid in horizon; not a gate worth showing
        gates.append({"id": f"training:{t['id']}", "kind": "training", "req": t["id"], "label": f"{t['name']} current", "ok": ok, "t": t})
    if m.avail_id and m.avail_id in r["avail"]:
        ok = r["avail"][m.avail_id][:, None] <= T[None, :]
        gates.append({"id": f"avail:{m.avail_id}", "kind": "avail", "avail_id": m.avail_id, "label": f"{m.avail_id} complete", "ok": ok})
    return gates


def _p10_p90(x: np.ndarray):
    if x.size == 0:
        return None, None
    a, b = np.percentile(x, [10, 90])
    return float(a), float(b)


def _day_str(day: float) -> str | None:
    if day is None or day >= INF / 2:
        return None
    return iso(dt_of(day))


_CACHE: "OrderedDict[str, dict]" = OrderedDict()
_CACHE_MAX = 32
CACHE_STATS = {"hits": 0, "misses": 0, "runs": 0}


def forecast(world: World, runs: int | None = None, seed: int | None = None, detail: bool = True) -> dict:
    """Pure: same world + runs + seed -> identical output. Memoized (R13)."""
    runs = int(runs or pval(world.params, "runs"))
    seed = int(seed if seed is not None else pval(world.params, "seed"))
    key = f"{world.digest}|{runs}|{seed}|{int(detail)}|{_fix_digest(world)}"
    if key in _CACHE:
        CACHE_STATS["hits"] += 1
        _CACHE.move_to_end(key)
        return _CACHE[key]
    CACHE_STATS["misses"] += 1
    CACHE_STATS["runs"] += 1
    out = _forecast(world, runs, seed, detail)
    _CACHE[key] = out
    if len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)
    return out


def _fix_digest(world: World) -> str:
    return hashlib.sha256(json.dumps(world.fixes, sort_keys=True, default=str).encode()).hexdigest()[:12] if world.fixes else "-"


def _forecast(world: World, n: int, seed: int, detail: bool) -> dict:
    H = horizon_days(world)
    grid = np.arange(0, H + 1, dtype=float) + 0.5
    bands = pval(world.params, "bands")
    T_by_ship = {}
    for s, sw in world.ships.items():
        T_by_ship[s] = np.concatenate([grid, np.array([m.start for m in sw.missions], dtype=float)])
    r = _evaluate(world, T_by_ship, n, seed, planned=False)
    G = len(grid)
    missions_out = []
    ready_at_start = {}
    # first pass: own gates at mission start (prereqs resolved after)
    gate_cache = {}
    for s, sw in world.ships.items():
        for i, m in enumerate(sw.missions):
            col = G + i
            gates = _gates(world, sw, m, r[s], [col])
            allok = np.ones(n, bool)
            for g in gates:
                allok &= g["ok"][:, 0]
            gate_cache[m.event_id] = (s, m, gates, allok)
    # prerequisite events: ready in the same run
    def ready(eid, seen=()):
        s, m, gates, allok = gate_cache[eid]
        out = allok.copy()
        for pe in m.prereqs:
            if pe in gate_cache and pe not in seen:
                out &= ready(pe, seen + (eid,))
        return out
    for eid in gate_cache:
        ready_at_start[eid] = ready(eid)
    planned = planned_case(world)
    for eid, (s, m, gates, allok) in gate_cache.items():
        full = ready_at_start[eid]
        p = float(full.mean())
        gate_rows = []
        prereq_arrays = [(pe, ready_at_start[pe]) for pe in m.prereqs if pe in ready_at_start]
        all_arrays = [(g["id"], g["ok"][:, 0]) for g in gates] + [(f"prereq:{pe}", arr) for pe, arr in prereq_arrays]
        for gid, arr in all_arrays:
            others = np.ones(n, bool)
            for gid2, arr2 in all_arrays:
                if gid2 != gid:
                    others &= arr2
            uplift = float(others.mean()) - p
            g = next((x for x in gates if x["id"] == gid), None)
            row = {"gate_id": gid, "kind": g["kind"] if g else "prereq", "label": g["label"] if g else f"{_mission(world, gid[7:]).label} ready first",
                   "p_ok": float(arr.mean()), "uplift": uplift}
            if detail:
                row.update(_gate_detail(world, world.ships[s], m, g, r[s], G, n) if g else
                           {"items": [], "sources": _mission(world, gid[7:]).sources})
            gate_rows.append(row)
        nd = None
        if gate_rows:
            best = max(gate_rows, key=lambda x: (x["uplift"], -x["p_ok"]))
            if best["uplift"] > 0.005:
                nd = best["gate_id"]
            elif p < 0.999:
                nd = min(gate_rows, key=lambda x: x["p_ok"])["gate_id"]
        # curve: if the mission were held on day t
        curve = None
        if detail:
            cols = list(range(G))
            gates_c = _gates(world, world.ships[s], m, r[s], cols)
            ok = np.ones((n, G), bool)
            for g in gates_c:
                ok &= g["ok"]
            for pe, arr in prereq_arrays:
                ok &= arr[:, None]
            curve = [round(float(x), 4) for x in ok.mean(axis=0)]
        missions_out.append({
            "event_id": eid, "label": m.label, "ship_id": s, "name": m.name, "start": iso(dt_of(m.start)),
            "start_dtg": format_dtg(dt_of(m.start)), "start_local": local_label(dt_of(m.start)), "day": round(m.start, 2),
            "p_ready": round(p, 4), "band": band(p, bands), "next_domino": nd, "gates": gate_rows, "curve": curve,
            "planned": planned.get(eid), "areas": m.areas, "moved_note": m.moved_note, "consequence": m.consequence,
            "sources": [x.model_dump() for x in m.sources], "prereqs": m.prereqs,
        })
    ships_out = {}
    for s, sw in world.ships.items():
        rr = r[s]
        cap = {}
        for a, (_nm, members) in AREAS.items():
            okc = np.ones((n, G), bool)
            for e, _w in members:
                if SYSTEMS[e]["critical"]:
                    okc &= rr["sys"][e][:, :G] >= 0.6
                    for q in SYSTEMS[e]["required_quals"]:
                        okc &= rr["teams"][q["watchstation_code"]][:, :G] >= q["k"]
            cap[a] = [round(float(x), 4) for x in okc.mean(axis=0)]
        if not detail:
            ships_out[s] = {"capability_mean": round(float(np.mean([np.mean(v) for v in cap.values()])), 4),
                            "area_capability_mean": {a: round(float(np.mean(v)), 4) for a, v in cap.items()}}
            continue
        if True:
            area = _area_rollup({k: v[:, :G] for k, v in rr["sys"].items()})
            ships_out[s] = {
                "capability_mean": round(float(np.mean([np.mean(v) for v in cap.values()])), 4),
                "area_capability_mean": {a: round(float(np.mean(v)), 4) for a, v in cap.items()},
                "areas": {a: {"mfom": [round(float(x) * 100, 1) for x in area[a].mean(axis=0)], "p_capable": cap[a]} for a in AREAS},
                "systems": {e: [round(float(x), 3) for x in rr["sys"][e][:, :G].mean(axis=0)] for e in SYSTEMS},
                "system_p_ok": {e: [round(float(x), 4) for x in (rr["sys"][e][:, :G] >= 0.6).mean(axis=0)] for e in SYSTEMS},
            }
    return {
        "seed": seed, "runs": n, "cursor": iso(world.cursor_dt), "cursor_dtg": format_dtg(world.cursor_dt), "cursor_day": round(world.cursor, 3),
        "day0": iso(SCENARIO_NOW), "horizon_days": H, "grid_days": [float(x) for x in grid],
        "grid_dates": [iso(dt_of(x)) for x in grid], "missions": missions_out, "ships": ships_out,
        "bands": bands, "fixes_applied": [f.get("title") for f in world.fixes],
    }


def _gate_detail(world, sw, m, g, r, G, n) -> dict:
    col = G + sw.missions.index(m)
    t = r["T"][col]
    items, sources = [], []
    if g["kind"] == "system":
        comps = {c["eic"] for c in SYSTEMS[g["eic"]]["components"]} | {g["eic"]}
        for obj, arr in r["info"]:
            if isinstance(obj, Item) and obj.eic in comps:
                active = (obj.start <= t) & (t < arr)
                p10, p90 = _p10_p90(arr[arr < INF / 2])
                items.append({"key": obj.key, "kind": obj.kind, "title": obj.title, "eic": obj.eic, "score_while_active": obj.score,
                              "p_active_at_mission": round(float(np.mean(active)), 4),
                              "ready_p10": _day_str(p10), "ready_p90": _day_str(p90),
                              "planned_ready": _day_str(obj.planned_end()), "explain": obj.explain,
                              "sources": [s.model_dump() for s in obj.sources]})
                sources += obj.sources
            elif isinstance(obj, Hazard) and obj.comp in comps:
                items.append({"key": obj.key, "kind": "hazard", "title": f"Random failure risk: {obj.comp} (NIIN {obj.niin})",
                              "eic": obj.comp, "score_while_active": obj.score,
                              "p_active_at_mission": None, "p_fail_before_mission": round(float(np.mean(arr <= t)), 4),
                              "spare_onboard": obj.spare, "explain": [f"rate {obj.rate:.4f}/day (ledger)", "spare on board" if obj.spare else "no spare on board"],
                              "sources": [s.model_dump() for s in obj.sources]})
    elif g["kind"] == "team":
        for h, aboard in r["team_det"][g["ws"]]:
            items.append({"key": f"member:{h.member_id}", "kind": "person", "title": f"{h.rate} {h.member_id}" + (f" ({h.note})" if h.note else ""),
                          "member_id": h.member_id, "p_aboard_at_mission": round(float(np.mean(aboard[:, col])), 4),
                          "off": [{"from": _day_str(a), "until": _day_str(z), "why": why, "source": s.model_dump()} for a, z, why, s in h.off],
                          "sources": [s.model_dump() for s in h.sources]})
            sources += h.sources
    elif g["kind"] == "cert":
        c = sw.certs.get(g["cert_id"])
        if c:
            items.append({"key": g["cert_id"], "kind": "cert", "title": c["name"], "status": c["status"], "expires": _day_str(c["expires"]),
                          "sources": [c["src"].model_dump()]})
    elif g["kind"] == "training":
        t_ = g["t"]
        items.append({"key": t_["id"], "kind": "training", "title": t_["name"], "expires": _day_str(t_["expires"]),
                      "refresh": _day_str(t_["refresh"]) if t_["refresh"] else None, "sources": [t_["src"].model_dump()]})
    elif g["kind"] == "avail":
        a = sw.avails[g["avail_id"]]
        items.append({"key": g["avail_id"], "kind": "avail", "title": f"{g['avail_id']} forecast completion {a['forecast']:%d %b}",
                      "sources": [a["src"].model_dump()]})
    return {"items": items}


# ====================================================================== planned case (R1)
def planned_case(world: World) -> dict:
    """Deterministic: stated ETAs and point estimates, no randomness. MAKE/MISS margin and the binding chain."""
    H = horizon_days(world) + 45
    step = 0.25
    fine = np.arange(max(0.0, math.floor(world.cursor * 4) / 4), H, step)
    T_by_ship = {}
    for s, sw in world.ships.items():
        T_by_ship[s] = np.concatenate([fine, np.array([m.start for m in sw.missions], dtype=float)])
    r = _evaluate(world, T_by_ship, 1, 0, planned=True)
    F = len(fine)
    own = {}
    for s, sw in world.ships.items():
        for i, m in enumerate(sw.missions):
            gates = _gates(world, sw, m, r[s], list(range(F)) + [F + i])
            own[m.event_id] = (s, m, gates)
    out = {}

    def make(eid, seen=()):
        s, m, gates = own[eid]
        ok = all(bool(g["ok"][0, -1]) for g in gates)
        for pe in m.prereqs:
            if pe in own and pe not in seen:
                ok = ok and make(pe, seen + (eid,))
        return ok

    for eid, (s, m, gates) in own.items():
        mk = make(eid)
        allfine = np.ones(F, bool)
        for g in gates:
            allfine &= g["ok"][0, :F]
        prereq_ok = all(make(pe) for pe in m.prereqs if pe in own)
        chain = []
        for g in gates:
            ok_start = bool(g["ok"][0, -1])
            gate_fine = g["ok"][0, :F]
            idx = np.where(gate_fine & (fine >= m.start - 1e-9))[0]
            ready_t = float(fine[idx[0]]) if len(idx) else None
            if not ok_start:
                chain.append({"gate_id": g["id"], "label": g["label"], "ready": _day_str(ready_t) if ready_t is not None else None,
                              "why": _planned_why(world, world.ships[s], g, m, r[s])})
        for pe in m.prereqs:
            if pe in own and not make(pe):
                chain.append({"gate_id": f"prereq:{pe}", "label": f"{_mission(world, pe).label} must succeed first", "ready": None,
                              "why": [f"{_mission(world, pe).label} planned MISS"]})
        if mk:
            idx = np.where(allfine & (fine >= world.cursor - 1e-9))[0]
            rd = float(fine[idx[0]]) if len(idx) else world.cursor
            margin = m.start - rd
            ready_date = _day_str(rd)
        else:
            idx = np.where(allfine & (fine >= m.start - 1e-9))[0]
            rd = float(fine[idx[0]]) if (len(idx) and prereq_ok) else None
            margin = (m.start - rd) if rd is not None else None
            ready_date = _day_str(rd)
        out[eid] = {"result": "MAKE" if mk else "MISS", "ready_date": ready_date,
                    "ready_dtg": format_dtg(dt_of(rd)) if rd is not None else None,
                    "margin_days": round(margin, 2) if margin is not None else None, "chain": chain,
                    "label": "Planned (on stated ETAs)"}
    return out


def _planned_why(world, sw, g, m, r) -> list[str]:
    why = []
    if g["kind"] == "system":
        comps = {c["eic"] for c in SYSTEMS[g["eic"]]["components"]} | {g["eic"]}
        for obj, arr in r["info"]:
            if isinstance(obj, Item) and obj.eic in comps and obj.start <= m.start < obj.planned_end():
                pe = obj.planned_end()
                why.append(f"{obj.title}: ready {format_dtg(dt_of(pe)) if pe < INF / 2 else 'not in horizon'}")
                why += [f"  {e}" for e in obj.explain]
    elif g["kind"] == "team":
        col = len(r["T"]) - len(sw.missions) + sw.missions.index(m)
        cnt = int(r["teams"][g["ws"]][0, col])
        why.append(f"{cnt} of {g['k']} required aboard at mission start")
        for h, aboard in r["team_det"][g["ws"]]:
            for a, z, w, _s in h.off:
                if a <= m.start < z:
                    why.append(f"  {h.rate} {h.member_id}: {w} {format_dtg(dt_of(a))}" + (f" to {format_dtg(dt_of(z))}" if z < INF / 2 else ""))
    elif g["kind"] == "training":
        why.append(f"{g['t']['name']} expires {format_dtg(dt_of(g['t']['expires']))}")
    elif g["kind"] == "cert":
        why.append(f"{g['cert_id']} not certified or expired")
    elif g["kind"] == "avail":
        why.append(f"{g['avail_id']} completes after mission start")
    return why


# ====================================================================== domino graph (networkx export)
def domino_graph(fc: dict, ship_id: str, event_id: str | None = None) -> dict:
    import networkx as nx
    G = nx.DiGraph()
    for m in fc["missions"]:
        if m["ship_id"] != ship_id or (event_id and m["event_id"] != event_id):
            continue
        mid = f"mission:{m['event_id']}"
        G.add_node(mid, kind="mission", label=f"{m['label']}: {m['name']}", p=m["p_ready"], band=m["band"])
        for g in m["gates"]:
            gid = f"{m['event_id']}|{g['gate_id']}"
            G.add_node(gid, kind=g["kind"], label=g["label"], p=g["p_ok"], uplift=g["uplift"], next=(g["gate_id"] == m["next_domino"]))
            G.add_edge(gid, mid)
            for it in g.get("items", []):
                iid = f"{gid}|{it['key']}"
                pa = it.get("p_active_at_mission")
                p_ok = (1 - pa) if pa is not None else it.get("p_aboard_at_mission", 1 - (it.get("p_fail_before_mission") or 0))
                if it["kind"] == "hazard" and (it.get("p_fail_before_mission") or 0) < 0.01:
                    continue
                G.add_node(iid, kind=it["kind"], label=it["title"], p=p_ok)
                G.add_edge(iid, gid)
    assert nx.is_directed_acyclic_graph(G)
    return {"nodes": [{"id": n, **d} for n, d in G.nodes(data=True)], "edges": [{"source": a, "target": b} for a, b in G.edges()]}
