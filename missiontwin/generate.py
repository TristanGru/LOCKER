"""Synthetic data generator. Emits every mock file named in data_sources/00_README.md section 5.

    python -m missiontwin.generate [--out data/synthetic]

Deterministic: fixed seed, fixed PDF metadata. JSON, YAML, PDF, and messages carry the SYNTHETIC banner;
CSV files use standard header-first formatting with provenance columns.
Specs: data_sources/01..20. If this code and a spec disagree, change one of them on purpose.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import random
import shutil
from datetime import date, datetime, timedelta
from pathlib import Path

import yaml

from . import BANNER
from .domain import (AREAS, COLUMNS, DATA_DIR, DEFAULT_PARAMS, PARTS, ROC_PRIMARY, ROC_WEIGHTS, SCENARIO_NOW, SHIP_IDS,
                     SHIPS, STATUS_SCORE, SYSTEMS, TYCOM, UTC, WATCHSTATION_RATINGS, WATCHSTATIONS, COMPONENT_TO_SYSTEM,
                     d, date_dt, format_dtg, hull_key, iso, mission_tree_json, parts_index)

SEED = 20261104
BASE_AS_OF = "2026-11-04T06:00:00Z"
MSG_BANNER = "UNCLAS//SYNTHETIC EXERCISE//"

SURNAMES = """HALVORSEN QUINTERO NAKAMURA VASQUEZ ABERNATHY BJORNSTAD CASTELLANO DELACROIX EKWUEME GALLARDO HASKINS
IWASAKI JABLONSKI KOWALCZYK LINDQVIST MBEKI NWOSU OYELARAN PAKULSKI QUARLES RASMUSSEN SZYMANSKI TANAKA URQUHART
VALDIVIA WOJCIK XIONG YAMAMOTO ZIELINSKI ACHTERBERG BAPTISTE CARDENAS DIMITROV ESPOSITO FONSECA GUTIERREZ HADLEY
IBARRA JOVANOVIC KACZMAREK LAURENT MENDOZA NOVAK ORTEGA PETROV QUIROGA ROSALES SALAZAR TRUJILLO ULLOA VILLALOBOS
WHITFIELD YILMAZ ZAMORA ADEYEMI BAUTISTA CHUKWU DOMINGUEZ ESTRADA FIGUEROA GALVAN IVANOVA JARAMILLO KAMINSKI
LOMBARDI MORALES NAKASHIMA OKONKWO PELLETIER RIOS SANTANGELO TOLBERT UMANSKY VANTERPOOL WATANABE YOUSSEF ZAPATA
AGUILAR BRENNEMAN CALLOWAY DESROSIERS ELLINGTON FAIRCLOTH GIORDANO HUERTA INGRAM JIMENEZ KRAWCZYK LEDESMA
MONTGOMERY NAVARRO OBUYA PIMENTEL REYNOSO SOLORZANO TREMBLAY VELASQUEZ WESTBROOK YBARRA ZUBIATE ARCENEAUX
BELLAMY COLLADO DUBROVNIK ESCOBEDO FERREIRA GRISWOLD HOLLOWAY ISHIKAWA JANKOWSKI KOSTOPOULOS LUNDGREN MATSUDA""".split()

RATING_PLAN = [  # (rating, work_center, count)
    ("FC", "CF01", 14), ("FC", "CF02", 10), ("GM", "CF02", 14), ("ET", "CE01", 12), ("IT", "CE01", 10),
    ("STG", "CE01", 16), ("OS", "OD01", 18), ("QM", "OD01", 6), ("BM", "DK01", 24), ("SN", "DK01", 20),
    ("GSM", "ER01", 18), ("GSE", "ER01", 10), ("EM", "EE01", 12), ("IC", "EE01", 6), ("EN", "EA01", 8),
    ("MM", "EA01", 6), ("DC", "EA01", 8), ("HT", "EA01", 6), ("LS", "SU01", 10), ("CS", "SU01", 14),
    ("YN", "AD01", 5), ("PS", "AD01", 4), ("HM", "AD01", 4),
]
DEPT_OF_WC = {"CF": "COMBAT SYSTEMS", "CE": "COMBAT SYSTEMS", "OD": "OPERATIONS", "DK": "DECK", "ER": "ENGINEERING",
              "EE": "ENGINEERING", "EA": "ENGINEERING", "SU": "SUPPLY", "AD": "ADMINISTRATION"}
ID_BASE = {"KESSLER": 1, "ASHBY": 401, "VARNELL": 701}
CREW_SIZE = {"KESSLER": 300, "VARNELL": 280, "ASHBY": 260}
PERIODS = ["0000-0400", "0400-0800", "0800-1200", "1200-1600", "1600-2000", "2000-2400"]


def mid(n: int) -> str:
    return f"M-{n:04d}"


def rate_of(rating: str, pg: str) -> str:
    if rating == "SN":
        return "SN"
    return {"E3": rating + "SN", "E4": rating + "3", "E5": rating + "2", "E6": rating + "1",
            "E7": rating + "C", "E8": rating + "CS"}[pg]


PG_RANK = {"E3": 3, "E4": 4, "E5": 5, "E6": 6, "E7": 7, "E8": 8, "O1": 11, "O2": 12, "O3": 13, "O4": 14, "O5": 15}


class Gen:
    def __init__(self, out: Path):
        self.out = out
        self.R = random.Random(SEED)
        self.crew: dict[str, list[dict]] = {}
        self.quals: dict[str, list[dict]] = {}
        self.casreps: dict[str, list[dict]] = {s: [] for s in SHIP_IDS}
        self.jobs: dict[str, list[dict]] = {s: [] for s in SHIP_IDS}
        self.reqs: dict[str, list[dict]] = {s: [] for s in SHIP_IDS}
        self.cosal: dict[str, list[dict]] = {}
        self.schedule: dict[str, list[dict]] = {}
        self.expected_facts: dict[str, list[dict]] = {}
        self.catalog: list[dict] = []
        self.filler_niins: list[tuple[str, str]] = []

    # ------------------------------------------------------------ io helpers
    def sdir(self, ship: str) -> Path:
        p = self.out / ship
        p.mkdir(parents=True, exist_ok=True)
        return p

    def write_csv(self, folder: Path, name: str, rows: list[dict]):
        folder.mkdir(parents=True, exist_ok=True)
        cols = COLUMNS[name]
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        for r in rows:
            missing = set(cols) - set(r)
            extra = set(r) - set(cols)
            if missing or extra:
                raise ValueError(f"{name}: column mismatch missing={missing} extra={extra}")
            w.writerow({k: _fmt(r[k]) for k in cols})
        (folder / name).write_text(buf.getvalue(), encoding="utf-8", newline="")

    def write_json(self, path: Path, obj: dict):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8", newline="")

    def write_text(self, path: Path, text: str):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="")

    # ------------------------------------------------------------ run
    def run(self):
        if self.out.exists():
            shutil.rmtree(self.out)
        self.out.mkdir(parents=True)
        for s in SHIP_IDS:
            self.gen_crew(s)
        for s in SHIP_IDS:
            self.gen_quals_watchbill_billets(s)
        self.gen_schedule_events()
        self.gen_tree_roc()
        self.gen_casreps_jobs_supply()
        self.gen_sked()
        self.gen_positions_messages()
        self.gen_daily_reports()
        self.gen_readiness_baseline()
        self.gen_insurv()
        self.gen_ledger_catalog_feed()
        return self.out

    # ------------------------------------------------------------ crew (spec 07)
    def gen_crew(self, ship: str):
        R = self.R
        info = SHIPS[ship]
        pool = [s for s in SURNAMES]
        R.shuffle(pool)
        reserved = {"RAMOS", "LIN", "OKAFOR", "DUARTE", "BRANDT", "OSEI", "PRZYBYLSKI"}
        fixed: dict[int, dict] = {}
        if ship == "KESSLER":
            fixed = {
                1: ("CDR", "O5", "HALVORSEN", "COMMAND", "CO", "CO01"),
                3: ("LCDR", "O4", "QUINTERO", "COMMAND", "XO", "XO01"),
                101: ("LT", "O3", "BRANDT", "COMBAT SYSTEMS", "CF", "CF01"),
                102: ("LCDR", "O4", "OSEI", "ENGINEERING", "ER", "ER01"),
                2: ("FCC", "E7", "NAKAMURA", None, None, "CF01"),
                7: ("FC1", "E6", "RAMOS", None, None, "CF01"),
                11: ("FC2", "E5", "LIN", None, None, "CF01"),
                19: ("FC2", "E5", "OKAFOR", None, None, "CF01"),
                23: ("FC3", "E4", "DUARTE", None, None, "CF01"),
            }
        elif ship == "ASHBY":
            fixed = {412: ("FC2", "E5", "PRZYBYLSKI", None, None, "CF01")}
        pool = [s for s in pool if s not in reserved and not (ship == "KESSLER" and s in {"HALVORSEN", "QUINTERO", "NAKAMURA"})]
        base = ID_BASE[ship]
        ids = list(range(base, base + CREW_SIZE[ship]))
        crew = []
        # enlisted slots by rating plan, then officers
        slots = []
        for rating, wc, n in RATING_PLAN:
            for _ in range(n):
                slots.append((rating, wc))
        officer_slots = [("COMMAND", "CO01"), ("COMMAND", "XO01"), ("COMBAT SYSTEMS", "CF01"), ("ENGINEERING", "ER01")]
        officer_slots += [(DEPT_OF_WC[wc[:2]], wc) for wc in
                          ["CF01", "CF02", "CE01", "CE01", "OD01", "OD01", "DK01", "ER01", "EE01", "EA01", "EA01", "SU01",
                           "AD01", "OD01", "CF02", "CE01", "DK01", "EA01", "SU01", "OD01", "CF01"]]
        free_ids = [i for i in ids if i not in fixed]
        # fixed members first (all fixed enlisted are FCs in CF01)
        fixed_wcs = []
        for n, (rate, pg, sur, dept, div, wc) in fixed.items():
            if pg.startswith("O"):
                crew.append(self._member(ship, n, rate, rate, pg, sur, dept, div or wc[:2], wc))
            else:
                crew.append(self._member(ship, n, rate, "FC", pg, sur, DEPT_OF_WC[wc[:2]], wc[:2], wc))
                fixed_wcs.append(("FC", wc))
        # remove the fixed enlisted from slot plan
        for rw in fixed_wcs:
            if rw in slots:
                slots.remove(rw)
        n_officers = len([1 for v in fixed.values() if v[1].startswith("O")])
        officer_slots = officer_slots[n_officers if ship == "KESSLER" else 0:]
        target_enlisted = CREW_SIZE[ship] - len(fixed) - len(officer_slots)
        R.shuffle(slots)
        slots = slots[:target_enlisted]
        pgs = ["E3"] * 20 + ["E4"] * 26 + ["E5"] * 26 + ["E6"] * 17 + ["E7"] * 8 + ["E8"] * 3
        for pos, i in enumerate(free_ids):
            if pos < len(slots):
                rating, wc = slots[pos]
                pg = "E3" if rating == "SN" else R.choice(pgs)
                crew.append(self._member(ship, i, rate_of(rating, pg), rating, pg, pool[i % len(pool)],
                                         DEPT_OF_WC[wc[:2]], wc[:2], wc))
            else:
                k = pos - len(slots)
                if k >= len(officer_slots):
                    break
                dept, wc = officer_slots[k]
                rank, pg = ("CDR", "O5") if wc == "CO01" else ("LCDR", "O4") if wc == "XO01" else \
                    R.choice([("ENS", "O1"), ("LTJG", "O2"), ("LT", "O3"), ("LTJG", "O2")])
                crew.append(self._member(ship, i, rank, rank, pg, pool[i % len(pool)], dept, wc[:2], wc))
        crew.sort(key=lambda m: m["member_id"])
        as_of = "2026-10-14T08:00:00Z" if ship == "KESSLER" else "2026-11-03T08:00:00Z"  # X10: Kessler roster stale
        for m in crew:
            m["as_of"] = as_of
            m["uic"] = info["uic"]
        self.crew[ship] = crew

    def _member(self, ship, n, rate, rating, pg, surname, dept, div, wc):
        R = self.R
        report = date(2024, 1, 1) + timedelta(days=R.randint(0, 900))
        prd = report + timedelta(days=R.randint(900, 1300))
        if prd <= date(2026, 11, 20):
            prd = date(2026, 12, 1) + timedelta(days=R.randint(0, 900))
        return {
            "member_id": mid(n), "ship_id": ship, "uic": SHIPS[ship]["uic"],
            "display_name": f"{rate} {surname} (SYNTH)", "rate": rate, "rating": rating, "paygrade": pg,
            "department": dept, "division": div, "work_center": wc, "duty_section": R.randint(1, 4),
            "onboard_status": "ONBOARD", "status_start": "", "status_end": "",
            "report_date": report.isoformat(), "prd": prd.isoformat(),
            "eaos": (prd + timedelta(days=R.randint(0, 700))).isoformat(), "necs": "",
            "as_of": "", "provenance": "placeholder",
        }

    def member(self, ship: str, member_id: str) -> dict:
        return next(m for m in self.crew[ship] if m["member_id"] == member_id)

    # ------------------------------------------------------------ quals, watchbill, NEC billets (specs 07, 08)
    def gen_quals_watchbill_billets(self, ship: str):
        R = self.R
        crew = self.crew[ship]
        quals: list[dict] = []
        senior = [m for m in crew if PG_RANK[m["paygrade"]] >= 7]

        def add(m, ws, status):
            final = date(2025, 1, 1) + timedelta(days=R.randint(0, 500))
            row = {"member_id": m["member_id"], "ship_id": ship,
                   "pqs_ref": f"NAVEDTRA 43{ws[:2]}0-{ws} (SYNTH)", "watchstation_code": ws,
                   "watchstation_name": WATCHSTATIONS[ws], "qual_status": status,
                   "pct_complete": 100 if status in ("QUALIFIED", "EXPIRED") else R.randint(35, 85) if status == "IN_PROGRESS" else 100,
                   "interim_date": "", "final_date": "", "requal_due": "",
                   "signed_by": R.choice([s["member_id"] for s in senior if s["department"] == m["department"]] or [senior[0]["member_id"]]),
                   "as_of": "2026-11-04T06:00:00Z", "provenance": "proposed"}
            if status == "QUALIFIED":
                row["final_date"] = final.isoformat()
                row["requal_due"] = (final + timedelta(days=730)).isoformat()
            elif status == "INTERIM":
                row["interim_date"] = final.isoformat()
            elif status == "EXPIRED":
                row["final_date"] = (final - timedelta(days=800)).isoformat()
                row["requal_due"] = (final - timedelta(days=70)).isoformat()
                if row["requal_due"] > "2026-11-01":
                    row["requal_due"] = "2026-10-01"
            else:
                row["signed_by"] = ""
            quals.append(row)

        tree_ws = {"4310": 2, "4320": 1, "4330": 1, "4410": 2, "4420": 1, "4510": 1, "3110": 1, "2300": 1, "2400": 1}
        used: set[tuple[str, str]] = set()
        for ws, k in tree_ws.items():
            ratings = WATCHSTATION_RATINGS[ws]
            elig = [m for m in crew if m["rating"] in ratings and PG_RANK[m["paygrade"]] in (4, 5, 6, 7)
                    and m["member_id"] not in {"M-0007", "M-0011", "M-0019", "M-0023", "M-0412"}]
            if ws == "4310":
                elig = [m for m in elig if m["work_center"] == "CF01"]
                if ship == "KESSLER":
                    for x in ("M-0007", "M-0011", "M-0019"):
                        add(self.member(ship, x), ws, "QUALIFIED")
                    add(self.member(ship, "M-0023"), ws, "IN_PROGRESS")
                    continue
                n = 2 if ship == "VARNELL" else 3
                chosen = R.sample(elig, n)
                if ship == "ASHBY":
                    chosen = [self.member(ship, "M-0412")] + chosen
                for m in chosen:
                    add(m, ws, "QUALIFIED")
                ip = [m for m in elig if m not in chosen]
                add(R.choice(ip), ws, "IN_PROGRESS")
                continue
            n = k + (1 if ship == "KESSLER" and ws == "4410" else R.randint(0, 2))
            if ship == "KESSLER" and ws == "4410":
                n = 3
            chosen = R.sample(elig, min(n, len(elig)))
            for m in chosen:
                add(m, ws, R.choice(["QUALIFIED"] * 9 + ["INTERIM"]))
            rest = [m for m in elig if m not in chosen]
            if rest:
                add(rest[0], ws, "IN_PROGRESS")
            if len(rest) > 1 and R.random() < 0.3:
                add(rest[1], ws, "EXPIRED")
        # basic watchstations: many qualified
        for ws in ("2200", "2500"):
            elig = [m for m in crew if m["rating"] in WATCHSTATION_RATINGS[ws] and PG_RANK[m["paygrade"]] <= 6]
            for m in elig:
                r = R.random()
                add(m, ws, "QUALIFIED" if r < 0.85 else "IN_PROGRESS" if r < 0.95 else "EXPIRED")
        self.quals[ship] = quals
        sd = self.sdir(ship)

        # NEC billets and roster NECs (spec 08). NECs only for billet holders (+ X8 drift case).
        billets = []
        plan = [("F9A1", "CF01", "AEGIS RADAR TECHNICIAN", 3, "FC"), ("F9B2", "CF02", "AEGIS WEAPONS SYSTEM OPERATOR", 3, "FC"),
                ("E9C1", "CE01", "COMBAT SYSTEMS LAN TECHNICIAN", 3, "IT"), ("M9D1", "ER01", "GAS TURBINE MAINTENANCE", 3, "GSM")]
        bn = 14
        for nec, wc, title, n, rating in plan:
            cands = [m for m in crew if m["work_center"] == wc and m["rating"] == rating and PG_RANK[m["paygrade"]] in (4, 5, 6, 7)
                     and m["member_id"] not in {"M-0007", "M-0011", "M-0019", "M-0023"}]
            if ship == "KESSLER" and nec == "F9A1":
                holders = [self.member(ship, "M-0007"), self.member(ship, "M-0011"), None]  # X8: B-CF-016 empty
            else:
                holders = R.sample(cands, n)
                if ship == "VARNELL" and nec == "E9C1":
                    holders[-1] = None  # a genuine gap (no roster holder)
            for h in holders:
                bid = f"B-{wc[:2]}-{bn:03d}"
                bn += 1
                row = {"ship_id": ship, "uic": SHIPS[ship]["uic"], "billet_id": bid, "billet_title": title,
                       "rate_required": rating + "2", "nec_required": nec, "work_center": wc,
                       "fltmps_holder_member_id": h["member_id"] if h else "",
                       "holder_prd": h["prd"] if h else "", "gap_start": "", "inbound_member_id": "",
                       "inbound_report_date": "", "as_of": "2026-11-04T06:00:00Z", "provenance": "proposed"}
                if h:
                    h["necs"] = ";".join([x for x in (h["necs"].split(";") if h["necs"] else []) + [nec]])
                    if h["member_id"] == "M-0007":
                        h["prd"] = "2026-11-10"
                        row["holder_prd"] = "2026-11-10"
                        row["gap_start"] = "2026-11-10"
                else:
                    row["gap_start"] = "2026-10-01"
                billets.append(row)
        if ship == "KESSLER":
            self.member(ship, "M-0019")["necs"] = "F9A1"  # X8: roster says F9A1, FLTMPS shows nobody in B-CF-016
        self.write_csv(sd, "nec_billets.csv", billets)
        self.write_csv(sd, "roster.csv", crew)
        self.write_csv(sd, "quals.csv", quals)

        # watchbill days 0..5 (spec 07 4.3)
        qualified = {}
        for q in quals:
            if q["qual_status"] in ("QUALIFIED", "INTERIM"):
                qualified.setdefault(q["watchstation_code"], []).append(q["member_id"])
        rows = []
        for day in range(0, 6):
            for pi, period in enumerate(PERIODS):
                for ws in ("2200", "2300", "2400", "2500", "4310"):
                    pool = qualified.get(ws, [])
                    member = pool[(day * 6 + pi) % len(pool)]
                    if ship == "KESSLER" and day == 2 and period == "0800-1200" and ws == "4310":
                        member = "M-0023"  # X9: IN_PROGRESS on the watchbill
                    rows.append({"date": d(day).isoformat(), "ship_id": ship, "watch_period": period, "condition": "III",
                                 "watchstation_code": ws, "watchstation_name": WATCHSTATIONS[ws],
                                 "section": (day % 3) + 1, "member_id": member, "as_of": BASE_AS_OF, "provenance": "proposed"})
        self.write_csv(sd, "watchbill.csv", rows)
        self.cat(ship, "roster.csv", "R-ADM", "Ship's personnel office (notional)", "daily", "NTCSS replication to Jupiter (inferred)",
                 crew[0]["as_of"], 5)
        self.cat(ship, "quals.csv", "R-ADM", "Ship's training officer (notional)", "daily", "NTCSS replication to Jupiter (inferred)", BASE_AS_OF, 5)
        self.cat(ship, "watchbill.csv", "R-ADM", "Ship's XO (notional)", "daily", "NTCSS replication to Jupiter (inferred)", BASE_AS_OF, 5)
        self.cat(ship, "nec_billets.csv", "FLTMPS / NTMPS", "NAVPERSCOM (notional)", "weekly", "Jupiter data product (inferred)", BASE_AS_OF, 14)

    # ------------------------------------------------------------ schedule, events, certs, avails, training (specs 12-15)
    def gen_schedule_events(self):
        def blk(ship, n, s, e, phase, code, place, status="FIRM", event="", msg="", sup="", as_of="2026-10-25T12:00:00Z"):
            return {"ship_id": ship, "block_id": f"SCH-{ship}-{n:02d}", "start_date": d(s).isoformat(), "end_date": d(e).isoformat(),
                    "ofrp_phase": phase, "employment_code": code, "event_id": event, "oparea_or_port": place, "status": status,
                    "source_msg_dtg": msg, "superseded_block_id": f"SCH-{ship}-{sup:02d}" if sup else "", "as_of": as_of,
                    "provenance": "proposed"}
        chg = "2026-11-07T15:00:00Z"
        K, V, A = "KESSLER", "VARNELL", "ASHBY"
        sched = {
            K: [blk(K, 1, -10, -6, "INTEGRATED", "UNDERWAY", "VACAPES OPAREA"),
                blk(K, 3, -5, 11, "INTEGRATED", "UPK", "NORFOLK VA"),
                blk(K, 5, 12, 18, "INTEGRATED", "UNDERWAY", "VACAPES OPAREA", event="EVT-KESSLER-01"),
                blk(K, 6, 19, 20, "INTEGRATED", "INPORT", "NORFOLK VA"),
                blk(K, 8, 21, 31, "INTEGRATED", "UNDERWAY", "JAX OPAREA", event="EVT-KESSLER-02"),
                blk(K, 4, -5, 8, "INTEGRATED", "UPK", "NORFOLK VA", "CHANGED", msg="071500Z NOV 26", sup=3, as_of=chg),
                blk(K, 7, 9, 15, "INTEGRATED", "UNDERWAY", "VACAPES OPAREA", "CHANGED", "EVT-KESSLER-01", "071500Z NOV 26", 5, chg),
                blk(K, 9, 16, 20, "INTEGRATED", "INPORT", "NORFOLK VA", "CHANGED", msg="071500Z NOV 26", sup=6, as_of=chg)],
            V: [blk(V, 1, -10, 4, "BASIC", "AVAIL", "NORFOLK VA"),
                blk(V, 2, 5, 13, "BASIC", "INPORT", "NORFOLK VA"),
                blk(V, 3, -10, 7, "BASIC", "AVAIL", "NORFOLK VA", "CHANGED", msg="021400Z NOV 26", sup=1, as_of="2026-11-02T14:00:00Z"),
                blk(V, 4, 8, 13, "BASIC", "INPORT", "NORFOLK VA", "CHANGED", msg="021400Z NOV 26", sup=2, as_of="2026-11-02T14:00:00Z"),
                blk(V, 5, 14, 17, "BASIC", "UNDERWAY", "VACAPES OPAREA", event="EVT-VARNELL-01"),
                blk(V, 6, 18, 31, "BASIC", "INPORT", "NORFOLK VA")],
            A: [blk(A, 1, -10, -4, "SUSTAINMENT", "INPORT", "NORFOLK VA"),
                blk(A, 2, -3, 5, "SUSTAINMENT", "UNDERWAY", "VACAPES OPAREA"),
                blk(A, 3, 6, 17, "SUSTAINMENT", "INPORT", "NORFOLK VA"),
                blk(A, 4, 18, 24, "SUSTAINMENT", "UNDERWAY", "VACAPES OPAREA", event="EVT-ASHBY-01"),
                blk(A, 5, 25, 31, "SUSTAINMENT", "INPORT", "NORFOLK VA")],
        }
        self.schedule = sched
        for s in SHIP_IDS:
            self.write_csv(self.sdir(s), "schedule_30day.csv", sched[s])
            self.cat(s, "schedule_30day.csv", "Fleet scheduling (system not public)", "TYCOM N3 scheduler (notional)", "on change",
                     "Fleet Forces schedule data via Jupiter (inferred)", BASE_AS_OF, 7)

        events = [
            {"event_id": "EVT-KESSLER-01", "label": "Mission A", "ship_id": "KESSLER", "name": "Group Sail / SWATT air defense serial",
             "ofrp_phase": "INTEGRATED", "start": "2026-11-13T12:00:00Z", "end": "2026-11-19T20:00:00Z",
             "mission_areas": ["AW", "MOB", "CCC"],
             "required_systems": [{"eic": "SPY1D", "min_status_score": 0.8}, {"eic": "CIWS", "min_status_score": 0.6},
                                  {"eic": "VLS", "min_status_score": 0.6}, {"eic": "GTM", "min_status_score": 0.6},
                                  {"eic": "LAN", "min_status_score": 0.6}],
             "required_watch_teams": [{"watchstation_code": "4310", "k": 2}],
             "prerequisite_events": [], "prerequisite_certs": ["CERT-KESSLER-AW"], "prerequisite_avail": "",
             "consequence_if_missed": "Ship cannot complete SWATT AW serial; COMPTUEX entry at risk",
             "schedule_block_id": "SCH-KESSLER-07", "provenance": "proposed (prerequisites inferred from event name)"},
            {"event_id": "EVT-KESSLER-02", "label": "Mission B", "ship_id": "KESSLER", "name": "COMPTUEX",
             "ofrp_phase": "INTEGRATED", "start": "2026-11-25T12:00:00Z", "end": "2026-12-05T20:00:00Z",
             "mission_areas": ["AW", "ASW", "SUW", "MOB", "CCC"],
             "required_systems": [{"eic": "SPY1D", "min_status_score": 0.8}, {"eic": "SQQ89", "min_status_score": 0.6},
                                  {"eic": "GUN5", "min_status_score": 0.6}, {"eic": "GTM", "min_status_score": 0.6},
                                  {"eic": "LAN", "min_status_score": 0.6}, {"eic": "COMMS", "min_status_score": 0.6}],
             "required_watch_teams": [{"watchstation_code": "4310", "k": 2}, {"watchstation_code": "4410", "k": 2}],
             "prerequisite_events": ["EVT-KESSLER-01"], "prerequisite_certs": ["CERT-KESSLER-AW", "CERT-KESSLER-ASW", "CERT-KESSLER-SUW"],
             "prerequisite_avail": "", "consequence_if_missed": "Deployment certification delayed",
             "schedule_block_id": "SCH-KESSLER-08", "provenance": "proposed"},
            {"event_id": "EVT-VARNELL-01", "label": "Mission C", "ship_id": "VARNELL", "name": "Basic Phase ASW certification event",
             "ofrp_phase": "BASIC", "start": "2026-11-18T12:00:00Z", "end": "2026-11-21T20:00:00Z",
             "mission_areas": ["ASW", "CCC"],
             "required_systems": [{"eic": "SQQ89", "min_status_score": 0.6}, {"eic": "LAN", "min_status_score": 0.6},
                                  {"eic": "HELO", "min_status_score": 0.6}],
             "required_watch_teams": [{"watchstation_code": "4410", "k": 2}],
             "prerequisite_events": [], "prerequisite_certs": [], "prerequisite_avail": "AV-VARNELL-26-02",
             "consequence_if_missed": "ASW certification slips; Basic Phase extends",
             "schedule_block_id": "SCH-VARNELL-05", "provenance": "proposed (prerequisites inferred from event name)"},
            {"event_id": "EVT-ASHBY-01", "label": "Mission D", "ship_id": "ASHBY", "name": "Sustainment exercise",
             "ofrp_phase": "SUSTAINMENT", "start": "2026-11-22T12:00:00Z", "end": "2026-11-28T20:00:00Z",
             "mission_areas": ["AW", "SUW", "MOB"],
             "required_systems": [{"eic": "SPY1D", "min_status_score": 0.8}, {"eic": "GUN5", "min_status_score": 0.6},
                                  {"eic": "GTM", "min_status_score": 0.6}],
             "required_watch_teams": [{"watchstation_code": "4310", "k": 2}, {"watchstation_code": "4510", "k": 1}],
             "prerequisite_events": [], "prerequisite_certs": ["CERT-ASHBY-AW", "CERT-ASHBY-SUW"], "prerequisite_avail": "",
             "consequence_if_missed": "Sustainment proficiency lapses", "schedule_block_id": "SCH-ASHBY-04", "provenance": "proposed"},
        ]
        self.events = events
        self.write_json(self.out / "squadron" / "events_missions.json", {"_banner": BANNER, "events": events})
        self.cat(None, "events_missions.json", "SFTRM / ATG event plan", "TYCOM training (notional)", "on change",
                 "Jupiter data product (inferred)", BASE_AS_OF, 14)

        certs = []
        def cert(ship, area, status, cdate="", planned="", avail=""):
            exp = ""
            if cdate:
                exp = (date.fromisoformat(cdate) + timedelta(days=365)).isoformat()
            certs.append({"ship_id": ship, "cert_id": f"CERT-{ship}-{area}", "cert_name": f"Basic Phase {area} mission-area certification",
                          "mission_area": area, "status": status, "certified_date": cdate, "expires": exp, "planned_start": planned,
                          "depends_on_avail_id": avail, "as_of": BASE_AS_OF, "provenance": "proposed"})
        for area, cd in zip(["AW", "ASW", "SUW", "MOB", "CCC"], ["2026-05-20", "2026-05-06", "2026-04-28", "2026-04-14", "2026-05-12"]):
            cert("KESSLER", area, "CERTIFIED", cd)
            cert("ASHBY", area, "CERTIFIED", (date.fromisoformat(cd) - timedelta(days=150)).isoformat())
        cert("VARNELL", "AW", "IN_PROGRESS", planned="2026-11-24")
        cert("VARNELL", "ASW", "IN_PROGRESS", planned="2026-11-07", avail="AV-VARNELL-26-02")  # X6
        cert("VARNELL", "SUW", "NOT_STARTED", planned="2026-12-01")
        cert("VARNELL", "MOB", "CERTIFIED", "2026-10-02")
        cert("VARNELL", "CCC", "CERTIFIED", "2026-10-05")
        for s in SHIP_IDS:
            self.write_csv(self.sdir(s), "cert_status.csv", [c for c in certs if c["ship_id"] == s])
            self.cat(s, "cert_status.csv", "SFTRM certification records", "ATG (notional)", "on change", "Jupiter data product (inferred)", BASE_AS_OF, 14)

        av = {
            "VARNELL": [
                {"avail_id": "AV-VARNELL-26-02", "ship_id": "VARNELL", "avail_type": "CMAV", "planned_start": "2026-10-25",
                 "planned_completion": "2026-11-08", "forecast_completion": "2026-11-08", "actual_completion": "", "a120_date": "",
                 "package_lock_date": "2026-09-25", "growth_work_items": 6, "slip_reason": "", "source_msg_dtg": "",
                 "as_of": "2026-10-25T12:00:00Z", "provenance": "proposed"},
                {"avail_id": "AV-VARNELL-26-02", "ship_id": "VARNELL", "avail_type": "CMAV", "planned_start": "2026-10-25",
                 "planned_completion": "2026-11-08", "forecast_completion": "2026-11-11", "actual_completion": "", "a120_date": "",
                 "package_lock_date": "2026-09-25", "growth_work_items": 14, "slip_reason": "Growth work; parts delay",
                 "source_msg_dtg": "021400Z NOV 26", "as_of": "2026-11-02T14:00:00Z", "provenance": "proposed"}],
            "KESSLER": [{"avail_id": "AV-KESSLER-26-03", "ship_id": "KESSLER", "avail_type": "CMAV", "planned_start": "2026-09-01",
                         "planned_completion": "2026-09-14", "forecast_completion": "2026-09-16", "actual_completion": "2026-09-16",
                         "a120_date": "", "package_lock_date": "2026-08-01", "growth_work_items": 9, "slip_reason": "Growth work",
                         "source_msg_dtg": "", "as_of": BASE_AS_OF, "provenance": "proposed"}],
            "ASHBY": [{"avail_id": "AV-ASHBY-26-02", "ship_id": "ASHBY", "avail_type": "CMAV", "planned_start": "2026-07-13",
                       "planned_completion": "2026-07-26", "forecast_completion": "2026-07-26", "actual_completion": "2026-07-28",
                       "a120_date": "", "package_lock_date": "2026-06-12", "growth_work_items": 4, "slip_reason": "Parts delay",
                       "source_msg_dtg": "", "as_of": BASE_AS_OF, "provenance": "proposed"}],
        }
        for s in SHIP_IDS:
            self.write_csv(self.sdir(s), "availabilities.csv", av[s])
            self.cat(s, "availabilities.csv", "NMD / NMD-R / NDE", "NAVSEA / RMC (notional)", "on change", "Jupiter data product (inferred)", BASE_AS_OF, 14)

        R = self.R
        for s in SHIP_IDS:
            rows = []
            for area in ["AW", "ASW", "SUW", "MOB", "CCC"]:
                n_req = 2 if s == "KESSLER" else 1
                for j in range(n_req):
                    rid = f"TRQ-{area}-{7 + j:02d} (SYNTH)"
                    if s == "KESSLER" and area == "AW" and j == 0:
                        last, per, refresh, name, team = date(2026, 8, 22), 90, "2026-11-21", "CIC air defense team trainer", "CIC AIR DEFENSE TEAM 1"
                    else:
                        last = date(2026, 9, 1) + timedelta(days=R.randint(0, 55))
                        per, refresh = R.choice([90, 120, 180]), ""
                        name, team = f"{AREAS[area][0]} team trainer {j + 1}", f"{area} TEAM {j + 1}"
                        if (last + timedelta(days=per)) < date(2026, 12, 10):
                            per = 180
                    lo, hi = (0.5, 0.8) if SHIPS[s]["ofrp_phase"] == "BASIC" else (0.75, 0.95)
                    rows.append({"ship_id": s, "mission_area": area, "requirement_id": rid, "requirement_name": name, "team": team,
                                 "last_completed": last.isoformat(), "periodicity_days": per,
                                 "expires": (last + timedelta(days=per)).isoformat(), "scheduled_refresh": refresh,
                                 "tfom_value": round(R.uniform(lo, hi), 2), "as_of": BASE_AS_OF, "provenance": "proposed"})
            self.write_csv(self.sdir(s), "training_readiness.csv", rows)
            self.cat(s, "training_readiness.csv", "TORIS / NTIMS / TFOM", "ATG (notional)", "weekly", "Jupiter data product (inferred)", BASE_AS_OF, 14)

    # ------------------------------------------------------------ tree + ROC/POE (specs 09, 10)
    def gen_tree_roc(self):
        self.write_json(self.out / "squadron" / "mission_equipment_tree.json", mission_tree_json())
        self.cat(None, "mission_equipment_tree.json", "MFOM / AWN readiness tree", "NIWC Atlantic MFOM (notional)", "per force revision",
                 "Jupiter data product (inferred)", BASE_AS_OF, 90)
        rows = []
        for area, w in ROC_WEIGHTS.items():
            rows.append({"ship_class": "DDG (notional)", "mission_area": area, "mission_area_name": AREAS[area][0],
                         "primary_secondary": ROC_PRIMARY[area], "readiness_condition": "III",
                         "required_capability": "F" if ROC_PRIMARY[area] == "P" else "L", "weight": w, "provenance": "placeholder"})
        self.write_csv(self.out / "squadron", "roc_poe_mission_map.csv", rows)
        self.cat(None, "roc_poe_mission_map.csv", "ROC/POE (OPNAVINST 3501 series)", "OPNAV N9 (notional)", "rarely",
                 "Reference table (manual load)", BASE_AS_OF, 365)

    # ------------------------------------------------------------ CASREPs, CSMP, supply (specs 02-06)
    def gen_casreps_jobs_supply(self):
        R = self.R
        jsn_next = {s: {} for s in SHIP_IDS}

        def jsn(ship, wc, fixed=None):
            if fixed:
                return fixed
            n = jsn_next[ship].get(wc, 1)
            while f"{n:04d}" in {"0042", "0031", "0077", "0057", "0058"}:
                n += 1
            jsn_next[ship][wc] = n + 1
            return f"{n:04d}"

        def julian(dt: date) -> str:
            return f"{dt.year % 10}{dt.timetuple().tm_yday:03d}"

        req_serial = {s: 0 for s in SHIP_IDS}

        def docnum(ship, dt: date, serial=None):
            if serial is None:
                req_serial[ship] += 1
                serial = f"{req_serial[ship]:04d}"
            return SHIPS[ship]["dodaac"] + julian(dt) + serial

        def job(ship, wc, eic, noun, status, state, discovered: date, prio, ta, mh, remarks, j=None, dtg="", cid="", reqs="",
                deferred="", reason="", as_of=BASE_AS_OF, apl=None, when="2"):
            uic = SHIPS[ship]["uic"]
            jn = jsn(ship, wc, j)
            row = {"jcn": uic + wc + jn, "ship_id": ship, "uic": uic, "work_center": wc, "jsn": jn, "eic": eic,
                   "apl": apl or f"APL-PH-{R.randint(100000, 999999)}", "equipment_noun": noun,
                   "location": f"{R.randint(1, 4):02d}-{R.randint(10, 400):03d}-{R.randint(0, 2)}-{R.choice('EMQL')}",
                   "date_discovered": discovered.isoformat(), "when_discovered_code": when, "status_code": status,
                   "job_state": state, "deferral_reason_code": reason, "date_deferred": deferred, "priority": prio,
                   "type_avail": ta, "est_man_hours": mh, "casrep_dtg": dtg, "casrep_id": cid, "req_doc_numbers": reqs,
                   "remarks": remarks, "lead_wc": wc, "verifier": "", "co_deferral_signed": False,
                   "system_of_record": "AWN" if ship == "ASHBY" else "OMMS-NG", "as_of": as_of, "provenance": "proposed"}
            seniors = [m["member_id"] for m in self.crew[ship] if m["work_center"] == wc and PG_RANK[m["paygrade"]] >= 6]
            row["verifier"] = seniors[0] if seniors else ""
            if state == "DEFERRED":
                row["co_deferral_signed"] = True
            self.jobs[ship].append(row)
            return row

        def req(ship, doc, jcn, cid, niin, nom, nsn, pd, rdd, drq: date, history, sos="NAVSUP WSS", expedite=False, sor="RSUPPLY",
                tcn=""):
            last_t, last_code, last_esd = history[-1]
            regime = {"BA": "NEAR", "BB": "DUE_IN", "BC": "LONG", "BV": "PROCUREMENT", "BZ": "PROCUREMENT", "B3": "LONG",
                      "B5": "DUE_IN", "CB": "REJECTED", "CG": "REJECTED", "CJ": "REJECTED", "CU": "REJECTED"}[last_code]
            ipg = 1 if int(pd) <= 3 else 2 if int(pd) <= 8 else 3
            row = {"doc_number": doc, "ship_id": ship, "dodaac": SHIPS[ship]["dodaac"], "jcn": jcn, "casrep_id": cid,
                   "nsn": nsn, "niin": niin, "nomenclature": nom, "qty": 1, "unit_of_issue": "EA",
                   "priority_designator": pd, "issue_priority_group": ipg, "rdd": rdd, "nors": rdd == "999",
                   "date_requisitioned": drq.isoformat(), "status_code": last_code, "status_date": last_t[:10],
                   "esd": last_esd or "", "delay_regime": regime,
                   "status_history": ";".join(f"{t} {c} {e or '-'}" for t, c, e in history),
                   "source_of_supply": sos, "tcn": tcn, "expedite_flag": expedite, "system_of_record": sor,
                   "as_of": last_t, "provenance": "proposed"}
            self.reqs[ship].append(row)
            return row

        # ---- demo CASREPs (spec 03 section 6)
        K = "KESSLER"
        pump = PARTS["019990001"]
        # DDG991-26-015: closed nav radar casualty (CORRECT on day -3)
        j15 = job(K, "OD01", "NAVRAD-TX", "MAGNETRON, NAV RADAR NO. 1", "1", "COMPLETED", date(2026, 10, 20), "2", 4, 22,
                  "CASREP 200900Z OCT 26. NIIN 019990401 RECEIVED 311400Z OCT 26. CORRECTED.", j="0031",
                  dtg="200900Z OCT 26", cid="DDG991-26-015", apl=PARTS["019990401"]["apl"], when="2")
        d15 = docnum(K, date(2026, 10, 20), "0002")
        j15["req_doc_numbers"] = d15
        req(K, d15, j15["jcn"], "DDG991-26-015", "019990401", PARTS["019990401"]["nomenclature"], PARTS["019990401"]["nsn"], "03", "999",
            date(2026, 10, 20), [("2026-10-20T10:00:00Z", "BA", "2026-10-26")], tcn="TCN-PH-00915")
        # DDG991-26-016: chilled water compressor, Cat 2, part arriving
        j16 = job(K, "EA01", "HM-CHW", "COMPRESSOR, CHILLED WATER NO. 3", "3", "OPEN_AWAITING_PARTS", date(2026, 10, 28), "2", 4, 16,
                  "CASREP 281300Z OCT 26. AWAITING NIIN 019990601.", j="0077", dtg="281300Z OCT 26", cid="DDG991-26-016",
                  apl=PARTS["019990601"]["apl"], when="2")
        d16 = docnum(K, date(2026, 10, 28), "0003")
        j16["req_doc_numbers"] = d16
        req(K, d16, j16["jcn"], "DDG991-26-016", "019990601", PARTS["019990601"]["nomenclature"], PARTS["019990601"]["nsn"], "03", "999",
            date(2026, 10, 28), [("2026-10-28T14:00:00Z", "BA", "2026-11-06")])
        # DDG991-26-017: THE demo casualty
        j17 = job(K, "CF01", "SPY1D-CW", "PUMP, COOLING WATER, SPY-1D", "2", "OPEN_AWAITING_PARTS", date(2026, 11, 4), "1", 3, 16,
                  "CASREP 041200Z NOV 26. AWAITING NIIN 019990001. FTS ASSIST REQ.", j="0042", dtg="041200Z NOV 26",
                  cid="DDG991-26-017", reqs="V9910163080001", as_of="2026-11-04T12:00:00Z", apl=pump["apl"], when="2")
        req(K, "V9910163080001", j17["jcn"], "DDG991-26-017", "019990001", pump["nomenclature"], pump["nsn"], "02", "999",
            date(2026, 11, 4), [("2026-11-04T12:00:00Z", "BB", "2026-11-05"), ("2026-11-05T10:00:00Z", "BC", "2026-12-15")],
            expedite=True)
        # SSDG lube oil leak reported in the daily report (corroboration)
        job(K, "EE01", "SSDG-GOV", "SSDG NO. 2 LUBE OIL SYSTEM", "0", "OPEN", date(2026, 11, 4), "3", 4, 6,
            "LUBE OIL LEAK NO. 2 SSDG. CONTAINED.", when="2")
        V = "VARNELL"
        sw = PARTS["019990044"]
        j8 = job(V, "CE01", "SQQ89-PROC", "SWITCH, ETHERNET, SQQ-89 PROCESSING", "3", "OPEN_AWAITING_PARTS", date(2026, 10, 30), "2", 3, 10,
                 "CASREP 301500Z OCT 26. AWAITING NIIN 019990044.", j="0057", dtg="301500Z OCT 26", cid="DDG992-26-008", apl=sw["apl"])
        d8 = docnum(V, date(2026, 10, 30), "0011")
        j8["req_doc_numbers"] = d8
        req(V, d8, j8["jcn"], "DDG992-26-008", "019990044", sw["nomenclature"], sw["nsn"], "03", "999", date(2026, 10, 30),
            [("2026-10-30T16:00:00Z", "BA", "2026-11-05")])
        j9 = job(V, "CE01", "LAN-CORE", "SWITCH, ETHERNET, COMBAT-SYSTEM LAN SEGMENT", "3", "OPEN_AWAITING_PARTS", date(2026, 10, 31), "2", 3, 8,
                 "CASREP 310900Z OCT 26. AWAITING NIIN 019990044.", j="0058", dtg="310900Z OCT 26", cid="DDG992-26-009", apl=sw["apl"])
        d9 = docnum(V, date(2026, 10, 31), "0014")
        j9["req_doc_numbers"] = d9
        req(V, d9, j9["jcn"], "DDG992-26-009", "019990044", sw["nomenclature"], sw["nsn"], "03", "999", date(2026, 10, 31),
            [("2026-10-31T10:00:00Z", "BA", "2026-11-06")])
        A = "ASHBY"
        # X1: Ashby CASREP 004 has no JCN (no job row is created)
        # X3: Ashby BA with ESD already past and no newer status
        jx3 = job(A, "OD01", "NAVRAD-TX", "MAGNETRON, NAV RADAR NO. 2", "1", "OPEN_AWAITING_PARTS", date(2026, 10, 22), "3", 4, 6,
                  "AWAITING NIIN 019990401.", apl=PARTS["019990401"]["apl"])
        dx3 = docnum(A, date(2026, 10, 24), "0021")
        jx3["req_doc_numbers"] = dx3
        req(A, dx3, jx3["jcn"], "", "019990401", PARTS["019990401"]["nomenclature"], PARTS["019990401"]["nsn"], "06", "2026-11-20",
            date(2026, 10, 24), [("2026-10-24T09:00:00Z", "BA", "2026-10-30")])

        # ---- filler jobs (realistic CSMP volume, spec 02 section 5)
        filler_niins = [(f"01999{9000 + i:04d}", nom) for i, nom in enumerate(
            ["GASKET SET", "FILTER ELEMENT, FUEL", "VALVE, BALL, 2 IN", "SEAL KIT, PUMP", "BEARING, BALL", "RELAY, POWER",
             "FUSE, CARTRIDGE", "MOTOR, FAN, 115V", "SENSOR, TEMPERATURE", "HOSE ASSY, HYDRAULIC", "LAMP, INDICATOR",
             "CIRCUIT BREAKER, 30A", "GAUGE, PRESSURE", "SWITCH, LIMIT", "COUPLING, SHAFT"])]
        self.filler_niins = filler_niins
        safe_degrade = ["HELO-LTS", "NAVRAD-TX", "HM-CHW", "SSM-LCH"]
        all_comps = [c for c in COMPONENT_TO_SYSTEM]
        nouns = {"HM-CHW": "CHILLED WATER PIPING", "HELO-LTS": "FLIGHT DECK LIGHT FIXTURE", "NAVRAD-TX": "NAV RADAR WAVEGUIDE",
                 "SSM-LCH": "SSM LAUNCHER CANISTER RAIL"}
        totals = {"KESSLER": 72, "VARNELL": 60, "ASHBY": 40}
        remarks_pool = ["ROUTINE. SCHEDULE NEXT INPORT.", "AWAITING TECH MANUAL CHANGE.", "DEFERRED TO NEXT CMAV.",
                        "SHIPS FORCE TO COMPLETE.", "NEEDS IMA ASSIST.", "MINOR, NO MISSION IMPACT."]
        for s in SHIP_IDS:
            while len(self.jobs[s]) < totals[s]:
                eic = R.choice(all_comps + safe_degrade * 3)
                wc = SYSTEMS[COMPONENT_TO_SYSTEM[eic]]["work_center"]
                status = "1" if (eic in safe_degrade and R.random() < 0.35) else "0"
                state = R.choice(["DEFERRED"] * 4 + ["OPEN"] * 4 + ["IN_WORK"] + ["OPEN_AWAITING_PARTS"] + ["COMPLETED"] * 0)
                if R.random() < 0.05:
                    state = "COMPLETED"
                disc = date(2026, 11, 3) - timedelta(days=R.randint(1, 150))
                comp_name = next(c["name"] for sy in SYSTEMS.values() for c in sy["components"] if c["eic"] == eic)
                noun = nouns.get(eic, comp_name.upper())
                deferred = (disc + timedelta(days=R.randint(1, 10))).isoformat() if state == "DEFERRED" else ""
                reason = str(R.choice([1, 2, 3, 3, 4, 5])) if state == "DEFERRED" else ""
                ta = R.choice([4, 4, 4, 4, 4, 2, 3])
                rm = R.choice(remarks_pool)
                row = job(s, wc, eic, noun, status, state, disc, R.choice(["2", "3", "3", "3"]), ta, R.choice([2, 4, 6, 8, 12, 16, 24]),
                          rm, deferred=deferred, reason=reason, when=R.choice(["0", "1", "2", "4", "6"]))
                if state == "OPEN_AWAITING_PARTS":
                    niin, nom = R.choice(filler_niins)
                    drq = disc + timedelta(days=R.randint(0, 5))
                    code = R.choices(["BA", "BB", "BV", "BZ", "BC", "B5", "CB"], [30, 30, 8, 7, 10, 5, 5])[0]
                    t = drq + timedelta(days=R.randint(1, 20))
                    if t > date(2026, 11, 3):
                        t = date(2026, 11, 3)
                    esd = (t + timedelta(days=R.randint(3, 40))).isoformat() if code in ("BA", "BB", "B5") else ""
                    if code == "BA" and esd < "2026-11-04":
                        esd = (date(2026, 11, 4) + timedelta(days=R.randint(1, 10))).isoformat()
                    doc = docnum(s, drq)
                    row["req_doc_numbers"] = doc
                    row["remarks"] = f"AWAITING NIIN {niin}."
                    req(s, doc, row["jcn"], "", niin, nom, f"5330-01-{niin[2:5]}-{niin[5:]}", f"{R.randint(5, 15):02d}",
                        (drq + timedelta(days=R.randint(20, 60))).isoformat(), drq, [(f"{t.isoformat()}T10:00:00Z", code, esd or None)],
                        sos=R.choice(["NAVSUP WSS", "DLA", "DLA", "VENDOR"]),
                        sor="RSUPPLY")
        for s in SHIP_IDS:
            self.jobs[s].sort(key=lambda r: r["jcn"])
            self.write_csv(self.sdir(s), "csmp.csv", self.jobs[s])
            self.write_csv(self.sdir(s), "requisition_status.csv", self.reqs[s])
            self.cat(s, "csmp.csv", "OMMS-NG / AWN", "TYCOM N43 (notional)", "daily", "NTCSS replication via L-IDE to Jupiter (inferred)", BASE_AS_OF, 5)
            self.cat(s, "requisition_status.csv", "R-Supply / MILSTRIP", "Ship's supply officer (notional)", "daily",
                     "NTCSS replication via L-IDE to Jupiter (inferred)", BASE_AS_OF, 5)

        # ---- CASREP messages and casreps.json (spec 03)
        def compact_dtg(dtg: str) -> str:
            return dtg.replace(" ", "")

        def msg(ship, serial, mtype, dtg, cat, eic, noun, apl, jcn, etr_dtg, assist, parts, ampn, rmks, ref=None):
            name = SHIPS[ship]["name"]
            lines = [MSG_BANNER, f"R {dtg}", f"FM {name}", "TO COMNAVSURFLANT NORFOLK VA", "INFO COMDESRON NINE NINE",
                     "      NAVSUP WSS MECHANICSBURG PA", "BT", "UNCLAS //N04790//",
                     f"MSGID/CASREP/{name}/{serial}/{dtg.split()[1]}//"]
            if ref:
                lines.append(f"REF/A/MSG/{name}/{compact_dtg(ref)}//")
            sysname = SYSTEMS[COMPONENT_TO_SYSTEM.get(eic, eic)]["name"].upper()
            lines.append(f"CASUALTY/{mtype}/{sysname}/CAT:{cat}/EIC:{eic}//")
            lines.append(f"PARTSID/{noun}/APL:{apl}/JCN:{jcn or 'NONE'}//")
            if etr_dtg:
                lines.append(f"ESTIMATE/ETR:{etr_dtg}//")
            if assist:
                lines.append(f"ASSIST/REQ:YES/TYPE:{assist[0]}/ORG:{assist[1]}//")
            else:
                lines.append("ASSIST/REQ:NO//")
            for i, p in enumerate(parts, 1):
                lines.append(f"1PARTS/{i}/NSN:{p['nsn']}/QTY:1/DOC:{p['doc']}/PD:{p['pd']}/RDD:999//")
            lines.append(f"AMPN/{ampn}//")
            lines.append(f"RMKS/{rmks}//")
            lines.append("BT")
            return "\n".join(lines) + "\n"

        casrep_defs = [
            # ship, cid, serial, cat, eic, noun, apl, jcn, parts, assist, messages[(type, dtg, etr_dtg, ampn, rmks)], areas
            ("KESSLER", "DDG991-26-015", "015", 2, "NAVRAD-TX", "MAGNETRON, NAV RADAR NO. 1", PARTS["019990401"]["apl"], j15["jcn"],
             [{"nsn": PARTS["019990401"]["nsn"], "doc": d15, "pd": "03", "niin": "019990401"}], None,
             [("INITIAL", "200900Z OCT 26", "301200Z OCT 26", "NAV RADAR NO. 1 TRANSMITTER FAILED. NO. 2 RADAR IN USE.",
               "1. SHIP AVAILABLE TO RECEIVE PARTS NORFOLK 21 OCT-05 NOV."),
              ("CORRECT", "011400Z NOV 26", "", "PARTS RECEIVED 311400Z OCT 26. SUPPLY DELAY 98 HRS. MANHOURS 22.", "1. CASUALTY CORRECTED.")],
             ["MOB"]),
            ("KESSLER", "DDG991-26-016", "016", 2, "HM-CHW", "COMPRESSOR, CHILLED WATER NO. 3", PARTS["019990601"]["apl"], j16["jcn"],
             [{"nsn": PARTS["019990601"]["nsn"], "doc": d16, "pd": "03", "niin": "019990601"}], None,
             [("INITIAL", "281300Z OCT 26", "081200Z NOV 26", "NO. 3 CHILLED WATER COMPRESSOR FAILED. TWO OF THREE PLANTS ON LINE.",
               "1. SHIP AVAILABLE TO RECEIVE PARTS NORFOLK 29 OCT-11 NOV.")], ["MOB"]),
            ("KESSLER", "DDG991-26-017", "017", 3, "SPY1D-CW", "PUMP, COOLING WATER, SPY-1D", pump["apl"], j17["jcn"],
             [{"nsn": pump["nsn"], "doc": "V9910163080001", "pd": "02", "niin": "019990001"}], ("FTS", "NSWC TECH REP"),
             [("INITIAL", "041200Z NOV 26", "121200Z NOV 26",
               "COOLING WATER PUMP SEIZED DURING LIGHT-OFF. SPY-1D DEGRADED TO\nSINGLE ARRAY FACE OPERATION. AW MISSION MAJOR DEGRADATION.",
               "1. SHIP AVAILABLE TO RECEIVE PARTS AND ASSIST NORFOLK 05-15 NOV.\n2. UNDERWAY GROUP SAIL 16 NOV."),
              ("UPDATE", "051000Z NOV 26", "221200Z NOV 26",
               "SUPPLY STATUS BC LONG DELAY. ESD 15 DEC 26 PLUS 5 DAYS CONUS TRANSIT\nPLUS 2 DAYS INSTALL. ETR REVISED.",
               "1. SHIP AVAILABLE TO RECEIVE PARTS AND ASSIST NORFOLK 05-15 NOV.\n2. UNDERWAY GROUP SAIL 16 NOV.")], ["AW"]),
            ("VARNELL", "DDG992-26-008", "008", 2, "SQQ89-PROC", "SWITCH, ETHERNET, SQQ-89 PROCESSING", sw["apl"], j8["jcn"],
             [{"nsn": sw["nsn"], "doc": d8, "pd": "03", "niin": "019990044"}], ("FTS", "NSWC ISEA"),
             [("INITIAL", "301500Z OCT 26", "081200Z NOV 26", "SQQ-89 PROCESSING SEGMENT DEGRADED. ETHERNET SWITCH FAULT.",
               "1. SHIP IN CMAV NORFOLK. AVAILABLE TO RECEIVE PARTS.")], ["ASW"]),
            ("VARNELL", "DDG992-26-009", "009", 2, "LAN-CORE", "SWITCH, ETHERNET, COMBAT-SYSTEM LAN SEGMENT", sw["apl"], j9["jcn"],
             [{"nsn": sw["nsn"], "doc": d9, "pd": "03", "niin": "019990044"}], ("FTS", "NSWC ISEA"),
             [("INITIAL", "310900Z OCT 26", "091200Z NOV 26", "COMBAT-SYSTEM LAN SEGMENT DEGRADED. ETHERNET SWITCH FAULT.",
               "1. SHIP IN CMAV NORFOLK. AVAILABLE TO RECEIVE PARTS.")], ["CCC"]),
            ("ASHBY", "DDG993-26-004", "004", 2, "COMMS-HF", "TRANSCEIVER, HF NO. 1", PARTS["019990501"]["apl"], "",
             [], ("FTS", "NIWC TECH REP"),
             [("INITIAL", "010700Z NOV 26", "081200Z NOV 26", "HF TRANSCEIVER NO. 1 FAILED. NO. 2 IN USE, NO REDUNDANCY.",
               "1. SHIP UNDERWAY VACAPES UNTIL 09 NOV. TECH ASSIST ON RETURN.")], ["CCC"]),
        ]
        from .domain import parse_dtg
        import re
        casrep_expected = {}
        for ship in SHIP_IDS:
            out = []
            for (s, cid, serial, cat, eic, noun, apl, jcn, parts, assist, msgs, areas) in casrep_defs:
                if s != ship:
                    continue
                files, etr_hist, closed = [], [], None
                init_dtg = msgs[0][1]
                for i, (mtype, dtg, etr, ampn, rmks) in enumerate(msgs, 1):
                    fname = f"casrep_messages/{cid}_{i:02d}_{mtype}.txt"
                    message_serial = serial if i == 1 else f"{int(serial) + 50 + i:03d}"
                    text = msg(s, message_serial, mtype, dtg, cat, eic, noun, apl, jcn, etr, assist, parts, ampn, rmks,
                               ref=init_dtg if i > 1 else None)
                    self.write_text(self.sdir(s) / fname, text)
                    def span_for(tag, index=0):
                        pattern = r"(?m)^" + (r"(?:PARTS|1PARTS)" if tag == "PARTS" else tag) + r"/[\s\S]*?//"
                        return list(re.finditer(pattern, text))[index].group(0)
                    # Expected fields come from the fixture definitions, independently of the ingest/LLM parsers.
                    facts = [{"type": "casrep_status", "report_type": mtype, "category": cat, "eic": eic,
                              "span": span_for("CASUALTY"), "hedged": False}]
                    if etr:
                        facts.append({"type": "repair_estimate", "timestamp": iso(parse_dtg(etr)),
                                      "span": span_for("ESTIMATE"), "hedged": False})
                    facts.append({"type": "assistance_request", "value": "YES" if assist else "NO",
                                  "span": span_for("ASSIST"), "hedged": False})
                    for pi, part in enumerate(parts):
                        facts.append({"type": "part_requirement", "niin": part["niin"], "quantity": 1,
                                      "doc_number": part["doc"], "span": span_for("PARTS", pi), "hedged": False})
                    for tag in ("AMPN", "RMKS"):
                        facts.append({"type": "casrep_narrative", "span": span_for(tag), "hedged": False})
                    casrep_expected[f"{s}/{fname}"] = {"ship_id": s, "known_at": iso(parse_dtg(dtg)), "facts": facts}
                    files.append(fname)
                    if etr:
                        etr_hist.append({"dtg": dtg, "etr": iso(parse_dtg(etr)), "report_type": mtype})
                    if mtype == "CORRECT":
                        closed = {"type": "CORRECT", "dtg": dtg, "parts_received": "311400Z OCT 26", "supply_delay_hrs": 98, "man_hours": 22}
                out.append({"casrep_id": cid, "ship_id": s, "uic": SHIPS[s]["uic"], "serial": serial, "initial_dtg": init_dtg,
                            "initial_time": iso(parse_dtg(init_dtg)), "category": cat, "eic": eic, "equipment": noun, "jcn": jcn,
                            "mission_areas_affected": areas,
                            "assist": {"required": bool(assist), "type": assist[0] if assist else "", "org": assist[1] if assist else ""},
                            "parts": [{"nsn": p["nsn"], "niin": p["niin"], "qty": 1, "doc_number": p["doc"], "pd": p["pd"], "rdd": "999"} for p in parts],
                            "etr_history": etr_hist, "state": "CLOSED" if closed else "OPEN", "closed": closed,
                            "messages": files, "provenance": "proposed"})
            self.casreps[ship] = out
            self.write_json(self.sdir(ship) / "casreps.json", {"_banner": BANNER, "casreps": out})
            self.cat(ship, "casrep_messages/", "CASREP messages (NTRP/NWP 1-03.1)", "Fleet Forces / MFOM (notional)", "per message",
                     "Message traffic via MFOM to Jupiter (inferred)", BASE_AS_OF, 7)

        self.write_json(self.out / "squadron" / "casrep_expected_facts.json",
                        {"_banner": BANNER, "documents": casrep_expected})

        # ---- COSAL (spec 04), fleet stock (spec 06), wholesale (spec 05), status codes
        pidx = parts_index()
        for s in SHIP_IDS:
            rows = []
            for niin, uses in pidx.items():
                p = PARTS[niin]
                allowance = {"019990001": {"KESSLER": 0, "VARNELL": 1, "ASHBY": 0}}.get(niin, {}).get(s)
                if allowance is None:
                    allowance = R.choice([0, 1, 1, 2])
                on_hand = allowance if niin == "019990001" else min(allowance, R.choice([0, 1, 1, 2]))
                if s == "KESSLER" and niin == "019990077":
                    allowance, on_hand = 1, 0
                rows.append({"ship_id": s, "uic": SHIPS[s]["uic"], "niin": niin, "nsn": p["nsn"], "nomenclature": p["nomenclature"],
                             "apl": p["apl"], "item_type": "STOREROOM", "allowance_qty": allowance, "on_hand_qty": on_hand,
                             "due_in_qty": 1 if (s == "KESSLER" and niin in ("019990001", "019990601")) else 0,
                             "sri_osi": "SRI", "cross_deck_eligible": on_hand > 0, "last_inventory_date": "2026-09-30",
                             "system_of_record": "RSUPPLY", "as_of": BASE_AS_OF, "provenance": "proposed"})
                inst = sum(u[2] for u in uses)
                rows.append({"ship_id": s, "uic": SHIPS[s]["uic"], "niin": niin, "nsn": p["nsn"], "nomenclature": p["nomenclature"],
                             "apl": p["apl"], "item_type": "INSTALLED", "allowance_qty": inst, "on_hand_qty": inst, "due_in_qty": 0,
                             "sri_osi": "", "cross_deck_eligible": False, "last_inventory_date": "2026-09-30",
                             "system_of_record": "RSUPPLY", "as_of": BASE_AS_OF, "provenance": "proposed"})
            for niin, nom in filler_niins[:8]:
                a = R.choice([1, 2, 4])
                rows.append({"ship_id": s, "uic": SHIPS[s]["uic"], "niin": niin, "nsn": f"5330-01-{niin[2:5]}-{niin[5:]}",
                             "nomenclature": nom, "apl": "", "item_type": "STOREROOM", "allowance_qty": a,
                             "on_hand_qty": R.randint(0, a), "due_in_qty": 0, "sri_osi": "SRI", "cross_deck_eligible": True,
                             "last_inventory_date": "2026-09-30", "system_of_record": "RSUPPLY", "as_of": BASE_AS_OF, "provenance": "proposed"})
            self.cosal[s] = rows
            self.write_csv(self.sdir(s), "onboard_allowance_cosal.csv", rows)
            self.cat(s, "onboard_allowance_cosal.csv", "R-Supply COSAL", "Ship's supply officer (notional)", "weekly",
                     "NTCSS replication via L-IDE to Jupiter (inferred)", BASE_AS_OF, 30)

        fleet = []
        for niin, uses in pidx.items():
            for s in SHIP_IDS:
                st = next(r for r in self.cosal[s] if r["niin"] == niin and r["item_type"] == "STOREROOM")
                inst = sum(u[2] for u in uses)
                note = ""
                if st["on_hand_qty"] > 0 and st["on_hand_qty"] <= st["allowance_qty"]:
                    note = "drops below allowance"
                elif st["on_hand_qty"] == 0 and inst > 0:
                    note = "cannibalization only: degrades donor system"
                fleet.append({"niin": niin, "ship_id": s, "uic": SHIPS[s]["uic"], "storeroom_on_hand": st["on_hand_qty"],
                              "storeroom_allowance": st["allowance_qty"], "installed_qty": inst,
                              "installed_system_eic": uses[0][1], "cross_deck_eligible": st["on_hand_qty"] > 0,
                              "cannibalize_eligible": inst > 0, "donor_cost_note": note, "as_of": BASE_AS_OF, "provenance": "proposed"})
        self.write_csv(self.out / "squadron", "fleet_onboard_stock.csv", fleet)
        self.cat(None, "fleet_onboard_stock.csv", "Derived from each ship's COSAL (no public squadron view)", "MissionTwin (derived)",
                 "derived", "Derived view (one source: per-ship COSAL)", BASE_AS_OF, 30)

        ws_rows = []
        for niin in pidx:
            p = PARTS[niin]
            if niin == "019990001":
                wsss, due, due_d = 0, 2, "2026-12-20"
            elif niin == "019990044":
                wsss, due, due_d = 4, 0, ""
            else:
                wsss, due, due_d = R.randint(0, 3), R.randint(0, 2), "2027-01-15"
            ws_rows.append({"niin": niin, "nsn": p["nsn"], "nomenclature": p["nomenclature"], "holder": "NAVSUP_WSS",
                            "holder_name": "NAVSUP WSS MECHANICSBURG (SYNTH)", "location": "MECHANICSBURG PA", "on_hand_qty": wsss,
                            "due_in_qty": due, "due_in_date": due_d if due else "", "release_lead_days": 1, "transit_days_conus": 5,
                            "transit_days_oconus": 10, "requires_engineering_validation": False, "as_of": BASE_AS_OF, "provenance": "proposed"})
            if niin in ("019990001", "019990088"):
                ws_rows.append({"niin": niin, "nsn": p["nsn"], "nomenclature": p["nomenclature"], "holder": "PROGRAM_OFFICE",
                                "holder_name": "AEGIS PROGRAM OFFICE (SYNTH)", "location": "WASHINGTON DC", "on_hand_qty": 1,
                                "due_in_qty": 0, "due_in_date": "", "release_lead_days": 3, "transit_days_conus": 5,
                                "transit_days_oconus": 10, "requires_engineering_validation": True, "as_of": BASE_AS_OF, "provenance": "proposed"})
        for niin, nom in filler_niins:
            ws_rows.append({"niin": niin, "nsn": f"5330-01-{niin[2:5]}-{niin[5:]}", "nomenclature": nom, "holder": "DLA",
                            "holder_name": "DLA DISTRIBUTION (SYNTH)", "location": "NEW CUMBERLAND PA", "on_hand_qty": R.randint(5, 200),
                            "due_in_qty": 0, "due_in_date": "", "release_lead_days": 1, "transit_days_conus": 5,
                            "transit_days_oconus": 10, "requires_engineering_validation": False, "as_of": BASE_AS_OF, "provenance": "proposed"})
        self.write_csv(self.out / "squadron", "wholesale_stock.csv", ws_rows)
        self.cat(None, "wholesale_stock.csv", "NAVSUP WSS / DLA / OTS / program office", "NAVSUP WSS (notional)", "daily",
                 "NAVSUP data on Advana / Navy Data Platform (inferred)", BASE_AS_OF, 5)

        codes = [("BA", "B", "Being processed for shipment; ESD when known", "NEAR"),
                 ("BB", "B", "Backordered against a due-in", "DUE_IN"),
                 ("BC", "B", "Backordered, long delay expected", "LONG"),
                 ("BV", "B", "On contract for direct vendor delivery", "PROCUREMENT"),
                 ("BZ", "B", "Direct-delivery procurement in process", "PROCUREMENT"),
                 ("B3", "B", "RDD unrealistic", "LONG"),
                 ("B5", "B", "Follow-up received, working to improve ESD", "CARRIES_PRIOR"),
                 ("CB", "C", "Rejected", "REJECTED"), ("CG", "C", "Rejected", "REJECTED"),
                 ("CJ", "C", "Rejected", "REJECTED"), ("CU", "C", "Rejected", "REJECTED")]
        self.write_csv(self.out / "squadron", "status_code_reference.csv",
                       [{"code": c, "series": s, "meaning": m, "delay_regime": r,
                         "source": "DLM 4000.25 Vol 2 AP7.16 via secondary mirror (snippet)", "provenance": "sourced"} for c, s, m, r in codes])
        self.cat(None, "status_code_reference.csv", "MILSTRIP / DLMS (DLM 4000.25 AP7.16)", "DLA (reference)", "per change",
                 "Reference table", BASE_AS_OF, 365)

    # ------------------------------------------------------------ SKED (spec 01)
    def gen_sked(self):
        R = self.R
        weeks = [date(2026, 11, 2) + timedelta(weeks=w) for w in range(-6, 6)]
        for s in SHIP_IDS:
            crew = self.crew[s]
            rows, loep = [], []
            mrcs = []
            for sy in SYSTEMS.values():
                for c in sy["components"]:
                    mip = f"{R.randint(1000, 9899)}/{R.randint(1, 30):03d}-{R.choice('ABCD')}{R.randint(1, 9)}"
                    per2 = R.choice(["M", "Q", "S", "A"])
                    if c["eic"] == "SPY1D-CW":
                        per2 = "M"
                    if c["eic"] == "CIWS-MT":
                        per2 = "Q"
                    per1 = R.choice(["D", "W"])
                    mrcs.append((sy, c, mip, per1, f"{per1}-1"))
                    mrcs.append((sy, c, mip, per2, "M-1R" if c["eic"] == "SPY1D-CW" else "Q-2" if c["eic"] == "CIWS-MT" else f"{per2}-{R.randint(1, 3)}"))
                    loep.append({"ship_id": s, "uic": SHIPS[s]["uic"], "hull": SHIPS[s]["hull"], "tycom": TYCOM, "force_rev": "1-27",
                                 "report_date": "2026-10-01", "work_center": sy["work_center"], "mip": mip,
                                 "equipment_desc": f"{sy['name']} {c['name']}".upper(), "eic": c["eic"], "provenance": "proposed"})
            acc = 0.96 if s == "VARNELL" else R.uniform(0.88, 0.93)
            underway_weeks = set()
            superseded = {b["superseded_block_id"] for b in self.schedule[s]}
            for b in self.schedule[s]:
                if b["employment_code"] == "UNDERWAY" and b["block_id"] not in superseded:
                    sd, ed = date.fromisoformat(b["start_date"]), date.fromisoformat(b["end_date"])
                    for wk in weeks:
                        if sd <= wk + timedelta(days=6) and ed >= wk:
                            underway_weeks.add(wk)
            for (sy, c, mip, per, mrc) in mrcs:
                wc = sy["work_center"]
                assignees = [m for m in crew if m["work_center"] == wc and PG_RANK[m["paygrade"]] in (4, 5, 6)] or \
                            [m for m in crew if m["work_center"] == wc]
                offset = R.randint(0, 3)
                for wi, wk in enumerate(weeks):
                    if per in ("M",) and (wi % 4) != (offset if c["eic"] != "SPY1D-CW" else 1):
                        continue
                    if per == "Q" and wi != (4 if c["eic"] == "CIWS-MT" else offset + 4):
                        continue
                    if per in ("S", "A") and wi != offset + 6:
                        continue
                    past = wk < date(2026, 11, 2)
                    status, sdate = "SCHEDULED", ""
                    if past:
                        lost = per in ("D", "W") and R.random() > acc
                        if s == "KESSLER" and c["eic"] == "SPY1D-CW" and mrc == "M-1R" and wk == date(2026, 10, 26):
                            lost = True
                        if s == "KESSLER" and c["eic"] == "CIWS-MT" and mrc == "Q-2" and wk == date(2026, 10, 19):
                            lost = True  # X7
                        status = "LOST" if lost else "COMPLETE"
                        sdate = (wk + timedelta(days=R.randint(0, 4))).isoformat()
                    if s == "VARNELL" and sy["eic"] == "GTM" and date(2026, 10, 26) <= wk <= date(2026, 11, 9):
                        status, sdate = "IEM", ""
                    a = R.choice(assignees)
                    rows.append({"ship_id": s, "uic": SHIPS[s]["uic"], "hull": SHIPS[s]["hull"], "tycom": TYCOM, "force_rev": "1-27",
                                 "work_center": wc, "mip": mip, "equipment_desc": f"{sy['name']} {c['name']}".upper(), "eic": c["eic"],
                                 "egl_location": f"{R.randint(1, 4):02d}-{R.randint(10, 400):03d}-{R.randint(0, 2)}-E",
                                 "mrc": mrc, "periodicity": per, "man_hours": round(R.choice([0.3, 0.5, 1.0, 1.5, 2.0, 4.0]), 1),
                                 "rate": a["rate"], "min_skill_level": a["rating"] + "3" if a["rating"] != "SN" else "SN",
                                 "sched_week_start": wk.isoformat(), "assigned_to": a["member_id"], "status": status,
                                 "status_date": sdate, "recorded_by_pin": f"PIN-{a['member_id'][2:]}" if status in ("COMPLETE", "LOST") else "",
                                 "spot_check_score": R.randint(70, 99) if (status == "COMPLETE" and R.random() < 0.08) else "",
                                 "iem_flag": status == "IEM", "situational_trigger": "", "notes": "",
                                 "as_of": BASE_AS_OF, "provenance": "proposed"})
                if sy["eic"] in ("GTM", "STEER", "NAVRAD") and per in ("D", "W"):
                    for wk in sorted(underway_weeks):
                        rows.append({"ship_id": s, "uic": SHIPS[s]["uic"], "hull": SHIPS[s]["hull"], "tycom": TYCOM, "force_rev": "1-27",
                                     "work_center": wc, "mip": mip, "equipment_desc": f"{sy['name']} {c['name']}".upper(), "eic": c["eic"],
                                     "egl_location": "", "mrc": "R-1", "periodicity": "R", "man_hours": 0.5,
                                     "rate": assignees[0]["rate"], "min_skill_level": assignees[0]["rating"] + "3",
                                     "sched_week_start": wk.isoformat(), "assigned_to": assignees[0]["member_id"],
                                     "status": "COMPLETE" if wk < date(2026, 11, 2) else "SCHEDULED",
                                     "status_date": (wk + timedelta(days=1)).isoformat() if wk < date(2026, 11, 2) else "",
                                     "recorded_by_pin": "", "spot_check_score": "", "iem_flag": False, "situational_trigger": "UNDERWAY",
                                     "notes": "", "as_of": BASE_AS_OF, "provenance": "proposed"})
            rows.sort(key=lambda r: (r["sched_week_start"], r["work_center"], r["eic"], r["mrc"]))
            self.write_csv(self.sdir(s), "sked_schedule.csv", rows)
            self.write_csv(self.sdir(s), "sked_loep.csv", loep)
            self.cat(s, "sked_schedule.csv", "SKED 3.2 (3-M PMS)", "Ship's 3-M coordinator (notional)", "weekly",
                     "Jupiter data product or merged PMS application (inferred)", BASE_AS_OF, 7)
            self.cat(s, "sked_loep.csv", "SKED 3.2 LOEP (PMS 5 report)", "Ship's 3-M coordinator (notional)", "per force revision",
                     "Jupiter data product (inferred)", BASE_AS_OF, 90)

    # ------------------------------------------------------------ positions, MOVREP, LOGREQ (specs 06, 17)
    def gen_positions_messages(self):
        geo = {"NORFOLK VA": (36.95, -76.33, "PIER 12"), "VACAPES OPAREA": (36.60, -74.80, ""), "JAX OPAREA": (30.40, -80.20, "")}
        rows = []
        cur = {s: [b for b in self.schedule[s] if not any(x["superseded_block_id"] == b["block_id"] for x in self.schedule[s])]
               for s in SHIP_IDS}
        for s in SHIP_IDS:
            for n in range(0, 25):
                day = d(n)
                b = next(b for b in cur[s] if date.fromisoformat(b["start_date"]) <= day <= date.fromisoformat(b["end_date"]))
                place = b["oparea_or_port"]
                lat, lon, pier = geo[place]
                status = "UNDERWAY" if b["employment_code"] == "UNDERWAY" else "INPORT"
                rows.append({"ship_id": s, "date": day.isoformat(), "status": status, "port": place if status == "INPORT" else "",
                             "pier": {"KESSLER": "PIER 12", "VARNELL": "PIER 10", "ASHBY": "PIER 11"}[s] if status == "INPORT" else "",
                             "lat": lat, "lon": lon, "in_company_with": "", "next_port": "", "next_eta": "",
                             "source": "schedule_30day;movrep", "provenance": "proposed"})
        by_day = {}
        for r in rows:
            by_day.setdefault((r["date"], r["port"]), []).append(r)
        for r in rows:
            if r["status"] == "INPORT":
                r["in_company_with"] = ";".join(x["ship_id"] for x in by_day[(r["date"], r["port"])] if x["ship_id"] != r["ship_id"])
        self.write_csv(self.out / "squadron", "ship_positions.csv", rows)
        self.cat(None, "ship_positions.csv", "MOVREP + schedule (derived)", "MissionTwin (derived)", "daily",
                 "Operational message traffic (inferred)", BASE_AS_OF, 7)

        def mv(ship, serial, dtg, lines):
            return "\n".join([MSG_BANNER, f"FM {SHIPS[ship]['name']}", "TO COMDESRON NINE NINE", "BT", "UNCLAS //N03120//",
                              f"MSGID/MOVREP/{SHIPS[ship]['name']}/{serial}/{dtg.split()[1]}//", f"DTG/{dtg}//"] +
                             [f"{i}. {t}" for i, t in enumerate(lines, 1)][:-1] + [f"{len(lines)}. {lines[-1]}//", "BT"]) + "\n"
        self.write_text(self.out / "ASHBY" / "movrep" / "ASHBY_071200Z_NOV_26.txt",
                        mv("ASHBY", "004", "071200Z NOV 26", ["DEPART VACAPES OPAREA 091200Z NOV 26.", "TRACK: VIA CHESAPEAKE BAY ENTRANCE.",
                                                              "ARRIVE NORFOLK VA 091800Z NOV 26.", "SOA 15 KTS."]))
        self.write_text(self.out / "KESSLER" / "movrep" / "KESSLER_111200Z_NOV_26.txt",
                        mv("KESSLER", "005", "111200Z NOV 26", ["DEPART NORFOLK VA 131200Z NOV 26.", "TRACK: VIA CHESAPEAKE BAY ENTRANCE.",
                                                                "ARRIVE VACAPES OPAREA 131800Z NOV 26.", "SOA 15 KTS."]))
        self.write_text(self.out / "VARNELL" / "movrep" / "VARNELL_161000Z_NOV_26.txt",
                        mv("VARNELL", "006", "161000Z NOV 26", ["DEPART NORFOLK VA 181200Z NOV 26.", "TRACK: VIA CHESAPEAKE BAY ENTRANCE.",
                                                                "ARRIVE VACAPES OPAREA 181800Z NOV 26.", "SOA 15 KTS."]))

        def lg(ship, serial, dtg, lines):
            return "\n".join([MSG_BANNER, f"FM {SHIPS[ship]['name']}", "TO NAVSUP FLC NORFOLK VA", "BT",
                              f"MSGID/LOGREQ/{SHIPS[ship]['name']}/{serial}/{dtg.split()[1]}//", f"DTG/{dtg}//"] +
                             [f"{i}. {t}" for i, t in enumerate(lines, 1)][:-1] + [f"{len(lines)}. {lines[-1]}//", "BT"]) + "\n"
        self.write_text(self.out / "KESSLER" / "logreq" / "KESSLER_041400Z_NOV_26.txt",
                        lg("KESSLER", "002", "041400Z NOV 26", ["ARRIVAL: IN PORT NORFOLK PIER 12 THROUGH 151200Z NOV 26.",
                                                                "PRIORITY MATERIAL: CASREP 017 NIIN 019990001 QTY 1. DELIVER TO PIER 12.",
                                                                "SERVICES: SHORE POWER, POTABLE WATER."]))
        self.write_text(self.out / "KESSLER" / "logreq" / "KESSLER_071500Z_NOV_26.txt",
                        lg("KESSLER", "003", "071500Z NOV 26", ["ARRIVAL: IN PORT NORFOLK PIER 12 THROUGH 121200Z NOV 26.",
                                                                "PRIORITY MATERIAL: CASREP 017 NIIN 019990001 QTY 1. DELIVER TO PIER 12.",
                                                                "SERVICES: SHORE POWER, POTABLE WATER."]))
        for s in SHIP_IDS:
            self.cat(s, "movrep/", "MOVREP messages", "Ship's navigator (notional)", "per transit", "Message traffic (inferred)", BASE_AS_OF, 7)
        self.cat("KESSLER", "logreq/", "LOGREQ messages", "Ship's supply officer (notional)", "per port visit", "Message traffic (inferred)", BASE_AS_OF, 7)

    # ------------------------------------------------------------ daily reports (spec 16)
    def gen_daily_reports(self):
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        K = {
            -3: {"OPERATIONS": ["Inport upkeep continues. Group Sail underway 16 NOV per schedule."],
                 "COMBAT SYSTEMS (LT Brandt)": ["SPY-1D: all four array faces up. No casualties."],
                 "ENGINEERING (LCDR Osei)": ["All GTMs up. CASREP 016 chilled water compressor, part BA, ESD 06 NOV."],
                 "SUPPLY": ["CASREP 015 nav radar magnetron received 31 OCT. CASREP 015 corrected."]},
            -2: {"OPERATIONS": ["Inport upkeep continues."],
                 "COMBAT SYSTEMS (LT Brandt)": ["SPY-1D: No. 2 cooling water pump running warm; monitoring each watch."],
                 "ENGINEERING (LCDR Osei)": ["All GTMs up. Two of three chilled water plants on line."]},
            -1: {"OPERATIONS": ["Inport upkeep continues."],
                 "COMBAT SYSTEMS (LT Brandt)": ["SPY-1D: No. 2 cooling water pump vibration within limits."],
                 "ENGINEERING (LCDR Osei)": ["All GTMs up."]},
            0: {"OPERATIONS": ["Group Sail planning conference 0900 Thursday. No change to underway date received."],
                "COMBAT SYSTEMS (LT Brandt)": ["SPY-1D: single array face ops since 1200Z on the 4th. CASREP 017 (CAT 3) submitted.",
                                               "Cooling pump NIIN 01-999-0001 on order, supply status BB, ESD 05 NOV.",
                                               "CIWS: PMS check last week not completed (lost). Will reschedule."],
                "ENGINEERING (LCDR Osei)": ["All GTMs up. No. 2 SSDG lube oil leak, contained, 2-Kilo submitted."]},
            1: {"OPERATIONS": ["Group Sail planning conference held. No change to underway date received."],
                "COMBAT SYSTEMS (LT Brandt)": ["SPY-1D: single array face ops continue. CASREP 017 UPDATE sent, ETR 22 NOV.",
                                               "Cooling pump NIIN 01-999-0001 on order, supply now showing long delay (BC), ESD 15 DEC.",
                                               "FC1 Ramos believes the NSWC tech rep visit may slip to 12 NOV due to travel."],
                "SUPPLY": ["Expedite requested on CASREP 017 pump via OTS."],
                "ADMIN / TRAINING": ["FC1 Ramos detaches 10 NOV on PRD orders.",
                                     "FC2 Lin departs TAD to school 10 NOV, returns 24 NOV.",
                                     "CIC air defense team trainer due before COMPTUEX; scheduled 21 NOV."]},
            2: {"OPERATIONS": ["Awaiting COMDESRON guidance on Group Sail dates."],
                "COMBAT SYSTEMS (LT Brandt)": ["SPY-1D: single array face ops continue. CASREP 017 open."],
                "ENGINEERING (LCDR Osei)": ["All GTMs up. No. 2 SSDG repaired by ship's force."]},
        }
        V = {
            -3: {"MAINTENANCE": ["CMAV work continues. Growth work items under review."],
                 "COMBAT SYSTEMS": ["SQQ-89 processing segment degraded. CASREP 008 open, switch BA."]},
            -2: {"MAINTENANCE": ["CMAV extended to 11 NOV per RMC message 021400Z NOV 26."],
                 "COMBAT SYSTEMS": ["LAN segment degraded. CASREP 009 open, same switch NIIN as CASREP 008."]},
            -1: {"MAINTENANCE": ["CMAV completion forecast 11 NOV."],
                 "COMBAT SYSTEMS": ["Switches expected 05-06 NOV from WSS."]},
            0: {"MAINTENANCE": ["CMAV completion forecast 11 NOV."],
                "TRAINING": ["ASW certification event planned 18 NOV."]},
            1: {"MAINTENANCE": ["CMAV completion forecast 11 NOV."],
                "COMBAT SYSTEMS": ["ISEA reviewing whether both switch requisitions are needed."]},
            2: {"MAINTENANCE": ["CMAV completion forecast 11 NOV."]},
        }
        A = {n: {"OPERATIONS": ["Underway VACAPES. Return Norfolk 09 NOV." if n <= 2 else "Inport Norfolk."],
                 "COMBAT SYSTEMS": ["HF transceiver No. 1 down. CASREP 004 open, tech assist on return." if n >= -3 else "All systems up."]}
             for n in range(-3, 3)}
        content = {"KESSLER": K, "VARNELL": V, "ASHBY": A}
        expected = {}
        for s in SHIP_IDS:
            for n in range(-3, 3):
                dt = d(n)
                mon = dt.strftime("%b").upper()
                fname = f"daily_reports/daily_status_{s}_{dt.strftime('%Y%m%d')}.pdf"
                path = self.sdir(s) / fname
                path.parent.mkdir(parents=True, exist_ok=True)
                c = canvas.Canvas(str(path), pagesize=letter, invariant=1)
                c.setTitle(f"{BANNER} {s} {dt.isoformat()}")
                c.setAuthor("MissionTwin synthetic generator")
                c.setCreator("MissionTwin")
                c.setFont("Courier", 9.5)
                W, H = letter
                y = H - 50
                c.drawString(40, y, BANNER)
                y -= 18
                c.drawString(40, y, f"{SHIPS[s]['name']} ({SHIPS[s]['hull']})          EIGHT O'CLOCK REPORT          {dt.day:02d} {mon} {dt.year}")
                y -= 13
                known = date_dt(dt) + timedelta(days=1, hours=1)
                c.drawString(40, y, f"From: Executive Officer   To: Commanding Officer   As of: {format_dtg(known)}")
                y -= 20
                facts = []
                for section, lines in content[s].get(n, {}).items():
                    c.drawString(40, y, section)
                    y -= 13
                    for line in lines:
                        c.drawString(48, y, f" - {line}")
                        y -= 13
                        facts.extend(expected_from_line(s, line))
                    y -= 6
                c.drawString(40, 40, BANNER)
                c.showPage()
                c.save()
                expected[f"{s}/{fname}"] = {"ship_id": s, "known_at": iso(known), "facts": facts}
        self.write_json(self.out / "squadron" / "daily_status_expected_facts.json", {"_banner": BANNER, "documents": expected})
        for s in SHIP_IDS:
            self.cat(s, "daily_reports/", "Eight O'Clock Reports (local documents)", "Ship's XO (notional)", "daily",
                     "Document upload (no system of record)", BASE_AS_OF, 2)

    # ------------------------------------------------------------ DRRS baseline (spec 11)
    def gen_readiness_baseline(self):
        from .domain import CRITICAL_CAP
        as_of = "2026-11-04T06:00:00Z"  # last DRRS report BEFORE the day-0 casualty (see spec 11 note)
        for s in SHIP_IDS:
            comp_score = {}
            sys_direct = {}
            for j in self.jobs[s]:
                if j["job_state"] in ("COMPLETED", "CANCELLED") or j["as_of"] > as_of:
                    continue
                sc = STATUS_SCORE[j["status_code"]]
                if j["eic"] in SYSTEMS:
                    sys_direct[j["eic"]] = min(sys_direct.get(j["eic"], 1.0), sc)
                else:
                    comp_score[j["eic"]] = min(comp_score.get(j["eic"], 1.0), sc)
            open_casreps = []
            for cr in self.casreps[s]:
                if cr["state"] == "OPEN" and cr["initial_time"] <= as_of:
                    open_casreps.append(cr)
                    if not cr["jcn"]:
                        sc = {2: 0.6, 3: 0.0, 4: 0.0}[cr["category"]]
                        comp_score[cr["eic"]] = min(comp_score.get(cr["eic"], 1.0), sc)
            def sys_score(eic):
                sy = SYSTEMS[eic]
                cs = [comp_score.get(c["eic"], 1.0) for c in sy["components"]] or [1.0]
                v = sum(cs) / len(cs)
                if any(comp_score.get(c["eic"], 1.0) == 0 and c["critical"] for c in sy["components"]):
                    v = min(v, CRITICAL_CAP)
                return min(v, sys_direct.get(eic, 1.0))
            rows = []
            for area in ["AW", "ASW", "SUW", "MOB", "CCC"]:
                v = sum(w * sys_score(e) for e, w in AREAS[area][1])
                if any(SYSTEMS[e]["critical"] and sys_score(e) == 0 for e, _ in AREAS[area][1]):
                    v = min(v, CRITICAL_CAP)
                idx = round(v * 100)
                crs = [c for c in open_casreps if area in c["mission_areas_affected"]]
                cat = max([c["category"] for c in crs], default=0)
                on_critical = any(SYSTEMS[COMPONENT_TO_SYSTEM.get(c["eic"], c["eic"])]["critical"] for c in crs)
                rating = "N" if (cat >= 4 or idx < 60) else "Q" if (cat >= 3 or on_critical or idx < 80) else "Y"
                bnd = "GREEN" if idx >= 80 else "YELLOW" if idx >= 60 else "RED"
                lim = "; ".join(f"CASREP {c['casrep_id']} CAT {c['category']}" for c in crs)
                rows.append({"ship_id": s, "as_of": as_of, "mission_area": area, "nmet_id": f"NMET-{area}-01 (SYNTH)", "rating": rating,
                             "mfom_index": idx, "band": bnd, "p_score": self.R.randint(82, 95), "e_score": idx,
                             "s_score": self.R.randint(78, 95), "t_score": self.R.randint(75, 95), "o_score": self.R.randint(88, 99),
                             "limiting_factor": lim, "provenance": "proposed"})
            self.write_csv(self.sdir(s), "readiness_baseline.csv", rows)
            self.cat(s, "readiness_baseline.csv", "DRRS-S", "USFF (notional)", "monthly or on change",
                     "SIPR only when real (spec 20); synthetic stand-in here", as_of, 30)

    # ------------------------------------------------------------ INSURV (spec 18, optional)
    def gen_insurv(self):
        R = self.R
        for s in SHIP_IDS:
            insp = date(2023, 3, 1) + timedelta(days=R.randint(0, 900))
            rows = []
            for _ in range(R.randint(5, 20)):
                eic = R.choice(list(COMPONENT_TO_SYSTEM))
                rows.append({"ship_id": s, "inspection_date": insp.isoformat(), "inspection_type": R.choice(["MI", "MI", "FTA"]),
                             "eic": eic, "finding_severity": R.choice(["MINOR", "MINOR", "MAJOR"]),
                             "finding_summary": f"{eic} material deficiency (synthetic)", "corrected": R.random() < 0.7,
                             "as_of": BASE_AS_OF, "provenance": "placeholder"})
            self.write_csv(self.sdir(s), "insurv_findings.csv", rows)
            self.cat(s, "insurv_findings.csv", "INSURV material inspections", "INSURV (notional)", "per inspection",
                     "USFF (inferred)", BASE_AS_OF, 3650)

    # ------------------------------------------------------------ ledger, catalog, feed, PII fixture (specs 19, 20, 00)
    def gen_ledger_catalog_feed(self):
        sq = self.out / "squadron"
        params = {"_banner": BANNER, "scenario_now": iso(SCENARIO_NOW)}
        params.update(DEFAULT_PARAMS)
        (sq / "delay_model_params.yaml").write_text(
            "# " + BANNER + "\n# Assumptions ledger (spec 19). Every engine number not computed from data.\n" +
            yaml.safe_dump(params, sort_keys=False, width=120), encoding="utf-8", newline="")
        self.cat(None, "delay_model_params.yaml", "MissionTwin assumptions ledger", "MissionTwin team", "on edit",
                 "Ships inside the package", BASE_AS_OF, 3650)

        feed = {"_banner": BANNER, "scenario_now": iso(SCENARIO_NOW), "events": [
            {"event_id": "E1", "known_at": "2026-11-04T12:00:00Z", "title": "CASREP DDG991-26-017 INITIAL: SPY-1D cooling pump, CAT 3",
             "kind": "casrep", "ship_id": "KESSLER",
             "refs": ["KESSLER/casrep_messages/DDG991-26-017_01_INITIAL.txt", "KESSLER/csmp.csv#99101CF010042",
                      "KESSLER/requisition_status.csv#V9910163080001"]},
            {"event_id": "E2", "known_at": "2026-11-05T10:00:00Z", "title": "Part delay: supply status BB to BC, ETR slips to 22 NOV",
             "kind": "supply", "ship_id": "KESSLER",
             "refs": ["KESSLER/casrep_messages/DDG991-26-017_02_UPDATE.txt", "KESSLER/requisition_status.csv#V9910163080001",
                      "KESSLER/daily_reports/daily_status_KESSLER_20261104.pdf"]},
            {"event_id": "E3", "known_at": "2026-11-06T01:00:00Z", "title": "Sailors detach: 2 of 3 SPY-qualified FCs leave 10 NOV",
             "kind": "personnel", "ship_id": "KESSLER",
             "refs": ["KESSLER/daily_reports/daily_status_KESSLER_20261105.pdf", "KESSLER/nec_billets.csv#B-CF-014"]},
            {"event_id": "E4", "known_at": "2026-11-07T15:00:00Z", "title": "Schedule shift 071500Z: Group Sail moves earlier to 13 NOV",
             "kind": "schedule", "ship_id": "KESSLER",
             "refs": ["KESSLER/schedule_30day.csv#SCH-KESSLER-07", "KESSLER/logreq/KESSLER_071500Z_NOV_26.txt",
                      "KESSLER/daily_reports/daily_status_KESSLER_20261106.pdf"]},
        ], "release_rule": "a record with known_at after scenario now is released by the first event whose known_at >= the record's known_at",
            "provenance": "proposed"}
        self.write_json(sq / "scenario_feed.json", feed)
        self.cat(None, "scenario_feed.json", "Demo scenario player script", "MissionTwin team", "static", "n/a (demo only)", BASE_AS_OF, 3650)

        rows = []
        cases = [("P1", "KESSLER", "FC1 Ramos believes the NSWC tech rep visit may slip to 12 NOV due to travel.",
                  "FC1 [M-0007] believes the NSWC tech rep visit may slip to 12 NOV due to travel.", "RAMOS"),
                 ("P2", "KESSLER", "FC2 Lin departs TAD to school 10 NOV, returns 24 NOV.",
                  "FC2 [M-0011] departs TAD to school 10 NOV, returns 24 NOV.", "LIN"),
                 ("P3", "KESSLER", "COMBAT SYSTEMS (LT Brandt)", "COMBAT SYSTEMS (LT [M-0101])", "BRANDT"),
                 ("P4", "KESSLER", "ENGINEERING (LCDR Osei)", "ENGINEERING (LCDR [M-0102])", "OSEI"),
                 ("P5", "KESSLER", "FC1 Ramos detaches 10 NOV on PRD orders.", "FC1 [M-0007] detaches 10 NOV on PRD orders.", "RAMOS")]
        for cid, s, t, e, n in cases:
            rows.append({"case_id": cid, "ship_id": s, "input_text": t, "expected_redacted": e, "names_that_must_not_appear": n})
        self.write_csv(sq, "pii_redaction_test.csv", rows)

        self.write_json(sq / "data_catalog.json", {"_banner": BANNER, "datasets": self.catalog})

    def cat(self, ship, file, real, steward, refresh, path, as_of, stale):
        f = f"{ship}/{file}" if ship else f"squadron/{file}"
        self.catalog.append({"file": f, "spec": f"data_sources/{SPEC_OF.get(file.rstrip('/'), '00_README.md')}",
                             "real_system": real, "system_of_record": real.split(" ")[0], "steward": steward,
                             "marking": "CUI when real; NOTIONAL here", "refresh": refresh, "fielded_access_path": path,
                             "as_of": as_of, "staleness_threshold_days": stale})


SPEC_OF = {}


def expected_from_line(ship: str, line: str) -> list[dict]:
    """The facts a correct extractor should return for one report line (test oracle, spec 16 4.3)."""
    import re
    out = []
    if m := re.search(r"([A-Z]{2,4}\d?) (\w+) detaches (\d{2} [A-Z]{3})", line):
        out.append({"type": "personnel_transfer", "rate": m.group(1), "name_token": m.group(2), "date": m.group(3), "span": line, "hedged": False})
    if m := re.search(r"([A-Z]{2,4}\d?) (\w+) departs TAD .*? (\d{2} [A-Z]{3}), returns (\d{2} [A-Z]{3})", line):
        out.append({"type": "personnel_tad", "rate": m.group(1), "name_token": m.group(2), "date": m.group(3), "until": m.group(4),
                    "span": line, "hedged": False})
    if m := re.search(r"tech rep visit may slip to (\d{2} [A-Z]{3})", line):
        out.append({"type": "assist_eta", "date": m.group(1), "span": line, "hedged": True})
    if m := re.search(r"Expedite requested on CASREP (\d{3})", line):
        out.append({"type": "expedite_requested", "casrep_serial": m.group(1), "span": line, "hedged": False})
    if m := re.search(r"(CIWS|SPY-1D): PMS check .* not completed \(lost\)", line):
        out.append({"type": "pms_lost", "system": {"CIWS": "CIWS", "SPY-1D": "SPY1D"}[m.group(1)], "span": line, "hedged": False})
    if m := re.search(r"CASREP (\d{3}) \(CAT (\d)\) submitted", line):
        out.append({"type": "casrep_reported", "casrep_serial": m.group(1), "category": int(m.group(2)), "span": line, "hedged": False})
    if m := re.search(r"trainer due before COMPTUEX; scheduled (\d{2} [A-Z]{3})", line):
        out.append({"type": "training_scheduled", "date": m.group(1), "span": line, "hedged": False})
    return out


def _fmt(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return ""
    return v


def main():
    from .domain import SPEC_OF_FILE
    SPEC_OF.update(SPEC_OF_FILE)
    ap = argparse.ArgumentParser(description="Generate MissionTwin synthetic data")
    ap.add_argument("--out", default=str(DATA_DIR))
    a = ap.parse_args()
    out = Gen(Path(a.out)).run()
    print(f"wrote synthetic data to {out}")


def generate(out: Path) -> Path:
    from .domain import SPEC_OF_FILE
    SPEC_OF.update(SPEC_OF_FILE)
    return Gen(Path(out)).run()


if __name__ == "__main__":
    main()
