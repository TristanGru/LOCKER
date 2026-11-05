"""Shared policy and mission adapter regression tests; no live provider requests."""
import copy
import json

import httpx
import pytest

from conftest import signed_in
from missiontwin.api import AppState, create_app
from missiontwin.assistant_policy import assistant_client
from missiontwin.llm import LLMClient


@pytest.mark.parametrize('demo,flag,enabled', [(False,None,True),(True,None,False),(False,'0',False),(True,'1',True)])
def test_policy_does_not_enable_ingestion(monkeypatch,tmp_path,demo,flag,enabled):
    monkeypatch.delenv('LOCKER_DAVEY_LIVE',raising=False)
    if flag is not None:monkeypatch.setenv('LOCKER_DAVEY_LIVE',flag)
    shared=LLMClient(base_url='https://model.test/v1',api_key='test',demo_mode=demo,cache_dir=tmp_path)
    assert assistant_client(shared).configured is enabled
    assert shared.demo_mode is demo
    assert shared.sent_prompts==[]


def create(client,state,view='missions',**extra):
    response=client.post('/api/overview-assistant/conversations',json={
        'unit_id':'KESSLER','base_version':state.scenario.version,
        'source_revision':state.baseline.source_revision,'view':view,'event_id':'EVT-KESSLER-01',**extra})
    assert response.status_code==200,response.text
    return response.json()


def send(client,session,**extra):
    return client.post('/api/overview-assistant/conversations/'+session['id']+'/messages',json={
        'packet_id':session['packet_id'],'question':'Explain the selected assessment',**extra})


@pytest.mark.parametrize('view',['missions','dominoes'])
def test_mission_chat_live_citations_history_idempotency_and_ownership(data_dir,tmp_path,monkeypatch,view):
    monkeypatch.delenv('LOCKER_DAVEY_LIVE',raising=False)
    calls=[]
    def handler(request):
        body=json.loads(request.content);calls.append(body)
        context=json.loads(body['messages'][1]['content'])
        assert context['identity']['view']==view
        assert 'forecast_claims' not in context # common typed supports own numerical claims
        output={'answer_status':'supported','sections':[{'heading':'Answer','sentences':[{
            'segments':[{'type':'text','text':'The selected modeled assessment is '},
                        {'type':'value','support_id':'mission:EVT-KESSLER-01','field':'p_assessed'}],
            'support_ids':['mission:EVT-KESSLER-01']}]}]}
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps(output)}}]})
    state=AppState(data_dir,tmp_path/'log.jsonl',LLMClient(base_url='https://model.test/v1',demo_mode=True,
        transport=httpx.MockTransport(handler),cache_dir=tmp_path/'cache'))
    state.client.demo_mode=False
    client=signed_in(create_app(state));before=state.scenario.digest(),state.scenario.version
    session=create(client,state,view)
    assert calls==[]
    assert '_domain' not in session['packet']
    result=send(client,session,request_id='same-question-request').json()
    answer=result['messages'][-1]
    assert answer['method']=='llm'
    assert answer['citations'][0]['support']['kind']=='modeled'
    assert answer['answer_status']=='partial'
    assert answer['domain_answer']['event_id']=='EVT-KESSLER-01'
    assert answer['domain_answer']['generation']['mode']=='llm'
    assert send(client,session,request_id='same-question-request').json()['messages']==result['messages']
    assert len(calls)==1
    monkeypatch.setenv('LOCKER_DAVEY_LIVE','0')
    cached_session=create(client,state,view)
    cached=send(client,cached_session).json()['messages'][-1]
    assert cached['method']=='cache'
    assert cached['domain_answer']['generation']['label']=='Cached LLM'
    assert len(calls)==1
    monkeypatch.delenv('LOCKER_DAVEY_LIVE')
    assert send(client,session,request_id='same-question-request',question='Different question').status_code==409
    follow=send(client,session,question='Why?')
    assert follow.status_code==200,follow.text
    assert len(follow.json()['messages'])==4
    assert json.loads(calls[-1]['messages'][1]['content'])['recent_turns'][-1]['referenced_supports']==['mission:EVT-KESSLER-01']
    alien=signed_in(client.app)
    assert alien.get('/api/overview-assistant/conversations/'+session['id']).status_code==404
    assert before==(state.scenario.digest(),state.scenario.version)
    state.davey_epoch='changed'
    assert client.get('/api/overview-assistant/conversations/'+session['id']).json()['stale']
    assert send(client,session).status_code==409


def test_mission_node_validation_fallback_and_temporal_scope(data_dir,tmp_path,offline_client):
    state=AppState(data_dir,tmp_path/'log.jsonl',offline_client)
    client=signed_in(create_app(state))
    invalid=client.post('/api/overview-assistant/conversations',json={'view':'dominoes','unit_id':'KESSLER',
        'event_id':'EVT-KESSLER-01','node_id':'invented','base_version':state.scenario.version,
        'source_revision':state.baseline.source_revision})
    assert invalid.status_code==422
    session=create(client,state,'dominoes',node_id='EVT-KESSLER-01')
    assert session['identity']['node_id']=='EVT-KESSLER-01'
    assert all(e['fields']['known_at']<=session['identity']['cursor'] for e in session['packet']['evidence'])
    response=send(client,session)
    assert response.status_code==200,response.text
    answer=response.json()['messages'][-1]
    assert answer['method']=='template'
    assert not answer['domain_answer']['proposed_nodes']
    assert 'No live analysis' in answer['domain_answer']['generation']['reason']


def test_unrecognized_extension_and_foreign_support_fall_back(data_dir,tmp_path,monkeypatch):
    monkeypatch.setenv('LOCKER_DAVEY_LIVE','1')
    calls=[]
    def handler(request):
        calls.append(request)
        output={'answer_status':'supported','sections':[{'heading':'Answer','sentences':[
            {'segments':[{'type':'text','text':'Unsupported'}],'support_ids':['invented']}]}]}
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps(output)}}]})
    state=AppState(data_dir,tmp_path/'log.jsonl',LLMClient(base_url='https://mock.test/v1',demo_mode=True,
        transport=httpx.MockTransport(handler),cache_dir=tmp_path/'cache'))
    state.client.demo_mode=False
    client=signed_in(create_app(state));session=create(client,state)
    result=send(client,session)
    assert result.status_code==200,result.text
    assert result.json()['messages'][-1]['method']=='template'
    assert len(calls)==2
