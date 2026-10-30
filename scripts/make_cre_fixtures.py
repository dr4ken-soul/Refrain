"""Build the two CRE workflow fixtures: one approved, one rejected bundle.

The bundles are produced by the same engine code the pipeline runs, so the
CRE parity test compares against real evaluator output rather than a
hand-written expectation. Deterministic inputs:

  * ruleset from seed/ruleset-v1.json with the same ruleset hash convention
    as the seed loader;
  * source identities from sha256(source id), stable per voice;
  * call ids from the repository's deterministic uuid5 convention;
  * structured WIF levels quoted identically by each independent voice.

Market observations are live at generation time: the approved bundle records
real dexscreener and geckoterminal liquidity and entry rows, and the script
refuses to write a bundle whose recorded sources disagree beyond the mandate
tolerance or whose liquidity sits under the floor. A rejection needs no
market read: its evidence fails on independence alone.

Run from the repository root with the project virtual environment:

    .venv\\Scripts\\python scripts\\make_cre_fixtures.py
"""
import asyncio
import hashlib
import json
import sys
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engine import build_bundle, evaluate_bundle, build_candidate_events  # noqa: E402
from engine.convergence import apply_independence  # noqa: E402
from engine.market import observe_asset  # noqa: E402
from shared_types.canonical import canonical_json  # noqa: E402

FIXTURES = ROOT / 'cre' / 'fixtures'
WIF_MINT = 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'
ASSET_KEY = f'solana:{WIF_MINT}'

SRC1 = '11111111-1111-1111-1111-111111111111'
SRC2 = '22222222-2222-2222-2222-222222222222'
SRC3 = '33333333-3333-3333-3333-333333333333'
SRC_REPEATER = '44444444-4444-4444-4444-444444444444'

ENTRY_LEVEL = '0.18'
STOP_LEVEL = '0.15'
TARGET_LEVEL = '0.30'


def load_ruleset():
    ruleset = json.loads((ROOT / 'seed/ruleset-v1.json').read_text(encoding='utf-8'))
    ruleset['ruleset_hash'] = '0x' + hashlib.sha256(
        canonical_json(ruleset).encode('utf-8')).hexdigest()
    return ruleset


RULESET = load_ruleset()


def source_hash(source_id):
    return '0x' + hashlib.sha256(source_id.encode('utf-8')).hexdigest()


RELIABILITY = {
    source_id: {
        'source_hash': source_hash(source_id),
        'score_hundredths': 5000,
        'origin': 'neutral',
        'block': None,
    }
    for source_id in (SRC1, SRC2, SRC3, SRC_REPEATER)
}


def call_row(source_id, message_id, posted_at, text, conviction):
    span_end = len(text)
    return {
        'id': str(uuid5(NAMESPACE_URL,
                        f'call:{source_id}:{message_id}:0:{span_end}')),
        'source_id': source_id,
        'telegram_message_id': message_id,
        'asset_key': ASSET_KEY,
        'chain': 'solana',
        'contract_address': WIF_MINT,
        'ticker': 'WIF',
        'pair': None,
        'direction': 'long',
        'entry_price': ENTRY_LEVEL,
        'stop_price': STOP_LEVEL,
        'target_price': TARGET_LEVEL,
        'targets': [TARGET_LEVEL],
        'conviction': conviction,
        'urgency': None,
        'sentiment': 'bullish',
        'narrative_tags': ['dog_coins'],
        'parser': 'structured',
        'span_start': 0,
        'span_end': span_end,
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


def freeze(calls, liquidity, entry, evaluated_at):
    events = build_candidate_events(calls, RULESET)
    if len(events) != 1:
        raise RuntimeError(f'Expected one candidate event, found {len(events)}.')
    event = events[0]
    event['posts'] = [post_row(call) for call in event['calls']]
    independence = apply_independence(event, RELIABILITY)
    bundle = build_bundle(event, independence, RULESET, RELIABILITY,
                          liquidity, entry, evaluated_at)
    evaluation = evaluate_bundle(bundle)
    return bundle, evaluation


def assert_price_agreement(entry):
    prices = [row for row in entry if row.get('price') is not None]
    if len(prices) < 2:
        raise RuntimeError(
            f'Need both recorded price sources for the approved fixture, got {len(prices)}.')
    primary = next(row for row in prices if row['kind'] == 'dexscreener')
    check = next(row for row in prices if row['kind'] == 'geckoterminal')
    primary_price = float(primary['price'])
    check_price = float(check['price'])
    deviation_bps = abs(primary_price - check_price) / min(primary_price, check_price) * 10000
    if deviation_bps > RULESET['priceAgreement']['contractAssetMaxDeviationBps']:
        raise RuntimeError(
            f'Recorded sources deviate {deviation_bps:.0f} bps right now; '
            'wait for calmer tape and regenerate.')
    print(f'  recorded agreement: {deviation_bps:.1f} bps '
          f'({primary_price} vs {check_price})')


def assert_liquidity(liquidity):
    floor_cents = RULESET['liquidity']['contractAssetFloorUsd'] * 100
    if not liquidity:
        raise RuntimeError('No liquidity rows recorded.')
    thin = [row for row in liquidity
            if row.get('liquidityUsdCents') is None or row['liquidityUsdCents'] < floor_cents]
    if thin:
        raise RuntimeError(f'Recorded liquidity below the floor: {thin}')
    for row in liquidity:
        print(f'  liquidity {row["kind"]}: ${row["liquidityUsdCents"] / 100:,.0f}')


def build_approved():
    print('Approved fixture: three independent voices on WIF.')
    calls = [
        call_row(SRC1, 1, '2026-10-29T08:00:00Z',
                 f'WIF SOL long. Entry {ENTRY_LEVEL}, SL {STOP_LEVEL}, TP1 {TARGET_LEVEL}. '
                 'Size before the next legs add volume.', 70),
        call_row(SRC2, 2, '2026-10-29T08:47:00Z',
                 f'WIF looks ready here. Entry {ENTRY_LEVEL} stop {STOP_LEVEL} '
                 f'target {TARGET_LEVEL}. Chart coiling.', 65),
        call_row(SRC3, 3, '2026-10-29T09:15:00Z',
                 f'Bought WIF. Entry {ENTRY_LEVEL}. Invalidation {STOP_LEVEL}. '
                 f'First target {TARGET_LEVEL}.', 80),
    ]
    rows = asyncio.run(observe_asset(ASSET_KEY, 10))
    liquidity = [dict(row, assetKey=ASSET_KEY) for row in rows]
    entry = [dict(row, assetKey=ASSET_KEY) for row in rows if row.get('price') is not None]
    assert_liquidity(liquidity)
    assert_price_agreement(entry)
    bundle, evaluation = freeze(calls, liquidity, entry, '2026-10-29T09:45:00Z')
    if evaluation['decision'] != 'approved':
        raise RuntimeError(
            f'Expected an approved fixture, got {evaluation["decision"]} '
            f'({evaluation["reason_code"]}): '
            + json.dumps([row for row in evaluation['rule_results'] if not row['pass']]))
    print(f'  window: {bundle["window"]["startedAt"]} to {bundle["window"]["closedAt"]}')
    print(f'  expiry: {bundle["proposedTerms"]["expiresAt"]}')
    return bundle, evaluation


def build_rejected():
    print('Rejected fixture: one source repeating the same call three times.')
    text_template = 'WIF repeat alert #{index}. Entry {entry} stop {stop} target {target}.'
    calls = []
    for index, (clock, conviction) in enumerate(
            (('10:00', 70), ('10:30', 70), ('11:00', 70)), start=1):
        message_id = 100 + index
        text = text_template.format(index=index, entry=ENTRY_LEVEL,
                                    stop=STOP_LEVEL, target=TARGET_LEVEL)
        calls.append(call_row(SRC_REPEATER, message_id,
                              f'2026-10-29T{clock}:00Z', text, conviction))
    bundle, evaluation = freeze(calls, [], [], '2026-10-29T11:30:00Z')
    if evaluation['decision'] != 'rejected':
        raise RuntimeError(
            f'Expected a rejected fixture, got {evaluation["decision"]}: '
            + json.dumps([row for row in evaluation['rule_results'] if not row['pass']]))
    print(f'  reason: {evaluation["reason_code"]}')
    return bundle, evaluation


def write_fixture(name, bundle, evaluation):
    FIXTURES.mkdir(parents=True, exist_ok=True)
    path = FIXTURES / name
    payload = {'bundle': bundle, 'evaluation': evaluation}
    text = json.dumps(payload, sort_keys=True, indent=2, ensure_ascii=False) + '\n'
    path.write_text(text, encoding='utf-8')
    print(f'  wrote {path.relative_to(ROOT)}')
    print(f'  bundleHash {bundle["bundleHash"]}')
    print(f'  eventId {bundle["eventId"]}')


def main():
    print(f'ruleset hash: {RULESET["ruleset_hash"]}')
    write_fixture('verdict-approved.json', *build_approved())
    write_fixture('verdict-rejected.json', *build_rejected())
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
