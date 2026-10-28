"""Narrative tag normalisation against the controlled vocabulary."""
import json
import re
from pathlib import Path

NARRATIVES_PATH = Path(__file__).resolve().parent / 'narratives.json'
_VOCABULARY = None


def vocabulary():
    global _VOCABULARY
    if _VOCABULARY is None:
        _VOCABULARY = set(json.loads(NARRATIVES_PATH.read_text(encoding='utf-8'))['vocabulary'])
    return _VOCABULARY


def normalize_tag(tag):
    """Lowercase with underscores. Anything outside the vocabulary becomes other."""
    if not isinstance(tag, str) or not tag.strip():
        return 'other'
    cleaned = re.sub(r'[^a-z0-9]+', '_', tag.strip().casefold()).strip('_')
    if not cleaned:
        return 'other'
    return cleaned if cleaned in vocabulary() else 'other'
