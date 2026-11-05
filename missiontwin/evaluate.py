"""Evaluate extraction against the synthetic daily-report and CASREP oracles.

    python -m missiontwin.evaluate --rules
    python -m missiontwin.evaluate --offline --require-cache

Live mode uses .env and fails on rules fallback. Offline mode never sends requests.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path

from .domain import CACHE_DIR, DATA_DIR, parse_ts
from .ingest import load_baseline
from .llm import LLMClient, norm, redact


def expected_fact(raw: dict, ship_id: str, name_index: dict) -> dict:
    """Normalize the independently authored fixture contract to the public fact fields."""
    f = dict(raw)
    f["span"], _ = redact(f["span"], ship_id, name_index)
    if "name_token" in f:
        f["member_id"] = name_index[ship_id]["by_rate"][(f["rate"].upper(), f["name_token"].upper())]
    if f["type"] == "casrep_reported":
        f["value"] = f"{f['casrep_serial']}:{f['category']}"
        f.pop("category")  # Daily reports encode this pair in value; CASREP sets have typed fields.
    elif f["type"] == "expedite_requested":
        f["value"] = f["casrep_serial"]
    elif f["type"] == "pms_lost":
        f["value"] = f["system"]
    elif f["type"] == "training_scheduled":
        f["value"] = f["event"]  # the event named in the report, as written; ingest resolves it to an event
    return f


def signature(f: dict) -> str:
    fields = ("type", "member_id", "date", "until", "value", "eic", "category", "report_type",
              "timestamp", "doc_number", "niin", "quantity")
    out = {key: f.get(key) for key in fields}
    if out["timestamp"]:
        out["timestamp"] = parse_ts(str(out["timestamp"])).isoformat()
    out.update(span=norm(f["span"]), hedged=bool(f.get("hedged")))
    return json.dumps(out, sort_keys=True)


def evaluate_extraction(baseline, *, require_model: bool = False, require_cache: bool = False) -> dict:
    docs = []
    totals = Counter()
    actual_by_doc = {}
    for fact in baseline.facts:
        actual_by_doc.setdefault(fact.doc, []).append(fact)
    all_docs = set(baseline.expected_facts) | set(baseline.extraction_documents)
    for path in sorted(all_docs):
        oracle = baseline.expected_facts.get(path)
        record = baseline.extraction_documents.get(path, {})
        actual = actual_by_doc.get(path, [])
        expected = Counter(signature(expected_fact(f, oracle["ship_id"], baseline.name_index))
                           for f in oracle["facts"]) if oracle else Counter()
        got = Counter(signature(f.model_dump(mode="json")) for f in actual if f.status != "NEEDS_REVIEW")
        matches = sum((expected & got).values())
        missing, unexpected = sum((expected - got).values()), sum((got - expected).values())
        invalid = sum(f.status == "NEEDS_REVIEW" for f in actual)
        methods = record.get("methods", [])
        source_ok = bool(methods)
        if require_cache:
            source_ok = source_ok and all(m == "cache" for m in methods)
        elif require_model:
            source_ok = source_ok and all(m in ("llm", "cache") for m in methods)
        passed = oracle is not None and source_ok and not (missing or unexpected or invalid)
        docs.append({"document": path, "document_type": record.get("document_type"), "methods": methods,
                     "passed": passed, "expected": sum(expected.values()), "matched": matches,
                     "missing": missing, "unexpected": unexpected, "invalid": invalid,
                     "has_oracle": oracle is not None, "source_ok": source_ok})
        totals.update(expected=sum(expected.values()), actual=len(actual), matched=matches,
                      missing=missing, unexpected=unexpected, invalid=invalid)
    return {"passed": bool(docs) and all(d["passed"] for d in docs),
            "documents": docs, "document_count": len(docs), "source_counts": baseline.extraction_methods,
            "totals": dict(totals),
            "precision": totals["matched"] / totals["actual"] if totals["actual"] else float(not totals["expected"]),
            "recall": totals["matched"] / totals["expected"] if totals["expected"] else 1.0,
            "require_model": require_model, "require_cache": require_cache}


def run_evaluation(client: LLMClient, data_dir: Path = DATA_DIR, *, require_model=False, require_cache=False) -> dict:
    baseline = load_baseline(data_dir, client)
    result = evaluate_extraction(baseline, require_model=require_model, require_cache=require_cache)
    result["model"] = client.model
    result["cache_entries"] = client.status()["cache_entries"]
    return result


def report_result(result: dict, report: Path | None = None) -> int:
    output = json.dumps(result, indent=2)
    if report:
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(output + "\n", encoding="utf-8")
    print(output)
    return 0 if result["passed"] else 1


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--rules", action="store_true", help="Evaluate deterministic fallback only; not a model evaluation")
    modes.add_argument("--offline", action="store_true", help="Never contact the endpoint")
    parser.add_argument("--require-cache", action="store_true", help="Fail if any document falls back to rules")
    parser.add_argument("--refresh", action="store_true", help="Bypass existing cache entries and request fresh model responses")
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--cache-dir", type=Path, default=CACHE_DIR)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args(argv)
    if args.refresh and (args.offline or args.rules):
        parser.error("--refresh requires live mode")
    client = LLMClient(cache_dir=args.cache_dir, demo_mode=True if args.offline or args.rules else None)
    client.refresh = args.refresh
    if args.rules:
        client.model, client.base_url = "rules-evaluation", ""
    if not (args.rules or args.offline) and (not client.configured or client.model in ("", "unconfigured")):
        parser.error("Set LLM_BASE_URL and LLM_MODEL in .env and MISSIONTWIN_DEMO_MODE=0, or use --offline/--rules")
    result = run_evaluation(client, args.data_dir, require_model=not args.rules,
                            require_cache=args.require_cache or args.offline)
    return report_result(result, args.report)


if __name__ == "__main__":
    raise SystemExit(main())
