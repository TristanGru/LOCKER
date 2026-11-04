"""Ingest: parse every mock file into provenance-tagged records. Read-only.

R10: each row / message / page is parsed on its own. A failure becomes an IngestIssue (file, loc, reason),
     is listed under NEEDS REVIEW and never reaches the engine. Ingest never aborts.
R11: timestamps must carry a zone; zone-less values are rejected per record.

Knowledge model: every record has `_known` (when MissionTwin could have known it). `Baseline.view(t)`
returns only what was known at time t. The scenario player advances t event by event.
"""
from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

import yaml

from . import BANNER
from .domain import (ALL_EICS, DATA_DIR, MONTHS, SCENARIO_NOW, SHIP_IDS, SHIPS, STATUS_SCORE, UTC, date_dt, hull_key,
                     parse_date, parse_dtg, parse_ts)
from .llm import LLMClient, build_name_index, extract_facts, surname_of
from .models import Contradiction, ExtractedFact, IngestIssue, SourceRef

NAME_TO_SHIP = {v["name"]: k for k, v in SHIPS.items()}

# ------------------------------------------------------------------ per-file row rules
FILE_RULES = {
    "csmp.csv": {"req": ["jcn", "eic", "status_code", "job_state", "as_of"], "ts": ["as_of"], "date": ["date_discovered", "date_deferred"]},
    "requisition_status.csv": {"req": ["doc_number", "niin", "status_code", "status_history", "as_of"], "ts": ["as_of"], "date": ["esd"]},
    "onboard_allowance_cosal.csv": {"req": ["niin", "item_type"], "ts": ["as_of"], "int": ["allowance_qty", "on_hand_qty", "due_in_qty"]},
    "roster.csv": {"req": ["member_id", "rate", "work_center", "onboard_status"], "ts": ["as_of"], "date": ["status_start", "status_end", "prd", "eaos"]},
    "quals.csv": {"req": ["member_id", "watchstation_code", "qual_status"], "ts": ["as_of"], "date": ["requal_due", "final_date", "interim_date"]},
    "watchbill.csv": {"req": ["date", "watchstation_code", "member_id"], "ts": ["as_of"], "date": ["date"]},
    "nec_billets.csv": {"req": ["billet_id", "nec_required"], "ts": ["as_of"], "date": ["holder_prd", "gap_start"]},
    "readiness_baseline.csv": {"req": ["mission_area", "rating", "mfom_index"], "ts": ["as_of"], "int": ["mfom_index"]},
    "training_readiness.csv": {"req": ["requirement_id", "mission_area", "expires"], "ts": ["as_of"], "date": ["expires", "last_completed", "scheduled_refresh"]},
    "schedule_30day.csv": {"req": ["block_id", "start_date", "end_date", "employment_code"], "ts": ["as_of"], "date": ["start_date", "end_date"]},
    "cert_status.csv": {"req": ["cert_id", "status"], "ts": ["as_of"], "date": ["certified_date", "expires", "planned_start"]},
    "availabilities.csv": {"req": ["avail_id", "planned_completion", "forecast_completion"], "ts": ["as_of"],
                           "date": ["planned_start", "planned_completion", "forecast_completion", "actual_completion"]},
    "sked_schedule.csv": {"req": ["eic", "mrc", "status", "sched_week_start"], "ts": ["as_of"], "date": ["sched_week_start", "status_date"]},
    "sked_loep.csv": {"req": ["mip", "eic"]},
    "insurv_findings.csv": {"req": ["eic"], "ts": ["as_of"]},
    "wholesale_stock.csv": {"req": ["niin", "holder"], "ts": ["as_of"], "int": ["on_hand_qty", "due_in_qty", "release_lead_days", "transit_days_conus"]},
    "fleet_onboard_stock.csv": {"req": ["niin", "ship_id"], "ts": ["as_of"], "int": ["storeroom_on_hand", "storeroom_allowance", "installed_qty"]},
    "ship_positions.csv": {"req": ["ship_id", "date", "status"], "date": ["date"]},
    "roc_poe_mission_map.csv": {"req": ["mission_area", "weight"]},
    "status_code_reference.csv": {"req": ["code", "delay_regime"]},
    "pii_redaction_test.csv": {"req": ["case_id"]},
}
PER_SHIP = ["csmp.csv", "requisition_status.csv", "onboard_allowance_cosal.csv", "roster.csv", "quals.csv", "watchbill.csv",
            "nec_billets.csv", "readiness_baseline.csv", "training_readiness.csv", "schedule_30day.csv", "cert_status.csv",
            "availabilities.csv", "sked_schedule.csv", "sked_loep.csv", "insurv_findings.csv"]
SQUAD = ["wholesale_stock.csv", "fleet_onboard_stock.csv", "ship_positions.csv", "roc_poe_mission_map.csv",
         "status_code_reference.csv", "pii_redaction_test.csv"]


def _check_row(fname: str, row: dict):
    rules = FILE_RULES.get(fname, {})
    for c in rules.get("req", []):
        if not (row.get(c) or "").strip():
            raise ValueError(f"required field '{c}' is empty")
    for c in rules.get("ts", []):
        if row.get(c):
            row[c] = parse_ts(row[c])
    for c in rules.get("date", []):
        if row.get(c):
            row[c] = parse_date(row[c])
        else:
            row[c] = None
    for c in rules.get("int", []):
        row[c] = int(row[c]) if row.get(c) not in (None, "") else 0
    if fname == "csmp.csv":
        if len(row["jcn"]) != 13:
            raise ValueError(f"JCN must be 13 chars, got {row['jcn']!r}")
        if row["status_code"] not in STATUS_SCORE:
            raise ValueError(f"unknown equipment status code {row['status_code']!r}")
        if row["eic"] not in ALL_EICS:
            raise ValueError(f"EIC {row['eic']!r} not in mission tree")
        row["type_avail"] = int(row["type_avail"] or 4)
    if fname == "requisition_status.csv":
        hist = []
        for ent in row["status_history"].split(";"):
            t, code, esd = ent.split(" ")
            hist.append((parse_ts(t), code, parse_date(esd) if esd != "-" else None))
        if not hist:
            raise ValueError("empty status_history")
        row["_history"] = hist
        row["expedite_flag"] = row.get("expedite_flag") == "true"
    for b in ("cross_deck_eligible", "cannibalize_eligible", "iem_flag", "corrected", "nors", "co_deferral_signed",
              "requires_engineering_validation"):
        if b in row:
            row[b] = row[b] == "true"


@dataclass
class Baseline:
    data_dir: Path
    rows: dict = field(default_factory=dict)  # (ship|"squadron", file) -> [row]
    messages: list = field(default_factory=list)  # parsed CASREP messages
    movements: list = field(default_factory=list)  # parsed MOVREP / LOGREQ
    docs: dict = field(default_factory=dict)  # rel -> {"ship", "known", "pages": [...]}
    facts: list = field(default_factory=list)
    issues: list = field(default_factory=list)
    params: dict = field(default_factory=dict)
    tree: dict = field(default_factory=dict)
    events: list = field(default_factory=list)
    feed: dict = field(default_factory=dict)
    catalog: list = field(default_factory=list)
    name_index: dict = field(default_factory=dict)
    expected_facts: dict = field(default_factory=dict)
    extraction_methods: dict = field(default_factory=dict)
    extraction_documents: dict = field(default_factory=dict)

    def r(self, ship: str, fname: str) -> list[dict]:
        return self.rows.get((ship, fname), [])

    def view(self, cursor: datetime) -> "View":
        return View(self, cursor)


# ------------------------------------------------------------------ CSV
def read_csv(b: Baseline, path: Path, rel: str, fname: str, owner: str) -> list[dict]:
    out = []
    try:
        text = path.read_text(encoding="utf-8")
    except Exception as e:
        b.issues.append(IngestIssue(file=rel, loc="file", reason=f"cannot read: {e}"))
        return out
    lines = text.splitlines()
    if not lines or not lines[0].startswith("#") or BANNER not in lines[0]:
        b.issues.append(IngestIssue(file=rel, loc="line 1", reason="missing SYNTHETIC banner line", kind="validation"))
        body = lines
        offset = 1
    else:
        body = lines[1:]
        offset = 2
    reader = csv.DictReader(body)
    for i, row in enumerate(reader):
        line_no = offset + 1 + i  # header is at `offset`
        try:
            if None in row:
                raise ValueError("row has more fields than the header")
            if any(v is None for v in row.values()):
                raise ValueError("row has fewer fields than the header")
            row = dict(row)
            _check_row(fname, row)
            key = row.get("jcn") or row.get("doc_number") or row.get("member_id") or row.get("billet_id") or \
                row.get("block_id") or row.get("cert_id") or row.get("avail_id") or row.get("requirement_id") or row.get("niin") or ""
            row["_src"] = SourceRef(file=rel, loc=f"row {line_no}", key=str(key))
            as_of = row.get("as_of")
            row["_known"] = as_of if isinstance(as_of, datetime) else SCENARIO_NOW - timedelta(hours=2)
            if fname == "requisition_status.csv":
                row["_known"] = row["_history"][0][0]
            if owner != "squadron" and "ship_id" in row and row["ship_id"] != owner:
                raise ValueError(f"ship_id {row['ship_id']} in {owner} folder")
            out.append(row)
        except Exception as e:
            b.issues.append(IngestIssue(file=rel, loc=f"row {line_no}", reason=str(e), kind="validation"))
    return out


# ------------------------------------------------------------------ messages
CAS_RE = re.compile(r"^CASUALTY/(INITIAL|UPDATE|CORRECT|CANCEL)/(.*)/CAT:(\d)/EIC:([A-Z0-9-]+)$")
EQ_RE = re.compile(r"^EQUIP/(.*)/APL:([^/]*)/JCN:([A-Z0-9]+)$")
PARTS_RE = re.compile(r"^PARTS/(\d+)/NSN:([\d-]+)/QTY:(\d+)/DOC:([A-Z0-9]+)/PD:(\d{2})/RDD:(\w+)$")


def _sets(text: str) -> tuple[list[tuple[int, str]], str]:
    lines = text.splitlines()
    if not lines or not lines[0].startswith("UNCLAS//SYNTHETIC"):
        raise ValueError("missing banner/classification line")
    fm = next((l[3:].strip() for l in lines if l.startswith("FM ")), "")
    sets, cur, start = [], None, 0
    in_body = False
    for n, line in enumerate(lines, 1):
        if line.strip() == "BT":
            in_body = not in_body
            continue
        if not in_body or line.startswith("UNCLAS //"):
            continue
        if cur is None:
            cur, start = line.strip(), n
        else:
            cur += "\n" + line.strip()
        if cur.endswith("//"):
            sets.append((start, cur[:-2]))
            cur = None
    if cur is not None:
        raise ValueError(f"unterminated set starting line {start}")
    return sets, fm


def parse_casrep(text: str, rel: str) -> dict:
    sets, fm = _sets(text)
    ship = NAME_TO_SHIP.get(fm)
    if not ship:
        raise ValueError(f"unknown originator {fm!r}")
    m = {"ship_id": ship, "file": rel, "parts": [], "assist": None, "etr": None, "ref": None, "lines": {}}
    for line_no, s in sets:
        tag = s.split("/", 1)[0]
        m["lines"][tag] = line_no
        if tag == "MSGID":
            p = s.split("/")
            m["serial"] = p[3]
        elif tag == "DTG":
            m["dtg"] = s[4:]
            m["time"] = parse_dtg(m["dtg"])
        elif tag == "REF":
            m["ref"] = s.split("/")[-1]
        elif tag == "CASUALTY":
            g = CAS_RE.match(s)
            if not g:
                raise ValueError(f"line {line_no}: bad CASUALTY set")
            m["type"], m["system_name"], m["category"], m["eic"] = g.group(1), g.group(2), int(g.group(3)), g.group(4)
            if m["eic"] not in ALL_EICS:
                raise ValueError(f"line {line_no}: EIC {m['eic']} not in mission tree")
        elif tag == "EQUIP":
            g = EQ_RE.match(s)
            if not g:
                raise ValueError(f"line {line_no}: bad EQUIP set")
            m["equipment"], m["apl"], jcn = g.groups()
            m["jcn"] = "" if jcn == "NONE" else jcn
        elif tag == "ESTIMATE":
            m["etr_dtg"] = s.split("ETR:")[1]
            m["etr"] = parse_dtg(m["etr_dtg"])
        elif tag == "ASSIST":
            if "REQ:YES" in s:
                kv = dict(x.split(":", 1) for x in s.split("/")[1:] if ":" in x)
                m["assist"] = {"type": kv.get("TYPE", ""), "org": kv.get("ORG", "")}
        elif tag == "PARTS":
            g = PARTS_RE.match(s)
            if not g:
                raise ValueError(f"line {line_no}: bad PARTS set")
            _, nsn, qty, doc, pd, rdd = g.groups()
            m["parts"].append({"nsn": nsn, "niin": nsn.replace("-", "")[4:], "qty": int(qty), "doc": doc, "pd": pd, "rdd": rdd})
        elif tag == "AMPN":
            m["ampn"] = s[5:]
        elif tag == "RMKS":
            m["rmks"] = s[5:]
    for req in ("serial", "dtg", "type", "eic"):
        if req not in m:
            raise ValueError(f"missing required set for {req}")
    if m["type"] != "INITIAL" and not m["ref"]:
        raise ValueError("UPDATE/CORRECT/CANCEL must reference the INITIAL DTG")
    init = parse_dtg(m["ref"]) if m["ref"] else m["time"]
    m["casrep_id"] = f"{hull_key(ship)}-{init.year % 100:02d}-{m['serial']}"
    m["_known"] = m["time"]
    m["_src"] = SourceRef(file=rel, loc=f"line {m['lines'].get('CASUALTY', 1)}", key=m["casrep_id"])
    return m


def parse_movement(text: str, rel: str) -> dict:
    sets, fm = _sets(text)
    ship = NAME_TO_SHIP.get(fm)
    if not ship:
        raise ValueError(f"unknown originator {fm!r}")
    m = {"ship_id": ship, "file": rel, "items": []}
    for line_no, s in sets:
        if s.startswith("MSGID/"):
            m["kind"] = s.split("/")[1]
        elif s.startswith("DTG/"):
            m["dtg"] = s[4:]
            m["time"] = parse_dtg(m["dtg"])
        else:
            for part in s.split("\n"):
                m["items"].append(part)
    if "time" not in m:
        raise ValueError("missing DTG set")
    for it in m["items"]:
        if g := re.search(r"ARRIVE (.+?) (\d{6}Z [A-Z]{3} \d{2})", it):
            m["arrive"] = {"place": g.group(1), "time": parse_dtg(g.group(2))}
        if g := re.search(r"DEPART (.+?) (\d{6}Z [A-Z]{3} \d{2})", it):
            m["depart"] = {"place": g.group(1), "time": parse_dtg(g.group(2))}
        if g := re.search(r"THROUGH (\d{6}Z [A-Z]{3} \d{2})", it):
            m["inport_through"] = parse_dtg(g.group(1))
    m["_known"] = m["time"]
    m["_src"] = SourceRef(file=rel, loc="line 1", key=m.get("dtg", ""))
    return m


# ------------------------------------------------------------------ PDFs
ASOF_RE = re.compile(r"As of: (\d{6}Z [A-Z]{3} \d{2})")


def read_pdf_pages(path: Path) -> list[str]:
    from pypdf import PdfReader
    return [p.extract_text() or "" for p in PdfReader(str(path)).pages]


def fact_date(s: str, ref: datetime) -> datetime:
    dd, mon = s.split()
    return datetime(ref.year, MONTHS.index(mon) + 1, int(dd), tzinfo=UTC)


# ------------------------------------------------------------------ load
def load_baseline(data_dir: Path = DATA_DIR, client: LLMClient | None = None) -> Baseline:
    data_dir = Path(data_dir)
    b = Baseline(data_dir=data_dir)
    client = client or LLMClient()
    for ship in SHIP_IDS:
        for fname in PER_SHIP:
            p = data_dir / ship / fname
            if p.exists():
                b.rows[(ship, fname)] = read_csv(b, p, f"{ship}/{fname}", fname, ship)
            else:
                b.issues.append(IngestIssue(file=f"{ship}/{fname}", loc="file", reason="file missing"))
        for p in sorted((data_dir / ship / "casrep_messages").glob("*.txt")):
            rel = f"{ship}/casrep_messages/{p.name}"
            try:
                b.messages.append(parse_casrep(p.read_text(encoding="utf-8"), rel))
            except Exception as e:
                b.issues.append(IngestIssue(file=rel, loc="message", reason=str(e)))
        for sub in ("movrep", "logreq"):
            for p in sorted((data_dir / ship / sub).glob("*.txt")):
                rel = f"{ship}/{sub}/{p.name}"
                try:
                    b.movements.append(parse_movement(p.read_text(encoding="utf-8"), rel))
                except Exception as e:
                    b.issues.append(IngestIssue(file=rel, loc="message", reason=str(e)))
    for fname in SQUAD:
        p = data_dir / "squadron" / fname
        if p.exists():
            b.rows[("squadron", fname)] = read_csv(b, p, f"squadron/{fname}", fname, "squadron")
    sq = data_dir / "squadron"

    def j(name):
        try:
            return json.loads((sq / name).read_text(encoding="utf-8"))
        except Exception as e:
            b.issues.append(IngestIssue(file=f"squadron/{name}", loc="file", reason=str(e)))
            return {}
    b.tree = j("mission_equipment_tree.json")
    b.events = j("events_missions.json").get("events", [])
    for ev in b.events:
        for k in ("start", "end"):
            ev[k] = parse_ts(ev[k]) if ev.get(k) else None
    b.feed = j("scenario_feed.json")
    for ev in b.feed.get("events", []):
        ev["known_at"] = parse_ts(ev["known_at"])
    b.catalog = j("data_catalog.json").get("datasets", [])
    b.expected_facts = j("daily_status_expected_facts.json").get("documents", {})
    if (sq / "casrep_expected_facts.json").exists():
        b.expected_facts.update(j("casrep_expected_facts.json").get("documents", {}))
    try:
        b.params = yaml.safe_load((sq / "delay_model_params.yaml").read_text(encoding="utf-8"))
    except Exception as e:
        b.issues.append(IngestIssue(file="squadron/delay_model_params.yaml", loc="file", reason=str(e)))
        from .domain import DEFAULT_PARAMS
        b.params = dict(DEFAULT_PARAMS)

    # names for redaction (never sent anywhere)
    roster_all = [r for s in SHIP_IDS for r in b.r(s, "roster.csv")]
    b.name_index = build_name_index(roster_all)
    client.forbidden_names = {surname_of(r["display_name"]) for r in roster_all if r.get("display_name")}

    # Standardized sets remain authoritative for the engine. Model facts provide separately
    # validated evidence, including AMPN/RMKS narratives, without duplicating casualties.
    for message in b.messages:
        rel = message["file"]
        text = (data_dir / rel).read_text(encoding="utf-8")
        b.docs[rel] = {"ship_id": message["ship_id"], "known": message["time"], "pages": [text], "document_type": "casrep"}
        facts, method = extract_facts(client, rel, message["ship_id"], text, 1, message["time"],
                                      b.name_index, document_type="casrep", casrep_id=message["casrep_id"])
        b.facts.extend(facts)
        b.extraction_methods[method] = b.extraction_methods.get(method, 0) + 1
        b.extraction_documents[rel] = {"document_type": "casrep", "methods": [method]}
        for fact in facts:
            if fact.status == "NEEDS_REVIEW":
                b.issues.append(IngestIssue(file=rel, loc=f"line {fact.line or 1}", reason=fact.reason, kind="extraction"))

    # daily reports
    for ship in SHIP_IDS:
        for p in sorted((data_dir / ship / "daily_reports").glob("*.pdf")):
            rel = f"{ship}/daily_reports/{p.name}"
            try:
                pages = read_pdf_pages(p)
                if not pages or BANNER not in pages[0]:
                    raise ValueError("missing SYNTHETIC banner")
                m = ASOF_RE.search(pages[0])
                if not m:
                    raise ValueError("no 'As of:' DTG in header")
                known = parse_dtg(m.group(1))
            except Exception as e:
                b.issues.append(IngestIssue(file=rel, loc="page 1", reason=str(e)))
                continue
            b.docs[rel] = {"ship_id": ship, "known": known, "pages": pages, "document_type": "daily_report"}
            b.extraction_documents[rel] = {"document_type": "daily_report", "methods": []}
            for pi, text in enumerate(pages, 1):
                facts, method = extract_facts(client, rel, ship, text, pi, known, b.name_index)
                b.extraction_methods[method] = b.extraction_methods.get(method, 0) + 1
                b.extraction_documents[rel]["methods"].append(method)
                for f in facts:
                    if f.status == "NEEDS_REVIEW":
                        b.issues.append(IngestIssue(file=rel, loc=f"page {pi}", reason=f"{f.reason}: {f.span[:80]}", kind="extraction"))
                b.facts.extend(facts)
    return b


# ====================================================================== the view at a point in time
class View:
    """Everything MissionTwin knew at `cursor`."""

    def __init__(self, b: Baseline, cursor: datetime):
        self.b = b
        self.now = cursor
        self.params = b.params

    def rows(self, ship: str, fname: str) -> list[dict]:
        return [r for r in self.b.r(ship, fname) if r["_known"] <= self.now]

    def squadron(self, fname: str) -> list[dict]:
        return [r for r in self.b.r("squadron", fname) if r["_known"] <= self.now]

    def requisitions(self, ship: str) -> list[dict]:
        out = []
        for r in self.b.r(ship, "requisition_status.csv"):
            hist = [h for h in r["_history"] if h[0] <= self.now]
            if not hist:
                continue
            v = dict(r)
            v["_history"] = hist
            v["status_time"], v["status_code"], v["esd"] = hist[-1]
            v["_as_of_effective"] = hist[-1][0]
            out.append(v)
        return out

    def casreps(self, ship: str) -> list[dict]:
        by: dict[str, dict] = {}
        for m in sorted([m for m in self.b.messages if m["ship_id"] == ship and m["_known"] <= self.now], key=lambda m: m["time"]):
            c = by.setdefault(m["casrep_id"], {"casrep_id": m["casrep_id"], "ship_id": ship, "messages": [], "etr_history": [],
                                               "state": "OPEN", "parts": [], "assist": None, "jcn": "", "initial_time": m["time"]})
            c["messages"].append(m)
            c["category"], c["eic"], c["equipment"] = m["category"], m["eic"], m.get("equipment", "")
            c["jcn"] = m.get("jcn") or c["jcn"]
            if m.get("parts"):
                c["parts"] = m["parts"]
            if m.get("assist"):
                c["assist"] = m["assist"]
            if m.get("etr"):
                c["etr_history"].append({"dtg": m["dtg"], "etr": m["etr"], "type": m["type"]})
            if m["type"] in ("CORRECT", "CANCEL"):
                c["state"] = "CLOSED"
            c["_src"] = m["_src"]
            c["initial_dtg"] = c["messages"][0]["dtg"]
        return list(by.values())

    def schedule(self, ship: str) -> list[dict]:
        known = self.rows(ship, "schedule_30day.csv")
        sup = {r["superseded_block_id"] for r in known if r.get("superseded_block_id")}
        return [r for r in known if r["block_id"] not in sup]

    def availabilities(self, ship: str) -> dict[str, dict]:
        out = {}
        for r in sorted(self.rows(ship, "availabilities.csv"), key=lambda r: r["as_of"]):
            out[r["avail_id"]] = r
        return out

    def facts(self, ship: str | None = None) -> list[ExtractedFact]:
        return [f for f in self.b.facts if (ship is None or f.ship_id == ship) and f.known_at <= self.now]

    def movements(self, ship: str) -> list[dict]:
        return [m for m in self.b.movements if m["ship_id"] == ship and m["_known"] <= self.now]

    def docs(self, ship: str) -> list[str]:
        return [k for k, v in self.b.docs.items() if v["ship_id"] == ship and v["known"] <= self.now]

    # -------------------------------------------------- staleness
    def effective_as_of(self, file: str) -> datetime | None:
        """Latest time this dataset was refreshed, as known at `now`."""
        owner, _, name = file.partition("/")
        if name.endswith("/"):
            if name == "daily_reports/":
                known = [v["known"] for k, v in self.b.docs.items() if v["ship_id"] == owner and v["known"] <= self.now]
                return max(known) if known else None
            return None  # message folders are event-driven; silence is not staleness
        rows = self.b.r(owner, name)
        known = [r["as_of"] for r in rows if isinstance(r.get("as_of"), datetime) and r["_known"] <= self.now]
        cat = next((c for c in self.b.catalog if c["file"] == file), None)
        if cat:
            try:
                extract = parse_ts(cat["as_of"])
                if extract <= self.now:
                    known.append(extract)  # the extract time of the file is the floor
            except Exception:
                pass
        return max(known) if known else None

    def stale_files(self, threshold_days: float | None = None) -> dict[str, dict]:
        out = {}
        for c in self.b.catalog:
            as_of = self.effective_as_of(c["file"])
            if as_of is None:
                continue
            thr = c.get("staleness_threshold_days", 5)
            if threshold_days is not None and c["file"].endswith(("roster.csv", "quals.csv", "csmp.csv")):
                thr = threshold_days  # the editable ledger value governs the core sources
            age = (self.now - as_of).total_seconds() / 86400
            if age > thr:
                out[c["file"]] = {"as_of": as_of.strftime("%Y-%m-%dT%H:%M:%SZ"), "age_days": round(age, 1), "threshold_days": thr}
        return out

    # -------------------------------------------------- corroboration of extracted facts (X4 and friends)
    def corroborate(self, f: ExtractedFact) -> tuple[str, str]:
        ship = f.ship_id
        if f.document_type == "casrep":
            if f.status == "NEEDS_REVIEW":
                return "n/a", "CASREP extraction failed evidence validation"
            return "corroborates", "Quoted CASREP set; standardized parser supplies the engine record"
        if f.type in ("personnel_transfer", "personnel_tad") and f.member_id:
            r = next((r for r in self.rows(ship, "roster.csv") if r["member_id"] == f.member_id), None)
            if r is None:
                return "contradicts", f"{f.member_id} not found in R-ADM roster"
            want = "TRANSFERRING" if f.type == "personnel_transfer" else "TAD"
            if r["onboard_status"] == want:
                return "corroborates", f"R-ADM roster shows {want}"
            return "contradicts", f"R-ADM roster (as of {r['as_of']:%d %b}) still shows {r['onboard_status']} for {f.member_id}"
        if f.type == "assist_eta":
            return "new_information", "No structured system carries the tech-assist date (CASREP ASSIST set has no ETA)"
        if f.type == "pms_lost":
            lost = [s for s in self.rows(ship, "sked_schedule.csv") if s["status"] == "LOST" and (s["eic"].startswith(f.value or "?"))]
            return ("corroborates", "SKED shows the check LOST") if lost else ("new_information", "SKED shows no LOST check")
        if f.type == "expedite_requested":
            reqs = [r for r in self.requisitions(ship) if r.get("casrep_id", "").endswith("-" + (f.value or ""))]
            if any(r["expedite_flag"] for r in reqs):
                return "corroborates", "Requisition expedite flag set"
            return "new_information", "No expedite flag on the requisition"
        if f.type == "casrep_reported":
            serial = (f.value or ":").split(":")[0]
            return ("corroborates", "CASREP message on file") if any(c["casrep_id"].endswith(serial) for c in self.casreps(ship)) \
                else ("new_information", "No CASREP message on file yet")
        if f.type == "training_scheduled":
            tr = [t for t in self.rows(ship, "training_readiness.csv") if t.get("scheduled_refresh")]
            return ("corroborates", "TORIS shows the refresh scheduled") if tr else ("new_information", "No refresh scheduled in TORIS")
        return "n/a", ""

    def facts_with_corroboration(self, ship: str | None = None) -> list[ExtractedFact]:
        out = []
        for f in self.facts(ship):
            c, note = self.corroborate(f)
            out.append(f.model_copy(update={"corroboration": c, "corroboration_note": note}))
        return out


# ====================================================================== contradictions X1..X10
def find_contradictions(v: View) -> list[Contradiction]:
    out: list[Contradiction] = []
    thr = v.params.get("staleness_threshold_days", {}).get("value", 5)
    for ship in SHIP_IDS:
        jobs = v.rows(ship, "csmp.csv")
        cas = [c for c in v.casreps(ship) if c["state"] == "OPEN"]
        reqs = v.requisitions(ship)
        # X1: CASREP DTG with no matching JCN
        for c in cas:
            dtg = c["initial_dtg"]
            if not any(j.get("casrep_dtg") == dtg and dtg in j.get("remarks", "") for j in jobs):
                out.append(Contradiction(id="X1", ship_id=ship, title=f"CASREP {c['casrep_id']} has no matching 2-Kilo",
                                         detail=f"No CSMP job carries DTG {dtg} in its remarks (the only documented CASREP-to-job link).",
                                         sources=[c["_src"]], severity="warn"))
        # X2: several open CASREPs tracing to one root NIIN
        by_niin: dict[str, list] = {}
        for c in cas:
            for p in c["parts"]:
                by_niin.setdefault(p["niin"], []).append(c)
        for niin, cs in by_niin.items():
            if len(cs) > 1:
                out.append(Contradiction(id="X2", ship_id=ship, title=f"{len(cs)} CASREPs trace to one part (NIIN {niin})",
                                         detail="Possible duplicate demand (Gridley pattern). Confirm with the ISEA before ordering twice.",
                                         sources=[c["_src"] for c in cs], severity="warn"))
        # X3: BA status whose ESD has passed with no newer status
        closed_jcns = {j["jcn"] for j in jobs if j["job_state"] in ("COMPLETED", "CANCELLED")}
        for r in reqs:
            if r["status_code"] == "BA" and r["esd"] and date_dt(r["esd"]) < v.now - timedelta(days=0) and r["jcn"] not in closed_jcns \
                    and r["status_time"].date() < r["esd"] and (v.now - date_dt(r["esd"])).days >= 3:
                out.append(Contradiction(id="X3", ship_id=ship, title=f"Requisition {r['doc_number']} past its ESD with no update",
                                         detail=f"Status BA, ESD {r['esd']:%d %b} has passed; last status {r['status_time']:%d %b}. Arrival is unknown.",
                                         sources=[r["_src"]], severity="info"))
        # X4: daily-report facts that no structured system carries
        for f in v.facts_with_corroboration(ship):
            if f.corroboration == "new_information" and f.type == "assist_eta":
                out.append(Contradiction(id="X4", ship_id=ship, title="Daily report carries information no system has",
                                         detail=f"\"{f.span}\" ({'hedged; unconfirmed' if f.hedged else 'stated'})",
                                         sources=[SourceRef(file=f.doc, loc=f"page {f.page}", span=f.span)], severity="warn"))
        # X5: a cross-deck source would drop below allowance while another ship needs the part
        for fs in v.squadron("fleet_onboard_stock.csv"):
            if fs["ship_id"] != ship or not fs["cross_deck_eligible"]:
                continue
            if fs["storeroom_on_hand"] <= fs["storeroom_allowance"]:
                needers = [s for s in SHIP_IDS if s != ship and any(
                    r["niin"] == fs["niin"] and r.get("casrep_id") and r["status_code"] != "BA" for r in v.requisitions(s))]
                if needers:
                    out.append(Contradiction(id="X5", ship_id=ship, title=f"Borrowing NIIN {fs['niin']} drops {ship} below allowance",
                                             detail=f"{', '.join(needers)} needs this part; {ship} holds {fs['storeroom_on_hand']} of allowance {fs['storeroom_allowance']}.",
                                             sources=[fs["_src"]], severity="info"))
        # X6: certification start invalidated by an availability slip
        avails = v.availabilities(ship)
        for cs in v.rows(ship, "cert_status.csv"):
            a = avails.get(cs.get("depends_on_avail_id") or "")
            if a and cs["planned_start"] and a["forecast_completion"] and cs["planned_start"] < a["forecast_completion"]:
                out.append(Contradiction(id="X6", ship_id=ship, title=f"{cs['cert_id']} planned start is before its availability ends",
                                         detail=f"Planned start {cs['planned_start']:%d %b}; {a['avail_id']} forecast completion {a['forecast_completion']:%d %b}.",
                                         sources=[cs["_src"], a["_src"]], severity="warn"))
        # X7: lost PMS (monthly or longer) with no 2-Kilo on that equipment
        for s in v.rows(ship, "sked_schedule.csv"):
            if s["status"] == "LOST" and s["periodicity"] not in ("D", "W", "R"):
                after = [j for j in jobs if j["eic"] == s["eic"] and j["date_discovered"] and j["date_discovered"] >= s["sched_week_start"]]
                if not after:
                    out.append(Contradiction(id="X7", ship_id=ship, title=f"Lost PMS on {s['eic']} with no 2-Kilo",
                                             detail=f"MRC {s['mrc']} week of {s['sched_week_start']:%d %b} not accomplished; no maintenance action opened since.",
                                             sources=[s["_src"]], severity="warn"))
        # X8: NEC held per ship's roster but FLTMPS shows nobody in the billet
        roster = v.rows(ship, "roster.csv")
        billets = v.rows(ship, "nec_billets.csv")
        holders = {b_["fltmps_holder_member_id"] for b_ in billets if b_["fltmps_holder_member_id"]}
        for b_ in billets:
            if b_["fltmps_holder_member_id"]:
                continue
            drift = [m for m in roster if m["work_center"] == b_["work_center"] and b_["nec_required"] in (m.get("necs") or "").split(";")
                     and m["member_id"] not in holders]
            for m in drift:
                out.append(Contradiction(id="X8", ship_id=ship, title=f"Ship and shore disagree on NEC {b_['nec_required']}",
                                         detail=f"R-ADM roster shows {m['member_id']} holds {b_['nec_required']}; FLTMPS shows billet {b_['billet_id']} gapped.",
                                         sources=[m["_src"], b_["_src"]], severity="info"))
        # X9: watchbill assigns someone not QUALIFIED/INTERIM
        qmap = {(q["member_id"], q["watchstation_code"]): q for q in v.rows(ship, "quals.csv")}
        for w in v.rows(ship, "watchbill.csv"):
            q = qmap.get((w["member_id"], w["watchstation_code"]))
            if not q or q["qual_status"] not in ("QUALIFIED", "INTERIM"):
                out.append(Contradiction(id="X9", ship_id=ship, title=f"Watchbill assigns {w['member_id']} to {w['watchstation_code']} unqualified",
                                         detail=f"{w['date']:%d %b} {w['watch_period']}: qual status {q['qual_status'] if q else 'none'} (SFTRM requires qualified or interim).",
                                         sources=[w["_src"]] + ([q["_src"]] if q else []), severity="high"))
    # X10: stale sources
    for f, info in v.stale_files(thr).items():
        ship = f.split("/")[0]
        out.append(Contradiction(id="X10", ship_id=ship if ship in SHIP_IDS else "SQUADRON", title=f"Stale data: {f}",
                                 detail=f"As of {info['as_of']} ({info['age_days']} days old; threshold {info['threshold_days']}).",
                                 sources=[SourceRef(file=f, loc="file")], severity="warn"))
    return out
