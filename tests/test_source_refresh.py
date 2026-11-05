"""Replacement-source and validation regression tests (no operational data or network)."""
import copy
import csv
import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from missiontwin.api import AppState, create_app
from missiontwin.domain import SHIPS, WATCHSTATIONS, iso
from missiontwin.engine import Scenario, build_world, forecast
from missiontwin.ingest import load_baseline
from missiontwin.export import export_json
from missiontwin.sources import fingerprint


@pytest.fixture
def workspace(data_dir, offline_client, tmp_path):
    root = tmp_path / 'sources'
    shutil.copytree(data_dir, root)
    state = AppState(root, tmp_path / 'activity.jsonl', offline_client)
    with TestClient(create_app(state), raise_server_exceptions=False) as client:
        yield root, state, client


def change_csv(root, relative, transform):
    path = root / relative
    lines = path.read_text(encoding='utf-8').splitlines()
    banner = lines[:1] if lines and lines[0].startswith('#') else []  # banner line is optional
    reader = csv.DictReader(lines[len(banner):])
    columns, rows = reader.fieldnames, list(reader)
    rows = transform(rows)
    with path.open('w', encoding='utf-8', newline='') as stream:
        for line in banner:
            stream.write(line + '\n')
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader(); writer.writerows(rows)


def delay_source(root):
    def alter(rows):
        for row in rows:
            if row['doc_number'] == 'V9910163080001':
                row['status_history'] = row['status_history'].replace('BB 2026-11-05', 'BB 2026-11-12')
        return rows
    change_csv(root, 'KESSLER/requisition_status.csv', alter)


def refresh(client, state, **extra):
    return client.post('/api/sources/refresh', json={'base_version': state.scenario.version, **extra})


def test_refresh_changes_results_and_keeps_immutable_evidence(workspace):
    root, state, client = workspace
    client.post('/api/events/play', json={'base_version': 0})
    before = client.get('/api/dashboard').json()
    old_revision = before['state']['source_revision']
    original = client.get('/api/source', params={'file': 'KESSLER/requisition_status.csv'}).json()
    delay_source(root)
    # Files on disk do not rewrite evidence under an already displayed assessment.
    assert client.get('/api/source', params={'file': 'KESSLER/requisition_status.csv'}).json() == original
    response = refresh(client, state)
    assert response.status_code == 200, response.text
    after = client.get('/api/dashboard').json()
    assert after['state']['source_revision'] != old_revision
    assert after['forecast']['source_revision'] == after['state']['source_revision']
    assert after['forecast']['missions'][0]['p_ready'] < before['forecast']['missions'][0]['p_ready']
    assert state.scenario.played() == ['E1']
    assert after['forecast']['missions'][0]['gates'] != before['forecast']['missions'][0]['gates']
    assert after['state']['version'] == before['state']['version'] + 1
    assert client.get('/api/data-contract').json()['active_path'] == str(root.resolve())


def test_unmapped_equipment_does_not_disappear_into_healthy_scores(workspace):
    root, state, client = workspace
    before = client.get('/api/forecast').json()
    def alter(rows):
        rows[0]['eic'] = 'UNMAPPED'
        return rows
    change_csv(root, 'KESSLER/csmp.csv', alter)
    response = refresh(client, state)
    assert response.status_code == 422 and 'Unmapped equipment' in response.text
    assert client.get('/api/forecast').json() == before


def test_repeat_import_is_idempotent(workspace):
    root, state, client = workspace
    before = fingerprint(root)
    count = len(state.baseline.r('KESSLER', 'quals.csv'))
    version, revision = state.scenario.version, state.baseline.source_revision
    for _ in range(2):
        result = refresh(client, state)
        assert result.status_code == 200 and result.json()['changed'] is False
    assert state.scenario.version == version and state.baseline.source_revision == revision
    assert len(state.baseline.r('KESSLER', 'quals.csv')) == count
    assert fingerprint(root) == before


def test_failed_refresh_preserves_forecast_and_reports_failure(workspace):
    root, state, client = workspace
    before = client.get('/api/forecast').json()
    (root / 'KESSLER/csmp.csv').unlink()
    result = refresh(client, state)
    assert result.status_code == 422
    assert client.get('/api/forecast').json() == before
    health = client.get('/api/sources').json()
    assert health['last_attempt']['status'] == 'failed'
    assert 'Required evidence' in health['last_attempt']['error']
    assert client.get('/api/ready').status_code == 503
    assert state.scenario.version == 0


def test_refresh_requires_explicit_overlay_reset(workspace):
    root, state, client = workspace
    client.post('/api/changes', json={'base_version': 0, 'kind': 'set_assumption', 'key': 'transit_days_conus_default', 'value': 6})
    delay_source(root)
    assert refresh(client, state).status_code == 422
    assert state.scenario.version == 1 and len(state.scenario.changes) == 1
    assert refresh(client, state, reset_scenario=True).status_code == 200
    assert not state.scenario.changes and state.scenario.version == 2
    assert state.scenario.params()['transit_days_conus_default']['value'] == 5


def test_played_event_time_change_requires_reset(workspace):
    root, state, client = workspace
    client.post('/api/events/play', json={'base_version': 0})
    path = root / 'squadron/scenario_feed.json'
    feed = json.loads(path.read_text())
    from datetime import timedelta
    from missiontwin.domain import parse_ts
    feed['events'][0]['known_at'] = iso(parse_ts(feed['events'][0]['known_at']) + timedelta(hours=1))
    path.write_text(json.dumps(feed))
    result = refresh(client, state)
    assert result.status_code == 422 and 'timing changed' in result.text
    assert state.scenario.played() == ['E1']
    assert refresh(client, state, reset_scenario=True).status_code == 200
    assert state.scenario.played() == []


def test_stale_refresh_cannot_discard_decisions(workspace):
    root, state, client = workspace
    client.post('/api/events/play', json={'base_version': 0})
    delay_source(root)
    assert client.post('/api/sources/refresh', json={'base_version': 0, 'reset_scenario': True}).status_code == 409
    assert state.scenario.played() == ['E1']


@pytest.mark.parametrize('key,value', [('repair_after_part_days.min', 3), ('repair_after_part_days.max', 1),
                                      ('bands.yellow', .99), ('program_office_release_days.min', 6)])
def test_invalid_assumptions_preview_and_apply_do_not_mutate(workspace, key, value):
    _, state, client = workspace
    body = {'base_version': 0, 'kind': 'set_assumption', 'key': key, 'value': value}
    for endpoint in ('/api/preview', '/api/changes'):
        response = client.post(endpoint, json=body)
        assert response.status_code == 422, response.text
        assert state.scenario.version == 0 and state.scenario.changes == []
        assert not state.scenario.log_path.exists()


def test_invalid_ship_and_page_are_client_errors(workspace):
    _, _, client = workspace
    assert client.post('/api/actions/parse', json={'ship_id': 'UNMAPPED', 'text': 'shift mission'}).status_code == 422
    assert client.get('/api/source', params={'file': 'KESSLER/daily_reports/daily_status_KESSLER_20261105.pdf', 'loc': 'page 999'}).status_code == 422


def test_missing_required_source_is_unknown_not_green(data_dir, offline_client, tmp_path):
    root = tmp_path / 'incomplete'
    shutil.copytree(data_dir, root)
    (root / 'KESSLER/csmp.csv').unlink()
    state = AppState(root, tmp_path / 'log.jsonl', offline_client)
    client = TestClient(create_app(state))
    data = client.get('/api/dashboard').json()
    for m in data['forecast']['missions']:
        if m['ship_id'] == 'KESSLER':
            assert m['p_ready'] is None and m['p_assessed'] is None and m['band'] == 'UNKNOWN'
            assert m['coverage_issues']
    assert client.get('/api/fixes/KESSLER').json()['candidates'] == []
    assert client.post('/api/brief', json={'ship_id': 'KESSLER'}).status_code == 200
    assert client.get('/api/ready').status_code == 503


def test_duplicate_quals_do_not_inflate_people(workspace):
    root, state, client = workspace
    before = client.get('/api/forecast').json()['missions']
    change_csv(root, 'KESSLER/quals.csv', lambda rows: rows + [copy.deepcopy(rows[0])])
    assert refresh(client, state).status_code == 200
    assert client.get('/api/forecast').json()['missions'] == before


def test_conflicting_revision_rejected(workspace):
    root, state, client = workspace
    def alter(rows):
        row = copy.deepcopy(rows[0]); row['qual_status'] = 'EXPIRED'
        return rows + [row]
    change_csv(root, 'KESSLER/quals.csv', alter)
    assert refresh(client, state).status_code == 422
    assert state.scenario.version == 0


def test_newer_qualification_revision_replaces_old(workspace):
    root, state, client = workspace
    def alter(rows):
        row = copy.deepcopy(next(r for r in rows if r['watchstation_code'] == '4310'))
        row.update(qual_status='EXPIRED', as_of='2026-11-04T07:00:00Z')
        return rows + [row]
    change_csv(root, 'KESSLER/quals.csv', alter)
    assert refresh(client, state).status_code == 200
    rows = state.view().rows('KESSLER', 'quals.csv')
    assert sum(r['watchstation_code'] == '4310' and r['qual_status'] == 'QUALIFIED' for r in rows) == 2


def test_alternate_json_export_same_engine(workspace, monkeypatch, tmp_path, offline_client):
    root, state, client = workspace
    expected = client.get('/api/forecast').json()['missions']
    exported = tmp_path / 'json-export'
    export_json(root, exported)
    monkeypatch.setenv('MISSIONTWIN_ADAPTER', 'json-export')
    alternate = AppState(exported, tmp_path / 'alt.jsonl', offline_client)
    assert alternate.baseline.coverage() == {s: [] for s in alternate.baseline.profile.ship_ids}
    assert alternate.fc()['missions'] == expected
    assert alternate.sources()['adapter'] == 'json-export'
    viewer = TestClient(create_app(alternate))
    record = viewer.get('/api/source', params={'file': 'KESSLER/roster.csv'}).json()
    assert record['meta']['original_file'] == 'KESSLER/roster.csv.json'
    assert viewer.get('/api/source', params={'file': record['meta']['original_file']}).status_code == 200
    assert not (exported / 'KESSLER/roster.csv').exists(), 'adapter must not write back to input'


def test_profile_weights_and_clock_are_loaded(workspace):
    root, state, client = workspace
    tree_path = root / 'squadron/mission_equipment_tree.json'
    tree = json.loads(tree_path.read_text())
    systems = tree['missions'][0]['tasks'][0]['functional_areas'][0]['systems']
    systems[0]['weight'], systems[1]['weight'] = .4, .3
    systems[0]['name'] = 'Profile-configured radar'
    tree['scoring']['critical_child_cap'] = .45
    tree_path.write_text(json.dumps(tree))
    (root / 'squadron/dataset_profile.json').write_text(json.dumps({'schema_version': 1, 'name': 'alternate',
        'mapping_version': 'test-2', 'scenario_now': '2026-11-04T00:00:00Z', 'ships': SHIPS, 'watchstations': WATCHSTATIONS}))
    response = refresh(client, state)
    assert response.status_code == 200, response.text
    data = client.get('/api/dashboard').json()
    assert data['sources']['profile'] == 'alternate'
    assert data['state']['scenario_now'] == '2026-11-04T00:00:00Z'
    assert data['forecast']['day0'] == data['state']['scenario_now']
    assert data['visualization']['systems'][0]['name'] == 'Profile-configured radar'
    assert state.baseline.profile.areas['AW'][1][0][1] == .4
    assert state.baseline.profile.critical_cap == .45


def test_alternate_unit_and_equipment_are_not_bound_to_demo_constants(workspace):
    root, state, client = workspace
    (root / 'squadron/dataset_profile.json').write_text(json.dumps({'schema_version': 1, 'name': 'replacement', 'ships': SHIPS}))
    for path in list(root.rglob('*')):
        if path.suffix in ('.csv', '.json', '.txt', '.yaml'):
            text = path.read_text(encoding='utf-8').replace('KESSLER', 'ORION').replace('SPY1D', 'RADARX')
            path.write_text(text, encoding='utf-8')
    (root / 'KESSLER').rename(root / 'ORION')
    response = refresh(client, state)
    assert response.status_code == 200, response.text
    data = client.get('/api/dashboard').json()
    assert data['state']['ships'][0]['ship_id'] == 'ORION'
    assert 'RADARX' in data['forecast']['ships']['ORION']['systems']
    assert 'SPY1D' not in data['forecast']['ships']['ORION']['systems']
    assert client.get('/api/graph/ORION').status_code == 200
    assert client.get('/api/fixes/ORION').status_code == 200
    assert client.post('/api/brief', json={'ship_id': 'ORION'}).status_code == 200
    unmapped = next(s for s in data['visualization']['systems'] if s['eic'] == 'RADARX')
    assert unmapped['mounts'] == []


def test_invalid_profile_tree_and_event_cycle_rejected(workspace):
    root, state, client = workspace
    path = root / 'squadron/events_missions.json'
    events = json.loads(path.read_text())
    events['events'][0]['prerequisite_events'] = [events['events'][1]['event_id']]
    path.write_text(json.dumps(events))
    assert refresh(client, state).status_code == 422
    assert state.scenario.version == 0


def lapse_trainer_mid_mission(root):
    """CIC trainer expires 20 NOV, inside Mission A (16-22 NOV), with no refresh scheduled."""
    def alter(rows):
        for row in rows:
            if row['requirement_id'].startswith('TRQ-AW-07'):
                row['scheduled_refresh'] = ''
        return rows
    change_csv(root, 'KESSLER/training_readiness.csv', alter)


def test_trainer_refresh_scheduled_underway_is_rejected(workspace):
    root, state, client = workspace
    def alter(rows):
        for row in rows:
            if row['requirement_id'].startswith('TRQ-AW-07'):
                row['scheduled_refresh'] = '2026-11-21'  # inside Mission A's underway block, 16-22 NOV
        return rows
    change_csv(root, 'KESSLER/training_readiness.csv', alter)
    response = refresh(client, state)
    assert response.status_code == 422 and 'underway block SCH-KESSLER-05' in response.text
    assert state.scenario.version == 0
    # Loaded directly, the record makes the ship's evidence insufficient instead of silently counting.
    assert any('team trainers run in port' in reason for reason in load_baseline(root).coverage()['KESSLER'])


def test_canonical_trainer_refresh_is_in_port_and_missions_are_assessable(workspace):
    _, _, client = workspace
    missions = {m['event_id']: m for m in client.get('/api/forecast').json()['missions']}
    for event_id in ('EVT-KESSLER-01', 'EVT-KESSLER-02'):
        assert missions[event_id]['p_assessed'] > .5, event_id
        assert missions[event_id]['planned']['result'] == 'MAKE', event_id


def test_interval_only_blocker_drives_headline_graph_and_options(workspace):
    root, state, client = workspace
    lapse_trainer_mid_mission(root)
    assert refresh(client, state).status_code == 200
    fc = client.get('/api/forecast').json()
    mission = fc['missions'][0]
    assert mission['p_ready'] > .8 and mission['p_assessed'] == 0
    assert mission['band'] == 'RED'
    assert mission['next_domino'].startswith('training:')
    # The planned case judges the same window, so it cannot claim MAKE while the assessment is zero.
    assert mission['planned']['result'] == 'MISS'
    assert any(c['gate_id'].startswith('training:') for c in mission['planned']['chain'])
    graph = client.get('/api/graph/KESSLER', params={'event_id': mission['event_id']}).json()
    assert next(n for n in graph['nodes'] if n['kind'] == 'mission')['p'] == mission['p_assessed']
    assert any(any(s['kind'] == 'schedule_training' for s in c['steps']) for c in client.get('/api/fixes/KESSLER').json()['candidates'])
    # The daily series is a fixed 30-day cursor window (DEV2 contract); interval assessment is computed
    # separately, so events ending beyond the window are still assessed.
    assert len(fc['grid_dates']) == 30
    assert all(m['p_assessed'] is not None for m in fc['missions'] if m['end'] > fc['grid_dates'][-1])
    small = forecast(build_world(state.scenario), detail=False)
    assert small['missions'][0]['p_assessed'] == mission['p_assessed']


def test_source_usage_and_reported_baseline_are_explicit(workspace):
    _, _, client = workspace
    data = client.get('/api/dashboard').json()
    by_file = {r['file']: r for r in data['sources']['sources']}
    assert by_file['KESSLER/insurv_findings.csv']['usage'] == 'not_modeled'
    assert by_file['KESSLER/watchbill.csv']['usage'] == 'review_only'
    assert data['forecast']['reported_baseline']['KESSLER'][0]['source']['file'].endswith('readiness_baseline.csv')
