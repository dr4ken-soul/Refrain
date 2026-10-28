# Refrain

An autonomous evidence agent for crypto call channels. Refrain monitors up to 20 public Telegram channels, extracts every market call, detects when separate channels converge on the same asset or narrative, and files a verdict under a fixed public mandate. A Chainlink CRE workflow fetches the frozen evidence and market prices under consensus and writes the verdict into a Sepolia ledger contract. Approved convergences open paper positions. Rejected and deferred ones are filed beside them with reason codes. A second CRE workflow settles due positions and moves each channel's reliability score on-chain.

Paper trading only. No real funds move anywhere in this system, and the ledger contract cannot hold a balance.

Built for BLI Legal Tech Hackathon 2 on DoraHacks. One Build is entered for the RYO-CHAN Autonomous Agents bounty ($6,000) and the Chainlink Best Workflow with CRE bounty (two awards of $1,000).

## Links

| Resource | Value |
|---|---|
| Live frontend | TO_FILL_AFTER_DEPLOY |
| RefrainLedger on Sepolia | TO_FILL_AFTER_DEPLOY, verified contract address with Etherscan link |
| Example verdict transaction | TO_FILL_AFTER_FIRST_BROADCAST_RUN |
| Example settlement transaction | TO_FILL_AFTER_FIRST_BROADCAST_RUN |
| Demo video | TO_FILL_AFTER_RECORDING |

## How It Works

1. **Collect.** A Telethon collector reads the configured public channels with a dedicated operator account and stores every post with its original time, entity URLs, forward origin and content hash. A replay importer rebuilds the same state from a frozen snapshot, so judging never depends on a live session.
2. **Extract.** Deterministic parsers handle structured futures calls, cashtags, USDT pairs, Solana and EVM contract addresses, and addresses embedded in GMGN, Phantom and fomo links. Advertisements carrying partner codes, casino promotions or referral parameters are classified and stored as promotion evidence. Only unstructured residue reaches the language model, which returns strict JSON: asset mentions, sentiment, conviction, urgency and narrative tags. The model never decides.
3. **Converge.** Calls group into events by asset key or by narrative key. Independence rules collapse repeats by one channel into a single voice, remove forwarded copies entirely and down-weight channels sharing referral markers inside the window.
4. **Decide.** A versioned, hashed ruleset evaluates each frozen evidence bundle: approved, rejected with a reason code, or deferred. Rules set the voice threshold, windows per asset family, conviction floor, liquidity floor, paper size, stop, target, expiry, price tolerances and the promotion veto.
5. **File with CRE.** The verdict workflow fetches the bundle and entry prices from two recorded sources under DON consensus, recomputes the bundle hash and rule results, and writes a signed report to RefrainLedger on Sepolia. The settlement workflow reads position terms back from the contract, applies first-touch logic against recorded candles and writes the result plus per-channel score deltas on-chain.
6. **Show the record.** The public interface renders the evidence board, case files, ledger, reliability index, watchlist and mandate directly from the API and contract reads. Stale data is labelled as recorded replay.

## Repository Layout

```text
apps/web          Next.js frontend
apps/api          FastAPI service and contract event indexer
apps/collector    Telethon collector and replay importer
packages/parsers  Deterministic Telegram call parsers
packages/engine   Convergence, canonical bundles and the ruleset evaluator
cre/              CRE project with verdict and settlement workflows
contracts/        RefrainLedger, Hardhat project
seed/             Audited watchlist, ruleset version 1 and the replay snapshot
cre-runs/         Committed simulation logs with the bundle each run filed
docs/             FRONTEND_SPEC, APP_BLUEPRINT, PRODUCT and BUILD_GUIDE
```

## Quick Start, Replay Mode

Replay mode needs no Telegram account and no live prices.

```text
1. Clone the repository and copy .env.example to .env in apps/api, apps/web and cre.
2. Start local Postgres, then apply migrations from apps/api/migrations in order.
3. Seed the watchlist and ruleset: python -m seed.load_seed
4. Load the frozen history: python -m collector.replay_import seed/replay/posts.jsonl
5. Run extraction and evaluation: python -m engine.run_pipeline --replay
6. Start the API: uvicorn api.main:app --port 8000
7. Start the web app: npm run dev in apps/web
8. Open the board. The interface shows the recorded replay state by design.
```

## CRE Workflows

Prerequisites: the CRE CLI from the official Chainlink release page, Node 20 or newer, a faucet-funded Sepolia wallet in `CRE_ETH_PRIVATE_KEY`, and the API running with a matching `CRE_BEARER_SECRET`. Always check `cre/README.md` for the CLI and SDK versions this repository was built against, and read the current CRE documentation before changing workflow code.

```text
Dry run, verdict workflow:
  cre workflow simulate ./cre/workflows/verdict --target staging-settings

Broadcast a verdict filing to Sepolia:
  cre workflow simulate ./cre/workflows/verdict --target staging-settings --broadcast

Dry run, settlement workflow:
  cre workflow simulate ./cre/workflows/settlement --target staging-settings

Broadcast a settlement to Sepolia:
  cre workflow simulate ./cre/workflows/settlement --target staging-settings --broadcast
```

Flag names follow the CRE CLI documentation at build time. If the installed CLI differs, its help output wins. Every production run in this repository is committed under `cre-runs/<date>/<run-id>/` with the bundle JSON, the full simulation log and the transaction hash.

CRE workflow deployment to the DON requires Early Access approval. This project demonstrates the workflows through open CLI simulation with broadcast, run on a schedule by a small runner. The interface and this README state that method plainly.

## Contracts

```text
cd contracts
npm install
npx hardhat test
npx hardhat run scripts/deploy.ts --network sepolia
```

RefrainLedger accepts signed reports through `onReport` from the configured CRE forwarder, stores one verdict per case hash, opens paper positions from approved verdicts, settles each position once and applies bounded score deltas per channel hash. It holds no balance and exposes no transfer, deposit or withdrawal function. Deploy to Sepolia only.

## Live Collector

Live mode needs a dedicated secondary Telegram account and application credentials from my.telegram.org. The first run logs in interactively and writes a session file that must never be committed. The collector backfills 14 days per channel, then tails new posts and edits, honouring Telegram flood-wait responses. Public channels only, plus sources the operator account legitimately belongs to.

## Boundaries

- Paper trading only. No exchange keys, no execution, no live-trading mode exists.
- Telegram is the only live source in this build. X and Discord sit behind the same source interface as later adapters and are not claimed as working inputs.
- Media-only posts without text are skipped with a recorded reason. There is no OCR.
- Reliability scores report settled history. They are not investment advice and not a prediction of future calls.
