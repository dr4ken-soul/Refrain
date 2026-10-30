/**
 * Market source parsers, mirroring packages/engine/market.py exactly.
 *
 * These run inside CRE node functions: fetch the body, parse here, never
 * substitute a failed source. Parse failures and empty results return null
 * so the workflow can record the omission instead of inventing a price.
 *
 * Recorded prices stay source-text strings; the numeric area exists only
 * for comparisons and scaled report integers.
 */
import { decimalToScaled } from './canonical';

export interface PriceResult {
  kind: string;
  priceScaled1e8: bigint | null;
  liquidityUsd: number | null;
  locator: string | null;
}

interface DexscreenerPayload {
  pairs?: Array<{
    chainId?: string;
    pairAddress?: string;
    priceUsd?: string;
    baseToken?: { address?: string } | null;
    liquidity?: { usd?: number | null };
  }> | null;
}

interface GeckoPoolsPayload {
  data?: Array<{
    attributes?: {
      address?: string | null;
      reserve_in_usd?: string | number | null;
      base_token_price_usd?: string | number | null;
      quote_token_price_usd?: string | number | null;
    };
    relationships?: {
      base_token?: { data?: { id?: string } | null } | null;
      quote_token?: { data?: { id?: string } | null } | null;
    } | null;
  }> | null;
}

/**
 * Mirror market.observe_asset dexscreener pass: the same-chain pair with the
 * largest liquidity where the queried token is the pair's base side, since
 * priceUsd belongs to the base token.
 */
export function parseDexscreener(
  body: string,
  network: string,
  address: string,
): PriceResult['priceScaled1e8'] {
  let payload: DexscreenerPayload;
  try {
    payload = JSON.parse(body) as DexscreenerPayload;
  } catch {
    return null;
  }
  const wanted = address.toLowerCase();
  let best: { liquidity: number; price: string } | null = null;
  for (const pair of payload.pairs ?? []) {
    if (typeof pair !== 'object' || pair === null) {
      continue;
    }
    if ((pair.chainId ?? '').toLowerCase() !== network) {
      continue;
    }
    if ((pair.baseToken?.address ?? '').toLowerCase() !== wanted) {
      continue;
    }
    const liquidity = pair.liquidity?.usd;
    if (liquidity !== null && liquidity !== undefined && (best === null || liquidity > best.liquidity)) {
      best = { liquidity, price: String(pair.priceUsd ?? '') };
    }
  }
  if (!best || !best.price) {
    return null;
  }
  try {
    return decimalToScaled(best.price, 8);
  } catch {
    return null;
  }
}

/**
 * Mirror market.observe_asset geckoterminal pass: among the token's pools,
 * the largest reserve, with the price read from the pool side that matches
 * the queried token (a pool where the token is the quote side carries the
 * other asset's price in base_token_price_usd).
 */
export function parseGeckoterminal(
  body: string,
  network: string,
  address: string,
): PriceResult['priceScaled1e8'] {
  let payload: GeckoPoolsPayload;
  try {
    payload = JSON.parse(body) as GeckoPoolsPayload;
  } catch {
    return null;
  }
  const tokenId = `${network}_${address}`;
  let best: { reserve: number; price: string } | null = null;
  for (const entry of payload.data ?? []) {
    const attributes = entry.attributes;
    if (!attributes) {
      continue;
    }
    const relationships = entry.relationships ?? {};
    const baseId = relationships.base_token?.data?.id;
    const quoteId = relationships.quote_token?.data?.id;
    let price: string | number | null | undefined;
    if (baseId === tokenId) {
      price = attributes.base_token_price_usd;
    } else if (quoteId === tokenId) {
      price = attributes.quote_token_price_usd;
    } else {
      continue;
    }
    const reserve = Number(attributes.reserve_in_usd);
    if (price === null || price === undefined || !Number.isFinite(reserve) || reserve <= 0) {
      continue;
    }
    if (best === null || reserve > best.reserve) {
      best = { reserve, price: String(price) };
    }
  }
  if (best === null) {
    return null;
  }
  try {
    return decimalToScaled(best.price, 8);
  } catch {
    return null;
  }
}

/** Mirror market.observe_pair binance pass: ticker price for a listed pair. */
export function parseBinance(body: string): PriceResult['priceScaled1e8'] {
  let payload: { price?: string };
  try {
    payload = JSON.parse(body) as { price?: string };
  } catch {
    return null;
  }
  if (!payload.price) {
    return null;
  }
  try {
    return decimalToScaled(String(payload.price), 8);
  } catch {
    return null;
  }
}

/** Mirror market.observe_pair bybit pass: spot tickers list first row. */
export function parseBybit(body: string): PriceResult['priceScaled1e8'] {
  let payload: { result?: { list?: Array<{ lastPrice?: string }> } };
  try {
    payload = JSON.parse(body) as { result?: { list?: Array<{ lastPrice?: string }> } };
  } catch {
    return null;
  }
  const first = (payload.result?.list ?? [])[0];
  if (!first || !first.lastPrice) {
    return null;
  }
  try {
    return decimalToScaled(String(first.lastPrice), 8);
  } catch {
    return null;
  }
}

export interface OhlcvCandle {
  /** Unix seconds of the candle open. */
  timestamp: number;
  /** Prices scaled by 1e8. */
  openScaled: bigint;
  highScaled: bigint;
  lowScaled: bigint;
  closeScaled: bigint;
}

/** GeckoTerminal ohlcv_list entries: [ts, open, high, low, close, volume]. */
function scaledFromDouble(value: unknown, field: string): bigint {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    throw new Error(`Not a positive candle field: ${field}`);
  }
  return decimalToScaled(String(asNumber), 8);
}

interface GeckoOhlcvPayload {
  data?: {
    attributes?: {
      ohlcv_list?: Array<[number, number, number, number, number, number]> | null;
    };
  };
}

/**
 * Parse GeckoTerminal OHLCV into ascending candles. Live candles excluded
 * upstream: callers request a closed range so every node sees the same
 * body and identical consensus can commit it.
 */
export function parseOhlcv(body: string): OhlcvCandle[] {
  let payload: GeckoOhlcvPayload;
  try {
    payload = JSON.parse(body) as GeckoOhlcvPayload;
  } catch {
    return [];
  }
  const list = payload.data?.attributes?.ohlcv_list ?? [];
  const candles: OhlcvCandle[] = [];
  for (const entry of list) {
    if (!Array.isArray(entry) || entry.length < 5) {
      continue;
    }
    try {
      candles.push({
        timestamp: Number(entry[0]),
        openScaled: scaledFromDouble(entry[1], 'open'),
        highScaled: scaledFromDouble(entry[2], 'high'),
        lowScaled: scaledFromDouble(entry[3], 'low'),
        closeScaled: scaledFromDouble(entry[4], 'close'),
      });
    } catch {
      continue;
    }
  }
  candles.sort((left, right) => left.timestamp - right.timestamp);
  return candles;
}

/**
 * First touch over ascending candles. Inside one candle crossing both
 * levels, the stop is treated as touched first. Exits fill at the level.
 */
export function firstTouch(
  candles: OhlcvCandle[],
  direction: number,
  stopScaled: bigint,
  targetScaled: bigint,
): { reason: 'target' | 'stop'; exitScaled: bigint } | null {
  const isShort = direction === 1;
  for (const candle of candles) {
    if (isShort) {
      const stopTouched = candle.highScaled >= stopScaled;
      const targetTouched = candle.lowScaled <= targetScaled;
      if (stopTouched) {
        return { reason: 'stop', exitScaled: stopScaled };
      }
      if (targetTouched) {
        return { reason: 'target', exitScaled: targetScaled };
      }
      continue;
    }
    // long and spot_buy both profit when price rises
    const stopTouched = candle.lowScaled <= stopScaled;
    const targetTouched = candle.highScaled >= targetScaled;
    if (stopTouched) {
      return { reason: 'stop', exitScaled: stopScaled };
    }
    if (targetTouched) {
      return { reason: 'target', exitScaled: targetScaled };
    }
  }
  return null;
}
