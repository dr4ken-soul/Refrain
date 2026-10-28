"""Character spans between Telegram UTF-16 offsets and Python strings."""
import re

# Telegram entity offsets count UTF-16 code units. Python 3 strings count
# Unicode code points. Convert through UTF-16-LE bytes so every recorded span
# is a Python string slice that the frontend can draw directly.


def character_span(text, offset, length):
    encoded = text.encode('utf-16-le')
    if offset < 0 or length < 0 or (offset + length) * 2 > len(encoded):
        raise ValueError('Entity span is outside the message text.')
    start = len(encoded[:offset * 2].decode('utf-16-le'))
    end = len(encoded[:(offset + length) * 2].decode('utf-16-le'))
    return start, end


def to_utf16_offset(text, python_start, python_end):
    encoded = text.encode('utf-16-le')
    before = text[:python_start].encode('utf-16-le')
    inside = text[python_start:python_end].encode('utf-16-le')
    return len(before) // 2, len(inside) // 2


_NON_WORD = re.compile(r'[A-Za-z0-9]')


def word_starts_at(text, index):
    """True when the character before index is not a letter, digit or underscore."""
    if index <= 0:
        return True
    return not re.match(r'[A-Za-z0-9_]', text[index - 1])
