"""R12: each seeded inconsistency X1-X10 is surfaced with sources; no roster name ever reaches an LLM prompt."""
import csv

import pytest

from missiontwin.brief import build_brief
from missiontwin.domain import parse_ts
from missiontwin.engine import Scenario, build_world, forecast
from missiontwin.ingest import find_contradictions
from missiontwin.llm import LLMClient, LLMUnavailable, extraction_messages, pii_guard, redact, surname_of

EXPECT = {"X1": "ASHBY", "X2": "VARNELL", "X3": "ASHBY", "X4": "KESSLER", "X5": "VARNELL", "X6": "VARNELL",
          "X7": "KESSLER", "X8": "KESSLER", "X9": "KESSLER", "X10": "KESSLER"}


def test_all_ten_inconsistencies_surface(baseline):
    v = baseline.view(parse_ts("2026-11-07T15:00:00Z"))  # after all feed events
    cons = find_contradictions(v)
    found = {(c.id, c.ship_id) for c in cons}
    for xid, ship in EXPECT.items():
        assert (xid, ship) in found, f"{xid} on {ship} not surfaced"
    for c in cons:
        assert c.sources, f"{c.id} has no source"
    x7 = [c for c in cons if c.id == "X7"]
    assert any("CIWS" in c.title for c in x7)
    x5 = [c for c in cons if c.id == "X5" and c.ship_id == "VARNELL"]
    assert any("019990001" in c.title for c in x5)


def test_x4_only_after_the_report_arrives(baseline):
    before = {c.id for c in find_contradictions(baseline.view(parse_ts("2026-11-04T08:00:00Z")))}
    assert "X4" not in before


def roster_surnames(baseline):
    return {surname_of(r["display_name"]) for s in baseline.profile.ship_ids for r in baseline.r(s, "roster.csv")}


def test_redaction_fixture(baseline, data_dir):
    lines = (data_dir / "squadron" / "pii_redaction_test.csv").read_text(encoding="utf-8").splitlines()
    if lines and lines[0].startswith("#"):
        lines = lines[1:]
    rows = list(csv.DictReader(lines))
    assert rows
    for r in rows:
        out, _ = redact(r["input_text"], r["ship_id"], baseline.name_index)
        assert out == r["expected_redacted"], r["case_id"]
        assert r["names_that_must_not_appear"].lower() not in out.lower()


def test_no_names_in_extraction_prompts(baseline):
    names = roster_surnames(baseline)
    for rel, doc in baseline.docs.items():
        for page in doc["pages"]:
            red, _ = redact(page, doc["ship_id"], baseline.name_index)
            text = "\n".join(m["content"] for m in extraction_messages(red))
            pii_guard(text, names)  # raises if any roster surname survived


def test_no_names_in_brief(baseline, log_path):
    s = Scenario(baseline, log_path=log_path)
    for _ in range(4):
        s.apply("play_event", {})
    fc = forecast(build_world(s), runs=500)
    b = build_brief(fc, "KESSLER", None, [], {}, [])
    for name in roster_surnames(baseline):
        if len(name) >= 3:
            assert f" {name.lower()} " not in f" {b['text'].lower()} ", name
    for s in baseline.profile.ship_ids:
        for r in baseline.r(s, "roster.csv"):
            assert r["display_name"] not in b["text"]


def test_guard_blocks_unredacted_prompt():
    with pytest.raises(LLMUnavailable):
        pii_guard("FC1 Ramos detaches", {"RAMOS"})
