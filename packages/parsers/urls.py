"""Contract addresses embedded in call links: GMGN, Phantom and fomo hosts.

The token name comes from the message web preview title where present,
because the audited meme-radar posts carry no ticker in their text.
"""
import re

from .assets import BASE58_RE, EVM_RE, evm_key, solana_key
from .spans import word_starts_at

EXTREME_MULTIPLIER_RE = re.compile(r'\b\d{2,6}\s*[xX]\b')

CHAIN_PATH_RE = re.compile(r'/(sol|eth|base|bsc|arb|solana|ethereum)/(?:token|pair)/', re.IGNORECASE)
URL_RE = re.compile(r'https?://\S+|[\w.-]+(?:/[\w@?^=%&:/~+#-]*)+')
GMGN_HOST_RE = re.compile(r'\bgmgn\.ai\b', re.IGNORECASE)
PHANTOM_HOST_RE = re.compile(r'\bphantom\.(?:app|com)\b', re.IGNORECASE)
FOMO_HOST_RE = re.compile(r'\bfomo(?:\d*)\.[\w-]+|fomo\.fun', re.IGNORECASE)
PUMP_HOST_RE = re.compile(r'\bpump\.fun\b|\bpumpmerc\.[\w-]+', re.IGNORECASE)


def _chain_from_path(url):
    match = CHAIN_PATH_RE.search(url)
    if not match:
        return None
    value = match.group(1).lower()
    return {'sol': 'solana', 'solana': 'solana', 'eth': 'ethereum',
            'ethereum': 'ethereum', 'base': 'base', 'bsc': 'bsc', 'arb': 'arbitrum'}.get(value)


def _host_match(url):
    for pattern in (GMGN_HOST_RE, PHANTOM_HOST_RE, FOMO_HOST_RE, PUMP_HOST_RE):
        if pattern.search(url):
            return True
    return False


def parse_urls(text, web_preview_title=None):
    """Extract call mentions from URLs. Link entities are already absolute text."""
    results = []
    for match in URL_RE.finditer(text):
        url = match.group(0)
        if not _host_match(url):
            continue
        chain = _chain_from_path(url)
        address_match = EVM_RE.search(url) or BASE58_RE.search(url)
        if not address_match:
            continue
        address = address_match.group(0)
        key = solana_key(address) if chain == 'solana' else None
        if chain in (None, 'ethereum') and EVM_RE.fullmatch(address):
            key = evm_key(address)
        if key is None and chain == 'solana' and BASE58_RE.fullmatch(address) \
                and not re.search(r'[OIl0]', address):
            key = solana_key(address)
        if key is None:
            continue
        actual_chain = chain or ('ethereum' if address.startswith('0x') else 'solana')
        results.append({
            'direction': 'spot_buy' if actual_chain == 'solana' else 'mention',
            'parser': 'url',
            'asset_key': key,
            'chain': actual_chain,
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
            'web_preview_title': web_preview_title,
        })
    return results
