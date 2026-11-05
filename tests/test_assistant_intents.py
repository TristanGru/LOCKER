"""Canonical routing/paraphrase inventory; these are not a factuality score."""
import pytest
from missiontwin.assistant_intents import plan_question

CASES = [
 ('Summarize this ship','unit_summary'),('Give me the shore picture','unit_summary'),
 ('How is this mission looking','unit_summary'),('Explain the leading concern','status_explanation'),
 ('Why is this system on Watch','status_explanation'),('Which systems are at risk','status_list'),
 ('Show unknown capabilities','status_list'),('How many open jobs','filtered_count'),
 ('Count all requisitions','filtered_count'),('How many completed maintenance jobs','filtered_count'),
 ('Show JCN 99101CE010091','record_lookup'),('What is requisition V9910163030091','record_lookup'),
 ('Which repairs are awaiting parts','maintenance_status'),('What is wrong with the HF set','maintenance_status'),
 ('When is the part due','supply_status_eta'),('Explain this dependency','dependency_trace'),
 ('Show the supporting records','supporting_sources'),('What does the CASREP say','source_excerpt'),
 ('What data is missing','freshness_coverage'),('What changed','known_history'),
 ('What expires during this mission','training_certification_window'),('Compare start and interval','assessment_comparison')]

@pytest.mark.parametrize('question,intent',CASES)
@pytest.mark.parametrize('variant',[lambda q:q,lambda q:q+'?',lambda q:q.upper(),lambda q:'Please '+q,lambda q:q+', please.'])
def test_canonical_paraphrases(question,intent,variant):
    plan=plan_question(variant(question),{}, {})
    assert plan.intent==intent
    assert plan.outcome=='supported'


def test_boundaries_and_ambiguous_followup():
    assert plan_question('Apply the fix',{},{}).outcome=='out_of_scope'
    assert plan_question('What changed?',{},{}).intent=='known_history'
    assert plan_question('Why?',{},{}).outcome=='clarification'
    assert plan_question('How many jobs are not open?',{},{}).outcome=='clarification'
    assert plan_question('Compare all missions',{},{}).outcome=='unavailable'
