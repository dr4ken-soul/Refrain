"""Command-line entry point. Interactive secrets never pass through the agent."""
import argparse
import asyncio
import logging
import selectors
import sys

from telethon import errors

from .auth import login, status
from .config import Settings
from .replay import export_replay, import_replay
from .service import collect
from .store import Store


def parser():
    cli = argparse.ArgumentParser(description='Refrain public-channel collector. No real trading.')
    commands = cli.add_subparsers(dest='command', required=True)
    commands.add_parser('login', help='Authorize Telegram in your own interactive terminal.')
    commands.add_parser('status', help='Check the session without asking for a login code.')
    commands.add_parser('init-db', help='Create ingestion tables in the refrain schema and seed the audited sources.')
    commands.add_parser('counts', help='Print captured post counts for each source.')
    for command, help_text in [('backfill', 'Capture the last 14 days and exit.'), ('run', 'Backfill, then tail messages and edits.')]:
        child = commands.add_parser(command, help=help_text)
        child.add_argument('--days', type=int, default=14, choices=range(1, 15), metavar='1..14')
    export = commands.add_parser('export', help='Export real captured posts as canonical JSONL.')
    export.add_argument('path')
    replay = commands.add_parser('import', help='Import a validated captured-history snapshot.')
    replay.add_argument('path')
    return cli


def make_event_loop():
    return asyncio.SelectorEventLoop(selectors.SelectSelector())


async def execute(args, settings):
    if args.command == 'login':
        await login(settings)
        return 0
    if args.command == 'status':
        return 0 if await status(settings) else 1
    if args.command in ('backfill', 'run'):
        await collect(settings, days=args.days, tail=args.command == 'run')
        return 0
    store = await Store.open(settings)
    try:
        if args.command == 'init-db':
            count = await store.initialize()
            print(f"Ingest tables ready. Audited source records seeded: {count}.")
            print("Existing tables and posts were preserved. No channel history was invented.")
        elif args.command == 'export':
            count = await export_replay(store, args.path)
            print(f"Exported {count} real captured posts.")
        elif args.command == 'import':
            count = await import_replay(store, args.path)
            print(f"Imported {count} hash-verified posts in recorded replay mode.")
        if args.command in ('counts', 'import'):
            for row in await store.counts():
                print(f"@{row['handle']}: {row['posts']} posts")
        return 0
    finally:
        await store.close()


def main():
    args = parser().parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    logging.getLogger('telethon').setLevel(logging.CRITICAL)
    try:
        return_code = asyncio.run(
            execute(args, Settings.load()),
            loop_factory=make_event_loop,
        )
    except asyncio.exceptions.InvalidStateError as error:
        print(f'Telethon event loop helper was entered in an unsupported state ({type(error).__name__}). Restart locally.', file=sys.stderr)
        return_code = 1
    except errors.FloodWaitError as error:
        print(f'Telegram requires a wait of {error.seconds} seconds. Wait before restarting login.', file=sys.stderr)
        return_code = 1
    except errors.PhoneCodeExpiredError:
        print('The Telegram code expired. Restart login and use the newest code in your local terminal.', file=sys.stderr)
        return_code = 1
    except errors.RPCError as error:
        print(f'Telegram rejected the request ({type(error).__name__}). No credential values were logged.', file=sys.stderr)
        return_code = 1
    except (ValueError, RuntimeError) as error:
        print(f'Cannot continue: {error}', file=sys.stderr)
        return_code = 1
    except KeyboardInterrupt:
        print('\nStopped safely. Your existing session and checkpoints were preserved.')
        return_code = 130
    except Exception as error:
        # Never print an unknown exception body that could contain a connection URI.
        print(f'Collector failed ({type(error).__name__}). Check network access and configuration. Credentials withheld.', file=sys.stderr)
        return_code = 1
    raise SystemExit(return_code)
