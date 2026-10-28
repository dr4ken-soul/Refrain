"""Contract addresses posted directly: Solana base58 and EVM 0x addresses."""
import re

from .assets import BASE58_RE, EVM_RE, evm_key, solana_key
from .spans import word_starts_at

EXTREME_MULTIPLIER_RE = re.compile(r'\b\d{2,6}\s*[xX]\b')
URL_SPAN_RE = re.compile(r'https?://\S+')


def _inside_url(match, url_spans):
    return any(match.start() >= start and match.end() <= end for start, end in url_spans)


def parse_addresses(text):
    """Every bare address occurrence becomes one mention record with its span."""
    results = []
    url_spans = [(m.start(), m.end()) for m in URL_SPAN_RE.finditer(text)]
    for match in BASE58_RE.finditer(text):
        if not word_starts_at(text, match.start()) or _inside_url(match, url_spans):
            continue
        address = match.group(0)
        key = solana_key(address)
        if key is None:
            continue
        results.append({
            'direction': 'mention',
            'parser': 'address',
            'asset_key': key,
            'chain': 'solana',
            'contract_address': address,
            'ticker': None,
            'pair': None,
            'entry_price': None,
            'stop_price': None,
            'target_price': None,
            'targets': [],
            'span_start': match.start(),
            'span_end': match.end(),
            'narrative_tags': [],
            'extreme_language': EXTREME_MULTIPLIER_RE.search(text) is not None,
        })
    for match in EVM_RE.finditer(text):
        if not word_starts_at(text, match.start()) or _inside_url(match, url_spans):
            continue
        address = match.group(0)
        results.append({
            'direction': 'mention',
            'parser': 'address',
            'asset_key': evm_key(address),
            'chain': 'ethereum',
            'contract_address': address,
            'ticker': None,
            'pair': None,
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
