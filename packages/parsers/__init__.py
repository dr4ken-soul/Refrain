"""Deterministic Telegram call parsers. Structured reading first, model last.

No exchange connection and no trade execution live in this package.
"""
from .classify import classify_post, SkipRecord
from .spans import character_span

__all__ = ['classify_post', 'SkipRecord', 'character_span']
