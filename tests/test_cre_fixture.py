"""CRE fixture freeze guard, Python side.

The CRE workflow's TypeScript mirror (cre/shared/fixture.test.ts) proves the
canonical bytes and the ruleset mirror against these fixtures. This twin
proves the opposite direction: the committed fixtures are still exactly what
the engine produces, so a hand edit to cre/fixtures cannot slip past the
workflow tests.
"""
import json
from pathlib import Path

from engine import bundle_hash, evaluate_bundle

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'cre' / 'fixtures'

NAMES = ('verdict-approved.json', 'verdict-rejected.json')


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding='utf-8'))


def test_committed_bundle_hash_matches_canonical_bytes():
    for name in NAMES:
        fixture = load(name)
        assert bundle_hash(fixture['bundle']) == fixture['bundle']['bundleHash'], name


def test_committed_evaluation_matches_engine_output():
    for name in NAMES:
        fixture = load(name)
        assert evaluate_bundle(fixture['bundle']) == fixture['evaluation'], name


def test_fixture_decisions_are_the_two_documented_outcomes():
    approved = load('verdict-approved.json')
    rejected = load('verdict-rejected.json')
    assert approved['evaluation']['decision'] == 'approved'
    assert approved['evaluation']['reason_code'] is None
    assert approved['bundle']['proposedTerms']['expiresAt'] == '2026-10-31T09:15:00Z'
    assert rejected['evaluation']['decision'] == 'rejected'
    assert rejected['evaluation']['reason_code'] == 'SINGLE_VOICE_REPETITION'
