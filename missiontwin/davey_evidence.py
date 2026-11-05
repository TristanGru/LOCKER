"""Exercise-time-safe, question-specific evidence retrieval for Ask Davey."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, replace
from datetime import datetime

from .ingest import View
from .llm import casrep_sets, redact


_TOKEN = re.compile(r"[A-Za-z0-9]+")
_BULLET = re.compile(r"^\s*-\s+")
_STOP = frozenset({"a", "an", "and", "are", "at", "be", "by", "can", "do", "for", "from", "how", "in", "is", "it", "of", "on", "or", "the", "this", "to", "what", "which", "with"})


@dataclass(frozen=True)
class Evidence:
    id: str
    ship_id: str
    source_revision: str
    file: str
    loc: str
    excerpt: str
    known_at: str
    kind: str
    record_key: str
    entities: tuple[str, ...]
    hedged: bool = False
    superseded: bool = False
    fact_annotations: tuple[dict, ...] = ()

    def public(self) -> dict:
        return {"id": self.id, "ship_id": self.ship_id, "source_revision": self.source_revision,
                "file": self.file, "loc": self.loc,
                "excerpt": self.excerpt, "known_at": self.known_at, "kind": self.kind,
                "record_key": self.record_key, "hedged": self.hedged,
                "superseded": self.superseded,
                "fact_annotations": list(self.fact_annotations)}


def _iso(value: datetime | str) -> str:
    return value.isoformat() if isinstance(value, datetime) else str(value)


def _make(revision: str, ship: str, file: str, loc: str, text: str, known: datetime,
          kind: str, key: str, entities: tuple[str, ...], name_index: dict,
          superseded: bool = False) -> Evidence:
    clean, _ = redact(text.strip(), ship, name_index)
    digest = hashlib.sha256("\0".join((revision, file, loc, clean)).encode()).hexdigest()[:20]
    return Evidence(id="ev:" + digest, ship_id=ship, source_revision=revision,
                    file=file, loc=loc, excerpt=clean,
                    known_at=_iso(known), kind=kind, record_key=key,
                    entities=tuple(x for x in entities if x),
                    hedged=bool(re.search(r"\b(may|might|believes|possibly|expected|unconfirmed)\b", clean, re.I)),
                    superseded=superseded)


def _daily_bullets(page: str):
    """Keep each report bullet together with any wrapped continuation lines."""
    current: list[str] = []
    start = 0
    for line_no, line in enumerate(page.splitlines(), start=1):
        if _BULLET.match(line):
            if current:
                yield start, " ".join(current)
            start = line_no
            current = [_BULLET.sub("", line).strip()]
        elif current and line.strip() and line[:1].isspace() and not line.strip().isupper():
            current.append(line.strip())
        elif current and (not line.strip() or line.strip().isupper()):
            yield start, " ".join(current)
            current = []
    if current:
        yield start, " ".join(current)


def build_corpus(view: View, ship_id: str, revision: str) -> tuple[Evidence, ...]:
    """Copy only currently eligible source text; never serialize raw source rows."""
    b = view.b
    out: list[Evidence] = []
    names = b.name_index

    # These projections intentionally exclude raw status_history, which can contain
    # future entries even when View.requisitions has selected the current status.
    for row in view.requisitions(ship_id):
        fields = ("doc_number", "jcn", "casrep_id", "niin", "nomenclature", "status_code",
                  "esd", "delay_regime", "expedite_flag")
        content = "; ".join(f"{name}: {row[name]}" for name in fields if row.get(name) not in (None, ""))
        src = row["_src"]
        known = row.get("_as_of_effective") or row["_known"]
        out.append(_make(revision, ship_id, src.file, src.loc, content, known, "requisition",
                         str(row["doc_number"]), tuple(str(row.get(k) or "") for k in ("doc_number", "jcn", "casrep_id", "niin")), names))

    for row in view.rows(ship_id, "csmp.csv"):
        if row.get("job_state") in {"CANCELLED", "COMPLETED"}:
            continue
        fields = ("jcn", "casrep_id", "eic", "equipment_noun", "job_state", "status_code",
                  "req_doc_numbers", "remarks")
        content = "; ".join(f"{name}: {row[name]}" for name in fields if row.get(name) not in (None, ""))
        src = row["_src"]
        out.append(_make(revision, ship_id, src.file, src.loc, content, row["_known"],
                         "maintenance", str(row["jcn"]), tuple(str(row.get(k) or "") for k in ("jcn", "casrep_id", "eic", "req_doc_numbers")), names))

    messages = {m["file"]: m for m in b.messages if m["ship_id"] == ship_id and m["_known"] <= view.now}
    latest_by_casrep = {}
    for message in messages.values():
        prior = latest_by_casrep.get(message["casrep_id"])
        if prior is None or message["_known"] > prior["_known"]:
            latest_by_casrep[message["casrep_id"]] = message
    for file in sorted(view.docs(ship_id)):
        doc = b.docs[file]
        if doc["document_type"] == "casrep":
            message = messages.get(file)
            if not message:
                continue
            entities = tuple(str(message.get(k) or "") for k in ("casrep_id", "jcn", "eic", "serial"))
            superseded = latest_by_casrep[message["casrep_id"]]["file"] != file
            for page_no, page in enumerate(doc["pages"], start=1):
                for line, span in casrep_sets(page):
                    out.append(_make(revision, ship_id, file, f"page {page_no}, line {line}", span,
                                     doc["known"], "casrep", message["casrep_id"], entities, names,
                                     superseded=superseded))
        elif doc["document_type"] == "daily_report":
            for page_no, page in enumerate(doc["pages"], start=1):
                for line, span in _daily_bullets(page):
                    out.append(_make(revision, ship_id, file, f"page {page_no}, line {line}", span,
                                     doc["known"], "daily_report", file.rsplit("/", 1)[-1], (), names))

    # Attach parser status to the cited source span instead of presenting a
    # second, duplicate excerpt as independent corroboration.
    facts_by_file: dict[str, list] = {}
    for fact in view.facts_with_corroboration(ship_id):
        facts_by_file.setdefault(fact.doc, []).append(fact)
    for index, item in enumerate(out):
        if item.kind not in {"casrep", "daily_report"}:
            continue
        excerpt = re.sub(r"\s+", " ", item.excerpt).casefold()
        annotations = []
        for fact in facts_by_file.get(item.file, ()):
            span = re.sub(r"\s+", " ", fact.span).casefold()
            if span and span in excerpt:
                annotations.append({"type": fact.type, "status": fact.status,
                                    "corroboration": fact.corroboration, "hedged": fact.hedged})
        if annotations:
            out[index] = replace(item, fact_annotations=tuple(annotations))
    return tuple(out)


def _tokens(value: str) -> set[str]:
    return {part.lower() for part in _TOKEN.findall(value) if len(part) > 1 and part.lower() not in _STOP}


def retrieve(corpus: tuple[Evidence, ...], question: str, mission: dict, linked_files: set[str],
             limit: int = 12, max_chars: int = 12000) -> tuple[list[Evidence], dict]:
    """Exact IDs first, then lexical matches; no similarity score is a truth claim."""
    query = _tokens(question + " " + mission.get("codename", "") + " " + mission.get("name", ""))
    history_request = bool(_tokens(question) & {"changed", "earlier", "history", "original", "previous"})
    part_request = bool(query & {"part", "parts", "repair", "pump", "casrep", "supply", "delay", "delayed"})
    if part_request:
        query.update({"assist", "assistance", "tech", "rep", "representative", "supply", "pump", "repair", "cooling"})
    anchors = set()
    for gate in mission.get("gates", []):
        if gate["kind"] == "system" and (gate.get("p_ok") is None or gate["p_ok"] < 0.85):
            anchors.update(_tokens(gate["label"]))
            for item in gate.get("items", []):
                anchors.update(_tokens(item.get("title", "")))
                anchors.update(_tokens(item.get("key", "")))
    query.update(anchors)
    identifiers = {x.lower() for x in _TOKEN.findall(question) if any(c.isdigit() for c in x) and len(x) >= 3}

    def score(e: Evidence) -> tuple[float, str]:
        body = e.excerpt.lower()
        words = _tokens(e.excerpt + " " + " ".join(e.entities))
        overlap = len(words & query)
        exact = sum(1 for identifier in identifiers if identifier in body or any(identifier in x.lower() for x in e.entities))
        linked = e.file in linked_files
        value = exact * 12 + overlap * 2 + (5 if linked else 0)
        if e.kind == "daily_report" and part_request and words & {"assist", "tech", "rep", "representative"}:
            value += 7
        if e.kind == "casrep" and part_request and body.startswith("assist/"):
            value += 7
        if e.kind == "requisition" and part_request:
            value += 3
        if e.superseded and not history_request:
            value -= 12
        return value, e.known_at

    ranked = sorted(corpus, key=score, reverse=True)
    chosen: list[Evidence] = []
    chars = 0
    limited = False
    per_file: dict[str, int] = {}
    seen_excerpts: set[str] = set()
    # Recent narrative can identify an emerging concern absent from the graph.
    # Reserve room for it before maintenance rows and repeated CASREP sets fill
    # the packet; retrieval is still ranked by the submitted question.
    narrative = [e for e in ranked if e.kind == "daily_report" and score(e)[0] > 0][:3]
    for item in [*narrative, *ranked]:
        value, _ = score(item)
        if value <= 0:
            continue
        normalized = re.sub(r"\s+", " ", item.excerpt).casefold()
        if normalized in seen_excerpts:
            continue
        if per_file.get(item.file, 0) >= 4 or len(chosen) >= limit or chars + len(item.excerpt) > max_chars:
            limited = True
            continue
        chosen.append(item)
        seen_excerpts.add(normalized)
        chars += len(item.excerpt)
        per_file[item.file] = per_file.get(item.file, 0) + 1
    return chosen, {"searched": len(corpus), "returned": len(chosen),
                    "truncated": limited,
                    "mode": "exact + lexical", "scope": mission["ship_id"]}
