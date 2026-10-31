from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps' / 'collector'))

from collector.normalize import normalize_message, validate_replay


def message(**overrides):
    values = {
        'id': 17,
        'message': 'A WIF level is 2.5',
        'entities': [],
        'date': datetime(2026, 10, 31, 8, 0, tzinfo=timezone.utc),
        'edit_date': None,
        'fwd_from': None,
        'reply_to': None,
        'media': None,
        'views': 9,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_normalize_message_uses_canonical_utc_timestamps_and_hash():
    record = normalize_message('source-id', message())
    assert record['posted_at'] == '2026-10-31T08:00:00Z'
    assert record['edited_at'] is None
    assert record['text'] == 'A WIF level is 2.5'
    assert record['content_hash']
    assert validate_replay(record) == record


def test_replay_timestamps_must_be_timezone_aware_strings():
    record = normalize_message('source-id', message())
    record['posted_at'] = '2026-10-31T08:00:00'
    with pytest.raises(ValueError, match='timezone'):
        validate_replay(record)

    record = normalize_message('source-id', message())
    record['posted_at'] = 1793433600
    with pytest.raises(ValueError, match='strings'):
        validate_replay(record)
