"""Mission names come from the event plan and the reports that mention them, never from code."""
import copy
import csv
import json
import shutil
from datetime import datetime

import pytest

from missiontwin.brief import build_brief
from missiontwin.domain import UTC
from missiontwin.engine import Scenario, build_world, domino_graph, forecast, planned_case
from missiontwin.ingest import load_baseline
from missiontwin.validation import validate_events

NAMES = {"EVT-KESSLER-01": "TIDEWATCH", "EVT-KESSLER-02": "SEASHIELD", "EVT-VARNELL-01": "DEEP LANTERN", "EVT-ASHBY-01": "IRON HORIZON"}
AFTER_REPORT = datetime(2026, 11, 7, tzinfo=UTC)  # the 05 NOV report is known at 060100Z


def copy_with(data_dir, tmp_path, edit_events=None, edit_training=None):
    d = tmp_path / "d"
    shutil.copytree(data_dir, d)
    if edit_events:
        p = d / "squadron" / "events_missions.json"
        doc = json.loads(p.read_text(encoding="utf-8"))
        edit_events({e["event_id"]: e for e in doc["events"]})
        p.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    if edit_training:
        p = d / "KESSLER" / "training_readiness.csv"
        with p.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fields, rows = reader.fieldnames, list(reader)
        edit_training({r["requirement_id"]: r for r in rows})
        with p.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
    return d


def training_fact(b):
    view = b.view(AFTER_REPORT)
    return view, next(f for f in view.facts_with_corroboration("KESSLER") if f.type == "training_scheduled")


def test_codenames_flow_from_event_plan_to_forecast_and_labels(baseline, log_path):
    fc = forecast(build_world(Scenario(baseline, log_path=log_path)), runs=500)
    assert {m["event_id"]: m["codename"] for m in fc["missions"]} == NAMES
    seashield = next(m for m in fc["missions"] if m["event_id"] == "EVT-KESSLER-02")
    assert next(g for g in seashield["gates"] if g["gate_id"] == "prereq:EVT-KESSLER-01")["label"] == "TIDEWATCH ready first"
    mission_node = next(n for n in domino_graph(fc, "KESSLER", "EVT-KESSLER-02")["nodes"] if n["kind"] == "mission")
    assert mission_node["label"] == "SEASHIELD: COMPTUEX"


def test_renaming_codename_in_source_renames_it_everywhere(data_dir, tmp_path, offline_client, log_path):
    d = copy_with(data_dir, tmp_path, edit_events=lambda ev: ev["EVT-KESSLER-01"].update(codename="NIGHTJAR"))
    b = load_baseline(d, offline_client)
    assert not b.configuration_errors
    s = Scenario(b, log_path=log_path)
    s.apply("action", {"type": "shift_mission", "event_id": "EVT-KESSLER-01", "days": 40})
    world = build_world(s)
    chain = planned_case(world)["EVT-KESSLER-02"]["chain"]
    prereq = next(c for c in chain if c["gate_id"] == "prereq:EVT-KESSLER-01")
    assert prereq["label"].startswith("NIGHTJAR must ") and all("NIGHTJAR" in w for w in prereq["why"])
    fc = forecast(world, runs=500)
    assert next(m for m in fc["missions"] if m["event_id"] == "EVT-KESSLER-01")["codename"] == "NIGHTJAR"
    text = build_brief(fc, "KESSLER", None, [], {}, [])["text"]
    assert "NIGHTJAR" in text and "TIDEWATCH" not in text


def test_daily_report_names_event_and_matching_toris_date_corroborates(baseline):
    view, fact = training_fact(baseline)
    assert (fact.value, fact.date, fact.status) == ("SEASHIELD (COMPTUEX)", "10 NOV", "VERIFIED")
    assert view.event_named("KESSLER", fact.value)["event_id"] == "EVT-KESSLER-02"
    assert fact.corroboration == "corroborates"
    assert "refresh 10 NOV, before SEASHIELD (EVT-KESSLER-02)" in fact.corroboration_note


def test_toris_date_disagreeing_with_report_contradicts(data_dir, tmp_path, offline_client):
    d = copy_with(data_dir, tmp_path, edit_training=lambda tr: tr["TRQ-AW-07 (SYNTH)"].update(scheduled_refresh="2026-11-09"))
    _, fact = training_fact(load_baseline(d, offline_client))
    assert fact.corroboration == "contradicts"
    assert "TRQ-AW-07 (SYNTH) 09 NOV; report says 10 NOV" in fact.corroboration_note


def test_event_reference_falls_back_to_name_then_reports_unresolved(data_dir, tmp_path, offline_client):
    d = copy_with(data_dir, tmp_path, edit_events=lambda ev: ev["EVT-KESSLER-02"].pop("codename"))
    _, fact = training_fact(load_baseline(d, offline_client))
    assert fact.corroboration == "corroborates" and "before Mission B (EVT-KESSLER-02)" in fact.corroboration_note

    shutil.rmtree(d)
    d = copy_with(data_dir, tmp_path, edit_events=lambda ev: (ev["EVT-KESSLER-02"].pop("codename"),
                                                             ev["EVT-KESSLER-02"].update(name="Fleet exercise")))
    _, fact = training_fact(load_baseline(d, offline_client))
    assert fact.corroboration == "corroborates"
    assert "'SEASHIELD (COMPTUEX)' is not an event in the event plan" in fact.corroboration_note


def test_codenames_must_be_unique_and_nonempty(baseline):
    events = copy.deepcopy(baseline.events)
    events[1]["codename"] = events[0]["codename"].lower()
    with pytest.raises(ValueError, match="unique"):
        validate_events(events, baseline.profile)
    events[1]["codename"] = "  "
    with pytest.raises(ValueError, match="nonempty"):
        validate_events(events, baseline.profile)
