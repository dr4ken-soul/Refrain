"""Canonical raw-post records with Unicode character spans."""
from dataclasses import asdict, dataclass
from datetime import datetime
import hashlib

from telethon.tl.types import MessageEntityTextUrl, MessageEntityUrl

from shared_types.canonical import canonical_json, timestamp


def character_span(text, offset, length):
    """Telegram offsets count UTF-16 code units, not Python characters."""
    encoded = text.encode('utf-16-le')
    if offset < 0 or length < 0 or (offset + length) * 2 > len(encoded):
        raise ValueError('URL entity span is outside the Telegram message.')
    start = len(encoded[:offset * 2].decode('utf-16-le'))
    end = len(encoded[:(offset + length) * 2].decode('utf-16-le'))
    return start, end


@dataclass(frozen=True)
class RawPost:
    source_id: str
    telegram_message_id: int
    posted_at: str
    edited_at: str | None
    text: str
    urls: list
    forwarded_from: str | None
    views: int | None
    is_media_only: bool
    quote_text: str | None = None
    web_preview_title: str | None = None

    def record(self):
        value = asdict(self)
        value['content_hash'] = hashlib.sha256(canonical_json(value).encode('utf-8')).hexdigest()
        return value


def normalize_message(source_id, message):
    text = message.message or ''
    urls = []
    for entity in message.entities or []:
        if not isinstance(entity, (MessageEntityUrl, MessageEntityTextUrl)):
            continue
        start, end = character_span(text, entity.offset, entity.length)
        url = entity.url if isinstance(entity, MessageEntityTextUrl) else text[start:end]
        urls.append({'url': url, 'offset': start, 'length': end - start})
    forward = message.fwd_from
    forwarded_from = None
    if forward:
        origin = getattr(forward, 'from_id', None)
        if origin:
            identifier = getattr(origin, 'channel_id', None) or getattr(origin, 'user_id', None)
            if identifier:
                forwarded_from = f'{type(origin).__name__}:{identifier}'
        forwarded_from = forwarded_from or getattr(forward, 'from_name', None) or 'unknown_forward'
    quote = getattr(getattr(message, 'reply_to', None), 'quote_text', None)
    webpage = getattr(getattr(message, 'media', None), 'webpage', None)
    title = getattr(webpage, 'title', None)
    return RawPost(
        source_id=str(source_id), telegram_message_id=message.id,
        posted_at=timestamp(message.date),
        edited_at=timestamp(message.edit_date) if message.edit_date else None,
        text=text, urls=urls, forwarded_from=forwarded_from, views=message.views,
        is_media_only=bool(message.media and not text.strip() and not quote),
        quote_text=quote, web_preview_title=title,
    ).record()


def validate_replay(record):
    """A replay import never silently accepts modified or malformed evidence."""
    if not isinstance(record, dict):
        raise ValueError('Replay line must be a JSON object.')
    fields = RawPost.__dataclass_fields__
    if set(record) != set(fields) | {'content_hash'}:
        raise ValueError('Replay record does not match the frozen raw-post schema.')
    if type(record['telegram_message_id']) is not int or record['telegram_message_id'] <= 0:
        raise ValueError('Replay message ID must be a positive integer.')
    if not isinstance(record['text'], str) or not isinstance(record['urls'], list):
        raise ValueError('Replay text or URL fields have invalid types.')
    if type(record['is_media_only']) is not bool:
        raise ValueError('Replay media-only field must be a boolean.')
    for field in ['posted_at', 'edited_at']:
        if record[field] is not None:
            if not isinstance(record[field], str):
                raise ValueError('Replay timestamps must be strings or null.')
            parsed = datetime.fromisoformat(record[field].replace('Z', '+00:00'))
            if parsed.tzinfo is None:
                raise ValueError('Replay timestamps must include a timezone.')
    expected = RawPost(**{name: record[name] for name in fields}).record()['content_hash']
    if record['content_hash'] != expected:
        raise ValueError('Replay content hash mismatch.')
    return record
