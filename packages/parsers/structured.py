"""Structured futures and TA call blocks: pair, direction, entry, stop, targets.

The audited core-signal channels post blocks shaped like:

  ENA/USDT LONG
  Entry: 0.62
  SL: 0.58
  TP1: 0.70 TP2: 0.78 TP3: 0.90

Labels, spacing and emoji vary. The parser is tolerant about layout and strict
about what it records: every matched value keeps its exact character span.
"""
import re
from decimal import Decimal, InvalidOperation

from .assets import find_pair, normalize_pair, pair_key

_NUMBER = r'\d+(?:\.\d+)?'
EXTREME_MULTIPLIER_RE = re.compile(r'\b\d{2,6}\s*[xX]\b')
DIRECTION_RE = re.compile(r'\b(LONG|SHORT)\b', re.IGNORECASE)
SPOT_RE = re.compile(r'\b(BUY\s+SPOT|SPOT\s+BUY)\b', re.IGNORECASE)
ENTRY_RE = re.compile(
    r'(?:entry(?:\s+zone)?|\bEP\b)\s*[:=]?\s*(' + _NUMBER + r')(?:\s*[-~]\s*(' + _NUMBER + r'))?',
    re.IGNORECASE)
STOP_RE = re.compile(
    r'(?:\bSL\b|stop(?:\s+loss)?)\s*[:=]?\s*(' + _NUMBER + r')', re.IGNORECASE)
TARGETS_RE = re.compile(
    r'(?:\bTPs?\s*\d?\b|targets?|take\s+profit)\s*[:=]?\s*(' + _NUMBER + r')'
    r'(?:\s*[,/\s]\s*(?:\bTPs?\s*\d?\b\s*[:=]?\s*)?(' + _NUMBER + r'))*',
    re.IGNORECASE)


def _decimal(value):
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def parse_structured(text):
    """Return one structured CallCandidate dict, or None when no block matches."""
    pairs = []
    for match in DIRECTION_RE.finditer(text):
        pairs.append((match.start(), match))
    for match in SPOT_RE.finditer(text):
        pairs.append((match.start(), match))
    pairs.sort(key=lambda item: item[0])
    if not pairs:
        return None
    direction_match = pairs[0][1]
    direction = direction_match.group(0).upper()
    if direction == 'LONG':
        direction = 'long'
    elif direction == 'SHORT':
        direction = 'short'
    else:
        direction = 'spot_buy'

    search_end = min(len(text), direction_match.end() + 600)
    found = find_pair(text, max(0, direction_match.start() - 40), direction_match.end() + 40)
    if not found:
        return None
    pair, ticker, pair_span = found

    window = text[direction_match.start():search_end]
    entry = ENTRY_RE.search(window)
    stop = STOP_RE.search(window)
    targets = TARGETS_RE.search(window)
    if not entry or not (stop or targets):
        return None
    entry_value = _decimal(entry.group(1))
    if entry_value is None:
        return None
    entry_price = entry.group(1)
    stop_price = stop.group(1) if stop else None
    target_prices = []
    if targets:
        stripped = re.sub(r'\bTPs?\s*\d?\s*[:=]?\s*', '', targets.group(0), flags=re.IGNORECASE)
        stripped = re.sub(r'\btake\s+profit\s*[:=]?\s*', '', stripped, flags=re.IGNORECASE)
        stripped = re.sub(r'\btargets?\s*[:=]?\s*', '', stripped, flags=re.IGNORECASE)
        for number in re.finditer(_NUMBER, stripped):
            target_prices.append(number.group(0))
    if stop_price and target_prices:
        stop_value = _decimal(stop_price)
        extreme = max(_decimal(t) for t in target_prices)
        lowest = min(_decimal(t) for t in target_prices)
        malformed = (direction == 'long' and stop_value >= extreme) or \
            (direction == 'short' and stop_value <= lowest)
        if malformed:
            return None
    if not target_prices and not stop_price:
        return None

    block_start = direction_match.start()
    block_end = direction_match.start() + max(
        entry.end(), targets.end() if targets else 0, stop.end() if stop else 0)

    return {
        'direction': direction,
        'parser': 'structured',
        'asset_key': pair_key(pair),
        'chain': 'cex',
        'contract_address': None,
        'ticker': ticker,
        'pair': pair,
        'entry_price': entry_price,
        'stop_price': stop_price,
        'target_price': target_prices[0] if target_prices else None,
        'targets': target_prices,
        'span_start': block_start,
        'span_end': block_end,
        'narrative_tags': [],
        'extreme_language': EXTREME_MULTIPLIER_RE.search(text) is not None,
    }
