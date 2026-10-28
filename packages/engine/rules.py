"""Fixed public ruleset evaluator. Every decision names its rule.

Reason codes come only from the fixed list. Rejected and deferred cases are
filed beside approvals. The evaluator reads the frozen bundle only; no rule
touches mutable database state.
"""
from datetime import timedelta

from shared_types.canonical import parse_timestamp

REASON_CODES = [
    'QUORUM_NOT_MET', 'SINGLE_VOICE_REPETITION', 'COPIED_EVIDENCE', 'COORDINATED_PUMP',
    'PROMOTION_VETO', 'LIQUIDITY_FLOOR', 'PRICE_DISAGREEMENT', 'MANDATE_SIZE',
    'MISSING_EXIT_TERMS', 'STALE_EVIDENCE',
]
DIRECTION_CODES = {'long': 0, 'short': 1, 'spot_buy': 2}

STALE_AFTER_DAYS = 7


def evaluate_bundle(bundle):
    """Return {decision, reason_code, rule_results}. rule_results keep fixed order.

    An individual_call case records one call from one source. SPEC_RESOLUTIONS.md
    requires its agreement rules to be marked not applicable instead of passed.
    """
    individual = bundle.get('caseKind') == 'individual_call'
    rules = [
        ('promotion_dominance', evaluate_promotion_dominance),
        ('coordination', evaluate_coordination),
        ('independence_quorum', evaluate_quorum),
        ('weighted_conviction', evaluate_conviction),
        ('liquidity_floor', evaluate_liquidity),
        ('exit_terms', evaluate_exit_terms),
        ('size_limits', evaluate_size),
        ('price_agreement', evaluate_price_agreement),
        ('staleness', evaluate_staleness),
    ]
    results = []
    decision, reason_code = 'approved', None
    for name, evaluator in rules:
        if individual and name in ('independence_quorum', 'weighted_conviction'):
            results.append({
                'rule': name, 'pass': None,
                'evidence': 'Not applicable: agreement rules do not judge individual_call cases.'})
            continue
        passed, evidence, effect = evaluator(bundle)
        results.append({'rule': name, 'pass': passed, 'evidence': evidence})
        if effect and decision == 'approved':
            decision, reason_code = effect
    return {'decision': decision, 'reason_code': reason_code, 'rule_results': results}


def _independence_inputs(bundle):
    evidence = bundle['evidence']
    independent = [voice for voice in bundle['voices'] if not voice['copied']]
    directional = [voice['direction'] for voice in independent if voice['direction'] != 'mention']
    channel_repeats = {}
    for row in evidence['promotion']:
        channel_repeats.setdefault(row['sourceHash'], []).append(row['messageId'])
    return evidence, independent, directional, channel_repeats


def evaluate_promotion_dominance(bundle):
    evidence, independent, _, _ = _independence_inputs(bundle)
    promotional = [row for row in evidence['promotion']
                   if row['isAdvertisement'] or row['referralMarkers']]
    voices = len(independent)
    triggered = len(promotional) >= max(voices, 1)
    if triggered:
        return False, (f'{len(promotional)} promotional posts meet or exceed {voices} '
                       f'independent voices.'), ('rejected', 'PROMOTION_VETO')
    return True, (f'{len(promotional)} promotional posts versus {voices} independent '
                  f'voices. Veto trigger not met.'), None


def evaluate_coordination(bundle):
    evidence, _, _, _ = _independence_inputs(bundle)
    scheduled = [row for row in evidence['promotion'] if row['scheduledCall']]
    if scheduled and bundle['evidence']['ruleParameters']['values']['coordination'][
            'scheduledCallInsideWindowRejects']:
        quotes = '; '.join(row['scheduledCall']['quote'] for row in scheduled)
        return False, (f'Pre-announced timed call evidence inside the window: {quotes}'
                       ), ('rejected', 'COORDINATED_PUMP')
    return True, 'No pre-announced timed call inside the window.', None


def evaluate_quorum(bundle):
    evidence, independent, _, _ = _independence_inputs(bundle)
    required = bundle['evidence']['ruleParameters']['values']['independentVoicesRequired']
    copied = [voice for voice in bundle['voices'] if voice['copied']]
    if len(independent) >= required:
        return True, f'{len(independent)} independent voices meet the threshold of {required}.', None
    repeats = {}
    for voice in bundle['voices']:
        repeats[voice['sourceHash']] = max(repeats.get(voice['sourceHash'], 0), len(voice['callIds']))
    top_repeat = max(repeats.values(), default=0)
    if copied and len(copied) >= len(independent) and top_repeat < 3:
        return False, (f'{len(copied)} copied calls carried the convergence against '
                       f'{len(independent)} independent voices.'), ('rejected', 'COPIED_EVIDENCE')
    if top_repeat >= 3 and len(independent) <= 1:
        return False, (f'One channel repeated this asset {top_repeat} times against '
                       f'{len(independent)} independent voice.'), ('rejected', 'SINGLE_VOICE_REPETITION')
    return False, (f'{len(independent)} independent voices fall short of the '
                   f'threshold of {required}.'), ('rejected', 'QUORUM_NOT_MET')


def evaluate_conviction(bundle):
    independent = [voice for voice in bundle['voices'] if not voice['copied']]
    floor = bundle['evidence']['ruleParameters']['values']['weightedConvictionFloor']
    weighted = bundle.get('weightedConviction')
    weighted = float(weighted) if weighted is not None else None
    if weighted is None:
        weights = [voice['weightBps'] for voice in independent]
        convictions = [voice['conviction'] for voice in independent]
        weighted = round(sum(w * c for w, c in zip(weights, convictions)) / sum(weights), 2) \
            if sum(weights) else 0
    if weighted >= floor:
        return True, f'Reliability-weighted conviction {weighted} meets the floor of {floor}.', None
    return False, (f'Reliability-weighted conviction {weighted} falls below the '
                   f'floor of {floor}.'), ('rejected', 'QUORUM_NOT_MET')


def evaluate_liquidity(bundle):
    evidence, _, _, _ = _independence_inputs(bundle)
    parameters = bundle['evidence']['ruleParameters']['values']['liquidity']
    asset_key = bundle['asset']['assetKey'] or ''
    if asset_key.startswith('cex:'):
        return True, 'Listed pair: liquidity rule exempt.', None
    observations = evidence['liquidity'] or []
    if not asset_key:
        # A narrative event judges a theme across assets. Listed pairs are
        # exempt by the mandate, so only contract-address rows carry evidence.
        observations = [row for row in observations
                        if (row.get('assetKey') or '').startswith(('solana:', 'evm:'))]
        if not observations:
            return True, 'Narrative event across listed pairs only: liquidity rule exempt.', None
    if not observations:
        return False, ('No recorded liquidity observation. Missing evidence cannot '
                       'pass this rule.'), ('rejected', 'LIQUIDITY_FLOOR')
    floor_cents = parameters['contractAssetFloorUsd'] * 100
    thin = [row for row in observations
            if row.get('liquidityUsdCents') is None or row['liquidityUsdCents'] < floor_cents]
    if thin:
        return False, (f'Recorded liquidity below the floor of ${parameters["contractAssetFloorUsd"]} '
                       f'for {len(thin)} of {len(observations)} observations.'), ('rejected', 'LIQUIDITY_FLOOR')
    return True, (f'{len(observations)} liquidity observations all at or above the '
                  f'floor of ${parameters["contractAssetFloorUsd"]}.'), None


def evaluate_exit_terms(bundle):
    _, independent, directional, _ = _independence_inputs(bundle)
    terms = bundle['proposedTerms']
    directions = set(directional)
    if len(directions) > 1:
        return False, (f'Independent voices disagree on direction: {", ".join(sorted(directions))}. '
                       'Terms could not be fixed.'), ('rejected', 'MISSING_EXIT_TERMS')
    if terms['hasStructuredLevels']:
        if terms['stopPrice'] and terms['targetPrice'] and terms['expiresAt']:
            return True, (f'Structured levels: stop {terms["stopPrice"]}, target {terms["targetPrice"]}, '
                          f'expiry {terms["expiresAt"]}.'), None
        return False, 'Structured call missing stop or target levels.', ('rejected', 'MISSING_EXIT_TERMS')
    if terms['stopBps'] is not None and terms['targetBps'] is not None and terms['expiresAt']:
        return True, (f"Default terms: stop {terms['stopBps']} bps, target {terms['targetBps']} bps, "
                      f"expiry {terms['expiresAt']}."), None
    if not independent:
        return False, 'No independent voices to fix terms from.', ('rejected', 'MISSING_EXIT_TERMS')
    return False, 'No stop, target or expiry could be fixed from the calls or defaults.', ('rejected', 'MISSING_EXIT_TERMS')


def evaluate_size(bundle):
    parameters = bundle['evidence']['ruleParameters']['values']['paperSize']
    size = computed_size(bundle)
    if size is None:
        return False, 'Paper size could not be computed.', ('rejected', 'MANDATE_SIZE')
    if size < 0 or size > parameters['capUsd']:
        return False, (f'Computed paper size {size} USDC fell outside the mandate '
                       f'limits of 0 to {parameters["capUsd"]} USDC.'), ('rejected', 'MANDATE_SIZE')
    return True, f'Paper size {size} USDC within the cap of {parameters["capUsd"]} USDC.', None


def computed_size(bundle):
    """min(cap, base * weightedConviction / referenceConviction), whole USDC."""
    parameters = bundle['evidence']['ruleParameters']['values']['paperSize']
    independent = [voice for voice in bundle['voices'] if not voice['copied']]
    weighted = bundle.get('weightedConviction')
    weighted = float(weighted) if weighted is not None else None
    if weighted is None:
        weights = [voice['weightBps'] for voice in independent]
        convictions = [voice['conviction'] for voice in independent]
        weighted = sum(w * c for w, c in zip(weights, convictions)) / sum(weights) if sum(weights) else 0
    if weighted < parameters['referenceConviction']:
        return None
    size = parameters['baseUsd'] * weighted / parameters['referenceConviction']
    return round(size)


def evaluate_price_agreement(bundle):
    observations = bundle['evidence'].get('entryObservations') or []
    tolerance = bundle['pricePlan']['maxDeviationBps']
    if not bundle['asset']['assetKey']:
        return None, 'Not applicable: a narrative case has no single entry instrument.', None
    prices = [row for row in observations if row.get('price') is not None]
    if len(prices) < 2:
        return True, (f'{len(prices)} recorded entry observations. The CRE consensus read '
                      f'at filing supplies the rest.'), None
    primary = next((row for row in prices if row['kind'] == bundle['pricePlan']['primary']['kind']), prices[0])
    check = next((row for row in prices if row['kind'] == bundle['pricePlan']['check']['kind']), prices[-1])
    primary_price = float(primary['price'])
    check_price = float(check['price'])
    if primary_price <= 0 or check_price <= 0:
        return False, 'A recorded price is not positive.', ('deferred', 'PRICE_DISAGREEMENT')
    deviation_bps = abs(primary_price - check_price) / min(primary_price, check_price) * 10000
    if deviation_bps > tolerance:
        return False, (f'Recorded sources deviate {deviation_bps:.0f} bps beyond the '
                       f'tolerance of {tolerance} bps.'), ('deferred', 'PRICE_DISAGREEMENT')
    return True, f'Recorded sources agree within the tolerance of {tolerance} bps.', None


def evaluate_staleness(bundle):
    evaluated_at = bundle.get('evaluatedAt')
    closed_at = bundle['window']['closedAt']
    if not evaluated_at:
        return False, 'No evaluation time recorded.', ('rejected', 'STALE_EVIDENCE')
    age = parse_timestamp(evaluated_at) - parse_timestamp(closed_at)
    if age > timedelta(days=STALE_AFTER_DAYS):
        return False, (f'Evaluation happened {age.days} days after the window closed, beyond '
                       f'the {STALE_AFTER_DAYS}-day staleness limit.'), ('rejected', 'STALE_EVIDENCE')
    return True, f'Evaluated within {STALE_AFTER_DAYS} days of window close.', None
