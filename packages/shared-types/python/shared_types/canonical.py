"""Canonical JSON and timestamps. Identical bytes everywhere or nothing ships.

Keys sorted, no insignificant whitespace, no NaN. Integers or fixed decimal
strings for numbers, never floats. Both collector and engine import this; the
CRE workflow reimplements the same rules in TypeScript and one fixture test
proves the two produce identical hashes.
"""
from datetime import datetime, timezone
import json


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def timestamp(value):
    if value.tzinfo is None:
        raise ValueError('Timestamps must include a timezone.')
    return value.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def parse_timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
