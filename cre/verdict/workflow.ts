/**
 * Refrain verdict workflow.
 *
 * One cron invocation files one verdict for the oldest pending convergence
 * case, per the APP_BLUEPRINT.md CRE Integration Detail:
 *
 *   1. GET {apiBase}/cre/pending-verdicts with the workflow bearer secret,
 *      identical-consensus aggregation on the response body.
 *   2. GET {apiBase}/cre/events/{eventId}/bundle, identical consensus,
 *      then recompute the canonical hash; a mismatch stops the run.
 *   3. Recompute every rule inside the workflow (cre/shared/rules.ts) and
 *      check the config ruleset hash against the bundle.
 *   4. For approvals, read the entry price from the bundle pricePlan with
 *      median consensus per source; a primary/check deviation beyond
 *      maxDeviationBps downgrades the decision to DEFERRED.
 *   5. Resolve stop and target: structured levels where present, otherwise
 *      entry price adjusted by the recorded default basis points. Prices
 *      are integers scaled by 1e8.
 *   6. ABI-encode the VerdictReport, sign it with runtime.report and
 *      deliver it through EVMClient.writeReport to RefrainLedger.
 *   7. Log eventId, decision, reason code, bundle hash and transaction
 *      hash.
 */
import {
  consensusIdenticalAggregation,
  consensusMedianAggregation,
  cre,
  getNetwork,
  hexToBase64,
  text,
  TxStatus,
  type CronPayload,
  type Runtime,
} from '@chainlink/cre-sdk';
import { bytesToHex } from 'viem';
import { z } from 'zod';
import { bundleHash as computeBundleHash, decimalToScaled } from '../shared/canonical';
import {
  computedSize,
  DIRECTION_CODES,
  evaluateBundle,
  reasonCodeToUint8,
  type EvidenceBundle,
} from '../shared/rules';
import {
  assetHashOf,
  contributionRows,
  encodeVerdictPayload,
} from '../shared/reports';
import {
  parseBinance,
  parseBybit,
  parseDexscreener,
  parseGeckoterminal,
} from '../shared/market';

export const configSchema = z.object({
  schedule: z.string(),
  apiBase: z.string(),
  chainName: z.string(),
  receiver: z.custom<`0x${string}`>((value) =>
    typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)),
  rulesetHash: z.string(),
  gasLimit: z.string(),
});

type Config = z.infer<typeof configSchema>;

const SEPOLIA_CHAIN_SELECTOR = 16015286601757825753n;

function scheduledSlotSeconds(runtime: Runtime<Config>, payload: CronPayload): bigint {
  if (payload.scheduledExecutionTime) {
    return BigInt(payload.scheduledExecutionTime.seconds);
  }
  // Simulation fallback: the slot time the handler believes it is running in.
  return BigInt(Math.floor(runtime.now().getTime() / 1000));
}

interface PendingCandidate {
  candidates: Array<{
    eventId: string;
    caseHash: string;
    caseKind: string;
    assetKey: string | null;
    windowClosedAt: string;
  }>;
}

/** Fetch one URL with the bearer header; identical consensus on the body. */
function textFetcher(runtime: Runtime<Config>, bearer: string) {
  const httpClient = new cre.capabilities.HTTPClient();
  return httpClient.sendRequest(
    runtime,
    (requester, url: string) => {
      const response = requester.sendRequest({
        url,
        method: 'GET',
        headers: { Authorization: `Bearer ${bearer}` },
      }).result();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`HTTP ${response.statusCode} for ${url}`);
      }
      return text(response);
    },
    consensusIdenticalAggregation<string>(),
  );
}

/** Median-consensus scaled price from one pricePlan source kind. */
function priceFetcher(runtime: Runtime<Config>) {
  const httpClient = new cre.capabilities.HTTPClient();
  return httpClient.sendRequest(
    runtime,
    (requester, kind: string, url: string, network: string, address: string) => {
      const response = requester.sendRequest({ url, method: 'GET' }).result();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`HTTP ${response.statusCode} for ${url}`);
      }
      const body = text(response);
      let price: bigint | null;
      if (kind === 'dexscreener') {
        price = parseDexscreener(body, network, address);
      } else if (kind === 'geckoterminal') {
        price = parseGeckoterminal(body, network, address);
      } else if (kind === 'binance') {
        price = parseBinance(body);
      } else if (kind === 'bybit') {
        price = parseBybit(body);
      } else {
        throw new Error(`Unsupported price source kind: ${kind}`);
      }
      if (price === null) {
        throw new Error(`No price for ${kind} at ${url}`);
      }
      return price;
    },
    consensusMedianAggregation<bigint>(),
  );
}

/** entry * (10000 + bps) / 10000, half-up, positive BigInt arithmetic. */
function bpsScaled(entry: bigint, bps: number): bigint {
  const factor = BigInt(10000 + bps);
  if (factor <= 0n) {
    throw new Error(`Default term bps out of range: ${bps}`);
  }
  const numerator = entry * factor * 2n + 10000n;
  return numerator / 20000n;
}

function instrumentOf(assetKey: string): string {
  const index = assetKey.indexOf(':');
  return index < 0 ? assetKey : assetKey.slice(index + 1);
}

/** URLs exactly as packages/engine/market.py reaches each source kind. */
function sourceUrl(kind: string, assetKey: string): string {
  if (kind === 'dexscreener') {
    return `https://api.dexscreener.com/latest/dex/tokens/${instrumentOf(assetKey)}`;
  }
  if (kind === 'geckoterminal') {
    const network = assetKey.startsWith('solana:') ? 'solana' : 'ethereum';
    return `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${instrumentOf(assetKey)}/pools`;
  }
  if (kind === 'binance') {
    return `https://api.binance.com/api/v3/ticker/price?symbol=${instrumentOf(assetKey)}`;
  }
  if (kind === 'bybit') {
    return `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${instrumentOf(assetKey)}`;
  }
  throw new Error(`Unsupported price source kind: ${kind}`);
}

async function onCronTrigger(runtime: Runtime<Config>, payload: CronPayload): Promise<string> {
  const scheduledAt = scheduledSlotSeconds(runtime, payload);
  runtime.log(`Verdict run at scheduled slot ${scheduledAt}.`);

  // Step 1: oldest pending candidate.
  const bearer = runtime.getSecret({ id: 'CRE_BEARER_SECRET' }).result().value;
  const fetchText = textFetcher(runtime, bearer);
  const pendingRaw = await fetchText(`${runtime.config.apiBase}/cre/pending-verdicts`).result();
  const pending = JSON.parse(pendingRaw) as PendingCandidate;
  const candidate = pending.candidates?.[0];
  if (!candidate) {
    runtime.log('No pending candidate events. Nothing to file.');
    return 'no pending candidates';
  }
  runtime.log(`Oldest candidate: ${candidate.eventId} (${candidate.caseKind}).`);

  // Step 2: bundle with canonical hash recomputation.
  const bundleRaw = await fetchText(
    `${runtime.config.apiBase}/cre/events/${candidate.eventId}/bundle`,
  ).result();
  const bundle = JSON.parse(bundleRaw) as EvidenceBundle;
  let recomputed: string;
  try {
    recomputed = computeBundleHash(bundle as unknown as Record<string, unknown>);
  } catch (error) {
    throw new Error(`Canonical bytes could not be rebuilt for ${candidate.eventId}: ${String(error)}`);
  }
  if (!bundle.bundleHash || bundle.bundleHash !== recomputed) {
    throw new Error(
      `Canonical hash mismatch for ${candidate.eventId}: reported ${bundle.bundleHash}, recomputed ${recomputed}.`,
    );
  }
  if (bundle.rulesetHash !== runtime.config.rulesetHash) {
    throw new Error(
      `Ruleset hash mismatch: config ${runtime.config.rulesetHash}, bundle ${bundle.rulesetHash}.`,
    );
  }
  runtime.log(`Bundle ${bundle.bundleHash} verified against canonical bytes.`);

  // Step 3: recompute all rule results inside the workflow.
  const evaluation = evaluateBundle(bundle);
  let decision = evaluation.decision;
  let reasonCode = evaluation.reasonCode;
  for (const result of evaluation.ruleResults) {
    runtime.log(`Rule ${result.rule}: ${result.pass} ${result.evidence}`);
  }
  runtime.log(`Recomputed decision ${decision} reason ${reasonCode ?? 'None'}.`);

  // Step 4: fresh entry price for approvals; deviation check may defer.
  let entryScaled: bigint | null = null;
  if (decision === 'approved') {
    const assetKey = bundle.asset.assetKey ?? '';
    const network = assetKey.startsWith('solana:') ? 'solana' : 'ethereum';
    const priceFetch = priceFetcher(runtime);
    const primary = bundle.pricePlan.primary;
    const check = bundle.pricePlan.check;
    const primaryUrl = sourceUrl(primary.kind, assetKey);
    const checkUrl = sourceUrl(check.kind, assetKey);
    const primaryScaled = await priceFetch(
      primary.kind, primaryUrl, network, instrumentOf(assetKey),
    ).result();
    const checkScaled = await priceFetch(
      check.kind, checkUrl, network, instrumentOf(assetKey),
    ).result();
    const primaryPrice = Number(primaryScaled) / 1e8;
    const checkPrice = Number(checkScaled) / 1e8;
    const deviationBps =
      (Math.abs(primaryPrice - checkPrice) / Math.min(primaryPrice, checkPrice)) * 10000;
    runtime.log(
      `Fresh reads: primary ${primaryPrice} check ${checkPrice} deviation ${Math.round(deviationBps)} bps.`,
    );
    if (deviationBps > bundle.pricePlan.maxDeviationBps) {
      decision = 'deferred';
      reasonCode = 'PRICE_DISAGREEMENT';
      runtime.log('Deviation beyond tolerance for a fresh read: decision deferred.');
    } else {
      entryScaled = primaryScaled;
    }
  }

  // Step 5: resolve report fields.
  const contributions = contributionRows(bundle);
  const approved = decision === 'approved';
  const terms = bundle.proposedTerms;
  let direction = 0;
  let stopScaled = 0n;
  let targetScaled = 0n;
  let sizeUnits = 0n;
  let openedAt = 0n;
  let expiresAt = 0n;
  if (approved) {
    if (entryScaled === null) {
      decision = 'deferred';
      reasonCode = 'PRICE_DISAGREEMENT';
      runtime.log('Entry price read failed for an approved case: decision deferred.');
    } else {
      const code = DIRECTION_CODES[terms.direction];
      if (code === undefined) {
        throw new Error(`Unknown proposed direction: ${terms.direction}`);
      }
      direction = code;
      if (terms.hasStructuredLevels && terms.stopPrice && terms.targetPrice) {
        stopScaled = decimalToScaled(terms.stopPrice, 8);
        targetScaled = decimalToScaled(terms.targetPrice, 8);
      } else if (terms.stopBps !== null && terms.targetBps !== null) {
        stopScaled = bpsScaled(entryScaled, terms.stopBps);
        targetScaled = bpsScaled(entryScaled, terms.targetBps);
      } else {
        throw new Error('Approved case without resolvable stop and target terms.');
      }
      const size = computedSize(bundle);
      if (size === null || size <= 0) {
        decision = 'deferred';
        reasonCode = 'MANDATE_SIZE';
        runtime.log('Paper size could not be computed for an approved case: decision deferred.');
      } else {
        sizeUnits = BigInt(size) * 100n;
        openedAt = scheduledAt;
        if (!terms.expiresAt) {
          throw new Error('Approved case without an expiry.');
        }
        expiresAt = BigInt(Math.floor(new Date(terms.expiresAt).getTime() / 1000));
        if (expiresAt < openedAt) {
          throw new Error(
            `Resolved position window is invalid: openedAt ${openedAt} after expiresAt ${expiresAt}.`,
          );
        }
      }
    }
  }

  // Step 6: encode, sign and deliver.
  const verdictPayload = encodeVerdictPayload({
    caseHash: bundle.bundleHash as `0x${string}`,
    rulesetHash: bundle.rulesetHash as `0x${string}`,
    assetHash: assetHashOf(bundle.asset.assetKey),
    caseKind: bundle.caseKind === 'individual_call' ? 1 : 0,
    decision: decision === 'approved' ? 0 : decision === 'rejected' ? 1 : 2,
    reason: reasonCodeToUint8(reasonCode),
    direction,
    entryPrice1e8: entryScaled ?? 0n,
    stopPrice1e8: stopScaled,
    targetPrice1e8: targetScaled,
    sizeUnits,
    openedAt,
    expiresAt,
    chainSelector: SEPOLIA_CHAIN_SELECTOR,
    scheduledAt,
    sourceHashes: contributions.map((row) => row.sourceHash),
    callHashes: contributions.map((row) => row.callHash),
    convictions: contributions.map((row) => row.conviction),
  });
  runtime.log(`Encoded verdict payload ${verdictPayload}.`);

  const networkInfo = getNetwork({
    chainFamily: 'evm',
    chainSelectorName: runtime.config.chainName,
    isTestnet: true,
  });
  if (!networkInfo) {
    throw new Error(`Network not found: ${runtime.config.chainName}`);
  }
  const evmClient = new cre.capabilities.EVMClient(networkInfo.chainSelector.selector);
  const report = runtime.report({
    encodedPayload: hexToBase64(verdictPayload),
    encoderName: 'evm',
    signingAlgo: 'ecdsa',
    hashingAlgo: 'keccak256',
  }).result();
  const write = evmClient.writeReport(runtime, {
    receiver: runtime.config.receiver,
    report,
    gasConfig: { gasLimit: runtime.config.gasLimit },
  }).result();
  if (write.txStatus !== TxStatus.SUCCESS) {
    throw new Error(`Report delivery failed: ${write.errorMessage ?? 'unknown error'}`);
  }

  // Step 7: run log.
  const summary =
    `eventId=${candidate.eventId} decision=${decision} reason=${reasonCode ?? 'None'} ` +
    `bundleHash=${bundle.bundleHash} tx=${bytesToHex(write.txHash ?? new Uint8Array())}`;
  runtime.log(`Filed verdict. ${summary}`);
  return summary;
}

export function initWorkflow(config: Config) {
  const cron = new cre.capabilities.CronCapability();
  return [cre.handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)];
}
