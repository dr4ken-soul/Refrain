"""Constrained explainer. The model may only restate supplied rule results.

It receives rule results and bundle facts, writes a short plain-language
explanation, and every number it writes must appear in the supplied facts.
If the model fails or adds facts, a deterministic fallback restates the
decision from the rule results alone.
"""
import json
import logging
import re

import httpx

EXPLAINER_PROMPT = (
    'You explain evidence-agent verdicts in plain operational language. '
    'You receive the frozen bundle facts and the ordered rule results. Write two to '
    'three short sentences. Use only the supplied facts. Do not add facts, prices, '
    'names or recommendations. Every number you write must appear in the supplied '
    'input. Do not imply the verdict predicts anything.'
)

LOG = logging.getLogger('refrain.explain')
_NUMBER_RE = re.compile(r'\d+(?:\.\d+)?')


def deterministic_fallback(bundle, decision, reason_code):
    asset = bundle['asset'].get('assetKey') or bundle.get('narrativeKey') or 'unknown asset'
    voices = len([voice for voice in bundle['voices'] if not voice['copied']])
    window_hours = None
    started = bundle['window']['startedAt'][:10]
    closed = bundle['window']['closedAt'][:10]
    text = (f'Case {bundle["eventId"][:8]} on {asset} counted {voices} independent '
            f'voices between {started} and {closed}.')
    if decision == 'approved':
        terms = bundle['proposedTerms']
        text += (f' The mandate approved a paper position with the fixed terms of entry, '
                 f'stop {terms.get("stopPrice") or terms.get("stopBps")}, '
                 f'target {terms.get("targetPrice") or terms.get("targetBps")} and expiry {terms.get("expiresAt")}.')
    else:
        text += f' The mandate filed {decision} with reason code {reason_code}.'
    return text


async def build_explanation(bundle, decision, reason_code, rule_results, extractor):
    facts = {
        'eventId': bundle['eventId'],
        'caseKind': bundle['caseKind'],
        'asset': bundle['asset'],
        'narrativeKey': bundle['narrativeKey'],
        'window': bundle['window'],
        'voiceCount': len([voice for voice in bundle['voices'] if not voice['copied']]),
        'weightedConviction': bundle.get('weightedConviction'),
        'proposedTerms': bundle['proposedTerms'],
        'ruleResults': rule_results,
        'decision': decision,
        'reasonCode': reason_code,
    }
    facts_json = json.dumps(facts, sort_keys=True)
    try:
        async with httpx.AsyncClient(timeout=extractor.timeout + 10) as client:
            response = await client.post(
                extractor.base_url + '/chat/completions',
                headers={'Authorization': 'Bearer ' + extractor.api_key},
                json={
                    'model': extractor.model,
                    'temperature': 0,
                    'max_tokens': 512,
                    'messages': [
                        {'role': 'system', 'content': EXPLAINER_PROMPT},
                        {'role': 'user', 'content': facts_json},
                    ],
                },
            )
        if response.status_code == 200:
            text = response.json()['choices'][0]['message']['content'].strip()
            if _numbers_known(text, facts_json):
                return text
    except Exception as error:
        LOG.warning('Explainer failed (%s). Deterministic fallback used.', type(error).__name__)
    return deterministic_fallback(bundle, decision, reason_code)


def _numbers_known(text, facts_json):
    """Every number in the explanation must appear in the supplied facts."""
    for number in _NUMBER_RE.findall(text):
        if number not in facts_json:
            return False
    return True
