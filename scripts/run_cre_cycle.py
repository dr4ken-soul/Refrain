"""Run one CRE verdict and settlement pass without exposing the root .env."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import dotenv_values


def repository_root() -> Path:
    if os.name == 'nt':
        junction = Path('C:/refrain')
        if (junction / 'cre' / 'project.yaml').exists():
            return junction
    current = Path.cwd()
    if current.name.casefold() == 'cre' and (current / 'project.yaml').exists():
        return current.parent
    if (current / 'cre' / 'project.yaml').exists():
        return current
    script_root = Path(__file__).absolute().parent.parent
    if (script_root / 'cre' / 'project.yaml').exists():
        return script_root
    raise RuntimeError('Run this script from the Refrain repository or its cre directory.')


def read_environment(root: Path) -> dict[str, str]:
    path = root / '.env'
    if not path.is_file():
        raise RuntimeError('The repository-root .env file is missing.')
    values = {key: str(value) for key, value in dotenv_values(path, interpolate=False).items() if value is not None}
    environment = os.environ.copy()
    environment.update(values)
    if not environment.get('CRE_BEARER_SECRET'):
        raise RuntimeError('CRE_BEARER_SECRET is not configured in the root .env file.')
    return environment


def api_get(base_url: str, path: str, bearer: str) -> dict:
    request = urllib.request.Request(
        base_url.rstrip('/') + path,
        headers={'Authorization': f'Bearer {bearer}', 'Accept': 'application/json'},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'API returned HTTP {error.code} for {path}.') from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise RuntimeError(f'API request failed for {path}.') from None


def chain_id_is_sepolia(rpc_url: str) -> bool:
    payload = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'eth_chainId', 'params': []}).encode()
    request = urllib.request.Request(rpc_url, data=payload, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            result = json.loads(response.read().decode('utf-8')).get('result')
        return str(result).lower() == '0xaa36a7'
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return False


def filed_case_hashes(snapshot: dict) -> set[str]:
    return {
        str(record.get('caseHash')).lower()
        for key, record in snapshot.items()
        if key in {'approved', 'rejected'} and record.get('verdictTx') and record.get('caseHash')
    }


def safe_log(text: str, environment: dict[str, str]) -> str:
    def is_sensitive(name: str, value: str) -> bool:
        upper_name = name.upper()
        sensitive_name = any(
            marker in upper_name
            for marker in ('KEY', 'SECRET', 'PASSWORD', 'HASH', 'TOKEN', 'DATABASE_URL')
        )
        sensitive_url = upper_name.endswith('_URL') and len(value) >= 16
        return sensitive_name or sensitive_url

    for key, value in sorted(environment.items(), key=lambda item: len(item[1]), reverse=True):
        if value and len(value) >= 4 and is_sensitive(key, value):
            text = text.replace(value, '[redacted]')
    text = re.sub(
        r'(?im)^\s*[A-Z][A-Z0-9_]*(?:KEY|SECRET|PASSWORD|HASH|DATABASE_URL)[A-Z0-9_]*\s*=.*$',
        '[redacted environment setting]',
        text,
    )
    text = text.replace(chr(0x2014), '-')
    text = re.sub(r'(?i)0x[0-9a-f]{64}', lambda match: match.group(0), text)
    return text


def transaction_hash(text: str) -> str | None:
    candidates = []
    for line in text.splitlines():
        if re.search(r'(?i)transaction|tx\s*hash|txhash|transactionid|\btx\s*[:=]', line):
            candidates.extend(re.findall(r'0x[0-9a-fA-F]{64}', line))
    return candidates[-1] if candidates else None


def write_run_index(root: Path, record: dict) -> None:
    path = root / 'cre-runs' / 'index.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = json.loads(path.read_text(encoding='utf-8')) if path.exists() else []
    rows.append(record)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    temporary.replace(path)


def settlement_broadcast_allowed(requested: bool, position_id: int, bundle: dict, now: datetime | None = None) -> bool:
    if not requested or position_id != 1:
        return requested
    expiry = (bundle.get('proposedTerms') or {}).get('expiresAt')
    if not expiry:
        return requested
    expiry_time = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
    return (now or datetime.now(timezone.utc)) >= expiry_time

def run_workflow(
    root: Path,
    workflow: str,
    environment: dict[str, str],
    broadcast: bool,
    *,
    event_id: str | None = None,
    position_id: int | None = None,
    bundle: dict | None = None,
) -> tuple[int, dict]:
    now = datetime.now(timezone.utc)
    run_id = f"{now.strftime('%Y%m%dT%H%M%SZ')}-{workflow}-{uuid.uuid4().hex[:8]}"
    relative_directory = Path('cre-runs') / now.strftime('%Y-%m-%d') / run_id
    run_directory = root / relative_directory
    run_directory.mkdir(parents=True, exist_ok=False)
    bundle_path = None
    bundle_hash = None
    if bundle is not None:
        bundle_hash = bundle.get('bundleHash')
        bundle_path = relative_directory / 'bundle.json'
        (root / bundle_path).write_text(
            json.dumps(bundle, indent=2, ensure_ascii=False) + '\n', encoding='utf-8'
        )

    command = [
        'cre', 'workflow', 'simulate', f'./{workflow}',
        '-T', 'staging-settings', '--non-interactive', '--trigger-index', '0',
    ]
    if broadcast:
        command.append('--broadcast')
    run_environment = environment.copy()
    if event_id:
        run_environment['REFRAIN_CRE_EVENT_ID'] = event_id
    if position_id is not None:
        run_environment['REFRAIN_CRE_POSITION_ID'] = str(position_id)

    started = datetime.now(timezone.utc)
    try:
        result = subprocess.run(
            command,
            cwd=root / 'cre',
            env=run_environment,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=900,
            check=False,
        )
        output = (result.stdout or '') + (result.stderr or '')
        output = safe_log(output, environment)
        exit_code = result.returncode
    except (OSError, subprocess.TimeoutExpired) as error:
        output = f'CRE workflow failed to start or timed out ({type(error).__name__}).\n'
        exit_code = 1

    mode = 'broadcast' if broadcast else 'dry-run'
    log_text = (
        f"Refrain {workflow} {mode}\n"
        f"Started: {started.strftime('%Y-%m-%dT%H:%M:%SZ')}\n"
        f"Command: cre workflow simulate ./{workflow} -T staging-settings --non-interactive --trigger-index 0"
        f"{' --broadcast' if broadcast else ''}\n\n"
        f'{output.rstrip()}\nExit code: {exit_code}\n'
    )
    log_path = relative_directory / 'simulation.log'
    (root / log_path).write_text(log_text, encoding='utf-8')
    tx_hash = transaction_hash(output)
    if tx_hash:
        (root / relative_directory / 'tx.txt').write_text(tx_hash + '\n', encoding='utf-8')

    record = {
        'runId': run_id,
        'workflow': workflow,
        'mode': mode,
        'outcome': 'success' if exit_code == 0 and tx_hash else 'no-op' if exit_code == 0 else 'failed',
        'decision': None,
        'reasonCode': None,
        'recordedAt': started.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'eventId': event_id,
        'positionId': position_id,
        'bundleHash': bundle_hash,
        'txHash': tx_hash,
        'block': None,
        'log': log_path.as_posix(),
        'bundlePath': bundle_path.as_posix() if bundle_path else None,
        'status': 'success' if exit_code == 0 and tx_hash else 'no-op' if exit_code == 0 else 'failed',
    }
    write_run_index(root, record)
    print(f"{workflow}: {record['status']}; log {log_path.as_posix()}")
    if tx_hash:
        print(f'Transaction recorded: {tx_hash}')
    return exit_code, record


def run_cycle(root: Path, environment: dict[str, str], broadcast: bool) -> int:
    cre_dir = root / 'cre'
    if os.name == 'nt' and ' ' in str(cre_dir):
        raise RuntimeError('Use the C:\\refrain junction and run from there so the CRE compiler path has no spaces.')
    if not shutil.which('cre'):
        raise RuntimeError('The CRE CLI is not available on PATH.')

    base_url = environment.get('API_BASE_URL') or 'http://127.0.0.1:8000'
    bearer = environment['CRE_BEARER_SECRET']
    snapshot_path = root / 'apps' / 'api' / 'api' / 'chain_snapshot.json'
    snapshot = json.loads(snapshot_path.read_text(encoding='utf-8'))
    completed = filed_case_hashes(snapshot)
    error_count = 0

    candidates = api_get(base_url, '/cre/pending-verdicts', bearer).get('candidates', [])
    candidate = next(
        (item for item in sorted(candidates, key=lambda item: item.get('windowClosedAt', ''))
         if str(item.get('caseHash', '')).lower() not in completed),
        None,
    )
    if candidate:
        bundle = api_get(base_url, f"/cre/events/{candidate['eventId']}/bundle", bearer)
        if bundle.get('bundleHash') != candidate.get('caseHash'):
            raise RuntimeError('The pending bundle hash did not match its candidate record.')
        code, _ = run_workflow(
            root, 'verdict', environment, broadcast,
            event_id=candidate['eventId'], bundle=bundle,
        )
        error_count += code != 0
    else:
        print('Verdict pass skipped: no unfiled candidate is available.')

    positions = api_get(base_url, '/cre/due-positions', bearer).get('positions', [])
    known_positions = {
        int(record['position']['positionId']): bool(record['position'].get('settled'))
        for key, record in snapshot.items()
        if key == 'approved' and record.get('position')
    }
    open_position = next(
        (item for item in positions if not known_positions.get(int(item['positionId']), False)),
        None,
    )
    if open_position:
        bundle = api_get(
            base_url, f"/cre/events/{open_position['eventId']}/bundle", bearer
        )
        position_id = int(open_position['positionId'])
        settle_broadcast = settlement_broadcast_allowed(broadcast, position_id, bundle)
        if broadcast and not settle_broadcast:
            print('Settlement broadcast held until position 1 expires. Running a dry check.')
        code, _ = run_workflow(
            root, 'settlement', environment, settle_broadcast,
            event_id=open_position.get('eventId'),
            position_id=position_id,
            bundle=bundle,
        )
        error_count += code != 0
    else:
        print('Settlement pass skipped: no open position is available.')
    return 1 if error_count else 0


def main() -> int:
    parser = argparse.ArgumentParser(description='Run one safe Refrain CRE cycle and archive its evidence.')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--broadcast', action='store_true', help='Allow CRE to broadcast reports to Sepolia.')
    mode.add_argument('--dry-run', action='store_true', help='Simulate without broadcasting. This is the default.')
    parser.add_argument('--interval-minutes', type=int, default=0, help='Repeat on this interval. Omit for one pass.')
    args = parser.parse_args()
    if args.interval_minutes < 0:
        parser.error('--interval-minutes must be zero or greater.')

    try:
        root = repository_root()
        environment = read_environment(root)
        if args.broadcast:
            rpc_url = environment.get('SEPOLIA_RPC_URL', '')
            if not rpc_url or not chain_id_is_sepolia(rpc_url):
                raise RuntimeError('The configured RPC did not confirm Sepolia chain ID 11155111.')
        while True:
            status = run_cycle(root, environment, args.broadcast)
            if args.interval_minutes == 0:
                return status
            time.sleep(args.interval_minutes * 60)
    except KeyboardInterrupt:
        print('\nCRE runner stopped. Existing run files were preserved.')
        return 130
    except RuntimeError as error:
        print(f'Cannot run CRE cycle: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
