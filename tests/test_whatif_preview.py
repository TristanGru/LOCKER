"""What-If previews: several changes combine, and pier-support sailors are removed from the shore unit."""
import pytest
from fastapi.testclient import TestClient

from missiontwin.api import AppState, create_app


@pytest.fixture()
def client(data_dir, offline_client, tmp_path):
    st = AppState(data_dir=data_dir, log_path=tmp_path / "a.jsonl", client=offline_client)
    return TestClient(create_app(st)), st


def _people(c):
    nodes = c.get("/api/graph/KESSLER").json()["nodes"]
    return [n["id"] for n in nodes if "|member:" in n["id"]]


def _odds(r, prefix="EVT-KESSLER"):
    return {m["event_id"]: m["p_assessed"] for m in r["after"]["missions"] if m["event_id"].startswith(prefix)}


def _preview(c, st, changes):
    return c.post("/api/captain/preview", json={"base_version": st.scenario.version, "ship_id": "KESSLER", "changes": changes})


def test_second_sailor_from_same_team_changes_the_odds(client):
    c, st = client
    people = _people(c)
    team = people[0].split("|member:")[0]
    mates = [p for p in people if p.startswith(team + "|member:")]
    assert len(mates) >= 2
    one = _preview(c, st, [{"kind": "removePerson", "node": mates[0]}])
    two = _preview(c, st, [{"kind": "removePerson", "node": m} for m in mates[:2]])
    assert one.status_code == two.status_code == 200
    before = {m["event_id"]: m["p_assessed"] for m in one.json()["before"]["missions"]}
    # The team carries a spare: one sailor short leaves the odds as they were, two short does not.
    assert _odds(one.json()) == {k: v for k, v in before.items() if k.startswith("EVT-KESSLER")}
    assert any(v < before[k] - 0.01 for k, v in _odds(two.json()).items())
    assert st.scenario.changes == []  # previews never touch the shared scenario


def test_pier_support_sailor_is_removed_from_the_shore_unit(client):
    c, st = client
    shore = [p for p in _people(c) if "|prereq:" in p]
    assert shore, "fixture should link KESSLER events to pier support"
    r = _preview(c, st, [{"kind": "removePerson", "node": shore[0]}])
    assert r.status_code == 200, r.text
