"""Phase 3 acceptance: independence, convergence, frozen bundles and verdicts.

The nine-repeat fixture must yield one independent voice and a rejection with
SINGLE_VOICE_REPETITION. A three-channel convergence must be APPROVED with the
full ordered rule results. Changing one character of a stored bundle must
change its hash, proving the frozen record is tamper-evident.
"""
import copy
import hashlib
import json
from pathlib import Path

from engine import build_bundle, bundle_hash, build_candidate_events, evaluate_bundle
from engine.convergence import apply_independence
from shared_types.canonical import canonical_json

ROOT = Path(__file__).resolve().parents[1]


def load_ruleset():
    ruleset = json.loads((ROOT / 'seed/ruleset-v1.json').read_text(encoding='utf-8'))
    ruleset['ruleset_hash'] = '0x' + hashlib.sha256(canonical_json(ruleset).encode('utf-8')).hexdigest()
    return ruleset


RULESET = load_ruleset()

SRC1 = '11111111-1111-1111-1111-111111111111'
SRC2 = '22222222-2222-2222-2222-222222222222'
SRC3 = '33333333-3333-3333-3333-333333333333'
SRC4 = '44444444-4444-4444-4444-444444444444'

RELIABILITY = {
    SRC1: {'source_hash': '0xsrc1', 'score_hundredths': 5000, 'origin': 'neutral', 'block': None},
    SRC2: {'source_hash': '0xsrc2', 'score_hundredths': 5000, 'origin': 'neutral', 'block': None},
    SRC3: {'source_hash': '0xsrc3', 'score_hundredths': 5000, 'origin': 'neutral', 'block': None},
    SRC4: {'source_hash': '0xsrc4', 'score_hundredths': 5000, 'origin': 'neutral', 'block': None},
}


def call_row(source_id, message_id, posted_at, text, **overrides):
    row = {
        'id': f'00000000-0000-0000-0000-{message_id:012d}',
        'source_id': source_id,
        'telegram_message_id': message_id,
        'asset_key': 'cex:ENAUSDT',
        'chain': 'cex',
        'contract_address': None,
        'ticker': 'ENA',
        'pair': 'ENAUSDT',
        'direction': 'long',
        'entry_price': '0.62',
        'stop_price': '0.58',
        'target_price': '0.70',
        'targets': ['0.70', '0.78', '0.90'],
        'conviction': 70,
        'urgency': None,
        'sentiment': 'bullish',
        'narrative_tags': [],
        'parser': 'structured',
        'span_start': 0,
        'span_end': len(text),
        'is_advertisement': False,
        'filter_reason': None,
        'posted_at': posted_at,
        'post_text': text,
        'post_urls': [],
        'post_content_hash': f'content-{source_id[:8]}-{message_id}',
        'forwarded_from': None,
        'edited_at': None,
        'referral_markers': [],
        'scheduled_call': None,
    }
    row.update(overrides)
    return row


def post_row(call):
    return {
        'source_id': call['source_id'],
        'telegram_message_id': call['telegram_message_id'],
        'posted_at': call['posted_at'],
        'text': call['post_text'],
        'urls': list(call['post_urls']),
        'forwarded_from': call['forwarded_from'],
        'content_hash': call['post_content_hash'],
        'edited_at': call['edited_at'],
        'is_advertisement': call['is_advertisement'],
        'filter_reason': call['filter_reason'],
        'referral_markers': list(call['referral_markers']),
        'scheduled_call': call['scheduled_call'],
    }


def observation(kind, price, locator='ENAUSDT', cents=None):
    return {'kind': kind, 'locator': locator, 'observedAt': '2026-10-20T12:05:00Z',
            'liquidityUsdCents': cents, 'price': price}


def independent_voices(bundle):
    return [voice for voice in bundle['voices'] if not voice['copied']]


def test_nine_repeat_fixture_rejected_single_voice_repetition():
    calls = [call_row(SRC1, index, f'2026-10-20T12:0{index}:00Z',
                      f'ENA/USDT LONG Entry: 0.62 SL: 0.58 TP1: 0.70 update {index}')
             for index in range(1, 10)]
    events = build_candidate_events(calls, RULESET)
    assert len(events) == 1
    event = events[0]
    event['posts'] = [post_row(call) for call in event['calls']]
    independence = apply_independence(event, RELIABILITY)
    assert independence['independent_voice_count'] == 1
    bundle = build_bundle(event, independence, RULESET, RELIABILITY, [], [],
                          '2026-10-20T13:00:00Z')
    assert bundle['independentVoiceCount'] == 1
    evaluation = evaluate_bundle(bundle)
    assert evaluation['decision'] == 'rejected'
    assert evaluation['reason_code'] == 'SINGLE_VOICE_REPETITION'
    quorum = next(row for row in evaluation['rule_results'] if row['rule'] == 'independence_quorum')
    assert '9 times' in quorum['evidence']


def test_three_channel_fixture_approved():
    calls = [
        call_row(SRC1, 1, '2026-10-20T12:00:00Z', 'ENA/USDT LONG Entry: 0.62 SL: 0.58 TP1: 0.70'),
        call_row(SRC2, 2, '2026-10-20T12:01:00Z', 'ENAUSDT long, entry 0.62, SL 0.58, TPs 0.70 0.78'),
        call_row(SRC3, 3, '2026-10-20T12:02:00Z', 'Long ENA/USDT now. Entry 0.62. Stop 0.58. Target 0.70.'),
    ]
    events = build_candidate_events(calls, RULESET)
    assert len(events) == 1
    event = events[0]
    event['posts'] = [post_row(call) for call in event['calls']]
    independence = apply_independence(event, RELIABILITY)
    assert independence['independent_voice_count'] == 3
    assert independence['timing_spread_seconds'] == 120
    assert independence['weighted_conviction'] == '70.00'
    entry = [
        {'kind': 'binance', 'locator': 'ENAUSDT', 'observedAt': '2026-10-20T12:05:00Z',
         'liquidityUsdCents': None, 'price': '0.62', 'assetKey': 'cex:ENAUSDT'},
        {'kind': 'bybit', 'locator': 'ENAUSDT', 'observedAt': '2026-10-20T12:05:00Z',
         'liquidityUsdCents': None, 'price': '0.62', 'assetKey': 'cex:ENAUSDT'},
    ]
    bundle = build_bundle(event, independence, RULESET, RELIABILITY, [], entry,
                          '2026-10-20T13:00:00Z')
    assert bundle['eventId']
    evaluation = evaluate_bundle(bundle)
    assert evaluation['decision'] == 'approved', evaluation
    assert evaluation['reason_code'] is None
    expected_order = ['promotion_dominance', 'coordination', 'independence_quorum',
                      'weighted_conviction', 'liquidity_floor', 'exit_terms',
                      'size_limits', 'price_agreement', 'staleness']
    assert [row['rule'] for row in evaluation['rule_results']] == expected_order
    assert all(row['pass'] is True for row in evaluation['rule_results'])
    assert bundle['proposedTerms']['stopPrice'] == '0.58'
    assert bundle['proposedTerms']['targetPrice'] == '0.70'
    assert bundle['proposedTerms']['hasStructuredLevels'] is True
    assert bundle['proposedTerms']['expiresAt'] == '2026-10-22T12:02:00Z'


def test_forwarded_call_contributes_zero_voices():
    calls = [
        call_row(SRC1, 1, '2026-10-20T12:00:00Z', 'ENA/USDT LONG Entry: 0.62 SL: 0.58 TP1: 0.70'),
        call_row(SRC2, 2, '2026-10-20T12:01:00Z', 'ENAUSDT long, entry 0.62, SL 0.58, TPs 0.70 0.78'),
        call_row(SRC3, 3, '2026-10-20T12:02:00Z', 'Long ENA/USDT now. Entry 0.62. Stop 0.58. Target 0.70.'),
        call_row(SRC4, 4, '2026-10-20T12:03:00Z', 'ENA/USDT LONG Entry: 0.62 SL: 0.58 TP1: 0.70',
                 forwarded_from='@core_signal_one'),
    ]
    event = build_candidate_events(calls, RULESET)[0]
    event['posts'] = [post_row(call) for call in event['calls']]
    independence = apply_independence(event, RELIABILITY)
    assert independence['independent_voice_count'] == 3
    forwarded = next(voice for voice in independence['voices'] if voice['sourceId'] == SRC4)
    assert forwarded['copied'] is True
    bundle = build_bundle(event, independence, RULESET, RELIABILITY, [], [],
                          '2026-10-20T13:00:00Z')
    assert '0xsrc4' not in bundle['evidence']['firstIndependentCallBySource']
    assert bundle['voices'][-1]['copied'] is True


def test_shared_referral_markers_downweight_and_record():
    marker = [{'source': 'url', 'value': 'ref=ABC123', 'url': 'https://gmgn.ai/sol/token/X?ref=ABC123'}]
    calls = [
        call_row(SRC1, 1, '2026-10-20T12:00:00Z', 'ENA thesis: listings and locked supply.',
                 conviction=90),
        call_row(SRC2, 2, '2026-10-20T12:01:00Z', 'ENA accumulation before the listing wave.',
                 conviction=80, referral_markers=marker),
        call_row(SRC3, 3, '2026-10-20T12:02:00Z', 'ENA/USDT long bias into the listing.',
                 conviction=40, referral_markers=marker, direction='long'),
    ]
    for index, call in enumerate(calls):
        call['parser'] = 'cashtag'
        call['entry_price'] = None
        call['stop_price'] = None
        call['target_price'] = None
        call['targets'] = []
        call['ticker'] = 'ENA'
    event = build_candidate_events(calls, RULESET)[0]
    event['posts'] = [post_row(call) for call in event['calls']]
    independence = apply_independence(event, RELIABILITY)
    assert independence['shared_markers'] == [
        {'value': 'ref=ABC123', 'sources': [SRC2, SRC3]}]
    weights = {voice['sourceId']: voice['weightBps'] for voice in independence['voices']}
    assert weights[SRC2] == 5000 and weights[SRC3] == 5000 and weights[SRC1] == 10000
    assert independence['weighted_conviction'] == '75.00'


def test_tampered_bundle_produces_different_hash():
    calls = [
        call_row(SRC1, 1, '2026-10-20T12:00:00Z', 'ENA/USDT LONG Entry: 0.62 SL: 0.58 TP1: 0.70'),
        call_row(SRC2, 2, '2026-10-20T12:01:00Z', 'ENAUSDT long, entry 0.62, SL 0.58, TPs 0.70 0.78'),
        call_row(SRC3, 3, '2026-10-20T12:02:00Z', 'Long ENA/USDT now. Entry 0.62. Stop 0.58. Target 0.70.'),
    ]
    event = build_candidate_events(calls, RULESET)[0]
    event['posts'] = [post_row(call) for call in event['calls']]
    independence = apply_independence(event, RELIABILITY)
    bundle = build_bundle(event, independence, RULESET, RELIABILITY, [], [],
                          '2026-10-20T13:00:00Z')
    assert bundle['bundleHash'] == bundle_hash(bundle)
    tampered = copy.deepcopy(bundle)
    tampered['asset']['ticker'] = 'ENB'
    assert bundle_hash(tampered) != bundle['bundleHash']


def test_identical_input_builds_identical_hash():
    calls = [
        call_row(SRC1, 1, '2026-10-20T12:00:00Z', 'ENA/USDT LONG Entry: 0.62 SL: 0.58 TP1: 0.70'),
        call_row(SRC2, 2, '2026-10-20T12:01:00Z', 'ENAUSDT long, entry 0.62, SL 0.58, TPs 0.70 0.78'),
        call_row(SRC3, 3, '2026-10-20T12:02:00Z', 'Long ENA/USDT now. Entry 0.62. Stop 0.58. Target 0.70.'),
    ]
    event = build_candidate_events(calls, RULESET)[0]
    event['posts'] = [post_row(call) for call in event['calls']]
    first = build_bundle(event, apply_independence(event, RELIABILITY), RULESET,
                         RELIABILITY, [], [], '2026-10-20T13:00:00Z')
    event_again = build_candidate_events(calls, RULESET)[0]
    event_again['posts'] = [post_row(call) for call in event_again['calls']]
    second = build_bundle(event_again, apply_independence(event_again, RELIABILITY), RULESET,
                          RELIABILITY, [], [], '2026-10-20T13:00:00Z')
    assert canonical_json(first) == canonical_json(second)
    assert first['bundleHash'] == second['bundleHash']


def test_narrative_event_groups_two_assets():
    calls = [
        call_row(SRC1, 1, '2026-10-20T12:00:00Z', 'ENA agents play is on.', conviction=70,
                 asset_key='cex:ENAUSDT', narrative_tags=['AI Agents']),
        call_row(SRC2, 2, '2026-10-20T13:00:00Z', 'XYZ agents runner next.', conviction=70,
                 asset_key='cex:XYZUSDT', narrative_tags=['ai_agents']),
    ]
    events = build_candidate_events(calls, RULESET)
    narrative = [event for event in events if event['level'] == 'narrative']
    assert len(narrative) == 1
    assert narrative[0]['narrative_key'] == 'ai_agents'
    assert narrative[0]['asset_key'] is None
    assert {call['asset_key'] for call in narrative[0]['calls']} == {'cex:ENAUSDT', 'cex:XYZUSDT'}
    asset_events = [event for event in events if event['level'] == 'asset']
    assert len(asset_events) == 2


def test_missing_liquidity_cannot_pass_contract_asset():
    address = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
    calls = [
        call_row(SRC1, 1, '2026-10-20T12:00:00Z', 'ape incoming', conviction=70,
                 asset_key=f'solana:{address}', chain='solana', contract_address=address,
                 ticker=None, pair=None, direction='spot_buy', parser='address',
                 entry_price=None, stop_price=None, target_price=None, targets=[]),
        call_row(SRC2, 2, '2026-10-20T12:10:00Z', 'solana runner loading', conviction=70,
                 asset_key=f'solana:{address}', chain='solana', contract_address=address,
                 ticker=None, pair=None, direction='spot_buy', parser='address',
                 entry_price=None, stop_price=None, target_price=None, targets=[]),
        call_row(SRC3, 3, '2026-10-20T12:20:00Z', 'in early on this one', conviction=70,
                 asset_key=f'solana:{address}', chain='solana', contract_address=address,
                 ticker=None, pair=None, direction='spot_buy', parser='address',
                 entry_price=None, stop_price=None, target_price=None, targets=[]),
    ]
    event = build_candidate_events(calls, RULESET)[0]
    event['posts'] = [post_row(call) for call in event['calls']]
    independence = apply_independence(event, RELIABILITY)
    bundle = build_bundle(event, independence, RULESET, RELIABILITY, [], [],
                          '2026-10-20T13:00:00Z')
    evaluation = evaluate_bundle(bundle)
    assert evaluation['decision'] == 'rejected'
    assert evaluation['reason_code'] == 'LIQUIDITY_FLOOR'
