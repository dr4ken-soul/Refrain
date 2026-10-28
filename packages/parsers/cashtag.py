"""Cashtags and bare USDT pair symbols, with their spans."""
import re

from .assets import CASHTAG_RE, PAIR_RE, pair_key
from .spans import word_starts_at
EXTREME_MULTIPLIER_RE = re.compile(r'\b\d{2,6}\s*[xX]\b')


def parse_cashtags(text):
    """Each cashtag becomes a mention with an implied USDT pair key."""
    results = []
    for match in CASHTAG_RE.finditer(text):
        if not word_starts_at(text, match.start()):
            continue
        ticker = match.group(1).upper()
        pair = f'{ticker}USDT'
        results.append({
            'direction': 'mention',
            'parser': 'cashtag',
            'asset_key': pair_key(pair),
            'chain': 'cex',
            'contract_address': None,
            'ticker': ticker,
            'pair': pair,
            'entry_price': None,
            'stop_price': None,
            'target_price': None,
            'targets': [],
            'span_start': match.start(),
            'span_end': match.end(),
            'narrative_tags': [],
            'extreme_language': bool(EXTREME_MULTIPLIER_RE.search(text)),
        })
    return results


def parse_pairs(text):
    """Bare pair symbols, for example ENAUSDT, that stand alone as words."""
    results = []
    for match in PAIR_RE.finditer(text):
        if not word_starts_at(text, match.start()):
            continue
        ticker = match.group(1).removesuffix('USDT')
        if ticker.lower() == 'usdt':
            continue
        results.append({
            'direction': 'mention',
            'parser': 'cashtag',
            'asset_key': pair_key(match.group(1)),
            'chain': 'cex',
            'contract_address': None,
            'ticker': ticker,
            'pair': match.group(1),
            'entry_price': None,
            'stop_price': None,
            'target_price': None,
            'targets': [],
            'span_start': match.start(),
            'span_end': match.end(),
            'narrative_tags': [],
            'extreme_language': EXTREME_MULTIPLIER_RE.search(text) is not None,
        })
    return results
