"""Ask Davey: temporal retrieval, model grounding, and read-only behavior."""
from __future__ import annotations

import json
import threading
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from missiontwin.api import AppState, create_app
from missiontwin.davey_evidence import build_corpus
from missiontwin.davey_models import DaveyAskBody
from missiontwin.llm import LLMClient


def _app(data_dir, tmp_path, *, transport=None, live=False, monkeypatch=None):
    if monkeypatch is not None:
        monkeypatch.setenv("LOCKER_DAVEY_LIVE", "1" if live else "0")
    client = LLMClient(base_url="https://model.test/v1" if live else "", api_key="test-key" if live else "",
                       model="gpt-4o-mini", demo_mode=True, transport=transport,
                       cache_dir=tmp_path / "llm-cache")
    state = AppState(data_dir=data_dir, log_path=tmp_path / "activity.jsonl", client=client)
    return TestClient(create_app(state)), state


def _play(api, event_count):
    for _ in range(event_count):
        version = api.get("/api/scenario/version").json()["version"]
        response = api.post("/api/events/play", json={"base_version": version})
        assert response.status_code == 200, response.text


def _ask(api, request_id="davey-test-request", question="What parts or repair issues threaten TIDEWATCH?", **extra):
    state = api.get("/api/scenario/version").json()
    body = {"question": question, "ship_id": "KESSLER", "event_id": "EVT-KESSLER-01",
            "node_id": None, "expected_version": state["version"],
            "expected_source_revision": state["source_revision"], "expected_epoch": state["epoch"],
            "expected_scenario_digest": state["scenario_digest"], "expected_cursor": state["cursor"],
            "expected_source_health_at": state["source_health_at"],
            "request_id": request_id, "previous_answer_id": None, **extra}
    return api.post("/api/davey/ask", json=body)


def test_e2_e3_search_has_no_future_report_and_no_mutation(data_dir, tmp_path, monkeypatch):
    api, state = _app(data_dir, tmp_path, monkeypatch=monkeypatch)
    _play(api, 2)
    before = api.get("/api/forecast").json()
    answer_e2 = _ask(api, "davey-e2-request")
    assert answer_e2.status_code == 200, answer_e2.text
    e2 = answer_e2.json()
    assert e2["requested_event_id"] == "EVT-KESSLER-01"
    assert e2["generation"]["mode"] == "fallback"
    assert e2["warnings"] and any("SPY-1D" in w["title"] for w in e2["warnings"])
    assert not any("20261105" in e["file"] or "may slip" in e["excerpt"].lower() for e in e2["evidence"])
    assert api.get("/api/forecast").json() == before
    assert state.scenario.version == 2

    _play(api, 1)
    answer_e3 = _ask(api, "davey-e3-request", event_id=None)
    assert answer_e3.status_code == 200, answer_e3.text
    e3 = answer_e3.json()
    assert e3["requested_event_id"] is None
    assert e3["event_id"] == "EVT-KESSLER-01"
    assert any("may slip" in e["excerpt"].lower() for e in e3["evidence"])
    assert not any("ramos" in e["excerpt"].lower() for e in e3["evidence"])
    assert state.scenario.version == 3
    assert api.get(f"/api/davey/answers/{e2['answer_id']}/evidence/{e2['evidence'][0]['id']}").status_code == 409


def test_changed_identity_rejects_question_before_analysis(data_dir, tmp_path, monkeypatch):
    api, state = _app(data_dir, tmp_path, monkeypatch=monkeypatch)
    _play(api, 2)
    response = _ask(api, expected_scenario_digest="old-digest")
    assert response.status_code == 409
    assert not state.davey.answers


def test_followup_cannot_reuse_another_graph_node_context(data_dir, tmp_path, monkeypatch):
    api, state = _app(data_dir, tmp_path, monkeypatch=monkeypatch)
    _play(api, 3)
    first = _ask(api, "davey-first-node-scope")
    assert first.status_code == 200
    followup = _ask(api, "davey-different-node", previous_answer_id=first.json()["answer_id"],
                    node_id="EVT-KESSLER-01|system:SPY1D|job:99101CF010042")
    assert followup.status_code == 409
    assert len(state.davey.answers) == 1


def test_requisition_projection_excludes_future_history(baseline):
    from missiontwin.engine import Scenario
    scenario = Scenario(baseline, persist=False)
    scenario.apply("play_event", {"event_id": "E1"})
    corpus = build_corpus(baseline.view(scenario.cursor_dt()), "KESSLER", "test-revision")
    pump = next(e for e in corpus if e.kind == "requisition" and e.record_key == "V9910163080001")
    assert "status_code: BB" in pump.excerpt
    assert "2026-12-15" not in pump.excerpt
    assert "status_history" not in pump.excerpt


def test_casrep_history_is_marked_after_update(data_dir, tmp_path, monkeypatch):
    api, state = _app(data_dir, tmp_path, monkeypatch=monkeypatch)
    _play(api, 3)
    corpus = build_corpus(state.view(), "KESSLER", state.baseline.source_revision)
    initial = [e for e in corpus if "DDG991-26-017_01_INITIAL" in e.file]
    update = [e for e in corpus if "DDG991-26-017_02_UPDATE" in e.file]
    assert initial and update
    assert all(e.superseded for e in initial)
    assert all(not e.superseded for e in update)
    travel = next(e for e in corpus if "may slip" in e.excerpt.lower())
    assert {"type": "assist_eta", "status": "UNCONFIRMED", "corroboration": "new_information", "hedged": True} in travel.fact_annotations


def _model_handler(request: httpx.Request) -> httpx.Response:
    assert request.headers["Authorization"] == "Bearer test-key"
    body = json.loads(request.content)
    assert body["response_format"]["type"] == "json_schema"
    assert body["response_format"]["json_schema"]["strict"] is True
    assert "max_completion_tokens" in body and "max_tokens" not in body
    packet = json.loads(body["messages"][1]["content"])
    evidence = packet["evidence"]
    assist = next(e for e in evidence if e["excerpt"].startswith("ASSIST/") and "NSWC TECH REP" in e["excerpt"])
    travel = next(e for e in evidence if "may slip" in e["excerpt"].lower())
    assert travel["fact_annotations"][0]["status"] == "UNCONFIRMED"
    assert packet["source_health"]["last_refresh_status"] == "loaded"
    supply = next(e for e in evidence if e["kind"] == "requisition" and "V9910163080001" in e["excerpt"])
    job = next(n for n in packet["graph_targets"] if "job:99101CF010042" in n["id"])
    event_id = packet["event_id"]
    draft = {
        "answer": "The SPY-1D repair has a modeled supply constraint. The NSWC TECH REP visit may slip.",
        "answer_claim_ids": [f"mission:{event_id}"],
        "answer_evidence_ids": [supply["id"], travel["id"]],
        "warnings": [
            {"kind": "forecasted", "title": "Cooling pump repair needs attention",
             "explanation": "The forecast flags the SPY-1D repair requirement.", "event_id": event_id,
             "claim_ids": [f"gate:{event_id}|system:SPY1D"], "evidence_ids": [supply["id"]],
             "verification": "Check the current requisition status.", "trace_node_id": job["id"]},
            {"kind": "emerging", "title": "NSWC TECH REP visit may slip",
             "explanation": "The report suggests travel may delay the technical representative's visit.",
             "event_id": event_id, "claim_ids": [], "evidence_ids": [travel["id"], assist["id"]],
             "verification": "Confirm the visit timing.", "trace_node_id": job["id"]},
        ],
        "proposed_nodes": [{"id": "nswc", "kind": "support_team", "label": "NSWC TECH REP",
                            "why": "The CASREP requests NSWC TECH REP assistance.",
                            "evidence_ids": [assist["id"]], "verification": "Confirm availability."}],
        "proposed_links": [{"id": "repair-assist", "dependent_id": job["id"], "dependency_id": "nswc",
                            "relation": "may_depend_on", "why": "The pump repair may depend on NSWC TECH REP assistance.",
                            "evidence_ids": [assist["id"]]}],
    }
    return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(draft)}}]})


def test_live_suggestion_is_reviewable_and_cached(data_dir, tmp_path, monkeypatch):
    calls = []
    def handler(request):
        calls.append(request)
        return _model_handler(request)
    api, state = _app(data_dir, tmp_path, transport=httpx.MockTransport(handler), live=True, monkeypatch=monkeypatch)
    _play(api, 3)
    assert calls == []
    before = api.get("/api/forecast").json()
    first = _ask(api, "davey-live-1")
    assert first.status_code == 200, first.text
    answer = first.json()
    assert answer["generation"]["mode"] == "llm"
    assert len(calls) == 1
    assert len(answer["proposed_nodes"]) == len(answer["proposed_links"]) == 1
    node = answer["proposed_nodes"][0]
    link = answer["proposed_links"][0]
    assert node["id"].startswith("proposal:") and node["tentative"]
    assert link["dependency_id"] == node["id"] and link["tentative"]
    assert "job:99101CF010042" in link["dependent_id"]
    travel_id = answer["warnings"][1]["evidence_ids"][0]
    opened = api.get(f"/api/davey/answers/{answer['answer_id']}/evidence/{travel_id}")
    assert opened.status_code == 200
    assert "may slip" in opened.json()["evidence"]["excerpt"].lower()
    assert api.get("/api/forecast").json() == before
    assert state.scenario.version == 3

    second = _ask(api, "davey-live-2")
    assert second.status_code == 200, second.text
    assert second.json()["generation"]["mode"] == "cache"
    assert len(calls) == 1
    same_request = _ask(api, "davey-live-1")
    assert same_request.json()["answer_id"] == answer["answer_id"]
    assert len(calls) == 1


def test_identical_exercise_replays_validated_cache_after_restart(data_dir, tmp_path, monkeypatch):
    calls = []
    def handler(request):
        calls.append(request)
        return _model_handler(request)
    live_api, _ = _app(data_dir, tmp_path, transport=httpx.MockTransport(handler), live=True, monkeypatch=monkeypatch)
    _play(live_api, 3)
    original = _ask(live_api, "davey-before-restart").json()
    assert original["generation"]["mode"] == "llm"

    offline_api, _ = _app(data_dir, tmp_path, live=False, monkeypatch=monkeypatch)
    _play(offline_api, 3)
    replay = _ask(offline_api, "davey-after-restart").json()
    assert replay["generation"]["mode"] == "cache"
    assert replay["identity"]["epoch"] != original["identity"]["epoch"]
    assert replay["answer"] == original["answer"]
    assert len(calls) == 1


def test_unsupported_model_proposal_falls_back(data_dir, tmp_path, monkeypatch):
    def handler(request):
        response = _model_handler(request)
        payload = response.json()
        draft = json.loads(payload["choices"][0]["message"]["content"])
        draft["proposed_nodes"][0]["label"] = "Invented support team"
        payload["choices"][0]["message"]["content"] = json.dumps(draft)
        return httpx.Response(200, json=payload)
    api, _ = _app(data_dir, tmp_path, transport=httpx.MockTransport(handler), live=True, monkeypatch=monkeypatch)
    _play(api, 3)
    response = _ask(api, "davey-invalid-1")
    assert response.status_code == 200, response.text
    answer = response.json()
    assert answer["generation"]["mode"] == "fallback"
    assert not answer["proposed_nodes"] and not answer["proposed_links"]
    assert "were not assessed" in answer["answer"]


def test_hedged_travel_report_cannot_become_certain_warning(data_dir, tmp_path, monkeypatch):
    def handler(request):
        payload = _model_handler(request).json()
        draft = json.loads(payload["choices"][0]["message"]["content"])
        draft["warnings"][1]["title"] = "NSWC TECH REP visit will slip"
        draft["warnings"][1]["explanation"] = "The report suggests travel will delay the visit."
        payload["choices"][0]["message"]["content"] = json.dumps(draft)
        return httpx.Response(200, json=payload)
    api, _ = _app(data_dir, tmp_path, transport=httpx.MockTransport(handler), live=True, monkeypatch=monkeypatch)
    _play(api, 3)
    answer = _ask(api, "davey-certain-warning").json()
    assert answer["generation"]["mode"] == "fallback"
    assert not answer["proposed_nodes"]


@pytest.mark.parametrize("unsupported", [
    "The pump has a 72 percent chance of failure.",
    "The NSWC visit may slip until 2027-01-01.",
])
def test_unsupported_model_estimate_or_date_uses_fallback(data_dir, tmp_path, monkeypatch, unsupported):
    def handler(request):
        payload = _model_handler(request).json()
        draft = json.loads(payload["choices"][0]["message"]["content"])
        draft["answer"] = unsupported
        payload["choices"][0]["message"]["content"] = json.dumps(draft)
        return httpx.Response(200, json=payload)
    api, _ = _app(data_dir, tmp_path, transport=httpx.MockTransport(handler), live=True, monkeypatch=monkeypatch)
    _play(api, 3)
    answer = _ask(api, "davey-unsupported-prose").json()
    assert answer["generation"]["mode"] == "fallback"
    assert unsupported not in answer["answer"]


def test_cache_failure_does_not_repeat_successful_model_call(data_dir, tmp_path, monkeypatch):
    calls = []
    def handler(request):
        calls.append(request)
        return _model_handler(request)
    api, state = _app(data_dir, tmp_path, transport=httpx.MockTransport(handler), live=True, monkeypatch=monkeypatch)
    _play(api, 3)
    def fail_cache(*_args):
        raise OSError("disk is unavailable")
    monkeypatch.setattr(state.client, "cache_put", fail_cache)
    answer = _ask(api, "davey-cache-fail")
    assert answer.status_code == 200
    assert answer.json()["generation"]["mode"] == "llm"
    assert len(calls) == 1


@pytest.mark.parametrize("reply", [
    {"choices": [{"finish_reason": "stop", "message": {"refusal": "cannot help", "content": None}}]},
    {"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]},
])
def test_refusal_or_truncation_uses_truthful_fallback(data_dir, tmp_path, monkeypatch, reply):
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(200, json=reply)
    api, _ = _app(data_dir, tmp_path, transport=httpx.MockTransport(handler), live=True, monkeypatch=monkeypatch)
    _play(api, 3)
    response = _ask(api, "davey-incomplete")
    assert response.status_code == 200
    answer = response.json()
    assert answer["generation"]["mode"] == "fallback"
    assert answer["warnings"] and not answer["proposed_nodes"]
    assert "Report-based emerging concerns were not assessed" in answer["answer"]
    assert len(calls) == 1


def test_state_change_during_model_call_discards_answer(data_dir, tmp_path, monkeypatch):
    started = threading.Event()
    release = threading.Event()
    def handler(request):
        started.set()
        assert release.wait(10), "model response was not released"
        return _model_handler(request)
    api, state = _app(data_dir, tmp_path, transport=httpx.MockTransport(handler), live=True, monkeypatch=monkeypatch)
    _play(api, 3)
    identity = api.get("/api/scenario/version").json()
    body = DaveyAskBody(question="What parts or repair issues threaten TIDEWATCH?", ship_id="KESSLER",
                        event_id="EVT-KESSLER-01", expected_version=identity["version"],
                        expected_source_revision=identity["source_revision"], expected_epoch=identity["epoch"],
                        expected_scenario_digest=identity["scenario_digest"], expected_cursor=identity["cursor"],
                        expected_source_health_at=identity["source_health_at"],
                        request_id="davey-race-request")
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(state.davey.ask, body)
        try:
            assert started.wait(10), "model request did not start"
            _play(api, 1)
        finally:
            release.set()
        with pytest.raises(HTTPException) as error:
            future.result(timeout=15)
    assert error.value.status_code == 409
    assert not state.davey.answers
