"""Postgres ingestion with transactional checkpoints and idempotent writes."""
import asyncio
from datetime import datetime, timezone
import json

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


class Store:
    def __init__(self, connection):
        self.connection = connection
        self.lock = asyncio.Lock()

    @classmethod
    async def open(cls, settings):
        settings.require_database()
        connection = await psycopg.AsyncConnection.connect(
            settings.database_url, autocommit=True, connect_timeout=15,
            sslmode='require', row_factory=dict_row, application_name='refrain-collector',
        )
        await connection.execute('SET search_path TO refrain')
        return cls(connection)

    async def close(self):
        await self.connection.close()

    async def initialize(self):
        """Apply every migration and seed the audited watchlist, preserving history."""
        from api.db import apply_migrations, seed_watchlist
        async with self.lock, self.connection.transaction():
            await self.connection.execute("SELECT pg_advisory_xact_lock(hashtext('refrain:migrations:all'))")
        await apply_migrations(self.connection)
        count = await seed_watchlist(self.connection)
        return count

    async def sources(self):
        async with self.lock:
            cursor = await self.connection.execute(
                'SELECT * FROM sources WHERE is_active AND is_public ORDER BY handle',
            )
            return await cursor.fetchall()

    async def counts(self):
        async with self.lock:
            cursor = await self.connection.execute('''
                SELECT s.handle, count(r.telegram_message_id) AS posts
                FROM sources s LEFT JOIN raw_posts r ON r.source_id = s.id
                GROUP BY s.handle ORDER BY s.handle
            ''')
            return await cursor.fetchall()

    async def upsert(self, record, mode='live', advance_checkpoint=True):
        if mode not in ('live', 'replay'):
            raise ValueError('Unknown ingest mode.')
        values = dict(record, urls=Jsonb(record['urls']), ingest_mode=mode,
                      ingested_at=datetime.now(timezone.utc))
        async with self.lock, self.connection.transaction():
            await self.connection.execute('''
                INSERT INTO raw_posts (
                    source_id, telegram_message_id, posted_at, edited_at, text, urls,
                    forwarded_from, views, is_media_only, content_hash, ingest_mode,
                    ingested_at, quote_text, web_preview_title
                ) VALUES (
                    %(source_id)s, %(telegram_message_id)s, %(posted_at)s, %(edited_at)s,
                    %(text)s, %(urls)s, %(forwarded_from)s, %(views)s, %(is_media_only)s,
                    %(content_hash)s, %(ingest_mode)s, %(ingested_at)s,
                    %(quote_text)s, %(web_preview_title)s
                ) ON CONFLICT (source_id, telegram_message_id) DO UPDATE SET
                    edited_at = EXCLUDED.edited_at, text = EXCLUDED.text,
                    urls = EXCLUDED.urls, forwarded_from = EXCLUDED.forwarded_from,
                    views = EXCLUDED.views, is_media_only = EXCLUDED.is_media_only,
                    content_hash = EXCLUDED.content_hash, ingest_mode = EXCLUDED.ingest_mode,
                    ingested_at = EXCLUDED.ingested_at, quote_text = EXCLUDED.quote_text,
                    web_preview_title = EXCLUDED.web_preview_title
                WHERE COALESCE(EXCLUDED.edited_at, EXCLUDED.posted_at)
                    >= COALESCE(raw_posts.edited_at, raw_posts.posted_at)
            ''', values)
            # Live updates during initial backfill must not skip uncollected history.
            if advance_checkpoint:
                await self.connection.execute('''
                    UPDATE sources SET last_message_id = greatest(last_message_id, %s)
                    WHERE id = %s
                ''', (record['telegram_message_id'], record['source_id']))

    async def export_records(self):
        # A server-side cursor keeps large replay snapshots out of process memory.
        async with self.lock, self.connection.transaction():
            async with self.connection.cursor(name='refrain_replay_export') as cursor:
                await cursor.execute('''
                    SELECT r.* FROM raw_posts r JOIN sources s ON s.id = r.source_id
                    WHERE s.is_public ORDER BY r.posted_at, r.source_id, r.telegram_message_id
                ''')
                async for row in cursor:
                    yield row
