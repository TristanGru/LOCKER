"""Fix candidates and squadron ranking.

Search order follows the Gridley case (spec 05): wholesale, program office, then sister ships.
Every candidate is evaluated on the SAME random draws (common random numbers, ranking_runs each) so close
fixes don't swap order from noise. Ranking: net squadron missions in green, then own-ship uplift in P(ready),
then lower donor cost, then fewer actions. The captain approves, rejects or edits; nothing auto-applies.

Only options that help are offered: a candidate must add a squadron event in green or raise the ship's own interval
readiness on one of its events by at least MIN_GAIN, and a package is dropped when a smaller package of its own steps does as well.
Steps that provably cannot change the forecast are not generated.
"""
from __future__ import annotations

import copy
import hashlib
import itertools
import json
import time

from .domain import SHIP_IDS, SHIPS, SYSTEMS, WATCHSTATIONS, COMPONENT_TO_SYSTEM, band, format_dtg, dt_of, parts_index
from .engine import INF, Scenario, apply_fix, build_world, first_common_port, forecast, inport_place, mission_display, pval
from .validation import validate_world


# Smallest improvement in one of the ship's own events (interval probability) worth asking a human to approve.
# One point: below the whole-percent precision the UI and brief display, and above common-random-number noise.
MIN_GAIN = 0.01


def _fid(steps: list) -> str:
    return "FX-" + hashlib.sha1(json.dumps(steps, sort_keys=True).encode()).hexdigest()[:8].upper()


def _single_steps(world, fc: dict, ship_id: str) -> list[dict]:
    """Single-step candidates against blocking gates, following dependencies into a supporting installation."""
    SHIPS, SYSTEMS = world.profile.ships, world.profile.systems
    profile = world.profile
    dt_of = profile.dt_of
    bands = fc['bands']
    pidx = profile.parts_index()
    out, seen = [], set()
    units = profile.ship_ids

    def add(step, title, gate, why, unit):
        key = json.dumps(step, sort_keys=True)
        if key in seen:
            return
        seen.add(key)
        out.append({"step": step, "title": title, "gate": gate, "why": why, "unit": unit})

    def visit(m):
        unit = m["ship_id"]
        ashore = profile.kind_of(unit) == "installation"
        sw = world.ships[unit]
        mobj = next(x for x in sw.missions if x.event_id == m["event_id"])
        for g in m["gates"]:
            if g["p_ok"] >= 0.995:
                continue
            gid = f"{m['event_id']}|{g['gate_id']}"
            if g["kind"] == "system":
                for it in g.get("items", []):
                    if it["kind"] not in ("casualty",) or (it.get("p_active_at_mission") or 0) < 0.02:
                        continue
                    item = next((i for i in sw.items if i.key == it["key"]), None)
                    if not item or not item.part_niin:
                        continue
                    niin = item.part_niin
                    for d in units:
                        if d == unit:
                            continue
                        stock = world.ships[d].stock.get(niin, {})
                        if stock.get('on_hand', 0) > 0 and stock.get('eligible'):
                            note = "drops donor below allowance (X5)" if stock["on_hand"] <= stock["allowance"] else ""
                            add({"kind": "part_transfer", "source_kind": "cross_deck", "niin": niin, "donor": d, "receiver": unit,
                                 "item_key": item.key},
                                f"Borrow NIIN {niin} from {SHIPS[d]['name']} storeroom", gid,
                                f"{d} holds {stock['on_hand']} of allowance {stock['allowance']}. {note}".strip(), unit)
                        donor_components = profile.eics_for(d)
                        for sys_eic, comp, inst, minw in pidx.get(niin, []):
                            if comp not in donor_components or (not ashore and comp != item.eic):
                                continue
                            if any(i.eic == comp and i.score < 1 for i in world.ships[d].items):
                                continue
                            add({"kind": "part_transfer", "source_kind": "cannibalize", "niin": niin, "donor": d, "receiver": unit,
                                 "item_key": item.key, "donor_comp": comp, "installed": inst, "min_working": minw},
                                f"Cannibalize NIIN {niin} from {SHIPS[d]['name']} installed {comp}", gid,
                                f"Degrades {d} {SYSTEMS[sys_eic]['name']} until its own replacement arrives; double work (GAO).", unit)
                    for w in world.wholesale.get(niin, []):
                        if w["on_hand_qty"] > 0 and w["holder"] in ("PROGRAM_OFFICE", "NAVSUP_WSS"):
                            add({"kind": "part_transfer", "source_kind": "wholesale", "holder": w["holder"], "niin": niin,
                                 "receiver": unit, "item_key": item.key},
                                f"Pull NIIN {niin} from {w['holder_name']}", gid,
                                f"{w['holder']} on hand {w['on_hand_qty']}" + ("; ISEA engineering validation required" if w["requires_engineering_validation"] else ""), unit)
                    # Expedite moves one regime faster only when wholesale has stock; otherwise apply_fix is a no-op.
                    if sum(w["on_hand_qty"] for w in world.wholesale.get(niin, []) if w["holder"] in ("NAVSUP_WSS", "DLA")) > 0:
                        add({"kind": "expedite", "receiver": unit, "item_key": item.key, "doc_number": item.doc_number},
                            f"Expedite requisition {item.doc_number} (OTS/GDSC)", gid,
                            "Ledger: one regime faster because wholesale has stock.", unit)
            elif g["kind"] == "team":
                ws = g["gate_id"].split(":")[1]
                for d in units:
                    if d == unit:
                        continue
                    donors = [h for h in world.ships[d].holders.get(ws, []) if not h.off and not h.loan_from]
                    if not donors:
                        continue
                    h = sorted(donors, key=lambda x: x.member_id)[0]
                    t0 = first_common_port(world, d, unit, world.cursor)
                    if t0 >= INF:
                        continue
                    verb = "Temporarily assign" if ashore else "Cross-deck"
                    add({"kind": "crew_loan", "member_id": h.member_id, "donor": d, "receiver": unit, "ws": ws,
                         "return_day": round(mobj.end + 0.5, 3)},
                        f"{verb} {h.rate} {h.member_id} ({ws}) from {SHIPS[d]['name']} through {mission_display(m)}", gid,
                        f"{d} has {len(world.ships[d].holders.get(ws, []))} qualified on {ws}; available from {format_dtg(dt_of(max(t0, world.cursor)))}.", unit)
            elif g["kind"] == "training":
                t = next((x for x in sw.trainings if f"training:{x['id']}" == g["gate_id"]), None)
                if t:
                    day = None
                    d0 = max(world.cursor + 1, 0)
                    x = d0
                    while x < mobj.start - 1:
                        if inport_place(sw, x):
                            day = x
                            break
                        x += 1
                    # A refresh already scheduled before the expiry leaves no lapse; moving it earlier (same success
                    # draw) cannot change the gate, so only offer a refresh that closes or shortens a lapse.
                    gap = t["refresh"] is None or t["refresh"] > t["expires"]
                    if day is not None and gap and (t["refresh"] is None or t["refresh"] > day):
                        where = "before the support window" if ashore else "in port"
                        add({"kind": "schedule_training", "ship": unit, "requirement_id": t["id"], "day": round(day, 2)},
                            f"Run {t['name']} {where} {format_dtg(dt_of(day))}", gid, "Training refresh must happen before the event.", unit)
            elif g["kind"] == "prereq" and g.get("supporting_event"):
                parent = next(x for x in fc["missions"] if x["event_id"] == g["supporting_event"])
                if parent["p_assessed"] is not None and parent["p_assessed"] < bands["green"]:
                    visit(parent)
        # Schedule shifts always move the ship event; a support window follows it.
        target = next((x for sx in world.ships.values() for x in sx.missions if x.event_id == mobj.supports), mobj) if mobj.supports else mobj
        owner = world.ships[target.ship]
        for days in (4, 7):
            later = [x for x in owner.missions if x.start > target.start and x.event_id != target.event_id]
            if all(target.end + days < x.start for x in later):
                add({"kind": "shift_mission", "event_id": target.event_id, "days": days},
                    f"Ask ISIC to shift {target.display} ({target.ship}) {days} days later", f"{target.event_id}|schedule",
                    "Requires ISIC/TYCOM approval; schedule shows no conflict with this ship's later events.", target.ship)

    for m in fc["missions"]:
        if m['ship_id'] != ship_id or m['p_assessed'] is None or m['p_assessed'] >= bands['green']:
            continue
        visit(m)
    return out


def candidates(world, fc: dict, ship_id: str, max_pairs: int = 30) -> list[dict]:
    singles = _single_steps(world, fc, ship_id)
    plans = [{"steps": [s["step"]], "title": s["title"], "why": [s["why"]], "gates": [s["gate"]]} for s in singles]
    pairs = []
    for a, b in itertools.combinations(singles, 2):
        if a["gate"] == b["gate"]:
            continue
        if a["step"].get("item_key") and a["step"].get("item_key") == b["step"].get("item_key"):
            continue
        if a["step"]["kind"] == b["step"]["kind"] == "shift_mission":
            continue
        pairs.append({"steps": [a["step"], b["step"]], "title": f"{a['title']} + {b['title']}", "why": [a["why"], b["why"]],
                      "gates": [a["gate"], b["gate"]]})
    plans += pairs[:max_pairs]
    # Independent ship and shore blockers can each hold an event at zero, so a useful package may need both.
    shore_steps = [s for s in singles if s["unit"] != ship_id and s["step"]["kind"] == "part_transfer"]
    own_pairs = [p for p in pairs if all(step.get("receiver", step.get("ship")) == ship_id for step in p["steps"])][:8]
    for pair in own_pairs:
        for shore in shore_steps:
            plans.append({"steps": pair["steps"] + [shore["step"]], "title": f"{pair['title']} + {shore['title']}",
                          "why": pair["why"] + [shore["why"]], "gates": pair["gates"] + [shore["gate"]]})
    for p in plans:
        p["fix_id"] = _fid(p["steps"])
    return plans


def rank_fixes(scn: Scenario, ship_id: str, runs: int | None = None) -> dict:
    t0 = time.time()
    base_world = build_world(scn)
    SHIP_IDS = base_world.profile.ship_ids
    runs = int(runs or pval(base_world.params, "ranking_runs"))
    seed = int(pval(base_world.params, "seed"))
    fc_detail = forecast(base_world)  # memoized; identifies blocking gates and items
    base = forecast(base_world, runs=runs, seed=seed, detail=False)
    bands = base['bands']
    if any(m['p_assessed'] is None for m in base['missions']):
        return {'ship_id': ship_id, 'candidates': [], 'runs_per_candidate': runs, 'rule': 'event interval',
                'assessment_basis': 'event_interval', 'warning': 'Insufficient source coverage; options withheld to avoid hiding donor risk'}

    def summarize(fc):
        mp = {m['event_id']: m['p_assessed'] for m in fc['missions']}
        green = sum(1 for p in mp.values() if p >= bands["green"])
        return mp, green

    base_mp, base_green = summarize(base)
    own_ids = [m["event_id"] for m in base["missions"] if m["ship_id"] == ship_id]
    plans = candidates(base_world, fc_detail, ship_id)
    results = []
    evaluation, base_world.last_evaluation = base_world.last_evaluation, None
    reuse = (runs, seed, evaluation['units']) if evaluation and evaluation['runs'] == runs and evaluation['seed'] == seed else None
    shared = (base_world.profile, base_world.coverage, base_world.reported_baseline)
    for p in plans:
        w = copy.deepcopy(base_world, {id(item): item for item in shared})  # read-only parts are shared, not copied
        w.reuse = reuse
        try:
            apply_fix(w, {'fix_id': p['fix_id'], 'title': p['title'], 'steps': p['steps']}, base_world.cursor)
            validate_world(w)
        except ValueError:
            continue  # infeasible packages are not offered for approval
        fc = forecast(w, runs=runs, seed=seed, detail=False)
        mp, green = summarize(fc)
        own_uplift = sum(mp[e] - base_mp[e] for e in own_ids)
        donor = {}
        for s in SHIP_IDS:
            if s == ship_id:
                continue
            dm = sum(mp[m['event_id']] - base_mp[m['event_id']] for m in fc['missions'] if m['ship_id'] == s)
            dc = fc["ships"][s]["capability_mean"] - base["ships"][s]["capability_mean"]
            if abs(dm) > 0.0005 or abs(dc) > 0.0005:
                donor[s] = {"mission_p_delta": round(dm, 4), "capability_delta": round(dc, 4)}
        donor_cost = sum(min(0.0, v["mission_p_delta"]) + min(0.0, v["capability_delta"]) for v in donor.values())
        missions = [{"event_id": m["event_id"], "label": m["label"], "codename": m.get("codename", ""), "display": m.get("display", m["label"]), "ship_id": m["ship_id"], "p_before": base_mp[m["event_id"]],
                     "p_after": m['p_assessed'], 'start_p_after': m['p_ready'], "band_after": m["band"], "planned": m["planned"]} for m in fc["missions"]]
        results.append({**p, "net_green": green - base_green, "green_after": green, "own_uplift": round(own_uplift, 4),
                        "donor_effects": donor, "donor_cost": round(donor_cost, 4), "missions": missions,
                        "score": [green - base_green, round(own_uplift, 3), round(donor_cost, 3), -len(p["steps"])]})
    evaluated = len(results)
    results, pruned = _prune(results, ship_id)
    results.sort(key=lambda r: (r["net_green"], round(r["own_uplift"], 3), round(r["donor_cost"], 3), -len(r["steps"])), reverse=True)
    for i, r in enumerate(results, 1):
        r["rank"] = i
    out = {"ship_id": ship_id, "runs_per_candidate": runs, "seed": seed, "cursor": base["cursor"], "baseline": base_mp,
           "baseline_green": base_green, "candidates": results, "elapsed_s": round(time.time() - t0, 2),
           "rule": "interval readiness: net squadron events green, receiver improvement, donor cost, then fewer actions",
           'assessment_basis': 'event_interval', "common_random_numbers": True,
           "evaluated": evaluated, "pruned": pruned, "min_gain": MIN_GAIN}
    if not results:
        out["note"] = (f"None of the {evaluated} options evaluated raises a {ship_id} event's interval readiness by "
                       f"{MIN_GAIN * 100:.0f} point or more, or adds an event in green." if evaluated else
                       f"No option is available for {ship_id}'s current blockers.")
    return out


def _prune(results: list[dict], ship_id: str) -> tuple[list[dict], dict]:
    """Keep options a human should weigh: drop those that do not help, then packages whose extra steps add nothing."""
    def best_gain(r):  # largest improvement on any one of this ship's events (a summed uplift double-counts prerequisites)
        return max((m["p_after"] - m["p_before"] for m in r["missions"] if m["ship_id"] == ship_id), default=0.0)

    helpful = [r for r in results if r["net_green"] > 0 or best_gain(r) >= MIN_GAIN]
    step_sets = {id(r): {json.dumps(s, sort_keys=True) for s in r["steps"]} for r in helpful}

    def covers(q, r):  # q is a strict sub-package of r and is at least as good on every ranking criterion
        return (step_sets[id(q)] < step_sets[id(r)] and q["net_green"] >= r["net_green"]
                and q["own_uplift"] >= r["own_uplift"] - MIN_GAIN and q["donor_cost"] >= r["donor_cost"] - MIN_GAIN)

    kept = [r for r in helpful if not any(covers(q, r) for q in helpful)]
    return kept, {"no_gain": len(results) - len(helpful), "redundant_steps": len(helpful) - len(kept)}
