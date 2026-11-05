"""Captured, allowlisted query populations. Never count a top-k retrieval subset."""
import hashlib
import json
import re
from . import auth
from .overview import TABLES, scalar
from .llm import redact

OPEN_STATES = frozenset({'OPEN', 'OPEN_AWAITING_PARTS', 'IN_WORK', 'DEFERRED'})


def capture_query_context(state, packet):
    unit = packet['identity']['unit_id']
    auth.allow_unit(unit)
    view = state.view()
    records = []
    allowed = {**TABLES, 'csmp.csv': (*TABLES['csmp.csv'], 'remarks', 'req_doc_numbers', 'casrep_id')}
    focused = {(e['file'], e['loc']) for e in packet['evidence']}
    for table, fields in allowed.items():
        for row in (view.requisitions(unit) if table == 'requisition_status.csv' else view.rows(unit, table)):
            src = row.get('_src')
            if not src: continue
            src = src.model_dump(mode='json') if hasattr(src, 'model_dump') else dict(src)
            if packet['identity'].get('focus') and (src['file'], src['loc']) not in focused: continue
            values = {key: scalar(row[key]) for key in fields if key in row}
            clean = redact(json.dumps(values, default=str), unit, state.baseline.name_index)[0]
            values = json.loads(clean)
            sid = 'record:' + hashlib.sha256(json.dumps([src['file'], src['loc'], values], sort_keys=True).encode()).hexdigest()[:24]
            records.append({'id': sid, 'kind': 'reported', 'record_type': table, 'file': src['file'], 'loc': src['loc'],
                'fields': values, 'text': table + ' ' + clean, 'as_of': scalar(row.get('_as_of_effective', row.get('_known'))),
                'identity': packet['identity'], 'values': values, 'input_ids': [], 'lineage': 'recorded_fields'})
    packet['_records'] = records
    health = state.sources()
    packet['_health'] = [{'file': s.get('file'), 'status': s.get('status'), 'age_days': s.get('age_days')}
                         for s in health.get('sources', []) if s.get('file', '').startswith((unit+'/', 'squadron/'))]
    packet['_coverage'] = state.baseline.coverage().get(unit, [])
    fc = state.fc()
    selected_event = packet['identity'].get('event_id')
    packet['_missions'] = [m for m in fc['missions'] if m['ship_id'] == unit and (not selected_event or m['event_id'] == selected_event)]
    aliases = {}
    for s in packet['summary']['systems']:
        aliases[s['name']] = aliases[s['eic']] = 'system:' + s['eic']
    for m in packet['_missions']:
        for name in (m['event_id'], m.get('codename'), m.get('name')):
            if name: aliases[name] = 'mission:' + m['event_id']
    if '_domain' in packet:
        for gid, target in packet['_domain'].graph_targets.items():
            aliases[target['label']] = 'gate:'+gid if 'gate:'+gid in packet['supports'] else 'mission:'+packet['_domain'].event_id
    packet['_aliases'] = aliases
    packet['_other_scope_aliases'] = [alias for uid, info in state.baseline.profile.ships.items() if uid != unit
        for alias in (uid, info['name'])]
    packet['_other_scope_aliases'] += [m.get('codename') for m in fc['missions'] if m.get('codename') and m not in packet['_missions']]


def query_records(plan, packet):
    rows = packet.get('_records', [])
    if plan.table: rows = [r for r in rows if r['record_type'] == plan.table]
    if plan.identifier:
        rows = [r for r in rows if any(str(r['fields'].get(k, '')).upper() == plan.identifier
            for k in ('jcn', 'doc_number', 'niin', 'cert_id', 'requirement_id'))]
    # Restrict entity filtering to explicit typed system IDs, not fuzzy text joins.
    eics = {sid.removeprefix('system:') for sid in plan.entity_ids if sid.startswith('system:')}
    if eics: rows = [r for r in rows if r['fields'].get('eic', r['fields'].get('system_eic')) in eics]
    if plan.search_terms and not plan.identifier and not eics and plan.table in {'csmp.csv', 'requisition_status.csv'}:
        rows = [r for r in rows if set(plan.search_terms) & set(re.findall(r'[a-z0-9]+', r['text'].lower()))]
    unclassified = 0
    if plan.status in {'open', 'completed', 'awaiting_parts'}:
        if plan.table != 'csmp.csv':
            return {'rows': [], 'complete': False, 'reason': 'That status filter is defined only for maintenance job_state. Supply status codes are not repair states.'}
        states = OPEN_STATES if plan.status == 'open' else {'COMPLETED'} if plan.status == 'completed' else {'OPEN_AWAITING_PARTS'}
        unclassified = sum(r['fields'].get('job_state') not in OPEN_STATES | {'COMPLETED', 'CANCELLED'} for r in rows)
        rows = [r for r in rows if r['fields'].get('job_state') in states]
    elif plan.status:
        return {'rows': [], 'complete': False, 'reason': 'Readiness bands cannot be used as raw-record status filters. Ask for modeled systems or a documented job state.'}
    return {'rows': sorted(rows, key=lambda r: (r['file'], r['loc'], r['id'])), 'complete': True,
            'value': len(rows), 'unclassified': unclassified, 'population': plan.table or 'allowlisted records',
            'filters': plan.model_dump(), 'open_states': sorted(OPEN_STATES) if plan.status == 'open' else [],
            'scope': {'unit': packet['identity']['unit_id'], 'focus': packet['identity'].get('focus'),
                      'knowledge_at': packet['identity']['cursor']},
            'note': 'Complete eligible selected-unit/focus population, not a count of mission blockers.'}
