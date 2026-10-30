/**
 * Canonical JSON: identical bytes everywhere or nothing ships.
 *
 * Mirrors packages/shared-types/python/shared_types/canonical.py exactly:
 * keys sorted by Unicode code point, no insignificant whitespace, no NaN,
 * integers or fixed decimal strings for numbers, never floats. One fixture
 * test (cre/shared/fixture.test.ts against tests/test_cre_fixture.py)
 * proves the two implementations produce identical hashes.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, toBytes } from 'viem';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Sort by Unicode code point, matching Python string comparison. */
export function compareCodePoints(a: string, b: string): number {
  const aPoints = [...a];
  const bPoints = [...b];
  const length = Math.min(aPoints.length, bPoints.length);
  for (let index = 0; index < length; index++) {
    const left = aPoints[index].codePointAt(0) as number;
    const right = bPoints[index].codePointAt(0) as number;
    if (left !== right) {
      return left - right;
    }
  }
  return aPoints.length - bPoints.length;
}

export function canonicalJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Canonical JSON forbids non-finite numbers.');
    }
    if (!Number.isInteger(value)) {
      throw new Error('Canonical JSON forbids floats. Use strings for decimals.');
    }
    return String(value);
  }
  if (typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'string') {
    // JSON.stringify escapes ", \\, control characters and leaves non-ASCII
    // as raw UTF-8, exactly matching json.dumps(..., ensure_ascii=False).
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort(compareCodePoints);
    const members = keys.map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key]));
    return '{' + members.join(',') + '}';
  }
  throw new Error(`Canonical JSON cannot serialize ${typeof value}.`);
}

export function canonicalBytes(value: unknown): Uint8Array {
  return toBytes(canonicalJson(value));
}

export function sha256Hex(value: unknown): string {
  return bytesToHex(sha256(canonicalBytes(value)));
}

/**
 * The exact canonical bytes a bundle hash covers: every field, the bundle
 * hash itself excluded. Mirrors engine.bundle.canonical_bundle_bytes.
 */
export function canonicalBundleBytes(bundle: Record<string, unknown>): Uint8Array {
  const counted: Record<string, unknown> = { ...bundle };
  delete counted['bundleHash'];
  return canonicalBytes(counted);
}

export function bundleHash(bundle: Record<string, unknown>): string {
  return bytesToHex(sha256(canonicalBundleBytes(bundle)));
}

/**
 * Parse a decimal source-text string into an integer scaled by 10^scale
 * with half-up rounding, using string arithmetic only. Canonical bytes
 * never carry floats; prices are recorded as the exact source text.
 */
export function decimalToScaled(text: string, scale: number): bigint {
  const raw = (text ?? '').trim();
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(raw)) {
    throw new Error(`Not a decimal source text: ${JSON.stringify(text)}`);
  }
  const negative = raw.startsWith('-');
  const digits = raw.replace(/^[+-]/, '');
  const [whole = '0', fraction = ''] = digits.split('.');
  // Pad or truncate the fraction to exactly scale digits; the first dropped
  // digit decides half-up rounding.
  const kept = (fraction + '0'.repeat(scale)).slice(0, scale);
  const dropped = fraction.length > scale ? fraction[scale] : '';
  let scaled = BigInt((whole || '0') + kept);
  if (dropped !== '' && dropped >= '5') {
    scaled += 1n;
  }
  return negative ? -scaled : scaled;
}

/**
 * Weighted conviction from integer voices, mirroring
 * engine.convergence.apply_independence: Decimal ROUND_HALF_UP to 2 places.
 * Returns the fixed decimal string, for example '71.67'.
 */
export function weightedConvictionString(
  voices: Array<{ weightBps: number; conviction: number }>,
): string {
  let numerator = 0n;
  let denominator = 0n;
  for (const voice of voices) {
    numerator += BigInt(voice.weightBps) * BigInt(voice.conviction);
    denominator += BigInt(voice.weightBps);
  }
  if (denominator === 0n) {
    return '0.00';
  }
  // round_half_up(numerator * 100 / denominator), non-negative values only
  const cents = (numerator * 200n + denominator) / (denominator * 2n);
  const whole = cents / 100n;
  const fraction = cents % 100n;
  return `${whole}.${fraction.toString().padStart(2, '0')}`;
}
