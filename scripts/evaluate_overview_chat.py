"""Opt-in live overview chat smoke evaluation against an existing local server.

Never resets exercise state. Creates/deletes its own conversations only. Reports
metadata, not prompts, provider credentials or source excerpts. Human factual
support/usefulness review is still required beyond these structural checks.
"""
import argparse
import json
from pathlib import Path
import time
from urllib.parse import urlsplit

import httpx


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:8000')
    parser.add_argument('--allow-live', action='store_true', help='Authorize synthetic context to the configured model')
    parser.add_argument('--report', type=Path, default=Path('logs/chat-live-evaluation.json'))
    args = parser.parse_args()
    if not args.allow_live:
        parser.error('--allow-live is required; model requests can incur costs')
    if urlsplit(args.url).hostname not in {'localhost', '127.0.0.1', '::1'}:
        parser.error('Only a local LOCKER server is supported')
    report = {'checks': [], 'human_review_required': True}
    with httpx.Client(base_url=args.url, timeout=180) as client:
        state = client.get('/api/scenario/version').raise_for_status().json()
        for unit in ('KESSLER', 'NSNORFOLK'):
            created = client.post('/api/overview-assistant/conversations', json={
                'unit_id': unit, 'base_version': state['version'], 'source_revision': state['source_revision']}).raise_for_status().json()
            try:
                for question in ('Summarize this unit', 'Explain the leading concern and show its supporting evidence'):
                    start = time.monotonic()
                    response = client.post('/api/overview-assistant/conversations/' + created['id'] + '/messages', json={
                        'packet_id': created['packet_id'], 'question': question}).raise_for_status().json()
                    answer = response['messages'][-1]
                    numbers = {c['number'] for c in answer['citations']}
                    assert all(n in numbers for section in answer['sections'] for sentence in section['sentences'] for n in sentence['citations'])
                    check = {'unit': unit, 'method': answer['method'], 'fallback_reason': answer.get('fallback_reason'),
                             'citation_count': len(numbers), 'words': len(answer['text'].split()),
                             'elapsed_seconds': round(time.monotonic() - start, 2), 'answer_status': answer['answer_status']}
                    report['checks'].append(check)
                    print(json.dumps(check), flush=True)
            finally:
                client.delete('/api/overview-assistant/conversations/' + created['id'])
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2))
    if any(c['method'] not in ('llm', 'cache') or not c['citation_count'] for c in report['checks']):
        raise SystemExit('Live generation acceptance not met; inspect safe report metadata')


if __name__ == '__main__':
    main()
