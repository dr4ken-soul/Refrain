"""Classification orchestration: every post becomes calls, exits, ads or skips."""
from dataclasses import dataclass

from .addresses import parse_addresses
from .advertisement import classify_promotion, collect_referral_markers, detect_scheduled_call
from .cashtag import parse_cashtags, parse_pairs
from .exits import parse_exit
from .structured import parse_structured
from .urls import parse_urls


@dataclass(frozen=True)
class SkipRecord:
    is_advertisement: bool
    filter_reason: str


# PRODUCT.md conviction defaults where no model runs. A url call resolves a
# contract address inside a call link, so it scores as a bare address mention.
_BASE_CONVICTION = {'structured': 70, 'address': 40, 'cashtag': 55, 'url': 40}
_EXTREME_PENALTY = 15


def classify_post(post):
    """Return {'calls': [...], 'skip': SkipRecord | None, 'residue': bool}.

    Media-only posts skip with a recorded reason. Promotion-intent posts are
    advertisements and never become calls. Genuine call links with referral
    parameters stay calls and record their markers as evidence.
    """
    text = post.get('text') or ''
    urls = post.get('urls') or []
    result = {'calls': [], 'skip': None, 'residue': False,
              'referral_markers': collect_referral_markers(text, urls),
              'scheduled_call': detect_scheduled_call(text)}
    if post.get('is_media_only'):
        result['skip'] = SkipRecord(False, 'media_only')
        return result
    is_advertisement, reason = classify_promotion(text, urls)
    if is_advertisement:
        result['skip'] = SkipRecord(True, reason)
        return result
    structured = parse_structured(text)
    if structured:
        result['calls'].append(structured)
        return result
    exit_event = parse_exit(text)
    if exit_event:
        result['calls'].append(exit_event)
        return result
    symbols = parse_pairs(text)
    result['calls'].extend(symbols)
    result['calls'].extend(parse_cashtags(text))
    result['calls'].extend(parse_addresses(text))
    result['calls'].extend(parse_urls(text, post.get('web_preview_title')))
    result['calls'] = _dedupe(result['calls'])
    result['calls'] = apply_deterministic_defaults(result['calls'])
    if result['calls']:
        return result
    if text.strip():
        result['residue'] = True
    else:
        result['skip'] = SkipRecord(False, 'no_machine_readable_text')
    return result


def apply_deterministic_defaults(calls):
    """Record conviction, urgency and sentiment where no model ran.

    PRODUCT.md defaults: structured call with levels 70, cashtag thesis 55,
    bare contract address 40, minus 15 where extreme multiplier language
    appears, clamped to 0 to 100. Urgency stays unrecorded because the
    deterministic parsers cannot read it. Direction fixes sentiment.
    Exit events carry no conviction because they state no new position.
    """
    for call in calls:
        if call.get('direction') == 'close':
            call['conviction'] = None
            call['urgency'] = None
            call['sentiment'] = None
            continue
        base = _BASE_CONVICTION.get(call.get('parser'))
        conviction = base if base is not None else 0
        if call.get('extreme_language'):
            conviction -= _EXTREME_PENALTY
        call['conviction'] = max(0, min(100, conviction))
        call['urgency'] = None
        call['sentiment'] = _sentiment(call.get('direction'))
    return calls


def _sentiment(direction):
    if direction in ('long', 'spot_buy'):
        return 'bullish'
    if direction == 'short':
        return 'bearish'
    return None


_PATTERN_PRIORITY = {'structured': 0, 'cashtag': 1, 'address': 2, 'url': 3, 'llm': 4, 'skip': 5}


def _dedupe(calls):
    """One record per asset per post: highest-priority earliest span survives."""
    best = {}
    for call in calls:
        key = call.get('asset_key')
        if not key:
            continue
        rank = (_PATTERN_PRIORITY.get(call.get('parser'), 9), call.get('span_start', 0))
        current = best.get(key)
        if current is None or rank < (current['rank'][0], current['rank'][1]):
            best[key] = {'call': call, 'rank': rank}
    return [entry['call'] for entry in best.values()]
