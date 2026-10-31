export interface Asset {
  assetKey: string;
  chain: string;
  contractAddress: string;
  pair: string | null;
  ticker: string;
}

export interface Call {
  id: string;
  eventId: string;
  timestamp: string;
  sourceHash: string;
  sourceLabel: string;
  assetKey: string;
  ticker: string;
  direction: 'long' | 'short' | 'spot_buy' | string;
  entryPrice: string | null;
  stopPrice: string | null;
  targetPrice: string | null;
  conviction: number;
  urgency: number | null;
  parser: string;
  isAdvertisement: boolean;
  filterReason: string | null;
  duplicateOf: string | null;
  narrativeTags: string[];
  span: [number, number] | null;
  excerpt: string;
  contentHash: string | null;
  urls: string[];
  sourceUrl: string | null;
  callHash: string | null;
}

export interface RuleResult {
  rule: string;
  displayName: string;
  pass: boolean;
  evidence: string;
}

export interface Position {
  positionId: number;
  caseHash: string;
  status: 'open' | 'settled';
  direction: string;
  entryPrice: string;
  stopPrice: string;
  targetPrice: string;
  sizeUsdCents: number;
  sizeUsd: number;
  openedAt: string;
  expiresAt: string;
  exitPrice: string | null;
  exitReason: string | null;
  pnlUnits: number | null;
  contributorsCommit: string;
  openTxHash: string | null;
  settleTxHash: string | null;
}

export interface CaseFile {
  eventId: string;
  caseKind: string;
  asset: Asset;
  level: string;
  window: { startedAt: string; closedAt: string };
  windowHours: number;
  evaluatedAt: string;
  independentVoiceCount: number;
  timingSpreadSeconds: number;
  weightedConviction: string;
  bundleHash: string;
  rulesetHash: string;
  rulesetVersion: number;
  decision: 'approved' | 'rejected' | 'deferred';
  reasonCode: string | null;
  ruleResults: RuleResult[];
  explanation: string;
  contributions: Array<{
    callId: string;
    sourceHash: string;
    sourceLabel: string;
    callHash: string;
    conviction: number;
    timestamp: string;
    messageId: number;
    direction: string;
    narrativeTags: string[];
    span: [number, number];
    sourceUrl: string | null;
  }>;
  posts: Call[];
  terms: {
    direction: string;
    expiresAt: string;
    hasStructuredLevels: boolean;
    sizeUnits: number | null;
    stopBps: number | null;
    stopPrice: string | null;
    targetBps: number | null;
    targetPrice: string | null;
  };
  pricePlan: {
    primary: { kind: string; locator: string };
    check: { kind: string; locator: string };
    maxDeviationBps: number;
  };
  entryObservations: Array<{
    kind: string;
    locator: string;
    observedAt: string;
    price: string | number;
    liquidityUsd?: number;
  }>;
  reliability: Array<{ sourceHash: string; scoreHundredths: number; origin: string }>;
  position: Position | null;
  filing: {
    txHash: string | null;
    block: number | null;
    filedAt: string | null;
    scheduledAt: string | null;
  };
  settlement: null | Record<string, unknown>;
  scoreEffects: Array<{ sourceHash: string; delta: number }>;
  replay: {
    bundleHash: string;
    rulesetHash: string;
    rulesetVersion: number;
    caseHash: string;
    verdictTx: string | null;
    settlementTx: string | null;
  };
}

export interface CaseDetail {
  event: CaseFile;
  bundle: Record<string, unknown>;
  run: CreRun | null;
}

export interface Board {
  mode: 'live' | 'replay';
  label: string;
  newestIngestAt: string;
  updatedAt: string;
  channelsMonitored: number;
  callsParsed: number;
  realFundsAtRisk: number;
  latestCalls: Call[];
  featuredEventId: string | null;
  latestVerdictEventId: string | null;
  counts: Metrics;
  chain: {
    chainId: number;
    chainName: string;
    ledger: string;
    deployer: string;
    explorer: string;
  };
}

export interface Metrics {
  callsParsed: number;
  convergenceEvents: number;
  paperPositionsOpened: number;
  tradesRejected: number;
  positionsSettled: number;
}

export interface Kol {
  id: string;
  handle: string;
  displayName: string;
  role: string;
  platform: string;
  isActive: boolean;
  sourceHash: string;
  note?: string;
  callsTracked: number;
  wins: number;
  losses: number;
  expired: number;
  promotionFlags: number;
  score: number;
  origin: string;
  latestCall: string | null;
  scoreHistory: Array<{ date: string; delta: number; reason: string }>;
  recentCalls: Call[];
  flags: string[];
}

export interface Ruleset {
  version: number;
  name: string;
  hash: string;
  active: boolean;
  createdAt: string;
  config: Record<string, unknown>;
  previousHash?: string;
}

export interface RulesResponse {
  activeVersion: number;
  versions: Ruleset[];
}

export interface CreRun {
  runId: string;
  workflow: string;
  eventId: string | null;
  bundleHash: string | null;
  decision: string | null;
  reasonCode: string | null;
  mode: string;
  outcome: string;
  recordedAt: string;
  txHash: string | null;
  block: number | null;
  log: string;
  logLines: string[];
}

export interface Rejection {
  eventId: string;
  ticker: string;
  assetKey: string;
  reasonCode: string;
  decidedAt: string;
  windowStartedAt: string;
  windowClosedAt: string;
  independentVoiceCount: number;
  direction: string | null;
  verdictTx: string | null;
  ruleResults: RuleResult[];
}

export interface ReplayStatus {
  mode: 'live' | 'replay';
  label: string;
  newestIngestAt: string;
  staleAfterMinutes: number;
  reason: string;
  replaySet: string;
  generatedAt: string;
}
