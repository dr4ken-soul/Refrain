"""Read-only API store built from committed CRE fixtures and chain facts.

The fixture set is the two frozen CRE fixtures produced by
`scripts/make_cre_fixtures.py`, the verified Sepolia filings recorded in
`chain_snapshot.json`, the audited watchlist in `seed/sources.json`, the active
ruleset and the committed CRE run index.

Nothing here is synthesized at request time: every number is copied from a
fixture, a seed file, a committed run record or a verified chain read. The
fixture messages are deterministic test data and are not captured Telegram
posts.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from eth_hash.auto import keccak

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / 'cre' / 'fixtures'
RUNS = ROOT / 'cre-runs'
SEED = ROOT / 'seed'

FIXTURE_FILES = {
    'approved': 'verdict-approved.json',
    'rejected': 'verdict-rejected.json',
}

DISPLAY_RULES = {
    'independence_quorum': 'Independent voices',
    'coordination': 'Timing spread inside window',
    'weighted_conviction': 'Weighted conviction',
    'liquidity_floor': 'Liquidity floor',
    'promotion_dominance': 'Promotion veto',
    'price_agreement': 'Price source agreement',
    'size_limits': 'Mandate size limit',
    'exit_terms': 'Stop, target and expiry present',
    'staleness': 'Staleness',
}

EXPLANATIONS = {
    'approved': (
        'Three independent channels reached the same pair inside the seventy-five '
        'minute window, and every mandate rule passed. A paper position was filed '
        'at the fresh consensus entry price.'
    ),
    'rejected': (
        'One channel repeated the same contract three times inside the window. '
        'Repetition is recorded as one opinion, so the threshold was not met.'
    ),
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


ANSI = re.compile(r'\x1b\[[0-9;?]*[A-Za-z]')
LOG_DROP = (
    'uses itself as the env var name',
    'using a distinct env var name',
    'Binary hash:',
    'Config hash:',
    'Encoded verdict payload',
    'Simulation complete!',
    'Run cre account',
    'Simulation limits enabled',
)


def read_run_log(path: Path) -> list[str]:
    """Decode a captured PowerShell run log and keep the workflow narrative.

    Windows PowerShell writes the CRE CLI stream as UTF-16LE and wraps stderr in
    a NativeCommandError preamble. The evidence panel shows the workflow, not
    the shell, so the preamble, ANSI codes, local paths and CLI warnings are
    removed here.
    """
    data = path.read_bytes()
    if data.startswith((b'\xff\xfe', b'\xfe\xff')):
        text = data.decode('utf-16', errors='replace')
    elif b'\x00' in data[:256]:
        text = data.decode('utf-16-le', errors='replace')
    else:
        text = data.decode('utf-8', errors='replace')

    lines = []
    started = False
    for raw in ANSI.sub('', text).splitlines():
        clean = ''.join(ch for ch in raw if '\x20' <= ch <= '\x7e').strip()
        if not clean:
            continue
        if not started:
            started = clean.startswith('2026-') or clean.startswith('Workflow Simulation Result')
            if not started:
                continue
        if any(token in clean for token in LOG_DROP):
            continue
        if 'Secret "' in clean or 'PRIVATE KEY' in clean.upper():
            continue
        lines.append(clean[:200])
    return lines[-70:]



def canonical_json(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


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
            return '0x' + keccak(canonical_json(frozen).encode('utf-8')).hex()
    return None


def epoch_iso(seconds: int) -> str:
    return datetime.fromtimestamp(seconds, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def iso_epoch(value: str) -> int:
    return int(datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp())


def source_labels(bundle):
    ordered = []
    for row in bundle['evidence']['contributingCalls']:
        if row['sourceHash'] not in ordered:
            ordered.append(row['sourceHash'])
    verdict = 'R' if len(ordered) == 1 else ''
    return {
        source_hash: f'Voice {verdict}{index + 1:02d}' if verdict else f'Voice {index + 1:02d}'
        for index, source_hash in enumerate(ordered)
    }


def extract_entry(text: str):
    match = re.search(r'[Ee]ntry\s+([0-9]+(?:\.[0-9]+)?)', text or '')
    return match.group(1) if match else None


def load_replay():
    snapshot = load_json(Path(__file__).with_name('chain_snapshot.json'))
    ruleset = load_json(SEED / 'ruleset-v1.json')
    ruleset_hash = '0x' + hashlib.sha256(canonical_json(ruleset).encode('utf-8')).hexdigest()

    fixtures = {}
    for key, filename in FIXTURE_FILES.items():
        path = FIXTURES / filename
        if path.exists():
            fixtures[key] = load_json(path)

    cases = []
    calls = []
    for key, fixture in fixtures.items():
        bundle = fixture['bundle']
        evaluation = fixture['evaluation']
        labels = source_labels(bundle)
        chain = snapshot.get(key) or {}
        posts_by_message = {
            (post['sourceHash'], post['messageId']): post
            for post in bundle['evidence']['posts']
        }
        promotion_by_message = {
            (row['sourceHash'], row['messageId']): row
            for row in bundle['evidence'].get('promotion', [])
        }

        contributions = []
        case_posts = []
        for row in bundle['evidence']['contributingCalls']:
            post = posts_by_message.get((row['sourceHash'], row['messageId']), {})
            promotion = promotion_by_message.get((row['sourceHash'], row['messageId']), {})
            call = {
                'id': row['callId'],
                'eventId': bundle['eventId'],
                'timestamp': row['timestamp'],
                'sourceHash': row['sourceHash'],
                'sourceLabel': labels.get(row['sourceHash'], 'Voice'),
                'assetKey': bundle['asset'].get('assetKey'),
                'ticker': bundle['asset'].get('ticker'),
                'direction': row['direction'],
                'entryPrice': extract_entry(post.get('text', '')),
                'stopPrice': (bundle.get('proposedTerms') or {}).get('stopPrice'),
                'targetPrice': (bundle.get('proposedTerms') or {}).get('targetPrice'),
                'conviction': row['conviction'],
                'urgency': None,
                'parser': 'structured',
                'isAdvertisement': bool(promotion.get('isAdvertisement')),
                'filterReason': promotion.get('filterReason'),
                'duplicateOf': None,
                'narrativeTags': row.get('narrativeTags') or [],
                'span': row.get('span'),
                'excerpt': post.get('text', ''),
                'contentHash': post.get('contentHash'),
                'urls': post.get('urls') or [],
                'sourceUrl': None,
                'callHash': call_hash_for(bundle, row['callId']),
            }
            calls.append(call)
            contributions.append({
                'callId': row['callId'],
                'sourceHash': row['sourceHash'],
                'sourceLabel': labels.get(row['sourceHash'], 'Voice'),
                'callHash': call['callHash'],
                'conviction': row['conviction'],
                'timestamp': row['timestamp'],
                'messageId': row['messageId'],
                'direction': row['direction'],
                'narrativeTags': row.get('narrativeTags') or [],
                'span': row.get('span'),
                'sourceUrl': None,
            })
            case_posts.append(call)

        rule_results = []
        for result in evaluation.get('rule_results', []):
            rule_results.append({
                'rule': result['rule'],
                'displayName': DISPLAY_RULES.get(result['rule'], result['rule']),
                'pass': bool(result['pass']),
                'evidence': result['evidence'],
            })

        position = None
        if chain.get('position'):
            raw = chain['position']
            position = {
                'positionId': raw['positionId'],
                'caseHash': raw['caseHash'],
                'status': 'settled' if raw['settled'] else 'open',
                'direction': 'long' if raw['direction'] == 0 else 'short',
                'entryPrice': f"{int(raw['entryPrice1e8']) / 1e8:.8f}".rstrip('0').rstrip('.'),
                'stopPrice': f"{int(raw['stopPrice1e8']) / 1e8:.8f}".rstrip('0').rstrip('.'),
                'targetPrice': f"{int(raw['targetPrice1e8']) / 1e8:.8f}".rstrip('0').rstrip('.'),
                'sizeUsdCents': int(raw['sizeUnitsCents']),
                'sizeUsd': int(raw['sizeUnitsCents']) / 100,
                'openedAt': epoch_iso(raw['openedAt']),
                'expiresAt': epoch_iso(raw['expiresAt']),
                'exitPrice': None,
                'exitReason': None,
                'pnlUnits': None,
                'contributorsCommit': raw['contributorsCommit'],
                'openTxHash': chain.get('verdictTx'),
                'settleTxHash': None,
            }

        cases.append({
            'eventId': bundle['eventId'],
            'caseKind': bundle.get('caseKind', 'convergence'),
            'asset': bundle['asset'],
            'level': 'asset',
            'window': bundle.get('window'),
            'windowHours': ruleset['windows']['contractAssetHours']
            if bundle.get('caseKind') != 'listed_pair'
            else ruleset['windows']['listedPairHours'],
            'evaluatedAt': bundle.get('evaluatedAt'),
            'independentVoiceCount': bundle.get('independentVoiceCount'),
            'timingSpreadSeconds': bundle.get('timingSpreadSeconds'),
            'weightedConviction': bundle.get('weightedConviction'),
            'bundleHash': bundle.get('bundleHash'),
            'rulesetHash': bundle.get('rulesetHash'),
            'rulesetVersion': bundle.get('rulesetVersion'),
            'decision': evaluation.get('decision'),
            'reasonCode': evaluation.get('reason_code'),
            'ruleResults': rule_results,
            'explanation': EXPLANATIONS['approved' if evaluation.get('decision') == 'approved' else 'rejected'],
            'contributions': contributions,
            'posts': case_posts,
            'terms': bundle.get('proposedTerms'),
            'pricePlan': bundle.get('pricePlan'),
            'entryObservations': bundle.get('evidence', {}).get('entryObservations', []),
            'liquidity': bundle.get('evidence', {}).get('liquidity', []),
            'reliability': bundle.get('evidence', {}).get('reliability', []),
            'position': position,
            'filing': {
                'txHash': chain.get('verdictTx'),
                'block': chain.get('verdictBlock'),
                'filedAt': chain.get('verdictTime'),
                'scheduledAt': epoch_iso(chain['scheduledAt']) if chain.get('scheduledAt') else None,
            },
            'settlement': None,
            'scoreEffects': [],
            'replay': {
                'bundleHash': bundle.get('bundleHash'),
                'rulesetHash': bundle.get('rulesetHash'),
                'rulesetVersion': bundle.get('rulesetVersion'),
                'caseHash': chain.get('caseHash'),
                'verdictTx': chain.get('verdictTx'),
                'settlementTx': None,
            },
            'bundle': bundle,
        })

    calls.sort(key=lambda row: row['timestamp'], reverse=True)
    cases.sort(key=lambda row: row['window']['closedAt'], reverse=True)
    newest = max((row['timestamp'] for row in calls), default=None)
    featured = next((case for case in cases if case['decision'] == 'approved' and case.get('position')), None)
    if featured is None:
        featured = next((case for case in cases if case['decision'] == 'approved'), cases[0] if cases else None)
    latest_verdict = max(
        (case for case in cases if case.get('filing', {}).get('scheduledAt')),
        key=lambda case: case['filing']['scheduledAt'],
        default=None,
    )

    sources = []
    for row in load_json(SEED / 'sources.json'):
        handle = row['handle']
        source_hash = '0x' + keccak(f'telegram:{handle}'.encode('utf-8')).hex()
        sources.append({
            'id': str(uuid5(NAMESPACE_URL, f'telegram:{handle.casefold()}')),
            'handle': handle,
            'displayName': row['display_name'],
            'role': row['role'],
            'platform': 'Telegram · public',
            'isActive': True,
            'sourceHash': source_hash,
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
        })

    runs = []
    index_path = RUNS / 'index.json'
    if index_path.exists():
        for run in load_json(index_path):
            log_path = ROOT / str(run.get('log', '')).replace('\\', '/')
            lines = []
            if log_path.exists():
                lines = read_run_log(log_path)
            runs.append({**run, 'logLines': lines})
    runs.sort(key=lambda row: row['recordedAt'], reverse=True)

    return {
        'generatedAt': datetime.now(tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'newestIngestAt': newest,
        'replay': {
            'mode': 'replay',
            'label': 'CRE fixture replay',
            'newestIngestAt': newest,
            'staleAfterMinutes': 15,
            'reason': 'These deterministic CRE fixtures exercise the workflows. They are not captured Telegram posts.',
            'replaySet': 'cre-fixture-2026-10-30',
        },
        'chain': {
            'chainId': snapshot['chainId'],
            'chainName': snapshot['chainName'],
            'ledger': snapshot['ledger'],
            'deployer': snapshot['deployer'],
            'explorer': f"https://eth-sepolia.blockscout.com/address/{snapshot['ledger']}",
        },
        'cases': cases,
        'calls': calls,
        'sources': sources,
        'runs': runs,
        'ruleset': {
            'version': ruleset['version'],
            'name': ruleset['name'],
            'hash': ruleset_hash,
            'config': ruleset,
            'active': True,
            'createdAt': '2026-10-28T00:00:00Z',
        },
        'featuredEventId': featured['eventId'] if featured else None,
        'latestVerdictEventId': latest_verdict['eventId'] if latest_verdict else None,
    }


def position_for(case):
    return case.get('position')


def metrics(store):
    return {
        'callsParsed': len(store['calls']),
        'convergenceEvents': len(store['cases']),
        'paperPositionsOpened': sum(1 for case in store['cases'] if case.get('position')),
        'tradesRejected': sum(1 for case in store['cases'] if case['decision'] == 'rejected'),
        'positionsSettled': sum(
            1 for case in store['cases']
            if case.get('position') and case['position'].get('status') == 'settled'
        ),
    }


def source_rows(store):
    rows = []
    for source in store['sources']:
        source_calls = [call for call in store['calls'] if call['sourceHash'] == source['sourceHash']]
        if source_calls:
            source = {**source, 'callsTracked': len(source_calls)}
            source['latestCall'] = source_calls[0]['timestamp']
            source['recentCalls'] = source_calls[:6]
        rows.append(source)
    return rows


def board(store):
    return {
        'mode': store['replay']['mode'],
        'label': store['replay']['label'],
        'newestIngestAt': store['newestIngestAt'],
        'updatedAt': store['newestIngestAt'],
        'channelsMonitored': len(store['sources']),
        'callsParsed': len(store['calls']),
        'realFundsAtRisk': 0,
        'latestCalls': store['calls'][:5],
        'featuredEventId': store['featuredEventId'],
        'latestVerdictEventId': store['latestVerdictEventId'],
        'counts': metrics(store),
        'chain': store['chain'],
    }


def public_case(case):
    return {key: value for key, value in case.items() if key != 'bundle'}


def case_detail(store, event_id):
    for case in store['cases']:
        if case['eventId'] == event_id:
            return {
                'event': public_case(case),
                'bundle': case['bundle'],
                'run': next((run for run in store['runs'] if run.get('eventId') == event_id), None),
            }
    return None
