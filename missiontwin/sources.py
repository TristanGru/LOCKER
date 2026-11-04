"""Read-only adapters and immutable snapshots. Real connectors implement SourceAdapter.

The JSON-export adapter accepts *.csv.json objects with {columns: [...], rows: [...]};
IDs remain strings. Other artifacts retain the canonical file contract. No network access.
"""
from __future__ import annotations

import csv
import hashlib
import json
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from .ingest import load_baseline
from .llm import LLMClient


class SourceAdapter(Protocol):
    name: str
    def stage(self, source: Path, destination: Path) -> None: ...


class DirectoryAdapter:
    name = 'directory'

    def stage(self, source, destination):
        expected = fingerprint(source)
        shutil.copytree(source, destination, dirs_exist_ok=True)
        if fingerprint(destination) != expected:
            raise ValueError('Staged sources differ from input fingerprint; retry a consistent export')


class JsonExportAdapter(DirectoryAdapter):
    name = 'json-export'

    def stage(self, source, destination):
        super().stage(source, destination)
        for path in destination.rglob('*.csv.json'):
            target = path.with_suffix('')
            if target.exists():
                raise ValueError(f'Ambiguous source: both {target.name} and {path.name}')
            document = json.loads(path.read_text(encoding='utf-8'))
            columns, rows = document['columns'], document['rows']
            if not columns or len(columns) != len(set(columns)) or not all(isinstance(c, str) for c in columns):
                raise ValueError(f'{path.name}: invalid columns')
            with target.open('w', encoding='utf-8', newline='') as stream:
                # No banner line: canonical CSVs no longer carry one, and adding it would shift source row numbers.
                writer = csv.DictWriter(stream, fieldnames=columns)
                writer.writeheader()
                for row in rows:
                    if set(row) != set(columns) or any(v is not None and not isinstance(v, (str, bool, int, float)) for v in row.values()):
                        raise ValueError(f'{path.name}: row does not match declared columns')
                    for key in ('ship_id', 'member_id', 'niin', 'uic', 'doc_number', 'watchstation_code'):
                        if key in row and row[key] is not None and not isinstance(row[key], str):
                            raise ValueError(f'{path.name}: identifier {key} must be a string')
                    writer.writerow({k: str(v).lower() if isinstance(v, bool) else v for k, v in row.items()})


ADAPTERS = {a.name: a for a in (DirectoryAdapter(), JsonExportAdapter())}


def fingerprint(root):
    if not root.is_dir(): raise ValueError('Source directory does not exist')
    digest = hashlib.sha256()
    for path in sorted(root.rglob('*')):
        if path.is_symlink(): raise ValueError('Source snapshots must not contain symbolic links')
        if path.is_file():
            digest.update(path.relative_to(root).as_posix().encode() + b'\0')
            digest.update(path.read_bytes())
    return digest.hexdigest()


def load_snapshot(source: Path, adapter_name: str, client: LLMClient):
    if adapter_name not in ADAPTERS: raise ValueError('Unknown source adapter')
    before = fingerprint(source)
    owner = tempfile.TemporaryDirectory(prefix='locker-snapshot-', ignore_cleanup_errors=True)
    destination = Path(owner.name)
    try:
        ADAPTERS[adapter_name].stage(source, destination)
        if fingerprint(source) != before:
            raise ValueError('Sources changed during import; retry a consistent snapshot')
        baseline = load_baseline(destination, client)
        baseline.source_revision = hashlib.sha256((adapter_name + ':' + before).encode()).hexdigest()[:20]
        baseline.snapshot_owner = owner
        return baseline
    except Exception:
        owner.cleanup()
        raise


# Deliberately explicit: loading evidence is not a claim that all its fields affect forecasts.
COVERAGE = {
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
}


def source_health(baseline, configured_path, adapter, last_success, last_attempt):
    sources = []
    stale = baseline.view(baseline.profile.now).stale_files()
    for entry in baseline.catalog:
        file = entry['file']
        name = file.rsplit('/', 1)[-1]
        usage, explanation = COVERAGE.get(name, ('context_only', 'Supporting source; no direct forecast contribution'))
        if 'casrep_messages/' in file: usage, explanation = 'modeled', 'Casualty lifecycle and equipment impairment'
        if 'daily_reports/' in file: usage, explanation = 'partial', 'Verified selected personnel/assist facts; tentative claims require review'
        if '/movrep/' in file or '/logreq/' in file: usage, explanation = 'partial', 'Known arrival, departure and delivery-window constraints'
        issues = [i for i in baseline.issues if i.file == file or (file.endswith('/') and i.file.startswith(file))]
        path = baseline.data_dir / file
        owner, _, fname = file.partition('/')
        count = len(baseline.r(owner, fname)) if fname.endswith('.csv') else (len(list(path.glob('*'))) if path.is_dir() else int(path.exists()))
        sources.append({**entry, 'usage': usage, 'explanation': explanation, 'record_count': count,
                        'rejected_count': len(issues), 'status': 'missing' if not path.exists() else 'needs_review' if issues else 'stale' if file in stale else 'loaded'})
    return {'profile': baseline.profile.name, 'schema_version': baseline.profile.schema_version,
            'mapping_version': baseline.profile.mapping_version, 'adapter': adapter, 'configured_path': str(configured_path),
            'source_revision': baseline.source_revision, 'last_successful_refresh': last_success,
            'last_attempt': last_attempt, 'sources': sources, 'coverage': baseline.coverage(),
            'configuration_errors': baseline.configuration_errors,
            'notice': 'Synthetic adapters, not live Navy connections. Refresh never writes source records.'}


def utc_now():
    return datetime.now(timezone.utc).isoformat()
