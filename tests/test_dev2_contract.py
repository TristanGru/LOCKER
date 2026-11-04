"""DEV 2 API and daily probability contract, exercised through the public endpoints."""
from datetime import timedelta

from fastapi.testclient import TestClient
import pytest

from missiontwin.api import AppState, create_app
from missiontwin.domain import SCENARIO_NOW, parse_ts
from missiontwin.engine import Scenario, build_world, forecast


@pytest.fixture
def api(data_dir, offline_client, tmp_path):
    return TestClient(create_app(AppState(data_dir, tmp_path / "activity.jsonl", offline_client)))


def test_results_has_thirty_daily_probabilities_for_every_graph_node(api):
    response = api.get("/results")
    assert response.status_code == 200
    result = response.json()
    assert result["runs"] == 500 and result["seed"] == 20261104
    assert result["horizon_days"] == 30
    dates = [parse_ts(d) for d in result["grid_dates"]]
    assert len(dates) == 30
    assert all(b - a == timedelta(days=1) for a, b in zip(dates, dates[1:]))
    nodes = result["nodes"]
    assert nodes and len({n["id"] for n in nodes}) == len(nodes)
    for node in nodes:
        assert len(node["p_ready"]) == 30
        assert all(0 <= p <= 1 for p in node["p_ready"])
    ids = {n["id"] for n in nodes}
    assert all(e["source"] in ids and e["target"] in ids for e in result["edges"])
    for mission in result["missions"]:
        node = next(n for n in nodes if n["id"] == f"mission:{mission['event_id']}")
        assert node["p_ready"] == mission["curve"]
    assert api.get("/results").json() == result


def test_scenario_applies_and_returns_new_forecast_with_version(api):
    before = api.get("/results").json()
    response = api.post("/scenario", json={"base_version": before["version"], "action": {
        "type": "add_casrep", "ship_id": "KESSLER", "eic": "SPY1D", "category": 4,
        "etr": "2026-12-10T00:00:00Z"}})
    assert response.status_code == 200
    after = response.json()
    assert after["version"] == after["results"]["version"] == before["version"] + 1
    assert after["results"] == api.get("/results").json()
    p_before = next(m["p_ready"] for m in before["missions"] if m["event_id"] == "EVT-KESSLER-01")
    p_after = next(m["p_ready"] for m in after["results"]["missions"] if m["event_id"] == "EVT-KESSLER-01")
    assert p_before > 0 and p_after == 0
    assert api.post("/scenario", json={"base_version": 0, "kind": "play_event"}).status_code == 409


@pytest.mark.parametrize("action", [
    {"type": "add_casrep", "ship_id": "KESSLER", "eic": "INVENTED", "category": 4, "etr": "2026-12-10T00:00:00Z"},
    {"type": "shift_mission", "event_id": "INVENTED", "days": 2},
    {"type": "remove_person", "ship_id": "KESSLER", "member_id": "M-9999", "from_time": "2026-11-10T00:00:00Z"},
    {"type": "delay_part", "ship_id": "KESSLER", "doc_number": "INVENTED", "days": 2},
])
def test_unknown_references_do_not_mutate_scenario(api, action):
    response = api.post("/scenario", json={"base_version": 0, "action": action})
    assert response.status_code == 422
    assert api.get("/api/scenario/version").json()["version"] == 0
    assert api.get("/api/log").json()["changes"] == []


def test_item_daily_probability_recovers_when_repaired(baseline, log_path):
    scenario = Scenario(baseline, log_path)
    scenario.apply("set_assumption", {"key": "etr_slip.p_slip", "value": 0})
    scenario.apply("action", {"type": "add_casrep", "ship_id": "KESSLER", "eic": "SPY1D", "category": 4,
                              "etr": (SCENARIO_NOW + timedelta(days=2)).isoformat()})
    result = forecast(build_world(scenario), runs=500)
    items = [n for n in result["nodes"] if n["kind"] == "whatif"]
    assert items
    for item in items:
        assert item["p_ready"][:2] == [0.0, 0.0]
        assert item["p_ready"][2:] == [1.0] * 28


def test_thirty_day_window_follows_cursor_and_does_not_grow_with_mission_shift(api):
    before = api.get("/results").json()
    played = api.post("/scenario", json={"base_version": 0, "kind": "play_event"}).json()
    assert parse_ts(played["results"]["grid_dates"][0]) > parse_ts(before["grid_dates"][0])
    shifted = api.post("/scenario", json={"base_version": played["version"], "action": {
        "type": "shift_mission", "event_id": "EVT-KESSLER-01", "days": 40}}).json()["results"]
    assert shifted["horizon_days"] == 30 and len(shifted["grid_dates"]) == 30
    # Mission B cannot be ready while its prerequisite A is rescheduled after B.
    assert next(m["p_ready"] for m in shifted["missions"] if m["event_id"] == "EVT-KESSLER-02") == 0


def test_daily_prerequisite_probability_waits_for_completion(api):
    result = api.get("/results").json()
    mission_b = next(m for m in result["missions"] if m["event_id"] == "EVT-KESSLER-02")
    prereq = next(g for g in mission_b["gates"] if g["kind"] == "prereq")
    assert prereq["p_ready"][0] == 0
    assert prereq["p_ready"][-1] > 0
    assert any(e["source"] == "mission:EVT-KESSLER-01" and e["target"].endswith("prereq:EVT-KESSLER-01")
               for e in result["edges"])
