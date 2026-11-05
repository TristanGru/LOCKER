"""Versioned, server-authored deterministic answers over captured supports."""
import copy
import hashlib
import json
from .assistant_intents import plan_question, INTENTS
from .assistant_queries import query_records
from .assistant_retrieval import rank_records

VERSION = 'deterministic-v1'
REGISTRY = {intent: {'id': intent, 'version': VERSION} for intent in INTENTS}


def deterministic_answer(packet, supports, question, history=(), semantic_ids=(), reason='offline'):
    plan = plan_question(question, packet, supports, history)
    supports = copy.deepcopy(supports)
    citations, sentences = [], []
    chosen_entities = list(plan.entity_ids)

    def add(text, ids=()):
        numbers = []
        for sid in dict.fromkeys(ids):
            if sid not in supports: continue
            existing = next((c for c in citations if c['support_id'] == sid), None)
            if not existing:
                support = copy.deepcopy(supports[sid])
                support['input_evidence'] = [copy.deepcopy(supports[i]) for i in support.get('input_ids', [])[:12] if i in supports]
                existing = {'number': len(citations)+1, 'support_id': sid, 'support': support}
                citations.append(existing)
            numbers.append(existing['number'])
        sentences.append({'text': text, 'citations': numbers})

    def record(row):
        sid = row['id']
        supports[sid] = {**row, 'values': row.get('values', row['fields']), 'identity': packet['identity']}
        values = row['fields']
        if 'excerpt' in values:
            add('Reported excerpt: “' + values['excerpt'] + '” Known at ' + str(values.get('known_at', row.get('as_of', 'Unknown'))) +
                ('. Superseded report; historical only.' if values.get('superseded') else '.') +
                (' Wording is uncertain.' if values.get('hedged') else ''), [sid])
        else:
            fields = [k for k in ('jcn', 'equipment_noun', 'job_state', 'doc_number', 'nomenclature', 'status_code', 'esd',
                'cert_name', 'requirement_name', 'status', 'expires', 'scheduled_refresh', 'remarks') if values.get(k) is not None]
            add('Recorded ' + '; '.join(k.replace('_', ' ') + ': ' + str(values[k]) for k in fields) + '.', [sid])
        return sid

    def model(sid):
        support = supports[sid]
        values = support['values']
        label = values.get('display_name', values.get('label', support.get('title', sid)))
        if sid.startswith('mission:'):
            text = f"{label}: modeled interval assessment {display(values.get('p_assessed'))}; at start {display(values.get('p_ready_at_start'))}; band {values.get('band', 'Unknown')}."
            text += f" Event window {values.get('start', 'Unknown')} to {values.get('end', 'Unknown')}."
            if values.get('next_domino'): text += ' Leading modeled requirement: ' + str(values['next_domino']) + '.'
        elif sid.startswith('gate:'):
            text = f"{label}: existing modeled requirement assessment {display(values.get('p_ok'))}."
        else:
            text = f"{label}: {values.get('status', 'Unknown')}; {values.get('display_probability', 'Unknown')}. Basis: {support.get('basis', 'existing model')}."
        add(text + ' This is a model assessment with partial lineage, not a source quote or complete causal proof.', [sid])
        if sid not in chosen_entities: chosen_entities.append(sid)

    # Add captured forecast supports without parsing labels or graph strings.
    for mission in packet.get('_missions', []):
        sid = 'mission:' + mission['event_id']
        if sid not in supports:
            supports[sid] = {'id': sid, 'kind': 'modeled', 'title': mission.get('codename') or mission['name'],
                'identity': packet['identity'], 'lineage': 'partial', 'input_ids': [],
                'values': {'label': mission.get('codename') or mission['name'], 'p_assessed': mission.get('p_assessed'),
                    'p_ready_at_start': mission.get('p_ready'), 'band': mission.get('band'), 'start': mission['start'],
                    'end': mission['end'], 'next_domino': mission.get('next_domino')}}
    status = 'partial'
    scope = {'unit': packet['identity']['unit_id'], 'mission': packet['identity'].get('event_id'),
             'node': packet['identity'].get('node_id'), 'cursor': packet['identity']['cursor']}
    query_id = None
    coverage = {'complete': False, 'basis': 'captured_supports'}
    if plan.outcome != 'supported':
        add(plan.reason or 'Please name a system, mission or exact record identifier.')
        status = 'out_of_scope' if plan.outcome == 'out_of_scope' else 'insufficient_evidence'
    elif plan.intent in {'unit_summary', 'status_list'} or plan.intent == 'filtered_count' and plan.table == 'systems':
        systems = packet['summary']['systems']
        if not systems:
            add('A complete system population is not available in this mission context. Use Ship or Shore Overview for system lists and counts.', ['limitations'])
            status = 'insufficient_evidence'
        else:
            rows = [s for s in systems if not plan.status or s['status'] == plan.status]
            # Overview summary respects the captured filter and system focus.
            rows = [s for s in rows if (not packet['identity'].get('focus') or s['eic'] == packet['identity']['focus']) and
                    (packet['identity'].get('filter', 'all') == 'all' or s['status'] == packet['identity']['filter'])]
            add(f"{len(rows)} systems/capabilities match the selected scope" + (f" and status {plan.status}" if plan.status else '') + '. This is a system count, not mission success probability.', ['counts'])
            if plan.intent != 'filtered_count':
                for row in rows[:4]: model('system:' + row['eic'])
            coverage = {'complete': True, 'total': len(rows), 'displayed': min(4, len(rows)) if plan.intent != 'filtered_count' else 0}
            if plan.status or plan.intent == 'filtered_count':
                query_id = 'query:systems'
                supports[query_id] = {'id': query_id, 'kind': 'aggregate', 'title': 'Filtered modeled system count', 'identity': packet['identity'],
                    'values': {'count': len(rows)}, 'input_ids': [], 'calculation': {'operation': 'count_modeled_systems',
                        'filters': plan.model_dump(), 'scope': scope, 'complete': True, 'contributing_keys': [r['eic'] for r in rows]}}
                add('Filtered population computed from the captured modeled system projection.', [query_id])
                sentences[0]['citations'] = sentences[-1]['citations']
    elif plan.intent in {'mission_summary', 'status_explanation', 'assessment_comparison'}:
        ids = plan.entity_ids or ([next(s for s in supports if s.startswith('mission:'))] if '_domain' in packet else
            [f['id'] for f in packet['facts'] if f['id'].startswith('system:')][:1])
        if not ids:
            add('Select a mission or system to inspect its existing assessment.', ['limitations'])
            status = 'insufficient_evidence'
        for sid in ids[:2]:
            if sid not in supports: continue
            model(sid)
            for eid in supports[sid].get('input_ids', [])[:2]:
                if eid in supports: record({**supports[eid], 'fields': supports[eid]['values']})
        if plan.intent == 'mission_summary':
            gates = [sid for sid in supports if sid.startswith('gate:')]
            gates.sort(key=lambda sid: (supports[sid]['values'].get('p_ok') is not None, supports[sid]['values'].get('p_ok') or 0, sid))
            for sid in gates[:2]: model(sid)
        if plan.intent == 'assessment_comparison':
            add('At-start and sampled event-interval assessments use different time bases. This does not establish a continuous-time guarantee.', ['limitations'])
    elif plan.intent in {'record_lookup', 'maintenance_status', 'supply_status_eta', 'filtered_count', 'training_certification_window'}:
        if plan.intent == 'training_certification_window' and not plan.table: plan.table = 'cert_status.csv'
        result = query_records(plan, packet)
        coverage = {k: v for k, v in result.items() if k != 'rows'}
        if not result['complete']:
            add(result['reason'], ['limitations']); status = 'insufficient_evidence'
        else:
            rows = result['rows']
            if plan.intent == 'training_certification_window':
                status = 'insufficient_evidence'
                add('These are recorded training/certification statuses and dates. Event-window applicability and scheduled refresh effects are not inferred; inspect the modeled requirement separately.', ['limitations'])
            if plan.intent == 'filtered_count':
                query_id = 'query:' + hashlib.sha256(json.dumps(result['filters'], sort_keys=True).encode()).hexdigest()[:16]
                supports[query_id] = {'id': query_id, 'kind': 'aggregate', 'title': 'Complete eligible record count',
                    'identity': packet['identity'], 'values': {'count': len(rows)}, 'input_ids': [],
                    'calculation': {**coverage, 'operation': 'count_eligible_records', 'contributing_keys': [r['id'] for r in rows]}}
                add(f"{len(rows)} eligible {plan.table} records match this selected-unit/focus query. Unclassified job states: {result['unclassified']}. These are records, not mission blockers.", [query_id])
                if result['open_states']: add('Open jobs are defined as ' + ', '.join(result['open_states']) + '.', [query_id])
            elif not rows:
                add('No matching eligible record was found in this captured scope. This does not prove absence outside the loaded snapshot.', ['limitations'])
                status = 'insufficient_evidence'
            else:
                if plan.intent in {'record_lookup', 'maintenance_status', 'supply_status_eta'}:
                    chosen_entities = [r['id'] for r in rows[:8]]
                for row in rows[:5]: record(row)
                if plan.intent in {'maintenance_status', 'record_lookup'} and plan.table == 'csmp.csv':
                    jcns = {r['fields'].get('jcn') for r in rows[:5]} - {None}
                    linked = [r for r in packet.get('_records', []) if r['record_type'] == 'requisition_status.csv' and r['fields'].get('jcn') in jcns]
                    for row in linked[:2]: record(row)
                    if linked: add('Requisitions above are joined by the recorded JCN, not text similarity. ESD is an estimate, not guaranteed delivery or repair completion.', [r['id'] for r in linked[:2]])
                add(f"Showing {min(5, len(rows))} of {len(rows)} matching eligible records in the selected unit/focus.", [r['id'] for r in rows[:5]])
            if plan.intent == 'supply_status_eta':
                add('ESD is a recorded estimate, not a delivery guarantee, physical location or repair completion date.', ['limitations'])
    elif plan.intent == 'dependency_trace':
        facts = [f for f in packet['facts'] if f['id'].startswith('dependency:')]
        for fact in facts[:5]: add(fact['text'] + '. Existing modeled relationship; lineage is partial.', [fact['id']])
        if '_domain' in packet:
            domain = packet['_domain']
            for gate in domain.mission['gates']:
                gid = f"gate:{domain.event_id}|{gate['gate_id']}"
                if packet['identity'].get('node_id') not in (None, domain.event_id) and not packet['identity']['node_id'].startswith(domain.event_id+'|'+gate['gate_id']): continue
                if gid in supports:
                    add(f"The selected mission requires {gate['label']}." + (f" Supporting event: {gate['supporting_event']}." if gate.get('supporting_event') else ''), [gid])
                    if len(sentences) >= 5: break
        if not sentences:
            add('No matching path is available in the captured modeled graph. This is not proof that no real dependency exists.', ['limitations'])
    elif plan.intent in {'supporting_sources', 'source_excerpt'}:
        ids = []
        if not plan.entity_ids and plan.intent == 'supporting_sources':
            prior = next((m.get('referents') for m in reversed(history) if m.get('referents')), {})
            plan.entity_ids = list(prior.get('entity_ids', []))
        captured_rows = {r['id']: r for r in packet.get('_records', [])}
        for sid in plan.entity_ids:
            if sid in captured_rows:
                record(captured_rows[sid])
        for sid in plan.entity_ids:
            ids += supports.get(sid, {}).get('input_ids', [])
        candidates = [e for e in packet['evidence'] if not ids or e['id'] in ids]
        if plan.intent == 'source_excerpt': candidates = [e for e in candidates if 'excerpt' in e['fields'] and not e['fields'].get('superseded')]
        if not ids: candidates = rank_records(question, candidates, semantic_ids)
        for row in ([] if sentences else candidates[:5]): record(row)
        if not sentences:
            add('No matching eligible source passage is retained for this request. Specify a system, report or record identifier; absence from retrieval is not proof of absence from the dataset.', ['limitations'])
            status = 'insufficient_evidence'
    elif plan.intent == 'freshness_coverage':
        for source in packet.get('_health', []):
            if source['status'] not in {'stale', 'missing', 'invalid', 'failed'}: continue
            sid = 'health:' + hashlib.sha256(source['file'].encode()).hexdigest()[:16]
            supports[sid] = {'id': sid, 'kind': 'coverage', 'title': source['file'], 'values': source, 'identity': packet['identity'], 'input_ids': []}
            add(f"{source['file']}: {source['status']} at the exercise clock.", [sid])
            if len(sentences) >= 5: break
        add(' '.join(packet['warnings'] + packet.get('_coverage', [])), ['limitations'])
    elif plan.intent == 'known_history':
        add('A complete comparable before/after source snapshot is not retained by this conversation. The activity log and prior assistant text are not substitute source populations. Specify a retained historical record or use the Change Feed to inspect recorded exercise events.', ['limitations'])
        status = 'insufficient_evidence'
    if not sentences:
        add('Please specify one system, mission or record identifier.', ['limitations']); status = 'insufficient_evidence'
    followups = ['Show the supporting records', 'What data is missing?']
    if plan.intent in {'record_lookup', 'maintenance_status'}: followups = ['How many open jobs?', 'Show the supporting records']
    return {'method': 'template', 'fallback_reason': reason, 'answer_status': status,
        'sections': [{'heading': 'Answer', 'sentences': sentences}], 'citations': citations,
        'intent': plan.intent, 'template_id': plan.intent, 'template_version': VERSION, 'query_id': query_id,
        'scope': scope, 'coverage': coverage, 'referents': {'entity_ids': chosen_entities[:8], 'intent': plan.intent},
        'suggested_questions': followups}


def display(value):
    return 'Unknown' if value is None else f'{value:.0%}'
