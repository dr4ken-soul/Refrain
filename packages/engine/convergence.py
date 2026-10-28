"""Two-level convergence grouping with the exact independence rules.

Independence: a forwarded call contributes zero voices, repeats by one channel
inside the window collapse to a single voice keeping the earliest call, exact
near-duplicate text carried across channels is copied evidence, and channels
sharing a referral marker inside the window are down-weighted to half weight.
"""
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from shared_types.canonical import parse_timestamp

from .narratives import normalize_tag


def _window_hours(asset_key, ruleset):
    if asset_key and (asset_key.startswith('solana:') or asset_key.startswith('evm:')):
        return ruleset['windows']['contractAssetHours']
    return ruleset['windows']['listedPairHours']


def _normalized_text(text):
    return ' '.join((text or '').casefold().split())


def _split_windows(ordered, window_hours):
    """Anchor each window at its first call; the next anchor starts after it."""
    windows = []
    index = 0
    while index < len(ordered):
        horizon = parse_timestamp(ordered[index]['posted_at']) + timedelta(hours=window_hours)
        member = []
        while index < len(ordered) and parse_timestamp(ordered[index]['posted_at']) <= horizon:
            member.append(ordered[index])
            index += 1
        windows.append(member)
    return windows


def build_candidate_events(calls, ruleset):
    """Level 1 asset events plus level 2 narrative events, in candidate order."""
    asset_events = group_by_asset(calls, ruleset)
    narrative_events = group_by_narrative(calls, ruleset)
    return asset_events + narrative_events


def group_by_asset(calls, ruleset):
    """Same canonical asset key inside the family window forms an asset event."""
    groups = {}
    for call in calls:
        key = call.get('asset_key')
        if not key or call.get('direction') == 'close':
            continue
        groups.setdefault(key, []).append(call)
    events = []
    for key, members in groups.items():
        ordered = sorted(members, key=lambda c: (c['posted_at'], c['telegram_message_id']))
        for window in _split_windows(ordered, _window_hours(key, ruleset)):
            events.append({
                'level': 'asset',
                'asset_key': key,
                'narrative_key': None,
                'calls': window,
                'window_started_at': window[0]['posted_at'],
            })
    return events


def group_by_narrative(calls, ruleset):
    """Level 2: at least two separate assets sharing one theme in the window."""
    groups = {}
    for call in calls:
        if not call.get('asset_key') or call.get('direction') == 'close':
            continue
        for tag in call.get('narrative_tags', []):
            key = normalize_tag(tag)
            if key != 'other':
                groups.setdefault(key, []).append(call)
    events = []
    for narrative_key, members in groups.items():
        ordered = sorted(members, key=lambda c: (c['posted_at'], c['telegram_message_id']))
        for window in _split_windows(ordered, ruleset['windows']['contractAssetHours']):
            distinct_assets = {c['asset_key'] for c in window}
            if len(distinct_assets) >= 2:
                events.append({
                    'level': 'narrative',
                    'asset_key': None,
                    'narrative_key': narrative_key,
                    'calls': window,
                    'window_started_at': window[0]['posted_at'],
                })
    return events


def apply_independence(event, reliability):
    """Compute voices, weights and independence evidence for one candidate.

    event['calls'] carry joined post fields and marker evidence. event['posts']
    are the window's asset-matching posts by contributing sources, ads
    included. reliability maps source id to {'source_hash', 'score_hundredths'}
    at freeze time.
    """
    calls = sorted(event['calls'], key=lambda c: (c['posted_at'], c['telegram_message_id']))

    copied = set()
    for position, call in enumerate(calls):
        if call.get('forwarded_from'):
            copied.add(position)
            continue
        text = _normalized_text(call.get('post_text', ''))
        if not text:
            continue
        for earlier in range(position):
            other = calls[earlier]
            if other['source_id'] != call['source_id'] and \
                    _normalized_text(other.get('post_text', '')) == text:
                copied.add(position)
                break

    by_source = {}
    for position, call in enumerate(calls):
        by_source.setdefault(call['source_id'], []).append(position)

    shared_markers = {}
    for call in calls:
        for marker in call.get('referral_markers') or []:
            shared_markers.setdefault(marker['value'], set()).add(call['source_id'])
    linked = {source for sources in shared_markers.values() if len(sources) > 1
              for source in sources}

    voices = []
    for source_id, positions in by_source.items():
        first_position = positions[0]
        first = calls[first_position]
        voices.append({
            'sourceId': source_id,
            'sourceHash': (reliability.get(source_id) or {}).get('source_hash'),
            'callIds': [str(calls[position]['id']) for position in positions],
            'firstCallAt': first['posted_at'],
            'direction': first.get('direction') or 'mention',
            'conviction': first.get('conviction') or 0,
            'copied': first_position in copied,
            'weightBps': 5000 if source_id in linked else 10000,
        })
    voices.sort(key=lambda v: (v['firstCallAt'], str(v['sourceId'])))

    independent = [voice for voice in voices if not voice['copied']]
    spread_seconds = 0
    if independent:
        spread = (parse_timestamp(independent[-1]['firstCallAt'])
                  - parse_timestamp(independent[0]['firstCallAt']))
        spread_seconds = int(spread.total_seconds())
    weight_total = sum(voice['weightBps'] for voice in independent)
    weighted = sum(voice['weightBps'] * voice['conviction'] for voice in independent)
    weighted_conviction = (Decimal(weighted) / Decimal(weight_total)).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP) if weight_total else Decimal('0.00')

    source_map = {voice['sourceId']: voice['sourceHash'] for voice in voices}
    promotion_rows = []
    for post in sorted(event.get('posts', []), key=lambda p: (p['posted_at'], p['telegram_message_id'])):
        promotion_rows.append({
            'sourceHash': source_map.get(post['source_id']),
            'messageId': post['telegram_message_id'],
            'isAdvertisement': bool(post.get('is_advertisement')),
            'filterReason': post.get('filter_reason'),
            'referralMarkers': post.get('referral_markers') or [],
            'scheduledCall': post.get('scheduled_call'),
        })

    return {
        'calls': calls,
        'copied_positions': sorted(copied),
        'voices': voices,
        'independent_voice_count': len(independent),
        'timing_spread_seconds': spread_seconds,
        'weighted_conviction': format(weighted_conviction, '.2f'),
        'shared_markers': [{'value': value, 'sources': sorted(sources)}
                           for value, sources in sorted(shared_markers.items())
                           if len(sources) > 1],
        'linked_sources': sorted(linked),
        'promotion': promotion_rows,
    }
