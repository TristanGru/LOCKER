import json

import httpx
import pytest

from missiontwin.llm import LLMClient, LLMUnavailable


def test_reasoning_model_parameter_adaptation(tmp_path):
    bodies = []
    def handler(request):
        body = json.loads(request.content)
        bodies.append(body)
        if 'max_tokens' in body:
            return httpx.Response(400, json={'error': {'code': 'unsupported_parameter', 'param': 'max_tokens'}})
        if 'temperature' in body:
            return httpx.Response(400, json={'error': {'code': 'unsupported_value', 'param': 'temperature'}})
        return httpx.Response(200, json={'choices': [{'message': {'content': '{"ok":true}'}}]})
    client = LLMClient(base_url='https://example.test/v1', model='reasoning-model', demo_mode=False,
                       cache_dir=tmp_path, transport=httpx.MockTransport(handler))
    assert client._post([{'role': 'user', 'content': 'Synthetic test'}], 1) == '{"ok":true}'
    assert len(bodies) == 3
    assert bodies[-1]['max_completion_tokens'] == 4096
    assert bodies[-1]['response_format'] == {'type': 'json_object'}
    assert 'max_tokens' not in bodies[-1] and 'temperature' not in bodies[-1]


def test_unrelated_provider_errors_do_not_weaken_schema(tmp_path):
    bodies = []
    def handler(request):
        bodies.append(json.loads(request.content))
        return httpx.Response(400, json={'error': {'code': 'unsupported_parameter', 'param': 'response_format'}})
    client = LLMClient(base_url='https://example.test/v1', model='model', demo_mode=False,
                       cache_dir=tmp_path, transport=httpx.MockTransport(handler))
    with pytest.raises(LLMUnavailable):
        client._post([{'role': 'user', 'content': 'Synthetic test'}], 1)
    assert len(bodies) == 2
    assert all(b['response_format'] == {'type': 'json_object'} for b in bodies)


@pytest.mark.parametrize('code,expected_calls', [('unsupported_value', 2), ('invalid_json_schema', 2)])
def test_strict_format_adaptation_keeps_validation(tmp_path,code,expected_calls):
    calls=[]
    def handler(request):
        body=json.loads(request.content);calls.append(body)
        if body['response_format']['type']=='json_schema':
            return httpx.Response(400,json={'error':{'code':code,'param':'response_format'}})
        return httpx.Response(200,json={'choices':[{'message':{'content':'{"ok":true}'}}]})
    client=LLMClient(base_url='https://mock.test/v1',demo_mode=False,cache_dir=tmp_path,transport=httpx.MockTransport(handler))
    schema={'type':'object','properties':{'ok':{'type':'boolean'}},'additionalProperties':False,'required':['ok']}
    if code=='unsupported_value':
        result,method=client.run('overview_chat',[{'role':'user','content':'Synthetic'}],b'test',lambda d:d['ok'],response_schema=schema)
        assert result is True and method=='llm'
        assert calls[-1]['response_format']=={'type':'json_object'}
    else:
        with pytest.raises(LLMUnavailable):
            client.run('overview_chat',[{'role':'user','content':'Synthetic'}],b'test',lambda d:d['ok'],response_schema=schema)
        assert all(c['response_format']['type']=='json_schema' for c in calls)
    assert len(calls)==expected_calls
