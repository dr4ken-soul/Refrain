/**
 * Fixed public ruleset evaluator, mirroring packages/engine/rules.py exactly.
 *
 * Reason codes come only from the fixed list. Rejected and deferred cases
 * are filed beside approvals. The evaluator reads the frozen bundle only;
 * no rule touches mutable database state. Evidence strings mirror the
 * Python f-strings so committed run logs and fixture tests line up.
 *
 * Numeric mirrors:
 * - Python round(x, 2) and round(x) are round-half-even on the double;
 *   pyRound2 and pyRound reproduce that.
 * - Decimal ROUND_HALF_UP (bundle construction) is reproduced by
 *   weightedConvictionString in canonical.ts, not here.
 */
import { compareCodePoints, weightedConvictionString } from './canonical';

export const REASON_CODES = [
  'QUORUM_NOT_MET', 'SINGLE_VOICE_REPETITION', 'COPIED_EVIDENCE', 'COORDINATED_PUMP',
  'PROMOTION_VETO', 'LIQUIDITY_FLOOR', 'PRICE_DISAGREEMENT', 'MANDATE_SIZE',
  'MISSING_EXIT_TERMS', 'STALE_EVIDENCE',
] as const;

export const DIRECTION_CODES: Record<string, number> = { long: 0, short: 1, spot_buy: 2 };

export const STALE_AFTER_DAYS = 7;

export type Decision = 'approved' | 'rejected' | 'deferred';

export interface RuleResult {
  rule: string;
  pass: boolean | null;
  evidence: string;
}

export interface Evaluation {
  decision: Decision;
  reasonCode: string | null;
  ruleResults: RuleResult[];
}

export interface RulesetValues {
  independentVoicesRequired: number;
  weightedConvictionFloor: number;
  windows: { contractAssetHours: number; listedPairHours: number };
  paperSize: { baseUsd: number; referenceConviction: number; capUsd: number; formula?: string };
  priceAgreement: { contractAssetMaxDeviationBps: number; listedPairMaxDeviationBps: number };
  promotionVeto: { enabled: boolean; trigger: string };
  liquidity: { contractAssetFloorUsd: number; listedPairExempt: boolean };
  coordination: { scheduledCallInsideWindowRejects: boolean };
  independence: {
    forwardIndependentVoices: number;
    oneVoicePerChannelPerWindow: boolean;
    neutralWeightBps: number;
    sharedReferralMarkerWeightBps: number;
  };
}

export interface BundleVoice {
  sourceHash: string | null;
  callIds: string[];
  firstCallAt: string;
  direction: string;
  conviction: number;
  copied: boolean;
  weightBps: number;
}

export interface PromotionRow {
  sourceHash: string | null;
  messageId: number;
  isAdvertisement: boolean;
  filterReason: string | null;
  referralMarkers: unknown[];
  scheduledCall: { quote?: string; [key: string]: unknown } | null;
}

export interface ObservationRow {
  kind: string;
  locator: string;
  observedAt: string;
  liquidityUsdCents: number | null;
  price: string | null;
  assetKey?: string | null;
}

export interface ContributingCall {
  callId: string;
  sourceHash: string | null;
  messageId: number;
  timestamp: string;
  direction: string;
  conviction: number;
  narrativeTags: string[];
  span: [number | null, number | null];
}

export interface RulesetValuesHolder {
  ruleParameters: { rulesetHash: string; values: RulesetValues };
}

export interface EvidenceBundle {
  eventId: string;
  caseKind: string;
  rulesetVersion: number;
  rulesetHash: string;
  asset: {
    assetKey: string | null;
    chain: string | null;
    contractAddress: string | null;
    ticker: string | null;
    pair: string | null;
  };
  narrativeKey: string | null;
  window: { startedAt: string; closedAt: string };
  voices: BundleVoice[];
  independentVoiceCount: number;
  weightedConviction: string | null;
  timingSpreadSeconds: number;
  evidence: RulesetValuesHolder & {
    contributingCalls: ContributingCall[];
    posts: Array<{
      sourceHash: string | null;
      messageId: number;
      text: string;
      urls: string[];
      contentHash: string | null;
      forwardedFrom: string | null;
      editedAt: string | null;
    }>;
    reliability: Array<{
      sourceHash: string | null;
      scoreHundredths: number;
      origin: string;
      block: number | null;
    }>;
    completeCallOrder: string[];
    canonicalOrder: string;
    firstIndependentCallBySource: Record<string, string>;
    promotion: PromotionRow[];
    independenceWeights: Array<{ sourceHash: string | null; weightBps: number; sharedMarkers: string[] }>;
    sharedReferralMarkers: Array<{ value: string; sources: string[] }>;
    liquidity: ObservationRow[];
    entryObservations: ObservationRow[];
  };
  pricePlan: {
    primary: { kind: string; locator: string };
    check: { kind: string; locator: string };
    maxDeviationBps: number;
  };
  proposedTerms: {
    direction: string;
    sizeUnits: number | null;
    stopBps: number | null;
    targetBps: number | null;
    stopPrice: string | null;
    targetPrice: string | null;
    expiresAt: string | null;
    hasStructuredLevels: boolean;
  };
  evaluatedAt: string | null;
  bundleHash?: string;
}

/** Python round(x): round-half-even on the double, integer result. */
export function pyRound(x: number): number {
  if (!Number.isFinite(x)) {
    throw new Error('Cannot round a non-finite number.');
  }
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Python round(x, 2): half-even on the scaled double. */
export function pyRound2(x: number): number {
  return pyRound(x * 100) / 100;
}

/** Python f'{x:.0f}': half-even formatting to zero decimals. */
export function pyFormat0f(x: number): string {
  return String(pyRound(x));
}

interface IndependenceInputs {
  evidence: EvidenceBundle['evidence'];
  independent: BundleVoice[];
  directional: string[];
}

function independenceInputs(bundle: EvidenceBundle): IndependenceInputs {
  const evidence = bundle.evidence;
  const independent = bundle.voices.filter((voice) => !voice.copied);
  const directional = independent
    .map((voice) => voice.direction)
    .filter((direction) => direction !== 'mention');
  return { evidence, independent, directional };
}

export function evaluatePromotionDominance(bundle: EvidenceBundle): RuleEffect {
  const { evidence, independent } = independenceInputs(bundle);
  const promotional = evidence.promotion.filter(
    (row) => row.isAdvertisement || (row.referralMarkers && row.referralMarkers.length > 0),
  );
  const voices = independent.length;
  const triggered = promotional.length >= Math.max(voices, 1);
  if (triggered) {
    return {
      pass: false,
      evidence: `${promotional.length} promotional posts meet or exceed ${voices} independent voices.`,
      effect: ['rejected', 'PROMOTION_VETO'],
    };
  }
  return {
    pass: true,
    evidence: `${promotional.length} promotional posts versus ${voices} independent voices. Veto trigger not met.`,
    effect: null,
  };
}

export function evaluateCoordination(bundle: EvidenceBundle): RuleEffect {
  const { evidence } = independenceInputs(bundle);
  const scheduled = evidence.promotion.filter((row) => (row.scheduledCall ?? null) !== null);
  const rejects = bundle.evidence.ruleParameters.values.coordination.scheduledCallInsideWindowRejects;
  if (scheduled.length > 0 && rejects) {
    const quotes = scheduled
      .map((row) => (row.scheduledCall && row.scheduledCall.quote !== undefined ? String(row.scheduledCall.quote) : 'null'))
      .join('; ');
    return {
      pass: false,
      evidence: `Pre-announced timed call evidence inside the window: ${quotes}`,
      effect: ['rejected', 'COORDINATED_PUMP'],
    };
  }
  return {
    pass: true,
    evidence: 'No pre-announced timed call inside the window.',
    effect: null,
  };
}

export function evaluateQuorum(bundle: EvidenceBundle): RuleEffect {
  const { evidence, independent } = independenceInputs(bundle);
  const required = bundle.evidence.ruleParameters.values.independentVoicesRequired;
  if (independent.length >= required) {
    return {
      pass: true,
      evidence: `${independent.length} independent voices meet the threshold of ${required}.`,
      effect: null,
    };
  }
  const copied = bundle.voices.filter((voice) => voice.copied);
  const repeats = new Map<string, number>();
  for (const voice of bundle.voices) {
    const key = voice.sourceHash === null ? 'null' : voice.sourceHash;
    const current = repeats.get(key) ?? 0;
    repeats.set(key, Math.max(current, voice.callIds.length));
  }
  let topRepeat = 0;
  for (const value of repeats.values()) {
    topRepeat = Math.max(topRepeat, value);
  }
  if (copied.length > 0 && copied.length >= independent.length && topRepeat < 3) {
    return {
      pass: false,
      evidence: `${copied.length} copied calls carried the convergence against ${independent.length} independent voices.`,
      effect: ['rejected', 'COPIED_EVIDENCE'],
    };
  }
  if (topRepeat >= 3 && independent.length <= 1) {
    return {
      pass: false,
      evidence: `One channel repeated this asset ${topRepeat} times against ${independent.length} independent voice.`,
      effect: ['rejected', 'SINGLE_VOICE_REPETITION'],
    };
  }
  return {
    pass: false,
    evidence: `${independent.length} independent voices fall short of the threshold of ${required}.`,
    effect: ['rejected', 'QUORUM_NOT_MET'],
  };
}

/** Python repr(float) for evidence text: integral floats keep one decimal. */
function pyFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

export function evaluateConviction(bundle: EvidenceBundle): RuleEffect {
  const { independent } = independenceInputs(bundle);
  const floor = bundle.evidence.ruleParameters.values.weightedConvictionFloor;
  let weighted: number | null = bundle.weightedConviction !== null ? Number(bundle.weightedConviction) : null;
  if (weighted === null || Number.isNaN(weighted)) {
    const weights = independent.map((voice) => voice.weightBps);
    const convictions = independent.map((voice) => voice.conviction);
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    // Python round(x, 2): half-even on the double, mirroring rules.py.
    weighted = weightSum
      ? pyRound2(weights.reduce((sum, w, i) => sum + w * convictions[i], 0) / weightSum)
      : 0;
  }
  if (weighted >= floor) {
    return {
      pass: true,
      evidence: `Reliability-weighted conviction ${pyFloat(weighted)} meets the floor of ${floor}.`,
      effect: null,
    };
  }
  return {
    pass: false,
    evidence: `Reliability-weighted conviction ${pyFloat(weighted)} falls below the floor of ${floor}.`,
    effect: ['rejected', 'QUORUM_NOT_MET'],
  };
}

export function evaluateLiquidity(bundle: EvidenceBundle): RuleEffect {
  const { evidence } = independenceInputs(bundle);
  const parameters = bundle.evidence.ruleParameters.values.liquidity;
  const assetKey = bundle.asset.assetKey ?? '';
  if (assetKey.startsWith('cex:')) {
    return { pass: true, evidence: 'Listed pair: liquidity rule exempt.', effect: null };
  }
  let observations = evidence.liquidity ?? [];
  if (!assetKey) {
    // A narrative event judges a theme across assets. Listed pairs are
    // exempt by the mandate, so only contract-address rows carry evidence.
    observations = observations.filter((row) => {
      const key = row.assetKey ?? '';
      return key.startsWith('solana:') || key.startsWith('evm:');
    });
    if (observations.length === 0) {
      return {
        pass: true,
        evidence: 'Narrative event across listed pairs only: liquidity rule exempt.',
        effect: null,
      };
    }
  }
  if (observations.length === 0) {
    return {
      pass: false,
      evidence: 'No recorded liquidity observation. Missing evidence cannot pass this rule.',
      effect: ['rejected', 'LIQUIDITY_FLOOR'],
    };
  }
  const floorCents = parameters.contractAssetFloorUsd * 100;
  const thin = observations.filter(
    (row) => row.liquidityUsdCents === null || row.liquidityUsdCents < floorCents,
  );
  if (thin.length > 0) {
    return {
      pass: false,
      evidence: `Recorded liquidity below the floor of $${parameters.contractAssetFloorUsd} for ${thin.length} of ${observations.length} observations.`,
      effect: ['rejected', 'LIQUIDITY_FLOOR'],
    };
  }
  return {
    pass: true,
    evidence: `${observations.length} liquidity observations all at or above the floor of $${parameters.contractAssetFloorUsd}.`,
    effect: null,
  };
}

export function evaluateExitTerms(bundle: EvidenceBundle): RuleEffect {
  const { independent, directional } = independenceInputs(bundle);
  const terms = bundle.proposedTerms;
  const directions = [...new Set(directional)].sort(compareCodePoints);
  if (directions.length > 1) {
    return {
      pass: false,
      evidence: `Independent voices disagree on direction: ${directions.join(', ')}. Terms could not be fixed.`,
      effect: ['rejected', 'MISSING_EXIT_TERMS'],
    };
  }
  if (terms.hasStructuredLevels) {
    if (terms.stopPrice && terms.targetPrice && terms.expiresAt) {
      return {
        pass: true,
        evidence: `Structured levels: stop ${terms.stopPrice}, target ${terms.targetPrice}, expiry ${terms.expiresAt}.`,
        effect: null,
      };
    }
    return {
      pass: false,
      evidence: 'Structured call missing stop or target levels.',
      effect: ['rejected', 'MISSING_EXIT_TERMS'],
    };
  }
  if (terms.stopBps !== null && terms.targetBps !== null && terms.expiresAt) {
    return {
      pass: true,
      evidence: `Default terms: stop ${terms.stopBps} bps, target ${terms.targetBps} bps, expiry ${terms.expiresAt}.`,
      effect: null,
    };
  }
  if (independent.length === 0) {
    return {
      pass: false,
      evidence: 'No independent voices to fix terms from.',
      effect: ['rejected', 'MISSING_EXIT_TERMS'],
    };
  }
  return {
    pass: false,
    evidence: 'No stop, target or expiry could be fixed from the calls or defaults.',
    effect: ['rejected', 'MISSING_EXIT_TERMS'],
  };
}

/** min(cap, base * weightedConviction / referenceConviction), whole USDC. */
export function computedSize(bundle: EvidenceBundle): number | null {
  const parameters = bundle.evidence.ruleParameters.values.paperSize;
  const independent = bundle.voices.filter((voice) => !voice.copied);
  let weighted: number | null = bundle.weightedConviction !== null ? Number(bundle.weightedConviction) : null;
  if (weighted === null || Number.isNaN(weighted)) {
    const weights = independent.map((voice) => voice.weightBps);
    const convictions = independent.map((voice) => voice.conviction);
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    weighted = weightSum
      ? weights.reduce((sum, w, i) => sum + w * convictions[i], 0) / weightSum
      : 0;
  }
  if (weighted < parameters.referenceConviction) {
    return null;
  }
  const size = (parameters.baseUsd * weighted) / parameters.referenceConviction;
  return pyRound(size);
}

export function evaluateSize(bundle: EvidenceBundle): RuleEffect {
  const parameters = bundle.evidence.ruleParameters.values.paperSize;
  const size = computedSize(bundle);
  if (size === null) {
    return {
      pass: false,
      evidence: 'Paper size could not be computed.',
      effect: ['rejected', 'MANDATE_SIZE'],
    };
  }
  if (size < 0 || size > parameters.capUsd) {
    return {
      pass: false,
      evidence: `Computed paper size ${size} USDC fell outside the mandate limits of 0 to ${parameters.capUsd} USDC.`,
      effect: ['rejected', 'MANDATE_SIZE'],
    };
  }
  return {
    pass: true,
    evidence: `Paper size ${size} USDC within the cap of ${parameters.capUsd} USDC.`,
    effect: null,
  };
}

export function evaluatePriceAgreement(bundle: EvidenceBundle): RuleEffect {
  const observations = bundle.evidence.entryObservations ?? [];
  const tolerance = bundle.pricePlan.maxDeviationBps;
  if (!bundle.asset.assetKey) {
    return {
      pass: null,
      evidence: 'Not applicable: a narrative case has no single entry instrument.',
      effect: null,
    };
  }
  const prices = observations.filter((row) => row.price !== null);
  if (prices.length < 2) {
    return {
      pass: true,
      evidence: `${prices.length} recorded entry observations. The CRE consensus read at filing supplies the rest.`,
      effect: null,
    };
  }
  const primary =
    prices.find((row) => row.kind === bundle.pricePlan.primary.kind) ?? prices[0];
  const check =
    prices.find((row) => row.kind === bundle.pricePlan.check.kind) ?? prices[prices.length - 1];
  const primaryPrice = Number(primary.price);
  const checkPrice = Number(check.price);
  if (primaryPrice <= 0 || checkPrice <= 0) {
    return {
      pass: false,
      evidence: 'A recorded price is not positive.',
      effect: ['deferred', 'PRICE_DISAGREEMENT'],
    };
  }
  const deviationBps =
    (Math.abs(primaryPrice - checkPrice) / Math.min(primaryPrice, checkPrice)) * 10000;
  if (deviationBps > tolerance) {
    return {
      pass: false,
      evidence: `Recorded sources deviate ${pyFormat0f(deviationBps)} bps beyond the tolerance of ${tolerance} bps.`,
      effect: ['deferred', 'PRICE_DISAGREEMENT'],
    };
  }
  return {
    pass: true,
    evidence: `Recorded sources agree within the tolerance of ${tolerance} bps.`,
    effect: null,
  };
}

export function evaluateStaleness(bundle: EvidenceBundle): RuleEffect {
  const evaluatedAt = bundle.evaluatedAt;
  const closedAt = bundle.window.closedAt;
  if (!evaluatedAt) {
    return {
      pass: false,
      evidence: 'No evaluation time recorded.',
      effect: ['rejected', 'STALE_EVIDENCE'],
    };
  }
  const ageMs = new Date(evaluatedAt).getTime() - new Date(closedAt).getTime();
  if (ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000) {
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    return {
      pass: false,
      evidence: `Evaluation happened ${ageDays} days after the window closed, beyond the ${STALE_AFTER_DAYS}-day staleness limit.`,
      effect: ['rejected', 'STALE_EVIDENCE'],
    };
  }
  return {
    pass: true,
    evidence: `Evaluated within ${STALE_AFTER_DAYS} days of window close.`,
    effect: null,
  };
}

interface RuleEffect {
  pass: boolean | null;
  evidence: string;
  effect: [Decision, string] | null;
}

/**
 * Evaluate every rule in the fixed order. The first failing effect decides,
 * but all rules still run and their results are recorded, mirroring
 * rules.evaluate_bundle.
 */
export function evaluateBundle(bundle: EvidenceBundle): Evaluation {
  const individual = bundle.caseKind === 'individual_call';
  const rules: Array<[string, (candidate: EvidenceBundle) => RuleEffect]> = [
    ['promotion_dominance', evaluatePromotionDominance],
    ['coordination', evaluateCoordination],
    ['independence_quorum', evaluateQuorum],
    ['weighted_conviction', evaluateConviction],
    ['liquidity_floor', evaluateLiquidity],
    ['exit_terms', evaluateExitTerms],
    ['size_limits', evaluateSize],
    ['price_agreement', evaluatePriceAgreement],
    ['staleness', evaluateStaleness],
  ];
  const results: RuleResult[] = [];
  let decision: Decision = 'approved';
  let reasonCode: string | null = null;
  for (const [name, evaluator] of rules) {
    if (individual && (name === 'independence_quorum' || name === 'weighted_conviction')) {
      results.push({
        rule: name,
        pass: null,
        evidence: 'Not applicable: agreement rules do not judge individual_call cases.',
      });
      continue;
    }
    const outcome = evaluator(bundle);
    results.push({ rule: name, pass: outcome.pass, evidence: outcome.evidence });
    if (outcome.effect && decision === 'approved') {
      decision = outcome.effect[0];
      reasonCode = outcome.effect[1];
    }
  }
  return { decision, reasonCode, ruleResults: results };
}

/** uint8 reason code for the report; None is 0. */
export function reasonCodeToUint8(reasonCode: string | null): number {
  if (reasonCode === null) {
    return 0;
  }
  const index = REASON_CODES.indexOf(reasonCode as (typeof REASON_CODES)[number]);
  if (index < 0) {
    throw new Error(`Unknown reason code: ${reasonCode}`);
  }
  return index + 1;
}

/** Fixed decimal string recomputation mirror for bundle construction. */
export { weightedConvictionString };
