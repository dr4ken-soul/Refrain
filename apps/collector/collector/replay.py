"""Export actual captured history and import a hash-verified frozen snapshot."""
import json
from pathlib import Path

from .normalize import RawPost, canonical_json, timestamp, validate_replay


async def export_replay(store, destination):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + '.tmp')
    count = 0
    try:
        with temporary.open('w', encoding='utf-8', newline='\n') as output:
            async for row in store.export_records():
                record = {name: row[name] for name in RawPost.__dataclass_fields__}
                record['source_id'] = str(record['source_id'])
                record['posted_at'] = timestamp(record['posted_at'])
                record['edited_at'] = timestamp(record['edited_at']) if record['edited_at'] else None
                record['content_hash'] = row['content_hash']
                validate_replay(record)
                output.write(canonical_json(record) + '\n')
                count += 1
        temporary.replace(destination)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise
    return count


def read_records(path):
    with Path(path).open(encoding='utf-8') as snapshot:
        for number, line in enumerate(snapshot, 1):
            if not line.strip():
                continue
            try:
                yield validate_replay(json.loads(line))
            except (ValueError, TypeError, KeyError) as error:
                raise ValueError(f'Replay line {number} is invalid ({type(error).__name__}). No guessed repair is permitted.') from None


async def import_replay(store, path):
    sources = {str(source['id']) for source in await store.sources()}
    # First pass validates the entire file before the first database write.
    for record in read_records(path):
        if record['source_id'] not in sources:
            raise ValueError('Replay contains a source outside the active public watchlist.')
    count = 0
    for record in read_records(path):
        await store.upsert(record, mode='replay')
        count += 1
    return count
