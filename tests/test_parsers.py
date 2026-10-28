"""Phase 2 fixture suite: every audited post shape classifies as expected."""
import json
from decimal import Decimal
from pathlib import Path

from parsers import classify_post

FIXTURES = Path(__file__).resolve().parents[1] / 'packages/parsers/fixtures/audited_shapes.json'


def load_fixtures():
    return json.loads(FIXTURES.read_text(encoding='utf-8'))['fixtures']


def test_every_audited_shape_classifies():
    for fixture in load_fixtures():
        post = dict(fixture['post'])
        post.setdefault('source_id', '00000000-0000-0000-0000-000000000001')
        post.setdefault('web_preview_title', None)
        result = classify_post(post)
        expected = fixture['expect']
        name = fixture['name']
        if 'skip' in expected:
            assert result['skip'] is not None, f'{name}: expected skip record'
            assert result['skip'].filter_reason == expected['skip'], f'{name}: wrong filter reason'
            assert result['calls'] == [], f'{name}: advertisement produced calls'
            continue
        assert result['skip'] is None, f'{name}: unexpected skip ({result["skip"]})'
        assert len(result['calls']) == expected['calls'], f'{name}: call count mismatch'
        call = result['calls'][0]
        assert call['parser'] == expected['parser'], f'{name}: parser mismatch'
        assert call['direction'] == expected['direction'], f'{name}: direction mismatch'
        if 'asset_key' in expected:
            assert call['asset_key'] == expected['asset_key'], f'{name}: asset key mismatch'
        if 'chain' in expected:
            assert call['chain'] == expected['chain'], f'{name}: chain mismatch'
        if 'ticker' in expected:
            assert call['ticker'] == expected['ticker'], f'{name}: ticker mismatch'
        if 'targets' in expected:
            assert call['targets'] == expected['targets'], f'{name}: targets mismatch'
        if 'entry_price' in expected:
            assert Decimal(call['entry_price']) == Decimal(expected['entry_price']), f'{name}: entry mismatch'
        if 'stop_price' in expected:
            assert Decimal(call['stop_price']) == Decimal(expected['stop_price']), f'{name}: stop mismatch'
        if 'extreme_language' in expected:
            assert call['extreme_language'] == expected['extreme_language'], f'{name}: extreme language flag'


def test_every_call_span_lies_inside_text():
    for fixture in load_fixtures():
        post = dict(fixture['post'])
        post.setdefault('source_id', '00000000-0000-0000-0000-000000000001')
        post.setdefault('web_preview_title', None)
        result = classify_post(post)
        for call in result['calls']:
            text = post['text']
            assert 0 <= call['span_start'] < call['span_end'] <= len(text), fixture['name']
            span_text = text[call['span_start']:call['span_end']]
            assert span_text.strip(), fixture['name']
