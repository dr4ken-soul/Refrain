"""Close instructions and break-even moves parsed as exit events."""
import re

from .assets import CASHTAG_RE, find_pair

CLOSE_RE = re.compile(
    r'\b(close[ds]?(?:\s+(?:this|the|all|our|my))?\s+(?:trade|position|order|long|short|call)?|'
    r'book(?:ed)?\s+(?:the\s+)?(?:profit|profits)|took?\s+(?:the\s+)?(?:profit|profits)|'
    r'tp\s+hit|target\s+hit|target\s+1\s+hit|tp1\s+hit|break\s*even|breakeven|exit(?:ed)?\s+'
    r'(?:now|all|the\s+trade|this\s+trade|position))\b',
    re.IGNORECASE)


def parse_exit(text):
    """Return an exit candidate dict, or None. The matching call is linked later."""
    match = CLOSE_RE.search(text)
    if not match:
        return None
    if not word_border_ok(text, match.start()):
        return None
    found = find_pair(text, max(0, match.start() - 60), min(len(text), match.end() + 60))
    if not found:
        for cashtag in CASHTAG_RE.finditer(text):
            ticker = cashtag.group(1).upper()
            return {
                'direction': 'close',
                'parser': 'structured',
                'asset_key': f'cex:{ticker}USDT',
                'chain': 'cex',
                'contract_address': None,
                'ticker': ticker,
                'pair': f'{ticker}USDT',
                'entry_price': None,
                'stop_price': None,
                'target_price': None,
                'targets': [],
                'span_start': match.start(),
                'span_end': match.end(),
                'narrative_tags': [],
            }
        return None
    pair, ticker, span = found
    return {
        'direction': 'close',
        'parser': 'structured',
        'asset_key': f'cex:{pair}',
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
    }


def word_border_ok(text, index):
    if index <= 0:
        return True
    return not re.match(r'[A-Za-z0-9_]', text[index - 1])
