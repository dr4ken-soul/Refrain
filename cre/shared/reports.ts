/**
 * Report encoding for RefrainLedger, mirroring the tuple encoders in
 * contracts/test/refrainLedger.test.ts. A struct with dynamic members must
 * be ABI encoded as a single element tuple containing the struct, then
 * wrapped as (uint8 kind, bytes body); flat type lists only match the
 * Solidity abi.decode(data, (Struct)) layout when every member is static.
 *
 * callHash mirrors apps/api/api/repository.py: keccak256 over the canonical
 * JSON bytes of the frozen call identity, not the mutable display text.
 */
import {
  canonicalJson,
} from './canonical';
import type { ContributingCall, EvidenceBundle } from './rules';
import { encodeAbiParameters, decodeAbiParameters, keccak256, parseAbiParameters, toBytes } from 'viem';

export const VERDICT_TUPLE_TYPE =
  '(bytes32,bytes32,bytes32,uint8,uint8,uint8,uint8,uint256,uint256,uint256,uint256,uint64,uint64,uint64,uint64,bytes32[],bytes32[],uint8[])';
export const SETTLEMENT_TUPLE_TYPE =
  '(uint256,uint8,uint256,int256,uint64,uint64,bytes32[],bytes32[],int256[])';

/** getPosition() return layout on RefrainLedger: every member is static. */
export const POSITION_RETURN_TYPE =
  '(bytes32,uint8,uint8,uint256,uint256,uint256,uint256,uint64,uint64,bool,uint8,uint256,int256,bytes32)';

export interface VerdictReportValues {
  caseHash: `0x${string}`;
  rulesetHash: `0x${string}`;
  assetHash: `0x${string}`;
  caseKind: number;
  decision: number;
  reason: number;
  direction: number;
  entryPrice1e8: bigint;
  stopPrice1e8: bigint;
  targetPrice1e8: bigint;
  sizeUnits: bigint;
  openedAt: bigint;
  expiresAt: bigint;
  chainSelector: bigint;
  scheduledAt: bigint;
  sourceHashes: readonly `0x${string}`[];
  callHashes: readonly `0x${string}`[];
  convictions: readonly number[];
}

export interface SettlementReportValues {
  positionId: bigint;
  exitReason: number;
  exitPrice1e8: bigint;
  pnlUnits: bigint;
  chainSelector: bigint;
  scheduledAt: bigint;
  sourceHashes: readonly `0x${string}`[];
  callHashes: readonly `0x${string}`[];
  scoreDeltas: readonly bigint[];
}

const VERDICT_PARAMS = parseAbiParameters(VERDICT_TUPLE_TYPE);
const SETTLEMENT_PARAMS = parseAbiParameters(SETTLEMENT_TUPLE_TYPE);
const POSITION_PARAMS = parseAbiParameters(POSITION_RETURN_TYPE);
const ARRAYS_PARAMS = parseAbiParameters('bytes32[],bytes32[]');
const WRAPPER_PARAMS = parseAbiParameters('uint8,bytes');

const KIND_VERDICT = 1;
const KIND_SETTLEMENT = 2;

/** (uint8 kind, bytes body) wrapper, kind 1: VerdictReport. */
export function encodeVerdictPayload(report: VerdictReportValues): `0x${string}` {
  const body = encodeAbiParameters(VERDICT_PARAMS, [
    [
      report.caseHash,
      report.rulesetHash,
      report.assetHash,
      report.caseKind,
      report.decision,
      report.reason,
      report.direction,
      report.entryPrice1e8,
      report.stopPrice1e8,
      report.targetPrice1e8,
      report.sizeUnits,
      report.openedAt,
      report.expiresAt,
      report.chainSelector,
      report.scheduledAt,
      report.sourceHashes as `0x${string}`[],
      report.callHashes as `0x${string}`[],
      report.convictions,
    ],
  ]);
  return encodeAbiParameters(WRAPPER_PARAMS, [KIND_VERDICT, body]);
}

/** (uint8 kind, bytes body) wrapper, kind 2: SettlementReport. */
export function encodeSettlementPayload(report: SettlementReportValues): `0x${string}` {
  const body = encodeAbiParameters(SETTLEMENT_PARAMS, [
    [
      report.positionId,
      report.exitReason,
      report.exitPrice1e8,
      report.pnlUnits,
      report.chainSelector,
      report.scheduledAt,
      report.sourceHashes as `0x${string}`[],
      report.callHashes as `0x${string}`[],
      report.scoreDeltas,
    ],
  ]);
  return encodeAbiParameters(WRAPPER_PARAMS, [KIND_SETTLEMENT, body]);
}

/** Decode a getPosition() reply into its raw tuple values, by ABI order. */
export interface PositionValues {
  caseHash: `0x${string}`;
  caseKind: number;
  direction: number;
  entryPrice1e8: bigint;
  stopPrice1e8: bigint;
  targetPrice1e8: bigint;
  sizeUnits: bigint;
  openedAt: bigint;
  expiresAt: bigint;
  settled: boolean;
  exitReason: number;
  settledExitPrice1e8: bigint;
  pnlUnits: bigint;
  contributorsCommit: `0x${string}`;
}

export function decodePosition(data: Uint8Array): PositionValues {
  const decoded = decodeAbiParameters(POSITION_PARAMS, data)[0] as [
    `0x${string}`, number, number, bigint, bigint, bigint, bigint, bigint, bigint,
    boolean, number, bigint, bigint, `0x${string}`,
  ];
  const [
    caseHash, caseKind, direction, entryPrice1e8, stopPrice1e8, targetPrice1e8,
    sizeUnits, openedAt, expiresAt, settled, exitReason, settledExitPrice1e8,
    pnlUnits, contributorsCommit,
  ] = decoded;
  return {
    caseHash,
    caseKind,
    direction,
    entryPrice1e8,
    stopPrice1e8,
    targetPrice1e8,
    sizeUnits,
    openedAt,
    expiresAt,
    settled,
    exitReason,
    settledExitPrice1e8,
    pnlUnits,
    contributorsCommit,
  };
}

/** The contributor commitments a verdict carries: one per independent voice. */
export interface ContributionRow {
  sourceHash: `0x${string}`;
  callHash: `0x${string}`;
  conviction: number;
}

export function callHashFor(calls: ContributingCall[], callId: string): `0x${string}` {
  const row = calls.find((candidate) => candidate.callId === callId);
  if (!row) {
    throw new Error(`Call ${callId} is not among the contributing calls.`);
  }
  const frozen = {
    callId: row.callId,
    sourceHash: row.sourceHash,
    messageId: row.messageId,
    timestamp: row.timestamp,
    direction: row.direction,
    conviction: row.conviction,
    narrativeTags: row.narrativeTags,
    span: row.span,
  };
  return keccak256(toBytes(canonicalJson(frozen)));
}

export function contributionRows(bundle: EvidenceBundle): ContributionRow[] {
  const rows: ContributionRow[] = [];
  for (const voice of bundle.voices) {
    if (voice.copied) {
      continue;
    }
    rows.push({
      sourceHash: voice.sourceHash as `0x${string}`,
      callHash: callHashFor(bundle.evidence.contributingCalls, voice.callIds[0]),
      conviction: voice.conviction,
    });
  }
  return rows;
}

/** keccak256(abi.encode(sourceHashes, callHashes)) as enforced on-chain. */
export function contributorsCommit(
  sourceHashes: readonly `0x${string}`[],
  callHashes: readonly `0x${string}`[],
): `0x${string}` {
  return keccak256(encodeAbiParameters(ARRAYS_PARAMS, [
    sourceHashes as `0x${string}`[],
    callHashes as `0x${string}`[],
  ]));
}

/** keccak256(assetKey); narrative cases hash the empty key. */
export function assetHashOf(assetKey: string | null): `0x${string}` {
  return keccak256(toBytes(assetKey ?? ''));
}
