"""R8 (stale version -> 409) and R3 (performance budgets)."""
import time

import pytest
from fastapi.testclient import TestClient

from missiontwin.api import AppState, create_app
from missiontwin.engine import Scenario, build_world, forecast
from missiontwin.fixes import rank_fixes
from conftest import signed_in


@pytest.fixture()
def client(data_dir, offline_client, tmp_path):
    st = AppState(data_dir=data_dir, log_path=tmp_path / "a.jsonl", client=offline_client)
    return signed_in(create_app(st)), st


def test_stale_version_409(client):
    c, st = client
    v = c.get("/api/scenario/version").json()["version"]
    assert c.post("/api/events/play", json={"base_version": v}).status_code == 200
    n = len(st.scenario.changes)
    r = c.post("/api/events/play", json={"base_version": v})
    assert r.status_code == 409
    assert len(st.scenario.changes) == n


def test_source_record_opens(client):
    c, _ = client
    fc = c.get("/api/forecast").json()
    src = fc["missions"][0]["sources"][-1]
    r = c.get("/api/source", params={"file": src["file"], "loc": src["loc"]})
    assert r.status_code == 200 and r.json()["lines"]
    assert c.get("/api/source", params={"file": "../../README.md"}).status_code in (400, 404)


def test_preview_isolated_and_versioned(client):
    connection, state = client
    before = connection.get("/api/forecast").json()
    response = connection.post("/api/preview", json={"base_version": 0, "kind": "action",
        "action": {"type": "shift_mission", "event_id": "EVT-KESSLER-01", "days": 2}})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["persisted"] is False
    assert result["before"]["missions"][0]["start"] != result["after"]["missions"][0]["start"]
    assert state.scenario.version == 0 and state.scenario.changes == []
    assert not state.scenario.log_path.exists()
    assert connection.get("/api/forecast").json() == before
    connection.post("/api/events/play", json={"base_version": 0})
    assert connection.post("/api/preview", json={"base_version": 0, "kind": "set_assumption",
        "key": "transit_days_conus_default", "value": 6}).status_code == 409


def test_visual_registry_and_interval_assessment(client):
    connection, state = client
    data = connection.get("/api/dashboard").json()
    registry = data["visualization"]
    assert set(registry["mission_areas"]) == {"AW", "ASW", "SUW", "MOB", "CCC", "PIER", "HDLG", "BASE", "MOBL"}
    assert all(mount in registry["mounts"] for item in registry["systems"] for mount in item["mounts"])
    for mission in data["forecast"]["missions"]:
        assert 0 <= mission["interval_p_ready"] <= mission["p_ready"] + .001
        assert mission["interval_gates"] and mission["end"] > mission["start"]


def test_dashboard_consistent_snapshot(client):
    connection, state = client
    result = connection.get("/api/dashboard")
    assert result.status_code == 200
    data = result.json()
    assert data["state"]["version"] == data["forecast"]["version"] == data["log"]["version"]
    assert data["baseline"]["missions"] and data["issues"]["ingest_issues"] == []
    assert not state.scenario.log_path.exists()


def test_invalid_proposal_does_not_mutate(client):
    connection, state = client
    body = {"base_version": 0, "kind": "action", "action": {
        "type": "remove_person", "ship_id": "KESSLER", "member_id": "M-NOT-REAL", "from_time": "2026-11-10T00:00:00Z"}}
    assert connection.post("/api/preview", json=body).status_code == 422
    assert connection.post("/api/changes", json=body).status_code == 422
    assert state.scenario.version == 0 and not state.scenario.changes


def test_incompatible_tree_blocks_forecast(client):
    connection, state = client
    state.baseline.configuration_errors.append("Incompatible tree")
    assert connection.get("/api/dashboard").status_code == 422
    assert connection.get("/api/forecast").status_code == 422


def test_reference_source_is_separate_and_contained(client):
    connection, state = client
    response = connection.get("/api/source", params={"profile": "reference", "file": "KESSLER/roster.csv"})
    assert response.status_code == 200
    assert "NOT used by forecast" in response.json()["meta"]["real_system"]
    assert connection.get("/api/source", params={"profile": "reference", "file": "../../README.md"}).status_code == 400


def test_source_files_unchanged_by_demo(client, data_dir):
    import hashlib
    def digest():
        h = hashlib.sha256()
        for p in sorted(data_dir.rglob("*")):
            if p.is_file():
                h.update(p.read_bytes())
        return h.hexdigest()
    before = digest()
    c, st = client
    v = st.scenario.version
    for _ in range(4):
        v = c.post("/api/events/play", json={"base_version": v}).json()["version"]
    top = c.get("/api/fixes/KESSLER").json()["candidates"][0]
    v = c.post("/api/fixes/decide", json={"base_version": v, "fix_id": top["fix_id"], "decision": "approve"}).json()["version"]
    c.post("/api/brief", json={"ship_id": "KESSLER"})
    c.post("/api/reset", json={"base_version": v})
    assert digest() == before


def test_perf_budgets(baseline, tmp_path):
    s = Scenario(baseline, log_path=tmp_path / "p.jsonl")
    for _ in range(4):
        s.apply("play_event", {})
    forecast(build_world(s), runs=500)  # warm imports
    s.apply("set_assumption", {"key": "transit_days_conus_default", "value": 5.5})
    t = time.perf_counter()
    forecast(build_world(s), runs=10000)
    t_fc = time.perf_counter() - t
    t = time.perf_counter()
    r = rank_fixes(s, "KESSLER", runs=2000)
    t_rank = time.perf_counter() - t
    print(f"\nforecast 10k runs: {t_fc:.2f}s; ranking {len(r['candidates'])} candidates x 2000 runs: {t_rank:.2f}s")
    assert t_fc < 2.0
    assert t_rank < 10.0


def test_reference_review_report_is_built_on_a_fresh_checkout(client, tmp_path, monkeypatch):
    """data/normalized is gitignored: CI and new clones have none, and the review profile must still explain itself."""
    import missiontwin.api as api
    missing = tmp_path / "normalized"
    monkeypatch.setattr(api, "NORMALIZED_ROOT", missing)
    c, _ = client
    reference = c.get("/api/data-contract").json()["reference"]
    assert reference and reference["activation"] == "REVIEW_ONLY" and "quarantine" not in reference
    assert (missing / "import_report.json").exists()
    assert c.get("/api/data-contract").json()["reference"] == reference  # second request reads the built report
