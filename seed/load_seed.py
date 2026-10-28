"""Apply migrations and seed the audited watchlist and mandate. No fixture data."""
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from dotenv import dotenv_values

from api import db


async def main():
    values = {**dotenv_values(ROOT / '.env', interpolate=False), **os.environ}
    url = values.get('DATABASE_URL') or ''
    if not url.startswith(('postgresql://', 'postgres://')):
        raise SystemExit('Set DATABASE_URL to the private PostgreSQL connection string.')
    result = await db.initialize(type('Settings', (), {'database_url': url})())
    print(f"Applied migrations. Seeded sources: {result['sources']}. "
          f"Active ruleset version: {result['rulesetVersion']}.")


if __name__ == '__main__':
    asyncio.run(main())
