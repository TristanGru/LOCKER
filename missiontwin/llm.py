"""LLM wrapper: three bounded jobs, all optional.

(a) extract facts from free-text daily reports (span-verified), (b) plain English -> JSON Action,
(c) draft the readiness brief. The engine never takes a number from the LLM.

- OpenAI-compatible endpoint: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL. Any self-hosted server works
  (vLLM, Ollama, llama.cpp, a model on UDS). The AI engineer owns the model choice.
- R9 cache: key = sha256(task + PROMPT_VERSION + model + exact input bytes [+ extra]). cache/llm/<key>.json
- R5: hard timeout per call (brief/NL 15s, extraction 30s), 1 retry, then the offline fallback chain
  (cache -> rules extractor / action picker / template brief) with a visible badge.
  MISSIONTWIN_DEMO_MODE=1 forces cache-only.
- PII (spec 20): only de-identified text is sent. Names are replaced with member_id tokens before any
  prompt is built, and a guard refuses to send if a roster surname survives.

    python -m missiontwin.llm warm     # pre-fill the cache for the demo data (needs an endpoint)
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Callable, Optional

from pydantic import ValidationError

from .domain import CACHE_DIR, MONTHS
from datetime import datetime
from collections import Counter
from .models import ActionAdapter, ExtractedFact, LLMFactsOut, action_schema

PROMPT_VERSION = "2026-11-04.1"
TIMEOUTS = {"extract": 30.0, "nl_action": 15.0, "brief": 15.0}
FALLBACK_BADGE = "LLM unavailable, using fallback"
OFFLINE_BADGE = "Offline: no LLM endpoint configured"


class LLMUnavailable(Exception):
    pass


class LLMClient:
    def __init__(self, base_url: str | None = None, api_key: str | None = None, model: str | None = None,
                 cache_dir: Path = CACHE_DIR, demo_mode: bool | None = None, transport=None):
        self.base_url = (base_url if base_url is not None else os.environ.get("LLM_BASE_URL", "")).rstrip("/")
        self.api_key = api_key if api_key is not None else os.environ.get("LLM_API_KEY", "")
        self.model = model if model is not None else os.environ.get("LLM_MODEL", "unconfigured")
        self.cache_dir = Path(cache_dir)
        self.demo_mode = demo_mode if demo_mode is not None else os.environ.get("MISSIONTWIN_DEMO_MODE", "") == "1"
        self.transport = transport  # tests inject a fake httpx transport
        self.forbidden_names: set[str] = set()
        self.sent_prompts: list[str] = []  # audit trail of what actually left the process

    # ---------------------------------------------------------- status
    @property
    def configured(self) -> bool:
        return bool(self.base_url) and not self.demo_mode

    def status(self) -> dict:
        return {"configured": bool(self.base_url), "demo_mode": self.demo_mode, "model": self.model,
                "prompt_version": PROMPT_VERSION, "cache_entries": len(list(self.cache_dir.glob("*.json"))) if self.cache_dir.exists() else 0}

    # ---------------------------------------------------------- cache (R9)
    def cache_key(self, task: str, input_bytes: bytes, extra: str = "") -> str:
        h = hashlib.sha256()
        for part in (task, PROMPT_VERSION, self.model):
            h.update(part.encode() + b"\x00")
        h.update(input_bytes)
        h.update(b"\x00" + extra.encode())
        return h.hexdigest()

    def cache_get(self, key: str) -> Optional[dict]:
        p = self.cache_dir / f"{key}.json"
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))["output"]
            except Exception:
                return None
        return None

    def cache_put(self, key: str, task: str, input_bytes: bytes, output: dict):
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        rec = {"task": task, "prompt_version": PROMPT_VERSION, "model": self.model,
               "input_sha256": hashlib.sha256(input_bytes).hexdigest(), "output": output}
        (self.cache_dir / f"{key}.json").write_text(json.dumps(rec, indent=1), encoding="utf-8")

    # ---------------------------------------------------------- transport
    def _post(self, messages: list[dict], timeout: float) -> str:
        import httpx
        text = "\n".join(m["content"] for m in messages)
        pii_guard(text, self.forbidden_names)
        self.sent_prompts.append(text)
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body = {"model": self.model, "messages": messages, "temperature": 0, "response_format": {"type": "json_object"}}
        last = None
        for _ in range(2):  # 1 retry
            try:
                with httpx.Client(timeout=timeout, transport=self.transport) as c:
                    r = c.post(f"{self.base_url}/chat/completions", headers=headers, json=body)
                    r.raise_for_status()
                    return r.json()["choices"][0]["message"]["content"]
            except Exception as e:  # timeout, connection, HTTP, shape
                last = e
        raise LLMUnavailable(f"{type(last).__name__}: {last}")

    def run(self, task: str, messages: list[dict], input_bytes: bytes, validate: Callable[[dict], object],
            extra: str = "") -> tuple[object, str]:
        """Returns (validated_output, source) where source is 'cache' or 'llm'. Raises LLMUnavailable."""
        key = self.cache_key(task, input_bytes, extra)
        hit = self.cache_get(key)
        if hit is not None:
            try:
                return validate(hit), "cache"
            except (ValidationError, ValueError):
                pass
        if not self.configured:
            raise LLMUnavailable("not configured" if not self.base_url else "demo mode: cache only")
        raw = self._post(messages, TIMEOUTS[task])
        try:
            data = json.loads(raw)
            out = validate(data)
        except (json.JSONDecodeError, ValidationError, ValueError) as e:
            raise LLMUnavailable(f"invalid LLM output: {e}")
        self.cache_put(key, task, input_bytes, data)
        return out, "llm"

    def fallback_badge(self) -> str:
        return FALLBACK_BADGE if self.base_url else OFFLINE_BADGE


# ====================================================================== PII redaction (spec 20)
RANKS = r"(?:CAPT|CDR|LCDR|LTJG|LT|ENS|[A-Z]{2,4}(?:CS|SN|C|1|2|3)?)"
NAME_RE = re.compile(r"\b(" + RANKS + r")\s+([A-Z][a-zA-Z]{2,})\b")


def surname_of(display_name: str) -> str:
    # "FC1 RAMOS (SYNTH)" -> "RAMOS"
    parts = display_name.replace("(SYNTH)", "").split()
    return parts[-1].upper() if len(parts) >= 2 else ""


def build_name_index(roster_rows: list[dict]) -> dict:
    """ship -> {"by_rate": {(rate, SURNAME): member_id}, "by_surname": {SURNAME: [member_id,...]}}"""
    idx: dict = {}
    for r in roster_rows:
        s = idx.setdefault(r["ship_id"], {"by_rate": {}, "by_surname": {}})
        sur = surname_of(r.get("display_name", ""))
        if not sur:
            continue
        s["by_rate"][(r["rate"].upper(), sur)] = r["member_id"]
        s["by_surname"].setdefault(sur, []).append(r["member_id"])
    return idx


def redact(text: str, ship_id: str, name_index: dict) -> tuple[str, dict[str, str]]:
    """Replace '<rate> <Surname>' with '<rate> [M-xxxx]'. Returns (redacted, {token: original})."""
    s = name_index.get(ship_id, {"by_rate": {}, "by_surname": {}})
    mapping: dict[str, str] = {}

    def sub(m):
        rate, sur = m.group(1), m.group(2)
        mid = s["by_rate"].get((rate.upper(), sur.upper()))
        if mid is None:
            ids = s["by_surname"].get(sur.upper())
            if not ids:
                return m.group(0)
            mid = ids[0] if len(ids) == 1 else None
        tok = f"[{mid}]" if mid else "[NAME]"
        mapping[tok] = sur
        return f"{rate} {tok}"

    out = NAME_RE.sub(sub, text)
    # second pass: any bare surname of someone on this ship
    for sur, ids in s["by_surname"].items():
        if len(sur) < 4:
            continue
        pat = re.compile(r"\b" + re.escape(sur) + r"\b", re.IGNORECASE)
        if pat.search(out):
            tok = f"[{ids[0]}]" if len(ids) == 1 else "[NAME]"
            out = pat.sub(tok, out)
            mapping[tok] = sur
    return out, mapping


def pii_guard(text: str, forbidden: set[str]):
    for name in forbidden:
        if len(name) >= 3 and re.search(r"\b" + re.escape(name) + r"\b", text, re.IGNORECASE):
            raise LLMUnavailable("PII guard: a roster name survived redaction; prompt not sent")


# ====================================================================== job (a): extraction
EXTRACT_SYSTEM = (
    "You extract facts from a SYNTHETIC Navy shipboard daily report. People are already replaced by tokens "
    "like [M-0007]. Return JSON {\"facts\": [...]} where each fact has: type (one of personnel_transfer, "
    "personnel_tad, assist_eta, expedite_requested, pms_lost, casrep_reported, training_scheduled, other), "
    "member_token (e.g. M-0007 or null), date (DD MON or null), until (DD MON or null), value, span, hedged. "
    "span MUST be the exact sentence copied character for character from the document. "
    "hedged is true when the sentence is uncertain (may, believes, expected). Do not invent facts."
)


def extraction_messages(redacted_text: str) -> list[dict]:
    return [{"role": "system", "content": EXTRACT_SYSTEM}, {"role": "user", "content": redacted_text}]


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


RULES = [
    ("personnel_transfer", re.compile(r"[A-Z]{2,4}\d? \[(M-\d{4})\] detaches (\d{2} [A-Z]{3})")),
    ("personnel_tad", re.compile(r"[A-Z]{2,4}\d? \[(M-\d{4})\] departs TAD .*? (\d{2} [A-Z]{3}), returns (\d{2} [A-Z]{3})")),
    ("assist_eta", re.compile(r"tech rep visit may slip to (\d{2} [A-Z]{3})")),
    ("expedite_requested", re.compile(r"Expedite requested on CASREP (\d{3})")),
    ("pms_lost", re.compile(r"(CIWS|SPY-1D): PMS check .* not completed \(lost\)")),
    ("casrep_reported", re.compile(r"CASREP (\d{3}) \(CAT (\d)\) submitted")),
    ("training_scheduled", re.compile(r"trainer due before COMPTUEX; scheduled (\d{2} [A-Z]{3})")),
]
HEDGE_RE = re.compile(r"\b(may|believes|expected|possibly|might|likely)\b", re.IGNORECASE)


def rules_extract(redacted_text: str) -> list[dict]:
    """Deterministic fallback extractor. Labeled method='rules' in the UI. Patterns cover the synthetic report format."""
    out = []
    for line in redacted_text.splitlines():
        sent = norm(line.lstrip(" -"))
        if not sent:
            continue
        for typ, rx in RULES:
            m = rx.search(sent)
            if not m:
                continue
            f = {"type": typ, "member_token": None, "date": None, "until": None, "value": None, "span": sent,
                 "hedged": bool(HEDGE_RE.search(sent))}
            g = m.groups()
            if typ == "personnel_transfer":
                f["member_token"], f["date"] = g
            elif typ == "personnel_tad":
                f["member_token"], f["date"], f["until"] = g
            elif typ in ("assist_eta", "training_scheduled"):
                f["date"] = g[0]
            elif typ in ("expedite_requested",):
                f["value"] = g[0]
            elif typ == "pms_lost":
                f["value"] = {"CIWS": "CIWS", "SPY-1D": "SPY1D"}[g[0]]
            elif typ == "casrep_reported":
                f["value"] = f"{g[0]}:{g[1]}"
            out.append(f)
    return out


def extract_facts(client: LLMClient, doc_rel: str, ship_id: str, page_text: str, page: int, known_at,
                  name_index: dict) -> tuple[list[ExtractedFact], str]:
    """Returns (facts, method). Every accepted fact's span must appear verbatim in the (redacted) page."""
    red, _ = redact(page_text, ship_id, name_index)
    hay = norm(red)
    try:
        out, src = client.run("extract", extraction_messages(red), red.encode("utf-8"),
                              lambda d: LLMFactsOut.model_validate(d))
        raw = [f.model_dump() for f in out.facts]
        method = src
    except LLMUnavailable:
        raw = rules_extract(red)
        method = "rules"
    facts = []
    for i, f in enumerate(raw):
        span_ok = bool(norm(f['span'])) and norm(f['span']) in hay
        f['hedged'] = bool(f.get('hedged') or HEDGE_RE.search(f['span']))
        status = "VERIFIED"
        reason = ""
        if not span_ok:
            status, reason = "NEEDS_REVIEW", "quoted span not found verbatim in the document"
        elif f.get("hedged"):
            status, reason = "UNCONFIRMED", "hedged language; captain must confirm before it feeds the forecast"
        mtok = f.get("member_token")
        if mtok:
            mtok = mtok.strip("[]")
            if not re.fullmatch(r"M-\d{4}", mtok):
                status, reason = "NEEDS_REVIEW", "person could not be resolved to a member_id"
                mtok = None
        try:
            for key in ('date', 'until'):
                if f.get(key):
                    dd, mon = f[key].split()
                    datetime(known_at.year, MONTHS.index(mon) + 1, int(dd))
                    if f[key] not in norm(f['span']):
                        raise ValueError('Extracted date does not occur in quoted evidence')
            if f['type'] in ('personnel_transfer', 'personnel_tad'):
                ids = set(name_index.get(ship_id, {}).get('by_rate', {}).values())
                if not f.get('date') or not mtok or mtok not in ids or mtok not in f['span']:
                    raise ValueError('Personnel date/member not supported by quoted evidence')
            if f['type'] == 'assist_eta' and not f.get('date'):
                raise ValueError('Assist ETA requires a supported date')
        except (ValueError, TypeError):
            status, reason = 'NEEDS_REVIEW', 'Extracted fields do not match valid dates/member evidence'
        try:
            facts.append(ExtractedFact(
                fact_id=hashlib.sha1(f"{doc_rel}|{page}|{i}|{f['span']}".encode()).hexdigest()[:12],
                doc=doc_rel, page=page, type=f["type"], ship_id=ship_id, member_id=mtok, date=f.get("date"),
                until=f.get("until"), value=f.get("value"), span=norm(f["span"]), hedged=bool(f.get("hedged")),
                method=method, status=status, reason=reason, known_at=known_at))
        except ValidationError as e:
            facts.append(ExtractedFact(fact_id=f"bad-{i}", doc=doc_rel, page=page, type="other", ship_id=ship_id,
                                       span=norm(str(f.get("span", ""))), method=method, status="NEEDS_REVIEW",
                                       reason=f"failed validation: {e.errors()[0]['msg']}", known_at=known_at))
    return facts, method


# ====================================================================== job (b): plain English -> Action
def nl_messages(text: str, context: dict) -> list[dict]:
    sys_msg = ("Turn the captain's request into ONE JSON action matching this JSON Schema. "
               "Use only ids that appear in the context. Times are ISO 8601 with Z. "
               "If the request cannot be expressed, return {\"type\": \"none\"}.\nSCHEMA:\n" + json.dumps(action_schema()))
    return [{"role": "system", "content": sys_msg},
            {"role": "user", "content": "CONTEXT:\n" + json.dumps(context) + "\nREQUEST:\n" + text}]


def nl_to_action(client: LLMClient, text: str, context: dict):
    """Returns (action or None, source, badge). The action is only proposed; the user confirms before it runs."""
    try:
        act, src = client.run("nl_action", nl_messages(text, context), text.encode("utf-8"),
                              lambda d: ActionAdapter.validate_python(d), extra=json.dumps(context, sort_keys=True))
        return act, src, None
    except LLMUnavailable:
        return None, "fallback", client.fallback_badge()


# ====================================================================== job (c): brief
def brief_messages(context: dict, draft: str) -> list[dict]:
    sys_msg = ("Rewrite this SYNTHETIC readiness brief for a destroyer captain in plain, direct language. "
               "Keep every number exactly as given. Keep every citation marker like [3] attached to the claim it supports. "
               "Do not add facts. Return JSON {\"text\": \"...\"}.")
    return [{"role": "system", "content": sys_msg},
            {"role": "user", "content": "CONTEXT:\n" + json.dumps(context) + "\nDRAFT:\n" + draft}]


def llm_brief(client: LLMClient, context: dict, draft: str, n_citations: int, scenario_key: str):
    def validate(d):
        t = d.get('text')
        if not isinstance(t, str):
            raise ValueError('Brief text must be a string')
        numbers = lambda text: Counter(re.findall(r'\d+(?:\.\d+)?', text))
        if numbers(t) != numbers(draft) or Counter(re.findall(r'\[\d+\]', t)) != Counter(re.findall(r'\[\d+\]', draft)):
            raise ValueError('Brief rewrite changed numbers or citation markers')
        refs = [int(x) for x in re.findall(r"\[(\d+)\]", t)]
        if any(r < 1 or r > n_citations for r in refs):
            raise ValueError("citation out of range")
        return t
    try:
        text, src = client.run("brief", brief_messages(context, draft), draft.encode("utf-8"), validate, extra=scenario_key)
        return text, src, None
    except LLMUnavailable:
        return draft, "template", client.fallback_badge()


# ====================================================================== warm-up CLI
def warm():
    from .ingest import load_baseline
    c = LLMClient()
    if not c.base_url:
        print("LLM_BASE_URL is not set; nothing to warm. The demo runs on the rules extractor and template brief.")
        return 1
    b = load_baseline(client=c)
    methods = {}
    for f in b.facts:
        methods[f.method] = methods.get(f.method, 0) + 1
    print(f"extraction done: {methods}; cache entries: {c.status()['cache_entries']}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "warm":
        sys.exit(warm())
    print(__doc__)
