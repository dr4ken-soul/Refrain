"""Canonical evidence bundle builder. Specified shapes, exact bytes, one hash."""
import hashlib
from datetime import timedelta
from uuid import NAMESPACE_URL, uuid5

from shared_types.canonical import canonical_json, parse_timestamp, timestamp

from .narratives import normalize_tag


def _source_hash_map(independence, reliability):
    """Map sourceId to its hex hash and hundredths score at freeze time."""
    mapping = {}
    for voice in independence['voices']:
        entry = reliability.get(voice['sourceId']) or {}
        mapping[voice['sourceId']] = {
            'sourceHash': entry.get('source_hash'),
            'scoreHundredths': entry.get('score_hundredths', 5000),
        }
    return mapping


def price_plan(event, ruleset):
    asset_key = event.get('asset_key') or ''
    if asset_key.startswith('cex:'):
        pair = asset_key.split(':', 1)[1]
        return {
            'primary': {'kind': 'binance', 'locator': pair},
            'check': {'kind': 'bybit', 'locator': pair},
            'maxDeviationBps': ruleset['priceAgreement']['listedPairMaxDeviationBps'],
        }
    return {
        'primary': {'kind': 'dexscreener', 'locator': event.get('asset_key') or ''},
        'check': {'kind': 'geckoterminal', 'locator': event.get('asset_key') or ''},
        'maxDeviationBps': ruleset['priceAgreement']['contractAssetMaxDeviationBps'],
    }


def proposed_terms(event, independence, ruleset):
    """Terms an approval would open. Structured levels win where present."""
    asset_is_contract = bool(event.get('asset_key', '').startswith(('solana:', 'evm:')))
    levels = [call for call in independence['calls']
              if call.get('entry_price') and call.get('stop_price') and call.get('target_price')]
    closed_at = max((parse_timestamp(call['posted_at']) for call in independence['calls']), default=None)
    if asset_is_contract:
        defaults = ruleset['defaultTerms']['contractAsset']
        expiry_hours = defaults['expiryHours']
    else:
        listed = ruleset['defaultTerms']['listedPair']
        expiry_hours = defaults_expiry(listed, ruleset, bool(levels))
    if levels:
        structured = levels[0]
        return {
            'direction': structured.get('direction') or 'long',
            'sizeUnits': None,
            'stopBps': None,
            'targetBps': None,
            'stopPrice': structured['stop_price'],
            'targetPrice': structured['target_price'],
            'expiresAt': timestamp(closed_at + timedelta(hours=expiry_hours)) if closed_at else None,
            'hasStructuredLevels': True,
        }
    contract_defaults = ruleset['defaultTerms']['contractAsset']
    return {
        'direction': 'spot_buy',
        'sizeUnits': None,
        'stopBps': contract_defaults['stopPctBps'],
        'targetBps': contract_defaults['targetPctBps'],
        'stopPrice': None,
        'targetPrice': None,
        'expiresAt': timestamp(closed_at + timedelta(hours=expiry_hours)) if closed_at else None,
        'hasStructuredLevels': False,
    }


def defaults_expiry(listed, ruleset, structured):
    if structured:
        return ruleset['defaultTerms']['contractAsset']['expiryHours']
    return listed['fallbackExpiryHours']


def build_bundle(event, independence, ruleset, reliability, liquidity,
                 entry_observations=None, evaluated_at=None):
    """Assemble the frozen EvidenceBundle and its SHA-256 over canonical bytes."""
    case_kind = event.get('case_kind', 'convergence')
    identity = f"case:{case_kind}:{event.get('asset_key') or event.get('narrative_key')}:{event['window_started_at']}"
    event_id = str(uuid5(NAMESPACE_URL, identity))
    closed_at = max((parse_timestamp(call['posted_at']) for call in independence['calls']), default=None)
    source_map = _source_hash_map(independence, reliability)

    contributing = []
    for call in independence['calls']:
        contributing.append({
            'callId': str(call['id']),
            'sourceHash': source_map[call['source_id']]['sourceHash'],
            'messageId': call['telegram_message_id'],
            'timestamp': call['posted_at'],
            'direction': call.get('direction') or 'mention',
            'conviction': call.get('conviction') or 0,
            'narrativeTags': [normalize_tag(tag) for tag in call.get('narrative_tags', [])],
            'span': [call.get('span_start'), call.get('span_end')],
        })

    posts = []
    seen = set()
    for call in independence['calls']:
        key = (call['source_id'], call['telegram_message_id'])
        if key in seen:
            continue
        seen.add(key)
        posts.append({
            'sourceHash': source_map[call['source_id']]['sourceHash'],
            'messageId': call['telegram_message_id'],
            'text': call.get('post_text') or '',
            'urls': call.get('post_urls') or [],
            'contentHash': call.get('post_content_hash'),
            'forwardedFrom': call.get('forwarded_from'),
            'editedAt': call.get('edited_at'),
        })
    posts.sort(key=lambda p: (p['sourceHash'] or '', p['messageId']))

    reliability_rows = []
    for voice in independence['voices']:
        entry = reliability.get(voice['sourceId']) or {}
        reliability_rows.append({
            'sourceHash': source_map[voice['sourceId']]['sourceHash'],
            'scoreHundredths': entry.get('score_hundredths', 5000),
            'origin': entry.get('origin', 'neutral'),
            'block': entry.get('block'),
        })
    reliability_rows.sort(key=lambda r: (r['sourceHash'] or '',))

    promotion_rows = []
    for call in independence['calls']:
        promotion_rows.append({
            'sourceHash': source_map[call['source_id']]['sourceHash'],
            'messageId': call['telegram_message_id'],
            'isAdvertisement': bool(call.get('is_advertisement')),
            'filterReason': call.get('filter_reason'),
            'referralMarkers': call.get('referral_markers') or [],
            'scheduledCall': call.get('scheduled_call'),
        })

    weights_rows = []
    for voice in independence['voices']:
        voice_markers = []
        for row in promotion_rows:
            if row['sourceHash'] == voice['sourceHash']:
                voice_markers.extend(marker['value'] for marker in row['referralMarkers'])
        weights_rows.append({
            'sourceHash': voice['sourceHash'],
            'weightBps': voice['weightBps'],
            'sharedMarkers': sorted(set(voice_markers)),
        })

    bundle = {
        'eventId': event_id,
        'caseKind': case_kind,
        'rulesetVersion': ruleset['version'],
        'rulesetHash': ruleset['ruleset_hash'],
        'asset': {
            'assetKey': event.get('asset_key'),
            'chain': _chain_of(event),
            'contractAddress': _contract_of(event),
            'ticker': _ticker_of(independence),
            'pair': _pair_of(independence),
        },
        'narrativeKey': normalize_tag(event.get('narrative_key')) if event.get('narrative_key') else None,
        'window': {
            'startedAt': event['window_started_at'],
            'closedAt': timestamp(closed_at) if closed_at else event['window_started_at'],
        },
        'voices': [
            {
                'sourceHash': source_map[voice['sourceId']]['sourceHash'],
                'callIds': voice['callIds'],
                'firstCallAt': voice['firstCallAt'],
                'direction': voice['direction'],
                'conviction': voice['conviction'],
                'copied': voice['copied'],
                'weightBps': voice['weightBps'],
            } for voice in independence['voices']
        ],
        'independentVoiceCount': independence['independent_voice_count'],
        'weightedConviction': independence['weighted_conviction'],
        'timingSpreadSeconds': independence['timing_spread_seconds'],
        'evidence': {
            'contributingCalls': contributing,
            'posts': posts,
            'reliability': reliability_rows,
            'completeCallOrder': [str(call['id']) for call in independence['calls']],
            'canonicalOrder': 'posted_at ascending, then telegram_message_id ascending',
            'firstIndependentCallBySource': {
                source_map[voice['sourceId']]['sourceHash']: voice['callIds'][0]
                for voice in independence['voices'] if not voice['copied']
            },
            'promotion': independence['promotion'],
            'independenceWeights': weights_rows,
            'sharedReferralMarkers': independence['shared_markers'],
            'liquidity': liquidity,
            'entryObservations': entry_observations or [],
            'ruleParameters': {
                'rulesetHash': ruleset['ruleset_hash'],
                'values': {
                    'independentVoicesRequired': ruleset['independentVoicesRequired'],
                    'weightedConvictionFloor': ruleset['weightedConvictionFloor'],
                    'windows': ruleset['windows'],
                    'paperSize': ruleset['paperSize'],
                    'priceAgreement': ruleset['priceAgreement'],
                    'promotionVeto': ruleset['promotionVeto'],
                    'liquidity': ruleset['liquidity'],
                    'coordination': ruleset['coordination'],
                    'independence': ruleset['independence'],
                },
            },
        },
        'pricePlan': price_plan(event, ruleset),
        'proposedTerms': proposed_terms(event, independence, ruleset),
        'evaluatedAt': evaluated_at,
    }
    bundle['bundleHash'] = '0x' + hashlib.sha256(canonical_bundle_bytes(bundle).encode('utf-8')).hexdigest()
    return bundle


def _chain_of(event):
    asset_key = event.get('asset_key') or ''
    if asset_key.startswith('solana:'):
        return 'solana'
    if asset_key.startswith('evm:'):
        return 'ethereum'
    if asset_key.startswith('cex:'):
        return 'cex'
    return 'cex'


def _contract_of(event):
    calls = event.get('calls') or []
    for call in calls:
        if call.get('contract_address'):
            return call['contract_address']
    return None


def _ticker_of(independence):
    for call in independence['calls']:
        if call.get('ticker'):
            return call['ticker']
    return None


def _pair_of(independence):
    for call in independence['calls']:
        if call.get('pair'):
            return call['pair']
    return None


def canonical_bundle_bytes(bundle):
    """The exact canonical bytes the bundle hash covers: every field, hash excluded."""
    counted = {key: value for key, value in bundle.items() if key != 'bundleHash'}
    return canonical_json(counted)


def bundle_hash(bundle):
    return '0x' + hashlib.sha256(canonical_bundle_bytes(bundle).encode('utf-8')).hexdigest()
