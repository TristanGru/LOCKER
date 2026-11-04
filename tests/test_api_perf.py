"""R8 (stale version -> 409) and R3 (performance budgets)."""
import time

import pytest
from fastapi.testclient import TestClient

from missiontwin.api import AppState, create_app
from missiontwin.engine import Scenario, build_world, forecast
from missiontwin.fixes import rank_fixes


@pytest.fixture()
def client(data_dir, offline_client, tmp_path):
    st = AppState(data_dir=data_dir, log_path=tmp_path / "a.jsonl", client=offline_client)
    return TestClient(create_app(st)), st


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
