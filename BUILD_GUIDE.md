# Refrain: Build Guide

Follow these phases in order. Each phase ends with an acceptance test. Do not start the next phase until the current test passes or its manual verification is recorded, per the Definition of Done in CLAUDE.md. Deadline for the full submission is 1 November 2026. Phases 1 to 4 produce a submittable core. Phases 5 to 8 complete the public product.

Workspace layout, stack pins and repository shape are defined in CLAUDE.md. System design, data structures and API contracts are defined in APP_BLUEPRINT.md. Interface detail is defined in FRONTEND_SPEC.md. This guide only sequences the work.

---

## Phase 0: Tooling and Accounts

Do this first because every later phase depends on accounts that only the project owner can create.

1. Create a dedicated secondary Telegram account for the collector. At my.telegram.org, create an application to obtain `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`. Keep this account separate from any personal account.
2. Create a Sepolia-only wallet for CRE simulation broadcasts and contract deployment. Fund it from a Sepolia faucet. Record the address in `.env.example` notes, never the key.
3. Create a Sepolia RPC endpoint and an Ethereum mainnet RPC endpoint with a provider such as Alchemy or Infura. Mainnet is read-only, for price feeds.
4. Create a Supabase project and note the Postgres connection string for `DATABASE_URL`.
5. Choose the extraction model endpoint and obtain `LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL`. Any OpenAI-compatible provider works. Pick a fast low-cost model, because deterministic parsers handle most posts.
6. Install Node 20 or newer, Python 3.12, Hardhat tooling, and the CRE CLI from the official Chainlink release page. Run `cre login` once. Record the CLI version in `cre/README.md`.
7. Read the current CRE documentation and the cre-templates repository. Note the installed `@chainlink/cre-sdk` version, the runtime it expects, the HTTP and EVM capability imports, the consensus helpers, secrets handling, and the Sepolia forwarder address process. Write these notes into `cre/README.md` before any workflow code exists.
8. Initialise the monorepo exactly as shaped in CLAUDE.md and copy the documents into `docs/`. Copy `.env.example` once to the repository-root `.env` and fill its values. Keep credentials in that one ignored file. The web app may use `apps/web/.env.local` for the public API URL only. Confirm `.env` and the Telegram session file are ignored by version control.

**Acceptance test:** `cre --version` prints the recorded version, the Sepolia wallet balance reads above zero through the configured RPC, the Supabase project accepts a connection, and the empty monorepo with docs is committed.

---

## Phase 1: Schema, Seed and Ingestion

Goal: real channel history in the database, live and frozen.

1. Create the migrations for every table and index in APP_BLUEPRINT.md under Data Structures. Match names and types exactly.
2. Write `seed/sources.json` from the audited watchlist in APP_BLUEPRINT.md: eight Telegram channels with handles, display names and roles. Compute `source_hash` at seed time as keccak256 of `telegram:<handle>`.
3. Write `seed/ruleset-v1.json` as version 1 of the mandate: independent voice threshold 3, 24-hour window for contract-address assets, 6-hour window for listed pairs, weighted conviction floor 55, paper size cap 500 USDC, base size 100 USDC scaled by conviction, default stop minus 15 percent and target plus 35 percent with 48-hour expiry for contract assets, structured levels used for listed pairs where present, price tolerance 300 basis points for memecoin pairs and 50 basis points for listed pairs, promotion veto on. Hash it canonically and store the hash in `rulesets`.
4. Build the Telethon collector in `apps/collector/`. First run performs an interactive login and writes the session file. The collector backfills the last 14 days per source, then tails new messages and edit events. Honour flood-wait responses by sleeping and logging. Normalise each message into `raw_posts` with URLs from message entities, forward origin, views where present, a media-only flag and the content hash.
5. Build the replay exporter and importer. The exporter writes the current `raw_posts` for the watchlist into `seed/replay/posts.jsonl`. The importer loads that file into an empty database with `ingest_mode = replay` and original timestamps preserved.

**Acceptance test:** Backfill completes for all eight channels. Running it twice changes no row count. Truncating the database and running the importer restores the same row counts per source. An edited message in a test update keeps its original `posted_at` and gains an `edited_at`.

### Copy-paste prompt for Phase 1

```text
Read CLAUDE.md and APP_BLUEPRINT.md in docs/. Implement Phase 1 of BUILD_GUIDE.md
exactly: migrations for every table and index under Data Structures, seed files for
the eight audited channels and ruleset version 1, the Telethon collector with
backfill, edit handling and flood-wait respect, and the replay exporter and importer.
Public channels only. No exchange or trading code. No em dash characters anywhere in
code, comments or docs. Finish by running the Phase 1 acceptance test and reporting
row counts per source before and after a replay import into an empty database.
```

---

## Phase 2: Parsers, Extraction and Advertisement Filtering

Goal: every post becomes a call, an exit, an advertisement or a skipped record, each with evidence.

1. Build `packages/parsers/` in this order, one module per pattern: structured futures blocks with pair, LONG or SHORT, entry, SL and TP fields including multi-target lists; cashtags and USDT pair symbols; Solana base58 addresses of 32 to 44 characters including the `pump` suffix; EVM `0x` addresses; and contract addresses embedded in GMGN, Phantom and fomo URLs, taking the token name from the message web preview title where present. Every match records the character span it came from.
2. Parse close instructions and break-even moves as exit events linked to the earlier matching call from the same source where one exists.
3. Classify partner codes, casino promotions, referral parameters and deposit offers as advertisements with a filter reason. These rows are stored, counted as promotion evidence and never reach convergence.
4. Build the language-model extractor for the unstructured residue. Fixed JSON schema: asset mentions with spans, sentiment, conviction 0 to 100, urgency 0 to 100, narrative tags. Validate before any write. Discard and log malformed output. Deterministic conviction defaults apply where no model runs: structured call with levels 70, bare address 40, cashtag thesis 55, and minus 15 where extreme multiplier language is detected by pattern.
5. Write the fixture suite from the audited post shapes: a structured long with three targets, a bare Solana address with a follow-up profit claim, a GMGN link post with no ticker in the text, a casino deposit promotion, a close instruction, a media-only screenshot post, and one contract repeated nine times by one channel.

**Acceptance test:** Every fixture classifies as expected, each extracted call carries a span inside the original text, and a run over the Phase 1 backfill produces per-source counts of calls, exits, advertisements and skips with zero unclassified text posts remaining.

### Copy-paste prompt for Phase 2

```text
Read docs/CLAUDE.md and the call extraction feature in docs/APP_BLUEPRINT.md.
Implement Phase 2 of docs/BUILD_GUIDE.md: deterministic parsers first in the stated
order, exit-event parsing, advertisement classification with filter reasons, then the
JSON-schema language-model extractor for unstructured residue only. Malformed model
output is discarded and logged, never repaired. Every call records its character
span. Build the fixture suite from the audited post shapes and run it, then run the
parsers over the Phase 1 backfill and report per-source classification counts. No em
dash characters anywhere.
```

---

## Phase 3: Convergence, Evidence Bundles and the Rules Engine

Goal: candidate events with frozen bundles and deterministic decisions, all off-chain.

1. Build `packages/engine/` with the two-level grouping from APP_BLUEPRINT.md Feature 3: asset-key events and narrative-key events. Canonical asset keys follow the format in the blueprint. Narrative keys come from model tags normalised to a small controlled vocabulary kept in `packages/engine/narratives.json`.
2. Implement independence exactly: forwards contribute zero, repeats by one channel inside the window collapse to one voice keeping the earliest call, channels sharing referral markers inside one window are down-weighted with the shared marker recorded.
3. Implement the canonical bundle builder producing the `EvidenceBundle` shape from the blueprint, including the price plan per asset family and the proposed terms from the active ruleset. Hash canonically. Store the bundle hash on the event.
4. Implement the ruleset evaluator returning APPROVED, REJECTED with one fixed reason code, or DEFERRED, plus the ordered rule results with an evidence string per rule. Reason codes come only from the enum list in the blueprint.
5. Implement the explainer: the model receives rule results and bundle facts only, and writes a short plain-language explanation. It must not add facts. Validate that every number in the explanation appears in the input.

**Acceptance test:** The nine-repeat fixture yields an independent voice count of one and a REJECTED verdict with SingleVoiceRepetition. A synthetic three-channel convergence fixture yields APPROVED with complete rule results. Deleting one character from a stored bundle and re-hashing produces a different hash, demonstrating that the frozen record is tamper-evident.

### Copy-paste prompt for Phase 3

```text
Read docs/CLAUDE.md and Features 3 and 4 plus the EvidenceBundle interface in
docs/APP_BLUEPRINT.md. Implement Phase 3 of docs/BUILD_GUIDE.md: two-level
convergence with the exact independence rules, canonical bundle building and
hashing, the deterministic ruleset evaluator with fixed reason codes, and the
constrained explainer that may only restate supplied facts. The model must never
decide. Run the Phase 3 acceptance test and print both fixture verdicts with their
ordered rule results. No em dash characters anywhere.
```

---

## Phase 4: Contracts and CRE Workflows

Goal: a verdict and a settlement filed on Sepolia by CRE simulation with broadcast.

1. Write `contracts/contracts/RefrainLedger.sol` to the responsibilities in APP_BLUEPRINT.md: `onReport` restricted to the configured forwarder, one verdict per case hash, paper positions from approved verdicts, single settlement per position, bounded score deltas with floor and ceiling, the four events, owner limited to forwarder setting and pausing filings. No balance, no transfer functions, no user funds.
2. Test the contract with Hardhat: duplicate case hash reverts, report from a non-forwarder reverts, double settlement reverts, score floor and ceiling hold, a rejected verdict opens no position.
3. Deploy to Sepolia with `contracts/scripts/deploy.ts` and verify the source. Record the address in `.env`, the README and the web app environment.
4. Scaffold the CRE project with two workflows per CLAUDE.md. Implement the verdict workflow handler exactly as outlined in the blueprint, using imports and helpers from the installed SDK. The API `/cre/*` endpoints must exist first in stub form serving one frozen fixture bundle, so the workflow can be simulated before the full API ships. Build the shared fixture test: a canonical bundle JSON file hashed by the Python test and by the workflow typecheck harness, asserting identical hashes.
5. Run a dry-run simulation of the verdict workflow for one approved fixture and one rejected fixture. Confirm the decisions match the off-chain evaluator. Then run one approved fixture with `--broadcast`, set the contract forwarder as instructed by the CLI output and current docs, and confirm the `VerdictFiled` and `PositionOpened` events on Sepolia Etherscan. Commit the run under `cre-runs/`.
6. Implement the settlement workflow with first-touch logic and the conservative same-candle stop precedence. Simulate dry-run against the open fixture position using recorded candles, then settle it with `--broadcast`. Confirm `PositionSettled` and `ScoreUpdated` on Etherscan. Commit the run.

**Acceptance test:** Both workflows pass dry-run simulation with decisions matching the off-chain engine. One verdict and one settlement are confirmed on Sepolia with transaction hashes committed in `cre-runs/`. Re-running the same bundle is refused by the contract. Altering the bundle stops the workflow before signing.

### Copy-paste prompt for Phase 4

```text
Read docs/CLAUDE.md and the CRE Integration Detail in docs/APP_BLUEPRINT.md. Before
any workflow code, fetch the current Chainlink CRE documentation and cre-templates
repository and resolve every SDK import, consensus helper and forwarder step from
the installed versions. Implement Phase 4 of docs/BUILD_GUIDE.md: RefrainLedger with
its Hardhat tests, Sepolia deployment and verification, the verdict and settlement
CRE workflows with the shared canonical-hash fixture test, dry-run simulations for
approved and rejected fixtures, then one broadcast verdict and one broadcast
settlement with logs committed under cre-runs/. The contract takes no funds. No em
dash characters anywhere. Report the two transaction hashes and the Etherscan links.
```

---

## Phase 5: API Completion and Frontend

Goal: the public product running on real data.

1. Complete every endpoint in the APP_BLUEPRINT.md API table, including CRE bearer-secret endpoints, operator session endpoints, cursor pagination on calls, and the event indexer that mirrors RefrainLedger events into `verdicts`, `paper_positions`, `kol_scores` and `score_history` after confirmation.
2. Scaffold `apps/web` with the tokens, fonts, utilities, reveal system, z-index map, the nine landing sections and the footer from FRONTEND_SPEC.md, followed by the seven app routes. Spec section 15 requires no generated imagery: the evidence board, convergence timeline and price chart are coded from product data and icons are inline SVG. The logo stays a comment slot and the wordmark stays text.
3. Wire every surface to the API following the data each section declares and the data honesty rules in FRONTEND_SPEC.md section 2.1, including loading, error, empty and replay states per surface. The board polls for fresh data on a short interval and pauses while the tab is hidden.
4. Deploy: web to Vercel, collector and API to the always-on host, environment values set per `.env.example`. Confirm the public URL renders live data with no wallet and no login.

**Acceptance test:** FRONTEND_SPEC.md section 16 passes against the deployed site. Stopping the collector for longer than 15 minutes flips the interface into the labelled replay state. Stopping the API shows the specified error states. `npx tsc --noEmit` passes and a Lighthouse run at 375px with simulated throttling reports LCP under 2.5 seconds with reduced motion enabled.

### Copy-paste prompt for Phase 5

```text
Read docs/CLAUDE.md, the API table in docs/APP_BLUEPRINT.md and docs/FRONTEND_SPEC.md
in full. Implement Phase 5 of docs/BUILD_GUIDE.md: complete the API including the
contract event indexer, then build the web app to FRONTEND_SPEC.md exactly, tokens,
sections, motion values, focus order and state behaviour included, with no generated
imagery per spec section 15 and every visual coded from product data. Every figure
comes from the API or a contract read. No invented metrics, no hardcoded hashes, no
logo invention. Run the section 16 self-check and report each line pass or fail.
```

---

## Phase 6: Live Loop and Runner

Goal: the autonomous loop running end to end without manual steps.

1. Run the collector as a persistent process tailing the watchlist. New posts flow through parsers, convergence and evaluation automatically.
2. Run the CRE runner as a small scheduled process on the always-on host or the operator machine: verdict simulation pass, then settlement simulation pass, each with broadcast, each committed under `cre-runs/` with bundle, log and transaction hash. This replaces DON scheduling, which is Early-Access gated, and the runs index in the interface states that plainly.
3. Exercise the full loop on live data: wait for a real convergence event or trigger evaluation over the backfill window, file its verdict, watch the position or rejection appear in the interface from the contract event, then settle an expired or stopped position and watch a score move.
4. Harden failure paths: collector restart recovers from `last_message_id`, a price outage defers rather than files, a failed broadcast leaves the event in candidate state for the next pass, and the interface enters replay rather than showing stale data as live.

**Acceptance test:** One complete live cycle is visible from raw post to settled score movement with every hop attributable to a stored record or a chain event, and each failure path above has been exercised once in a controlled way with the result logged.

---

## Phase 7: Submission Package

Goal: everything a judge needs inside one DoraHacks Build.

1. Write the repository README from README.md in this document set, filling the deployed contract address, live URL and the two example transaction links.
2. Freeze the final replay snapshot so judging works with the collector off. Confirm the replay state labels appear as specified.
3. Record the demo video following MARKETING.md: one approval and one rejection, raw post to Sepolia filing, under three minutes.
4. Create the DoraHacks Build for BLI Legal Tech Hackathon 2, select both bounties, RYO-CHAN Autonomous Agents and Chainlink Best Workflow with CRE, and paste the submission copy from MARKETING.md adapted to the final numbers.
5. Final sweep: search the repository for em dash characters and remove them, confirm no secret or session file is tracked, confirm the Sepolia contract is verified, and confirm every link in the submission resolves.

**Acceptance test:** A fresh reader can clone the repository, run the replay importer, run the CRE dry-run simulation commands from the README and reproduce the two fixture verdicts. The DoraHacks Build lists both bounties and links the live site, the repository, the verified contract and the video.

---

## Out of Scope Reminders

- No real trading, no exchange keys, no live-trading toggle. Ever.
- No X or Discord ingestion in this build. Telegram public channels only.
- No screenshot OCR. Media-only posts are skipped with a recorded reason.
- No CRE DON deployment wait. Simulation with broadcast is the shipped proof.
- No token, no fees, no treasury, no mainnet contract.
- No logo invention. The wordmark is text until the project owner supplies a mark.
