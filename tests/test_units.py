"""Unit tests for the approved review decisions: R1, R4, R5, R7, R8, R9, R10, R11, R13."""
import copy
import json
import shutil

import httpx
import numpy as np
import pytest
from pydantic import ValidationError

from missiontwin.domain import format_dtg, parse_dtg, parse_ts
from missiontwin.synthetic_spec import SCENARIO_NOW, day_of
from missiontwin.engine import CACHE_STATS, Scenario, build_world, forecast, planned_case, _evaluate, horizon_days
from missiontwin.ingest import load_baseline
from missiontwin.llm import FALLBACK_BADGE, LLMClient, llm_brief, nl_to_action
from missiontwin.models import ACTION_TYPES, ActionAdapter, RemovePerson, action_schema


# ---------------------------------------------------------------- R11
def test_dtg_round_trip():
    t = parse_dtg("041200Z NOV 26")
    assert t.isoformat() == "2026-11-04T12:00:00+00:00"
    assert format_dtg(t) == "041200Z NOV 26"


def test_zone_less_timestamp_rejected():
    with pytest.raises(ValueError):
        parse_ts("2026-11-04T08:00:00")
    with pytest.raises(ValidationError):
        RemovePerson(ship_id="KESSLER", member_id="M-0019", from_time="2026-11-08T00:00:00")


def test_day_boundary():
    # 0300Z on 5 Nov is still day 0 when counted in whole 24h periods from 0800Z on 4 Nov
    assert int(day_of(parse_ts("2026-11-05T03:00:00Z"))) == 0
    assert int(day_of(parse_ts("2026-11-05T08:00:00Z"))) == 1


# ---------------------------------------------------------------- R10
def test_one_malformed_row_isolated(data_dir, tmp_path, offline_client):
    d = tmp_path / "d"
    shutil.copytree(data_dir, d)
    p = d / "KESSLER" / "roster.csv"
    lines = p.read_text(encoding="utf-8").splitlines()
    n_rows = len(lines) - 1
    lines[6] = lines[6].replace("2026-10-14T08:00:00Z", "2026-10-14T08:00:00")  # zone-less (R11) on file line 7
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    b = load_baseline(d, offline_client)
    iss = [i for i in b.issues if i.file == "KESSLER/roster.csv"]
    assert len(iss) == 1 and iss[0].loc == "row 7"
    assert len(b.r("KESSLER", "roster.csv")) == n_rows - 1


# ---------------------------------------------------------------- R1 / R4 / R13
def test_planned_case_exact(baseline, log_path):
    s = Scenario(baseline, log_path=log_path)
    s.apply("play_event", {})
    s.apply("play_event", {})  # E2: BC, ESD 15 DEC
    w = build_world(s)
    item = next(i for i in w.ships["KESSLER"].items if i.doc_number == "V9910163080001")
    # status 05 NOV 1000Z (day 1.0833) ; ESD 15 DEC 0000Z (day 40.6667); +5 transit; +2 install (mode)
    expected = 1.08333 + (40.66667 - 1.08333) + 5 + 2
    assert abs(item.planned_end() - expected) < 1e-3
    pc = planned_case(w)
    assert pc["EVT-KESSLER-01"]["result"] == "MISS"


def test_planned_case_requires_prerequisite_to_finish_first(baseline, log_path):
    s = Scenario(baseline, log_path=log_path)
    assert planned_case(build_world(s))["EVT-KESSLER-02"]["result"] == "MAKE"
    s.apply("action", {"type": "shift_mission", "event_id": "EVT-KESSLER-01", "days": 40})
    planned_b = planned_case(build_world(s))["EVT-KESSLER-02"]
    assert planned_b["result"] == "MISS"
    assert any(c["gate_id"] == "prereq:EVT-KESSLER-01" for c in planned_b["chain"])


def test_same_seed_identical(baseline, log_path):
    s = Scenario(baseline, log_path=log_path)
    s.apply("play_event", {})
    w = build_world(s)
    T = {k: np.arange(0, 20, 1.0) for k in w.ships}
    a = _evaluate(w, T, 500, 7, False)
    b = _evaluate(copy.deepcopy(w), T, 500, 7, False)
    for ship in w.ships:
        for eic in a[ship]["sys"]:
            assert np.array_equal(a[ship]["sys"][eic], b[ship]["sys"][eic])


def test_reset_and_undo(baseline, log_path):
    s = Scenario(baseline, log_path=log_path)
    base = forecast(build_world(s), runs=300, detail=False)
    s.apply("play_event", {})
    one = forecast(build_world(s), runs=300, detail=False)
    s.apply("play_event", {})
    s.undo()
    assert forecast(build_world(s), runs=300, detail=False)["missions"] == one["missions"]
    s.reset()
    assert forecast(build_world(s), runs=300, detail=False)["missions"] == base["missions"]
    assert log_path.exists()


def test_forecast_memoized(baseline, log_path):
    s = Scenario(baseline, log_path=log_path)
    s.apply("set_assumption", {"key": "transit_days_conus_default", "value": 6.0})
    before = CACHE_STATS["runs"]
    forecast(build_world(s), runs=321, detail=False)
    forecast(build_world(s), runs=321, detail=False)
    assert CACHE_STATS["runs"] == before + 1


def test_assumption_edit_moves_forecast(baseline, log_path):
    s = Scenario(baseline, log_path=log_path)
    s.apply("play_event", {})
    p0 = forecast(build_world(s), runs=2000, detail=False)["missions"][0]["p_ready"]
    s.apply("set_assumption", {"key": "transit_days_conus_default", "value": 12.0})
    p1 = forecast(build_world(s), runs=2000, detail=False)["missions"][0]["p_ready"]
    assert p1 < p0


# ---------------------------------------------------------------- R7
def test_action_schema_single_source():
    sch = json.dumps(action_schema())
    for t in ACTION_TYPES:
        assert t in sch
    samples = {
        "remove_person": {"type": "remove_person", "ship_id": "KESSLER", "member_id": "M-0019", "from_time": "2026-11-08T00:00:00Z"},
        "delay_part": {"type": "delay_part", "ship_id": "KESSLER", "doc_number": "V9910163080001", "days": 3},
        "add_casrep": {"type": "add_casrep", "ship_id": "KESSLER", "eic": "GUN5-HYD", "category": 3, "etr": "2026-11-20T00:00:00Z"},
        "shift_mission": {"type": "shift_mission", "event_id": "EVT-KESSLER-01", "days": 2},
        "apply_fix": {"type": "apply_fix", "fix_id": "FX-1"},
    }
    assert set(samples) == set(ACTION_TYPES)
    for t, d in samples.items():
        assert ActionAdapter.validate_python(d).type == t


# ---------------------------------------------------------------- R5 / R9
def _timeout_transport():
    def handler(request):
        raise httpx.ReadTimeout("simulated", request=request)
    return httpx.MockTransport(handler)


def test_llm_timeout_falls_back_to_template(tmp_path):
    # demo_mode=False: CI sets MISSIONTWIN_DEMO_MODE=1, which would skip the endpoint this test times out.
    c = LLMClient(base_url="http://llm.invalid/v1", cache_dir=tmp_path, demo_mode=False, transport=_timeout_transport())
    text, src, badge = llm_brief(c, {"x": 1}, "DRAFT [1]", 1, "k")
    assert text == "DRAFT [1]" and src == "template" and badge == FALLBACK_BADGE
    act, src, badge = nl_to_action(c, "shift mission A two days", {})
    assert act is None and badge == FALLBACK_BADGE


def test_nl_action_validated_and_cached(tmp_path):
    calls = []

    def handler(request):
        calls.append(1)
        body = {"choices": [{"message": {"content": json.dumps({"type": "shift_mission", "event_id": "EVT-KESSLER-01", "days": 2})}}]}
        return httpx.Response(200, json=body)
    # demo_mode=False: CI sets MISSIONTWIN_DEMO_MODE=1, which forces the offline fallback and returns no action.
    c = LLMClient(base_url="http://llm.test/v1", cache_dir=tmp_path, demo_mode=False, transport=httpx.MockTransport(handler))
    a1, s1, _ = nl_to_action(c, "push mission A two days", {"ship": "KESSLER"})
    a2, s2, _ = nl_to_action(c, "push mission A two days", {"ship": "KESSLER"})
    assert a1.type == "shift_mission" and s1 == "llm" and s2 == "cache" and len(calls) == 1


def test_cache_key_changes_with_one_byte(tmp_path):
    c = LLMClient(base_url="", cache_dir=tmp_path)
    doc_a, doc_b = b"CASREP 041200Z NOV 26", b"CASREP 041200Z NOV 27"
    ka, kb = c.cache_key("extract", doc_a), c.cache_key("extract", doc_b)
    c.cache_put(ka, "extract", doc_a, {"facts": []})
    assert c.cache_get(ka) is not None
    assert c.cache_get(kb) is None
    assert c.cache_key("extract", doc_a) == ka
