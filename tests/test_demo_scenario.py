"""Golden demo test (R12): real generators -> ingest -> 4 feed events -> mechanics, not chosen outcomes."""
import copy

import numpy as np

from missiontwin.engine import Scenario, apply_fix, build_world, forecast
from missiontwin.fixes import rank_fixes

RUNS = 4000


def mission(fc, eid):
    return next(m for m in fc["missions"] if m["event_id"] == eid)


def test_each_event_lowers_or_holds_mission_a(baseline, log_path):
    s = Scenario(baseline, log_path=log_path)
    prev = mission(forecast(build_world(s), runs=RUNS), "EVT-KESSLER-01")["p_ready"]
    assert len(baseline.feed["events"]) == 4
    for _ in range(4):
        s.apply("play_event", {})
        p = mission(forecast(build_world(s), runs=RUNS), "EVT-KESSLER-01")["p_ready"]
        assert p <= prev + 1e-9, f"event {s.played()[-1]} raised Mission A from {prev} to {p}"
        prev = p


def test_next_domino_is_largest_uplift_gate(baseline, log_path):
    s = Scenario(baseline, log_path=log_path)
    for _ in range(4):
        s.apply("play_event", {})
        fc = forecast(build_world(s), runs=RUNS)
        for m in fc["missions"]:
            if not m["next_domino"]:
                continue
            best = max(m["gates"], key=lambda g: (g["uplift"], -g["p_ok"]))
            if best["uplift"] > 0.005:
                assert m["next_domino"] == best["gate_id"]


def test_borrow_raises_receiver_and_lowers_or_holds_donor(baseline, log_path):
    s = Scenario(baseline, log_path=log_path)
    for _ in range(4):
        s.apply("play_event", {})
    w0 = build_world(s)
    base = forecast(w0, runs=RUNS, detail=False)
    item = next(i for i in w0.ships["KESSLER"].items if i.part_niin == "019990001")
    fix = {"fix_id": "T", "title": "borrow", "steps": [
        {"kind": "part_transfer", "source_kind": "cross_deck", "niin": "019990001", "donor": "VARNELL", "receiver": "KESSLER", "item_key": item.key},
        {"kind": "crew_loan", "member_id": "M-0412", "donor": "ASHBY", "receiver": "KESSLER", "ws": "4310", "return_day": 16.0}]}
    w1 = copy.deepcopy(w0)
    apply_fix(w1, fix, w0.cursor)
    after = forecast(w1, runs=RUNS, detail=False)
    assert mission(after, "EVT-KESSLER-01")["p_ready"] > mission(base, "EVT-KESSLER-01")["p_ready"]
    for eid in ("EVT-VARNELL-01", "EVT-ASHBY-01"):
        assert mission(after, eid)["p_ready"] <= mission(base, eid)["p_ready"] + 1e-9
    assert after["ships"]["VARNELL"]["capability_mean"] <= base["ships"]["VARNELL"]["capability_mean"] + 1e-9


def test_fix_ranking_deterministic_and_follows_rule(baseline, log_path):
    s = Scenario(baseline, log_path=log_path)
    for _ in range(4):
        s.apply("play_event", {})
    r1 = rank_fixes(s, "KESSLER", runs=1000)
    r2 = rank_fixes(s, "KESSLER", runs=1000)
    assert [c["fix_id"] for c in r1["candidates"]] == [c["fix_id"] for c in r2["candidates"]]
    keys = [(c["net_green"], round(c["own_uplift"], 3), round(c["donor_cost"], 3), -len(c["steps"])) for c in r1["candidates"]]
    assert keys == sorted(keys, reverse=True)
    assert r1["candidates"], "the demo data must support at least one fix"


def test_approved_fix_is_what_the_forecast_shows(baseline, log_path):
    """Whatever wins is what the demo shows: approving the top fix reproduces its ranked effect direction."""
    s = Scenario(baseline, log_path=log_path)
    for _ in range(4):
        s.apply("play_event", {})
    r = rank_fixes(s, "KESSLER", runs=1000)
    top = r["candidates"][0]
    s.apply("fix_decision", {"decision": "approve", "fix": {k: top[k] for k in ("fix_id", "title", "steps")}})
    fc = forecast(build_world(s), runs=1000, detail=False)
    for m in top["missions"]:
        assert abs(mission(fc, m['event_id'])['p_assessed'] - m['p_after']) < 0.02
