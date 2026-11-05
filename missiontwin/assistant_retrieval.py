"""Stable eligible-record ranking shared by deterministic templates and candidates."""
import re

STOP = {'the', 'this', 'that', 'what', 'which', 'show', 'about', 'with', 'does', 'have', 'from', 'records', 'sources'}


def rank_records(question, records, semantic_ids=()):
    tokens = set(re.findall(r'[a-z0-9]+', question.lower())) - STOP
    semantic = {sid: i for i, sid in enumerate(semantic_ids)}
    identifiers = {t for t in tokens if any(c.isdigit() for c in t)}
    def score(row):
        text = row.get('text') or str(row.get('fields', {}))
        words = set(re.findall(r'[a-z0-9]+', text.lower()))
        exact = len(identifiers & words)
        return (-exact, -len(tokens & words), semantic.get(row['id'], 999), row.get('file', ''), row.get('loc', ''), row['id'])
    ranked = sorted(records, key=score)
    # No semantic score by itself establishes relevance or current truth.
    return [r for r in ranked if tokens & set(re.findall(r'[a-z0-9]+', (r.get('text') or str(r.get('fields', {}))).lower())) or r['id'] in semantic]
