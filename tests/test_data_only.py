"""The running system holds no fleet facts: units, equipment, parts, events and layouts come only from the dataset.

synthetic_spec.py is the authoring input for the synthetic dataset and may be imported only by the generators.
"""
import ast
import json
import re
import shutil
from pathlib import Path

import pytest

from missiontwin import synthetic_spec as spec
from missiontwin.api import AppState, create_app
from conftest import signed_in

PACKAGE = Path(__file__).resolve().parents[1] / "missiontwin"
AUTHORING = {"generate.py", "generate_shore.py", "synthetic_spec.py"}
RUNTIME = sorted(p for p in PACKAGE.glob("*.py") if p.name not in AUTHORING)


def _docstrings(tree):
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.body:
            first = node.body[0]
            if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant) and isinstance(first.value.value, str):
                yield first.value


def test_runtime_modules_never_import_the_authoring_spec():
    offenders = []
    for path in RUNTIME:
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.ImportFrom) and (node.module or "").endswith("synthetic_spec"):
                offenders.append(f"{path.name}:{node.lineno}")
            if isinstance(node, ast.Import) and any(a.name.endswith("synthetic_spec") for a in node.names):
                offenders.append(f"{path.name}:{node.lineno}")
    assert offenders == [], f"runtime code must read the dataset, not the generator's spec: {offenders}"


def test_runtime_code_names_no_unit_system_part_or_event(data_dir):
    """No string in runtime code (docstrings aside) is a unit, system, component, part, watchstation or event id."""
    shore = json.loads((data_dir / "squadron/shore_profile.json").read_text(encoding="utf-8"))
    events = json.loads((data_dir / "squadron/events_missions.json").read_text(encoding="utf-8"))
    facts = (set(spec.SHIP_IDS) | set(shore.get("installations", {})) | spec.ALL_EICS | set(spec.PARTS)
             | set(spec.WATCHSTATIONS) | {e["event_id"] for e in events.get("events", events if isinstance(events, list) else [])}
             | {e.get("codename") for e in events.get("events", []) if e.get("codename")})
    facts |= {s["name"] for s in spec.SHIPS.values()} | {s["hull"] for s in spec.SHIPS.values()}
    pattern = re.compile(r"(?<![A-Za-z0-9_-])(" + "|".join(sorted(map(re.escape, facts), key=len, reverse=True)) + r")(?![A-Za-z0-9_-])")
    found = []
    for path in RUNTIME:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        docs = {id(d) for d in _docstrings(tree)}
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docs:
                for match in pattern.finditer(node.value):
                    found.append(f"{path.name}:{node.lineno} {match.group(1)!r}")
    assert found == [], "fleet facts written into runtime code:\n" + "\n".join(found)


def test_dataset_profile_is_required(data_dir, tmp_path, offline_client):
    root = tmp_path / "data"
    shutil.copytree(data_dir, root)
    (root / "squadron/dataset_profile.json").unlink()
    state = AppState(root, tmp_path / "a.jsonl", offline_client)
    assert any("dataset_profile.json is required" in e for e in state.baseline.configuration_errors)
    assert state.baseline.profile.ship_ids == []  # nothing is filled in from code


def test_a_ship_added_only_in_the_data_appears_everywhere(data_dir, tmp_path, offline_client):
    """A fourth ship: copy a ship's records under a new identity and list it in the profile. No code changes."""
    root = tmp_path / "data"
    shutil.copytree(data_dir, root)
    source, new = "VARNELL", "MERRICK"
    old, add = spec.SHIPS[source], {"name": "USS MERRICK", "hull": "DDG-994", "uic": "99104", "dodaac": "V99104"}
    shutil.copytree(root / source, root / new)
    for path in (root / new).rglob("*"):
        if path.suffix in (".csv", ".json", ".txt"):
            text = path.read_text(encoding="utf-8")
            for key in ("name", "hull", "uic", "dodaac"):
                text = text.replace(old[key], add[key])
            text = text.replace(source, new).replace("DDG992", "DDG994").replace("M-0", "N-0")
            path.write_text(text, encoding="utf-8")
    profile_path = root / "squadron/dataset_profile.json"
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    profile["ships"][new] = {**old, **add, "role": "Added in data only", "depth": "light"}
    profile_path.write_text(json.dumps(profile), encoding="utf-8")

    state = AppState(root, tmp_path / "a.jsonl", offline_client)
    assert state.baseline.configuration_errors == []
    app = create_app(state)
    fleet = signed_in(app)
    d = fleet.get("/api/dashboard").json()
    assert new in [s["ship_id"] for s in d["state"]["ships"]]
    assert new in d["forecast"]["units"] and d["forecast"]["ships"][new]["systems"]
    assert fleet.get(f"/api/graph/{new}").status_code == 200
    assert fleet.get(f"/api/fixes/{new}").status_code == 200
    # Its commanding officer gets an account and sees only the new ship.
    accounts = {a["username"] for a in fleet.get("/api/accounts").json()}
    assert f"co.{new.lower()}" in accounts
    co = signed_in(app, f"co.{new.lower()}")
    assert [s["ship_id"] for s in co.get("/api/state").json()["ships"]] == [new]
