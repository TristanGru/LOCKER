"""Shore installations: labeled mock units, public regional hazards, and the link into ship forecasts."""
import copy
import csv
import json
import shutil

import numpy as np
import pytest
from fastapi.testclient import TestClient

from missiontwin.api import AppState, create_app
from missiontwin.engine import Scenario, _items_scores, apply_fix, build_world, forecast
from missiontwin.fixes import rank_fixes
from missiontwin.generate_shore import INSTALLATIONS, SNAPSHOT
from missiontwin.ingest import find_contradictions, load_baseline
from missiontwin.llm import LLMClient

RUNS = 2000


@pytest.fixture()
def client(data_dir, tmp_path, offline_client):
    state = AppState(data_dir, tmp_path / 'log.jsonl', offline_client)
    return TestClient(create_app(state)), state


def mission(fc, event_id):
    return next(m for m in fc['missions'] if m['event_id'] == event_id)


def played(baseline, log_path, count):
    scenario = Scenario(baseline, log_path=log_path)
    for _ in range(count):
        scenario.apply('play_event', {})
    return scenario


def test_installations_are_units_with_their_own_systems(baseline):
    profile = baseline.profile
    assert profile.kind_of('KESSLER') == 'ship' and profile.kind_of('NSNORFOLK') == 'installation'
    assert 'SPY1D' in profile.systems_for('KESSLER') and 'SP12' not in profile.systems_for('KESSLER')
    assert 'SP12' in profile.systems_for('NSNORFOLK') and 'SPY1D' not in profile.systems_for('NSNORFOLK')
    assert set(profile.areas_for('NSAHR')) == {'MOBL'}


def test_forecast_reports_only_each_units_own_systems(baseline, log_path):
    fc = forecast(build_world(Scenario(baseline, log_path=log_path)), runs=200)
    assert 'SP12' in fc['ships']['NSNORFOLK']['systems'] and 'SPY1D' not in fc['ships']['NSNORFOLK']['systems']
    assert 'SPY1D' in fc['ships']['KESSLER']['systems'] and 'SP12' not in fc['ships']['KESSLER']['systems']


def test_support_gate_appears_on_ship_event(baseline, log_path):
    fc = forecast(build_world(Scenario(baseline, log_path=log_path)), runs=RUNS)
    gate = next(g for g in mission(fc, 'EVT-KESSLER-01')['gates'] if g['gate_id'] == 'prereq:EVT-NSNORFOLK-01')
    assert gate['supporting_unit'] == 'NSNORFOLK' and 'pre-sail services' in gate['label']


def test_pier_failure_lowers_ship_support_and_is_bounded_by_it(baseline, log_path):
    scenario = played(baseline, log_path, 4)
    before = forecast(build_world(scenario), runs=RUNS)
    assert mission(before, 'EVT-NSNORFOLK-01')['p_assessed'] > .5
    scenario.apply('play_event', {})
    after = forecast(build_world(scenario), runs=RUNS)
    assert scenario.played()[-1] == 'E5'
    assert mission(after, 'EVT-NSNORFOLK-01')['p_assessed'] < mission(before, 'EVT-NSNORFOLK-01')['p_assessed']
    for fc in (before, after):
        assert mission(fc, 'EVT-KESSLER-01')['p_assessed'] <= mission(fc, 'EVT-NSNORFOLK-01')['p_assessed'] + 1e-9


def test_pier_failure_does_not_touch_other_piers_support(baseline, log_path):
    scenario = played(baseline, log_path, 4)
    before = forecast(build_world(scenario), runs=RUNS)
    scenario.apply('play_event', {})
    after = forecast(build_world(scenario), runs=RUNS)
    gate = lambda fc: next(g for g in mission(fc, 'EVT-NSNORFOLK-03')['gates'] if g['gate_id'] == 'system:SP10')
    assert gate(after)['p_ok'] == pytest.approx(gate(before)['p_ok'], abs=.02)


def test_support_window_follows_ship_schedule_change(baseline, log_path):
    scenario = played(baseline, log_path, 4)
    world = build_world(scenario)
    ship = next(m for m in world.ships['KESSLER'].missions if m.event_id == 'EVT-KESSLER-01')
    support = next(m for m in world.ships['NSNORFOLK'].missions if m.event_id == 'EVT-NSNORFOLK-01')
    assert support.end == ship.start and support.start == ship.start - support.lead_days


def test_shifting_a_support_event_moves_the_ship_event(baseline, log_path):
    scenario = Scenario(baseline, log_path=log_path)
    original = next(m for m in build_world(scenario).ships['KESSLER'].missions if m.event_id == 'EVT-KESSLER-01').start
    scenario.apply('action', {'type': 'shift_mission', 'event_id': 'EVT-NSNORFOLK-01', 'days': 3})
    world = build_world(scenario)
    ship = next(m for m in world.ships['KESSLER'].missions if m.event_id == 'EVT-KESSLER-01')
    support = next(m for m in world.ships['NSNORFOLK'].missions if m.event_id == 'EVT-NSNORFOLK-01')
    assert ship.start == original + 3 and support.end == ship.start


def test_shore_fixes_show_donor_cost_and_help_the_ship(baseline, log_path):
    scenario = played(baseline, log_path, 5)
    ranking = rank_fixes(scenario, 'NSNORFOLK', runs=1000)
    titles = [c['title'] for c in ranking['candidates']]
    assert any('Borrow NIIN 019998001 from NSA HAMPTON ROADS (MOCK)' in t for t in titles)
    assert not any('USS' in t and 'NIIN 019998001' in t for t in titles), 'ships do not hold pier transformers'
    cannibalize = next(c for c in ranking['candidates'] if c['title'].startswith('Cannibalize NIIN 019998001') and len(c['steps']) == 1)
    assert cannibalize['donor_effects']['NSAHR']['mission_p_delta'] < 0
    borrow = next(c for c in ranking['candidates'] if c['title'].startswith('Borrow NIIN 019998001') and len(c['steps']) == 1)
    support = next(m for m in borrow['missions'] if m['event_id'] == 'EVT-NSNORFOLK-01')
    assert support['p_after'] > support['p_before']


def test_ship_ranking_reaches_through_to_shore_blockers(baseline, log_path):
    ranking = rank_fixes(played(baseline, log_path, 5), 'KESSLER', runs=500)
    steps = [step for candidate in ranking['candidates'] for step in candidate['steps']]
    assert any(step.get('receiver') == 'NSNORFOLK' for step in steps)
    assert any(len(c['steps']) == 3 for c in ranking['candidates'])


def test_full_package_restores_ship_event(baseline, log_path):
    scenario = played(baseline, log_path, 5)
    ranking = rank_fixes(scenario, 'KESSLER', runs=1000)
    top = ranking['candidates'][0]
    baseline_p = ranking['baseline']['EVT-KESSLER-01']
    after = next(m for m in top['missions'] if m['event_id'] == 'EVT-KESSLER-01')['p_after']
    assert after > baseline_p
    assert any(step.get('receiver') == 'NSNORFOLK' for step in top['steps']), 'the winning package must address the failed pier'


def test_reused_evaluation_matches_full_evaluation(baseline, log_path):
    """Skipping untouched units is an optimization: it must not change any number."""
    scenario = played(baseline, log_path, 5)
    base = build_world(scenario)
    forecast(base, runs=1000, seed=7, detail=False)
    evaluation = base.last_evaluation
    item = next(i for i in base.ships['NSNORFOLK'].items if i.part_niin == '019998001')
    fix = {'fix_id': 'T', 'title': 't', 'steps': [{'kind': 'part_transfer', 'source_kind': 'cross_deck', 'niin': '019998001', 'donor': 'NSAHR',
                                                   'receiver': 'NSNORFOLK', 'item_key': item.key}]}
    base.last_evaluation = None
    fast, full = copy.deepcopy(base), copy.deepcopy(base)
    fast.reuse = (1000, 7, evaluation['units'])
    apply_fix(fast, fix, base.cursor)
    apply_fix(full, fix, base.cursor)
    fast.digest, full.digest = 'fast', 'full'
    assert fast.touched == {'NSNORFOLK', 'NSAHR'}
    a, b = forecast(fast, runs=1000, seed=7, detail=False), forecast(full, runs=1000, seed=7, detail=False)
    assert a['missions'] == b['missions'] and a['ships'] == b['ships']


def test_regional_hazard_hits_every_asset_in_the_same_run(baseline, log_path):
    world = build_world(Scenario(baseline, log_path=log_path))
    sw = world.ships['NSNORFOLK']
    T = world.cursor + np.arange(30, dtype=float)
    scores, _, _ = _items_scores(sw, T, 4000, 11, False)
    assert np.array_equal(scores['SP10-VAULT'], scores['SP12-VAULT'])
    assert (scores['SP10-VAULT'] == 0).any(), 'flood draws should occur across 4000 runs'


def test_seeded_shore_contradictions(baseline):
    from missiontwin.domain import parse_ts
    view = baseline.view(parse_ts('2026-11-08T12:00:00Z'))
    found = {(c.id, c.ship_id) for c in find_contradictions(view)}
    assert ('X5', 'NSAHR') in found
    assert ('X7', 'NSNORFOLK') in found
    assert ('X11', 'NSNORFOLK') in found


def test_missing_hazard_model_is_unknown_not_green(data_dir, tmp_path):
    copy_dir = tmp_path / 'data'
    shutil.copytree(data_dir, copy_dir)
    (copy_dir / 'NSNORFOLK' / 'hazard_model.csv').unlink()
    baseline = load_baseline(copy_dir, LLMClient(base_url='', cache_dir=tmp_path / 'cache'))
    assert baseline.coverage()['NSNORFOLK']
    fc = forecast(build_world(Scenario(baseline, log_path=tmp_path / 'a.jsonl')), runs=200)
    assert mission(fc, 'EVT-NSNORFOLK-01')['p_assessed'] is None
    assert mission(fc, 'EVT-KESSLER-01')['band'] == 'UNKNOWN', 'missing shore evidence must reach the dependent ship event'


def test_malformed_hazard_row_is_rejected(data_dir, tmp_path):
    copy_dir = tmp_path / 'data'
    shutil.copytree(data_dir, copy_dir)
    path = copy_dir / 'NSNORFOLK' / 'hazard_model.csv'
    rows = list(csv.DictReader(path.open(encoding='utf-8')))
    rows[0]['p_trigger'] = '4'
    with path.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    baseline = load_baseline(copy_dir, LLMClient(base_url='', cache_dir=tmp_path / 'cache'))
    assert any('hazard probability' in issue.reason for issue in baseline.issues)
    assert baseline.coverage()['NSNORFOLK']


def test_support_event_must_be_a_prerequisite(data_dir, tmp_path):
    copy_dir = tmp_path / 'data'
    shutil.copytree(data_dir, copy_dir)
    path = copy_dir / 'squadron' / 'events_missions.json'
    document = json.loads(path.read_text(encoding='utf-8'))
    next(e for e in document['events'] if e['event_id'] == 'EVT-KESSLER-01')['prerequisite_events'] = []
    path.write_text(json.dumps(document), encoding='utf-8')
    baseline = load_baseline(copy_dir, LLMClient(base_url='', cache_dir=tmp_path / 'cache'))
    assert any('support event must be a prerequisite' in error for error in baseline.configuration_errors)


def test_public_snapshot_values_reach_the_hazard_model(baseline):
    snapshot = json.loads(SNAPSHOT.read_text(encoding='utf-8'))
    rows = baseline.r('NSNORFOLK', 'hazard_model.csv')
    flood = next(r for r in rows if r['hazard_id'] == 'HZ-FLOOD')
    grid = next(r for r in rows if r['hazard_id'] == 'HZ-GRID')
    assert flood['rate_per_day'] == snapshot['storms']['categories']['coastal_flood']['rate_per_day']
    assert grid['rate_per_day'] == snapshot['grid']['rate_per_day']
    highest = max(snapshot['tides']['high_tides'], key=lambda t: t['feet_mllw'])
    assert any(r['hazard_kind'] == 'WINDOW' and f"{highest['feet_mllw']:.2f} ft" in r['title'] for r in rows)
    assert snapshot['tides']['nws_minor_flood_feet_mllw'] == pytest.approx(
        snapshot['tides']['nws_minor_flood_feet_station_datum'] - snapshot['tides']['mllw_feet_station_datum'], abs=.01)


def test_real_base_names_are_always_marked_as_mock(data_dir):
    assert all(info['name'].endswith('(MOCK)') for info in INSTALLATIONS.values())
    assert all('invented' in info['role'] for info in INSTALLATIONS.values())
    events = json.loads((data_dir / 'squadron' / 'scenario_feed.json').read_text(encoding='utf-8'))['events']
    assert '(MOCK)' in next(e['title'] for e in events if e['event_id'] == 'E5')


def test_captain_api_serves_an_installation(client):
    connection, state = client
    data = connection.get('/api/dashboard').json()
    unit = next(s for s in data['state']['ships'] if s['ship_id'] == 'NSNORFOLK')
    assert unit['kind'] == 'installation'
    entry = next(s for s in data['visualization']['systems'] if s['eic'] == 'SP12')
    assert entry['units'] == ['NSNORFOLK'] and entry['mounts'] == ['pier_12']
    assert connection.get('/api/graph/NSNORFOLK').status_code == 200
    assert connection.get('/api/fixes/NSNORFOLK').status_code == 200
    assert connection.post('/api/brief', json={'ship_id': 'NSNORFOLK'}).status_code == 200
    graph = connection.get('/api/graph/KESSLER', params={'event_id': 'EVT-KESSLER-01'}).json()
    assert any(node['id'].endswith('prereq:EVT-NSNORFOLK-01|system:SP12') for node in graph['nodes']), 'the chain must continue ashore'


def test_outline_is_public_map_geometry_only(data_dir):
    profile = json.loads((data_dir / 'squadron' / 'shore_profile.json').read_text(encoding='utf-8'))
    layout = profile['layouts']['NSNORFOLK']
    assert 'OpenStreetMap' in layout['attribution'] and 'ODbL' in layout['attribution']
    assert {'Pier 10', 'Pier 11', 'Pier 12'} <= {p['name'] for p in layout['piers']}
    assert set(layout) == {'attribution', 'license_url', 'retrieved', 'query', 'meters_per_unit', 'note', 'piers', 'shoreline', 'runways', 'aprons'}
    assert not any(word in layout['query'] for word in ('building', 'power', 'substation', 'pipeline'))


def test_pier_pins_sit_on_their_traced_piers(data_dir):
    profile = json.loads((data_dir / 'squadron' / 'shore_profile.json').read_text(encoding='utf-8'))
    piers = {p['name']: p for p in profile['layouts']['NSNORFOLK']['piers']}
    for number in (10, 11, 12):
        x, _, z = profile['mounts'][f'pier_{number}']
        points = piers[f'Pier {number}']['points']
        assert min(p[0] for p in points) <= x <= max(p[0] for p in points)
        assert min(p[1] for p in points) <= z <= max(p[1] for p in points)


def test_berths_follow_ship_positions(client):
    connection, state = client
    berths = {b['ship_id']: b for b in connection.get('/api/state').json()['berths']}
    assert set(berths) <= {'KESSLER', 'VARNELL', 'ASHBY'}
    assert berths and all(b['pier'].startswith('PIER') for b in berths.values() if b['in_port'])


def test_action_cannot_target_another_units_equipment(client):
    connection, state = client
    response = connection.post('/api/preview', json={'base_version': state.scenario.version, 'kind': 'action', 'action': {
        'type': 'add_casrep', 'ship_id': 'KESSLER', 'eic': 'SP12-XFMR', 'category': 3, 'etr': '2026-11-20T00:00:00Z'}})
    assert response.status_code == 422
