"""Validated, snapshot-local dataset configuration, read only from the dataset itself.

squadron/dataset_profile.json names the units, the scenario clock, the homeport clock, in-port employment codes,
supply holder roles and the drawing layout; mission_equipment_tree.json and shore_profile.json give the capability
hierarchy. There is no fallback in code: a dataset missing any of it is rejected with a clear message.
No process-global registry is mutated: multiple profiles can coexist in tests/servers.
"""
from __future__ import annotations

import copy
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

from .domain import parse_ts


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
    area_units: dict = field(default_factory=dict)  # area -> installation ids; areas not listed belong to ships
    shore_mounts: dict = field(default_factory=dict)
    shore_system_mounts: dict = field(default_factory=dict)
    shore_layouts: dict = field(default_factory=dict)
    local_time: dict = field(default_factory=dict)  # {"utc_offset_hours": -5, "label": "EST"}
    inport_codes: frozenset = frozenset()  # schedule employment codes meaning "pierside"
    supply_holders: dict = field(default_factory=dict)  # holder -> role (wholesale stock, direct pull, release lead)
    status_codes: frozenset = frozenset()  # equipment status codes the mission tree scores
    component_mounts: dict = field(default_factory=dict)  # component eic -> {"name", "mounts"} drawn on its own
    visual_model: dict = field(default_factory=dict)

    def holders_where(self, role: str) -> set:
        return {h for h, r in self.supply_holders.items() if r.get(role)}

    @property
    def ship_ids(self):
        return list(self.ships)

    def kind_of(self, unit: str) -> str:
        return self.ships[unit].get('kind', 'ship')

    def areas_for(self, unit: str) -> dict:
        if self.kind_of(unit) == 'ship':
            return {a: v for a, v in self.areas.items() if a not in self.area_units}
        return {a: v for a, v in self.areas.items() if unit in self.area_units.get(a, ())}

    def systems_for(self, unit: str) -> dict:
        members = {eic for _, systems in self.areas_for(unit).values() for eic, _ in systems}
        return {eic: system for eic, system in self.systems.items() if eic in members}

    def eics_for(self, unit: str) -> set:
        systems = self.systems_for(unit)
        return set(systems) | {c['eic'] for system in systems.values() for c in system['components']}

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

    def parts_index(self, unit: str | None = None):
        out = {}
        for eic, system in (self.systems if unit is None else self.systems_for(unit)).items():
            for component in system['components']:
                for part in component['parts']:
                    out.setdefault(part['niin'], []).append((eic, component['eic'], part['installed_qty'], part['min_working']))
        return out


PROFILE_REQUIRED = ('ships', 'watchstations', 'scenario_now', 'local_time', 'inport_employment_codes', 'supply_holders',
                    'visual_model', 'mounts', 'system_mounts')


def profile_from(tree: dict, document: dict, shore: dict | None = None) -> Profile:
    import math
    doc = document
    shore = shore or {}
    if not isinstance(doc, dict) or not isinstance(tree, dict) or not isinstance(shore, dict):
        raise ValueError('Profile and mission tree must be JSON objects')
    if doc.get('schema_version', 1) != 1 or shore.get('schema_version', 1) != 1:
        raise ValueError('Unsupported profile schema_version (expected 1)')
    missing = [key for key in PROFILE_REQUIRED if key not in doc]
    if missing:
        raise ValueError('squadron/dataset_profile.json is missing: ' + ', '.join(missing))
    ships = copy.deepcopy(doc['ships'])
    if set(ships) & set(shore.get('installations', {})):
        raise ValueError('Ship and installation identities must be distinct')
    ships.update(copy.deepcopy(shore.get('installations', {})))
    if not ships or any(not isinstance(s, str) or not all(v.get(k) for k in ('name', 'hull', 'uic', 'dodaac')) for s, v in ships.items()):
        raise ValueError('Profile requires units with name, hull, uic and dodaac')
    if any('/' in s or '\\' in s or s in ('.', '..') for s in ships):
        raise ValueError('Invalid unit identity')
    if any(not isinstance(v[k], str) for v in ships.values() for k in ('name', 'hull', 'uic', 'dodaac')):
        raise ValueError('Unit identities and labels must be strings')
    scoring = tree.get('scoring', {})
    if 'critical_child_cap' not in scoring or not scoring.get('status_score_map'):
        raise ValueError('mission_equipment_tree.json scoring requires critical_child_cap and status_score_map')
    critical_cap = float(scoring['critical_child_cap'])
    if not math.isfinite(critical_cap) or not 0 <= critical_cap <= 1 or scoring.get('rollup', 'weighted_average_with_critical_child') != 'weighted_average_with_critical_child':
        raise ValueError('Unsupported rollup or invalid critical child cap')
    systems, areas, components = {}, {}, set()
    watchstations = copy.deepcopy(doc['watchstations'])
    watchstations.update(shore.get('watchstations', {}))
    area_units = {}
    for mission in list(tree.get('missions', [])) + list(shore.get('missions', [])):
        area = mission['mission_area']
        if area in areas:
            raise ValueError(f'Duplicate mission area: {area}')
        if 'units' in mission:
            if not mission['units'] or any(unit not in shore.get('installations', {}) for unit in mission['units']):
                raise ValueError(f'{area}: capability area references an unknown installation')
            area_units[area] = list(mission['units'])
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
    mounts = doc['mounts']
    for point in mounts.values():
        if len(point) != 3 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in point):
            raise ValueError('Visual mounts require three finite coordinates')
    system_mounts = doc['system_mounts']
    if any(e not in systems or any(m not in mounts for m in ms) for e, ms in system_mounts.items()):
        raise ValueError('Visual mapping references unknown system or mount')
    shore_mounts, shore_system_mounts = shore.get('mounts', {}), shore.get('system_mounts', {})
    for point in shore_mounts.values():
        if len(point) != 3 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in point):
            raise ValueError('Visual mounts require three finite coordinates')
    if any(e not in systems or any(m not in shore_mounts for m in ms) for e, ms in shore_system_mounts.items()):
        raise ValueError('Visual mapping references unknown system or mount')
    component_mounts = doc.get('component_mounts', {})
    component_to_system = {c['eic']: e for e, s in systems.items() for c in s['components']}
    if any(c not in component_to_system or not v.get('name') or any(m not in mounts for m in v.get('mounts', []))
           for c, v in component_mounts.items()):
        raise ValueError('Visual mapping references unknown component or mount')
    local_time = doc['local_time']
    if not isinstance(local_time, dict) or not isinstance(local_time.get('label'), str) or \
            not isinstance(local_time.get('utc_offset_hours'), (int, float)) or not -14 <= local_time['utc_offset_hours'] <= 14:
        raise ValueError('local_time requires utc_offset_hours (-14..14) and a label')
    holders = doc['supply_holders']
    if not isinstance(holders, dict) or any(not isinstance(r, dict) for r in holders.values()):
        raise ValueError('supply_holders must map each holder to its role')
    for holder, role in holders.items():
        release = role.get('release_when_unstated')
        if role.get('direct_pull') and (not isinstance(release, dict) or ('fixed_days' not in release and 'param' not in release)):
            raise ValueError(f'supply holder {holder}: a direct-pull holder needs release_when_unstated (fixed_days or param)')
    if not isinstance(doc['inport_employment_codes'], list) or not doc['inport_employment_codes']:
        raise ValueError('inport_employment_codes must list at least one schedule employment code')
    return Profile(doc.get('name', 'canonical'), 1, str(doc.get('mapping_version', '1')), ships, systems, areas,
                   watchstations, parse_ts(doc['scenario_now']),
                   mounts, system_mounts, critical_cap, area_units, shore_mounts, shore_system_mounts, shore.get('layouts', {}),
                   local_time=dict(local_time), inport_codes=frozenset(doc['inport_employment_codes']),
                   supply_holders=copy.deepcopy(holders), status_codes=frozenset(scoring['status_score_map']),
                   component_mounts=copy.deepcopy(component_mounts), visual_model=dict(doc['visual_model']))


def load_profile(root: Path) -> Profile:
    tree = json.loads((root / 'squadron/mission_equipment_tree.json').read_text(encoding='utf-8'))
    path = root / 'squadron/dataset_profile.json'
    shore_path = root / 'squadron/shore_profile.json'
    if not path.exists():
        raise ValueError('squadron/dataset_profile.json is required: it names the units, the scenario clock and layouts')
    try:
        return profile_from(tree, json.loads(path.read_text(encoding='utf-8')),
                            json.loads(shore_path.read_text(encoding='utf-8')) if shore_path.exists() else None)
    except (KeyError, TypeError, AttributeError, IndexError) as error:
        raise ValueError(f'Malformed profile structure: {error}') from error


def empty_profile() -> Profile:
    """Placeholder while no valid dataset is loaded (the snapshot then carries a configuration error)."""
    from .domain import UTC
    return Profile('unloaded', 1, '', {}, {}, {}, {}, datetime(1970, 1, 1, tzinfo=UTC), {}, {}, 0.0)
