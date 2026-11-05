"""A part fix adds a supply route; it never cancels the open requisition. Wholesale release leads fall back to the ledger."""
import copy

import numpy as np

from missiontwin.engine import Scenario, apply_fix, build_world, forecast

PUMP = "V9910163080001"


def world_after(baseline, log_path, events):
    s = Scenario(baseline, log_path=log_path)
    for _ in range(events):
        s.apply("play_event", {})
    return build_world(s)


def pump(world):
    return next(i for i in world.ships["KESSLER"].items if i.doc_number == PUMP)


def pull(world, holder="PROGRAM_OFFICE"):
    apply_fix(world, {"fix_id": "FX-T", "title": "t", "steps": [
        {"kind": "part_transfer", "source_kind": "wholesale", "holder": holder, "niin": "019990001",
         "receiver": "KESSLER", "item_key": pump(world).key}]}, world.cursor)


def test_second_source_never_makes_the_part_later(baseline, log_path):
    # After E1 the open requisition (BB, near term) usually beats the program office route.
    base = world_after(baseline, log_path, 1)
    fixed = copy.deepcopy(base)
    pull(fixed)
    before, after = pump(base).sample_end(7, 4000), pump(fixed).sample_end(7, 4000)
    assert np.all(after <= before + 1e-9)
    assert pump(fixed).planned_end() <= pump(base).planned_end() + 1e-9
    assert pump(fixed).stages == pump(base).stages and len(pump(fixed).alternates) == 1
    p = lambda w: next(m for m in forecast(w, runs=1000, detail=False)["missions"] if m["event_id"] == "EVT-KESSLER-01")["p_assessed"]
    assert p(fixed) >= p(base) - 1e-9


def test_second_source_shortens_a_late_requisition(baseline, log_path):
    # After E2 the requisition slips to ESD 15 DEC; the program office part arrives first.
    base = world_after(baseline, log_path, 2)
    fixed = copy.deepcopy(base)
    pull(fixed)
    assert pump(fixed).planned_end() < pump(base).planned_end() - 10


def test_blank_release_lead_uses_ledger_assumption(baseline, log_path):
    world = world_after(baseline, log_path, 2)
    asset = next(w for w in world.wholesale["019990001"] if w["holder"] == "PROGRAM_OFFICE")
    asset["release_lead_days"] = None
    pull(world)
    release = pump(world).alternates[0][1][0]
    ledger = world.params["program_office_release_days"]["value"]
    assert release.kind == "uniform" and (release.a, release.b) == (ledger["min"], ledger["max"])
    assert "ledger" in release.label
