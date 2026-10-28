"""Postgres data access for the pipeline, the API routes and the chain indexer.

All writes are idempotent so the pipeline and runner can restart freely.
"""
import asyncio
from decimal import Decimal
import hashlib
import json
from datetime import datetime, timezone
from uuid import NAMESPACE_URL, uuid5

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from shared_types.canonical import timestamp


def deterministic_call_id(source_id, message_id, span_start, span_end):
    return str(uuid5(NAMESPACE_URL, f'call:{source_id}:{message_id}:{span_start}:{span_end}'))


def deterministic_case_id(case_kind, asset_key, narrative_key, started_at):
    identity = f"case:{case_kind}:{asset_key or narrative_key}:{started_at}"
    return str(uuid5(NAMESPACE_URL, identity))


class Repository:
    def __init__(self, connection):
        self.connection = connection
        self.lock = asyncio.Lock()

    @classmethod
    async def open(cls, settings):
        connection = await psycopg.AsyncConnection.connect(
            settings.database_url, autocommit=True, connect_timeout=15,
            sslmode='require', row_factory=dict_row, application_name='refrain-api')
        await connection.execute('SET search_path TO refrain')
        return cls(connection)

    async def close(self):
        await self.connection.close()

    async def transaction(self):
        return self.connection.transaction()

    # ---------- extraction ----------

    async def unclassified_posts(self, extraction_version, limit=500):
        cursor = await self.connection.execute('''
            SELECT r.source_id, r.telegram_message_id, r.posted_at, r.edited_at, r.text,
                   r.urls, r.forwarded_from, r.views, r.is_media_only, r.content_hash,
                   r.quote_text, r.web_preview_title, s.handle
            FROM raw_posts r
            JOIN sources s ON s.id = r.source_id AND s.is_active
            LEFT JOIN post_classifications pc
                ON pc.source_id = r.source_id AND pc.telegram_message_id = r.telegram_message_id
                AND pc.extraction_version = %s
            WHERE pc.source_id IS NULL
            ORDER BY r.posted_at, r.source_id, r.telegram_message_id
            LIMIT %s
        ''', (extraction_version, limit))
        return await cursor.fetchall()

    async def reliability_map(self):
        cursor = await self.connection.execute('''
            SELECT s.id, s.source_hash, COALESCE(k.score, 50.00) AS score, 
                   COALESCE(k.origin, 'neutral') AS origin, k.block
            FROM sources s
            LEFT JOIN kol_scores k ON k.source_id = s.id
            WHERE s.is_public
        ''')
        rows = await cursor.fetchall()
        return {str(row['id']): {
            'source_hash': row['source_hash'],
            'score_hundredths': int(round(float(row['score']) * 100)),
            'origin': row['origin'],
            'block': row['block'],
        } for row in rows}

    async def store_classifications(self, post, calls, markers, scheduled, skip):
        """Idempotent write of one post's classification and extracted calls."""
        async with self.lock, self.connection.transaction():
            await self.connection.execute('''
                INSERT INTO post_classifications (
                    source_id, telegram_message_id, is_advertisement, filter_reason,
                    referral_markers, scheduled_call, extraction_version
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (source_id, telegram_message_id) DO UPDATE SET
                    is_advertisement = EXCLUDED.is_advertisement,
                    filter_reason = EXCLUDED.filter_reason,
                    referral_markers = EXCLUDED.referral_markers,
                    scheduled_call = EXCLUDED.scheduled_call,
                    extraction_version = EXCLUDED.extraction_version,
                    classified_at = now()
            ''', (post['source_id'], post['telegram_message_id'],
                  bool(skip and skip.is_advertisement),
                  skip.filter_reason if skip else None,
                  Jsonb(markers), Jsonb(scheduled) if scheduled else None,
                  post['extraction_version']))
            for call in calls:
                call_id = deterministic_call_id(
                    post['source_id'], post['telegram_message_id'],
                    call.get('span_start'), call.get('span_end'))
                values = dict(call, id=call_id, source_id=post['source_id'],
                              telegram_message_id=post['telegram_message_id'],
                              is_advertisement=bool(call.get('is_advertisement')),
                              filter_reason=call.get('filter_reason'),
                              extraction_confidence=call.get('extraction_confidence'),
                              targets=Jsonb(call.get('targets', [])))
                await self.connection.execute('''
                    INSERT INTO calls (
                        id, source_id, telegram_message_id, asset_key, chain,
                        contract_address, ticker, pair, direction, entry_price,
                        stop_price, target_price, conviction, urgency, sentiment,
                        narrative_tags, parser, span_start, span_end,
                        is_advertisement, filter_reason, extraction_confidence, targets
                    ) VALUES (
                        %(id)s, %(source_id)s, %(telegram_message_id)s, %(asset_key)s, %(chain)s,
                        %(contract_address)s, %(ticker)s, %(pair)s, %(direction)s, %(entry_price)s,
                        %(stop_price)s, %(target_price)s, %(conviction)s, %(urgency)s, %(sentiment)s,
                        %(narrative_tags)s, %(parser)s, %(span_start)s, %(span_end)s,
                        %(is_advertisement)s, %(filter_reason)s, %(extraction_confidence)s, %(targets)s
                    ) ON CONFLICT (id) DO NOTHING
                ''', values)

    async def link_exit_to_call(self, exit_id, call_id):
        if not call_id:
            return
        await self.connection.execute(
            'UPDATE calls SET closes_call = %s WHERE id = %s', (call_id, exit_id))

    async def latest_call_before(self, source_id, asset_key, posted_at, message_id):
        """Most recent earlier non-exit call by the same source for the same asset."""
        cursor = await self.connection.execute('''
            SELECT c.id FROM calls c
            JOIN raw_posts r
                ON r.source_id = c.source_id AND r.telegram_message_id = c.telegram_message_id
            WHERE c.source_id = %s AND c.asset_key = %s AND c.direction <> 'close'
                AND (r.posted_at < %s OR (r.posted_at = %s AND r.telegram_message_id < %s))
            ORDER BY r.posted_at DESC, r.telegram_message_id DESC
            LIMIT 1
        ''', (source_id, asset_key, posted_at, posted_at, message_id))
        row = await cursor.fetchone()
        return row['id'] if row else None

    # ---------- convergence ----------

    async def eligible_calls(self, since):
        cursor = await self.connection.execute('''
            SELECT c.id, c.source_id, c.telegram_message_id, c.asset_key, c.chain,
                   c.contract_address, c.ticker, c.pair, c.direction, c.entry_price,
                   c.stop_price, c.target_price, c.conviction, c.urgency, c.sentiment,
                   c.narrative_tags, c.parser, c.span_start, c.span_end, c.targets,
                   r.text AS post_text, r.urls AS post_urls,
                   r.content_hash AS post_content_hash, r.forwarded_from, r.edited_at,
                   r.posted_at, pc.is_advertisement, pc.filter_reason,
                   pc.referral_markers, pc.scheduled_call
            FROM calls c
            JOIN raw_posts r
                ON r.source_id = c.source_id AND r.telegram_message_id = c.telegram_message_id
            JOIN sources s ON s.id = c.source_id
            LEFT JOIN post_classifications pc
                ON pc.source_id = c.source_id AND pc.telegram_message_id = c.telegram_message_id
            WHERE c.direction <> 'close' AND r.posted_at >= %s
            ORDER BY r.posted_at, c.telegram_message_id
        ''', (since,))
        rows = await cursor.fetchall()
        for row in rows:
            row['id'] = str(row['id'])
            row['source_id'] = str(row['source_id'])
            row['narrative_tags'] = list(row['narrative_tags'] or [])
        return rows

    async def window_posts(self, source_ids, started_at, horizon):
        cursor = await self.connection.execute('''
            SELECT r.source_id, r.telegram_message_id, r.posted_at, r.text, r.urls,
                   r.forwarded_from, r.content_hash, r.edited_at,
                   pc.is_advertisement, pc.filter_reason, pc.referral_markers, pc.scheduled_call
            FROM raw_posts r
            LEFT JOIN post_classifications pc
                ON pc.source_id = r.source_id AND pc.telegram_message_id = r.telegram_message_id
            WHERE r.source_id = ANY(%s::uuid[]) AND r.posted_at >= %s AND r.posted_at <= %s
            ORDER BY r.posted_at, r.source_id, r.telegram_message_id
        ''', (list(source_ids), started_at, horizon))
        rows = await cursor.fetchall()
        for row in rows:
            row['source_id'] = str(row['source_id'])
            row['referral_markers'] = list(row['referral_markers'] or [])
        return rows

    async def existing_case_hashes(self):
        cursor = await self.connection.execute('SELECT bundle_hash FROM convergence_events')
        rows = await cursor.fetchall()
        return {row['bundle_hash'] for row in rows}

    async def existing_event_ids(self):
        cursor = await self.connection.execute('SELECT id FROM convergence_events')
        rows = await cursor.fetchall()
        return {str(row['id']) for row in rows}

    async def max_posted_at(self):
        cursor = await self.connection.execute('SELECT max(posted_at) AS newest FROM raw_posts')
        row = await cursor.fetchone()
        return row['newest'] if row else None

    async def save_case(self, bundle, independence, evaluation, explanation, ruleset):
        """Persist one frozen case and its verdict. Idempotent on bundle hash."""
        from engine.bundle import canonical_bundle_bytes
        case_id = bundle['eventId']
        started = bundle['window']['startedAt']
        call_ids = [call['id'] for call in independence['calls']]
        weighted = Decimal(str(independence['weighted_conviction'] or '0'))
        async with self.lock, self.connection.transaction():
            await self.connection.execute('''
                INSERT INTO convergence_events (
                    id, case_kind, level, asset_key, narrative_key, window_started_at,
                    window_closed_at, call_ids, independent_voice_count,
                    timing_spread_seconds, weighted_conviction, status,
                    bundle_hash, bundle, bundle_canonical
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'candidate', %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            ''', (case_id, bundle['caseKind'],
                  'narrative' if bundle['narrativeKey'] else 'asset',
                  bundle['asset']['assetKey'], bundle['narrativeKey'],
                  started, bundle['window']['closedAt'], call_ids,
                  independence['independent_voice_count'], independence['timing_spread_seconds'],
                  weighted, bundle['bundleHash'],
                  Jsonb(bundle), canonical_bundle_bytes(bundle)))
            contributions = contribution_rows(bundle)
            await self.connection.execute('''
                INSERT INTO verdicts (
                    event_id, decision, reason_code, rule_results, explanation,
                    entry_price, case_kind, contributions
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (event_id) DO UPDATE SET
                    decision = EXCLUDED.decision, reason_code = EXCLUDED.reason_code,
                    rule_results = EXCLUDED.rule_results, explanation = EXCLUDED.explanation,
                    entry_price = EXCLUDED.entry_price
                WHERE verdicts.chain_tx_hash IS NULL
            ''', (case_id, evaluation['decision'], evaluation['reason_code'] or 'None',
                  Jsonb(evaluation['rule_results']), explanation,
                  evaluation.get('entryPrice'), bundle['caseKind'], Jsonb(contributions)))
        return case_id

    # ---------- chain mirroring ----------

    async def mark_filed(self, event_id, decision, reason_code, entry_price, tx_hash, opened_at):
        async with self.lock, self.connection.transaction():
            await self.connection.execute('''
                UPDATE verdicts SET chain_tx_hash = %s, filed_at = %s
                WHERE event_id = %s AND chain_tx_hash IS NULL
            ''', (tx_hash, opened_at, event_id))
            await self.connection.execute('''
                UPDATE convergence_events SET status = 'filed' WHERE id = %s
            ''', (event_id,))

    async def save_position(self, position):
        async with self.lock, self.connection.transaction():
            await self.connection.execute('''
                INSERT INTO paper_positions (
                    id, event_id, case_kind, asset_key, direction, entry_price,
                    size_units, stop_price, target_price, opened_at, expires_at,
                    status, contributions, open_tx_hash
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'open', %s, %s)
                ON CONFLICT (id) DO NOTHING
            ''', (position['id'], position['eventId'], position['caseKind'],
                  position['assetKey'], position['direction'], position['entryPrice'],
                  position['sizeUnits'], position['stopPrice'], position['targetPrice'],
                  position['openedAt'], position['expiresAt'],
                  Jsonb(position.get('contributions', [])), position.get('txHash')))

    async def save_settlement(self, position_id, exit_price, exit_reason, pnl_units, tx_hash,
                              score_updates):
        async with self.lock, self.connection.transaction():
            await self.connection.execute('''
                UPDATE paper_positions SET exit_price = %s, exit_reason = %s,
                    pnl_units = %s, status = 'settled', settle_tx_hash = %s
                WHERE id = %s AND status = 'open'
            ''', (exit_price, exit_reason, pnl_units, tx_hash, position_id))
            for update in score_updates:
                await self.connection.execute('''
                    INSERT INTO score_history (id, source_id, position_id, delta, reason, chain_tx_hash)
                    VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING
                ''', (update['historyId'], update['sourceId'], position_id,
                      update['delta'], update['reason'], tx_hash))
                await self.connection.execute('''
                    INSERT INTO kol_scores (
                        source_id, score, calls_tracked, wins, losses, expired, promotion_flags, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT (source_id) DO UPDATE SET
                        score = EXCLUDED.score, calls_tracked = EXCLUDED.calls_tracked,
                        wins = EXCLUDED.wins, losses = EXCLUDED.losses,
                        expired = EXCLUDED.expired,
                        promotion_flags = EXCLUDED.promotion_flags, updated_at = now()
                ''', (update['sourceId'], update['scoreHundredths'] / 100.0,
                      update['callsTracked'], update['wins'], update['losses'],
                      update['expired'], update['promotionFlags']))

    async def due_positions(self):
        cursor = await self.connection.execute('''
            SELECT * FROM paper_positions WHERE status = 'open' AND expires_at <= now()
        ''')
        return await cursor.fetchall()

    async def llm_cache_get(self, cache_key):
        cursor = await self.connection.execute(
            'SELECT response FROM llm_cache WHERE cache_key = %s', (cache_key,))
        row = await cursor.fetchone()
        return row['response'] if row else None

    async def llm_cache_put(self, cache_key, response, model):
        await self.connection.execute('''
            INSERT INTO llm_cache (cache_key, response, model) VALUES (%s, %s, %s)
            ON CONFLICT (cache_key) DO NOTHING
        ''', (cache_key, Jsonb(response), model))

    # ---------- API reads ----------

    async def board(self):
        cursor = await self.connection.execute('''
            SELECT
              (SELECT count(*) FROM calls WHERE direction <> 'close') AS calls,
              (SELECT count(*) FROM calls WHERE direction = 'close') AS exits,
              (SELECT count(*) FROM post_classifications WHERE is_advertisement) AS advertisements,
              (SELECT count(*) FROM post_classifications WHERE NOT is_advertisement AND filter_reason IS NOT NULL) AS skips,
              (SELECT count(*) FROM convergence_events) AS cases,
              (SELECT max(r.ingested_at) FROM raw_posts r) AS newest_ingest,
              (SELECT count(*) FROM sources WHERE is_active AND is_public) AS active_sources
        ''')
        return await cursor.fetchone()

    async def active_ruleset(self):
        cursor = await self.connection.execute('''
            SELECT version, config, ruleset_hash FROM rulesets WHERE is_active ORDER BY version DESC LIMIT 1
        ''')
        return await cursor.fetchone()

    async def ruleset_history(self):
        cursor = await self.connection.execute(
            'SELECT version, ruleset_hash, is_active, created_at FROM rulesets ORDER BY version')
        return await cursor.fetchall()


def contribution_rows(bundle):
    """Ledger contributor commitments: one entry per independent voice."""
    rows = []
    for voice in bundle['voices']:
        if voice['copied']:
            continue
        rows.append({
            'sourceHash': voice['sourceHash'],
            'callHash': call_hash_for(bundle, voice['callIds'][0]),
            'conviction': voice['conviction'],
        })
    return rows


def call_hash_for(bundle, call_id):
    for row in bundle['evidence']['contributingCalls']:
        if row['callId'] == call_id:
            frozen = {
                'callId': row['callId'],
                'sourceHash': row['sourceHash'],
                'messageId': row['messageId'],
                'timestamp': row['timestamp'],
                'direction': row['direction'],
                'conviction': row['conviction'],
                'narrativeTags': row['narrativeTags'],
                'span': row['span'],
            }
            from eth_hash.auto import keccak
            return '0x' + keccak(canonical_json_bytes(frozen)).hex()
    return None


def canonical_json_bytes(value):
    from shared_types.canonical import canonical_json
    return canonical_json(value).encode('utf-8')
