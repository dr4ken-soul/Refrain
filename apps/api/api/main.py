"""Phase 4 CRE stub API.

Serves the two committed workflow fixtures to the CRE CLI during local
simulation and the Sepolia run book:

    GET /cre/pending-verdicts              bearer: oldest pending candidate
    GET /cre/events/{eventId}/bundle       bearer: the frozen bundle verbatim
    GET /cre/due-positions                 bearer: open paper position(s)
    GET /api/cre/runs                      public: committed run summaries

The workflow recomputes every hash and every rule from the bundle, so this
service supplies transport only; it is not an authority. Phase 5 replaces
these routes with repository-backed queries over PostgreSQL.

Run from the repository root:

    .venv\\Scripts\\python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
"""
import json
import secrets
from pathlib import Path

from dotenv import dotenv_values
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / 'cre' / 'fixtures'
RUNS = ROOT / 'cre-runs'

FIXTURE_FILES = {
    'approved': 'verdict-approved.json',
    'rejected': 'verdict-rejected.json',
}

DEFAULT_PENDING_ORDER = 'approved,rejected'

app = FastAPI(title='Refrain CRE stub')


def settings():
    values = {**dotenv_values(ROOT / '.env', interpolate=False)}
    import os
    values.update(os.environ)
    return values


def bearer_secret():
    return str(settings().get('CRE_BEARER_SECRET') or '')


def authorized(request: Request):
    expected = bearer_secret()
    if not expected:
        raise HTTPException(status_code=503, detail='CRE_BEARER_SECRET is not set.')
    header = request.headers.get('authorization') or ''
    prefix = 'Bearer '
    presented = header[len(prefix):] if header.startswith(prefix) else ''
    if not secrets.compare_digest(presented, expected):
        raise HTTPException(status_code=401, detail='Bearer token required.')


def load_fixture(key):
    path = FIXTURES / FIXTURE_FILES[key]
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding='utf-8'))


def pending_order():
    raw = str(settings().get('REFRAIN_CRE_PENDING_ORDER') or DEFAULT_PENDING_ORDER)
    return [key.strip() for key in raw.split(',') if key.strip() in FIXTURE_FILES]


def candidate(key):
    fixture = load_fixture(key)
    if fixture is None:
        return None
    bundle = fixture['bundle']
    return {
        'eventId': bundle['eventId'],
        'caseHash': bundle['bundleHash'],
        'caseKind': bundle['caseKind'],
        'assetKey': bundle['asset'].get('assetKey'),
        'windowClosedAt': bundle['window']['closedAt'],
    }


@app.get('/cre/pending-verdicts')
def pending_verdicts(request: Request):
    authorized(request)
    candidates = [row for row in (candidate(key) for key in pending_order()) if row]
    return {'candidates': candidates}


@app.get('/cre/events/{eventId}/bundle')
def event_bundle(eventId: str, request: Request):
    authorized(request)
    for key in FIXTURE_FILES:
        fixture = load_fixture(key)
        if fixture and fixture['bundle']['eventId'] == eventId:
            return JSONResponse(fixture['bundle'])
    raise HTTPException(status_code=404, detail='No frozen bundle for that event.')


@app.get('/cre/due-positions')
def due_positions(request: Request):
    authorized(request)
    position_id = str(settings().get('REFRAIN_CRE_POSITION_ID') or '1')
    include = str(settings().get('REFRAIN_CRE_DUE') or '1') != '0'
    fixture = load_fixture('approved')
    if not include or fixture is None:
        return {'positions': []}
    return {
        'positions': [{
            'positionId': int(position_id),
            'eventId': fixture['bundle']['eventId'],
            'caseHash': fixture['bundle']['bundleHash'],
        }],
    }


@app.get('/api/cre/runs')
def cre_runs():
    runs = []
    if RUNS.exists():
        for path in sorted(RUNS.glob('*.json')):
            try:
                runs.append(json.loads(path.read_text(encoding='utf-8')))
            except (OSError, json.JSONDecodeError):
                continue
    return {'runs': runs}
