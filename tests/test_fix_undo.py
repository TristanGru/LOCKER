"""Undoing a CO decision on one fix: any decision can be withdrawn, not only the newest change."""
import pytest

from missiontwin.api import AppState, create_app
from conftest import signed_in


@pytest.fixture()
def client(data_dir, offline_client, tmp_path):
    st = AppState(data_dir=data_dir, log_path=tmp_path / "a.jsonl", client=offline_client)
    return signed_in(create_app(st)), st


def _decisions(st):
    return [(c["payload"]["fix"]["fix_id"], c["payload"]["decision"]) for c in st.scenario.changes if c["kind"] == "fix_decision"]


def test_undo_rejection_then_approval_in_any_order(client):
    c, st = client
    v = st.scenario.version
    ranked = c.get("/api/fixes/KESSLER").json()["candidates"]
    assert len(ranked) >= 2
    first, second = ranked[-1]["fix_id"], ranked[0]["fix_id"]

    v = c.post("/api/fixes/decide", json={"base_version": v, "fix_id": first, "decision": "reject"}).json()["version"]
    v = c.post("/api/fixes/decide", json={"base_version": v, "fix_id": second, "decision": "approve"}).json()["version"]
    assert _decisions(st) == [(first, "reject"), (second, "approve")]

    # The rejection is not the newest change, but it can still be withdrawn on its own.
    r = c.post("/api/fixes/undo", json={"base_version": v, "fix_id": first})
    assert r.status_code == 200
    v = r.json()["version"]
    assert _decisions(st) == [(second, "approve")]

    # A new change after a withdraw gets a fresh, unique seq.
    v = c.post("/api/events/play", json={"base_version": v}).json()["version"]
    seqs = [ch["seq"] for ch in st.scenario.changes]
    assert len(seqs) == len(set(seqs)) == 2

    r = c.post("/api/fixes/undo", json={"base_version": v, "fix_id": second})
    assert r.status_code == 200
    assert _decisions(st) == []
    assert [ch["kind"] for ch in st.scenario.changes] == ["play_event"]


def test_undo_unknown_or_stale(client):
    c, st = client
    v = st.scenario.version
    assert c.post("/api/fixes/undo", json={"base_version": v, "fix_id": "FX-NOPE"}).status_code == 404
    fix = c.get("/api/fixes/KESSLER").json()["candidates"][0]["fix_id"]
    c.post("/api/fixes/decide", json={"base_version": v, "fix_id": fix, "decision": "reject"})
    assert c.post("/api/fixes/undo", json={"base_version": v, "fix_id": fix}).status_code == 409
