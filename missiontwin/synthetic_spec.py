"""Authoring values for the SYNTHETIC dataset in data/synthetic. Imported ONLY by the generators.

The running system never reads this module: it reads what the generators write from it (dataset_profile.json,
mission_equipment_tree.json, delay_model_params.yaml, data_catalog.json, ...). tests/test_data_only.py enforces
that no runtime module imports it. Every unit, part and name here is invented.
"""
from __future__ import annotations

import copy
from datetime import date, datetime, timedelta

from .domain import UTC, iso

# ---------------------------------------------------------------- scenario clock (written to dataset_profile.json)
SCENARIO_NOW = datetime(2026, 11, 4, 8, 0, 0, tzinfo=UTC)  # day 0
DAY0_DATE = date(2026, 11, 4)
LOCAL_TIME = {"utc_offset_hours": -5, "label": "EST", "zone": "Norfolk, VA (EST in November)"}


def day_of(dt: datetime) -> float:
    """Fractional days since scenario now (day 0 = 2026-11-04T08:00Z)."""
    return (dt - SCENARIO_NOW).total_seconds() / 86400.0


def dt_of(day: float) -> datetime:
    return SCENARIO_NOW + timedelta(days=day)


def d(n: int) -> date:
    """Calendar date of scenario day n."""
    return DAY0_DATE + timedelta(days=n)


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


# ---------------------------------------------------------------- engine model numbers added to the ledger
# Formerly written inline in the engine and fix search; now read from delay_model_params.yaml like the rest.
DEFAULT_PARAMS.update({
    "casrep_category_score": {"value": {"2": 0.6, "3": 0.0, "4": 0.0}, "tag": "assumed",
                              "source": "CASREP category to equipment score: CAT 2 degraded, CAT 3/4 not mission capable"},
    "casrep_no_etr_days": {"value": 30, "tag": "assumed",
                           "source": "an open CASREP with no ETR is treated as unresolved for the 30-day horizon"},
    "unknown_status_regime": {"value": "DUE_IN", "tag": "assumed",
                              "source": "supply status code missing from status_code_reference.csv: treated as backordered"},
    "expedite_regime_step": {"value": {"PROCUREMENT": "LONG", "LONG": "DUE_IN", "DUE_IN": "NEAR", "NEAR": "NEAR"},
                             "tag": "assumed", "source": "expedite_effect: one delay regime faster"},
    "redundancy_loss_score": {"value": 0.6, "tag": "assumed",
                              "source": "a component that loses a redundant unit (still above minimum working) is degraded; "
                                        "same score as equipment status 3"},
    "system_capable_score": {"value": 0.6, "tag": "assumed",
                             "source": "a critical system at or above this score counts toward mission-area capability "
                                       "(the yellow band edge)"},
    "fix_search": {"value": {"min_gain": 0.01, "gate_met": 0.995, "casualty_relevance": 0.02, "shift_days": [4, 7],
                             "max_pairs": 30, "max_ship_shore_pairs": 8}, "tag": "assumed",
                   "source": "fix search limits: smallest gain worth approving (1 point), gate treated as met, "
                             "casualty probability worth a fix, ISIC schedule-shift options, package search size"},
})

# Bounds for assumptions a user may edit (written to delay_model_params.yaml as editable_ranges).
EDITABLE_RANGES = {path: list(bounds) for path, bounds in EDITABLE_NUMERIC.items()}

# ---------------------------------------------------------------- source coverage (written into data_catalog.json)
# Deliberately explicit: loading evidence is not a claim that all its fields affect forecasts.
COVERAGE = {
    # folders
    'casrep_messages': ('modeled', 'Casualty lifecycle and equipment impairment'),
    'daily_reports': ('partial', 'Verified selected personnel/assist facts; tentative claims require review'),
    'movrep': ('partial', 'Known arrival, departure and delivery-window constraints'),
    'logreq': ('partial', 'Known arrival, departure and delivery-window constraints'),
    'csmp.csv': ('modeled', 'Material impairments and first linked requisition; not a multi-part repair scheduler'),
    'requisition_status.csv': ('modeled', 'Known status history, estimated shipping and modeled transit/repair'),
    'onboard_allowance_cosal.csv': ('modeled', 'Storeroom inventory and transfer eligibility'),
    'roster.csv': ('modeled', 'Qualified personnel availability; not watch-rotation optimization'),
    'quals.csv': ('modeled', 'Latest known qualification per person/station and expiry'),
    'training_readiness.csv': ('modeled', 'Training expiry and scheduled refresh'),
    'cert_status.csv': ('modeled', 'Certification status and expiry'),
    'schedule_30day.csv': ('modeled', 'Event dates and planned port windows'),
    'availabilities.csv': ('modeled', 'Availability completion; not automatic certification rescheduling'),
    'sked_schedule.csv': ('partial', 'Lost-PMS risk only; IEM and workforce capacity are not modeled'),
    'wholesale_stock.csv': ('partial', 'Stock, release/transit lead times and engineering validation; no real authorization'),
    'watchbill.csv': ('review_only', 'Unqualified assignment detection; no sustainable rotation calculation'),
    'nec_billets.csv': ('review_only', 'Ship/shore disagreement; not a complete NEC staffing projection'),
    'readiness_baseline.csv': ('comparison', 'Reported material/rating baseline, kept separate from forecast probabilities'),
    'fleet_onboard_stock.csv': ('partial', 'Cannibalization eligibility and derived stock review; COSAL is storeroom inventory authority'),
    'ship_positions.csv': ('context_only', 'Context only; transfer windows use schedule and known movement messages'),
    'insurv_findings.csv': ('not_modeled', 'Optional inspection prior is not implemented'),
    'roc_poe_mission_map.csv': ('context_only', 'Assignment context; runtime dependency weights come from the validated mission tree'),
    'mission_equipment_tree.json': ('modeled', 'Profile-specific hierarchy, dependencies and material weights'),
    'status_code_reference.csv': ('context_only', 'Reference vocabulary; arrival regime mapping is an explicit model assumption'),
    'hazard_model.csv': ('modeled', 'Public regional storm, grid and tide figures applied to invented facilities by stated assumption'),
    'shore_profile.json': ('modeled', 'Mock installations with invented capability hierarchy, dependencies and weights'),
    'public_hazard_snapshot.json': ('partial', 'Public regional inputs behind hazard_model.csv; not a measurement of any installation'),
}
DEFAULT_COVERAGE = ('context_only', 'Supporting source; no direct forecast contribution')


def coverage_of(file: str) -> tuple[str, str]:
    """How the forecast uses a catalog entry, by file or folder name."""
    return COVERAGE.get(file.rstrip('/').rsplit('/', 1)[-1], DEFAULT_COVERAGE)


# ---------------------------------------------------------------- ship drawing layout (written to dataset_profile.json)
MOUNTS = {
    "air_radar": [16.5, 26, 0], "chill": [12, 4, 3.2],
    "vls_fwd": [33.9, 12, 0], "vls_aft": [-21.3, 12, 0],
    "engine_p": [-30, 4, -3.2], "engine_s": [-15, 4, 3.2],
    "genset_1": [-3, 4, -3.2], "genset_2": [24, 4, -3.2],
    "flight": [-55.2, 12, 0], "gun": [51.6, 14, 0],
    "sonar": [61.8, 3.6, 3.2], "sat": [1.5, 19, -7.5],
    "ciws": [-35.7, 20, 0], "steering": [-62, 4, 0],
    "navigation": [20, 24, 6], "operations": [8, 13, -3],
    "support": [4, 4, 3.2], "surface_launchers": [-11, 12, 7],
}
SYSTEM_MOUNTS = {
    "SPY1D": ["air_radar"], "CIWS": ["ciws"], "VLS": ["vls_fwd", "vls_aft"],
    "SQQ89": ["sonar"], "HELO": ["flight"], "GUN5": ["gun"], "SSM": ["surface_launchers"],
    "GTM": ["engine_p", "engine_s"], "SSDG": ["genset_1", "genset_2"],
    "STEER": ["steering"], "NAVRAD": ["navigation"], "HM": ["support"],
    "LAN": ["operations"], "COMMS": ["sat"],
}
COMPONENT_MOUNTS = {"SPY1D-CW": {"name": "Radar cooling water pump", "mounts": ["chill"]}}
VISUAL_MODEL = {"model": "Illustrative DDG; not verified DTMB geometry or actual installed layout",
                "hull_class": "Notional Arleigh Burke-style destroyer"}

# ---------------------------------------------------------------- supply holders (written to dataset_profile.json)
# counts_as_wholesale_stock: stock that lets an expedite move one regime faster.
# direct_pull: a fix may pull the part straight from this holder.
# release_when_unstated: release lead used when the stock record states none.
SUPPLY_HOLDERS = {
    "NAVSUP_WSS": {"counts_as_wholesale_stock": True, "direct_pull": True,
                   "release_when_unstated": {"fixed_days": 1, "label": "WSS release (record states no lead)"}},
    "DLA": {"counts_as_wholesale_stock": True, "direct_pull": False},
    "PROGRAM_OFFICE": {"counts_as_wholesale_stock": False, "direct_pull": True,
                       "release_when_unstated": {"param": "program_office_release_days",
                                                 "label": "program office release (ledger; record states no lead)"}},
}


def dataset_profile() -> dict:
    """squadron/dataset_profile.json: who the units are, the scenario clock, and how they are drawn and supplied."""
    return {
        "_banner": "SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA",
        "schema_version": 1, "name": "canonical", "mapping_version": "1",
        "scenario_now": iso(SCENARIO_NOW), "local_time": LOCAL_TIME,
        "squadron": SQUADRON, "tycom": TYCOM,
        "ships": copy.deepcopy(SHIPS), "watchstations": dict(WATCHSTATIONS),
        "inport_employment_codes": list(INPORT_CODES),
        "supply_holders": copy.deepcopy(SUPPLY_HOLDERS),
        "visual_model": dict(VISUAL_MODEL), "mounts": copy.deepcopy(MOUNTS), "system_mounts": copy.deepcopy(SYSTEM_MOUNTS),
        "component_mounts": copy.deepcopy(COMPONENT_MOUNTS),
        "provenance": "proposed (all identities invented; layout illustrative)",
    }
