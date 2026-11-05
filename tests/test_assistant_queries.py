import httpx
import pytest
from conftest import signed_in
from missiontwin.api import AppState, create_app
from missiontwin.llm import LLMClient
from missiontwin.assistant_queries import OPEN_STATES


@pytest.mark.parametrize('view',['overview','missions','dominoes'])
def test_real_snapshot_deterministic_count_candidates_and_owner(data_dir,tmp_path,offline_client,view):
    state=AppState(data_dir,tmp_path/'activity.jsonl',offline_client)
    client=signed_in(create_app(state))
    before=state.scenario.digest(),state.scenario.version
    created=client.post('/api/overview-assistant/conversations',json={'view':view,'unit_id':'KESSLER',
        'event_id':'EVT-KESSLER-01' if view!='overview' else None,
        'base_version':state.scenario.version,'source_revision':state.baseline.source_revision})
    assert created.status_code==200,created.text
    session=created.json()
    assert not any(k.startswith('_') for k in session['packet'])
    candidates=client.post(f'/api/overview-assistant/conversations/{session["id"]}/candidates',json={
        'packet_id':session['packet_id'],'question':'HF transceiver maintenance'})
    assert candidates.status_code==200,candidates.text
    assert all(isinstance(r['text'],str) for r in candidates.json()['records'])
    assert len(candidates.json()['records'])<=300
    alien=signed_in(client.app)
    assert alien.post(f'/api/overview-assistant/conversations/{session["id"]}/candidates',json={
        'packet_id':session['packet_id'],'question':'pump'}).status_code==404
    expected=sum(r.get('job_state') in OPEN_STATES for r in state.view().rows('KESSLER','csmp.csv'))
    body={'packet_id':session['packet_id'],'question':'How many open jobs?','response_policy':'deterministic_only','request_id':'query-test-request'}
    response=client.post(f'/api/overview-assistant/conversations/{session["id"]}/messages',json=body)
    assert response.status_code==200,response.text
    answer=response.json()['messages'][-1]
    assert answer['intent']=='filtered_count'
    assert answer['citations'][0]['support']['values']['count']==expected
    assert before==(state.scenario.digest(),state.scenario.version)
    body['response_policy']='auto'
    assert client.post(f'/api/overview-assistant/conversations/{session["id"]}/messages',json=body).status_code==409


def test_deterministic_source_followup_uses_model_reference(data_dir,tmp_path,offline_client):
    state=AppState(data_dir,tmp_path/'activity.jsonl',offline_client)
    client=signed_in(create_app(state))
    s=client.post('/api/overview-assistant/conversations',json={'unit_id':'KESSLER','base_version':state.scenario.version,'source_revision':state.baseline.source_revision}).json()
    def ask(q):
        r=client.post(f'/api/overview-assistant/conversations/{s["id"]}/messages',json={'packet_id':s['packet_id'],'question':q,'response_policy':'deterministic_only'})
        assert r.status_code==200,r.text
        return r.json()['messages'][-1]
    first=ask('Explain the leading concern')
    assert len(first['referents']['entity_ids'])==1
    assert ask('Why?')['intent']=='status_explanation'
    assert ask('Show the supporting records')['intent']=='supporting_sources'
