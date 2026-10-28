"""Canonical asset keys. Every stored asset resolves through this module."""
import re

BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
BASE58_RE = re.compile(r'[1-9A-HJ-NP-Za-km-z]{32,44}')
EVM_RE = re.compile(r'0x[a-fA-F0-9]{40}')
PAIR_RE = re.compile(r'\b([A-Z0-9]{2,10}USDT)\b')
CASHTAG_RE = re.compile(r'\$([A-Za-z][A-Za-z0-9]{1,14})')
PAIR_TOKEN_RE = re.compile(
    r'(?:\$|#)?\b([A-Z0-9]{2,10})\s*(?:/|USDT\s*/\s*|USDT)\s*USDT\b|'
    r'(?:\$|#)([A-Za-z][A-Za-z0-9]{1,14})\b|'
    r'\b([A-Z0-9]{2,10}USDT)\b')


def solana_key(address):
    """A Solana address is base58, 32 to 44 characters, optionally ending in pump."""
    if not BASE58_RE.fullmatch(address):
        return None
    if re.search(r'[OIl0]', address):
        # 0, O, I and l never appear in base58.
        return None
    return f'solana:{address}'


def evm_key(address, chain_id=1):
    return f'evm:{chain_id}:{address}'


def pair_key(pair):
    return f'cex:{pair}'


def normalize_pair(raw):
    """ENA/USDT, ena usdt and ENAUSDT all become ENAUSDT."""
    compact = re.sub(r'[\s/_\-]', '', raw.upper())
    if not PAIR_RE.fullmatch(compact):
        return None
    return compact


def is_base58(value):
    return bool(BASE58_RE.fullmatch(value)) and not re.search(r'[OIl0]', value)


def find_pair(text, start, end):
    """Search a slice for a pair symbol and return (pair, ticker, span) or None."""
    window = text[start:end]
    match = PAIR_TOKEN_RE.search(window)
    while match:
        candidates = [group for group in match.groups() if group]
        if candidates:
            ticker = candidates[0].upper().removesuffix('USDT')
            pair = normalize_pair(f'{ticker}USDT')
            if pair:
                return pair, ticker, (start + match.start(), start + match.end())
        match = PAIR_TOKEN_RE.search(window, match.end())
    return None
