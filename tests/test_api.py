"""API contract tests for public replay reads and protected operator routes."""
import sys
from pathlib import Path

import pytest
from eth_hash.auto import keccak
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps' / 'api'))

from api import main


@pytest.fixture
def api_client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, 'OPERATOR_STATE', tmp_path / 'operator_state.json')
    monkeypatch.setenv('CRE_BEARER_SECRET', 'test-cre-bearer')
    monkeypatch.setenv('OPERATOR_SECRET', 'test-operator-secret')
    return TestClient(main.app)


def test_public_replay_surfaces_have_chain_backed_shape(api_client):
    health = api_client.get('/api/health')
    assert health.status_code == 200
    assert health.json()['mode'] == 'replay'

    board = api_client.get('/api/board').json()
    assert board['label'] == 'CRE fixture replay'
    assert board['realFundsAtRisk'] == 0
    assert board['chain']['chainId'] == 11155111

    metrics = api_client.get('/api/metrics').json()
    assert metrics['callsParsed'] > 0
    assert metrics['paperPositionsOpened'] == 1
    assert metrics['tradesRejected'] == 1
    assert metrics['positionsSettled'] == 0


def test_case_and_ledger_endpoints_reference_the_frozen_cases(api_client):
    response = api_client.get(
        '/api/events', params={'decision': 'rejected', 'reason_code': 'SINGLE_VOICE_REPETITION'}
    )
    assert response.status_code == 200
    rejected = response.json()['events']
    assert len(rejected) == 1
    assert rejected[0]['reasonCode'] == 'SINGLE_VOICE_REPETITION'

    detail = api_client.get(f"/api/events/{rejected[0]['eventId']}")
    assert detail.status_code == 200
    assert detail.json()['bundle']['bundleHash'] == rejected[0]['bundleHash']

    positions = api_client.get('/api/ledger/positions').json()['positions']
    rejections = api_client.get('/api/ledger/rejections').json()['rejections']
    assert len(positions) == 1 and positions[0]['status'] == 'open'
    assert len(rejections) == 1 and rejections[0]['verdictTx'].startswith('0x')


def test_calls_cursor_pagination_and_invalid_cursor(api_client):
    first = api_client.get('/api/calls', params={'limit': 1})
    assert first.status_code == 200
    body = first.json()
    assert len(body['calls']) == 1
    assert body['nextCursor']

    second = api_client.get('/api/calls', params={'limit': 1, 'cursor': body['nextCursor']})
    assert second.status_code == 200
    assert second.json()['calls'][0]['id'] != body['calls'][0]['id']
    assert api_client.get('/api/calls', params={'cursor': 'not-a-cursor'}).status_code == 400


def test_watchlist_and_rules_reads_are_replay_accurate(api_client):
    sources = api_client.get('/api/kols').json()['rows']
    assert len(sources) == 8
    assert all(row['score'] == 50.0 and row['callsTracked'] == 0 for row in sources)
    assert api_client.get(f"/api/kols/{sources[0]['handle']}").status_code == 200

    active = api_client.get('/api/rules/active').json()
    history = api_client.get('/api/rules').json()
    assert active['version'] == 1
    assert history['activeVersion'] == 1
    assert api_client.get('/api/cre/runs').json()['runs']


def test_cre_routes_require_bearer_and_serve_frozen_records(api_client):
    assert api_client.get('/cre/pending-verdicts').status_code == 401
    assert api_client.get('/cre/due-positions').status_code == 401

    headers = {'Authorization': 'Bearer test-cre-bearer'}
    candidates = api_client.get('/cre/pending-verdicts', headers=headers)
    assert candidates.status_code == 200
    candidate = candidates.json()['candidates'][0]
    bundle = api_client.get(
        f"/cre/events/{candidate['eventId']}/bundle", headers=headers
    )
    assert bundle.status_code == 200
    assert bundle.json()['bundleHash'] == candidate['caseHash']
    assert api_client.get('/cre/due-positions', headers=headers).json()['positions']


def test_operator_session_source_hash_and_rules_versioning(api_client):
    assert api_client.get('/operator/session').json() == {
        'signedIn': False,
        'configured': True,
    }
    assert api_client.post('/operator/sources', json={'handle': 'source_one'}).status_code == 401
    assert api_client.post('/operator/session', json={'secret': 'wrong'}).status_code == 401

    signed_in = api_client.post(
        '/operator/session', json={'secret': 'test-operator-secret'}
    )
    assert signed_in.status_code == 200
    assert 'httponly' in signed_in.headers['set-cookie'].lower()

    created = api_client.post(
        '/operator/sources',
        json={'handle': 'proof_source', 'role': 'core_signal', 'note': 'API fixture'},
    )
    assert created.status_code == 201
    assert created.json()['sourceHash'] == '0x' + keccak(
        b'telegram:proof_source'
    ).hex()
    assert created.json()['note'] == 'API fixture'

    active = api_client.get('/api/rules/active').json()
    saved = api_client.post('/operator/rules', json={'config': active['config']})
    assert saved.status_code == 201
    assert saved.json()['version'] == 2
    assert saved.json()['name'] == 'refrain-mandate-v2'
    assert api_client.get('/api/rules/active').json()['version'] == 2


def test_operator_routes_report_unavailable_runner(api_client):
    signed_in = api_client.post(
        '/operator/session', json={'secret': 'test-operator-secret'}
    )
    assert signed_in.status_code == 200
    response = api_client.post('/operator/runs/verdict')
    assert response.status_code == 503
    assert 'runner host is not connected' in response.json()['detail'].lower()
