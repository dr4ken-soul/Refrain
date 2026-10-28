# Refrain: App Blueprint

## Product Summary

Refrain is an autonomous evidence agent for crypto call channels. It monitors up to 20 user-selected public Telegram channels, extracts every market call into a structured record, and watches for the moment when separate voices converge on the same asset or the same narrative. A fixed, public mandate then decides whether that convergence becomes a paper position, a filed rejection or a deferral. A Chainlink CRE workflow fetches the frozen evidence bundle and market prices under consensus, replays the rule results and signs a report into a Sepolia ledger contract that records the verdict and the paper terms. A second CRE workflow settles due positions against recorded prices and moves each contributing channel's reliability score.

Built for BLI Legal Tech Hackathon 2 on DoraHacks, submission deadline 1 November 2026. One Build is entered for two bounties: the RYO-CHAN Autonomous Agents bounty at $6,000, whose spotlight is a multi-KOL narrative agent with transparent signal rules and user-defined risk limits, and the Chainlink Best Workflow with CRE bounty at two awards of $1,000, which requires a CRE workflow that integrates at least one blockchain with an external API, data source, LLM or AI agent and demonstrates a successful simulation or live deployment. The DoraHacks bounties page for this hackathon permits up to 10 bounty applications per Build, so one Build for both is the intended route.

CRE is load-bearing. Remove it and no verdict is filed, no paper position opens and no reliability score moves. The off-chain system proposes and explains, the CRE workflow files, and the ledger contract keeps the public record.

No real funds move at any point. The ledger contract cannot hold a balance, the collector never touches an exchange account and the frontend never asks for a wallet signature.

---

## Classification

Per CRYPTO_SKILL.md, Refrain is:

- **Category B, off-chain crypto tool:** it consumes Telegram data, DEX and exchange market APIs and chain reads, then presents a dashboard. Users do not sign transactions to use it.
- **Category C, AI agent for crypto:** an extraction agent interprets unstructured calls and narrative claims, while deterministic rules make and record practice decisions. There is no human approval step inside the demo loop, so the mandate is the control surface.
- **A narrow Category A surface:** one Sepolia consumer contract receives signed CRE reports. There is no token, no fee, no treasury wallet and no user custody, so the Category A fee and treasury sections of the skill do not apply. The on-chain-first rule does apply: a verdict is shown as filed only after the ledger transaction confirms, and the database mirrors the contract event afterwards.

---

## Market Context

**Who this is for:**

1. Retail and youth traders who follow Telegram call channels and currently have no way to tell independent agreement from one caller repeating a coin, a forwarded message copied across channels, or a pre-announced coordinated pump
2. Communities and trading groups that curate KOL lists and need a settled public record per voice, rather than screenshots chosen after the fact
3. Compliance and legal reviewers who need promotion evidence in one record: referral parameters, casino and exchange partner codes, scheduled call events and undisclosed paid placement language, each tied to the original post and the decision it produced

**What they currently use:** smart-money and KOL dashboards such as GMGN that rank wallets and surface trending tokens, raw alert feeds that report activity without judging it, and manual tracking in the Telegram app itself. None of these test whether several voices arrived at a claim independently, refuse trades on that basis, or file the refusal beside the position.

**Why they switch:** Refrain treats a KOL post as evidence rather than advice. The question it answers is narrow and useful: did separate voices reach the same claim on their own, under rules written down in advance, and what happened next.

**Post-hackathon direction, not in the MVP:** hosted watchlists with per-user mandates, a read API for convergence events and reliability scores, and additional source adapters for X and Discord where the user supplies authorised access. Monetisation would follow the Category B and C pattern of a subscription or per-query credit checked server-side. No revenue claim is made for the hackathon build.

---

## The Audited Watchlist

The demo watchlist is not invented. On 26 October 2026 all eight channels supplied by the project owner were read through their public Telegram web previews without any account login, which proves the collector can ingest them as public sources. Their roles come from that audit and are seed data, stored in the `sources` table rather than hardcoded in the interface.

| Handle | Role | Audit finding that shapes the build |
|---|---|---|
| CryptoVillaCalls | Core signal | Structured futures calls with pair, direction, entry, stop and target, plus explicit close instructions. Easiest deterministic parse. |
| LeveragLab | Core signal | Structured TA calls with entry zones, stop and three targets, then outcome updates such as an order being picked and a target being hit. |
| cryptolyxecalls | Core signal | Lower frequency, long written theses with cashtags, market-cap claims and one EVM contract address posted alone. Best input for narrative and conviction extraction. |
| CookersCooks | Meme radar | Buys announced through GMGN links, so the contract address sits inside the URL and the token name sits in the link preview title. |
| Blessedmemecalls | Meme radar | Cashtag theses and bare Solana contract addresses, mixed with casino deposit promotions carrying referral codes. |
| anittamaxwyn | Meme radar | Recent calls are a bare contract address with short follow-up claims about profit and market cap, with a small recent view count. Low starting trust weight. |
| brainssignals | Noisy source | Many posts are screenshots with no machine-readable text. Usable signal appears in quoted signal text, so reply and quote content must be parsed and media-only posts must be skipped without failing ingestion. |
| miladydegencalls | Red flag specimen | One contract repeated many times in a single day, extreme multiplier claims and a pre-announced timed call event with a referral bot link. This channel exists in the demo so the system can be seen refusing it. |

Two structural findings drive the convergence design. First, the watchlist holds two families that rarely name the same asset: memecoin callers working in contract addresses, and futures signal channels working in listed USDT pairs. Second, the audit already contained one narrative-level agreement, with privacy and Robinhood-chain themes appearing across separate channels within roughly two days. Convergence is therefore tested at two levels, defined under Feature 3.

---

## MVP Feature Set

### Feature 1: Public Channel Ingestion With Replay

**User story:** As the operator, I want every post from my watchlist stored with its original time and content hash, so that a verdict can be replayed later against exactly what was said.

**How it works:** A Python collector uses Telethon against a dedicated operator Telegram account to read the configured public channels, handling edit events, forwards and flood-wait responses. Each message is normalised into one `raw_posts` row keyed by source and Telegram message ID, with text, URLs pulled from message entities, forward origin, view count where present, and a SHA-256 content hash. A separate replay importer reads a frozen JSONL snapshot of channel history into the same tables, marked with `ingest_mode = replay`, so judging never depends on a live session.

**Acceptance criteria:** Running the collector twice over the same history creates no duplicate rows. Editing a message in Telegram updates the stored text and records an edit time while preserving the original post time. The replay importer rebuilds an empty database into the full demo state with one command.

**Complexity:** Medium

---

### Feature 2: Call Extraction

**User story:** As a reader of the board, I want every genuine call shown as asset, direction and levels with the exact span it came from, so that I can check the machine reading against the human post.

**How it works:** Deterministic parsers run first, in this order: structured futures blocks with pair, LONG or SHORT, entry, SL and TP fields; cashtags and USDT pair symbols; Solana base58 contract addresses of 32 to 44 characters, including the common `pump` suffix; EVM `0x` addresses; and contract addresses embedded in GMGN, Phantom and fomo URLs, with the token name taken from the message web preview where present. Close instructions and break-even moves parse as exit events, not as new calls. Posts that match partner, casino, referral or deposit-promotion patterns are classified as advertisements and stored with a filter reason. Only the remaining unstructured text reaches the language model, which returns asset mentions, sentiment, conviction from 0 to 100, urgency from 0 to 100 and narrative tags in a fixed JSON schema. Every extracted call keeps the character span it was read from, so the frontend can draw the recognition box on the source text.

**Acceptance criteria:** A fixture set built from the audited post shapes passes: a structured long with three targets, a bare Solana address, a GMGN link with no ticker in the text, a casino promotion classified as an advertisement, a close instruction classified as an exit, and a media-only post skipped with a recorded reason. Any language-model response that fails the JSON schema is discarded and logged, never repaired by guessing.

**Complexity:** High

---

### Feature 3: Two-Level Convergence Detection

**User story:** As a trader following many channels, I want agreement counted only when separate voices reach the same claim without copying, so that volume from one caller cannot dress itself up as consensus.

**How it works:** Calls are grouped into candidate events at two levels. Level 1 groups by canonical asset key: chain and contract address where an address exists, otherwise the listed pair. Level 2 groups by narrative key, where the language model tags the theme, for example privacy coins, Robinhood chain, AI agents or a named ecosystem meta, and separate assets inside one theme can form a narrative event. Each event computes the count of independent voices, where independence removes forwarded posts, collapses every repeat by one channel inside the window into a single opinion, and down-weights channels that share referral markers inside the same window. The event records timing spread, reliability-weighted conviction and the full ordered call list, then freezes as an evidence bundle with a content hash once the mandate evaluates it.

**Acceptance criteria:** Nine posts about one contract from one channel inside one hour produce an independent voice count of one. A forwarded call contributes zero to the count and is labelled as copied evidence. Three separate channels naming one pair inside the listed window produce a candidate event with a spread equal to the difference between the first and last independent call.

**Complexity:** High

---

### Feature 4: Mandate Decision and CRE Filing

**User story:** As the mandate owner, I want fixed public rules to decide every candidate event and a Chainlink CRE workflow to file that decision on Sepolia, so that the record cannot be edited after the outcome is known.

**How it works:** The active ruleset is a versioned JSON document with a SHA-256 hash. It sets the independent-voice threshold, per-family time windows, weighted conviction floor, liquidity floor, paper size cap and scaling, default stop, target and expiry per family, price agreement tolerances and the promotion veto. The off-chain evaluator applies the rules to a frozen bundle and produces a decision with a reason code: APPROVED, or REJECTED with one of a fixed code list, or DEFERRED where a price source disagrees or data is incomplete. The CRE verdict workflow then fetches the same bundle and the entry price data under DON consensus, recomputes the bundle hash and the rule results inside the workflow, and writes one signed report to the RefrainLedger contract. The contract stores the case hash, ruleset hash, decision, reason code and, for approvals, the paper terms. The database marks the event filed only after the contract event is observed.

**Acceptance criteria:** `cre workflow simulate` completes a dry run against a frozen bundle and prints the same decision and rule results as the off-chain evaluator. A broadcast simulation files one verdict on Sepolia, and re-running the same bundle is refused by the contract because the case hash already exists. Changing one character in the bundle makes the workflow stop before any report is signed.

**Complexity:** High

---

### Feature 5: Settlement and Reliability Scoring

**User story:** As a reader of the KOL index, I want each channel's score to move only from settled outcomes, so that reputation cannot be farmed by posting more often.

**How it works:** The CRE settlement workflow finds positions whose stop, target or expiry may have been reached, fetches outcome candles or prices from the recorded source pair under consensus, and applies first-touch logic: whichever of stop, target or expiry occurred first closes the position. Structured futures calls also settle their individual call records against their own stated stop and first target, which is how channels that rarely converge still build a record. Score deltas are computed inside the workflow from the settled result and the call's recorded conviction, signed into a settlement report, and applied by the contract as bounded integer deltas per channel hash. The API mirrors the contract events into readable score history.

**Acceptance criteria:** A position whose recorded candles touch the target before the stop settles as a win at the target price, and the reverse ordering settles as a loss at the stop. A settlement report for an already settled position is refused. Score history in the interface matches the sequence of contract settlement events one for one.

**Complexity:** High

---

### Feature 6: Public Evidence Interface

**User story:** As a hackathon judge, I want to open one page and inspect a live decision from raw post to filed verdict without connecting a wallet, so that the judging path takes under two minutes.

**How it works:** The frontend specified in FRONTEND_SPEC.md renders the evidence board, the current record, one complete case file, the reliability index, rejected dossiers, the public mandate and the CRE filing path with a real simulation log. The app interior exposes the full record through board, calls, case, ledger, KOL, watchlist and rules routes. Operator actions sit behind a server-side operator session. Public reads need no account.

**Acceptance criteria:** Every figure on the landing page resolves to an API response or a contract read. With the collector stopped, the interface enters the labelled replay state. With the API stopped, each surface shows its specified error state.

**Complexity:** Medium

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Collector | Python 3.12, Telethon | Telethon is the maintained MTProto client that can read public channel history, edits and forwards. A Telegram bot cannot read channels where it is not an admin, so a bot-based collector cannot work for this watchlist. Per CRYPTO_SKILL.md Category B, Python suits data-heavy signal work. |
| API | Python, FastAPI | Shares the parser, convergence and rules packages with the collector, so one implementation of each rule exists on the off-chain side. |
| Extraction model | Any OpenAI-compatible chat endpoint, configured by base URL, model and key | The demo must not depend on one vendor. The model only extracts and explains under a JSON schema. It never decides. A low-cost fast model is sufficient because deterministic parsers handle most posts. |
| Database | Supabase Postgres | Structured history, evidence bundles and score records need relational queries and unique constraints. The same schema runs against local Postgres for replay. |
| CRE workflows | TypeScript, `@chainlink/cre-sdk`, CRE CLI | The CRE SDK ships in TypeScript and Go. TypeScript matches the frontend and the CRE templates repository. Two workflows, verdict and settlement, live in one CRE project. |
| Contracts | Solidity 0.8.x, Hardhat | One small consumer contract. Hardhat matches the Category A guidance and keeps deployment and verification simple. |
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS | Matches FRONTEND_SPEC.md exactly and renders public proof pages with server components. |
| Animation | motion/react | The current Motion import path, used for the repeatable reveal system in the spec. |
| Market data | GeckoTerminal OHLCV and DexScreener for Solana memecoins, Binance public klines with Bybit as the check source for listed USDT pairs, Chainlink Data Feeds read on Ethereum mainnet where a feed exists | Each asset family records its own source pair in the evidence bundle, and the CRE workflow refuses to file when the pair disagrees beyond tolerance. No paid key is required at demo volume. |
| Hosting | Vercel for the web app, one small always-on host such as Fly.io or Render for collector and API, Supabase for Postgres | The collector needs a persistent process and a persistent Telegram session file, which serverless hosting cannot provide. |
| Chain | Ethereum Sepolia | The bounty requires a successful CRE simulation or a live CRE network deployment. Simulation is open to every builder, while deploying a workflow to the DON requires Early Access approval. The submitted proof is therefore `cre workflow simulate` with broadcast to Sepolia, run on a schedule by a small runner that commits each CLI log into `cre-runs/`. |

Monthly running cost at demo scale is the always-on collector host alone. Supabase, Vercel, DexScreener, GeckoTerminal and the public exchange endpoints all sit inside free tiers at this volume, and the extraction model sees only the minority of posts that deterministic parsers cannot classify.

---

## CRE Integration Detail

Apply SPEC_RESOLUTIONS.md to the interfaces, report encoding and schema below. The original shapes are extended with frozen rule evidence, explicit case kinds and ledger-bound contributor commitments. The individual-call settlement and single-attribution rules in that amendment are required before deployment.

Read the current CRE documentation and the `cre-templates` repository before writing workflow code, and resolve every SDK call name, capability import and forwarder address from those sources at build time. Nothing in this section is a substitute for the installed SDK version. The shapes below fix the data contracts between the API, the workflows and the ledger so the packages can be built in parallel.

### Evidence bundle, served by the API

```typescript
interface EvidenceBundle {
  eventId: string
  bundleHash: string            // sha256 of the canonical bundle JSON, this field excluded
  rulesetVersion: number
  rulesetHash: string
  asset: {
    assetKey: string             // "solana:<address>", "evm:<chainId>:<address>" or "cex:<PAIR>"
    chain: 'solana' | 'ethereum' | 'robinhood' | 'cex'
    contractAddress: string | null
    ticker: string | null
    pair: string | null          // listed pairs, for example "ENAUSDT"
  }
  narrativeKey: string | null
  window: { startedAt: string; closedAt: string }
  voices: Array<{
    sourceHash: string           // keccak256("telegram:<handle>") as hex
    callIds: string[]
    firstCallAt: string
    direction: 'long' | 'short' | 'spot_buy'
    conviction: number           // 0 to 100
    copied: boolean              // true where the only evidence is a forward
  }>
  pricePlan: {
    primary: PriceSource
    check: PriceSource
    maxDeviationBps: number
  }
  proposedTerms: {
    direction: 'long' | 'short' | 'spot_buy'
    sizeUnits: number            // paper USDC cents, integer
    stopBps: number | null       // null where structured levels exist
    targetBps: number | null
    stopPrice: string | null     // decimal string where a structured call supplied it
    targetPrice: string | null
    expiresAt: string
  }
}

interface PriceSource {
  kind: 'geckoterminal' | 'dexscreener' | 'binance' | 'bybit' | 'chainlink_feed'
  locator: string                // pool address, pair symbol or feed contract address
}
```

Canonical bundle JSON means keys sorted, no insignificant whitespace, numbers as integers or fixed decimal strings, and the call list ordered by post time then post ID. The collector, the API and both workflows must produce the identical byte sequence from the same record. One shared test fixture proves this before any broadcast run.

### Verdict workflow

```text
Trigger: CronCapability on a short schedule in a deployed setting.
  In the submitted build the runner invokes cre workflow simulate on a
  schedule, and the same handler runs once per invocation.

Handler outline:
  1. GET {apiBase}/cre/pending-verdicts with the workflow bearer secret.
     HTTPClient with identical-consensus aggregation on the response body.
     Take the oldest candidate event. If none exists, log and exit.
  2. GET {apiBase}/cre/events/{eventId}/bundle, identical consensus.
     Recompute the canonical hash. If it differs from bundleHash, stop.
  3. Recompute the rule results inside the workflow from the bundle and the
     ruleset values embedded in the workflow config. The config carries the
     ruleset hash, and a mismatch with the bundle stops the run.
  4. Read the entry price from the bundle pricePlan:
       HTTP sources through HTTPClient with median consensus on the numeric price.
       A chainlink_feed source through EVMClient.callContract latestRoundData
       on Ethereum mainnet at the last finalised block.
     If primary and check deviate beyond maxDeviationBps, the decision
     becomes DEFERRED with reason PRICE_DISAGREEMENT.
  5. For an approval, resolve stop and target. Structured levels are used
     where present, otherwise entry price adjusted by stopBps and targetBps
     for the recorded direction. Prices are encoded as integers scaled by 1e8.
  6. ABI-encode the VerdictReport, sign it with runtime.report and deliver it
     with EVMClient.writeReport to RefrainLedger on Sepolia.
  7. Log eventId, decision, reason code, bundle hash and transaction hash.
     The runner commits this log beside the bundle it filed.
```

### Settlement workflow

```text
Trigger: CronCapability, invoked by the same runner after the verdict pass.

Handler outline:
  1. GET {apiBase}/cre/due-positions, identical consensus. Take the oldest
     open position whose check time has arrived.
  2. Read the position terms from RefrainLedger through EVMClient.callContract
     on Sepolia. The chain record, not the API response, supplies entry,
     stop, target and expiry.
  3. Fetch outcome candles or the current price from the recorded source
     pair with median consensus. Apply first-touch logic over the candles
     since entry. Precedence inside one candle is conservative: the stop is
     treated as touched first where a single candle crosses both levels.
  4. Compute the paper result in cents and one bounded score delta per
     contributing voice. Winning voices gain in proportion to recorded
     conviction, losing voices lose on the same scale, expired positions
     move scores by a quarter step toward neutral. Deltas are clamped to
     the range -500 to 500, representing -5.00 to 5.00 points at 100x scale.
  5. ABI-encode the SettlementReport, sign it with runtime.report and write
     it to RefrainLedger. Log position ID, exit reason, exit price and hash.
```

### Report encoding

```solidity
enum Decision { Approved, Rejected, Deferred }
enum ReasonCode {
    None, QuorumNotMet, SingleVoiceRepetition, CopiedEvidence,
    CoordinatedPump, PromotionVeto, LiquidityFloor, PriceDisagreement,
    MandateSize, MissingExitTerms, StaleEvidence
}
enum ExitReason { Target, Stop, Expiry }

struct VerdictReport {
    bytes32 caseHash;        // bundleHash
    bytes32 rulesetHash;
    bytes32 assetHash;       // keccak256(assetKey)
    Decision decision;
    ReasonCode reason;
    uint8 direction;         // 0 long, 1 short, 2 spot buy
    uint256 entryPrice1e8;   // zero unless Approved
    uint256 stopPrice1e8;
    uint256 targetPrice1e8;
    uint256 sizeUnits;       // paper USDC cents
    uint64 openedAt;
    uint64 expiresAt;
}

struct SettlementReport {
    uint256 positionId;
    ExitReason exitReason;
    uint256 exitPrice1e8;
    int256 pnlUnits;                 // signed paper USDC cents
    bytes32[] sourceHashes;
    int256[] scoreDeltas;            // 100x scale, each within -500 to 500
}
```

### RefrainLedger responsibilities

- Accept reports only through `onReport` from the configured CRE forwarder address. The forwarder is set by the owner after deployment from the value the CRE CLI reports for Sepolia simulation with broadcast, and again if a production DON deployment is approved later.
- Store one verdict per `caseHash`. A second report for the same hash reverts.
- Open a paper position from an approved verdict with the reported terms. The contract holds no token balance and exposes no transfer, deposit or withdrawal function.
- Settle a position once, then apply the reported score deltas to a `sourceHash` score mapping with a floor of 0 and a ceiling of 10000, representing 0.00 to 100.00.
- Emit `VerdictFiled`, `PositionOpened`, `PositionSettled` and `ScoreUpdated`. The API indexes these events to mirror readable state, on-chain first.
- Owner powers are limited to setting the forwarder and pausing new filings. The owner cannot edit a filed verdict, a settled result or a score.

---

## Data Structures

```text
sources
  id uuid primary key
  platform text                 -- 'telegram' in the MVP
  handle text unique            -- without the @ prefix
  display_name text
  role text                     -- core_signal, meme_radar, noisy_source, red_flag_specimen
  is_public boolean
  is_active boolean
  last_message_id bigint
  source_hash text unique       -- keccak256("telegram:<handle>")
  created_at timestamptz

raw_posts
  source_id uuid references sources
  telegram_message_id bigint
  posted_at timestamptz
  edited_at timestamptz null
  text text
  urls jsonb                    -- entity URLs with offsets
  forwarded_from text null
  views integer null
  is_media_only boolean
  content_hash text             -- sha256 of the canonical post record
  ingest_mode text              -- live or replay
  ingested_at timestamptz
  primary key (source_id, telegram_message_id)

calls
  id uuid primary key
  source_id uuid references sources
  telegram_message_id bigint
  asset_key text
  chain text
  contract_address text null
  ticker text null
  pair text null
  direction text                -- long, short, spot_buy, close, mention
  entry_price numeric null
  stop_price numeric null
  target_price numeric null
  conviction integer null       -- 0 to 100
  urgency integer null          -- 0 to 100
  sentiment text null           -- bullish, bearish, neutral
  narrative_tags text[]
  parser text                   -- structured, address, cashtag, url, llm
  span_start integer null       -- character offsets of the extracted mention
  span_end integer null
  is_advertisement boolean
  filter_reason text null
  duplicate_of uuid null references calls
  extraction_confidence numeric null
  created_at timestamptz

convergence_events
  id uuid primary key
  level text                    -- asset or narrative
  asset_key text null
  narrative_key text null
  window_started_at timestamptz
  window_closed_at timestamptz
  call_ids uuid[]
  independent_voice_count integer
  timing_spread_seconds integer
  weighted_conviction numeric
  status text                   -- candidate, filed, settled
  bundle_hash text unique
  created_at timestamptz

rulesets
  version integer primary key
  config jsonb
  ruleset_hash text unique
  is_active boolean
  created_at timestamptz

verdicts
  event_id uuid primary key references convergence_events
  decision text                 -- approved, rejected, deferred
  reason_code text
  rule_results jsonb            -- ordered rule name, pass flag and evidence string
  explanation text
  cre_run_ref text null         -- path of the committed run log
  chain_tx_hash text null
  filed_at timestamptz null

paper_positions
  id bigint primary key         -- mirrors the on-chain position ID
  event_id uuid references convergence_events
  asset_key text
  direction text
  entry_price numeric
  size_units bigint             -- paper USDC cents
  stop_price numeric
  target_price numeric
  opened_at timestamptz
  expires_at timestamptz
  exit_price numeric null
  exit_reason text null         -- target, stop, expiry
  pnl_units bigint null
  status text                   -- open, settled

kol_scores
  source_id uuid primary key references sources
  score numeric                 -- 0.00 to 100.00, starts at 50.00
  calls_tracked integer
  wins integer
  losses integer
  expired integer
  promotion_flags integer
  updated_at timestamptz

score_history
  id uuid primary key
  source_id uuid references sources
  position_id bigint null
  delta numeric
  reason text
  chain_tx_hash text
  created_at timestamptz

call_outcomes
  call_id uuid primary key references calls
  result text                   -- target, stop, expired, open
  exit_price numeric null
  checked_until timestamptz
  source_pair jsonb
```

Indexes that matter: `raw_posts (source_id, posted_at desc)`, `calls (asset_key, created_at desc)`, `calls (source_id, created_at desc)`, `convergence_events (status, created_at)`, `paper_positions (status, expires_at)`.

---

## API Architecture

| Method and path | Access | Purpose |
|---|---|---|
| GET /api/board | public | Latest call window, active convergence event, latest verdict, counts and newest ingest time for the hero board |
| GET /api/metrics | public | The five current record counts |
| GET /api/calls | public | Extracted calls with `filter`, `source`, `asset` and cursor pagination |
| GET /api/events | public | Convergence events, filterable by `decision` and `reason_code` |
| GET /api/events/{eventId} | public | One complete case file |
| GET /api/kols | public | Reliability index rows |
| GET /api/kols/{handle} | public | One channel record with recent calls and score history |
| GET /api/ledger/positions | public | Paper positions |
| GET /api/ledger/rejections | public | Filed rejections |
| GET /api/rules/active | public | Active ruleset, version and hash |
| GET /api/rules | public | Ruleset version history |
| GET /api/cre/runs | public | Committed CRE run index with mode, time and transaction links |
| GET /cre/pending-verdicts | CRE bearer secret | Candidate events awaiting a verdict workflow run |
| GET /cre/events/{eventId}/bundle | CRE bearer secret | Canonical evidence bundle |
| GET /cre/due-positions | CRE bearer secret | Open positions due for a settlement check |
| POST /operator/sources | operator session | Add a channel to the watchlist, capped at 20 active sources |
| PATCH /operator/sources/{id} | operator session | Change role or active state |
| POST /operator/rules | operator session | Save a new ruleset version and activate it |
| POST /operator/runs/verdict | operator session | Ask the runner host to execute one verdict simulation pass |

Public reads are rate-limited per IP at the host. CRE endpoints require the bearer secret that the workflow reads through CRE secrets handling. Operator endpoints require a signed session cookie issued after the operator presents the server-side operator secret. No endpoint accepts an exchange key, a wallet key or a trade instruction.

---

## Environment Variables

```text
# Web
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_SEPOLIA_RPC_URL=
NEXT_PUBLIC_REFRAIN_LEDGER_ADDRESS=
NEXT_PUBLIC_CHAIN_ID=11155111

# API and collector
DATABASE_URL=
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION_PATH=
CRE_BEARER_SECRET=
OPERATOR_SECRET=
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
PRICE_FETCH_TIMEOUT_SECONDS=10

# CRE project
CRE_ETH_PRIVATE_KEY=
API_BASE_URL=
SEPOLIA_RPC_URL=
ETHEREUM_MAINNET_RPC_URL=
REFRAIN_LEDGER_ADDRESS=
```

`TELEGRAM_SESSION_PATH` points at credential material. The session file is created by an interactive first login as a dedicated secondary Telegram account, stored only on the collector host, and excluded from version control. `CRE_ETH_PRIVATE_KEY` belongs to a Sepolia-only wallet funded from a faucet. It is used by the CRE CLI for simulation with broadcast and must never hold mainnet assets.

---

## App Routes

- `/` landing page per FRONTEND_SPEC.md sections 3 to 11 plus the footer in section 12
- `/app` live evidence board, open positions and latest rejections
- `/app/calls` every extracted call with parser and filter records
- `/app/convergence/[eventId]` one complete case file with replay data
- `/app/ledger` paper positions and filed rejections
- `/app/kols` reliability index with channel detail
- `/app/watchlist` monitored sources, operator editing when signed in
- `/app/rules` active mandate and version history, operator editing when signed in

---

## What Is Not Being Built in the MVP

- Real trading of any kind. No exchange keys, no DEX execution, no copy-trading switch hidden behind a setting.
- X and Discord ingestion. The bounty text allows Telegram sources, the audited watchlist is Telegram, and source adapters keep a clean interface for later platforms. The README states this scope plainly.
- Private group access on behalf of users. The collector reads public channels and sources the operator account legitimately belongs to.
- User accounts and personal watchlists. The demo runs one public watchlist with operator editing. Multi-user mandates need an identity decision after the hackathon.
- Screenshot OCR for media-only posts. Brains Signals proves the gap honestly, and those posts are skipped with a recorded reason instead of guessed at.
- A project token, protocol fee or treasury wallet.
- CRE DON deployment. Deployment needs Early Access approval. The submission proves the workflows through open CLI simulation with broadcast, and says so in the interface and the README.
- Mainnet ledger deployment. Sepolia only, with mainnet limited to read-only price feeds.

---

## Hackathon Deliverables Checklist

- DoraHacks Build submitted to BLI Legal Tech Hackathon 2 with both bounties selected on the same Build: RYO-CHAN Autonomous Agents and Chainlink Best Workflow with CRE
- Public GitHub repository with collector, API, CRE workflows, contracts, web app and the committed `cre-runs/` logs
- README with architecture, local setup, replay instructions, CRE simulation commands and the paper-only boundary
- RefrainLedger deployed and verified on Sepolia, address printed in the README and linked from the footer
- At least one broadcast CRE verdict run and one broadcast settlement run, each with its CLI log committed beside the bundle it filed
- Live frontend on a public URL with the replay state working while the collector is off
- Demo video following MARKETING.md, showing one approval and one rejection from raw post to Sepolia filing
- Submission copy that states the spotlight fit, the CRE orchestration role and the testnet method in plain language

---

## Hackathon Build Priority

Judged on working autonomous behaviour, cause and effect in every decision, a repeatable reasoning trail, load-bearing CRE orchestration with a demonstrated simulation, and a public interface that judges can inspect without setup.

1. Collector with replay importer, parsers and advertisement filtering over the audited watchlist
2. Convergence detection with independence rules and frozen evidence bundles
3. Ruleset evaluator producing approved, rejected and deferred decisions with reason codes
4. RefrainLedger deployed to Sepolia and verified
5. CRE verdict workflow passing a dry-run simulation, then one broadcast filing
6. Landing page and app board reading live API data per FRONTEND_SPEC.md
7. CRE settlement workflow with one broadcast settlement and score movement
8. Case file, KOL index, ledger, watchlist and rules routes
9. Frozen replay set polished for judging, README and submission copy finalised
10. Demo video recorded and DoraHacks Build submitted to both bounties
