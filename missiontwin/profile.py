"""Validated, snapshot-local domain configuration. Defaults retain the original demo contract.

No process-global registry is mutated: multiple profiles can coexist in tests/servers.
"""
from __future__ import annotations

import copy
import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from .domain import SHIPS, WATCHSTATIONS, SCENARIO_NOW, mission_tree_json, parse_ts


@dataclass
class Profile:
    name: str
    schema_version: int
    mapping_version: str
    ships: dict
    systems: dict
    areas: dict
    watchstations: dict
    now: datetime
    mounts: dict
    system_mounts: dict
    critical_cap: float

    @property
    def ship_ids(self):
        return list(self.ships)

    @property
    def component_to_system(self):
        return {c['eic']: e for e, s in self.systems.items() for c in s['components']}

    @property
    def all_eics(self):
        return set(self.systems) | set(self.component_to_system)

    def day_of(self, dt):
        return (dt - self.now).total_seconds() / 86400

    def dt_of(self, day):
        return self.now + timedelta(days=float(day))

    def parts_index(self):
        out = {}
        for eic, system in self.systems.items():
            for component in system['components']:
                for part in component['parts']:
                    out.setdefault(part['niin'], []).append((eic, component['eic'], part['installed_qty'], part['min_working']))
        return out


def profile_from(tree: dict, document: dict | None = None) -> Profile:
    import math
    doc = document or {}
    if not isinstance(doc, dict) or not isinstance(tree, dict):
        raise ValueError('Profile and mission tree must be JSON objects')
    if doc.get('schema_version', 1) != 1:
        raise ValueError('Unsupported profile schema_version (expected 1)')
    ships = copy.deepcopy(doc.get('ships', SHIPS))
    if not ships or any(not isinstance(s, str) or not all(v.get(k) for k in ('name', 'hull', 'uic', 'dodaac')) for s, v in ships.items()):
        raise ValueError('Profile requires units with name, hull, uic and dodaac')
    if any('/' in s or '\\' in s or s in ('.', '..') for s in ships):
        raise ValueError('Invalid unit identity')
    if any(not isinstance(v[k], str) for v in ships.values() for k in ('name', 'hull', 'uic', 'dodaac')):
        raise ValueError('Unit identities and labels must be strings')
    scoring = tree.get('scoring', {})
    critical_cap = float(scoring.get('critical_child_cap', .59))
    if not math.isfinite(critical_cap) or not 0 <= critical_cap <= 1 or scoring.get('rollup', 'weighted_average_with_critical_child') != 'weighted_average_with_critical_child':
        raise ValueError('Unsupported rollup or invalid critical child cap')
    systems, areas, components = {}, {}, set()
    watchstations = copy.deepcopy(doc.get('watchstations', WATCHSTATIONS))
    for mission in tree.get('missions', []):
        area = mission['mission_area']
        if area in areas:
            raise ValueError(f'Duplicate mission area: {area}')
        members = []
        for task in mission['tasks']:
            for group in task['functional_areas']:
                for raw in group['systems']:
                    system = copy.deepcopy(raw)
                    weight = float(system.pop('weight'))
                    if not math.isfinite(weight) or weight < 0:
                        raise ValueError('System weights must be finite and nonnegative')
                    eic = system['eic']
                    if not isinstance(eic, str) or not eic or not isinstance(system['critical'], bool) or not system.get('name'):
                        raise ValueError('Invalid system identity, name or critical flag')
                    if eic in systems and systems[eic] != system:
                        raise ValueError(f'Conflicting system definitions: {eic}')
                    if eic not in systems:
                        for component in system['components']:
                            if not isinstance(component['eic'], str) or not isinstance(component['critical'], bool):
                                raise ValueError('Invalid component identity or critical flag')
                            if component['eic'] in components:
                                raise ValueError(f'Duplicate component identity: {component["eic"]}')
                            components.add(component['eic'])
                            for part in component['parts']:
                                if (not isinstance(part['niin'], str) or any(type(part[k]) is not int for k in ('min_working', 'installed_qty'))
                                        or not 0 < part['min_working'] <= part['installed_qty']):
                                    raise ValueError('Invalid installed part quantities or NIIN')
                        for qual in system['required_quals']:
                            if qual['watchstation_code'] not in watchstations or type(qual['k']) is not int or qual['k'] < 1:
                                raise ValueError('Unknown watchstation or invalid qualified headcount')
                    systems[eic] = system
                    members.append((eic, weight))
        if not members or len({e for e, _ in members}) != len(members) or abs(sum(w for _, w in members) - 1) > 1e-6:
            raise ValueError(f'{area}: unique system weights must sum to one')
        areas[area] = (mission.get('mission_area_name', area), members)
    if not systems or set(systems) & components:
        raise ValueError('Missing systems or colliding system/component identities')
    mounts = doc.get('mounts', {})
    for point in mounts.values():
        if len(point) != 3 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in point):
            raise ValueError('Visual mounts require three finite coordinates')
    system_mounts = doc.get('system_mounts', {})
    if any(e not in systems or any(m not in mounts for m in ms) for e, ms in system_mounts.items()):
        raise ValueError('Visual mapping references unknown system or mount')
    return Profile(doc.get('name', 'canonical'), 1, str(doc.get('mapping_version', '1')), ships, systems, areas,
                   watchstations, parse_ts(doc['scenario_now']) if 'scenario_now' in doc else SCENARIO_NOW,
                   mounts, system_mounts, critical_cap)


def load_profile(root: Path) -> Profile:
    tree = json.loads((root / 'squadron/mission_equipment_tree.json').read_text(encoding='utf-8'))
    path = root / 'squadron/dataset_profile.json'
    try:
        return profile_from(tree, json.loads(path.read_text(encoding='utf-8')) if path.exists() else None)
    except (KeyError, TypeError, AttributeError, IndexError) as error:
        raise ValueError(f'Malformed profile structure: {error}') from error


def default_profile() -> Profile:
    return profile_from(mission_tree_json())
