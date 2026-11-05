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
