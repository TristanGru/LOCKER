"""LLM wording is optional; unsupported numbers/fields must not enter trusted output."""
import json

import pytest

from missiontwin.llm import LLMClient, extract_facts, llm_brief


@pytest.mark.parametrize('text', ['Readiness 99% [1]', 'Readiness 80%', 'Readiness 80% [2]'])
def test_brief_numeric_or_citation_changes_fall_back(tmp_path, monkeypatch, text):
    client = LLMClient(base_url='http://unit.invalid', demo_mode=False, cache_dir=tmp_path)
    monkeypatch.setattr(client, '_post', lambda *args: json.dumps({'text': text}))
    draft = 'Readiness 80% [1]'
    result, method, _ = llm_brief(client, {}, draft, 1, 'revision-1')
    assert result == draft and method == 'template'


def test_invalid_extracted_date_is_review_only(baseline, tmp_path, monkeypatch):
    client = LLMClient(base_url='http://unit.invalid', demo_mode=False, cache_dir=tmp_path)
    member = next(iter(baseline.name_index['KESSLER']['by_rate'].values()))
    sentence = f'[{member}] detaches 32 FEB.'
    output = {'facts': [{'type': 'personnel_transfer', 'member_token': member, 'date': '32 FEB', 'span': sentence}]}
    monkeypatch.setattr(client, '_post', lambda *args: json.dumps(output))
    facts, _ = extract_facts(client, 'report.pdf', 'KESSLER', sentence, 1, baseline.profile.now, baseline.name_index, known_eics=baseline.profile.all_eics)
    assert facts and facts[0].status == 'NEEDS_REVIEW'


def test_offline_mode_blocks_network_even_with_endpoint(monkeypatch, tmp_path):
    monkeypatch.setenv('MISSIONTWIN_DEMO_MODE', '1')
    client = LLMClient(base_url='http://unit.invalid', cache_dir=tmp_path)
    monkeypatch.setattr(client, '_post', lambda *args: pytest.fail('Offline demo must not call model transport'))
    assert llm_brief(client, {}, 'Readiness 80% [1]', 1, 'revision-1')[1] == 'template'
