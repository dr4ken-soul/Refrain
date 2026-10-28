"""Interactive login runs only in the operator's own terminal."""
from contextlib import contextmanager
from datetime import datetime, timezone
from getpass import getpass
import json
import os
import re
import sys

from telethon import TelegramClient, errors

from .config import ROOT


@contextmanager
def session_lock(settings):
    """Prevent collector, status and login from opening one session concurrently."""
    settings.session_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = settings.session_path.with_suffix('.session.lock')
    descriptor = os.open(path, os.O_RDWR | os.O_CREAT, 0o600)
    locked = False
    try:
        with os.fdopen(descriptor, 'r+b') as handle:
            if os.fstat(handle.fileno()).st_size == 0:
                handle.write(b'0')
                handle.flush()
            handle.seek(0)
            try:
                if os.name == 'nt':
                    import msvcrt
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                locked = True
            except OSError:
                raise RuntimeError('Another Refrain process is using this Telegram session. Close it first.') from None
            try:
                yield
            finally:
                if locked:
                    handle.seek(0)
                    if os.name == 'nt':
                        msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
    finally:
        if settings.session_path.exists() and os.name != 'nt':
            settings.session_path.chmod(0o600)


def make_client(settings):
    return TelegramClient(
        str(settings.session_path), settings.api_id, settings.api_hash,
        flood_sleep_threshold=0, connection_retries=3, request_retries=3,
        auto_reconnect=True, sequential_updates=True, catch_up=False,
    )


def write_login_status(status):
    """Only a state and timestamp are persisted, never phone, code or password."""
    path = ROOT / '.local/telegram-login-status.json'
    path.parent.mkdir(exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps({
        'status': status,
        'checkedAt': datetime.now(timezone.utc).isoformat(),
    }, indent=2), encoding='utf-8')
    temporary.replace(path)


async def login(settings):
    if not sys.stdin.isatty():
        raise RuntimeError('Login requires a local interactive terminal. Run scripts/telegram-login.ps1.')
    print('Refrain Telegram login')
    print('Use your dedicated operator account. No messages will be sent or collected here.')
    print('Enter codes only in this terminal, never in chat. Hidden input is intentional.')
    with session_lock(settings):
        client = make_client(settings)
        write_login_status('awaiting_local_login')
        try:
            await client.connect()
            if not await client.is_user_authorized():
                phone = input('Telegram phone number, including country code (for example +44...): ').strip()
                if not re.fullmatch(r'\+[1-9][0-9]{6,14}', phone):
                    raise ValueError('Use international phone format: + followed by country code and number.')
                sent = await client.send_code_request(phone)
                needs_password = False
                for attempt in range(3):
                    code = getpass('Telegram login code (typing is hidden): ').strip().replace(' ', '')
                    try:
                        await client.sign_in(phone=phone, code=code, phone_code_hash=sent.phone_code_hash)
                        break
                    except errors.PhoneCodeInvalidError:
                        print('That code was not accepted. Check the newest Telegram login message.')
                    except errors.SessionPasswordNeededError:
                        needs_password = True
                        break
                if needs_password:
                    for attempt in range(3):
                        try:
                            await client.sign_in(password=getpass('Telegram two-step-verification password (hidden): '))
                            break
                        except errors.PasswordHashInvalidError:
                            print('That two-step-verification password was not accepted.')
                if not await client.is_user_authorized():
                    raise RuntimeError('Login was not completed. Restart the login command when ready.')
            write_login_status('authorized')
            print('SUCCESS: Telegram accepted the credentials and the account is authorized.')
            print('Your private session is saved locally and excluded from Git.')
            print('No channel history was collected by the login command.')
        except BaseException:
            write_login_status('not_authorized_or_check_failed')
            raise
        finally:
            await client.disconnect()


async def status(settings):
    if not settings.session_path.exists():
        print('NOT AUTHORIZED: complete scripts/telegram-login.ps1 first.')
        return False
    with session_lock(settings):
        client = make_client(settings)
        try:
            await client.connect()
            authorized = await client.is_user_authorized()
            write_login_status('authorized' if authorized else 'not_authorized')
            print('AUTHORIZED: Telegram session works.' if authorized else 'NOT AUTHORIZED: run the login command.')
            return authorized
        finally:
            await client.disconnect()
