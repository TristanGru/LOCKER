"""Sign-in and per-unit access: every API request needs a session, and a CO only reaches their own ship."""
import json

import pytest
from fastapi.testclient import TestClient

from missiontwin import auth
from missiontwin.api import AppState, create_app
from conftest import signed_in

OTHERS = ("VARNELL", "ASHBY", "NSNORFOLK", "NSAHR")


@pytest.fixture()
def app(data_dir, offline_client, tmp_path):
    return create_app(AppState(data_dir, tmp_path / "activity.jsonl", offline_client)), tmp_path


def version(client):
    return client.get("/api/scenario/version").json()["version"]


def test_every_api_route_needs_a_session(app):
    app, _ = app
    anon = TestClient(app)
    for path in ("/api/dashboard", "/api/state", "/api/forecast", "/api/graph/KESSLER", "/api/fixes/KESSLER", "/api/log",
                 "/results", "/openapi.json", "/docs"):
        assert anon.get(path).status_code == 401, path
    assert anon.post("/api/reset", json={"base_version": 0}).status_code == 401
    assert anon.get("/api/ready").json() == {"ok": True}  # probes get status only
    assert anon.post("/api/login", json={"username": "someone"}).status_code == 401
    forged = TestClient(app, cookies={auth.COOKIE: "eyJ1IjogImZsZWV0LmNvbW1hbmRlckB1cy5uYXZ5Lm1pbCJ9.forged"})
    assert forged.get("/api/state").status_code == 401


def test_accounts_are_one_co_per_ship_and_one_fleet_account(app):
    app, _ = app
    listed = {a["username"]: a["role"] for a in TestClient(app).get("/api/accounts").json()}
    assert listed == {auth.FLEET_USER: "fleet", "co.kessler": "co", "co.varnell": "co", "co.ashby": "co"}


def test_co_sees_only_their_ship(app):
    app, _ = app
    co = signed_in(app, "CO.Kessler ")  # usernames are not case or space sensitive
    d = co.get("/api/dashboard").json()
    assert [s["ship_id"] for s in d["state"]["ships"]] == ["KESSLER"]
    assert {m["ship_id"] for m in d["forecast"]["missions"]} == {"KESSLER"}
    assert set(d["forecast"]["units"]) == {"KESSLER"}
    assert {n["ship_id"] for n in d["forecast"]["nodes"]} == {"KESSLER"}
    assert {e["ship_id"] for e in d["state"]["feed"]} == {"KESSLER"}
    text = json.dumps({k: d[k] for k in ("state", "sources", "issues", "visualization", "baseline")})
    # No other unit's records or files. KESSLER's own pier-support prerequisite (EVT-NSNORFOLK-01) stays,
    # including which unit provides that support.
    text = text.replace('"supporting_unit": "NSNORFOLK"', "")
    assert not [u for u in OTHERS if f'"{u}"' in text or f'"{u}/' in text]
    assert d["state"]["user"]["username"] == "co.kessler"
    for path in ("/api/graph/ASHBY", "/api/fixes/VARNELL", "/api/graph/NSNORFOLK"):
        assert co.get(path).status_code == 403, path
    assert co.get("/api/source", params={"file": "ASHBY/roster.csv"}).status_code == 403
    assert co.get("/api/source", params={"file": "KESSLER/roster.csv"}).status_code == 200
    assert co.get("/api/source", params={"file": "squadron/events_missions.json"}).status_code == 200
    assert co.post("/api/brief", json={"ship_id": "ASHBY"}).status_code == 403


def test_fleet_account_sees_every_unit(app):
    app, _ = app
    fleet = signed_in(app)
    d = fleet.get("/api/dashboard").json()
    assert {s["ship_id"] for s in d["state"]["ships"]} == {"KESSLER", *OTHERS}
    assert len(d["forecast"]["missions"]) == 9
    assert fleet.get("/api/graph/NSNORFOLK").status_code == 200


def test_exercise_controls_are_fleet_only(app):
    app, _ = app
    co, fleet = signed_in(app, "co.ashby"), signed_in(app)
    v = version(co)
    assert co.post("/api/reset", json={"base_version": v}).status_code == 403
    assert co.post("/api/events/play", json={"base_version": v}).status_code == 403
    assert co.post("/api/sources/refresh", json={"base_version": v}).status_code == 403
    assert co.post("/api/changes", json={"base_version": v, "kind": "set_assumption", "key": "bands.green", "value": 0.7}).status_code == 403
    assert co.post("/api/changes", json={"base_version": v, "kind": "action",
                                          "action": {"type": "shift_mission", "event_id": "EVT-KESSLER-01", "days": 2}}).status_code == 403
    assert fleet.post("/api/events/play", json={"base_version": v}).status_code == 200
    assert co.post("/api/undo", json={"base_version": version(co)}).status_code == 403  # not their change


def test_co_cannot_approve_a_transfer_from_another_unit(app):
    app, tmp = app
    co = signed_in(app, "co.kessler")
    candidates = co.get("/api/fixes/KESSLER").json()["candidates"]
    transfer = next(c for c in candidates if any(s.get("donor") not in (None, "KESSLER") for s in c["steps"]))
    local = next(c for c in candidates if all(s.get("donor") in (None, "KESSLER") for s in c["steps"]))
    denied = co.post("/api/fixes/decide", json={"base_version": version(co), "fix_id": transfer["fix_id"], "decision": "approve", "note": ""})
    assert denied.status_code == 403 and "Fleet staff must approve" in denied.json()["detail"]
    ok = co.post("/api/fixes/decide", json={"base_version": version(co), "fix_id": local["fix_id"], "decision": "approve", "note": ""})
    assert ok.status_code == 200 and ok.json()["change"]["actor"] == "co.kessler"
    assert co.post("/api/undo", json={"base_version": version(co)}).status_code == 200  # their own change
    fleet = signed_in(app)
    assert fleet.post("/api/fixes/decide", json={"base_version": version(fleet), "fix_id": transfer["fix_id"],
                                                 "decision": "approve", "note": ""}).status_code == 200
    access = [json.loads(line) for line in (tmp / "access.jsonl").read_text(encoding="utf-8").splitlines()]
    assert {"op": "access_denied", "actor": "co.kessler", "method": "POST", "path": "/api/fixes/decide"}.items() <= access[1].items()
    assert [a["op"] for a in access].count("login") == 2


def test_sign_out_ends_the_session(app):
    app, _ = app
    co = signed_in(app, "co.varnell")
    copied = TestClient(app, cookies={auth.COOKIE: co.cookies[auth.COOKIE]})
    assert copied.get("/api/state").status_code == 200
    assert co.get("/api/session").json()["user"]["units"] == ["VARNELL"]
    co.post("/api/logout")
    assert co.get("/api/state").status_code == 401
    assert co.get("/api/session").json() == {"user": None}
    assert copied.get("/api/state").status_code == 401  # the server revoked the token, not just the browser cookie
    assert TestClient(app).get("/api/state").headers["x-frame-options"] == "DENY"


def test_assistants_and_fix_undo_respect_unit_access(app):
    """Ask Davy, the overview assistant and chat, and per-fix undo apply the same per-unit rules."""
    app, _ = app
    fleet, co = signed_in(app), signed_in(app, "co.kessler")
    ident = co.get("/api/scenario/version").json()
    ask = {"question": "What threatens this event?", "ship_id": "VARNELL", "event_id": None, "node_id": None,
           "expected_version": ident["version"], "expected_source_revision": ident["source_revision"],
           "expected_epoch": ident["epoch"], "expected_scenario_digest": ident["scenario_digest"],
           "expected_cursor": ident["cursor"], "expected_source_health_at": ident["source_health_at"] or "",
           "request_id": "access-test-0001"}
    assert co.post("/api/davey/ask", json=ask).status_code == 403
    overview = {"unit_id": "VARNELL", "base_version": ident["version"], "source_revision": ident["source_revision"]}
    assert co.post("/api/overview-assistant/conversations", json=overview).status_code == 403
    assert co.post("/api/overview-assistant/brief", json=overview).status_code == 403

    # A CO cannot withdraw a decision the fleet staff made, even on the CO's own ship.
    fix = fleet.get("/api/fixes/KESSLER").json()["candidates"][0]["fix_id"]
    v = fleet.post("/api/fixes/decide", json={"base_version": version(fleet), "fix_id": fix, "decision": "reject"}).json()["version"]
    assert co.post("/api/fixes/undo", json={"base_version": v, "fix_id": fix}).status_code == 403
    assert fleet.post("/api/fixes/undo", json={"base_version": v, "fix_id": fix}).status_code == 200


def test_serverless_copies_share_sessions(monkeypatch):
    """On a serverless deployment every copy of the app must accept a session another copy issued."""
    monkeypatch.delenv("MISSIONTWIN_SESSION_SECRET", raising=False)
    monkeypatch.setenv("VERCEL_DEPLOYMENT_ID", "dpl_test")
    token = auth.Sessions().issue("co.kessler")
    assert auth.Sessions().verify(token) == "co.kessler"
    monkeypatch.setenv("VERCEL_DEPLOYMENT_ID", "dpl_other")
    assert auth.Sessions().verify(token) is None  # a new deployment starts fresh
    monkeypatch.setenv("MISSIONTWIN_SESSION_SECRET", "configured")
    assert auth.Sessions().verify(auth.Sessions().issue("co.kessler")) == "co.kessler"


def test_hosting_entrypoint_and_https_cookie(app):
    import importlib
    assert importlib.import_module("app").app is not None  # the root entrypoint imports through the package
    app, _ = app
    r = TestClient(app).post("/api/login", json={"username": "co.kessler"}, headers={"x-forwarded-proto": "https"})
    assert r.status_code == 200 and "secure" in r.headers["set-cookie"].lower()
