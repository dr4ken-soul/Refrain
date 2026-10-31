"""Refrain public API and CRE transport.

The deployment runs from a committed replay set: two frozen evidence bundles,
the audited watchlist, the active ruleset, the committed CRE run logs and the
verified Sepolia filings. Public reads are served from that set. The CRE bearer
routes serve the same frozen bundles so the workflows can be replayed exactly.

Run from the repository root:

    .venv\\Scripts\\python -m uvicorn api.main:app --host 127.0.0.1 --port 8000

Run from `apps/api` with `api.main:app`.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from dotenv import dotenv_values
from eth_hash.auto import keccak
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import demo

ROOT = Path(__file__).resolve().parents[3]
RUNS = ROOT / 'cre-runs'
OPERATOR_STATE = Path(__file__).with_name('operator_state.json')

FIXTURE_FILES = demo.FIXTURE_FILES
DEFAULT_PENDING_ORDER = 'approved,rejected'
ROLES = {'core_signal', 'meme_radar', 'noisy_source', 'red_flag_specimen'}
COOKIE_NAME = 'refrain_operator'

app = FastAPI(title='Refrain API')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

STORE = demo.load_replay()


def settings():
    values = {**dotenv_values(ROOT / '.env', interpolate=False)}
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


def operator_secret():
    return str(settings().get('OPERATOR_SECRET') or '')


def session_token(secret):
    return hmac.new(secret.encode('utf-8'), b'refrain-operator', hashlib.sha256).hexdigest()


def operator_signed_in(request: Request):
    expected = operator_secret()
    presented = request.cookies.get(COOKIE_NAME) or ''
    if not expected or not presented:
        return False
    return secrets.compare_digest(presented, session_token(expected))


def require_operator(request: Request):
    if not operator_secret():
        raise HTTPException(status_code=503, detail='OPERATOR_SECRET is not set on this host.')
    if not operator_signed_in(request):
        raise HTTPException(status_code=401, detail='Operator session required.')


def load_fixture(key):
    path = demo.FIXTURES / FIXTURE_FILES[key]
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


# ---------- operator state ----------

def load_operator_state():
    if OPERATOR_STATE.exists():
        try:
            return json.loads(OPERATOR_STATE.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            pass
    return {'sources': STORE['sources'], 'rulesets': [STORE['ruleset']]}


def save_operator_state(state):
    OPERATOR_STATE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding='utf-8')


def active_ruleset(state):
    for ruleset in state['rulesets']:
        if ruleset.get('active'):
            return ruleset
    return state['rulesets'][-1]


# ---------- public reads ----------

@app.get('/api/health')
def health():
    return {'status': 'ok', 'mode': STORE['replay']['mode'], 'generatedAt': STORE['generatedAt']}


@app.get('/api/replay/status')
def replay_status():
    return {**STORE['replay'], 'generatedAt': STORE['generatedAt']}


@app.get('/api/board')
def board():
    return demo.board(STORE)


@app.get('/api/metrics')
def metrics():
    return demo.metrics(STORE)


@app.get('/api/calls')
def calls(
    filter: str = 'all',
    source: str | None = None,
    asset: str | None = None,
    cursor: str | None = None,
    limit: int = 50,
):
    rows = list(STORE['calls'])
    if filter in {'advertisements', 'ads', 'filtered'}:
        rows = [row for row in rows if row['isAdvertisement']]
    elif filter in {'calls', 'extracted'}:
        rows = [row for row in rows if not row['isAdvertisement']]
    if source:
        needle = source.casefold()
        rows = [
            row for row in rows
            if row['sourceHash'].casefold() == needle
            or row['sourceLabel'].casefold() == needle
        ]
    if asset:
        needle = asset.casefold()
        rows = [
            row for row in rows
            if (row.get('ticker') or '').casefold() == needle
            or (row.get('assetKey') or '').casefold() == needle
        ]
    offset = 0
    if cursor:
        try:
            offset = int(json.loads(base64.urlsafe_b64decode(cursor.encode()).decode()).get('offset', 0))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            raise HTTPException(status_code=400, detail='Invalid cursor.')
    limit = max(1, min(limit, 200))
    page = rows[offset:offset + limit]
    next_cursor = None
    if offset + limit < len(rows):
        next_cursor = base64.urlsafe_b64encode(
            json.dumps({'offset': offset + limit}).encode()).decode()
    return {'calls': page, 'nextCursor': next_cursor, 'total': len(rows)}


@app.get('/api/events')
def events(decision: str | None = None, reason_code: str | None = None):
    rows = [demo.public_case(case) for case in STORE['cases']]
    if decision:
        rows = [row for row in rows if row['decision'] == decision]
    if reason_code:
        rows = [row for row in rows if row.get('reasonCode') == reason_code]
    return {'events': rows}


@app.get('/api/events/{eventId}')
def event(eventId: str):
    detail = demo.case_detail(STORE, eventId)
    if detail is None:
        raise HTTPException(status_code=404, detail='No case file for that event.')
    return detail


@app.get('/api/kols')
def kols(role: str | None = None, active: bool | None = None):
    state = load_operator_state()
    rows = demo.source_rows({**STORE, 'sources': state['sources']})
    if role:
        rows = [row for row in rows if row['role'] == role]
    if active is not None:
        rows = [row for row in rows if bool(row['isActive']) == active]
    rows.sort(key=lambda row: row['handle'].casefold())
    return {'rows': rows}


@app.get('/api/kols/{handle}')
def kol(handle: str):
    state = load_operator_state()
    rows = demo.source_rows({**STORE, 'sources': state['sources']})
    needle = handle.casefold()
    for row in rows:
        if row['handle'].casefold() == needle or row['sourceHash'].casefold() == needle:
            return row
    raise HTTPException(status_code=404, detail='No watchlist record for that handle.')


@app.get('/api/ledger/positions')
def positions():
    rows = []
    for case in STORE['cases']:
        if not case.get('position'):
            continue
        rows.append({
            **case['position'],
            'eventId': case['eventId'],
            'ticker': case['asset'].get('ticker'),
            'assetKey': case['asset'].get('assetKey'),
            'decision': case['decision'],
        })
    return {'positions': rows}


@app.get('/api/ledger/rejections')
def rejections():
    rows = []
    for case in STORE['cases']:
        if case['decision'] == 'rejected':
            rows.append({
                'eventId': case['eventId'],
                'ticker': case['asset'].get('ticker'),
                'assetKey': case['asset'].get('assetKey'),
                'reasonCode': case['reasonCode'],
                'decidedAt': case['evaluatedAt'],
                'windowStartedAt': case['window']['startedAt'],
                'windowClosedAt': case['window']['closedAt'],
                'independentVoiceCount': case['independentVoiceCount'],
                'direction': case['terms'].get('direction'),
                'verdictTx': case.get('filing', {}).get('txHash'),
                'ruleResults': case['ruleResults'],
            })
    return {'rejections': rows}


@app.get('/api/rules/active')
def rules_active():
    state = load_operator_state()
    ruleset = active_ruleset(state)
    return {
        'version': ruleset['version'],
        'name': ruleset.get('name'),
        'hash': ruleset['hash'],
        'config': ruleset['config'],
    }


@app.get('/api/rules')
def rules():
    state = load_operator_state()
    return {'activeVersion': active_ruleset(state)['version'], 'versions': state['rulesets']}


@app.get('/api/cre/runs')
def cre_runs():
    return {'runs': STORE['runs']}


# ---------- CRE transport ----------

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
            return fixture['bundle']
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


# ---------- operator session ----------

class SessionBody(BaseModel):
    secret: str


class SourceBody(BaseModel):
    handle: str
    displayName: str | None = None
    role: str = 'core_signal'
    note: str | None = None


class SourcePatch(BaseModel):
    role: str | None = None
    isActive: bool | None = None


class RulesBody(BaseModel):
    config: dict


@app.get('/operator/session')
def session_state(request: Request):
    return {'signedIn': operator_signed_in(request), 'configured': bool(operator_secret())}


@app.post('/operator/session')
def session_login(body: SessionBody, response: Response):
    expected = operator_secret()
    if not expected:
        raise HTTPException(status_code=503, detail='OPERATOR_SECRET is not set on this host.')
    if not secrets.compare_digest(body.secret, expected):
        raise HTTPException(status_code=401, detail='Invalid operator secret.')
    response.set_cookie(
        COOKIE_NAME,
        session_token(expected),
        httponly=True,
        samesite='lax',
        max_age=60 * 60 * 8,
    )
    return {'signedIn': True}


@app.delete('/operator/session')
def session_logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {'signedIn': False}


@app.post('/operator/sources', status_code=201)
def add_source(body: SourceBody, request: Request):
    require_operator(request)
    if body.role not in ROLES:
        raise HTTPException(status_code=422, detail='Unknown source role.')
    state = load_operator_state()
    if sum(1 for source in state['sources'] if source['isActive']) >= 20:
        raise HTTPException(status_code=409, detail='The watchlist is capped at 20 active sources.')
    handle = body.handle.strip().lstrip('@')
    if not handle:
        raise HTTPException(status_code=422, detail='A handle is required.')
    if any(source['handle'].casefold() == handle.casefold() for source in state['sources']):
        raise HTTPException(status_code=409, detail='That handle is already on the watchlist.')
    row = {
        'id': str(uuid5(NAMESPACE_URL, f'telegram:{handle.casefold()}')),
        'handle': handle,
        'displayName': body.displayName or handle,
        'role': body.role,
        'platform': 'Telegram · public',
        'note': body.note or '',
        'isActive': True,
        'sourceHash': '0x' + keccak(f'telegram:{handle}'.encode('utf-8')).hex(),
        'callsTracked': 0,
        'wins': 0,
        'losses': 0,
        'expired': 0,
        'promotionFlags': 0,
        'score': 50.0,
        'origin': 'neutral',
        'latestCall': None,
        'scoreHistory': [],
        'recentCalls': [],
        'flags': [],
    }
    state['sources'].append(row)
    save_operator_state(state)
    return row


@app.patch('/operator/sources/{source_id}')
def patch_source(source_id: str, body: SourcePatch, request: Request):
    require_operator(request)
    state = load_operator_state()
    for source in state['sources']:
        if source['id'] == source_id:
            if body.role is not None:
                if body.role not in ROLES:
                    raise HTTPException(status_code=422, detail='Unknown source role.')
                source['role'] = body.role
            if body.isActive is not None:
                source['isActive'] = body.isActive
            save_operator_state(state)
            return source
    raise HTTPException(status_code=404, detail='No source with that id.')


@app.post('/operator/rules', status_code=201)
def save_rules(body: RulesBody, request: Request):
    require_operator(request)
    state = load_operator_state()
    current = active_ruleset(state)
    version = max(ruleset['version'] for ruleset in state['rulesets']) + 1
    config = {**body.config, 'version': version, 'name': f'refrain-mandate-v{version}'}
    digest = '0x' + hashlib.sha256(
        demo.canonical_json(config).encode('utf-8')).hexdigest()
    for ruleset in state['rulesets']:
        ruleset['active'] = False
    ruleset = {
        'version': version,
        'name': config['name'],
        'hash': digest,
        'config': config,
        'active': True,
        'createdAt': demo.epoch_iso(int(__import__('time').time())),
        'previousHash': current['hash'],
    }
    state['rulesets'].append(ruleset)
    save_operator_state(state)
    return ruleset


@app.post('/operator/runs/verdict')
def request_verdict_run(request: Request):
    require_operator(request)
    raise HTTPException(
        status_code=503,
        detail='The runner host is not connected in the replay deployment. Run the CRE command from the repository.',
    )
