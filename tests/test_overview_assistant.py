import copy

import pytest
from fastapi.testclient import TestClient

from missiontwin.api import AppState, create_app
from missiontwin.overview import OverviewRequest, answer, packet, projection
from missiontwin.visualization import registry


@pytest.fixture()
def overview(data_dir, tmp_path, offline_client):
    state = AppState(data_dir, tmp_path / 'overview.jsonl', offline_client)
    return state, TestClient(create_app(state))


def body(state, **kwargs):
    return dict(unit_id='KESSLER', base_version=state.scenario.version,
                source_revision=state.baseline.source_revision, **kwargs)


@pytest.mark.parametrize('unit', ['KESSLER', 'NSNORFOLK', 'NSAHR'])
def test_projection_counts_sources_and_read_only(overview, unit):
    state, client = overview
    before = state.scenario.digest(), state.scenario.version
    result = client.post('/api/overview-assistant/brief', json={**body(state), 'unit_id': unit})
    assert result.status_code == 200, result.text
    data = result.json()
    assert sum(data['summary']['counts'].values()) == data['summary']['total']
    assert data['identity']['unit_id'] == unit
    assert data['answer']['method'] == 'template'
    for source in data['evidence']:
        assert source['file'].startswith(unit + '/')
        assert 'status_history' not in source['fields']
        assert not any(k.startswith('_') for k in source['fields'])
        assert source['source_revision'] == state.baseline.source_revision
    assert before == (state.scenario.digest(), state.scenario.version)
    assert not state.scenario.log_path.exists()


def test_temporal_history_and_aggregate_not_top_k(overview):
    state, client = overview
    data = client.post('/api/overview-assistant/brief', json=body(state)).json()
    reqs = [r for r in data['evidence'] if r['file'].endswith('requisition_status.csv')]
    expected = state.view().requisitions('KESSLER')
    assert len(reqs) == len(expected)
    for source, row in zip(reqs, expected):
        assert source['fields']['doc_number'] == row['doc_number']
        assert source['fields']['status_code'] == row['status_code']
        assert 'status_history' not in source['text']
    # Full count is independent of bounded retrieval results.
    assert len(data['answer']['evidence_ids']) <= 6
    assert data['facts'][0]['text'].startswith(str(data['summary']['total']))


def test_stale_scope_and_origin_rejected(overview):
    state, client = overview
    assert client.post('/api/overview-assistant/brief', json={**body(state), 'source_revision': 'old'}).status_code == 409
    assert client.post('/api/overview-assistant/brief', json=body(state, focus='../../.env')).status_code == 422
    assert client.post('/api/overview-assistant/brief', json=body(state), headers={'Origin': 'https://evil.example'}).status_code == 403
    assert client.post('/api/overview-assistant/brief', json=body(state, packet_id='old')).status_code == 409
    assert client.post('/api/overview-assistant/brief', json=body(state, question='x'*1001)).status_code == 422


def test_filter_and_focus(overview):
    state, client = overview
    data = client.post('/api/overview-assistant/brief', json=body(state, focus='SPY1D', status_filter='all')).json()
    assert len([f for f in data['facts'] if f['id'].startswith('system:')]) == 1
    filtered = client.post('/api/overview-assistant/brief', json=body(state, status_filter='risk')).json()
    assert filtered['counts']['ready'] == 0
    assert filtered['summary']['total'] >= sum(filtered['counts'].values())


def test_model_only_selects_verified_claims_and_fallback(overview):
    state, _ = overview
    request = OverviewRequest(**body(state, question='why this status?', explain=True))
    data = packet(state, request, state.fc(), registry(state.baseline.profile))
    class FakeClient:
        def run(self, task, messages, input_bytes, validate, **kwargs):
            assert task == 'overview'
            return validate({'fact_ids': ['counts'], 'evidence_ids': []}), 'llm'
    assert answer(FakeClient(), data, request)['method'] == 'llm'
    class BadClient:
        def run(self, task, messages, input_bytes, validate, **kwargs):
            from missiontwin.llm import LLMUnavailable
            try:
                validate({'fact_ids': ['invented'], 'evidence_ids': []})
            except ValueError as error:
                raise LLMUnavailable(str(error))
    assert answer(BadClient(), data, request)['method'] == 'template'
    assert answer(state.client, data, request.model_copy(update={'question': 'approve this fix'}))['fact_ids'] == []


def test_evidence_resolution_and_status_do_not_expose_secrets(overview):
    state, client = overview
    data = client.post('/api/overview-assistant/brief', json=body(state)).json()
    source = data['evidence'][0]
    params = {**body(state), 'packet_id': data['packet_id']}
    response = client.get('/api/overview-assistant/evidence/' + source['id'], params=params)
    assert response.status_code == 200
    assert response.json()['evidence'] == source
    assert client.get('/api/overview-assistant/evidence/unknown', params=params).status_code == 404
    assert client.get('/api/overview-assistant/evidence/' + source['id'], params={**params, 'source_revision': 'old'}).status_code == 409
    status = client.get('/api/overview-assistant/status').json()
    assert status['embedding_model'] == 'Xenova/all-MiniLM-L6-v2'
    assert 'api_key' not in str(status)
    assert 'base_url' not in str(status)


def test_projection_unknown_not_zero(overview):
    state, _ = overview
    fc = copy.deepcopy(state.fc())
    for mission in fc['missions']:
        if mission['ship_id'] == 'KESSLER':
            for gate in mission['gates']:
                gate['p_ok'] = None
    result = projection(fc, registry(state.baseline.profile), 'KESSLER')
    assert result['counts']['unknown'] > 0
    assert all(s['p'] is None for s in result['systems'] if s['basis'] == 'sampled_event_interval')
