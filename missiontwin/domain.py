"""Shared domain constants: clock, squadron, mission tree, assumption ledger, file contract.

Everything here is SYNTHETIC. Specs live in data_sources/ (master: data_sources/00_README.md).
"""
from __future__ import annotations

import copy
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
SCENARIO_NOW = datetime(2026, 11, 4, 8, 0, 0, tzinfo=UTC)  # day 0
DAY0_DATE = date(2026, 11, 4)
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


def day_of(dt: datetime) -> float:
    """Fractional days since scenario now (day 0 = 2026-11-04T08:00Z)."""
    return (dt - SCENARIO_NOW).total_seconds() / 86400.0


def dt_of(day: float) -> datetime:
    return SCENARIO_NOW + timedelta(days=day)


def d(n: int) -> date:
    """Calendar date of scenario day n."""
    return DAY0_DATE + timedelta(days=n)


def local_label(dt: datetime) -> str:
    """Norfolk local label for the UI (EST in November = Z-5)."""
    loc = dt.astimezone(UTC) - timedelta(hours=5)
    return f"{loc.hour:02d}{loc.minute:02d} EST"


# ---------------------------------------------------------------- squadron (all placeholders)
SHIPS = {
    "KESSLER": {"name": "USS KESSLER", "hull": "DDG-991", "uic": "99101", "dodaac": "V99101",
                "role": "Primary ship; full demo scenario", "depth": "full", "ofrp_phase": "INTEGRATED"},
    "VARNELL": {"name": "USS VARNELL", "hull": "DDG-992", "uic": "99102", "dodaac": "V99102",
                "role": "Donor; holds the spare cooling pump", "depth": "full", "ofrp_phase": "BASIC"},
    "ASHBY": {"name": "USS ASHBY", "hull": "DDG-993", "uic": "99103", "dodaac": "V99103",
              "role": "Third ship for the squadron view", "depth": "light", "ofrp_phase": "SUSTAINMENT"},
}
SHIP_IDS = list(SHIPS)
SQUADRON = "DESRON 99"
TYCOM = "CNSL"
# Schedule employment codes where the ship is pierside; any other code (UNDERWAY, ...) is at sea.
INPORT_CODES = ("UPK", "INPORT", "AVAIL", "HOLUPK", "RFS")


def hull_key(ship_id: str) -> str:
    return SHIPS[ship_id]["hull"].replace("-", "")  # DDG991


# ---------------------------------------------------------------- watchstations (placeholders)
WATCHSTATIONS = {
    "2200": "LOOKOUT",
    "2300": "HELMSMAN",
    "2400": "QUARTERMASTER OF THE WATCH",
    "2500": "BOATSWAINS MATE OF THE WATCH",
    "3110": "ENGINEERING OFFICER OF THE WATCH (SYNTH)",
    "4310": "SPY RADAR SYSTEM CONTROLLER (SYNTH)",
    "4320": "CIWS MOUNT CONTROLLER (SYNTH)",
    "4330": "VLS LAUNCH CONTROL OPERATOR (SYNTH)",
    "4410": "SONAR SUPERVISOR (SYNTH)",
    "4420": "HELO CONTROL OFFICER (SYNTH)",
    "4510": "GUN CONTROL OPERATOR (SYNTH)",
}
WATCHSTATION_RATINGS = {
    "4310": ["FC"], "4320": ["FC"], "4330": ["GM", "FC"], "4410": ["STG"], "4420": ["OS"],
    "4510": ["GM"], "3110": ["GSM", "GSE"], "2400": ["QM"], "2500": ["BM"],
    "2300": ["QM", "BM", "SN"], "2200": ["SN", "BM", "OS", "QM", "FN"],
}

# ---------------------------------------------------------------- parts (placeholder NIINs 01999xxxx)
PARTS = {
    "019990001": {"nsn": "4320-01-999-0001", "nomenclature": "PUMP, CENTRIFUGAL, COOLING WATER", "apl": "APL-PH-000123", "wc": "CF01"},
    "019990077": {"nsn": "5996-01-999-0077", "nomenclature": "AMPLIFIER, SERVO, CIWS MOUNT", "apl": "APL-PH-000177", "wc": "CF02"},
    "019990088": {"nsn": "5998-01-999-0088", "nomenclature": "CIRCUIT CARD, LAUNCH SEQUENCER", "apl": "APL-PH-000188", "wc": "CF02"},
    "019990044": {"nsn": "5895-01-999-0044", "nomenclature": "SWITCH, ETHERNET, RUGGEDIZED", "apl": "APL-PH-000144", "wc": "CE01"},
    "019990101": {"nsn": "4320-01-999-0101", "nomenclature": "PUMP, HYDRAULIC, GUN MOUNT", "apl": "APL-PH-000201", "wc": "CF02"},
    "019990201": {"nsn": "2915-01-999-0201", "nomenclature": "PUMP, FUEL, GAS TURBINE", "apl": "APL-PH-000301", "wc": "ER01"},
    "019990211": {"nsn": "2990-01-999-0211", "nomenclature": "GOVERNOR, SSDG", "apl": "APL-PH-000311", "wc": "EE01"},
    "019990301": {"nsn": "4320-01-999-0301", "nomenclature": "PUMP, HYDRAULIC, STEERING", "apl": "APL-PH-000401", "wc": "EA01"},
    "019990401": {"nsn": "5960-01-999-0401", "nomenclature": "MAGNETRON, NAV RADAR", "apl": "APL-PH-000501", "wc": "OD01"},
    "019990501": {"nsn": "5820-01-999-0501", "nomenclature": "TRANSCEIVER, HF", "apl": "APL-PH-000601", "wc": "CE01"},
    "019990601": {"nsn": "4130-01-999-0601", "nomenclature": "COMPRESSOR, CHILLED WATER", "apl": "APL-PH-000701", "wc": "EA01"},
    "019990701": {"nsn": "6210-01-999-0701", "nomenclature": "CONTROLLER, FLIGHT DECK LIGHTING", "apl": "APL-PH-000801", "wc": "EA01"},
}


def niin_of(nsn: str) -> str:
    return nsn.replace("-", "")[4:]


# ---------------------------------------------------------------- mission tree (shape from MFOM patent, contents placeholder)
def _sys(eic, name, critical, wc, quals, components):
    return {"eic": eic, "name": name, "critical": critical, "work_center": wc,
            "required_quals": [{"watchstation_code": w, "k": k} for w, k in quals], "components": components}


def _comp(eic, name, critical, parts):
    return {"eic": eic, "name": name, "critical": critical,
            "parts": [{"niin": n, "name": PARTS[n]["nomenclature"], "installed_qty": q, "min_working": mw} for n, q, mw in parts]}


SYSTEMS = {
    "SPY1D": _sys("SPY1D", "AN/SPY-1D(V) radar", True, "CF01", [("4310", 2)], [
        _comp("SPY1D-CW", "Radar cooling water system", True, [("019990001", 2, 2)]),
        _comp("SPY1D-ARR", "Array faces", True, []),
    ]),
    "CIWS": _sys("CIWS", "Close-in weapon system", False, "CF02", [("4320", 1)], [
        _comp("CIWS-MT", "CIWS mount", True, [("019990077", 1, 1)]),
    ]),
    "VLS": _sys("VLS", "Vertical launching system", True, "CF02", [("4330", 1)], [
        _comp("VLS-LSEQ", "Launch sequencers", True, [("019990088", 2, 1)]),
        _comp("VLS-LCH", "Launcher modules", True, []),
    ]),
    "SQQ89": _sys("SQQ89", "AN/SQQ-89 ASW combat system", True, "CE01", [("4410", 2)], [
        _comp("SQQ89-PROC", "Sonar signal processing", True, [("019990044", 1, 1)]),
        _comp("SQQ89-ARR", "Hull array", True, []),
    ]),
    "HELO": _sys("HELO", "Helicopter flight deck", False, "EA01", [("4420", 1)], [
        _comp("HELO-LTS", "Flight deck lighting", False, [("019990701", 1, 1)]),
    ]),
    "GUN5": _sys("GUN5", "5-inch gun mount", True, "CF02", [("4510", 1)], [
        _comp("GUN5-HYD", "Gun mount hydraulics", True, [("019990101", 1, 1)]),
    ]),
    "SSM": _sys("SSM", "Surface-to-surface missile system (notional)", False, "CF02", [], [
        _comp("SSM-LCH", "SSM launchers", False, []),
    ]),
    "GTM": _sys("GTM", "Main propulsion gas turbines", True, "ER01", [("3110", 1)], [
        _comp("GTM-FUEL", "GTM fuel system", True, [("019990201", 4, 3)]),
    ]),
    "SSDG": _sys("SSDG", "Ship service diesel generators", True, "EE01", [], [
        _comp("SSDG-GOV", "SSDG governors", True, [("019990211", 3, 2)]),
    ]),
    "STEER": _sys("STEER", "Steering", True, "EA01", [("2300", 1)], [
        _comp("STEER-HYD", "Steering hydraulics", True, [("019990301", 2, 1)]),
    ]),
    "NAVRAD": _sys("NAVRAD", "Navigation radars", False, "OD01", [("2400", 1)], [
        _comp("NAVRAD-TX", "Nav radar transmitters", False, [("019990401", 2, 1)]),
    ]),
    "HM": _sys("HM", "Ship support (HVAC, chilled water)", False, "EA01", [], [
        _comp("HM-CHW", "Chilled water plant", False, [("019990601", 3, 2)]),
    ]),
    "LAN": _sys("LAN", "Combat-system LAN", True, "CE01", [], [
        _comp("LAN-CORE", "LAN core switches", True, [("019990044", 2, 2)]),
    ]),
    "COMMS": _sys("COMMS", "Exterior communications", True, "CE01", [], [
        _comp("COMMS-HF", "HF communications", False, [("019990501", 2, 1)]),
    ]),
}

# mission area -> (name, [(system eic, weight)])  weights sum to 1 per area (placeholders)
AREAS = {
    "AW": ("Air Warfare", [("SPY1D", 0.5), ("CIWS", 0.2), ("VLS", 0.3)]),
    "ASW": ("Anti-Submarine Warfare", [("SQQ89", 0.6), ("HELO", 0.4)]),
    "SUW": ("Surface Warfare", [("GUN5", 0.6), ("SSM", 0.4)]),
    "MOB": ("Mobility", [("GTM", 0.35), ("SSDG", 0.25), ("STEER", 0.2), ("NAVRAD", 0.1), ("HM", 0.1)]),
    "CCC": ("Command, Control and Communications", [("LAN", 0.6), ("COMMS", 0.4)]),
}
ROC_WEIGHTS = {"AW": 0.30, "ASW": 0.20, "SUW": 0.20, "MOB": 0.20, "CCC": 0.10}
ROC_PRIMARY = {area: "P" for area in AREAS}

COMPONENT_TO_SYSTEM = {c["eic"]: s["eic"] for s in SYSTEMS.values() for c in s["components"]}
ALL_EICS = set(SYSTEMS) | set(COMPONENT_TO_SYSTEM)
STATUS_SCORE = {"0": 1.0, "1": 0.8, "3": 0.6, "2": 0.0}  # sourced: MFOM patent
CRITICAL_CAP = 0.59


def system_of(eic: str) -> str | None:
    if eic in SYSTEMS:
        return eic
    return COMPONENT_TO_SYSTEM.get(eic)


def parts_index() -> dict[str, list[tuple[str, str, int, int]]]:
    """niin -> [(system, component, installed_qty, min_working)]"""
    out: dict[str, list] = {}
    for s in SYSTEMS.values():
        for c in s["components"]:
            for p in c["parts"]:
                out.setdefault(p["niin"], []).append((s["eic"], c["eic"], p["installed_qty"], p["min_working"]))
    return out


def mission_tree_json() -> dict:
    """The class tree as spec 09 shapes it (mission -> NTA -> functional area -> system -> component -> part)."""
    missions = []
    for area, (area_name, systems) in AREAS.items():
        missions.append({
            "mission_area": area,
            "mission_area_name": area_name,
            "tasks": [{
                "nta_id": f"NTA-{area}-01 (SYNTH)",
                "name": f"Conduct {area_name.lower()}",
                "functional_areas": [{
                    "name": f"{area_name} systems",
                    "systems": [dict(copy.deepcopy(SYSTEMS[eic]), weight=w) for eic, w in systems],
                }],
            }],
        })
    return {
        "_banner": "SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA",
        "ship_class": "DDG (notional Flight IIA)",
        "scoring": {
            "status_score_map": STATUS_SCORE,
            "bands": {"green": 0.80, "yellow": 0.60},
            "rollup": "weighted_average_with_critical_child",
            "critical_child_cap": CRITICAL_CAP,
            "provenance": "sourced (MFOM patent ~2012); cap value proposed",
        },
        "missions": missions,
        "ship_overrides": {sid: {} for sid in SHIP_IDS},
        "provenance": "proposed (structure from MFOM patent; contents placeholder)",
    }


# ---------------------------------------------------------------- assumptions ledger (spec 19)
# Every engine number that is not computed from data. tag: sourced | assumed
DEFAULT_PARAMS: dict = {
    "seed": {"value": 20261104, "tag": "assumed", "source": "fixed seed; shown in UI"},
    "runs": {"value": 500, "tag": "assumed", "source": "DEV 2 demo simulation budget"},
    "ranking_runs": {"value": 2000, "tag": "assumed", "source": "design doc performance budget"},
    "bands": {"value": {"green": 0.80, "yellow": 0.60}, "tag": "sourced", "source": "MFOM patent US20120215734A1 (80/60 bands)"},
    "status_score_map": {"value": dict(STATUS_SCORE), "tag": "sourced", "source": "MFOM patent US20120215734A1"},
    "casualty_threshold_hours": {"value": 48, "tag": "sourced", "source": "NETCINST 3040.1A (snippet)"},
    "casrep_rating_cap": {"value": {"cat4": "N", "cat3": "Q"}, "tag": "sourced", "source": "2023 carrier DRRS-S brief (snippet)"},
    "staleness_threshold_days": {"value": 5, "tag": "assumed", "source": "design doc default"},
    "part_arrival_days_by_regime": {"value": {
        "NEAR": {"dist": "lognormal", "median_conus": 5, "median_oconus": 15, "sigma": 0.4},
        "DUE_IN": {"dist": "lognormal", "median": 45, "sigma": 0.5},
        "LONG": {"dist": "lognormal", "median": 90, "sigma": 0.6},
        "PROCUREMENT": {"dist": "lognormal", "median": 135, "sigma": 0.7},
        "REJECTED": {"re_requisition_add_days": 3, "then": "DUE_IN"},
    }, "tag": "assumed", "source": "placeholder medians from research notes; not statistics"},
    "transit_days_conus_default": {"value": 5, "tag": "sourced", "source": "DLA ADC 1114 (snippet)"},
    "program_office_release_days": {"value": {"min": 2, "max": 5}, "tag": "assumed",
                                    "source": "no public source; used when a program office wholesale record states no release_lead_days"},
    "engineering_validation_days": {"value": {"min": 1, "max": 3}, "tag": "assumed", "source": "Gridley case implies ISEA validation step; duration assumed"},
    "expedite_effect": {"value": "one regime faster if wholesale on hand > 0, else none", "tag": "assumed", "source": "no public source"},
    "cross_deck_days": {"value": {"same_port": 1, "in_company": {"min": 1, "max": 3}, "different_ports_conus": {"min": 2, "max": 5}},
                        "tag": "assumed", "source": "no public source"},
    "cannibalize_extra_days": {"value": {"min": 1, "max": 2}, "tag": "assumed", "source": "GAO: cannibalization doubles work (remove + reinstall)"},
    "repair_after_part_days": {"value": {"dist": "triangular", "min": 1, "mode": 2, "max": 4}, "tag": "assumed", "source": "no public source"},
    "etr_slip": {"value": {"p_slip": 0.4, "median": 4, "sigma": 0.6}, "tag": "assumed", "source": "no public data on ETR slip"},
    "availability_slip": {"value": {"p_late": 0.7, "median": 3, "sigma": 0.5}, "tag": "sourced",
                          "source": "GAO-20-86 (~70% of availabilities late, 2014-18); extension size assumed"},
    "background_failure_rate_per_unit_day": {"value": 0.001, "tag": "assumed", "source": "no public failure-rate data"},
    "lost_pms_hazard_multiplier": {"value": 2.0, "tag": "assumed", "source": "lost PMS treated as a correlation, not a feed (spec 01)"},
    "training_refresh_success": {"value": 0.9, "tag": "assumed", "source": "no public source"},
    "cannibalization_note": {"value": "Any cannibalization rate is a lower bound (GAO-02-86: data understated up to 50%)",
                             "tag": "sourced", "source": "GAO-02-86"},
}

EDITABLE_NUMERIC = {
    # path -> (min, max) for UI edits. path = key or key.sub.sub
    "staleness_threshold_days": (1, 60),
    "transit_days_conus_default": (0, 30),
    "background_failure_rate_per_unit_day": (0, 0.05),
    "lost_pms_hazard_multiplier": (1, 10),
    "training_refresh_success": (0, 1),
    "etr_slip.p_slip": (0, 1),
    "etr_slip.median": (0, 60),
    "availability_slip.p_late": (0, 1),
    "availability_slip.median": (0, 60),
    "repair_after_part_days.min": (0, 30),
    "repair_after_part_days.mode": (0, 30),
    "repair_after_part_days.max": (0, 60),
    "cross_deck_days.same_port": (0, 30),
    "program_office_release_days.min": (0, 60),
    "program_office_release_days.max": (0, 60),
    "part_arrival_days_by_regime.NEAR.median_conus": (0, 120),
    "part_arrival_days_by_regime.DUE_IN.median": (0, 365),
    "part_arrival_days_by_regime.LONG.median": (0, 365),
    "part_arrival_days_by_regime.LONG.sigma": (0.01, 3),
    "bands.green": (0, 1),
    "bands.yellow": (0, 1),
}


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
    "delay_model_params.yaml": "19_catalog_and_assumptions.md", "scenario_feed.json": "00_README.md",
    "pii_redaction_test.csv": "20_fielded_access.md", "casrep_messages": "03_casrep.md",
}
