"""Language-model extraction for unstructured residue only.

The model extracts and tags. It never decides anything. Malformed output is
discarded and logged, never repaired by guessing. Results are cached by
content hash and extractor version to respect the operator's request budget.
"""
import hashlib
import json
import logging
import threading
import time

import httpx

from shared_types.canonical import canonical_json

LOG = logging.getLogger('refrain.llm')

EXTRACTION_VERSION = 'v1'
SYSTEM_PROMPT = (
    'You read posts from public crypto Telegram call channels and extract market mentions. '
    'Return only what the text says. For every asset mention, give the exact character span '
    'of the words it was read from, the direction if the post states one, sentiment, '
    'conviction from 0 to 100 and urgency from 0 to 100, plus theme tags from the allowed '
    'vocabulary. Never invent prices, tickers or contracts that the text does not contain. '
    'If the post has no market content, return an empty mentions list.'
)

ALLOWED_CHAINS = ['solana', 'ethereum', 'robinhood', 'cex', 'other']
ALLOWED_DIRECTIONS = ['long', 'short', 'spot_buy', 'close', 'mention']

JSON_SCHEMA = {
    'type': 'object',
    'properties': {
        'mentions': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'chain': {'type': 'string', 'enum': ALLOWED_CHAINS},
                    'contractAddress': {'type': ['string', 'null']},
                    'ticker': {'type': ['string', 'null']},
                    'pair': {'type': ['string', 'null']},
                    'direction': {'type': 'string', 'enum': ALLOWED_DIRECTIONS},
                    'sentiment': {'type': ['string', 'null'], 'enum': ['bullish', 'bearish', 'neutral', None]},
                    'conviction': {'type': 'integer', 'minimum': 0, 'maximum': 100},
                    'urgency': {'type': 'integer', 'minimum': 0, 'maximum': 100},
                    'narrativeTags': {'type': 'array', 'items': {'type': 'string'}},
                    'spanStart': {'type': 'integer', 'minimum': 0},
                    'spanEnd': {'type': 'integer', 'minimum': 0}
                },
                'required': ['chain', 'contractAddress', 'ticker', 'pair', 'direction',
                             'sentiment', 'conviction', 'urgency', 'narrativeTags',
                             'spanStart', 'spanEnd'],
                'additionalProperties': False
            }
        },
        'narrativeTags': {'type': 'array', 'items': {'type': 'string'}}
    },
    'required': ['mentions', 'narrativeTags'],
    'additionalProperties': False
}


class Extractor:
    """OpenAI-compatible structured extraction with a shared rate-limit gate."""

    def __init__(self, settings):
        self.base_url = settings.llm_base_url.rstrip('/')
        self.api_key = settings.llm_api_key
        self.model = settings.llm_model
        self.timeout = settings.price_fetch_timeout_seconds
        self._lock = threading.Lock()
        self._earliest_next = 0.0

    def cache_key(self, text):
        seed = canonical_json({
            'version': EXTRACTION_VERSION,
            'model': self.model,
            'text': text,
        })
        return hashlib.sha256(seed.encode('utf-8')).hexdigest()

    async def fetch_cached(self, store, cache_key):
        return await store.llm_cache_get(cache_key)

    async def fetch_live(self, text):
        while True:
            with self._lock:
                wait = self._earliest_next - time.monotonic()
                if wait > 0:
                    time.sleep(min(wait, 2.0))
                self._earliest_next = max(self._earliest_next, time.monotonic()) + 2.0
            async with httpx.AsyncClient(timeout=self.timeout + 10) as client:
                try:
                    response = await client.post(
                        self.base_url + '/chat/completions',
                        headers={'Authorization': 'Bearer ' + self.api_key},
                        json={
                            'model': self.model,
                            'temperature': 0,
                            'max_tokens': 1024,
                            'messages': [
                                {'role': 'system', 'content': SYSTEM_PROMPT},
                                {'role': 'user', 'content': text},
                            ],
                            'response_format': {
                                'type': 'json_schema',
                                'json_schema': {'name': 'call_extraction', 'strict': True, 'schema': JSON_SCHEMA},
                            },
                        },
                    )
                except httpx.HTTPError as error:
                    LOG.warning('Extraction request failed (%s). Discarding this residue.', type(error).__name__)
                    return None
            if response.status_code == 429:
                delay = _retry_delay(response)
                LOG.warning('Extraction rate limited: waiting %s seconds.', delay)
                time.sleep(delay)
                continue
            if response.status_code != 200:
                LOG.warning('Extraction endpoint returned %s. Discarding this residue.', response.status_code)
                return None
            try:
                payload = response.json()
                content = payload['choices'][0]['message']['content']
                return json.loads(content)
            except (KeyError, IndexError, ValueError, TypeError) as error:
                LOG.warning('Malformed extraction envelope (%s). Discarded, never repaired.', type(error).__name__)
                return None


def _retry_delay(response):
    header = response.headers.get('retry-after')
    if header and header.isdigit():
        return min(float(header), 60.0)
    return 10.0


def validate_extraction(result, text):
    """Return mention dicts with validated spans, or None to discard everything."""
    if not isinstance(result, dict):
        return None
    mentions = result.get('mentions')
    tags = result.get('narrativeTags', [])
    if not isinstance(mentions, list) or not isinstance(tags, list):
        return None
    validated = []
    for mention in mentions:
        if not isinstance(mention, dict):
            return None
        span_start = mention.get('spanStart')
        span_end = mention.get('spanEnd')
        if not isinstance(span_start, int) or not isinstance(span_end, int):
            return None
        if span_start < 0 or span_end <= span_start or span_end > len(text):
            return None
        if mention.get('chain') not in ALLOWED_CHAINS:
            return None
        if mention.get('direction') not in ALLOWED_DIRECTIONS:
            return None
        for field in ('conviction', 'urgency'):
            value = mention.get(field)
            if not isinstance(value, int) or not 0 <= value <= 100:
                return None
        validated.append({
            'direction': mention['direction'],
            'parser': 'llm',
            'asset_key': _asset_key(mention),
            'chain': mention['chain'] if mention['chain'] != 'other' else None,
            'contract_address': mention.get('contractAddress'),
            'ticker': mention.get('ticker'),
            'pair': mention.get('pair'),
            'entry_price': None,
            'stop_price': None,
            'target_price': None,
            'targets': [],
            'conviction': mention['conviction'],
            'urgency': mention['urgency'],
            'sentiment': mention.get('sentiment'),
            'span_start': span_start,
            'span_end': span_end,
            'narrative_tags': tags if not mention.get('narrativeTags') else mention['narrativeTags'],
        })
    return validated


def _asset_key(mention):
    address = mention.get('contractAddress')
    if mention.get('chain') == 'solana' and address:
        return f'solana:{address}'
    if mention.get('chain') == 'ethereum' and address:
        return f'evm:1:{address}'
    if mention.get('pair'):
        return f"cex:{mention['pair']}"
    return None
