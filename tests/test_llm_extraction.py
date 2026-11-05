"""Real boundary validation and disk replay with fake HTTP responses; no live model claims."""
import json

import httpx
import pytest

from missiontwin.domain import parse_ts
from missiontwin.evaluate import evaluate_extraction, expected_fact, run_evaluation
from missiontwin.llm import LLMClient, extract_facts, redact, rules_extract


@pytest.mark.parametrize("line,eic", [
    ("CIWS: PMS check last week not completed (lost). Will reschedule.", "CIWS"),
    ("SPY-1D: PMS check last week not completed (lost).", "SPY1D"),
    ("GUN5: PMS check on Tuesday not completed (lost).", "GUN5"),
    ("MK 15 CIWS: PMS check last week not completed (lost).", "CIWS"),
])
def test_lost_pms_rule_reads_any_system_as_written(line, eic):
    assert [(f["type"], f["value"]) for f in rules_extract(line)] == [("pms_lost", eic)]


def test_lost_pms_on_unknown_system_is_flagged_not_dropped(baseline, tmp_path):
    offline = LLMClient(base_url="", cache_dir=tmp_path)
    facts, method = extract_facts(offline, "report.pdf", "KESSLER", "WIDGET: PMS check last week not completed (lost).", 1,
                                  parse_ts("2026-11-06T01:00:00Z"), baseline.name_index, known_eics=baseline.profile.all_eics)
    assert method == "rules" and len(facts) == 1
    assert facts[0].status == "NEEDS_REVIEW" and "not found in mission tree" in facts[0].reason


def client_for(payload, tmp_path, model="fixture-model"):
    def respond(request):
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(payload)}}]})
    return LLMClient(base_url="https://mock.invalid/v1", api_key="", model=model, cache_dir=tmp_path,
                     demo_mode=False, transport=httpx.MockTransport(respond))


@pytest.mark.parametrize("override", [
    {"date": "01 DEC"}, {"date": "99 NOV"}, {"member_token": "M-9999"}, {"span": "invented evidence"},
])
def test_invented_fact_fields_require_review(baseline, tmp_path, override):
    text = "FC1 [M-0007] detaches 10 NOV on PRD orders."
    raw = {"type": "personnel_transfer", "member_token": "M-0007", "date": "10 NOV", "span": text, **override}
    facts, method = extract_facts(client_for({"facts": [raw]}, tmp_path), "report.pdf", "KESSLER", text, 1,
                                  parse_ts("2026-11-06T01:00:00Z"), baseline.name_index, known_eics=baseline.profile.all_eics)
    assert method == "llm" and facts[0].status == "NEEDS_REVIEW"
    assert not list(tmp_path.glob("*.json")), "invalid evidence must not populate the demo cache"


def test_empty_evidence_and_malformed_response_use_labeled_fallback(baseline, tmp_path):
    text = "FC1 [M-0007] detaches 10 NOV on PRD orders."
    raw = {"type": "personnel_transfer", "member_token": "M-9999", "date": "01 DEC", "span": ""}
    facts, method = extract_facts(client_for({"facts": [raw]}, tmp_path), "report.pdf", "KESSLER", text, 1,
                                  parse_ts("2026-11-06T01:00:00Z"), baseline.name_index, known_eics=baseline.profile.all_eics)
    assert method == "rules"
    assert facts[0].member_id == "M-0007" and facts[0].date == "10 NOV"


def test_hedged_evidence_cannot_be_marked_verified_by_model(baseline, tmp_path):
    text = "The tech rep visit may slip to 12 NOV."
    raw = {"type": "assist_eta", "date": "12 NOV", "span": text, "hedged": False}
    facts, _ = extract_facts(client_for({"facts": [raw]}, tmp_path), "report.pdf", "KESSLER", text, 1,
                             parse_ts("2026-11-06T01:00:00Z"), baseline.name_index, known_eics=baseline.profile.all_eics)
    assert facts[0].status == "UNCONFIRMED" and facts[0].hedged


def test_casrep_fields_and_line_evidence_are_checked(baseline, data_dir, tmp_path):
    path = "KESSLER/casrep_messages/DDG991-26-017_01_INITIAL.txt"
    text = (data_dir / path).read_text(encoding="utf-8")
    span = next(line for line in text.splitlines() if line.startswith("CASUALTY/"))
    raw = {"type": "casrep_status", "category": 4, "report_type": "INITIAL", "eic": "SPY1D-CW", "span": span}
    facts, _ = extract_facts(client_for({"facts": [raw]}, tmp_path), path, "KESSLER", text, 1,
                             parse_ts("2026-11-04T12:00:00Z"), baseline.name_index, document_type="casrep", known_eics=baseline.profile.all_eics)
    assert facts[0].status == "NEEDS_REVIEW"
    assert "category" in facts[0].reason
    assert text.splitlines()[facts[0].line - 1] == span


def test_malformed_casrep_fallback_record_is_isolated(baseline, tmp_path):
    text = "PARTS/1/NSN:4320-01-999-0001/QTY:0/DOC:R991016308A001/PD:02/RDD:999//"
    client = LLMClient(base_url="", api_key="", cache_dir=tmp_path, demo_mode=True)
    facts, method = extract_facts(client, "bad-message.txt", "KESSLER", text, 1,
                                  parse_ts("2026-11-04T12:00:00Z"), {}, document_type="casrep", known_eics=baseline.profile.all_eics)
    assert method == "rules" and facts[0].status == "NEEDS_REVIEW"
    assert facts[0].span == text and facts[0].quantity is None


def test_both_document_oracles_match_rules(baseline):
    report = evaluate_extraction(baseline)
    assert report["document_count"] == 26
    assert report["passed"], report
    assert {d["document_type"] for d in report["documents"]} == {"daily_report", "casrep"}
    assert report["precision"] == report["recall"] == 1
    assert not evaluate_extraction(baseline, require_cache=True)["passed"]


def test_all_documents_round_trip_through_real_disk_cache(data_dir, baseline, tmp_path):
    # Fixture responses test transport, normalization and replay, not model extraction quality.
    responses = {}
    for path, oracle in baseline.expected_facts.items():
        doc = baseline.docs[path]
        assert len(doc["pages"]) == 1
        red, _ = redact(doc["pages"][0], oracle["ship_id"], baseline.name_index)
        facts = []
        for raw in oracle["facts"]:
            fact = expected_fact(raw, oracle["ship_id"], baseline.name_index)
            fact["member_token"] = fact.pop("member_id", None)
            facts.append(fact)
        responses[red] = {"facts": facts}
    calls = []

    def handler(request):
        body = json.loads(request.content)
        calls.append(body)
        payload = responses[body["messages"][-1]["content"]]
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(payload)}}]})

    online = LLMClient(base_url="https://mock.invalid/v1", api_key="", model="fixture-model", cache_dir=tmp_path,
                       demo_mode=False, transport=httpx.MockTransport(handler))
    live = run_evaluation(online, data_dir, require_model=True)
    assert live["passed"] and live["source_counts"] == {"llm": 26}
    assert len(calls) == 26 and len(list(tmp_path.glob("*.json"))) == 26
    online.refresh = True
    refreshed = run_evaluation(online, data_dir, require_model=True)
    assert refreshed["passed"] and len(calls) == 52

    def never_network(request):
        pytest.fail("cache-only replay attempted a network request")

    offline = LLMClient(base_url="https://mock.invalid/v1", api_key="", model="fixture-model", cache_dir=tmp_path,
                        demo_mode=True, transport=httpx.MockTransport(never_network))
    replay = run_evaluation(offline, data_dir, require_cache=True)
    assert replay["passed"] and replay["source_counts"] == {"cache": 26}
    assert not offline.sent_prompts
    # A changed model cannot accidentally reuse another model's response cache.
    offline.model = "different-model"
    missing = run_evaluation(offline, data_dir, require_cache=True)
    assert not missing["passed"] and missing["source_counts"] == {"rules": 26}


def test_evaluation_rejects_semantically_incorrect_fact(baseline):
    import copy
    changed = copy.deepcopy(baseline)
    fact = next(f for f in changed.facts if f.type == "personnel_transfer")
    fact.date = "01 DEC"
    report = evaluate_extraction(changed)
    assert not report["passed"]
    assert report["totals"]["missing"] and report["totals"]["unexpected"]
