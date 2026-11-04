"""Semantic validation shared by source imports, previews and committed changes."""
from __future__ import annotations

import math

from .domain import DEFAULT_PARAMS


def validate_params(params: dict):
    def value(key):
        return params[key]['value']

    def finite(node):
        if isinstance(node, dict):
            for v in node.values(): finite(v)
        elif isinstance(node, list):
            for v in node: finite(v)
        elif isinstance(node, (float, int)) and not math.isfinite(node):
            raise ValueError('Model parameters must be finite')
    finite(params)
    for key in DEFAULT_PARAMS:
        if key not in params or not isinstance(params[key], dict) or 'value' not in params[key]:
            raise ValueError(f'Missing assumption: {key}')
    bands = value('bands')
    if not 0 <= bands['amber'] <= bands['green'] <= 1:
        raise ValueError('Thresholds require 0 <= amber <= green <= 1')
    scores = value('status_score_map')
    if not set(('0', '1', '2', '3')) <= set(scores) or any(not 0 <= score <= 1 for score in scores.values()):
        raise ValueError('Status score map requires codes 0, 1, 2, 3 with scores between zero and one')
    repair = value('repair_after_part_days')
    if not 0 <= repair['min'] <= repair['mode'] <= repair['max']:
        raise ValueError('Repair duration requires 0 <= min <= mode <= max')
    for key in ('program_office_release_days', 'engineering_validation_days', 'cannibalize_extra_days'):
        v = value(key)
        if not 0 <= v['min'] <= v['max']:
            raise ValueError(f'{key}: requires 0 <= min <= max')
    for kind in ('in_company', 'different_ports_conus'):
        v = value('cross_deck_days')[kind]
        if not 0 <= v['min'] <= v['max']:
            raise ValueError(f'cross_deck_days.{kind}: requires 0 <= min <= max')
    for key, probability in (('etr_slip', 'p_slip'), ('availability_slip', 'p_late')):
        v = value(key)
        if not 0 <= v[probability] <= 1 or v['median'] < 0 or v['sigma'] <= 0:
            raise ValueError(f'Invalid distribution: {key}')
    for regime, v in value('part_arrival_days_by_regime').items():
        if regime == 'REJECTED': continue
        if v['sigma'] <= 0 or any(v[k] < 0 for k in ('median', 'median_conus', 'median_oconus') if k in v):
            raise ValueError(f'Invalid arrival distribution: {regime}')
    for key in ('runs', 'ranking_runs', 'seed'):
        v = value(key)
        if not isinstance(v, int) or v < (0 if key == 'seed' else 1) or (key != 'seed' and v > 100000):
            raise ValueError(f'Invalid {key}')
    if not 0 <= value('training_refresh_success') <= 1:
        raise ValueError('Training probability must be between zero and one')
    for key in ('transit_days_conus_default', 'background_failure_rate_per_unit_day', 'staleness_threshold_days', 'lost_pms_hazard_multiplier'):
        if value(key) < 0: raise ValueError(f'{key} cannot be negative')


def validate_events(events, profile):
    ids = {e['event_id'] for e in events}
    if not events or len(ids) != len(events):
        raise ValueError('Events must be nonempty with unique identities')
    for event in events:
        if not all(event.get(k) for k in ('event_id', 'ship_id', 'label', 'name', 'start', 'end')):
            raise ValueError('Event requires identity, label, name, unit and interval')
        if event['ship_id'] not in profile.ships or not event.get('end') or event['end'] <= event['start']:
            raise ValueError(f'{event["event_id"]}: invalid unit or event interval')
        if not set(event.get('mission_areas', [])) <= set(profile.areas):
            raise ValueError('Event references unknown mission area')
        for r in event.get('required_systems', []):
            if r['eic'] not in profile.systems or not 0 <= float(r['min_status_score']) <= 1:
                raise ValueError('Event references unmapped system or invalid required score')
        for team in event.get('required_watch_teams', []):
            if team['watchstation_code'] not in profile.watchstations or type(team['k']) is not int or team['k'] < 1:
                raise ValueError('Event references unknown watchstation or invalid headcount')
        if not set(event.get('prerequisite_events', [])) <= ids:
            raise ValueError('Event has missing prerequisite')
    by_id = {e['event_id']: e for e in events}
    visited, active = set(), set()
    def visit(eid):
        if eid in active: raise ValueError('Cyclic event prerequisites')
        if eid in visited: return
        active.add(eid)
        for parent in by_id[eid].get('prerequisite_events', []):
            visit(parent)
            if by_id[parent]['end'] > by_id[eid]['start']:
                raise ValueError('Prerequisite must finish before dependent event starts')
        active.remove(eid); visited.add(eid)
    for eid in ids: visit(eid)


def validate_world(world):
    validate_params(world.params)
    missions = {m.event_id: m for sw in world.ships.values() for m in sw.missions}
    for sw in world.ships.values():
        if any(stock['on_hand'] < 0 for stock in sw.stock.values()):
            raise ValueError('Transfer exceeds available donor stock')
        for m in sw.missions:
            if m.end <= m.start or m.start < 0:
                raise ValueError('Mission interval must follow scenario start')
            for parent in m.prereqs:
                if parent not in missions or missions[parent].end > m.start:
                    raise ValueError('Mission conflicts with a prerequisite interval')
        for ws, holders in sw.holders.items():
            ids = [h.member_id for h in holders]
            if len(ids) != len(set(ids)):
                raise ValueError(f'Duplicate personnel assignment for {ws}')
