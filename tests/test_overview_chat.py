import copy
import json
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from missiontwin.api import AppState, create_app
from missiontwin.llm import LLMClient
from missiontwin.overview_chat import render_answer


def generated():
    return {'answer_status': 'supported', 'sections': [{'heading': 'Bottom line', 'sentences': [
        {'segments': [{'type': 'text', 'text': 'The current overview has '},
                      {'type': 'value', 'support_id': 'counts', 'field': 'ready'},
                      {'type': 'text', 'text': ' systems meeting the displayed criterion. This count is not a mission success probability.'}], 'support_ids': ['counts']}
    ]}]}


@pytest.fixture()
def chat(data_dir, tmp_path, offline_client):
    state = AppState(data_dir, tmp_path/'chat-log.jsonl', offline_client)
    client = TestClient(create_app(state))
    return state, client


def create(state, client, unit='KESSLER'):
    response = client.post('/api/overview-assistant/conversations', json={
        'unit_id': unit, 'base_version': state.scenario.version, 'source_revision': state.baseline.source_revision})
    assert response.status_code == 200, response.text
    return response.json()


def send(client, session, question='Summarize this unit'):
    return client.post(f'/api/overview-assistant/conversations/{session["id"]}/messages', json={
        'packet_id': session['packet_id'], 'question': question})


@pytest.mark.parametrize('unit', ['KESSLER','NSNORFOLK'])
def test_offline_chat_citations_history_restore_and_clear(chat, unit):
    state, client = chat
    before = state.scenario.digest(), state.scenario.version
    session = create(state, client, unit)
    response = send(client, session)
    assert response.status_code == 200
    data = response.json()
    assert len(data['messages']) == 2 and not data['busy']
    assistant = data['messages'][-1]
    assert assistant['method'] == 'template'
    assert assistant['citations'][0]['support']['identity']['unit_id'] == unit
    assert assistant['sections'][0]['sentences'][0]['citations'] == [1]
    response = send(client, session, 'Explain that concern')
    assert len(response.json()['messages']) == 4
    assert client.get('/api/overview-assistant/conversations/'+session['id']).json()['messages'] == response.json()['messages']
    assert before == (state.scenario.digest(), state.scenario.version)
    assert client.delete('/api/overview-assistant/conversations/'+session['id']).status_code == 200
    assert client.get('/api/overview-assistant/conversations/'+session['id']).status_code == 404


def test_live_schema_values_and_unknown_ids(chat, tmp_path):
    state, client = chat
    calls=[]
    def handler(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps(generated())}}]})
    state.client=LLMClient(base_url='https://mock.test/v1',model='test',demo_mode=False,
                           cache_dir=tmp_path/'cache',transport=httpx.MockTransport(handler))
    session=create(state,client)
    data=send(client,session).json()['messages'][-1]
    assert data['method']=='llm'
    assert str(session['packet']['counts']['ready']) in data['text']
    assert len(data['citations'])==1
    send(client,session,'Explain that number')
    context=json.loads(calls[-1]['messages'][1]['content'])
    assert context['recent_turns'][-1]['referenced_supports']==['counts']
    assert context['recent_turns'][-2]['role']=='user'


def test_render_rejects_unsupported_values_numbers_and_citations():
    supports={'counts':{'id':'counts','values':{'ready':3},'input_ids':[]}}
    assert '3' in render_answer(generated(),supports)['sections'][0]['sentences'][0]['text']
    for mutation in ['id','number','field','uncited']:
        output=copy.deepcopy(generated()); sentence=output['sections'][0]['sentences'][0]
        if mutation=='id':sentence['support_ids']=['invented']
        elif mutation=='number':sentence['segments'][0]['text']='There are 999 systems'
        elif mutation=='field':sentence['segments'][1]['field']='invented'
        else:sentence['support_ids']=[]
        with pytest.raises(ValueError):render_answer(output,supports)


def test_invalid_generation_has_one_correction_then_fallback(chat,tmp_path):
    state,client=chat; calls=[]
    def handler(request):
        calls.append(request)
        return httpx.Response(200,json={'choices':[{'message':{'content':'{"invented":"unsafe"}'}}]})
    state.client=LLMClient(base_url='https://mock.test/v1',model='test',demo_mode=False,cache_dir=tmp_path/'cache',transport=httpx.MockTransport(handler))
    data=send(client,create(state,client)).json()['messages'][-1]
    assert len(calls)==2
    assert data['method']=='template' and data['fallback_reason']=='invalid_answer_or_citations'


def test_stale_expired_cross_origin_and_owner_isolation(chat):
    state,client=chat; session=create(state,client)
    alien=TestClient(client.app)
    assert alien.get('/api/overview-assistant/conversations/'+session['id']).status_code==404
    assert client.post('/api/overview-assistant/conversations',headers={'Origin':'https://evil.test'},json={'unit_id':'KESSLER','base_version':state.scenario.version,'source_revision':state.baseline.source_revision}).status_code == 403
    assert send(client,session,'approve this fix').json()['messages'][-1]['answer_status']=='out_of_scope'
    state.scenario.version+=1
    assert client.get('/api/overview-assistant/conversations/'+session['id']).json()['stale']
    assert send(client,session).status_code==409
    store=client.app.state.overview_conversations
    store.sessions[session['id']]['touched']=time.monotonic()-1801
    assert client.get('/api/overview-assistant/conversations/'+session['id']).status_code==410


def test_inflight_state_change_busy_and_memory_limits(chat,tmp_path):
    state,client=chat; session=create(state,client)
    store=client.app.state.overview_conversations
    store.sessions[session['id']]['busy']=True
    assert send(client,session).status_code==409
    store.sessions[session['id']]['busy']=False
    store.MAX_BYTES=1
    assert send(client,session).status_code==429
    assert store.sessions[session['id']]['messages']==[]
    store.MAX_BYTES=8_000_000
    def handler(request):
        state.scenario.version+=1
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps(generated())}}]})
    state.client=LLMClient(base_url='https://mock.test/v1',model='test',demo_mode=False,cache_dir=tmp_path/'cache',transport=httpx.MockTransport(handler))
    assert send(client,session).status_code==409
    assert store.sessions[session['id']]['messages']==[]


def test_limits_and_no_historical_evidence_substitution(chat):
    state,client=chat; session=create(state,client)
    original=send(client,session).json()['messages'][-1]['citations']
    state.scenario.version+=1
    restored=client.get('/api/overview-assistant/conversations/'+session['id']).json()
    assert restored['messages'][-1]['citations']==original
    assert restored['stale']
    assert client.post(f'/api/overview-assistant/conversations/{session["id"]}/messages',json={'packet_id':session['packet_id'],'question':'x'*1501}).status_code==422
