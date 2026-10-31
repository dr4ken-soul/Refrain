"""Confirmed RefrainLedger event indexer for the Postgres read model.

Run once with ``python -m api.indexer --once`` or poll continuously with
``python -m api.indexer``. Only confirmed Sepolia logs are applied.
"""
import argparse
import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import json
import os
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import httpx
from dotenv import dotenv_values
from eth_abi import decode
from eth_hash.auto import keccak
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .db import initialize

ROOT = Path(__file__).resolve().parents[3]
UINT_PRICE_SCALE = Decimal(100_000_000)
CHAIN_ID_SEPOLIA = 11155111
DEFAULT_START_BLOCK = 12026631
EVENTS = {
    '0x' + keccak(b'VerdictFiled(bytes32,bytes32,bytes32,uint8,uint8,uint8,uint8)').hex(): 'VerdictFiled',
    '0x' + keccak(b'PositionOpened(uint256,bytes32,uint8,uint8,uint256,uint256,uint256,uint256,uint64,uint64,bytes32[],bytes32[],uint8[])').hex(): 'PositionOpened',
    '0x' + keccak(b'PositionSettled(uint256,uint8,uint256,int256)').hex(): 'PositionSettled',
    '0x' + keccak(b'ScoreUpdated(bytes32,int256,int256)').hex(): 'ScoreUpdated',
}
DECISIONS = {0: 'approved', 1: 'rejected', 2: 'deferred'}
DIRECTIONS = {0: 'long', 1: 'short', 2: 'spot_buy'}
EXIT_REASONS = {0: 'target', 1: 'stop', 2: 'expiry'}


def load_config():
    values = {**dotenv_values(ROOT / '.env', interpolate=False), **os.environ}
    rpc_url = str(values.get('SEPOLIA_RPC_URL') or '')
    address = str(values.get('REFRAIN_LEDGER_ADDRESS') or '')
    if not rpc_url.startswith(('https://', 'http://')):
        raise ValueError('Set SEPOLIA_RPC_URL in the repository-root .env.')
    if len(address) != 42 or not address.startswith('0x'):
        raise ValueError('Set REFRAIN_LEDGER_ADDRESS to the deployed contract address.')
    database_url = str(values.get('DATABASE_URL') or '')
    if not database_url.startswith(('postgresql://', 'postgres://')):
        raise ValueError('Set DATABASE_URL in the repository-root .env.')
    return {
        'rpc_url': rpc_url,
        'address': address.lower(),
        'database_url': database_url,
        'start_block': int(values.get('REFRAIN_INDEXER_START_BLOCK') or DEFAULT_START_BLOCK),
        'confirmations': max(1, int(values.get('REFRAIN_INDEXER_CONFIRMATIONS') or 5)),
        'batch_blocks': max(1, min(2000, int(values.get('REFRAIN_INDEXER_BATCH_BLOCKS') or 500))),
        'poll_seconds': max(5, int(values.get('REFRAIN_INDEXER_POLL_SECONDS') or 30)),
    }


def _topic_word(topic):
    return bytes.fromhex(topic[2:])


def _hex_bytes(value):
    return bytes.fromhex(value[2:])


def _word_uint(topic):
    return int.from_bytes(_topic_word(topic), 'big')


def decode_log(log):
    """Decode one supported contract event into JSON-safe values."""
    topics = log.get('topics') or []
    if not topics:
        return None
    event_name = EVENTS.get(topics[0].lower())
    if event_name is None:
        return None
    data = _hex_bytes(log.get('data') or '0x')
    if event_name == 'VerdictFiled':
        case_hash = topics[1].lower()
        ruleset_hash, asset_hash, case_kind, decision, reason, direction = decode(
            ['bytes32', 'bytes32', 'uint8', 'uint8', 'uint8', 'uint8'], data)
        payload = {
            'caseHash': case_hash,
            'rulesetHash': '0x' + ruleset_hash.hex(),
            'assetHash': '0x' + asset_hash.hex(),
            'caseKind': case_kind,
            'decision': decision,
            'reason': reason,
            'direction': direction,
        }
    elif event_name == 'PositionOpened':
        position_id = _word_uint(topics[1])
        case_hash = topics[2].lower()
        (case_kind, direction, entry, stop, target, size, opened, expires,
         sources, calls, convictions) = decode(
            ['uint8', 'uint8', 'uint256', 'uint256', 'uint256', 'uint256',
             'uint64', 'uint64', 'bytes32[]', 'bytes32[]', 'uint8[]'], data)
        payload = {
            'positionId': str(position_id),
            'caseHash': case_hash,
            'caseKind': case_kind,
            'direction': direction,
            'entryPrice1e8': str(entry),
            'stopPrice1e8': str(stop),
            'targetPrice1e8': str(target),
            'sizeUnits': str(size),
            'openedAt': opened,
            'expiresAt': expires,
            'sourceHashes': ['0x' + value.hex() for value in sources],
            'callHashes': ['0x' + value.hex() for value in calls],
            'convictions': list(convictions),
        }
    elif event_name == 'PositionSettled':
        position_id = _word_uint(topics[1])
        exit_reason, exit_price, pnl_units = decode(['uint8', 'uint256', 'int256'], data)
        payload = {
            'positionId': str(position_id),
            'exitReason': exit_reason,
            'exitPrice1e8': str(exit_price),
            'pnlUnits': str(pnl_units),
        }
    else:
        source_hash = topics[1].lower()
        delta, new_score = decode(['int256', 'int256'], data)
        payload = {'sourceHash': source_hash, 'delta': str(delta), 'newScore': str(new_score)}
    return event_name, payload


def _timestamp(value):
    return datetime.fromtimestamp(int(value), timezone.utc)


def _price(value):
    return Decimal(int(value)) / UINT_PRICE_SCALE


async def rpc(client, method, params):
    response = await client.post('/', json={
        'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params,
    })
    response.raise_for_status()
    body = response.json()
    if body.get('error'):
        raise RuntimeError(f'RPC request failed: {body["error"].get("code", "unknown")}')
    return body.get('result')


class LedgerIndexer:
    def __init__(self, config, connection, client):
        self.config = config
        self.connection = connection
        self.client = client

    async def verify_network(self):
        chain_id = int(await rpc(self.client, 'eth_chainId', []), 16)
        if chain_id != CHAIN_ID_SEPOLIA:
            raise RuntimeError(f'Expected Sepolia chain ID {CHAIN_ID_SEPOLIA}, received {chain_id}.')

    async def _next_block(self):
        cursor = await self.connection.execute(
            'SELECT next_block FROM chain_indexer_state WHERE contract_address = %s',
            (self.config['address'],))
        row = await cursor.fetchone()
        return int(row['next_block']) if row else self.config['start_block']

    async def sync_once(self):
        await self.verify_network()
        latest = int(await rpc(self.client, 'eth_blockNumber', []), 16)
        confirmed = latest - self.config['confirmations'] + 1
        start = await self._next_block()
        if start > confirmed:
            return {'fromBlock': start, 'toBlock': None, 'events': 0, 'status': 'caught_up'}
        end = min(confirmed, start + self.config['batch_blocks'] - 1)
        topic_list = list(EVENTS)
        logs = await rpc(self.client, 'eth_getLogs', [{
            'address': self.config['address'],
            'fromBlock': hex(start),
            'toBlock': hex(end),
            'topics': [topic_list],
        }]) or []
        logs.sort(key=lambda row: (int(row['blockNumber'], 16), int(row['transactionIndex'], 16), int(row['logIndex'], 16)))
        timestamps = {}
        for log in logs:
            block_number = log['blockNumber'].lower()
            if block_number not in timestamps:
                block = await rpc(self.client, 'eth_getBlockByNumber', [block_number, False])
                timestamps[block_number] = int(block['timestamp'], 16)
            log['_blockTimestamp'] = timestamps[block_number]
        indexed = 0
        async with self.connection.transaction():
            await self.connection.execute("SELECT pg_advisory_xact_lock(hashtext('refrain:chain-indexer'))")
            by_transaction = {}
            for log in logs:
                by_transaction.setdefault(log['transactionHash'].lower(), []).append(log)
            for tx_hash, tx_logs in by_transaction.items():
                decoded = []
                for log in tx_logs:
                    event = decode_log(log)
                    if event is None:
                        continue
                    event_name, payload = event
                    cursor = await self.connection.execute('''
                        INSERT INTO ledger_chain_events (
                            tx_hash, log_index, block_number, block_hash, contract_address,
                            event_name, event_data
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (tx_hash, log_index) DO NOTHING
                        RETURNING log_index
                    ''', (tx_hash, int(log['logIndex'], 16), int(log['blockNumber'], 16),
                          log['blockHash'].lower(), self.config['address'], event_name, Jsonb(payload)))
                    if await cursor.fetchone():
                        indexed += 1
                        decoded.append((event_name, payload, log))
                if decoded:
                    await self._apply_transaction(tx_hash, decoded)
            await self.connection.execute('''
                INSERT INTO chain_indexer_state (contract_address, next_block)
                VALUES (%s, %s)
                ON CONFLICT (contract_address) DO UPDATE SET
                    next_block = GREATEST(chain_indexer_state.next_block, EXCLUDED.next_block),
                    updated_at = now()
            ''', (self.config['address'], end + 1))
        return {'fromBlock': start, 'toBlock': end, 'events': indexed, 'status': 'indexed'}

    async def _case_id(self, case_hash):
        cursor = await self.connection.execute(
            'SELECT id FROM convergence_events WHERE lower(bundle_hash) = lower(%s)', (case_hash,))
        row = await cursor.fetchone()
        return row['id'] if row else None

    async def _apply_transaction(self, tx_hash, events):
        settlement = next((data for name, data, _ in events if name == 'PositionSettled'), None)
        position_open = next((data for name, data, _ in events if name == 'PositionOpened'), None)
        position_id = int(settlement['positionId']) if settlement else None
        if settlement:
            reason = EXIT_REASONS.get(settlement['exitReason'])
            if reason:
                await self.connection.execute('''
                    UPDATE paper_positions SET exit_price = %s, exit_reason = %s,
                        pnl_units = %s, status = 'settled', settle_tx_hash = %s
                    WHERE id = %s AND status = 'open'
                ''', (_price(settlement['exitPrice1e8']), reason,
                      int(settlement['pnlUnits']), tx_hash, position_id))
                await self.connection.execute('''
                    UPDATE convergence_events SET status = 'settled'
                    WHERE id = (
                        SELECT event_id FROM paper_positions WHERE id = %s
                    )
                ''', (position_id,))

        for name, data, log in events:
            if name == 'VerdictFiled':
                event_id = await self._case_id(data['caseHash'])
                if event_id is None:
                    continue
                decision = DECISIONS.get(data['decision'])
                if not decision:
                    continue
                reason_code = f'chain_reason_{data["reason"]}'
                await self.connection.execute('''
                    INSERT INTO verdicts (
                        event_id, decision, reason_code, rule_results,
                        case_kind, contributions, chain_tx_hash, filed_at
                    ) SELECT id, %s, %s, '[]'::jsonb, case_kind, '[]'::jsonb, %s,
                             to_timestamp(%s)
                      FROM convergence_events WHERE id = %s
                    ON CONFLICT (event_id) DO UPDATE SET
                        decision = EXCLUDED.decision,
                        chain_tx_hash = EXCLUDED.chain_tx_hash,
                        filed_at = EXCLUDED.filed_at
                ''', (decision, reason_code, tx_hash, int(log['_blockTimestamp']), event_id))
                await self.connection.execute(
                    "UPDATE convergence_events SET status = 'filed' WHERE id = %s", (event_id,))
            elif name == 'PositionOpened':
                event_id = await self._case_id(data['caseHash'])
                if event_id is None:
                    continue
                cursor = await self.connection.execute(
                    'SELECT asset_key FROM convergence_events WHERE id = %s', (event_id,))
                case = await cursor.fetchone()
                direction = DIRECTIONS.get(data['direction'])
                lengths = {len(data['sourceHashes']), len(data['callHashes']), len(data['convictions'])}
                if not case or not case['asset_key'] or not direction or len(lengths) != 1:
                    continue
                contributions = [{
                    'sourceHash': source_hash,
                    'callHash': call_hash,
                    'conviction': conviction,
                } for source_hash, call_hash, conviction in zip(
                    data['sourceHashes'], data['callHashes'], data['convictions'])]
                await self.connection.execute('''
                    INSERT INTO paper_positions (
                        id, event_id, case_kind, asset_key, direction, entry_price,
                        size_units, stop_price, target_price, opened_at, expires_at,
                        status, contributions, open_tx_hash
                    ) SELECT %s, id, case_kind, asset_key, %s, %s, %s, %s, %s,
                        %s, %s, 'open', %s, %s
                      FROM convergence_events WHERE id = %s
                    ON CONFLICT (id) DO NOTHING
                ''', (int(data['positionId']), direction, _price(data['entryPrice1e8']),
                      int(data['sizeUnits']), _price(data['stopPrice1e8']),
                      _price(data['targetPrice1e8']), _timestamp(data['openedAt']),
                      _timestamp(data['expiresAt']), Jsonb(contributions), tx_hash, event_id))

        if settlement and position_open is None:
            reason = EXIT_REASONS.get(settlement['exitReason']) or 'expiry'
            await self._apply_scores(tx_hash, position_id, reason, events)

    async def _apply_scores(self, tx_hash, position_id, reason, events):
        for name, data, _ in events:
            if name != 'ScoreUpdated':
                continue
            cursor = await self.connection.execute(
                'SELECT id FROM sources WHERE lower(source_hash) = lower(%s)', (data['sourceHash'],))
            source = await cursor.fetchone()
            if source is None:
                continue
            history_id = uuid5(NAMESPACE_URL, f'refrain:score:{tx_hash}:{data["sourceHash"].lower()}')
            score = Decimal(int(data['newScore'])) / Decimal(100)
            delta = Decimal(int(data['delta'])) / Decimal(100)
            await self.connection.execute('''
                INSERT INTO score_history (id, source_id, position_id, delta, reason, chain_tx_hash)
                VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING
            ''', (history_id, source['id'], position_id, delta, reason, tx_hash))
            await self.connection.execute('''
                INSERT INTO kol_scores (
                    source_id, score, calls_tracked, wins, losses, expired,
                    promotion_flags, updated_at
                ) VALUES (%s, %s, 1, %s, %s, %s, 0, now())
                ON CONFLICT (source_id) DO UPDATE SET
                    score = EXCLUDED.score,
                    calls_tracked = kol_scores.calls_tracked + 1,
                    wins = kol_scores.wins + EXCLUDED.wins,
                    losses = kol_scores.losses + EXCLUDED.losses,
                    expired = kol_scores.expired + EXCLUDED.expired,
                    updated_at = now()
            ''', (source['id'], score, int(reason == 'target'), int(reason == 'stop'), int(reason == 'expiry')))


async def main():
    parser = argparse.ArgumentParser(description='Index confirmed RefrainLedger events on Sepolia.')
    parser.add_argument('--once', action='store_true', help='Index one confirmed block range and exit.')
    args = parser.parse_args()
    config = load_config()
    await initialize(type('Settings', (), {'database_url': config['database_url']})())
    connection = await psycopg.AsyncConnection.connect(
        config['database_url'], autocommit=True, connect_timeout=15,
        sslmode='require', row_factory=dict_row, application_name='refrain-chain-indexer',
    )
    await connection.execute('SET search_path TO refrain')
    client = httpx.AsyncClient(base_url=config['rpc_url'], timeout=20)
    indexer = LedgerIndexer(config, connection, client)
    try:
        while True:
            try:
                result = await indexer.sync_once()
                print(json.dumps(result, separators=(',', ':')), flush=True)
            except Exception as error:
                if args.once:
                    raise
                print(f'Indexer pass failed ({type(error).__name__}). Confirmed cursor was preserved.', flush=True)
            if args.once:
                break
            await asyncio.sleep(config['poll_seconds'])
    finally:
        await client.aclose()
        await connection.close()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('Indexer stopped. Confirmed events and the block cursor were preserved.')
    except Exception as error:
        print(f'Indexer failed ({type(error).__name__}). Credentials withheld.', flush=True)
        raise SystemExit(1)
