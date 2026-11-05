import copy
import pytest
from missiontwin.assistant_templates import deterministic_answer
from missiontwin.assistant_intents import plan_question
from missiontwin.assistant_queries import query_records
from missiontwin.overview_chat import generate


def sample(n=350):
    identity={'unit_id':'TEST','cursor':'2026-11-04T08:00:00Z','source_revision':'test','version':0,'digest':'test'}
    rows=[{'id':f'record:{i}','record_type':'csmp.csv','kind':'reported','file':'TEST/csmp.csv','loc':f'row {i}',
        'text':'csmp.csv pump OPEN' if i%2 else 'csmp.csv radio COMPLETED',
        'fields':{'jcn':str(100000+i),'equipment_noun':'pump' if i%2 else 'radio','job_state':'OPEN' if i%2 else 'COMPLETED'},
        'identity':identity,'as_of':identity['cursor']} for i in range(n)]
    supports={'counts':{'id':'counts','kind':'aggregate','values':{'ready':1},'identity':identity,'input_ids':[]},
        'limitations':{'id':'limitations','kind':'coverage','values':{'scope':'selected unit'},'identity':identity,'input_ids':[]}}
    packet={'identity':identity,'packet_id':'test','summary':{'systems':[]},'facts':[],'evidence':[],
            'warnings':['Synthetic exercise only.'],'_records':rows}
    return packet,supports


def text(answer):return ' '.join(s['text'] for section in answer['sections'] for s in section['sentences'])


def test_complete_set_count_not_topk_and_reproducibility():
    packet,supports=sample()
    answer=deterministic_answer(packet,supports,'How many open jobs?')
    assert '175' in text(answer)
    assert answer['intent']=='filtered_count'
    query=answer['citations'][0]['support']['calculation']
    assert len(query['contributing_keys'])==175
    assert query['complete'] is True
    assert answer==deterministic_answer(packet,supports,'How many open jobs?')
    assert answer!=deterministic_answer(packet,supports,'What data is missing?')


def test_exact_lookup_no_nearby_substitution_and_filter_definition():
    packet,supports=sample()
    exact=deterministic_answer(packet,supports,'Show JCN 100001')
    assert '100001' in text(exact) and '100003' not in text(exact)
    missing=deterministic_answer(packet,supports,'Show JCN 999999')
    assert 'No matching eligible record' in text(missing)
    unknown=deterministic_answer(packet,supports,'How many open requisitions?')
    assert unknown['answer_status']=='insufficient_evidence'
    assert 'defined only for maintenance' in text(unknown)


def test_named_repair_does_not_dump_unrelated_records():
    packet,supports=sample()
    answer=deterministic_answer(packet,supports,'What is wrong with the pump?')
    assert 'pump' in text(answer) and 'radio' not in text(answer)


def test_explicit_deterministic_never_uses_provider_or_model_cache():
    packet,_=sample()
    class Never:
        def __getattr__(self,key):raise AssertionError('Model client accessed: '+key)
    # support_packet uses the adapter's supports without needing a model client.
    packet['supports']=sample()[1]
    result=generate(Never(),packet,'How many open jobs?',[],[],response_policy='deterministic_only')
    assert result['method']=='template' and result['fallback_reason']=='requested_deterministic'


def test_narrative_quotation_preserves_uncertainty():
    packet,supports=sample(0)
    packet['evidence']=[{'id':'ev:report','kind':'reported','file':'TEST/report.pdf','loc':'page 1',
        'text':'pump may be running warm', 'fields':{'excerpt':'Pump may be running warm.','hedged':True,'superseded':False,'known_at':packet['identity']['cursor']}}]
    answer=deterministic_answer(packet,supports,'What does the pump report say?')
    assert 'Pump may be running warm.' in text(answer)
    assert 'Wording is uncertain' in text(answer)
    assert answer['citations'][0]['support']['file']=='TEST/report.pdf'
