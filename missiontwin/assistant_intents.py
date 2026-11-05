"""Bounded, explainable question planning. No classifier/provider calls."""
import re
from typing import Literal
from pydantic import BaseModel, Field

INTENTS = ('unit_summary', 'mission_summary', 'status_explanation', 'status_list', 'filtered_count',
           'record_lookup', 'maintenance_status', 'supply_status_eta', 'dependency_trace',
           'supporting_sources', 'source_excerpt', 'freshness_coverage',
           'training_certification_window', 'assessment_comparison', 'known_history', 'clarification_or_boundary')


class QuestionPlan(BaseModel):
    intent: str
    entity_ids: list[str] = Field(default_factory=list)
    identifier: str | None = None
    table: str | None = None
    status: str | None = None
    search_terms: list[str] = Field(default_factory=list)
    outcome: Literal['supported', 'clarification', 'out_of_scope', 'unavailable'] = 'supported'
    reason: str = ''


def words(text):
    return set(re.findall(r'[a-z0-9]+', text.lower()))


def plan_question(question, packet, supports, history=()):
    q = question.strip().lower()
    w = words(q)
    plan = QuestionPlan(intent='clarification_or_boundary', outcome='clarification')
    if re.search(r'\b(apply|approve|delete|execute|simulate|transfer)\b', q) and not re.search(r'\b(status|history|recorded|was|were|whether)\b', q) or 'what if' in q:
        return plan.model_copy(update={'outcome': 'out_of_scope', 'reason': 'Chat cannot apply changes or run simulations. Use the existing decision or what-if workflow.'})
    if re.search(r'\b(all|every|compare|across)\b.*\b(missions|ships|units|fleet)\b', q):
        return plan.model_copy(update={'outcome': 'unavailable', 'reason': 'This answer is scoped to the selected unit and mission. Cross-mission or fleet queries require a separately authorized complete-set query.'})
    # Refuse silent context expansion, including requests naming another loaded unit/mission.
    for alias in packet.get('_other_scope_aliases', []):
        if len(alias) > 2 and re.search(r'(?<!\w)' + re.escape(alias.lower()) + r'(?!\w)', q):
            return plan.model_copy(update={'outcome': 'clarification', 'reason': 'That name is outside this captured context. Select an authorized unit or mission and start a new conversation.'})
    aliases = packet.get('_aliases', {})
    matches = [sid for alias, sid in aliases.items() if len(alias) > 2 and re.search(r'(?<!\w)' + re.escape(alias.lower()) + r'(?!\w)', q)]
    plan.entity_ids = sorted(set(matches))
    # Explicit typed IDs are never replaced with a nearby retrieved record.
    explicit = re.search(r'\b(?:jcn|niin|requisition|document|doc|cert_id|requirement_id)\s*(?:number|no\.?|#|:)?\s+([a-z0-9][a-z0-9_-]*\d[a-z0-9_-]*)\b', q)
    if explicit:
        plan.identifier = explicit.group(1).upper()
    if w & {'job', 'jobs', 'repair', 'repairs', 'maintenance', 'jcn', 'wrong'}: plan.table = 'csmp.csv'
    elif w & {'part', 'parts', 'requisition', 'requisitions', 'supply', 'delivery', 'eta', 'esd', 'due', 'niin'}: plan.table = 'requisition_status.csv'
    elif w & {'training'}: plan.table = 'training_readiness.csv'
    elif w & {'certification', 'certifications', 'certificate', 'certificates'}: plan.table = 'cert_status.csv'
    elif w & {'system', 'systems', 'capability', 'capabilities'}: plan.table = 'systems'
    generic = {'what','which','where','when','why','how','many','count','number','total','show','list','give','me','the','a','an','is','are','of','for','with','in','on','this','that','it','its','my','our','current','selected','unit','all','jobs','job','repair','repairs','maintenance','parts','part','requisitions','requisition','supply','delivery','eta','esd','due','status','open','closed','completed','awaiting','waiting','wrong','set','do','does','will','arrive','reported','records','record','please','about','to','be','at','systems','system','capability','capabilities'}
    plan.search_terms = sorted(w - generic)
    if w & {'late', 'overdue'}:
        return plan.model_copy(update={'reason': 'Please specify the date basis. A recorded ESD, mission date and guaranteed delivery date are not interchangeable; a late/overdue filter is not defined yet.'})
    if ('how many' in q or 'count' in w) and w & {'jobs', 'repairs'} and w & {'requisitions'}:
        return plan.model_copy(update={'reason': 'Please ask for one count population at a time: maintenance jobs or requisitions.'})
    if 'awaiting parts' in q or 'waiting for parts' in q: plan.status = 'awaiting_parts'
    elif w & {'open'}: plan.status = 'open'
    elif w & {'completed', 'closed'}: plan.status = 'completed'
    elif 'at risk' in q or w & {'red'}: plan.status = 'risk'
    elif w & {'watch'}: plan.status = 'watch'
    elif w & {'unknown'}: plan.status = 'unknown'
    elif w & {'ready'}: plan.status = 'ready'
    if re.search(r'\b(not|except|excluding|without)\b', q):
        return plan.model_copy(update={'reason': 'Negative filters are not supported yet. Ask for a specific status or a record identifier.'})
    if re.fullmatch(r'(why|why is that|explain that|what about that|show its sources)[?.! ]*', q):
        prior = next((m.get('referents') for m in reversed(history) if m.get('referents')), None)
        if prior and len(prior.get('entity_ids', [])) == 1:
            row = next((r for r in packet.get('_records', []) if r['id'] == prior['entity_ids'][0]), None)
            if row:
                plan.entity_ids = [row['id']]
                plan.table = row['record_type']
                plan.identifier = next((str(row['fields'][k]).upper() for k in ('doc_number', 'jcn', 'cert_id', 'requirement_id') if row['fields'].get(k)), None)
                plan.intent, plan.outcome = 'record_lookup', 'supported'
                return plan
        if prior and len(prior.get('entity_ids', [])) == 1 and prior['entity_ids'][0] in supports:
            plan.entity_ids = prior['entity_ids']
            plan.intent = 'supporting_sources' if 'sources' in q else 'status_explanation'
            plan.outcome = 'supported'
            return plan
        plan.reason = 'Which system, mission, job or requisition do you mean? Name one or provide its identifier.'
        return plan
    if 'how many' in q or w & {'count', 'counts', 'total'}: intent = 'filtered_count'
    elif w & {'stale', 'freshness', 'missing', 'reliable', 'uncertainty', 'assumptions'}: intent = 'freshness_coverage'
    elif w & {'changed', 'history', 'earlier', 'previous'}: intent = 'known_history'
    elif w & {'compare', 'difference'} or 'start and interval' in q or 'start-time' in q: intent = 'assessment_comparison'
    elif w & {'expire', 'expires', 'expiring', 'expiry', 'training', 'certification', 'certifications'}: intent = 'training_certification_window'
    elif w & {'depends', 'depend', 'dependencies', 'dependency', 'chain', 'pier', 'linked', 'affected'}: intent = 'dependency_trace'
    elif w & {'casrep', 'report', 'reports', 'quote', 'quotation'}: intent = 'source_excerpt'
    elif w & {'source', 'sources', 'evidence', 'records', 'supporting'}: intent = 'supporting_sources'
    elif plan.identifier: intent = 'record_lookup'
    elif plan.table == 'requisition_status.csv': intent = 'supply_status_eta'
    elif plan.table == 'csmp.csv': intent = 'maintenance_status'
    elif w & {'why', 'explain', 'threatens', 'concern', 'constraint', 'wrong', 'risk'} and not w & {'which', 'list', 'show'}: intent = 'status_explanation'
    elif w & {'which', 'list', 'show'} and (plan.table == 'systems' or plan.status): intent = 'status_list'
    elif w & {'summarize', 'summary', 'brief', 'overview', 'picture', 'looking'}:
        intent = 'mission_summary' if '_domain' in packet else 'unit_summary'
    else:
        plan.reason = 'I can summarize this context, list statuses, count open jobs, look up records, show reported ESDs, trace modeled dependencies or inspect sources. Which would you like?'
        return plan
    plan.intent, plan.outcome = intent, 'supported'
    if intent == 'filtered_count' and not plan.table:
        plan.outcome, plan.reason = 'clarification', 'Count which population: systems, maintenance jobs, or requisitions?'
    if len(plan.entity_ids) > 1 and intent in {'status_explanation', 'record_lookup'}:
        plan.outcome, plan.reason = 'clarification', 'More than one entity matches. Please name one specific system or record.'
    return plan
