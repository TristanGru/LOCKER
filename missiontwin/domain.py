"""Runtime-neutral helpers and the file contract: paths, Zulu time handling, DTG parsing, column lists.

Nothing here describes a fleet. Units, systems, parts, watchstations, the scenario clock, map layouts and every
model number are read from the dataset (squadron/dataset_profile.json, mission_equipment_tree.json,
shore_profile.json, delay_model_params.yaml, data_catalog.json). The synthetic dataset's authoring values live
in synthetic_spec.py, which only the generators import. Specs live in data_sources/ (master: 00_README.md).
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

UTC = timezone.utc

# ---------------------------------------------------------------- paths
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "synthetic"
SQUADRON_DIR = DATA_DIR / "squadron"
CACHE_DIR = ROOT / "cache" / "llm"
LOG_DIR = ROOT / "logs"

# ---------------------------------------------------------------- clock (R11: Zulu everywhere)
MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
DTG_RE = re.compile(r"^(\d{2})(\d{2})(\d{2})Z\s+([A-Z]{3})\s+(\d{2})$")


def parse_dtg(dtg: str) -> datetime:
    """'041200Z NOV 26' -> 2026-11-04T12:00:00Z. Always UTC."""
    m = DTG_RE.match(dtg.strip())
    if not m:
        raise ValueError(f"not a DTG: {dtg!r}")
    dd, hh, mm, mon, yy = m.groups()
    if mon not in MONTHS:
        raise ValueError(f"bad DTG month: {mon}")
    return datetime(2000 + int(yy), MONTHS.index(mon) + 1, int(dd), int(hh), int(mm), tzinfo=UTC)


def format_dtg(dt: datetime) -> str:
    dt = dt.astimezone(UTC)
    return f"{dt.day:02d}{dt.hour:02d}{dt.minute:02d}Z {MONTHS[dt.month - 1]} {dt.year % 100:02d}"


def parse_ts(s: str) -> datetime:
    """ISO 8601 timestamp that MUST carry a zone (Z or offset). Zone-less raises (R11)."""
    s = s.strip()
    if not s:
        raise ValueError("empty timestamp")
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        raise ValueError(f"timestamp has no time zone (R11 requires Zulu): {s!r}")
    return dt.astimezone(UTC)


def iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_date(s: str) -> date:
    return date.fromisoformat(s.strip())


def date_dt(d: date) -> datetime:
    """Date-only fields are read as 00:00Z on that date."""
    return datetime(d.year, d.month, d.day, tzinfo=UTC)


def local_label(dt: datetime, local_time: dict) -> str:
    """Homeport local clock label, e.g. '0700 EST'. The offset and zone name come from the dataset profile."""
    loc = dt.astimezone(UTC) + timedelta(hours=float(local_time["utc_offset_hours"]))
    return f"{loc.hour:02d}{loc.minute:02d} {local_time['label']}"


def band(p: float, bands: dict) -> str:
    if p >= bands["green"]:
        return "GREEN"
    if p >= bands["yellow"]:
        return "YELLOW"
    return "RED"


# ---------------------------------------------------------------- mock file contract (columns per data_sources/ spec)
COLUMNS = {
    "sked_schedule.csv": ["ship_id", "uic", "hull", "tycom", "force_rev", "work_center", "mip", "equipment_desc", "eic",
                          "egl_location", "mrc", "periodicity", "man_hours", "rate", "min_skill_level", "sched_week_start",
                          "assigned_to", "status", "status_date", "recorded_by_pin", "spot_check_score", "iem_flag",
                          "situational_trigger", "notes", "as_of", "provenance"],
    "sked_loep.csv": ["ship_id", "uic", "hull", "tycom", "force_rev", "report_date", "work_center", "mip", "equipment_desc", "eic", "provenance"],
    "csmp.csv": ["jcn", "ship_id", "uic", "work_center", "jsn", "eic", "apl", "equipment_noun", "location", "date_discovered",
                 "when_discovered_code", "status_code", "job_state", "deferral_reason_code", "date_deferred", "priority",
                 "type_avail", "est_man_hours", "casrep_dtg", "casrep_id", "req_doc_numbers", "remarks", "lead_wc", "verifier",
                 "co_deferral_signed", "system_of_record", "as_of", "provenance"],
    "requisition_status.csv": ["doc_number", "ship_id", "dodaac", "jcn", "casrep_id", "nsn", "niin", "nomenclature", "qty",
                               "unit_of_issue", "priority_designator", "issue_priority_group", "rdd", "nors", "date_requisitioned",
                               "status_code", "status_date", "esd", "delay_regime", "status_history", "source_of_supply", "tcn",
                               "expedite_flag", "system_of_record", "as_of", "provenance"],
    "onboard_allowance_cosal.csv": ["ship_id", "uic", "niin", "nsn", "nomenclature", "apl", "item_type", "allowance_qty",
                                    "on_hand_qty", "due_in_qty", "sri_osi", "cross_deck_eligible", "last_inventory_date",
                                    "system_of_record", "as_of", "provenance"],
    "status_code_reference.csv": ["code", "series", "meaning", "delay_regime", "source", "provenance"],
    "wholesale_stock.csv": ["niin", "nsn", "nomenclature", "holder", "holder_name", "location", "on_hand_qty", "due_in_qty",
                            "due_in_date", "release_lead_days", "transit_days_conus", "transit_days_oconus",
                            "requires_engineering_validation", "as_of", "provenance"],
    "fleet_onboard_stock.csv": ["niin", "ship_id", "uic", "storeroom_on_hand", "storeroom_allowance", "installed_qty",
                                "installed_system_eic", "cross_deck_eligible", "cannibalize_eligible", "donor_cost_note", "as_of", "provenance"],
    "ship_positions.csv": ["ship_id", "date", "status", "port", "pier", "lat", "lon", "in_company_with", "next_port", "next_eta", "source", "provenance"],
    "roster.csv": ["member_id", "ship_id", "uic", "display_name", "rate", "rating", "paygrade", "department", "division",
                   "work_center", "duty_section", "onboard_status", "status_start", "status_end", "report_date", "prd", "eaos",
                   "necs", "as_of", "provenance"],
    "quals.csv": ["member_id", "ship_id", "pqs_ref", "watchstation_code", "watchstation_name", "qual_status", "pct_complete",
                  "interim_date", "final_date", "requal_due", "signed_by", "as_of", "provenance"],
    "watchbill.csv": ["date", "ship_id", "watch_period", "condition", "watchstation_code", "watchstation_name", "section",
                      "member_id", "as_of", "provenance"],
    "nec_billets.csv": ["ship_id", "uic", "billet_id", "billet_title", "rate_required", "nec_required", "work_center",
                        "fltmps_holder_member_id", "holder_prd", "gap_start", "inbound_member_id", "inbound_report_date", "as_of", "provenance"],
    "roc_poe_mission_map.csv": ["ship_class", "mission_area", "mission_area_name", "primary_secondary", "readiness_condition",
                                "required_capability", "weight", "provenance"],
    "readiness_baseline.csv": ["ship_id", "as_of", "mission_area", "nmet_id", "rating", "mfom_index", "band", "p_score",
                               "e_score", "s_score", "t_score", "o_score", "limiting_factor", "provenance"],
    "training_readiness.csv": ["ship_id", "mission_area", "requirement_id", "requirement_name", "team", "last_completed",
                               "periodicity_days", "expires", "scheduled_refresh", "tfom_value", "as_of", "provenance"],
    "schedule_30day.csv": ["ship_id", "block_id", "start_date", "end_date", "ofrp_phase", "employment_code", "event_id",
                           "oparea_or_port", "status", "source_msg_dtg", "superseded_block_id", "as_of", "provenance"],
    "cert_status.csv": ["ship_id", "cert_id", "cert_name", "mission_area", "status", "certified_date", "expires",
                        "planned_start", "depends_on_avail_id", "as_of", "provenance"],
    "availabilities.csv": ["avail_id", "ship_id", "avail_type", "planned_start", "planned_completion", "forecast_completion",
                           "actual_completion", "a120_date", "package_lock_date", "growth_work_items", "slip_reason",
                           "source_msg_dtg", "as_of", "provenance"],
    "insurv_findings.csv": ["ship_id", "inspection_date", "inspection_type", "eic", "finding_severity", "finding_summary",
                            "corrected", "as_of", "provenance"],
    "pii_redaction_test.csv": ["case_id", "ship_id", "input_text", "expected_redacted", "names_that_must_not_appear"],
    "hazard_model.csv": ["hazard_id", "ship_id", "eic", "hazard_kind", "rate_per_day", "window_start", "p_trigger", "median_down_days",
                         "sigma", "score", "title", "derivation", "public_source", "as_of", "provenance"],
}
PER_SHIP_CSV = ["sked_schedule.csv", "sked_loep.csv", "csmp.csv", "requisition_status.csv", "onboard_allowance_cosal.csv",
                "roster.csv", "quals.csv", "watchbill.csv", "nec_billets.csv", "readiness_baseline.csv",
                "training_readiness.csv", "schedule_30day.csv", "cert_status.csv", "availabilities.csv", "insurv_findings.csv"]
SQUADRON_CSV = ["status_code_reference.csv", "wholesale_stock.csv", "fleet_onboard_stock.csv", "ship_positions.csv",
                "roc_poe_mission_map.csv", "pii_redaction_test.csv"]
SPEC_OF_FILE = {
    "sked_schedule.csv": "01_sked_pms.md", "sked_loep.csv": "01_sked_pms.md", "csmp.csv": "02_omms_ng_csmp.md",
    "casreps.json": "03_casrep.md", "requisition_status.csv": "04_r_supply_milstrip.md",
    "onboard_allowance_cosal.csv": "04_r_supply_milstrip.md", "status_code_reference.csv": "04_r_supply_milstrip.md",
    "wholesale_stock.csv": "05_navsup_wholesale.md", "fleet_onboard_stock.csv": "06_fleet_stock_positions.md",
    "ship_positions.csv": "06_fleet_stock_positions.md", "roster.csv": "07_r_adm.md", "quals.csv": "07_r_adm.md",
    "watchbill.csv": "07_r_adm.md", "nec_billets.csv": "08_fltmps_nec.md", "mission_equipment_tree.json": "09_mfom_mission_tree.md",
    "roc_poe_mission_map.csv": "10_roc_poe.md", "readiness_baseline.csv": "11_drrs_readiness_baseline.md",
    "training_readiness.csv": "12_training_readiness.md", "schedule_30day.csv": "13_ofrp_schedule.md",
    "events_missions.json": "14_certifications_events.md", "cert_status.csv": "14_certifications_events.md",
    "availabilities.csv": "15_availabilities_nmd.md", "daily_reports": "16_daily_reports.md",
    "daily_status_expected_facts.json": "16_daily_reports.md", "movrep": "17_movrep_logreq.md", "logreq": "17_movrep_logreq.md",
    "insurv_findings.csv": "18_insurv.md", "data_catalog.json": "19_catalog_and_assumptions.md",
    "delay_model_params.yaml": "19_catalog_and_assumptions.md", "dataset_profile.json": "19_catalog_and_assumptions.md", "scenario_feed.json": "00_README.md",
    "pii_redaction_test.csv": "20_fielded_access.md", "casrep_messages": "03_casrep.md",
    "hazard_model.csv": "21_shore_installations.md", "shore_profile.json": "21_shore_installations.md",
    "public_hazard_snapshot.json": "21_shore_installations.md",
}
