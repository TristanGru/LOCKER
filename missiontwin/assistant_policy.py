"""Assistant-only generation policy; never changes ingestion/action/brief clients."""
import copy
import os


def assistant_client(shared):
    client = copy.copy(shared)
    client.sent_prompts = []
    flag = os.environ.get('LOCKER_DAVEY_LIVE')
    if flag in {'0', '1'}:
        client.demo_mode = flag == '0'
    if flag == '1':
        client.base_url = client.base_url or 'https://api.openai.com/v1'
        client.api_key = client.api_key or os.environ.get('OPENAI_API_KEY', '')
        client.model = client.model if client.model not in ('', 'unconfigured') else 'gpt-4o-mini'
    if client.base_url.startswith('https://api.openai.com/') and not client.api_key:
        client.demo_mode = True
    return client


def assistant_status(shared):
    client = assistant_client(shared)
    mode = 'live-capable' if client.configured else 'offline' if client.demo_mode else 'unconfigured'
    reason = None
    if not client.configured:
        reason = ('disabled' if os.environ.get('LOCKER_DAVEY_LIVE') == '0' else
                  'missing_endpoint' if not client.base_url else
                  'missing_api_key' if client.base_url.startswith('https://api.openai.com/') and not client.api_key else
                  'demo_mode')
    return {'mode': mode, 'model': client.model, 'cache_policy': 'validated_cached_answers_allowed', 'reason': reason}
