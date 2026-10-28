"""Apply migrations in order and seed the audited watchlist and mandate.

One implementation shared by the collector, the API and the seed loader.
Every migration runs inside one transaction behind an advisory lock, and its
SHA-256 is recorded. Editing an applied migration is an error.
"""
import asyncio
import hashlib
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from eth_hash.auto import keccak
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS_DIR = ROOT / 'apps/api/migrations'


def file_digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


async def apply_migrations(connection):
    await connection.execute('CREATE SCHEMA IF NOT EXISTS refrain')
    await connection.execute('''CREATE TABLE IF NOT EXISTS refrain.schema_migrations (
        name text PRIMARY KEY, sha256 text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now())''')
    for path in sorted(MIGRATIONS_DIR.glob('*.sql')):
        digest = file_digest(path)
        async with connection.transaction():
            await connection.execute("SELECT pg_advisory_xact_lock(hashtext('refrain:migrations:all'))")
            cursor = await connection.execute(
                'SELECT sha256 FROM refrain.schema_migrations WHERE name = %s', (path.name,))
            existing = await cursor.fetchone()
            if existing and existing['sha256'] != digest:
                raise RuntimeError(f'Applied migration {path.name} changed. Create a new migration instead.')
            if not existing:
                await connection.execute(f'SET LOCAL search_path TO refrain')
                await connection.execute(path.read_text(encoding='utf-8'))
                await connection.execute(
                    'INSERT INTO refrain.schema_migrations (name, sha256) VALUES (%s, %s)',
                    (path.name, digest))


async def seed_watchlist(connection):
    seeds = json.loads((ROOT / 'seed/sources.json').read_text(encoding='utf-8'))
    for source in seeds:
        handle = source['handle']
        await connection.execute('''
            INSERT INTO refrain.sources (id, handle, display_name, role, source_hash)
            VALUES (%s, %s, %s, %s, %s) ON CONFLICT (handle) DO NOTHING
        ''', (uuid5(NAMESPACE_URL, f'telegram:{handle.casefold()}'), handle,
              source['display_name'], source['role'],
              '0x' + keccak(f'telegram:{handle}'.encode()).hex()))
    return len(seeds)


def canonical_ruleset_json(config):
    return json.dumps(config, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


async def seed_ruleset(connection, path=None):
    path = Path(path or (ROOT / 'seed/ruleset-v1.json'))
    config = json.loads(path.read_text(encoding='utf-8'))
    digest = '0x' + hashlib.sha256(canonical_ruleset_json(config).encode('utf-8')).hexdigest()
    await connection.execute('''
        INSERT INTO refrain.rulesets (version, config, ruleset_hash, is_active)
        VALUES (%s, %s, %s, false) ON CONFLICT (version) DO NOTHING
    ''', (config['version'], Jsonb(config), digest))
    await connection.execute('''
        UPDATE refrain.rulesets SET is_active = true
        WHERE version = %s AND NOT EXISTS (
            SELECT 1 FROM refrain.rulesets WHERE is_active AND version <> %s)
    ''', (config['version'], config['version']))
    return config['version']


async def connect(settings):
    connection = await psycopg.AsyncConnection.connect(
        settings.database_url, autocommit=True, connect_timeout=15,
        sslmode='require', row_factory=dict_row, application_name='refrain-shared')
    await connection.execute('SET search_path TO refrain')
    return connection


async def initialize(settings):
    connection = await connect(settings)
    try:
        await apply_migrations(connection)
        sources = await seed_watchlist(connection)
        version = await seed_ruleset(connection)
        return {'sources': sources, 'rulesetVersion': version}
    finally:
        await connection.close()
