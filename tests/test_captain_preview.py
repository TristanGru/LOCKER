"""Connected captain UI previews must use the real engine without mutating state."""
import pytest
from fastapi.testclient import TestClient
from missiontwin.api import AppState, create_app

@pytest.fixture
def captain(data_dir, offline_client, tmp_path):
    state = AppState(data_dir, tmp_path / 'captain.jsonl', offline_client)
    return TestClient(create_app(state)), state


def test_combined_preview_isolated(captain):
    client, state = captain
    result = client.post('/api/captain/preview', json={'base_version':0,'ship_id':'KESSLER','changes':[
        {'kind':'shiftMission','mission':'EVT-KESSLER-01','days':1},
        {'kind':'casrep','node':'EVT-KESSLER-01|system:SPY1D','category':'C3'}]})
    assert result.status_code == 200, result.text
    assert result.json()['persisted'] is False
    assert result.json()['after']['missions'][0]['start'] != result.json()['before']['missions'][0]['start']
    assert state.scenario.version == 0 and not state.scenario.changes
    assert not state.scenario.log_path.exists()


def test_cross_ship_and_stale_preview_rejected(captain):
    client, state = captain
    body={'base_version':0,'ship_id':'ASHBY','changes':[{'kind':'shiftMission','mission':'EVT-KESSLER-01','days':1}]}
    assert client.post('/api/captain/preview',json=body).status_code == 422
    body['base_version']=10
    assert client.post('/api/captain/preview',json=body).status_code == 409
    assert state.scenario.version == 0


def test_invalid_batch_rolls_back_disposable_fork(captain):
    client, state = captain
    result=client.post('/api/captain/preview',json={'base_version':0,'ship_id':'KESSLER','changes':[
        {'kind':'shiftMission','mission':'EVT-KESSLER-01','days':1},
        {'kind':'removePerson','node':'member:DOES-NOT-EXIST'}]})
    assert result.status_code == 422
    assert state.scenario.version == 0 and not state.scenario.changes


def test_concurrent_initial_requests_share_one_state(captain, monkeypatch):
    import time
    from concurrent.futures import ThreadPoolExecutor
    import missiontwin.api as module
    _, state = captain
    calls = []
    def factory():
        calls.append(1)
        time.sleep(.02)
        return state
    monkeypatch.setattr(module, 'AppState', factory)
    app = module.create_app()
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: app.state.get(), range(16)))
    assert all(result is state for result in results)
    assert len(calls) == 1
