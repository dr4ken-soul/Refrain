"""Safety checks for the local CRE run wrapper."""
from datetime import datetime, timezone
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.run_cre_cycle import filed_case_hashes, safe_log, settlement_broadcast_allowed, transaction_hash


def test_run_log_redacts_all_loaded_environment_values():
    env = {
        'DATABASE_URL': 'postgresql://user:private-password@db.example/postgres',
        'CRE_ETH_PRIVATE_KEY': 'a' * 64,
        'CRE_BEARER_SECRET': 'b' * 64,
        'SEPOLIA_RPC_URL': 'https://rpc.example/token-value',
        'CRE_SETTLED_FLAG': 'false',
    }
    result = safe_log(
        'DATABASE_URL=' + env['DATABASE_URL'] + '\n'
        + 'CRE_ETH_PRIVATE_KEY=' + env['CRE_ETH_PRIVATE_KEY'] + '\n'
        + 'CRE_BEARER_SECRET=' + env['CRE_BEARER_SECRET'] + '\n'
        + 'SEPOLIA_RPC_URL=' + env['SEPOLIA_RPC_URL'] + '\n'
        + 'settled=' + env['CRE_SETTLED_FLAG'],
        env,
    )
    assert env['DATABASE_URL'] not in result
    assert env['CRE_ETH_PRIVATE_KEY'] not in result
    assert env['CRE_BEARER_SECRET'] not in result
    assert env['SEPOLIA_RPC_URL'] not in result
    assert 'settled=false' in result


def test_transaction_hash_requires_a_transaction_label():
    tx = '0x' + '1' * 64
    assert transaction_hash('bundleHash=' + tx) is None
    assert transaction_hash('Transaction hash: ' + tx) == tx


def test_transaction_hash_reads_cre_filed_settlement_tx_field():
    tx = '0x' + 'ab' * 32
    output = f'Filed settlement. positionId=1 exitReason=2 exitPrice=17560000 pnlUnits=74 tx={tx}'
    assert transaction_hash(output) == tx


def test_filed_case_hashes_only_include_confirmed_records():
    snapshot = {
        'approved': {'caseHash': '0xabc', 'verdictTx': '0x123'},
        'rejected': {'caseHash': '0xdef', 'verdictTx': None},
    }
    assert filed_case_hashes(snapshot) == {'0xabc'}

def test_demo_expiry_broadcast_waits_until_the_recorded_expiry():
    bundle = {'proposedTerms': {'expiresAt': '2026-10-31T09:15:00Z'}}
    before = datetime(2026, 10, 31, 9, 14, tzinfo=timezone.utc)
    after = datetime(2026, 10, 31, 9, 15, tzinfo=timezone.utc)
    assert not settlement_broadcast_allowed(True, 1, bundle, before)
    assert settlement_broadcast_allowed(True, 1, bundle, after)
    assert settlement_broadcast_allowed(False, 1, bundle, after) is False
    assert settlement_broadcast_allowed(True, 2, bundle, before)
