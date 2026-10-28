"""Backfill watched public channels, then tail new messages and edits."""
import asyncio
from datetime import datetime, timedelta, timezone
import logging

from telethon import errors, events, utils
from telethon.tl.types import Channel, Message

from .auth import make_client, session_lock
from .normalize import normalize_message
from .store import Store

LOG = logging.getLogger('refrain.collector')


async def with_flood_wait(operation):
    while True:
        try:
            return await operation()
        except errors.FloodWaitError as error:
            LOG.warning('Telegram flood wait: sleeping %s seconds. No account rotation.', error.seconds)
            await asyncio.sleep(error.seconds + 1)


async def backfill_source(client, store, source, entity, since):
    checkpoint = source['last_message_id']
    total = 0
    while True:
        try:
            async for message in client.iter_messages(
                entity, limit=None, reverse=True, min_id=checkpoint,
                offset_date=since, wait_time=1,
            ):
                if not isinstance(message, Message):
                    continue
                if message.date < since:
                    continue
                await store.upsert(normalize_message(source['id'], message))
                checkpoint = max(checkpoint, message.id)
                total += 1
            LOG.info('Backfill complete: @%s, %s messages processed.', source['handle'], total)
            return total
        except errors.FloodWaitError as error:
            LOG.warning('Backfill @%s: sleeping %s seconds for Telegram.', source['handle'], error.seconds)
            await asyncio.sleep(error.seconds + 1)


async def collect(settings, days=14, tail=True):
    with session_lock(settings):
        client = make_client(settings)
        store = None
        try:
            await client.connect()
            if not await client.is_user_authorized():
                raise RuntimeError('Telegram login is required. Run scripts/telegram-login.ps1 locally first.')
            store = await Store.open(settings)
            sources = await store.sources()
            if not sources:
                raise RuntimeError('No active public sources. Run the collector init-db command first.')
            if len(sources) > 20:
                raise RuntimeError('The public watchlist exceeds the limit of 20 active sources.')
            watched = {}
            failures = []
            for source in sources:
                try:
                    entity = await with_flood_wait(lambda: client.get_entity(source['handle']))
                    if not isinstance(entity, Channel) or not entity.broadcast or not entity.username:
                        raise ValueError('Source is not a public broadcast channel.')
                    watched[utils.get_peer_id(entity)] = (source, entity)
                except (errors.RPCError, ValueError) as error:
                    LOG.error('Cannot read @%s (%s). No private-group fallback.', source['handle'], type(error).__name__)
                    failures.append(source['handle'])
            completed = set()
            failed_update = asyncio.Event()
            fatal_error = None
            async def on_message(event):
                nonlocal fatal_error
                if event.chat_id not in watched or not hasattr(event.message, 'id'):
                    return
                source, _ = watched[event.chat_id]
                try:
                    is_edit = isinstance(event, events.MessageEdited.Event)
                    await store.upsert(
                        normalize_message(source['id'], event.message),
                        advance_checkpoint=source['handle'] in completed and not is_edit,
                    )
                except BaseException as error:
                    LOG.error('Update persistence failed (%s). Restart to recover from checkpoint.', type(error).__name__)
                    fatal_error = error
                    failed_update.set()

            chat_ids = list(watched)
            if not chat_ids:
                raise RuntimeError('No configured public channels could be resolved.')
            client.add_event_handler(on_message, events.NewMessage(chats=chat_ids))
            client.add_event_handler(on_message, events.MessageEdited(chats=chat_ids))
            await with_flood_wait(client.catch_up)
            since = datetime.now(timezone.utc) - timedelta(days=days)
            for source, entity in watched.values():
                await backfill_source(client, store, source, entity, since)
                completed.add(source['handle'])
                if failed_update.is_set():
                    raise RuntimeError('A live update failed during backfill; restart the collector.') from fatal_error
            for row in await store.counts():
                LOG.info('Stored @%s: %s raw posts.', row['handle'], row['posts'])
            if failures:
                raise RuntimeError('Backfill incomplete: at least one watched channel was unavailable. See channel status above.')
            if tail:
                LOG.info('Watching %s public channels. Press Ctrl+C to stop safely.', len(watched))
                disconnected = asyncio.ensure_future(client.disconnected)
                failed = asyncio.create_task(failed_update.wait())
                try:
                    await asyncio.wait([disconnected, failed], return_when=asyncio.FIRST_COMPLETED)
                    if failed_update.is_set():
                        raise RuntimeError('Collector stopped after a failed update. Restart to recover.') from fatal_error
                    raise RuntimeError('Telegram disconnected. Restart the collector to resume from its checkpoint.')
                finally:
                    failed.cancel()
                    await asyncio.gather(failed, return_exceptions=True)
        finally:
            await client.disconnect()
            if store is not None:
                await store.close()
