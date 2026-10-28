"""Pipeline runner: extract, converge, evaluate, persist. Paper records only.

One pass walks every unclassified captured post through the deterministic
parsers and the language-model extractor, then evaluates every candidate
window whose horizon has passed and whose case is not already frozen. Each
case is evaluated once: the market observations recorded at evaluation time
stay frozen inside the bundle, so re-running the pass changes nothing.

In replay mode the reference clock is the newest captured post time and each
case is evaluated at the moment its own window horizon passed, so the replay
import reproduces the recorded verdicts without wall-clock staleness.
"""
import argparse
import asyncio
import logging
import os
import selectors
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

from dotenv import dotenv_values

from api.repository import Repository, deterministic_call_id, deterministic_case_id
from parsers import classify_post
from parsers.llm import EXTRACTION_VERSION, Extractor, validate_extraction
from shared_types.canonical import parse_timestamp, timestamp

from .bundle import build_bundle
from .convergence import build_candidate_events, apply_independence
from .explain import build_explanation, deterministic_fallback
from .market import observe_asset, observe_pair
from .rules import evaluate_bundle

ROOT = Path(__file__).resolve().parents[2]
LOG = logging.getLogger('refrain.pipeline')

# Staleness allows 7 days after window close, and a contract window can close
# up to 24 hours after its first call, so look back 8 days plus one spare.
LOOKBACK_DAYS = 8


@dataclass(frozen=True)
class PipelineSettings:
    database_url: str
    llm_base_url: str
    llm_api_key: str
    llm_model: str
    price_fetch_timeout_seconds: float

    @classmethod
    def load(cls):
        values = {**dotenv_values(ROOT / '.env', interpolate=False), **os.environ}
        database_url = str(values.get('DATABASE_URL') or '')
        if not database_url.startswith(('postgresql://', 'postgres://')):
            raise ValueError('Set DATABASE_URL to the private PostgreSQL connection string.')
        return cls(
            database_url=database_url,
            llm_base_url=str(values.get('LLM_BASE_URL') or ''),
            llm_api_key=str(values.get('LLM_API_KEY') or ''),
            llm_model=str(values.get('LLM_MODEL') or ''),
            price_fetch_timeout_seconds=float(values.get('PRICE_FETCH_TIMEOUT_SECONDS') or 10),
        )


def _decimal_text(value):
    """Fixed decimal string, or None. Never a float in canonical bytes."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        return format(value, 'f')
    return str(value)


def _normalize_call_row(row):
    row['id'] = str(row['id'])
    row['source_id'] = str(row['source_id'])
    row['posted_at'] = timestamp(row['posted_at'])
    row['edited_at'] = timestamp(row['edited_at']) if row['edited_at'] else None
    for field in ('entry_price', 'stop_price', 'target_price'):
        row[field] = _decimal_text(row[field])
    row['targets'] = list(row['targets'] or [])
    row['narrative_tags'] = list(row['narrative_tags'] or [])
    row['post_urls'] = list(row['post_urls'] or [])
    row['referral_markers'] = list(row['referral_markers'] or [])
    return row


def _normalize_post_row(row):
    row['source_id'] = str(row['source_id'])
    row['posted_at'] = timestamp(row['posted_at'])
    row['edited_at'] = timestamp(row['edited_at']) if row['edited_at'] else None
    row['urls'] = list(row['urls'] or [])
    row['referral_markers'] = list(row['referral_markers'] or [])
    return row


async def extraction_pass(repository, extractor, limit):
    """Classify every uncaptured post once. Transient model failures retry later."""
    counts = {'posts': 0, 'calls': 0, 'exits': 0, 'exit_links': 0,
              'advertisements': 0, 'skips': 0, 'residue_llm': 0,
              'llm_discards': 0, 'llm_pending': 0}
    posts = await repository.unclassified_posts(EXTRACTION_VERSION, limit)
    for post in posts:
        post['extraction_version'] = EXTRACTION_VERSION
        result = classify_post(post)
        calls = list(result['calls'])
        if result['residue']:
            if not extractor:
                counts['llm_pending'] += 1
                continue
            cache_key = extractor.cache_key(post['text'])
            cached = await repository.llm_cache_get(cache_key)
            if cached is None:
                raw = await extractor.fetch_live(post['text'])
                if raw is None:
                    counts['llm_pending'] += 1
                    continue
                await repository.llm_cache_put(cache_key, raw, extractor.model)
            else:
                raw = cached
            mentions = validate_extraction(raw, post['text'])
            if mentions is None:
                counts['llm_discards'] += 1
            else:
                calls.extend(mentions)
                counts['residue_llm'] += len(mentions)
        for call in calls:
            for field in ('entry_price', 'stop_price', 'target_price'):
                value = call.get(field)
                if value is not None and not isinstance(value, Decimal):
                    try:
                        call[field] = Decimal(value)
                    except InvalidOperation:
                        call[field] = None
        await repository.store_classifications(
            post, calls, result['referral_markers'], result['scheduled_call'], result['skip'])
        counts['posts'] += 1
        counts['calls'] += len([call for call in calls if call['direction'] != 'close'])
        counts['exits'] += len([call for call in calls if call['direction'] == 'close'])
        if result['skip'] and result['skip'].is_advertisement:
            counts['advertisements'] += 1
        elif result['skip']:
            counts['skips'] += 1
        for call in calls:
            if call['direction'] != 'close':
                continue
            exit_id = deterministic_call_id(
                post['source_id'], post['telegram_message_id'],
                call.get('span_start'), call.get('span_end'))
            target_id = await repository.latest_call_before(
                post['source_id'], call['asset_key'],
                post['posted_at'], post['telegram_message_id'])
            await repository.link_exit_to_call(exit_id, target_id)
            counts['exit_links'] += 1 if target_id else 0
    return counts


def window_hours(event, ruleset):
    if event.get('level') == 'narrative':
        return ruleset['windows']['contractAssetHours']
    asset_key = event.get('asset_key') or ''
    if asset_key.startswith(('solana:', 'evm:')):
        return ruleset['windows']['contractAssetHours']
    return ruleset['windows']['listedPairHours']


def _sorted_rows(rows):
    return sorted(rows, key=lambda row: (row.get('assetKey') or '', row['kind'],
                                         row.get('locator') or ''))


async def record_observations(asset_keys, timeout):
    """Recorded market inputs per asset family, best effort, never invented.

    Contract assets record liquidity and entry observations from both
    recorded sources, and record an unavailable observation when a source
    yields nothing. Listed pairs record entry prices only; their liquidity
    rule is exempt. Narrative events observe every distinct contract asset.
    """
    liquidity, entry = [], []
    for asset_key in sorted({key for key in asset_keys if key}):
        if asset_key.startswith('cex:'):
            rows = await observe_pair(asset_key.split(':', 1)[1], timeout)
            entry.extend(dict(row, assetKey=asset_key) for row in rows)
        elif asset_key.startswith(('solana:', 'evm:')):
            rows = await observe_asset(asset_key, timeout)
            tagged = [dict(row, assetKey=asset_key) for row in rows]
            liquidity.extend(tagged)
            entry.extend(row for row in tagged if row.get('price') is not None)
            if not rows:
                liquidity.append({
                    'kind': 'unavailable', 'locator': asset_key,
                    'observedAt': timestamp(datetime.now(timezone.utc)),
                    'liquidityUsdCents': None, 'price': None,
                    'assetKey': asset_key,
                })
    return _sorted_rows(liquidity), _sorted_rows(entry)


async def evaluation_pass(repository, ruleset, replay, explain, extractor, timeout):
    """Evaluate every closed, not-yet-frozen candidate window exactly once."""
    reliability = await repository.reliability_map()
    reference = await repository.max_posted_at() if replay else datetime.now(timezone.utc)
    summary = {'candidates': 0, 'still_open': 0, 'already_frozen': 0,
               'evaluated': 0, 'approved': 0, 'rejected': 0, 'deferred': 0,
               'reason_codes': {}}
    if reference is None:
        return summary
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=timezone.utc)
    calls = await repository.eligible_calls(reference - timedelta(days=LOOKBACK_DAYS))
    calls = [_normalize_call_row(row) for row in calls]
    events = build_candidate_events(calls, ruleset)
    existing = await repository.existing_event_ids()
    for event in events:
        summary['candidates'] += 1
        horizon = parse_timestamp(event['window_started_at']) + timedelta(
            hours=window_hours(event, ruleset))
        if horizon > reference:
            summary['still_open'] += 1
            continue
        event_id = deterministic_case_id(
            event.get('case_kind', 'convergence'), event.get('asset_key'),
            event.get('narrative_key'), event['window_started_at'])
        if event_id in existing:
            summary['already_frozen'] += 1
            continue
        started_at = event['window_started_at']
        source_ids = sorted({call['source_id'] for call in event['calls']})
        event['posts'] = await repository.window_posts(source_ids, started_at, timestamp(horizon))
        event['posts'] = [_normalize_post_row(row) for row in event['posts']]
        asset_keys = [event.get('asset_key')] if event.get('asset_key') else \
            [call['asset_key'] for call in event['calls']]
        liquidity, entry = await record_observations(asset_keys, timeout)
        evaluated_at = timestamp(horizon) if replay else timestamp(reference)
        independence = apply_independence(event, reliability)
        bundle = build_bundle(event, independence, ruleset, reliability,
                              liquidity, entry, evaluated_at)
        evaluation = evaluate_bundle(bundle)
        if explain and extractor:
            explanation = await build_explanation(
                bundle, evaluation['decision'], evaluation['reason_code'],
                evaluation['rule_results'], extractor)
        else:
            explanation = deterministic_fallback(
                bundle, evaluation['decision'], evaluation['reason_code'])
        await repository.save_case(bundle, independence, evaluation, explanation, ruleset)
        summary['evaluated'] += 1
        summary[evaluation['decision']] += 1
        code = evaluation['reason_code'] or 'None'
        summary['reason_codes'][code] = summary['reason_codes'].get(code, 0) + 1
    return summary


async def run(settings, replay=False, limit=500, explain=True):
    repository = await Repository.open(settings)
    try:
        ruleset_row = await repository.active_ruleset()
        if not ruleset_row:
            raise RuntimeError('No active ruleset. Run python -m seed.load_seed first.')
        ruleset = dict(ruleset_row['config'])
        ruleset['ruleset_hash'] = ruleset_row['ruleset_hash']
        extractor = None
        if settings.llm_base_url and settings.llm_api_key and settings.llm_model:
            extractor = Extractor(settings)
        extraction = await extraction_pass(repository, extractor, limit)
        evaluation = await evaluation_pass(
            repository, ruleset, replay=replay,
            explain=explain and extractor is not None, extractor=extractor,
            timeout=settings.price_fetch_timeout_seconds)
        return extraction, evaluation
    finally:
        await repository.close()


def make_event_loop():
    return asyncio.SelectorEventLoop(selectors.SelectSelector())


def parser():
    cli = argparse.ArgumentParser(
        description='Refrain extraction and evaluation pipeline. Paper records only.')
    cli.add_argument('--replay', action='store_true',
                     help='Evaluate against the replay clock of the captured record.')
    cli.add_argument('--limit', type=int, default=500,
                     help='Maximum posts classified in this pass.')
    cli.add_argument('--no-explain', action='store_true',
                     help='Use the deterministic explanation instead of the model.')
    return cli


def main(argv=None):
    args = parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    try:
        extraction, evaluation = asyncio.run(
            run(PipelineSettings.load(), replay=args.replay,
                limit=args.limit, explain=not args.no_explain),
            loop_factory=make_event_loop)
    except (ValueError, RuntimeError) as error:
        print(f'Cannot continue: {error}', file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('Stopped safely. Completed writes were preserved.')
        return 130
    print(f"Extraction: {extraction['posts']} posts classified, "
          f"{extraction['calls']} calls, {extraction['exits']} exit events, "
          f"{extraction['exit_links']} exit links, "
          f"{extraction['advertisements']} advertisements, "
          f"{extraction['skips']} skips, "
          f"{extraction['residue_llm']} model mentions, "
          f"{extraction['llm_discards']} model outputs discarded, "
          f"{extraction['llm_pending']} left for a later pass.")
    print(f"Evaluation: {evaluation['candidates']} candidates, "
          f"{evaluation['still_open']} still open, "
          f"{evaluation['already_frozen']} already frozen, "
          f"{evaluation['evaluated']} evaluated: "
          f"{evaluation['approved']} approved, {evaluation['rejected']} rejected, "
          f"{evaluation['deferred']} deferred.")
    for code, count in sorted(evaluation['reason_codes'].items()):
        print(f"  {code}: {count}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
