import sys
from pathlib import Path

from eth_abi import encode
from eth_hash.auto import keccak
import httpx
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps' / 'api'))

from api.indexer import decode_log, make_event_loop, rpc, should_wait_after_range


def topic(signature):
    return '0x' + keccak(signature.encode()).hex()


def word(value):
    return '0x' + value.hex()


def test_decode_verdict_filed():
    case_hash = bytes.fromhex('11' * 32)
    ruleset_hash = bytes.fromhex('22' * 32)
    asset_hash = bytes.fromhex('33' * 32)
    log = {
        'topics': [topic('VerdictFiled(bytes32,bytes32,bytes32,uint8,uint8,uint8,uint8)'), word(case_hash)],
        'data': '0x' + encode(
            ['bytes32', 'bytes32', 'uint8', 'uint8', 'uint8', 'uint8'],
            [ruleset_hash, asset_hash, 0, 1, 2, 0],
        ).hex(),
    }
    name, data = decode_log(log)
    assert name == 'VerdictFiled'
    assert data['caseHash'] == word(case_hash)
    assert data['rulesetHash'] == word(ruleset_hash)
    assert (data['caseKind'], data['decision'], data['reason'], data['direction']) == (0, 1, 2, 0)


def test_decode_position_opened_dynamic_contributor_arrays():
    case_hash = bytes.fromhex('44' * 32)
    source_hash = bytes.fromhex('55' * 32)
    call_hash = bytes.fromhex('66' * 32)
    log = {
        'topics': [
            topic('PositionOpened(uint256,bytes32,uint8,uint8,uint256,uint256,uint256,uint256,uint64,uint64,bytes32[],bytes32[],uint8[])'),
            '0x' + f'{7:064x}', word(case_hash),
        ],
        'data': '0x' + encode(
            ['uint8', 'uint8', 'uint256', 'uint256', 'uint256', 'uint256', 'uint64', 'uint64',
             'bytes32[]', 'bytes32[]', 'uint8[]'],
            [0, 1, 123456789, 100000000, 200000000, 13000, 1793362800, 1793438100,
             [source_hash], [call_hash], [73]],
        ).hex(),
    }
    name, data = decode_log(log)
    assert name == 'PositionOpened'
    assert data['positionId'] == '7'
    assert data['caseHash'] == word(case_hash)
    assert data['entryPrice1e8'] == '123456789'
    assert data['sourceHashes'] == [word(source_hash)]
    assert data['callHashes'] == [word(call_hash)]
    assert data['convictions'] == [73]


def test_decode_settlement_signed_pnl_and_score_update():
    settlement = {
        'topics': [topic('PositionSettled(uint256,uint8,uint256,int256)'), '0x' + f'{3:064x}'],
        'data': '0x' + encode(['uint8', 'uint256', 'int256'], [2, 170000000, -975]).hex(),
    }
    name, data = decode_log(settlement)
    assert name == 'PositionSettled'
    assert data == {'positionId': '3', 'exitReason': 2, 'exitPrice1e8': '170000000', 'pnlUnits': '-975'}

    source_hash = bytes.fromhex('77' * 32)
    score = {
        'topics': [topic('ScoreUpdated(bytes32,int256,int256)'), word(source_hash)],
        'data': '0x' + encode(['int256', 'int256'], [-125, 4875]).hex(),
    }
    name, data = decode_log(score)
    assert name == 'ScoreUpdated'
    assert data == {'sourceHash': word(source_hash), 'delta': '-125', 'newScore': '4875'}


def test_unknown_contract_events_are_ignored():
    assert decode_log({'topics': ['0x' + '00' * 32], 'data': '0x'}) is None


def test_rpc_http_errors_do_not_include_the_credential_url():
    secret_url = 'https://rpc.example/private-api-key'

    class FakeClient:
        async def post(self, *_args, **_kwargs):
            request = httpx.Request('POST', secret_url)
            return httpx.Response(400, request=request)

    import asyncio
    with pytest.raises(RuntimeError) as error:
        asyncio.run(rpc(FakeClient(), 'eth_getLogs', []))
    assert '400' in str(error.value)
    assert secret_url not in str(error.value)


def test_backfill_skips_poll_delay_between_ranges_but_waits_when_caught_up():
    assert should_wait_after_range('indexed', backfill=False)
    assert not should_wait_after_range('indexed', backfill=True)
    assert should_wait_after_range('caught_up', backfill=True)


def test_indexer_uses_windows_compatible_selector_loop():
    loop = make_event_loop()
    try:
        import asyncio
        assert isinstance(loop, asyncio.SelectorEventLoop)
    finally:
        loop.close()
