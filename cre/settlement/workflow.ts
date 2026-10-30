/**
 * Refrain settlement workflow.
 *
 * One cron invocation settles one open paper position, per the
 * APP_BLUEPRINT.md CRE Integration Detail:
 *
 *   1. GET {apiBase}/cre/due-positions, identical consensus. Take the
 *      oldest candidate; none means log and exit.
 *   2. Read the position terms from RefrainLedger through
 *      EVMClient.callContract; the chain record, not the API response,
 *      supplies entry, stop, target and expiry.
 *   3. Fetch outcome candles for the recorded pricePlan pair with
 *      identical consensus over a fully closed bucket range, then apply
 *      first-touch logic. Inside one candle crossing both levels the stop
 *      is treated as touched first.
 *   4. With no closed-range touch, the current price supplies the
 *      checkpoint: beyond the stop files STOP at the stop level, beyond
 *      the target files TARGET at the target level, otherwise the
 *      position stays open until its expiry passes and only then files
 *      Expiry at the current price.
 *   5. Compute the paper result in cents and one bounded score delta per
 *      contributing voice: wins gain in proportion to recorded
 *      conviction, losses lose on the same scale, expiry returns move a
 *      quarter step toward neutral. Deltas clamp to -500 to 500.
 *   6. Verify the bundle contributor lists hash to the position's recorded
 *      commitments, ABI-encode the SettlementReport, sign it with
 *      runtime.report and write it to RefrainLedger.
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
import {
  bytesToHex,
  decodeAbiParameters,
  encodeFunctionData,
  parseAbi,
  parseAbiParameters,
} from 'viem';
import { z } from 'zod';
import { firstTouch, parseDexscreener, parseGeckoterminal, parseOhlcv, type OhlcvCandle } from '../shared/market';
import type { EvidenceBundle } from '../shared/rules';
import {
  contributionRows,
  decodePosition,
  encodeSettlementPayload,
  contributorsCommit,
} from '../shared/reports';

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

const LEDGER_ABI = parseAbi([
  'function getPosition(uint256 positionId) view returns (bytes32, uint8, uint8, uint256, uint256, uint256, uint256, uint64, uint64, bool, uint8, uint256, int256, bytes32)',
  'function getScore(bytes32 sourceHash) view returns (int256)',
]);

const SCORE_PARAMS = parseAbiParameters('int256');

const WIN_DELTA_PER_POINT = 5n;
const LOSS_DELTA_PER_POINT = 5n;
const EXPIRY_STEP = 125n;
const NEUTRAL_SCORE = 5000n;
const DELTA_CLAMP = 500n;

interface DueCandidate {
  positions: Array<{
    positionId: number;
    eventId: string;
    caseHash: string;
  }>;
}

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

function currentPriceFetcher(runtime: Runtime<Config>) {
  const httpClient = new cre.capabilities.HTTPClient();
  return httpClient.sendRequest(
    runtime,
    (requester, kind: string, url: string, network: string, address: string) => {
      const response = requester.sendRequest({ url, method: 'GET' }).result();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`HTTP ${response.statusCode} for ${url}`);
      }
      const body = text(response);
      const scaled = kind === 'dexscreener'
        ? parseDexscreener(body, network, address)
        : kind === 'geckoterminal'
          ? parseGeckoterminal(body, network, address)
          : null;
      if (scaled === null) {
        throw new Error(`No current price for ${kind} at ${url}`);
      }
      return scaled;
    },
    consensusMedianAggregation<bigint>(),
  );
}

/** size * (exit - entry) / entry in cents, half away from zero. */
function pnlCents(sizeUnits: bigint, entryScaled: bigint, exitScaled: bigint, direction: number): bigint {
  if (entryScaled === 0n) {
    throw new Error('Position entry price is zero.');
  }
  const rawDelta = direction === 1 ? entryScaled - exitScaled : exitScaled - entryScaled;
  const numerator = sizeUnits * rawDelta;
  const magnitude = numerator < 0n ? -numerator : numerator;
  const rounded = (magnitude * 2n + entryScaled) / (entryScaled * 2n);
  return numerator < 0n ? -rounded : rounded;
}

function instrumentOf(assetKey: string): string {
  const index = assetKey.indexOf(':');
  return index < 0 ? assetKey : assetKey.slice(index + 1);
}

async function onCronTrigger(runtime: Runtime<Config>, _payload: CronPayload): Promise<string> {
  const now = runtime.now();
  const nowSeconds = BigInt(Math.floor(now.getTime() / 1000));
  runtime.log(`Settlement run at ${now.toISOString()}.`);

  // Step 1: oldest due candidate.
  const bearer = runtime.getSecret({ id: 'CRE_BEARER_SECRET' }).result().value;
  const fetchText = textFetcher(runtime, bearer);
  const currentPriceFetch = currentPriceFetcher(runtime);
  const dueRaw = await fetchText(`${runtime.config.apiBase}/cre/due-positions`).result();
  const due = JSON.parse(dueRaw) as DueCandidate;
  const candidate = due.positions?.[0];
  if (!candidate) {
    runtime.log('No open positions due for settlement. Nothing to file.');
    return 'no due positions';
  }
  runtime.log(`Oldest due position ${candidate.positionId} for event ${candidate.eventId}.`);

  // Step 2: chain record supplies the terms.
  const networkInfo = getNetwork({
    chainFamily: 'evm',
    chainSelectorName: runtime.config.chainName,
    isTestnet: true,
  });
  if (!networkInfo) {
    throw new Error(`Network not found: ${runtime.config.chainName}`);
  }
  const evmClient = new cre.capabilities.EVMClient(networkInfo.chainSelector.selector);
  const callData = encodeFunctionData({
    abi: LEDGER_ABI,
    functionName: 'getPosition',
    args: [BigInt(candidate.positionId)],
  });
  const positionReply = evmClient.callContract(runtime, {
    call: { to: runtime.config.receiver, data: callData },
  }).result();
  const position = decodePosition(positionReply.data);
  runtime.log(
    `Chain position ${candidate.positionId}: caseHash ${position.caseHash} settled=${position.settled} ` +
    `entry ${position.entryPrice1e8} stop ${position.stopPrice1e8} target ${position.targetPrice1e8} ` +
    `expiry ${position.expiresAt}.`,
  );
  if (position.settled) {
    runtime.log(`Position ${candidate.positionId} is already settled. Nothing to file.`);
    return 'already settled';
  }
  if (position.entryPrice1e8 === 0n || position.sizeUnits === 0n) {
    throw new Error(`Position ${candidate.positionId} has no resolved entry terms.`);
  }

  // Step 3: bundle contributor lists must hash to the recorded commitments.
  const bundleRaw = await fetchText(
    `${runtime.config.apiBase}/cre/events/${candidate.eventId}/bundle`,
  ).result();
  const bundle = JSON.parse(bundleRaw) as EvidenceBundle;
  if (!bundle.bundleHash || bundle.bundleHash.toLowerCase() !== position.caseHash.toLowerCase()) {
    throw new Error(
      `Position caseHash ${position.caseHash} does not match bundle hash ${bundle.bundleHash}.`,
    );
  }
  const contributions = contributionRows(bundle);
  const sources = contributions.map((row) => row.sourceHash);
  const calls = contributions.map((row) => row.callHash);
  const computedCommit = contributorsCommit(sources, calls);
  if (computedCommit.toLowerCase() !== position.contributorsCommit.toLowerCase()) {
    throw new Error(
      `Contributor mismatch for position ${candidate.positionId}: bundle commit ${computedCommit}, chain commit ${position.contributorsCommit}.`,
    );
  }

  // Step 4: closed-range candles for first touch, then the current price.
  const assetKey = bundle.asset.assetKey ?? '';
  const network = assetKey.startsWith('solana:') ? 'solana' : 'ethereum';
  const openHour = Number((position.openedAt / 3600n) * 3600n) - 3601;
  const hourStart = Number((nowSeconds / 3600n) * 3600n);
  const recordedPair = bundle.evidence.entryObservations.find(
    (row) => row.kind === bundle.pricePlan.primary.kind,
  );
  const pairLocator = recordedPair?.locator ?? '';
  const poolAddress = pairLocator.includes(':') ? pairLocator.slice(pairLocator.indexOf(':') + 1) : '';
  const candlesUrl = poolAddress
    ? `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/hour` +
      `?aggregate=1&limit=500&after_timestamp=${openHour}&before_timestamp=${hourStart}`
    : '';
  let candles: OhlcvCandle[] = [];
  if (candlesUrl) {
    const httpClient = new cre.capabilities.HTTPClient();
    const candleBody = httpClient.sendRequest(
      runtime,
      (requester, url: string) => {
        const response = requester.sendRequest({ url, method: 'GET' }).result();
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(`HTTP ${response.statusCode} for ${url}`);
        }
        return text(response);
      },
      consensusIdenticalAggregation<string>(),
    )(candlesUrl).result();
    candles = parseOhlcv(candleBody);
    runtime.log(`Fetched ${candles.length} closed outcome candles since entry.`);
  } else {
    runtime.log('No recorded pair locator in the bundle; settling on the current price only.');
  }

  const touch = firstTouch(candles, position.direction, position.stopPrice1e8, position.targetPrice1e8);
  let exitReason: number;
  let exitScaled: bigint;
  if (touch) {
    exitReason = touch.reason === 'target' ? 0 : 1;
    exitScaled = touch.exitScaled;
    runtime.log(`First touch in candles: ${touch.reason} at ${touch.exitScaled}.`);
  } else {
    const kind = bundle.pricePlan.primary.kind;
    const currentUrl = kind === 'binance'
      ? `https://api.binance.com/api/v3/ticker/price?symbol=${bundle.asset.pair ?? instrumentOf(assetKey)}`
      : kind === 'bybit'
        ? `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${bundle.asset.pair ?? instrumentOf(assetKey)}`
        : kind === 'dexscreener'
          ? `https://api.dexscreener.com/latest/dex/tokens/${instrumentOf(assetKey)}`
          : `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${instrumentOf(assetKey)}/pools`;
    const currentScaled = await currentPriceFetch(
      kind, currentUrl, network, instrumentOf(assetKey),
    ).result();
    const short = position.direction === 1;
    const long = !short; // direction 0 long and 2 spot_buy both rise to win
    if ((long && currentScaled <= position.stopPrice1e8)
      || (short && currentScaled >= position.stopPrice1e8)) {
      exitReason = 1;
      exitScaled = position.stopPrice1e8;
      runtime.log('Current price beyond the stop level: filing the paper stop.');
    } else if ((long && currentScaled >= position.targetPrice1e8)
      || (short && currentScaled <= position.targetPrice1e8)) {
      exitReason = 0;
      exitScaled = position.targetPrice1e8;
      runtime.log('Current price beyond the target level: filing the paper target.');
    } else if (nowSeconds >= position.expiresAt) {
      exitReason = 2;
      exitScaled = currentScaled;
      runtime.log(`Position expired at ${position.expiresAt}; filing expiry at the current price.`);
    } else {
      runtime.log(
        `Position ${candidate.positionId} has no touch and is not expired. Nothing to file.`,
      );
      return 'not due';
    }
  }

  // Step 5: paper result and bounded per-source deltas.
  const pnlUnits = pnlCents(position.sizeUnits, position.entryPrice1e8, exitScaled, position.direction);
  const scoreDeltas: bigint[] = [];
  for (let index = 0; index < contributions.length; index++) {
    const conviction = BigInt(contributions[index].conviction);
    let delta: bigint;
    if (exitReason === 2) {
      const scoreCallData = encodeFunctionData({
        abi: LEDGER_ABI,
        functionName: 'getScore',
        args: [sources[index]],
      });
      const scoreReply = evmClient.callContract(runtime, {
        call: { to: runtime.config.receiver, data: scoreCallData },
      }).result();
      const score = decodeAbiParameters(SCORE_PARAMS, scoreReply.data)[0] as bigint;
      const towardNeutral = NEUTRAL_SCORE - score;
      const step = (towardNeutral < 0n ? -towardNeutral : towardNeutral) < EXPIRY_STEP
        ? (towardNeutral < 0n ? -towardNeutral : towardNeutral)
        : EXPIRY_STEP;
      delta = towardNeutral < 0n ? -step : step;
      runtime.log(`Expiry step for source ${sources[index]}: score ${score}, delta ${delta}.`);
    } else if (exitReason === 0) {
      delta = WIN_DELTA_PER_POINT * conviction;
      if (delta > DELTA_CLAMP) {
        delta = DELTA_CLAMP;
      }
    } else {
      delta = -(LOSS_DELTA_PER_POINT * conviction);
      if (delta < -DELTA_CLAMP) {
        delta = -DELTA_CLAMP;
      }
    }
    scoreDeltas.push(delta);
  }

  // Step 6: encode, sign and deliver.
  const payload = encodeSettlementPayload({
    positionId: BigInt(candidate.positionId),
    exitReason,
    exitPrice1e8: exitScaled,
    pnlUnits,
    chainSelector: SEPOLIA_CHAIN_SELECTOR,
    scheduledAt: nowSeconds,
    sourceHashes: sources,
    callHashes: calls,
    scoreDeltas,
  });
  runtime.log(`Encoded settlement payload ${payload}.`);

  const report = runtime.report({
    encodedPayload: hexToBase64(payload),
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
  const summary =
    `positionId=${candidate.positionId} exitReason=${exitReason} exitPrice=${exitScaled} ` +
    `pnlUnits=${pnlUnits} tx=${bytesToHex(write.txHash ?? new Uint8Array())}`;
  runtime.log(`Filed settlement. ${summary}`);
  return summary;
}

export function initWorkflow(config: Config) {
  const cron = new cre.capabilities.CronCapability();
  return [cre.handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)];
}
