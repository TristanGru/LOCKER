"""Spec conformance (R12): every generated file follows its data_sources/ spec."""
import csv
import json
import re
from datetime import date, timedelta

import pytest

from missiontwin import BANNER
from missiontwin.domain import COLUMNS, PER_SHIP_CSV, ROOT, SPEC_OF_FILE, SQUADRON_CSV
# The generator's authoring spec: this file checks that the written dataset matches it.
from missiontwin.synthetic_spec import ALL_EICS, SHIP_IDS, parts_index

SPECS = ROOT / "data_sources"


def read(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    if lines and lines[0] == f"# {BANNER}":
        lines = lines[1:]
    return list(csv.DictReader(lines))


def all_csv(data_dir):
    for s in SHIP_IDS:
        for f in PER_SHIP_CSV:
            yield s, f, data_dir / s / f
    for f in SQUADRON_CSV:
        yield "squadron", f, data_dir / "squadron" / f


def test_csv_columns(data_dir):
    for owner, fname, p in all_csv(data_dir):
        assert p.exists(), p
        lines = p.read_text(encoding="utf-8").splitlines()
        if lines and lines[0].startswith("#"):
            lines = lines[1:]
        header = lines[0].split(",")
        assert header == COLUMNS[fname], f"{owner}/{fname} columns differ from contract"


def test_contract_columns_appear_in_specs():
    for fname, cols in COLUMNS.items():
        spec = (SPECS / SPEC_OF_FILE[fname]).read_text(encoding="utf-8")
        missing = [c for c in cols if f"`{c}`" not in spec and f" {c}" not in spec and f"{c}," not in spec]
        assert not missing, f"{fname}: columns not documented in {SPEC_OF_FILE[fname]}: {missing}"


def test_timestamps_are_zulu(data_dir):
    iso_like = re.compile(r"^\d{4}-\d{2}-\d{2}T")
    for owner, fname, p in all_csv(data_dir):
        for row in read(p):
            for k, v in row.items():
                for tok in re.split(r"[;\s]+", v or ""):
                    if iso_like.match(tok):
                        assert tok.endswith("Z"), f"{owner}/{fname} {k}={tok} is not Zulu"


def test_json_and_text_banners(data_dir):
    for f in ("mission_equipment_tree.json", "events_missions.json", "data_catalog.json", "scenario_feed.json",
              "daily_status_expected_facts.json"):
        assert json.loads((data_dir / "squadron" / f).read_text(encoding="utf-8"))["_banner"] == BANNER
    for s in SHIP_IDS:
        for p in list((data_dir / s).glob("casrep_messages/*.txt")) + list((data_dir / s).glob("movrep/*.txt")) + \
                list((data_dir / s).glob("logreq/*.txt")):
            assert p.read_text(encoding="utf-8").startswith("UNCLAS//SYNTHETIC EXERCISE//")
    assert (data_dir / "squadron" / "delay_model_params.yaml").read_text(encoding="utf-8").startswith(f"# {BANNER}")


def test_join_keys_resolve(data_dir):
    pidx = parts_index()
    for s in SHIP_IDS:
        jobs = read(data_dir / s / "csmp.csv")
        reqs = {r["doc_number"]: r for r in read(data_dir / s / "requisition_status.csv")}
        cas = json.loads((data_dir / s / "casreps.json").read_text(encoding="utf-8"))["casreps"]
        for c in cas:
            if c["casrep_id"] == "DDG993-26-004":
                continue  # seeded X1
            match = [j for j in jobs if j["casrep_dtg"] == c["initial_dtg"] and c["initial_dtg"] in j["remarks"]]
            assert len(match) == 1, f"{c['casrep_id']} must have exactly one JCN carrying its DTG"
        for j in jobs:
            assert j["eic"] in ALL_EICS
            assert j["jcn"] == j["uic"] + j["work_center"] + j["jsn"]
            if j["job_state"] == "OPEN_AWAITING_PARTS":
                docs = [d for d in j["req_doc_numbers"].split(";") if d]
                assert docs and all(d in reqs for d in docs), j["jcn"]
        for r in reqs.values():
            if r["casrep_id"]:
                assert r["rdd"] == "999" and int(r["priority_designator"]) <= 3
        cosal = {r["niin"] for r in read(data_dir / s / "onboard_allowance_cosal.csv")}
        assert set(pidx) <= cosal, "every tree NIIN must exist in every ship's COSAL"
        roster = {r["member_id"] for r in read(data_dir / s / "roster.csv")}
        assert all(q["member_id"] in roster for q in read(data_dir / s / "quals.csv"))
        assert all(w["member_id"] in roster for w in read(data_dir / s / "watchbill.csv"))
        for r in read(data_dir / s / "sked_schedule.csv"):
            assert r["eic"] in ALL_EICS
        assert all(len(m.split("-")[1]) == 4 for m in roster)


def test_schedule_tiles_without_gaps(data_dir):
    for s in SHIP_IDS:
        rows = read(data_dir / s / "schedule_30day.csv")
        sup = {r["superseded_block_id"] for r in rows if r["superseded_block_id"]}
        cur = sorted([r for r in rows if r["block_id"] not in sup], key=lambda r: r["start_date"])
        for a, b in zip(cur, cur[1:]):
            assert date.fromisoformat(a["end_date"]) + timedelta(days=1) == date.fromisoformat(b["start_date"]), (s, a["block_id"], b["block_id"])


def test_demo_rows_present(data_dir):
    k = {r["jcn"]: r for r in read(data_dir / "KESSLER" / "csmp.csv")}["99101CF010042"]
    assert k["status_code"] == "2" and k["casrep_dtg"] == "041200Z NOV 26" and "FTS ASSIST REQ" in k["remarks"]
    req = {r["doc_number"]: r for r in read(data_dir / "KESSLER" / "requisition_status.csv")}["V9910163080001"]
    assert req["priority_designator"] == "02" and req["status_code"] == "BC" and req["esd"] == "2026-12-15"
    v = [r for r in read(data_dir / "VARNELL" / "onboard_allowance_cosal.csv") if r["niin"] == "019990001" and r["item_type"] == "STOREROOM"][0]
    assert v["allowance_qty"] == "1" and v["on_hand_qty"] == "1"
    quals = [q for q in read(data_dir / "KESSLER" / "quals.csv") if q["watchstation_code"] == "4310" and q["qual_status"] == "QUALIFIED"]
    assert sorted(q["member_id"] for q in quals) == ["M-0007", "M-0011", "M-0019"]
    assert any(q["member_id"] == "M-0412" and q["watchstation_code"] == "4310" for q in read(data_dir / "ASHBY" / "quals.csv"))
