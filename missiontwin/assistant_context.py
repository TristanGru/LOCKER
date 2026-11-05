"""Mission/graph adapter for the shared, source-grounded conversation service."""
import hashlib
import json
import uuid
from datetime import UTC, datetime

from .davey import _fallback, validate_draft
from .davey_models import DaveyAskBody


def mission_packet(state, body):
    from .davey import identity_of
    identity = identity_of(state)
    request = DaveyAskBody(question='Capture context', ship_id=body.unit_id, event_id=body.event_id,
        node_id=body.node_id, expected_version=body.base_version,
        expected_source_revision=body.source_revision, expected_epoch=identity['epoch'],
        expected_scenario_digest=identity['scenario_digest'], expected_cursor=identity['exercise_cursor'],
        expected_source_health_at=identity['source_health_at'], request_id=uuid.uuid4().hex)
    domain, _ = state.davey._capture(request)
    identity = {**identity, 'unit_id': body.unit_id, 'version': identity['scenario_version'],
                'digest': identity['scenario_digest'], 'cursor': identity['exercise_cursor'],
                'view': body.view, 'event_id': domain.event_id, 'node_id': body.node_id}
    evidence = [{'id': e.id, 'kind': 'reported', 'file': e.file, 'loc': e.loc,
                 'fields': {'excerpt': e.excerpt, 'known_at': e.known_at, 'hedged': e.hedged,
                            'superseded': e.superseded,
                            'parser_annotations': json.dumps(e.fact_annotations)}, 'as_of': e.known_at}
                for e in domain.corpus[:300]]
    supports = {e['id']: {**e, 'identity': identity, 'values': e['fields'], 'input_ids': [],
                          'lineage': 'recorded_fields'} for e in evidence}
    for claim in domain.claims:
        sid = claim['id']
        files = (domain.linked_files if claim['kind'] == 'mission' else
                 set(domain.graph_targets.get(sid.removeprefix('gate:'), {}).get('source_files', [])))
        supports[sid] = {'id': sid, 'title': claim['label'], 'kind': 'modeled', 'basis': 'existing_forecast_engine',
            'values': {k: v for k, v in claim.items() if not isinstance(v, (list, dict))},
            'identity': identity, 'lineage': 'partial',
            'input_ids': [e['id'] for e in evidence if e['file'] in files],
            'input_references': [ref for ref in domain.mission.get('sources', []) if ref.get('file') in files],
            'model_inputs': [{'bands': domain.bands, 'source_health': domain.source_health}]}
    supports['limitations'] = {'id': 'limitations', 'kind': 'coverage', 'title': 'Context limits',
        'identity': identity, 'values': {'scope': 'One selected mission only. Cross-mission totals are not available.',
        'graph': json.dumps(list(domain.graph_targets.values()), default=str)}, 'input_ids': []}
    facts = [{'id': c['id'], 'kind': 'modeled', 'basis': 'existing_forecast_engine',
              'text': c['label'] + ': inspect the existing modeled assessment and its partial input lineage.',
              'evidence_ids': supports[c['id']]['input_ids']} for c in domain.claims]
    packet_id = hashlib.sha256(json.dumps({'identity': identity, 'supports': supports}, sort_keys=True, default=str).encode()).hexdigest()
    return {'packet_id': packet_id, 'identity': identity, 'evidence': evidence, 'supports': supports,
            'summary': {'systems': []}, 'facts': facts, 'queries': [], 'counts': {},
            'warnings': ['Read-only synthetic exercise. Model lineage is partial.',
                         'Evidence candidates are bounded to currently eligible records; retrieval may be incomplete.',
                         'Scope is the selected mission, not all missions. Emerging concerns require verification.'],
            '_domain': domain}


def mission_extensions(packet, draft, method):
    domain = packet['_domain']
    evidence = [e for e in domain.corpus if e.id in packet['supports']]
    base = _fallback(domain, evidence)
    if draft is not None and method in {'llm', 'cache'}:
        base = validate_draft({'answer': 'Inspect the cited modeled assessment.',
            'answer_claim_ids': [domain.claims[0]['id']], 'answer_evidence_ids': [], **draft}, domain, evidence)
    answer_id = uuid.uuid4().hex
    ids = {n['id']: f"proposal:{answer_id}:{n['id']}" for n in base['proposed_nodes']}
    return {'answer_id': answer_id, 'request_id': answer_id, 'identity': domain.identity,
        'ship_id': domain.ship_id, 'event_id': domain.event_id, 'requested_event_id': packet.get('requested_event_id'),
        'node_id': domain.node_id, 'question': '', **base,
        'forecast_claims': list(domain.claims), 'evidence': [e.public() for e in evidence],
        'coverage': {'searched': len(domain.corpus), 'returned': len(evidence), 'truncated': len(evidence)<len(domain.corpus), **domain.source_health},
        'proposed_nodes': [{**n, 'id': ids[n['id']], 'tentative': True} for n in base['proposed_nodes']],
        'proposed_links': [{**link, 'id': f"proposal-link:{answer_id}:{link['id']}",
            'dependent_id': ids.get(link['dependent_id'], link['dependent_id']),
            'dependency_id': ids.get(link['dependency_id'], link['dependency_id']), 'tentative': True} for link in base['proposed_links']],
        'generation': {'mode': 'fallback' if method == 'template' else method, 'label': {'llm': 'Live LLM', 'cache': 'Cached LLM', 'template': 'Deterministic fallback'}[method],
            'generated_at': datetime.now(UTC).isoformat(), 'reason': '' if method != 'template' else 'No live analysis was performed; emerging concerns were not assessed.'}}
