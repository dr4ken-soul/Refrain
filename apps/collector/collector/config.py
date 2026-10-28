"""Load private configuration without printing credential values."""
from dataclasses import dataclass
import os
from pathlib import Path
import re

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Settings:
    api_id: int
    api_hash: str
    session_path: Path
    database_url: str

    @classmethod
    def load(cls):
        values = {**dotenv_values(ROOT / '.env', interpolate=False), **os.environ}
        api_id = str(values.get('TELEGRAM_API_ID') or '')
        api_hash = str(values.get('TELEGRAM_API_HASH') or '')
        if not api_id.isdigit() or int(api_id) <= 0:
            raise ValueError('TELEGRAM_API_ID must be a positive numeric application ID.')
        if not re.fullmatch(r'[a-fA-F0-9]{32}', api_hash):
            raise ValueError('TELEGRAM_API_HASH must be a 32-character hexadecimal application hash.')
        session = Path(values.get('TELEGRAM_SESSION_PATH') or '.local/telegram/refrain.session')
        if not session.is_absolute():
            session = ROOT / session
        if session.suffix != '.session':
            raise ValueError('TELEGRAM_SESSION_PATH must end in .session.')
        return cls(int(api_id), api_hash, session.resolve(), str(values.get('DATABASE_URL') or ''))

    def require_database(self):
        if not self.database_url.startswith(('postgresql://', 'postgres://')):
            raise ValueError('Set DATABASE_URL to the private PostgreSQL connection string.')
