# /// script
# requires-python = ">=3.13"
# dependencies = ["reportlab==4.4.5", "pypdf==6.1.3", "PyYAML==6.0.3"]
# ///

import argparse
import csv
import hashlib
import io
import json
import random
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import yaml
from pypdf import PdfReader
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent
BANNER = "SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA"
START = datetime(2026, 11, 4, 8, tzinfo=timezone.utc)
SNAPSHOT = datetime(2026, 11, 7, 18, tzinfo=timezone.utc)
SEED = 20261104
MISSIONS = {"AW": "Air Warfare", "ASW": "Anti-Submarine Warfare",
            "SUW": "Surface Warfare", "MOB": "Mobility", "CCC": "Command and Communications"}
SHIPS = [("KESSLER", "99101", "DDG-991", 0, "INTEGRATED", 75),
         ("VARNELL", "99102", "DDG-992", 600, "BASIC", 60),
         ("ASHBY", "99103", "DDG-993", 300, "SUSTAINMENT", 45)]
SYSTEMS = [
    ("AW", "SPY1D", "Radar (SPY-1D-style)", "CF01", "FC", "4310", 2, "F9A1", "radar", 0.60, True),
    ("AW", "CIWS", "Close-in weapon system", "CF02", "FC", "4320", 1, "F9B2", "aft_weapons", 0.25, False),
    ("AW", "AEGIS", "Combat direction processor", "CF01", "FC", "4330", 2, "F9B2", "operations", 0.15, False),
    ("ASW", "SQQ89", "Sonar processing suite", "CA01", "STG", "4410", 2, "S9A1", "sonar", 0.60, True),
    ("ASW", "TOWED", "Towed sensor handling system", "CA01", "STG", "4420", 1, "S9A1", "stern", 0.25, False),
    ("ASW", "SONARPROC", "Acoustic workstation", "CA01", "STG", "4430", 1, "S9B2", "operations", 0.15, False),
    ("SUW", "GUN5", "Forward gun mount", "CW01", "GM", "4510", 2, "G9A1", "forward_weapons", 0.60, True),
    ("SUW", "SURFSEARCH", "Surface search sensor", "CE01", "ET", "4520", 1, "E9A1", "mast", 0.25, False),
    ("SUW", "FIRECONTROL", "Surface fire-control console", "CF02", "FC", "4530", 1, "F9B2", "operations", 0.15, False),
    ("MOB", "PROPULSION", "Propulsion plant", "ER01", "GSM", "4610", 2, "M9D1", "machinery", 0.60, True),
    ("MOB", "POWER", "Electrical generation and distribution", "EE01", "EM", "4620", 2, "M9E1", "machinery", 0.25, False),
    ("MOB", "NAVRADAR", "Navigation radar", "OD01", "QM", "4630", 1, "Q9A1", "bridge", 0.15, False),
    ("CCC", "CSLAN", "Combat-system local network", "CE01", "ET", "4710", 2, "E9C1", "operations", 0.60, True),
    ("CCC", "SATCOM", "Satellite communications terminal", "CE01", "ET", "4720", 1, "E9C1", "mast", 0.25, False),
    ("CCC", "DATALINK", "Tactical data-link terminal", "CE01", "ET", "4730", 1, "E9C1", "mast", 0.15, False),
]
SCORE_MAP = {"0": 1.0, "1": 0.8, "3": 0.6, "2": 0.0}
STATUS_CODES = {"BA": ("Processing for shipment from stock", "NEAR"),
                "BB": ("Backordered against a due-in", "DUE_IN"),
                "BC": ("Backordered; long delay expected", "LONG"),
                "BV": ("On contract for direct vendor delivery", "PROCUREMENT"),
                "BZ": ("Direct-delivery procurement in process", "PROCUREMENT"),
                "B3": ("Requested delivery date unrealistic", "LONG"),
                "B5": ("Follow-up received; working to improve shipping estimate", "DUE_IN"),
                "CB": ("Rejected; quantity unavailable", "REJECTED"),
                "CG": ("Rejected; item unidentified", "REJECTED"),
                "CJ": ("Rejected; item obsolete", "REJECTED"),
                "CU": ("Rejected; item no longer produced", "REJECTED")}


def stamp(value):
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def moment(day=0, hour=6):
    return START.replace(hour=hour) + timedelta(days=day)


def day_date(day=0):
    return moment(day).date().isoformat()


def dtg(value):
    return value.strftime("%d%H%MZ %b %y").upper()


def parse_time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def member(offset, number):
    return f"M-{offset + number:04d}"


class Package:
    def __init__(self):
        self.random = random.Random(SEED)
        self.entries = {}
        self.tables = {}
        self.ship_data = {}
        self.equipment = []
        self.parts = []
        self.extracted = []
        self.anomalies = []

    def record(self, relative, source, spec, count, fields=None):
        self.entries[relative] = {"file": relative, "real_system": source,
            "spec": f"data_sources/{spec}" if spec else "Exercise extension",
            "steward": "DESRON 99 exercise team (fictional)",
            "marking": BANNER, "refresh": "static exercise package",
            "as_of": stamp(SNAPSHOT), "staleness_threshold_days": 5,
            "record_count": count, "fields": fields or [],
            "provenance": "proposed", "contains_real_operational_data": False}

    def json(self, relative, content, source="Exercise metadata", spec="", count=None):
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        content = {"_banner": BANNER, **content}
        target.write_text(json.dumps(content, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
        self.record(relative, source, spec, count if count is not None else 1)

    def csv(self, relative, rows, source, spec):
        if not rows:
            raise ValueError(f"Empty dataset: {relative}")
        fields = list(dict.fromkeys(key for row in rows for key in row))
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=fields)
            writer.writeheader()
            for row in rows:
                writer.writerow({key: str(value).lower() if isinstance(value, bool) else value
                                 for key, value in row.items()})
        self.tables[relative] = rows
        self.record(relative, source, spec, len(rows), fields)
        timestamps = [row["as_of"] for row in rows if row.get("as_of")]
        if timestamps:
            self.entries[relative]["as_of"] = max(timestamps)
            self.entries[relative]["oldest_record_as_of"] = min(timestamps)

    def text(self, relative, text, source, spec):
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f"UNCLAS//SYNTHETIC EXERCISE//\n{BANNER}\n{text}\n", encoding="utf-8")
        self.record(relative, source, spec, 1)

    def pdf(self, relative, title, lines):
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        document = canvas.Canvas(str(target), pagesize=letter, invariant=1)
        document.setTitle(f"SYNTHETIC: {title}")
        document.setAuthor("Fictional DESRON 99 exercise generator")
        document.setFont("Helvetica-Bold", 8)
        document.drawString(30, 765, BANNER)
        document.drawString(30, 25, BANNER)
        document.setFont("Helvetica-Bold", 13)
        document.drawString(30, 730, title)
        document.setFont("Helvetica", 9)
        vertical = 700
        for line in lines:
            for segment in [line[index:index + 102] for index in range(0, max(1, len(line)), 102)]:
                document.drawString(30, vertical, segment)
                vertical -= 15
        document.save()
        self.record(relative, "Locally generated shipboard report", "16_daily_reports.md", 1)


def build_reference(package):
    equipment = []
    parts = []
    zones = []
    for index, system in enumerate(SYSTEMS):
        area, eic, name, work_center, rating, station, minimum, nec, zone, weight, critical = system
        niin = "019990001" if eic == "SPY1D" else "019990044" if eic in {"SQQ89", "CSLAN"} else f"01999{index + 2:04d}"
        part_eic = {"SPY1D": "SPY1D-CW", "SQQ89": "SQQ89-LAN", "CSLAN": "CSLAN-SW"}.get(eic, f"{eic}-MOD")
        noun = "Cooling water pump" if eic == "SPY1D" else "Shared network switch" if niin == "019990044" else f"{name} service module"
        equipment.append({"mission_area": area, "eic": eic, "component_eic": part_eic,
            "name": name, "work_center": work_center, "rating": rating,
            "watchstation_code": station, "required_qualified": minimum, "nec": nec,
            "niin": niin, "zone_id": zone, "weight": weight, "critical": critical})
        if not any(part["niin"] == niin for part in parts):
            parts.append({"niin": niin, "nsn": f"{'4320' if eic == 'SPY1D' else '5998'}-{niin[:2]}-{niin[2:5]}-{niin[5:]}",
                "nomenclature": noun.upper() + " (SYNTH)", "apl": f"APL-PH-{index + 123:06d}",
                "unit_of_issue": "EA", "provenance": "placeholder"})
        zones.append({"eic": eic, "component_eic": part_eic, "mission_area": area,
            "visual_reference": "US Navy Combatant, DTMB 5415", "zone_id": zone,
            "attachment_key": f"system_{eic.lower()}",
            "placement_basis": "Illustrative logical zone; not actual compartment or mesh coordinates",
            "provenance": "placeholder"})
    package.equipment, package.parts = equipment, parts
    package.csv("squadron/part_catalog.csv", parts, "Notional parts reference", "04_r_supply_milstrip.md")
    package.csv("squadron/visual_system_map.csv", zones, "Dashboard exercise extension", "09_mfom_mission_tree.md")
    ships = [{"ship_id": ship, "name": f"USS {ship.title()} (SYNTH)", "hull": hull,
        "uic": uic, "dodaac": f"V{uic}", "squadron": "DESRON 99 (SYNTH)",
        "ship_class": "Notional guided-missile destroyer, Arleigh Burke-style Flight IIA",
        "visual_reference": "US Navy Combatant, DTMB 5415",
        "visual_relationship": "Generic combatant visualization only; not an exact class or installed fit",
        "ofrp_phase": phase, "crew_count": 300, "provenance": "placeholder"}
        for ship, uic, hull, offset, phase, jobs in SHIPS]
    package.csv("squadron/ships.csv", ships, "Fictional unit registry", "00_README.md")
    mission_rows, trees = [], []
    for area, name in MISSIONS.items():
        mission_rows.append({"ship_class": "DDG (notional)", "mission_area": area,
            "mission_area_name": name, "primary_secondary": "P", "readiness_condition": "III",
            "required_capability": "F", "weight": {"AW": .3, "ASW": .2, "SUW": .2, "MOB": .2, "CCC": .1}[area],
            "provenance": "proposed"})
        nodes = []
        for equipment in [item for item in package.equipment if item["mission_area"] == area]:
            part = next(item for item in parts if item["niin"] == equipment["niin"])
            nodes.append({"eic": equipment["eic"], "name": equipment["name"],
                "critical": equipment["critical"], "weight": equipment["weight"],
                "required_quals": [{"watchstation_code": equipment["watchstation_code"], "k": equipment["required_qualified"]}],
                "components": [{"eic": equipment["component_eic"], "name": part["nomenclature"],
                    "critical": True, "parts": [{"niin": part["niin"], "name": part["nomenclature"],
                        "installed_qty": 2 if equipment["eic"] == "SPY1D" else 1,
                        "min_working": 2 if equipment["eic"] == "SPY1D" else 1}]}]})
        trees.append({"mission_area": area, "tasks": [{"nta_id": f"NTA-{area}-01 (SYNTH)",
            "name": f"Exercise {name} task", "functional_areas": [{"name": name, "systems": nodes}]}]})
    package.json("squadron/mission_equipment_tree.json", {"ship_class": "DDG (notional)",
        "scoring": {"status_score_map": SCORE_MAP, "bands": {"green": .8, "yellow": .6},
            "rollup": "Weighted systems; critical zero caps mission index at 59",
            "rating_policy": "Reported Y/Q/N is independent; index is not a probability",
            "provenance": "proposed; score map and bands informed by historical MFOM patent"},
        "missions": trees, "provenance": "proposed"}, "MFOM-inspired exercise graph", "09_mfom_mission_tree.md", 5)
    package.csv("squadron/roc_poe_mission_map.csv", mission_rows, "ROC/POE-inspired reference", "10_roc_poe.md")
    package.csv("squadron/status_code_reference.csv", [{"code": code, "series": code[0],
        "meaning": meaning, "delay_regime": regime, "source": "Repository AP7.16 research; not independently verified",
        "provenance": "proposed"} for code, (meaning, regime) in STATUS_CODES.items()], "MILSTRIP-style reference", "04_r_supply_milstrip.md")


def build_people(package, ship, uic, offset):
    roster, quals, billets, personnel = [], [], [], []
    work_centers = [("CF01", "FC", "COMBAT SYSTEMS"), ("CF02", "FC", "COMBAT SYSTEMS"),
        ("CA01", "STG", "COMBAT SYSTEMS"), ("CW01", "GM", "COMBAT SYSTEMS"),
        ("CE01", "ET", "COMBAT SYSTEMS"), ("ER01", "GSM", "ENGINEERING"),
        ("EE01", "EM", "ENGINEERING"), ("OD01", "QM", "OPERATIONS"),
        ("EA01", "MM", "ENGINEERING"), ("S001", "LS", "SUPPLY"),
        ("S002", "CS", "SUPPLY"), ("OX01", "OS", "OPERATIONS")]
    for number in range(1, 301):
        work_center, rating, department = work_centers[(number - 1) % len(work_centers)]
        if number in {7, 11, 19, 23} or (ship == "ASHBY" and number == 112):
            work_center, rating, department = "CF01", "FC", "COMBAT SYSTEMS"
        paygrade = 6 if number % 5 == 2 else 5 if number % 3 else 4
        rank = f"{rating}{7 - paygrade}"
        grade = f"E{paygrade}"
        if 250 <= number <= 259:
            grade, rank = "E3", f"{rating}SN"
        elif 260 <= number <= 280:
            grade = "E9" if number == 280 else "E8" if number % 5 == 0 else "E7"
            rank = rating + {"E7": "C", "E8": "CS", "E9": "CM"}[grade]
        elif number in {1, 2} or number > 280:
            grade = "O5" if number == 1 else "O4" if number == 2 else "O3" if number % 3 == 0 else "O2" if number % 2 == 0 else "O1"
            rank = {"O1": "ENS", "O2": "LTJG", "O3": "LT", "O4": "LCDR", "O5": "CDR"}[grade]
            rating, work_center, department = "OFFICER", "OX01", "EXECUTIVE"
        roster.append({"member_id": member(offset, number), "ship_id": ship, "uic": uic,
            "display_name": f"{rank} SYNTH-{offset + number:04d}",
            "rate": rank, "rating": rating, "paygrade": grade,
            "department": department, "division": work_center[:2], "work_center": work_center,
            "duty_section": (number - 1) % 3 + 1, "onboard_status": "ONBOARD",
            "status_start": "", "status_end": "", "report_date": "2025-03-10",
            "prd": day_date(6) if ship == "KESSLER" and number == 7 else day_date(90 + number * 3),
            "eaos": "2029-06-30", "necs": "", "as_of": stamp(moment(-21, 8) if ship == "KESSLER" else moment(3)),
            "provenance": "placeholder"})
    candidates = {}
    for equipment in package.equipment:
        if equipment["eic"] == "SPY1D":
            numbers = [7, 11, 19] if ship == "KESSLER" else [7, 11, 19, 112] if ship == "ASHBY" else [7, 11, 19, 23]
            pool = [roster[number - 1] for number in numbers]
        else:
            pool = [person for person in roster if person["work_center"] == equipment["work_center"]
                    and person["rating"] == equipment["rating"] and person["paygrade"].startswith("E")][:12]
        candidates[equipment["watchstation_code"]] = [person["member_id"] for person in pool]
        for position, person in enumerate(pool):
            held = set(filter(None, person["necs"].split(";"))) | {equipment["nec"]}
            person["necs"] = ";".join(sorted(held))
            quals.append({"member_id": person["member_id"], "ship_id": ship,
                "pqs_ref": f"NAVEDTRA 43xxx-{equipment['watchstation_code']} (SYNTH)",
                "watchstation_code": equipment["watchstation_code"],
                "watchstation_name": f"{equipment['name']} watchstation (SYNTH)",
                "qual_status": "INTERIM" if position == 10 else "QUALIFIED", "pct_complete": 100,
                "interim_date": "2026-09-01" if position == 10 else "", "final_date": "2025-08-01" if position != 10 else "",
                "requal_due": "2027-08-01", "signed_by": member(offset, 2),
                "as_of": stamp(moment(3)), "provenance": "placeholder"})
        for position, person in enumerate(pool[:equipment["required_qualified"] + 1]):
            drift = ship == "KESSLER" and equipment["eic"] == "SPY1D" and position == 2
            billets.append({"ship_id": ship, "uic": uic, "billet_id": f"B-{equipment['eic']}-{position + 1:02d}",
                "billet_title": equipment["name"] + " technician (SYNTH)", "rate_required": person["rate"],
                "nec_required": equipment["nec"], "work_center": equipment["work_center"],
                "fltmps_holder_member_id": "" if drift else person["member_id"],
                "holder_prd": person["prd"] if not drift else "", "gap_start": person["prd"] if not drift else day_date(-10),
                "inbound_member_id": "", "inbound_report_date": "", "as_of": stamp(moment(3)), "provenance": "placeholder"})
    for person in roster:
        quals.append({"member_id": person["member_id"], "ship_id": ship, "pqs_ref": "NAVEDTRA 43xxx-2200 (SYNTH)",
            "watchstation_code": "2200", "watchstation_name": "Lookout (SYNTH)",
            "qual_status": "IN_PROGRESS" if int(person["member_id"][-4:]) % 17 == 0 else "EXPIRED" if int(person["member_id"][-4:]) % 29 == 0 else "QUALIFIED",
            "pct_complete": 70 if int(person["member_id"][-4:]) % 17 == 0 else 100,
            "interim_date": "", "final_date": "2025-08-01", "requal_due": "2026-10-01" if int(person["member_id"][-4:]) % 29 == 0 else "2027-08-01",
            "signed_by": member(offset, 2), "as_of": stamp(moment(3)), "provenance": "placeholder"})
    if ship == "KESSLER":
        quals.append({**next(item for item in quals if item["watchstation_code"] == "4310"),
            "member_id": "M-0023", "qual_status": "IN_PROGRESS", "pct_complete": 60, "final_date": ""})
        for number, kind, end in [(7, "TRANSFERRING", ""), (11, "TAD", stamp(moment(21, 0)))]:
            personnel.append({"personnel_event_id": f"PE-KESSLER-{number:04d}", "ship_id": ship,
                "member_id": member(offset, number), "event_type": kind, "confirmed": True,
                "effective_at": stamp(moment(6, 0)), "effective_until": end,
                "known_at": stamp(moment(2, 10)), "source": "Synthetic admin orders; separate from stale roster",
                "provenance": "placeholder"})
    watchbill = []
    for day in range(30):
        for station, people in candidates.items():
            for shift, period in enumerate(["0000-0800", "0800-1600", "1600-2400"]):
                eligible = [person for person in people if not (ship == "KESSLER" and day >= 6 and
                    (person == "M-0007" or (person == "M-0011" and day < 21)))]
                assignee = eligible[shift % len(eligible)] if len(eligible) > shift else ""
                watchbill.append({"date": day_date(day), "ship_id": ship, "watch_period": period,
                    "condition": "III", "watchstation_code": station, "watchstation_name": f"Exercise station {station}",
                    "section": shift + 1, "member_id": "M-0023" if ship == "KESSLER" and day == 2 and station == "4310" and shift == 0 else assignee,
                    "assignment_state": "ASSIGNED" if assignee else "UNFILLED", "known_at": stamp(moment(3)),
                    "as_of": stamp(moment(3)), "provenance": "proposed"})
    for filename, rows, source, spec in [("roster.csv", roster, "R-ADM-style crew", "07_r_adm.md"),
        ("quals.csv", quals, "R-ADM-style qualifications", "07_r_adm.md"),
        ("watchbill.csv", watchbill, "R-ADM-style watchbill", "07_r_adm.md"),
        ("nec_billets.csv", billets, "FLTMPS-style billets", "08_fltmps_nec.md")]:
        package.csv(f"{ship}/{filename}", rows, source, spec)
    return roster, quals, personnel


def build_maintenance(package, ship, uic, hull, offset, job_count):
    jobs, orders, casreps = [], [], []
    for number in range(1, job_count + 1):
        equipment = package.equipment[(number - 1) % len(package.equipment)]
        if ship == "KESSLER" and equipment["eic"] == "CIWS":
            equipment = package.equipment[2]
        part = next(item for item in package.parts if item["niin"] == equipment["niin"])
        jcn = f"{uic}{equipment['work_center']}{number:04d}"
        doc = f"V{uic}{moment(-20).strftime('%y')[-1]}{moment(-20).strftime('%j')}{number:04d}" if number % 3 == 0 else ""
        jobs.append({"jcn": jcn, "ship_id": ship, "uic": uic, "work_center": equipment["work_center"],
            "jsn": f"{number:04d}", "eic": equipment["eic"], "apl": part["apl"],
            "equipment_noun": equipment["name"], "location": "EXERCISE-LOCATION",
            "date_discovered": day_date(-20), "when_discovered_code": "6", "status_code": "0",
            "job_state": "OPEN_AWAITING_PARTS" if doc else "DEFERRED", "deferral_reason_code": "1" if doc else "3",
            "date_deferred": day_date(-19) if not doc else "", "priority": "3", "type_avail": 4,
            "est_man_hours": package.random.choice([2, 4, 6, 8]), "casrep_dtg": "", "casrep_id": "",
            "req_doc_numbers": doc, "remarks": "Routine preservation or service work; equipment remains operable (SYNTH).",
            "lead_wc": equipment["work_center"], "verifier": member(offset, 2), "co_deferral_signed": not bool(doc),
            "system_of_record": "AWN" if ship == "ASHBY" else "OMMS-NG",
            "known_at": stamp(moment(-19)), "as_of": stamp(moment(3)), "provenance": "placeholder"})
        if doc:
            code = package.random.choice(["BA", "BB", "BC", "BV", "BZ", "B5", "CB"])
            orders.append(order_row(ship, jcn, "", doc, part, code, day_date(10 + number % 16), -20))
    definitions = {
        "KESSLER": [("017", "SPY1D", 3, 0, 12, "2", "BB"),
                    ("018", "POWER", 2, -2, 9, "1", "BA"),
                    ("015", "NAVRADAR", 2, -12, 9, "1", "BA")],
        "VARNELL": [("008", "SQQ89", 2, -4, 10, "3", "BA"), ("009", "CSLAN", 2, -3, 10, "3", "BA")],
        "ASHBY": [("004", "SATCOM", 2, -2, 10, "1", "BB"), ("005", "SURFSEARCH", 2, -7, 10, "1", "BA")],
    }
    for sequence, (serial, system_eic, category, initial_day, initial_hour, status, code) in enumerate(definitions[ship]):
        equipment = next(item for item in package.equipment if item["eic"] == system_eic)
        part = next(item for item in package.parts if item["niin"] == equipment["niin"])
        initial = moment(initial_day, initial_hour)
        missing = ship == "ASHBY" and serial == "004"
        closed = ship == "KESSLER" and serial == "015"
        jcn = f"{uic}{equipment['work_center']}{42 if system_eic == 'SPY1D' else 800 + sequence:04d}"
        if system_eic == "SPY1D":
            jobs[:] = [item for item in jobs if item["jcn"] != jcn]
        doc = f"V{uic}{initial.strftime('%y')[-1]}{initial.strftime('%j')}{sequence + 1:04d}"
        casrep_id = f"{hull.replace('-', '')}-26-{serial}"
        repair = moment(8, 12) if system_eic == "SPY1D" else moment(8 + sequence, 12)
        history = [{"dtg": dtg(initial), "known_at": stamp(initial), "etr": stamp(repair), "report_type": "INITIAL"}]
        messages = []
        if system_eic == "SPY1D":
            history.append({"dtg": dtg(moment(1, 10)), "known_at": stamp(moment(1, 10)),
                "etr": stamp(moment(18, 12)), "report_type": "UPDATE"})
        if closed:
            history.append({"dtg": dtg(moment(-3, 14)), "known_at": stamp(moment(-3, 14)),
                "etr": stamp(moment(-3, 14)), "report_type": "CORRECT"})
        for message_number, update in enumerate(history, 1):
            path = f"{ship}/casrep_messages/{casrep_id}_{message_number:02d}_{update['report_type']}.txt"
            reference = "" if message_number == 1 else f"REF/A/MSG/USS {ship}/{dtg(initial).replace(' ', '')}//\n"
            message_serial = serial if message_number == 1 else f"{int(serial) + 50 + message_number:03d}"
            supplement = "\nAMPN/PARTS RECEIVED 010800Z NOV 26. SUPPLY DELAY 98 HRS. MANHOURS 22.//" if update["report_type"] == "CORRECT" else ""
            package.text(path, f"R {update['dtg']}\nFM USS {ship} (FICTIONAL)\nTO DESRON 99 EXERCISE CELL\nBT\nMSGID/CASREP/USS {ship}/{message_serial}/NOV//\n{reference}CASUALTY/{update['report_type']}/{equipment['name']}/CAT:{category}/EIC:{equipment['component_eic']}//\nPARTSID/{part['nomenclature']}/APL:{part['apl']}/JCN:{jcn if not missing else 'NONE'}//\nESTIMATE/ETR:{dtg(parse_time(update['etr']))}//\nASSIST/REQ:{'YES' if system_eic == 'SPY1D' else 'NO'}/TYPE:{'FTS' if system_eic == 'SPY1D' else 'SHIP FORCE'}//\n1PARTS/1/NSN:{part['nsn']}/QTY:1/DOC:{doc}/PD:02/RDD:999//\nAMPN/INVENTED EQUIPMENT DEFICIENCY FOR SOFTWARE EXERCISE ONLY.//{supplement}\nRMKS/DELIVERY WINDOWS ARE IN THE SYNTHETIC SCHEDULE.//\nBT", "CASREP-style record message", "03_casrep.md")
            messages.append(path)
        casualty = {"casrep_id": casrep_id, "ship_id": ship, "uic": uic, "serial": serial,
            "initial_dtg": dtg(initial), "initial_time": stamp(initial), "known_at": stamp(initial),
            "category": category, "eic": equipment["component_eic"], "equipment": part["nomenclature"],
            "jcn": "" if missing else jcn, "mission_areas_affected": [equipment["mission_area"]],
            "assist": {"required": system_eic == "SPY1D", "type": "FTS" if system_eic == "SPY1D" else "SHIP FORCE",
                "org": "SYNTHETIC TECHNICAL SUPPORT", "confirmed_available_at": stamp(moment(5, 8)) if system_eic == "SPY1D" else ""},
            "parts": [{"nsn": part["nsn"], "niin": part["niin"], "qty": 1, "doc_number": doc, "pd": "02", "rdd": "999"}],
            "etr_history": history, "state": "CORRECTED" if closed else "OPEN",
            "closed": {"type": "CORRECT", "dtg": dtg(moment(-3, 14)), "parts_received": stamp(moment(-3, 8)),
                "supply_delay_hrs": 98, "man_hours": 22} if closed else None,
            "physical_asset_id": f"ASSET-{ship}-LAN-01" if ship == "VARNELL" else f"ASSET-{ship}-{system_eic}-01",
            "messages": messages, "provenance": "placeholder"}
        casreps.append(casualty)
        order = order_row(ship, "" if missing else jcn, casrep_id, doc, part, code,
            day_date(7 + sequence), initial_day)
        if system_eic == "SPY1D":
            order.update(status_code="BC", status_date=day_date(1), esd="2026-12-15", delay_regime="LONG",
                status_history=f"{day_date()}:BB;{day_date(1)}:BC", known_at=stamp(moment(1, 10)), expedite_flag=True)
        if ship == "ASHBY" and serial == "005":
            order.update(esd="2026-10-30", status_date="2026-10-29", known_at="2026-10-29T10:00:00Z")
        if closed:
            order.update(order_state="RECEIVED", received_at=stamp(moment(-3, 8)), esd=day_date(-5))
        orders.append(order)
        if not missing:
            jobs.append({**jobs[0], "jcn": jcn, "jsn": jcn[-4:], "work_center": equipment["work_center"],
                "eic": equipment["component_eic"], "apl": part["apl"], "equipment_noun": part["nomenclature"],
                "date_discovered": initial.date().isoformat(), "when_discovered_code": "2",
                "status_code": "0" if closed else status, "job_state": "COMPLETED" if closed else "OPEN_AWAITING_PARTS",
                "deferral_reason_code": "2" if system_eic == "SPY1D" else "1", "date_deferred": "",
                "priority": "1" if category == 3 else "2", "type_avail": 3 if system_eic == "SPY1D" else 4,
                "est_man_hours": 16, "casrep_dtg": dtg(initial), "casrep_id": casrep_id,
                "req_doc_numbers": doc, "remarks": f"CASREP {dtg(initial)}. AWAITING NIIN {part['niin']}. SYNTHETIC.",
                "lead_wc": equipment["work_center"], "co_deferral_signed": False,
                "known_at": stamp(moment(-3, 14)) if closed else stamp(initial),
                "effective_at": stamp(initial), "completed_at": stamp(moment(-3, 14)) if closed else ""})
    package.csv(f"{ship}/csmp.csv", jobs, "OMMS-NG / AWN-style CSMP", "02_omms_ng_csmp.md")
    package.csv(f"{ship}/requisition_status.csv", orders, "R-Supply-style requisitions", "04_r_supply_milstrip.md")
    package.json(f"{ship}/casreps.json", {"as_of": stamp(SNAPSHOT), "casreps": casreps}, "CASREP-style structured projection", "03_casrep.md", len(casreps))
    return jobs, orders, casreps


def order_row(ship, jcn, casualty, doc, part, code, esd, initial_day):
    uic = next(item[1] for item in SHIPS if item[0] == ship)
    return {"doc_number": doc, "ship_id": ship, "dodaac": f"V{uic}", "jcn": jcn,
        "casrep_id": casualty, "nsn": part["nsn"], "niin": part["niin"], "nomenclature": part["nomenclature"],
        "qty": 1, "unit_of_issue": "EA", "priority_designator": "02" if casualty else "09",
        "issue_priority_group": 1 if casualty else 3, "rdd": "999" if casualty else day_date(20),
        "nors": bool(casualty), "date_requisitioned": day_date(initial_day), "status_code": code,
        "status_date": day_date(initial_day), "esd": esd, "delay_regime": STATUS_CODES[code][1],
        "status_history": f"{day_date(initial_day)}:{code}", "source_of_supply": "NAVSUP WSS (SYNTH)",
        "tcn": "", "expedite_flag": False, "system_of_record": "RSUPPLY", "order_state": "OPEN",
        "received_at": "", "known_at": stamp(moment(initial_day, 12)), "as_of": stamp(moment(3)), "provenance": "placeholder"}


def build_inventory(package, ship, uic, jobs, casreps):
    inventory, installed = [], []
    for part in package.parts:
        pump = part["niin"] == "019990001"
        allowance = 0 if pump and ship == "KESSLER" else 1 if pump else 2
        on_hand = (1 if ship == "VARNELL" else 0) if pump else package.random.choice([1, 2, 2, 3])
        inventory.append({"ship_id": ship, "uic": uic, **part, "item_type": "STOREROOM",
            "allowance_qty": allowance, "on_hand_qty": on_hand, "due_in_qty": 1 if on_hand < allowance else 0,
            "sri_osi": "SRI", "cross_deck_eligible": on_hand > 0, "last_inventory_date": "2026-11-02",
            "system_of_record": "RSUPPLY", "as_of": stamp(moment(3)), "provenance": "placeholder"})
        matches = [equipment for equipment in package.equipment if equipment["niin"] == part["niin"]]
        supported = {identity for equipment in matches for identity in [equipment["eic"], equipment["component_eic"]]}
        degraded = any(job["eic"] in supported and job["status_code"] in {"1", "3"}
                   and job["job_state"] != "COMPLETED" for job in jobs)
        unmatched_casualty = any(casualty["eic"] in supported and not casualty["jcn"]
                    and casualty["state"] == "OPEN" for casualty in casreps)
        for unit in range(2 if pump else 1):
            failed = ship == "KESSLER" and pump and unit == 0
            installed.append({"ship_id": ship, "asset_id": f"ASSET-{ship}-LAN-01" if part["niin"] == "019990044" else f"ASSET-{ship}-{matches[0]['eic']}-{unit + 1:02d}",
                "niin": part["niin"], "supported_eics": ";".join(equipment["component_eic"] for equipment in matches),
                "status": "FAILED" if failed else "DEGRADED" if degraded or unmatched_casualty else "WORKING",
                "status_basis": "Unmatched synthetic casualty; requires review" if unmatched_casualty else "Synthetic equipment/job status",
                "as_of": stamp(SNAPSHOT), "provenance": "placeholder"})
    package.csv(f"{ship}/onboard_allowance_cosal.csv", inventory, "R-Supply/COSAL-style inventory", "04_r_supply_milstrip.md")
    package.csv(f"{ship}/installed_equipment.csv", installed, "Exercise asset identity extension", "09_mfom_mission_tree.md")
    return inventory, installed


def build_pms(package, ship, uic, hull, roster):
    schedule, loep = [], []
    for equipment in package.equipment:
        assignee = next(person for person in roster if person["work_center"] == equipment["work_center"] and person["paygrade"] == "E6")
        for week in range(-6, 5):
            monday = date(2026, 11, 2) + timedelta(weeks=week)
            lost = ship == "KESSLER" and ((equipment["eic"] == "SPY1D" and week == -1) or (equipment["eic"] == "CIWS" and week == -2))
            status = "SCHEDULED" if week >= 0 else "LOST" if lost else "COMPLETE"
            schedule.append({"ship_id": ship, "uic": uic, "hull": hull, "tycom": "CNSL (SYNTH)",
                "force_rev": "4-26 (SYNTH)", "work_center": equipment["work_center"],
                "mip": f"PH-{equipment['eic']}", "equipment_desc": equipment["name"], "eic": equipment["component_eic"],
                "egl_location": "EXERCISE-LOCATION", "mrc": "Q-2" if equipment["eic"] == "CIWS" else "M-1R" if equipment["eic"] == "SPY1D" else "W-1",
                "periodicity": "Q" if equipment["eic"] == "CIWS" else "M" if equipment["eic"] == "SPY1D" else "W",
                "man_hours": 1.5, "rate": assignee["rate"], "min_skill_level": assignee["rate"],
                "sched_week_start": monday.isoformat(), "assigned_to": assignee["member_id"], "status": status,
                "status_date": (monday + timedelta(days=4)).isoformat() if status != "SCHEDULED" else "",
                "recorded_by_pin": f"PIN-{assignee['member_id'][2:]}", "spot_check_score": 92 if week == -3 else "",
                "iem_flag": False, "situational_trigger": "", "notes": "Illustrative instance, not a complete recurring PMS schedule",
                "as_of": stamp(moment(3)), "provenance": "placeholder"})
        loep.append({"ship_id": ship, "uic": uic, "hull": hull, "tycom": "CNSL (SYNTH)",
            "force_rev": "4-26 (SYNTH)", "report_date": day_date(3), "work_center": equipment["work_center"],
            "mip": f"PH-{equipment['eic']}", "equipment_desc": equipment["name"],
            "eic": equipment["component_eic"], "provenance": "placeholder"})
    package.csv(f"{ship}/sked_schedule.csv", schedule, "SKED-style scheduled instances", "01_sked_pms.md")
    package.csv(f"{ship}/sked_loep.csv", loep, "PMS LOEP-style reference", "01_sked_pms.md")


def build_schedule(package, ship, phase):
    blocks = []
    schedules = {
        "KESSLER": [(0, 8, "INPORT", ""), (9, 15, "UNDERWAY", "EVT-KESSLER-01"),
                    (16, 20, "INPORT", ""), (21, 29, "UNDERWAY", "EVT-KESSLER-02")],
        "VARNELL": [(0, 7, "AVAIL", ""), (8, 13, "INPORT", ""),
                    (14, 17, "UNDERWAY", "EVT-VARNELL-01"), (18, 29, "INPORT", "")],
        "ASHBY": [(0, 4, "UNDERWAY", ""), (5, 17, "INPORT", ""),
                  (18, 24, "UNDERWAY", "EVT-ASHBY-01"), (25, 29, "INPORT", "")],
    }
    for number, (start, end, employment, event_id) in enumerate(schedules[ship], 1):
        blocks.append({"ship_id": ship, "block_id": f"SCH-{ship}-{number + (4 if ship == 'KESSLER' else 0):02d}",
            "start_date": day_date(start), "end_date": day_date(end), "ofrp_phase": phase,
            "employment_code": employment, "event_id": event_id, "oparea_or_port": "EXERCISE AREA A" if employment == "UNDERWAY" else "EXERCISE PORT A",
            "status": "CHANGED" if ship == "KESSLER" else "FIRM", "source_msg_dtg": dtg(moment(3, 15)),
            "superseded_block_id": f"SCH-{ship}-{number:02d}" if ship == "KESSLER" else "",
            "is_current": True, "known_at": stamp(moment(3, 15)) if ship == "KESSLER" else stamp(moment(-1)),
            "as_of": stamp(SNAPSHOT), "provenance": "proposed"})
    if ship == "KESSLER":
        original = [(0, 11, "INPORT", ""), (12, 18, "UNDERWAY", "EVT-KESSLER-01"),
                    (19, 20, "INPORT", ""), (21, 29, "UNDERWAY", "EVT-KESSLER-02")]
        blocks.extend({**blocks[index], "block_id": f"SCH-{ship}-{index + 1:02d}",
            "start_date": day_date(start), "end_date": day_date(end), "employment_code": employment,
            "event_id": event_id, "oparea_or_port": "EXERCISE AREA A" if employment == "UNDERWAY" else "EXERCISE PORT A",
            "status": "FIRM", "superseded_block_id": "", "is_current": False,
            "known_at": stamp(moment(-1))} for index, (start, end, employment, event_id) in enumerate(original))
    package.csv(f"{ship}/schedule_30day.csv", blocks, "OFRP-style employment schedule", "13_ofrp_schedule.md")
    certs, training = [], []
    for area in MISSIONS:
        certs.append({"ship_id": ship, "cert_id": f"CERT-{ship}-{area}", "cert_name": f"{MISSIONS[area]} exercise certification",
            "mission_area": area, "status": "NOT_STARTED" if ship == "VARNELL" and area == "ASW" else "CERTIFIED",
            "certified_date": "" if ship == "VARNELL" and area == "ASW" else "2026-05-20",
            "expires": "2027-05-20", "planned_start": day_date(5) if ship == "VARNELL" and area == "ASW" else "",
            "depends_on_avail_id": "AV-VARNELL-26-02" if ship == "VARNELL" and area == "ASW" else "",
            "as_of": stamp(moment(3)), "provenance": "proposed"})
        for number in [1, 2]:
            expiry = day_date(16) if ship == "KESSLER" and area == "AW" and number == 1 else day_date(60 + number)
            training.append({"ship_id": ship, "mission_area": area, "requirement_id": f"TRQ-{ship}-{area}-{number:02d}",
                "requirement_name": f"{MISSIONS[area]} team trainer {number} (SYNTH)", "team": f"{area} TEAM {number}",
                "last_completed": (date.fromisoformat(expiry) - timedelta(days=90)).isoformat(),
                "periodicity_days": 90, "expires": expiry, "tfom_value": .86,
                "as_of": stamp(moment(3)), "provenance": "proposed"})
    availability = [{"avail_id": f"AV-{ship}-26-02", "ship_id": ship, "avail_type": "CMAV",
        "planned_start": day_date(-10) if ship == "VARNELL" else "2026-09-01",
        "planned_completion": day_date(4) if ship == "VARNELL" else "2026-09-14",
        "forecast_completion": day_date(7) if ship == "VARNELL" else "2026-09-14",
        "actual_completion": "" if ship == "VARNELL" else "2026-09-14", "a120_date": "", "package_lock_date": "",
        "growth_work_items": 14 if ship == "VARNELL" else 0, "slip_reason": "Growth work and parts delay" if ship == "VARNELL" else "",
        "source_msg_dtg": dtg(moment(1, 14)), "known_at": stamp(moment(1, 14)),
        "as_of": stamp(moment(3)), "provenance": "placeholder"}]
    for filename, rows, source, spec in [("cert_status.csv", certs, "SFTRM/ATG-inspired certifications", "14_certifications_events.md"),
        ("training_readiness.csv", training, "TORIS-style team training", "12_training_readiness.md"),
        ("availabilities.csv", availability, "NMD/NDE-style maintenance period", "15_availabilities_nmd.md")]:
        package.csv(f"{ship}/{filename}", rows, source, spec)
    return blocks


def build_reports(package, ship):
    for day in range(-3, 3):
        report_date = day_date(day)
        path = f"{ship}/daily_reports/daily_status_{ship}_{report_date.replace('-', '')}.pdf"
        lines = [f"USS {ship} (FICTIONAL) - {report_date} 2000Z", "From: Executive Officer (exercise role)",
            "OPERATIONS", "Next event and delivery windows are recorded in the exercise schedule.",
            "ENGINEERING", "No change to the fictional propulsion plant status is reported.",
            "SUPPLY", "All part quantities and delivery dates in this report are invented."]
        facts = []
        if ship == "KESSLER" and day >= 0:
            lines.extend(["COMBAT SYSTEMS", "CASREP 017 reports the radar cooling pump deficiency.",
                "The CIWS scheduled check was lost; no corrective job has been recorded."])
        if ship == "KESSLER" and day >= 1:
            sentence = "The technical representative visit may slip to 12 NOV due to travel."
            lines.append(sentence)
            facts.append({"fact_type": "assist_eta", "casrep_id": "DDG991-26-017", "value": "2026-11-12",
                "modality": "may", "confidence": "LOW", "review_state": "NEEDS_REVIEW", "source_span": sentence})
        if ship == "KESSLER" and day >= 2:
            sentence = "Member M-0011 departs for temporary duty on 10 NOV."
            lines.extend(["ADMIN", sentence])
            facts.append({"fact_type": "personnel_absence", "member_id": "M-0011", "value": "2026-11-10",
                "modality": "reported", "confidence": "MEDIUM", "review_state": "CONFIRM_AGAINST_ORDERS", "source_span": sentence})
        lines.extend(["TRAINING", "The training team expects the next review to finish on schedule.",
            "This is tentative narrative evidence, not an operational assessment."])
        package.pdf(path, "EIGHT O'CLOCK REPORT - EXERCISE", lines)
        package.text(path.replace(".pdf", ".txt"), "\n".join(lines), "Report text companion", "16_daily_reports.md")
        package.extracted.append({"document": path, "ship_id": ship, "known_at": stamp(moment(day, 20)), "facts": facts})
    package.pdf(f"{ship}/daily_reports/pod_{ship}_20261107.pdf", "PLAN OF THE DAY - EXERCISE",
        [f"USS {ship} (FICTIONAL) - 07 NOV 2026", "From: Executive Officer (exercise role)",
         "10  0800Z  Department status review", "20  1000Z  Maintenance coordination",
         "30  1400Z  Training review", "40  1600Z  Supply and admin update"])


def material_scores(package, ship, at):
    scores = {equipment["eic"]: 1.0 for equipment in package.equipment}
    for job in package.ship_data[ship]["jobs"]:
        effective = parse_time(job.get("effective_at", job["known_at"]))
        if effective > at:
            continue
        completed = job.get("completed_at", "")
        status = "1" if completed and parse_time(completed) > at else job["status_code"]
        if completed and parse_time(completed) <= at:
            continue
        equipment = next(item for item in package.equipment if job["eic"] in {item["eic"], item["component_eic"]})
        scores[equipment["eic"]] = min(scores[equipment["eic"]], SCORE_MAP[status])
    for casualty in package.ship_data[ship]["casreps"]:
        if casualty["jcn"] or parse_time(casualty["initial_time"]) > at:
            continue
        equipment = next(item for item in package.equipment if item["component_eic"] == casualty["eic"])
        scores[equipment["eic"]] = min(scores[equipment["eic"]], .8)
    result = {}
    for area in MISSIONS:
        systems = [equipment for equipment in package.equipment if equipment["mission_area"] == area]
        value = round(sum(scores[item["eic"]] * item["weight"] for item in systems) * 100)
        result[area] = min(value, 59) if any(item["critical"] and scores[item["eic"]] == 0 for item in systems) else value
    return scores, result


def build_squadron(package):
    stock, positions, wholesale, personnel, inspections = [], [], [], [], []
    baseline, current, system_status = [], [], []
    for ship, uic, hull, offset, phase, count in SHIPS:
        data = package.ship_data[ship]
        personnel.extend(data["personnel"])
        for item in data["inventory"]:
            assets = [asset for asset in data["installed"] if asset["niin"] == item["niin"]]
            stock.append({"niin": item["niin"], "ship_id": ship, "uic": uic,
                "storeroom_on_hand": item["on_hand_qty"], "storeroom_allowance": item["allowance_qty"],
                "installed_qty": len(assets), "installed_system_eic": assets[0]["supported_eics"],
                "cross_deck_eligible": item["cross_deck_eligible"], "cannibalize_eligible": False,
                "donor_cost_note": "drops below allowance" if item["on_hand_qty"] <= item["allowance_qty"] else "spare margin remains",
                "as_of": item["as_of"], "provenance": "proposed"})
        for day in range(30):
            block = next(item for item in data["blocks"] if item["is_current"] and item["start_date"] <= day_date(day) <= item["end_date"])
            inport = block["employment_code"] != "UNDERWAY"
            positions.append({"ship_id": ship, "date": day_date(day), "status": "INPORT" if inport else "UNDERWAY",
                "port": "EXERCISE PORT A" if inport else "", "pier": "SYNTHETIC PIER" if inport else "",
                "lat": "", "lon": "", "in_company_with": "", "next_port": "EXERCISE PORT A",
                "next_eta": "", "source": f"{ship}/schedule_30day.csv;{ship}/movrep",
                "known_at": block["known_at"], "position_type": "PLANNED_NOT_TRACKED",
                "provenance": "placeholder"})
        for block in [item for item in data["blocks"] if item["is_current"]]:
            start = parse_time(block["start_date"] + "T00:00:00Z")
            if block["employment_code"] == "UNDERWAY":
                package.text(f"{ship}/movrep/{block['block_id']}.txt",
                    f"FM USS {ship} (FICTIONAL)\nDTG/{dtg(parse_time(block['known_at']))}//\nMSGID/MOVREP/{block['block_id']}//\n1. DEPART EXERCISE PORT A {dtg(start)}.\n2. OPERATE EXERCISE AREA A.\n3. ARRIVE EXERCISE PORT A {dtg(parse_time(block['end_date'] + 'T00:00:00Z') + timedelta(days=1))}.\nBT",
                    "MOVREP-inspired planned movement", "17_movrep_logreq.md")
            else:
                package.text(f"{ship}/logreq/{block['block_id']}.txt",
                    f"FM USS {ship} (FICTIONAL)\nDTG/{dtg(parse_time(block['known_at']))}//\nMSGID/LOGREQ/{block['block_id']}//\n1. EXERCISE PORT A {block['start_date']} THROUGH {block['end_date']}.\n2. PRIORITY MATERIAL: REFER TO SYNTHETIC REQUISITIONS.\n3. DELIVERY REQUEST ONLY; NO CONFIRMED SHIPMENT.\nBT",
                    "LOGREQ-inspired delivery window", "17_movrep_logreq.md")
        for at, output in [(START, baseline), (SNAPSHOT, current)]:
            scores, indices = material_scores(package, ship, at)
            for area, index in indices.items():
                output.append({"ship_id": ship, "as_of": stamp(at), "mission_area": area,
                    "nmet_id": f"NMET-{area}-01 (SYNTH)", "rating": "Q" if index < 80 else "Y",
                    "mfom_index": index, "band": "GREEN" if index >= 80 else "YELLOW" if index >= 60 else "RED",
                    "p_score": "", "e_score": index, "s_score": "", "t_score": "", "o_score": "",
                    "limiting_factor": "See linked casualty and job records" if index < 100 else "No modeled material limitation",
                    "rating_basis": "Invented exercise report, not an official rating calculation",
                    "unmodeled_pillars": "P;S;T;O numeric indices not supplied", "provenance": "proposed"})
            if at == SNAPSHOT:
                for equipment in package.equipment:
                    system_status.append({"ship_id": ship, "eic": equipment["eic"],
                        "mission_area": equipment["mission_area"], "material_score": scores[equipment["eic"]],
                        "attachment_key": f"system_{equipment['eic'].lower()}", "as_of": stamp(at),
                        "provenance": "proposed"})
        for number, equipment in enumerate(package.equipment[:5], 1):
            inspections.append({"ship_id": ship, "inspection_date": "2024-05-15", "inspection_type": "MI",
                "eic": equipment["eic"], "finding_severity": "MINOR", "finding_summary": f"Exercise preservation finding {number}",
                "corrected": True, "as_of": stamp(moment(3)), "provenance": "placeholder"})
    for part in package.parts:
        for holder in ["NAVSUP_WSS", "PROGRAM_OFFICE"]:
            pump = part["niin"] == "019990001"
            wholesale.append({**part, "holder": holder, "holder_name": f"{holder} EXERCISE HOLDER",
                "location": "EXERCISE DEPOT A", "on_hand_qty": 0 if pump and holder == "NAVSUP_WSS" else 1 if pump else 4,
                "due_in_qty": 2, "due_in_date": "2026-12-20", "release_lead_days": 3 if holder == "PROGRAM_OFFICE" else 1,
                "transit_days_conus": 5, "transit_days_oconus": 10,
                "requires_engineering_validation": holder == "PROGRAM_OFFICE", "as_of": stamp(moment(3)), "provenance": "placeholder"})
    datasets = [("fleet_onboard_stock.csv", stock, "Derived ship inventory", "06_fleet_stock_positions.md"),
        ("ship_positions.csv", positions, "Derived planned locations", "06_fleet_stock_positions.md"),
        ("wholesale_stock.csv", wholesale, "NAVSUP/program-office-style stock", "05_navsup_wholesale.md"),
        ("personnel_events.csv", personnel, "Synthetic confirmed admin orders", "07_r_adm.md"),
        ("readiness_baseline.csv", baseline, "DRRS-inspired pre-casualty exercise report", "11_drrs_readiness_baseline.md"),
        ("readiness_current.csv", current, "DRRS-inspired exercise snapshot", "11_drrs_readiness_baseline.md"),
        ("system_status.csv", system_status, "Derived material status, not a forecast", "09_mfom_mission_tree.md"),
        ("insurv_findings.csv", inspections, "INSURV-inspired historical findings", "18_insurv.md")]
    for filename, rows, source, spec in datasets:
        package.csv(f"squadron/{filename}", rows, source, spec)


def build_events(package):
    definitions = [("KESSLER", "01", "Mission A", "Group Sail / SWATT exercise serial", 9, 15, ["AW", "MOB", "CCC"]),
        ("KESSLER", "02", "Mission B", "COMPTUEX exercise", 21, 27, list(MISSIONS)),
        ("VARNELL", "01", "Mission C", "ASW certification exercise", 14, 17, ["ASW", "MOB", "CCC"]),
        ("ASHBY", "01", "Mission D", "Sustainment exercise", 18, 24, ["SUW", "MOB", "CCC"])]
    events = []
    for ship, number, label, name, start, end, areas in definitions:
        event_id = f"EVT-{ship}-{number}"
        systems = [item for item in package.equipment if item["mission_area"] in areas]
        block = next(item for item in package.ship_data[ship]["blocks"] if item["is_current"] and item["event_id"] == event_id)
        events.append({"event_id": event_id, "label": label, "ship_id": ship, "name": name,
            "ofrp_phase": next(item[4] for item in SHIPS if item[0] == ship),
            "start": stamp(moment(start, 12)), "end": stamp(moment(end, 20)), "mission_areas": areas,
            "original_start": stamp(moment(12, 12)) if label == "Mission A" else stamp(moment(start, 12)),
            "known_at": stamp(moment(3, 15)) if label == "Mission A" else stamp(moment(-1)),
            "required_systems": [{"eic": item["eic"], "min_status_score": .8 if item["critical"] else .6} for item in systems],
            "required_watch_teams": [{"watchstation_code": item["watchstation_code"], "k": item["required_qualified"]} for item in systems],
            "prerequisite_events": ["EVT-KESSLER-01"] if label == "Mission B" else [],
            "prerequisite_certs": [f"CERT-{ship}-{area}" for area in areas],
            "training_requirements": [f"TRQ-{ship}-{area}-01" for area in areas],
            "consequence_if_missed": "Follow-on exercise sequence requires human rescheduling",
            "schedule_block_id": block["block_id"], "schedule_change_allowed": True,
            "max_shift_days": 3, "provenance": "proposed"})
    package.json("squadron/events_missions.json", {"as_of": stamp(SNAPSHOT), "events": events}, "SFTRM/OFRP-inspired exercise events", "14_certifications_events.md", 4)
    package.json("squadron/scenario_events.json", {"scenario_start": stamp(START), "default_snapshot": stamp(SNAPSHOT),
        "replay_rule": "Only reveal facts with known_at <= playback time; effective_at controls when they apply. Latest-state files are NOT historical snapshots.",
        "events": [
            {"event_id": "CHANGE-01", "known_at": stamp(moment(0, 12)), "effective_at": stamp(moment(0, 12)), "type": "CASUALTY_INITIAL", "ship_id": "KESSLER", "record_id": "DDG991-26-017"},
            {"event_id": "CHANGE-02", "known_at": stamp(moment(1, 10)), "effective_at": stamp(moment(1, 10)), "type": "PART_DELAY_AND_ETR_UPDATE", "ship_id": "KESSLER", "record_id": "V9910163080001"},
            {"event_id": "CHANGE-03", "known_at": stamp(moment(1, 20)), "effective_at": stamp(moment(1, 20)), "type": "TENTATIVE_DOCUMENT_UPDATE", "ship_id": "KESSLER", "record_id": "KESSLER/daily_reports/daily_status_KESSLER_20261105.pdf"},
            {"event_id": "CHANGE-04", "known_at": stamp(moment(2, 10)), "effective_at": stamp(moment(6, 0)), "type": "CONFIRMED_PERSONNEL_ORDERS", "ship_id": "KESSLER", "record_id": "PE-KESSLER-0007;PE-KESSLER-0011"},
            {"event_id": "CHANGE-05", "known_at": stamp(moment(3, 15)), "effective_at": stamp(moment(9, 12)), "type": "EVENT_ADVANCED", "ship_id": "KESSLER", "record_id": "EVT-KESSLER-01"}]}, "Exercise playback extension", "00_README.md", 5)
    options = [
        {"option_id": "OPT-PUMP-XDECK", "type": "STOREROOM_TRANSFER", "from_ship": "VARNELL", "to_ship": "KESSLER", "niin": "019990001", "qty": 1,
         "transfer_days": 1, "approval_required": True, "donor_below_allowance": True, "does_not_resolve": ["Qualified-personnel shortfall", "Technical assistance availability"]},
        {"option_id": "OPT-PROGRAM", "type": "PROGRAM_OFFICE_RELEASE", "to_ship": "KESSLER", "niin": "019990001", "qty": 1,
         "release_days": 3, "transit_days": 5, "engineering_validation_required": True, "approval_required": True,
         "does_not_resolve": ["Qualified-personnel shortfall", "Technical assistance availability"]},
        {"option_id": "OPT-PERSON", "type": "TEMPORARY_PERSONNEL_SUPPORT", "from_ship": "ASHBY", "to_ship": "KESSLER", "member_id": "M-0412",
         "watchstation_code": "4310", "earliest_start": stamp(moment(6, 0)), "latest_return": stamp(moment(17, 0)),
         "approval_required": True, "donor_qualified_before": 4, "donor_qualified_after": 3, "donor_minimum": 2,
         "does_not_resolve": ["Part deficiency", "Technical assistance availability", "Full three-section watchbill coverage"]},
        {"option_id": "OPT-SHIFT", "type": "REQUEST_EVENT_SHIFT", "event_id": "EVT-KESSLER-01", "shift_days": 3,
         "approval_required": True, "does_not_resolve": ["Equipment and personnel deficiencies by itself"]}]
    package.json("squadron/action_candidates.json", {"note": "Unexecuted hypothetical candidates; not recommendations, approvals, or computed forecasts.", "candidates": options}, "Exercise what-if inputs", "00_README.md", len(options))


def build_metadata(package):
    descriptions = [
        ("X1", "ASHBY", "Casualty DDG993-26-004 has no matching JCN", ["ASHBY/casreps.json", "ASHBY/csmp.csv"]),
        ("X2", "VARNELL", "Two casualties share NIIN 019990044 and ASSET-VARNELL-LAN-01; review demand before deduplication", ["VARNELL/casreps.json", "VARNELL/installed_equipment.csv"]),
        ("X3", "ASHBY", "BA requisition has an expired 30 OCT shipping estimate", ["ASHBY/requisition_status.csv"]),
        ("X4", "KESSLER", "Report tentatively moves technical assistance to 12 NOV; structured confirmed date remains 09 NOV", ["KESSLER/daily_reports/daily_status_KESSLER_20261105.pdf", "KESSLER/casreps.json"]),
        ("X5", "VARNELL", "Transferring the sole spare pump drops on-hand below allowance", ["VARNELL/onboard_allowance_cosal.csv"]),
        ("X6", "VARNELL", "09 NOV certification start follows original 08 NOV completion but precedes extended 11 NOV completion", ["VARNELL/cert_status.csv", "VARNELL/availabilities.csv"]),
        ("X7", "KESSLER", "Lost CIWS PMS has no matching corrective job; this is a review signal, not proof a job is required", ["KESSLER/sked_schedule.csv", "KESSLER/csmp.csv"]),
        ("X8", "KESSLER", "M-0019 holds synthetic NEC F9A1 while shore billet holder is blank", ["KESSLER/roster.csv", "KESSLER/nec_billets.csv"]),
        ("X9", "KESSLER", "06 NOV first radar watch assigns M-0023 who is still IN_PROGRESS", ["KESSLER/watchbill.csv", "KESSLER/quals.csv"]),
        ("X10", "KESSLER", "Roster source timestamp is 14 OCT; current orders are kept in a separate newer feed", ["KESSLER/roster.csv", "squadron/personnel_events.csv"])]
    package.anomalies = [{"anomaly_id": identifier, "ship_id": ship, "description": description,
        "files": files, "intentional": True, "handling": "Surface for human review; never silently repair"}
        for identifier, ship, description, files in descriptions]
    package.json("validation/expected_anomalies.json", {"anomalies": package.anomalies}, "Test oracle, not dashboard source", "00_README.md", 10)
    package.json("validation/daily_status_expected_facts.json", {"documents": package.extracted}, "Extraction test oracle; not extracted runtime facts", "16_daily_reports.md", len(package.extracted))
    params = {"_banner": BANNER, "scenario_now": stamp(START), "default_snapshot": stamp(SNAPSHOT),
        "seed": SEED, "horizon_days": 30, "provenance": "proposed", "forecast_computed": False,
        "parameters": {
            "bands": {"value": {"green": .8, "yellow": .6}, "evidence": "historical public MFOM patent cited in repository", "applies_to": "material index, not probability"},
            "status_score_map": {"value": SCORE_MAP, "evidence": "historical public MFOM patent; not current policy"},
            "staleness_threshold_days": {"value": 5, "evidence": "assumed"},
            "critical_zero_cap": {"value": .59, "evidence": "assumed"},
            "part_arrival_days_by_regime": {"value": {"NEAR": {"median": 5, "sigma": .4}, "DUE_IN": {"median": 45, "sigma": .5},
                "LONG": {"median": 90, "sigma": .6}, "PROCUREMENT": {"median": 135, "sigma": .7}}, "evidence": "assumed; not calibrated operational statistics"},
            "repair_after_part_days": {"value": {"min": 1, "mode": 2, "max": 4}, "evidence": "assumed triangular distribution"},
            "same_port_transfer_days": {"value": 1, "evidence": "assumed; approval latency additional"},
            "approval_lead_days": {"value": {"min": 1, "mode": 2, "max": 5}, "evidence": "assumed, actual authority unverified"},
            "technical_validation_days": {"value": {"min": 1, "max": 3}, "evidence": "assumed"},
            "transit_days_conus": {"value": 5, "evidence": "repository ADC 1114 research; delivery standard is not an observed distribution"}},
        "rules": ["Do not interpret material scores as probabilities or official Y/Q/N mappings.",
            "Use ESD plus transit when supplied; use regime distributions as an explicitly chosen alternative, not an additional full delay.",
            "Repair starts after parts, confirmed assistance and labor are available; add installation and verification.",
            "ETR is a reported estimate, not a second independent repair delay.",
            "Qualifications and absences apply throughout the event; date-only expirations are valid through 235959Z on that date.",
            "A temporary absence interval is start-inclusive/end-exclusive; a permanent transfer has no end.",
            "A projected rotation date is not a confirmed movement order.",
            "Reserve shared parts and personnel once per scenario; evaluate donor requirements.",
            "Unconfirmed document claims remain NEEDS_REVIEW.",
            "No surface CASREP-to-rating cap policy is asserted."]}
    (ROOT / "squadron/delay_model_params.yaml").write_text(yaml.safe_dump(params, sort_keys=False), encoding="utf-8")
    package.record("squadron/delay_model_params.yaml", "Assumptions ledger", "19_catalog_and_assumptions.md", 1)
    dictionary = []
    for path, rows in package.tables.items():
        fields = package.entries[path]["fields"]
        columns = []
        for field in fields:
            values = [row.get(field, "") for row in rows if row.get(field, "") != ""]
            kind = "boolean" if values and all(isinstance(value, bool) for value in values) else "integer" if values and all(isinstance(value, int) and not isinstance(value, bool) for value in values) else "number" if values and all(isinstance(value, (int, float)) for value in values) else "string"
            columns.append({"name": field, "type": kind, "nullable": any(row.get(field, "") == "" for row in rows),
                "description": field.replace("_", " "), "list_separator": ";" if field in {"necs", "supported_eics", "req_doc_numbers", "unmodeled_pillars"} else None,
                "evidence": "proposed schema; operational values are placeholders"})
        dictionary.append({"file": path, "columns": columns})
    package.json("squadron/data_dictionary.json", {"csv_conventions": {"first_line": "header row", "header_line": 1,
        "encoding": "UTF-8", "null": "empty string", "booleans": ["true", "false"], "identifiers": "strings; preserve leading zeros",
        "timestamps": "UTC ISO 8601", "dates": "ISO 8601"}, "datasets": dictionary,
        "json_contracts": {"casreps": "Per-ship casreps list; message paths relative to this package; etr_history preserves versions",
            "events": "Squadron events list with required_systems, required_watch_teams and prerequisite IDs",
            "mission_tree": "missions/tasks/functional_areas/systems/components/parts",
            "test_oracles": "validation folder; do not ingest as independent evidence"}}, "Synthetic package schema", "19_catalog_and_assumptions.md", len(dictionary))
    entries = list(package.entries.values())
    package.json("squadron/data_catalog.json", {"datasets": entries, "scope": "Generated data files, excluding catalog, manifest, validation result and tooling"}, "Jupiter-style exercise catalog", "19_catalog_and_assumptions.md", len(entries))
    files = []
    for relative, entry in sorted(package.entries.items()):
        content = (ROOT / relative).read_bytes()
        files.append({"file": relative, "sha256": hashlib.sha256(content).hexdigest(), "bytes": len(content), "record_count": entry["record_count"]})
    package.json("manifest.json", {"seed": SEED, "scenario_start": stamp(START), "default_snapshot": stamp(SNAPSHOT),
        "ships": [item[0] for item in SHIPS], "mission_areas": list(MISSIONS), "files": files,
        "contains_real_operational_data": False, "provenance": "proposed"}, count=len(files))


def generate():
    package = Package()
    build_reference(package)
    for ship, uic, hull, offset, phase, job_count in SHIPS:
        roster, quals, personnel = build_people(package, ship, uic, offset)
        jobs, orders, casreps = build_maintenance(package, ship, uic, hull, offset, job_count)
        inventory, installed = build_inventory(package, ship, uic, jobs, casreps)
        build_pms(package, ship, uic, hull, roster)
        blocks = build_schedule(package, ship, phase)
        build_reports(package, ship)
        package.ship_data[ship] = {"roster": roster, "quals": quals, "personnel": personnel,
            "jobs": jobs, "orders": orders, "casreps": casreps, "inventory": inventory,
            "installed": installed, "blocks": blocks}
    build_squadron(package)
    build_events(package)
    build_metadata(package)
    print(f"Generated {len(package.entries)} registered outputs in {ROOT}")


def read_csv(relative):
    content = (ROOT / relative).read_text(encoding="utf-8")
    lines = content.splitlines()
    if lines and lines[0] == f"# {BANNER}":
        lines = lines[1:]
    return list(csv.DictReader(lines))


def read_json(relative):
    content = json.loads((ROOT / relative).read_text(encoding="utf-8"))
    assert content["_banner"] == BANNER, relative
    return content


def validate():
    checks = []

    def check(condition, description):
        if not condition:
            raise AssertionError(description)
        checks.append(description)

    manifest = read_json("manifest.json")
    check(len(read_csv("squadron/ships.csv")) == 3, "Exactly three fictional ships")
    check({row["mission_area"] for row in read_csv("squadron/roc_poe_mission_map.csv")} == set(MISSIONS), "Exactly five mission areas")
    tree = read_json("squadron/mission_equipment_tree.json")
    systems = [system for mission in tree["missions"] for task in mission["tasks"] for area in task["functional_areas"] for system in area["systems"]]
    eics = {system["eic"] for system in systems} | {component["eic"] for system in systems for component in system["components"]}
    niin_set = {row["niin"] for row in read_csv("squadron/part_catalog.csv")}
    all_members, all_jobs, all_orders, all_casualties = set(), set(), set(), set()
    anomaly_hits = set()
    for ship, uic, hull, offset, phase, job_count in SHIPS:
        roster = read_csv(f"{ship}/roster.csv")
        members = {row["member_id"] for row in roster}
        check(len(roster) == len(members) == 300 and not (members & all_members), f"{ship}: 300 globally unique synthetic members")
        all_members |= members
        quals = read_csv(f"{ship}/quals.csv")
        qual_map = {(row["member_id"], row["watchstation_code"]): row for row in quals}
        check(len(qual_map) == len(quals), f"{ship}: unique member/qualification pairs")
        check(all(row["member_id"] in members and row["signed_by"] in members for row in quals), f"{ship}: qualification member joins")
        jobs = read_csv(f"{ship}/csmp.csv")
        jcns = {row["jcn"] for row in jobs}
        check(len(jcns) == len(jobs) and not (jcns & all_jobs), f"{ship}: unique JCNs")
        all_jobs |= jcns
        check(all(row["jcn"] == row["uic"] + row["work_center"] + row["jsn"] and len(row["jcn"]) == 13 for row in jobs), f"{ship}: JCN structure")
        orders = read_csv(f"{ship}/requisition_status.csv")
        docs = {row["doc_number"] for row in orders}
        check(len(docs) == len(orders) and not (docs & all_orders), f"{ship}: unique requisitions")
        all_orders |= docs
        check(all(re.fullmatch(r"V\d{5}\d{4}\d{4}", row["doc_number"]) and row["niin"] in niin_set and row["status_code"] in STATUS_CODES for row in orders), f"{ship}: requisition identifiers, parts and status codes")
        check(all(row["jcn"] in jcns for row in orders if row["jcn"]), f"{ship}: nonempty requisition/job references resolve")
        check(all(set(filter(None, row["req_doc_numbers"].split(";"))) <= docs for row in jobs), f"{ship}: job/order references resolve")
        casreps = read_json(f"{ship}/casreps.json")["casreps"]
        for casualty in casreps:
            check(casualty["casrep_id"] not in all_casualties, f"{casualty['casrep_id']}: unique casualty")
            all_casualties.add(casualty["casrep_id"])
            matches = [row for row in jobs if row["casrep_dtg"] == casualty["initial_dtg"]]
            if ship == "ASHBY" and casualty["serial"] == "004":
                check(not matches and not casualty["jcn"], "X1: unmatched Ashby casualty is preserved")
                anomaly_hits.add("X1")
            else:
                check(len(matches) == 1 and casualty["initial_dtg"] in matches[0]["remarks"], f"{casualty['casrep_id']}: casualty DTG joins to one job")
            check(all(part["doc_number"] in docs and part["niin"] in niin_set for part in casualty["parts"]), f"{casualty['casrep_id']}: casualty/parts/order joins")
            check(all(parse_time(update["known_at"]) <= SNAPSHOT for update in casualty["etr_history"]), f"{casualty['casrep_id']}: no future actual update in current snapshot")
            for message in casualty["messages"]:
                message_text = (ROOT / message).read_text(encoding="utf-8")
                check(casualty["initial_dtg"] in message_text or casualty["initial_dtg"].replace(" ", "") in message_text,
                      f"{message}: initial DTG present")
        check(all(row["eic"] in eics for row in jobs), f"{ship}: equipment identities resolve")
        inventory = read_csv(f"{ship}/onboard_allowance_cosal.csv")
        check({row["niin"] for row in inventory} == niin_set, f"{ship}: complete part coverage including zero balances")
        fleet = [row for row in read_csv("squadron/fleet_onboard_stock.csv") if row["ship_id"] == ship]
        check(all(next(item for item in fleet if item["niin"] == row["niin"])["storeroom_on_hand"] == row["on_hand_qty"] for row in inventory), f"{ship}: derived squadron inventory agrees")
        pms = read_csv(f"{ship}/sked_schedule.csv")
        check(all(row["eic"] in eics and row["assigned_to"] in members for row in pms), f"{ship}: PMS equipment/personnel joins")
        watchbill = read_csv(f"{ship}/watchbill.csv")
        invalid = [row for row in watchbill if row["member_id"] and qual_map.get((row["member_id"], row["watchstation_code"]), {}).get("qual_status") not in {"QUALIFIED", "INTERIM"}]
        check(len(invalid) == (1 if ship == "KESSLER" else 0), f"{ship}: only intentional invalid qualification assignment")
        if invalid:
            anomaly_hits.add("X9")
        check(all(row["member_id"] in members for row in watchbill if row["member_id"]), f"{ship}: watchbill member references")
        blocks = [row for row in read_csv(f"{ship}/schedule_30day.csv") if row["is_current"] == "true"]
        for day in range(30):
            check(sum(row["start_date"] <= day_date(day) <= row["end_date"] for row in blocks) == 1, f"{ship}: schedule tiles day {day:02d} without gaps/overlap")
        positions = [row for row in read_csv("squadron/ship_positions.csv") if row["ship_id"] == ship]
        check(len(positions) == 30, f"{ship}: 30 planned daily positions")
        check(all((row["status"] == "UNDERWAY") == (next(block for block in blocks if block["start_date"] <= row["date"] <= block["end_date"])["employment_code"] == "UNDERWAY") for row in positions), f"{ship}: positions agree with schedule")
        if ship == "KESSLER":
            anomaly_hits.add("X7") if any(row["status"] == "LOST" and row["eic"] == "CIWS-MOD" for row in pms) and not any(row["eic"].startswith("CIWS") for row in jobs) else None
            billets = read_csv(f"{ship}/nec_billets.csv")
            anomaly_hits.add("X8") if "F9A1" in next(row for row in roster if row["member_id"] == "M-0019")["necs"] and not next(row for row in billets if row["billet_id"] == "B-SPY1D-03")["fltmps_holder_member_id"] else None
            anomaly_hits.add("X10") if (SNAPSHOT - parse_time(roster[0]["as_of"])).days > 5 else None
        if ship == "VARNELL":
            anomaly_hits.add("X2") if len({row["physical_asset_id"] for row in casreps}) == 1 and len(casreps) == 2 else None
            pump = next(row for row in inventory if row["niin"] == "019990001")
            anomaly_hits.add("X5") if int(pump["on_hand_qty"]) == int(pump["allowance_qty"]) == 1 else None
            cert = next(row for row in read_csv(f"{ship}/cert_status.csv") if row["mission_area"] == "ASW")
            availability = read_csv(f"{ship}/availabilities.csv")[0]
            anomaly_hits.add("X6") if availability["planned_completion"] < cert["planned_start"] < availability["forecast_completion"] else None
        if ship == "ASHBY":
            anomaly_hits.add("X3") if any(row["status_code"] == "BA" and row["esd"] < day_date(0) for row in orders) else None
    check(len(all_members) == 900, "Exactly 900 synthetic personnel")
    events = read_json("squadron/events_missions.json")["events"]
    event_ids = {event["event_id"] for event in events}
    for event in events:
        check(set(event["prerequisite_events"]) <= event_ids and all(item["eic"] in eics for item in event["required_systems"]), f"{event['event_id']}: event dependencies resolve")
        blocks = read_csv(f"{event['ship_id']}/schedule_30day.csv")
        block = next(row for row in blocks if row["block_id"] == event["schedule_block_id"])
        check(block["start_date"] <= event["start"][:10] <= event["end"][:10] <= block["end_date"], f"{event['event_id']}: event inside schedule block")
        certs = {row["cert_id"] for row in read_csv(f"{event['ship_id']}/cert_status.csv")}
        training = {row["requirement_id"] for row in read_csv(f"{event['ship_id']}/training_readiness.csv")}
        check(set(event["prerequisite_certs"]) <= certs and set(event["training_requirements"]) <= training, f"{event['event_id']}: certifications/training resolve")
    for document in read_json("validation/daily_status_expected_facts.json")["documents"]:
        reader = PdfReader(ROOT / document["document"])
        text = "\n".join(page.extract_text() for page in reader.pages)
        check(all(BANNER in page.extract_text() for page in reader.pages), f"{document['document']}: synthetic PDF marking")
        for fact in document["facts"]:
            check(fact["source_span"] in text, f"{document['document']}: extraction oracle matches PDF verbatim")
            if fact["fact_type"] == "assist_eta":
                anomaly_hits.add("X4")
    check(anomaly_hits == {f"X{number}" for number in range(1, 11)}, "All ten expected data-quality cases detected from generated records")
    orders = read_csv("squadron/personnel_events.csv")
    qualified = {row["member_id"] for row in read_csv("KESSLER/quals.csv") if row["watchstation_code"] == "4310" and row["qual_status"] in {"QUALIFIED", "INTERIM"}}
    available = qualified - {row["member_id"] for row in orders if row["effective_at"] <= stamp(moment(9, 12)) and (not row["effective_until"] or row["effective_until"] > stamp(moment(9, 12)))}
    check(len(qualified) == 3 and len(available) == 1, "Kessler radar coverage drops from three to one at Mission A")
    baseline = next(row for row in read_csv("squadron/readiness_baseline.csv") if row["ship_id"] == "KESSLER" and row["mission_area"] == "AW")
    current = next(row for row in read_csv("squadron/readiness_current.csv") if row["ship_id"] == "KESSLER" and row["mission_area"] == "AW")
    check(baseline["mfom_index"] == "100" and current["mfom_index"] == "40", "Independent expected material indices: Kessler AW 100 before casualty, 40 at snapshot")
    for entry in manifest["files"]:
        path = ROOT / entry["file"]
        check(path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == entry["sha256"], f"{entry['file']}: manifest checksum")
        if path.suffix in {".json", ".txt", ".yaml"}:
            check(BANNER in path.read_text(encoding="utf-8"), f"{entry['file']}: synthetic marking")
    result = {"_banner": BANNER, "passed": True, "check_count": len(checks),
        "ships": 3, "mission_areas": 5, "crew_records": 900,
        "intentional_anomalies_detected": sorted(anomaly_hits, key=lambda value: int(value[1:])),
        "validated_files": len(manifest["files"]), "checks": checks}
    (ROOT / "validation/validation_report.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"PASS: {len(checks)} checks; {len(manifest['files'])} data files; 900 crew; all X1-X10 detected")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate and validate the fictional MissionTwin data package.")
    parser.add_argument("command", choices=["generate", "validate"], nargs="?", default="generate")
    arguments = parser.parse_args()
    if arguments.command == "generate":
        generate()
    validate()
