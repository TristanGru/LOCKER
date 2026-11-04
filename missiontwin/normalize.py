import argparse
import csv
import hashlib
import io
import json
from pathlib import Path

from . import BANNER
from .domain import ALL_EICS, AREAS, ROOT, SHIP_IDS, SYSTEMS, parse_ts


REFERENCE_ROOT = ROOT / "data_sources" / "Synthetic Data"
NORMALIZED_ROOT = ROOT / "data" / "normalized"


def checksum_matches(path: Path, expected: str) -> bool:
    original = path.read_bytes()
    candidates = [original]
    if path.suffix in {".csv", ".json", ".txt", ".yaml"}:
        normalized = original.replace(b"\r\n", b"\n")
        candidates.extend([normalized, normalized.replace(b"\n", b"\r\n")])
        if path.suffix == ".csv" and b"\n" in normalized:
            banner, body = normalized.split(b"\n", 1)
            candidates.append(banner + b"\n" + body.replace(b"\n", b"\r\n"))
    return any(hashlib.sha256(candidate).hexdigest() == expected for candidate in candidates)


def normalize(source: Path = REFERENCE_ROOT, output: Path = NORMALIZED_ROOT):
    source, output = source.resolve(), output.resolve()
    if output == source or source in output.parents:
        raise ValueError("Normalized output must not overwrite the reference package")
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    records, datasets, quarantine = [], [], []
    for entry in manifest["files"]:
        relative = entry["file"]
        path = (source / relative).resolve()
        if source not in path.parents:
            raise ValueError("Manifest path outside reference package")
        if not checksum_matches(path, entry["sha256"]):
            raise ValueError(f"Checksum mismatch: {relative}")
        if relative.startswith("validation/"):
            continue
        datasets.append({"file": relative, "sha256": entry["sha256"], "record_count": entry["record_count"]})
        if path.suffix != ".csv":
            continue
        lines = path.read_text(encoding="utf-8").splitlines()
        if not lines or BANNER not in lines[0]:
            raise ValueError(f"Missing synthetic marking: {relative}")
        for position, row in enumerate(csv.DictReader(io.StringIO("\n".join(lines[1:]))), 3):
            issues = []
            if row.get("ship_id") and row["ship_id"] not in SHIP_IDS:
                issues.append("Unknown ship identity")
            if row.get("eic") and row["eic"] not in ALL_EICS:
                issues.append(f"Unmapped equipment identity: {row['eic']}")
            if row.get("mission_area") and row["mission_area"] not in AREAS:
                issues.append("Mission area outside canonical five-area model")
            known = row.get("known_at") or row.get("as_of")
            if known:
                try:
                    parse_ts(known)
                except ValueError:
                    issues.append("Invalid knowledge timestamp")
            normalized = {**row}
            if path.name == "requisition_status.csv":
                history = []
                for item in row.get("status_history", "").split(";"):
                    if ":" not in item:
                        issues.append("Unrecognized requisition history")
                        continue
                    effective_date, status = item.split(":", 1)
                    history.append({"date": effective_date, "status": status})
                normalized["status_history_records"] = history
                issues.append("Date-only history lacks intraday knowledge times and historical ESDs")
            if path.name == "watchbill.csv" and not row.get("member_id"):
                normalized["assignment_state"] = "UNFILLED"
            record = {"source": {"file": relative, "loc": f"row {position}", "profile": "reference"},
                "known_at": known, "record": normalized, "review_reasons": issues,
                "forecast_eligible": False}
            records.append(record)
            if issues:
                quarantine.append({"source": record["source"], "reasons": issues})
    reference_tree = json.loads((source / "squadron/mission_equipment_tree.json").read_text(encoding="utf-8"))
    reference_systems = {system["eic"] for mission in reference_tree["missions"] for task in mission["tasks"]
                         for area in task["functional_areas"] for system in area["systems"]}
    report = {"_banner": BANNER, "profile": "reference", "activation": "REVIEW_ONLY",
        "reason": "This is a separate exercise, not additional evidence for the active scenario. No automatic identity equivalence or cross-scenario merge.",
        "source": "data_sources/Synthetic Data", "canonical_source": "data/synthetic",
        "canonical_areas": list(AREAS), "canonical_systems": list(SYSTEMS),
        "reference_only_systems": sorted(reference_systems - set(SYSTEMS)),
        "canonical_only_systems": sorted(set(SYSTEMS) - reference_systems),
        "normalized_record_count": len(records), "quarantined_record_count": len(quarantine),
        "datasets": datasets, "quarantine": quarantine,
        "required_before_activation": ["Approve an explicit equipment and qualification crosswalk; unknown is not healthy",
            "Align event, personnel-order, PDF header and supply-history temporal contracts",
            "Provide fixtures for canonical systems absent in the reference exercise",
            "Rebuild and independently test scenario baselines; never copy expected outcomes into runtime evidence"]}
    output.mkdir(parents=True, exist_ok=True)
    for name, document in [("import_report.json", report), ("records.json", {"_banner": BANNER, "records": records})]:
        (output / name).write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8", newline="")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Normalize the earlier synthetic package without modifying or activating it")
    parser.add_argument("--source", type=Path, default=REFERENCE_ROOT)
    parser.add_argument("--out", type=Path, default=NORMALIZED_ROOT)
    options = parser.parse_args()
    report = normalize(options.source, options.out)
    print(f"Normalized {report['normalized_record_count']} records; {report['quarantined_record_count']} require record-level review. Profile remains REVIEW_ONLY.")