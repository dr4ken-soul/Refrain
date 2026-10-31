# Refrain

Refrain is an evidence agent for public Telegram call channels. It extracts calls, tests whether voices agree independently, and records paper verdicts through Chainlink CRE on Ethereum Sepolia. The ledger holds no funds and cannot execute trades.

Built for BLI Legal Tech Hackathon 2, for the RYO-CHAN Autonomous Agents bounty and the Chainlink Best Workflow with CRE bounty.

## Submission evidence and remaining gates

| Item | Status |
| --- | --- |
| GitHub repository | [dr4ken-soul/Refrain](https://github.com/dr4ken-soul/Refrain) |
| Public frontend | Not deployed |
| RefrainLedger | [0x03d2011c624016F7A5A9D02318c2fdba31c63278, verified on Sepolia](https://eth-sepolia.blockscout.com/address/0x03d2011c624016F7A5A9D02318c2fdba31c63278#code) |
| Approved verdict | [Sepolia transaction](https://eth-sepolia.blockscout.com/tx/0xb09a064bac186b444e0b0b43bddd364ac47853e94741abb9c0da8f5f37fe503f) |
| Rejected verdict | [Sepolia transaction](https://eth-sepolia.blockscout.com/tx/0x656d4efd7b26f77f5b488ff58b59423a51311cdecd253aa8e1045387a1ce377c) |
| Settlement transaction | Pending. Position 1 expires at 2026-10-31 09:15 UTC. |
| Captured Telegram replay | Not frozen. The current public replay uses deterministic CRE test fixtures, not captured Telegram posts. |
| Demo video | Not recorded |
| DoraHacks Build | Not submitted |

The interface and API are currently local replay builds. A public site, real captured Telegram replay and settlement filing remain required before this repository is submission-ready.

## System

1. The Telethon collector reads public channels, preserves original timestamps and edits, and exports hash-verified JSONL replay data.
2. Deterministic parsers classify structured calls, contract addresses, promotions, exits and media-only posts. A language model handles only unstructured residue and never decides.
3. The engine groups calls by asset or narrative, removes forwards, collapses repeats by source and evaluates a versioned mandate.
4. CRE recomputes the frozen bundle hash and rule results, checks prices under consensus, and files the verdict to RefrainLedger.
5. A second CRE workflow checks open paper positions and files settlements and score changes.
6. The Next.js app reads the API and presents replay, evidence, filed decisions and operator controls.

## Repository layout

```text
apps/collector  Telethon collector and replay importer
apps/api        FastAPI transport and replay API
apps/web        Next.js public evidence interface
packages/       Parsers, convergence engine and shared types
cre/            CRE verdict and settlement workflows
contracts/      RefrainLedger and Hardhat project
seed/           Audited watchlist and mandate version 1
cre-runs/       CRE bundles and recorded run logs
```

## Local setup

Requirements: Python 3.12, Node 20 or newer, PostgreSQL, and the CRE CLI for workflow simulation.

1. Copy `.env.example` once to the repository-root `.env` and fill in local values. The root `.env` is the only credentials file. Keep it ignored. Never copy credentials into app folders or `cre/`.
2. Create the Python environment and install the project from the repository root:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -e .
   ```

3. Start the API from `apps/api`:

   ```powershell
   ..\..\.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000
   ```

4. In `apps/web/.env.local`, set only the browser-visible API address:

   ```text
   NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
   ```

5. Install and start the web app from `apps/web`:

   ```powershell
   npm install
   npm run dev
   ```

6. Open `http://127.0.0.1:3000`. The API currently serves the committed CRE fixture replay. It is labelled as replay and is not a captured Telegram archive.

## Telegram collection

The owner must complete the interactive login locally. Do not send Telegram codes or two-step verification details in chat.

```powershell
.\scripts\telegram-login.ps1
.\.venv\Scripts\python.exe -m collector status
.\.venv\Scripts\python.exe -m collector init-db
.\.venv\Scripts\python.exe -m collector backfill --days 14
.\.venv\Scripts\python.exe -m collector export seed/replay/posts.jsonl
```

The collector export is the source for a real frozen history. The web replay API is not yet wired to database records or that exported file.

## CRE workflows

Check `cre/README.md` for the CLI and SDK versions. The local runner loads the root `.env` into the CRE process and redacts environment values from archived logs. Do not pass the `.env` file with the CLI `-e` option.

```powershell
Set-Location C:\refrain
.\.venv\Scripts\python.exe .\scripts\run_cre_cycle.py --dry-run
```

A broadcast pass is explicit and verifies that the configured RPC reports Sepolia chain ID 11155111. Position 1 is held to expiry before the runner allows an expiry broadcast:

```powershell
.\.venv\Scripts\python.exe .\scripts\run_cre_cycle.py --broadcast
```

The runner archives each invoked workflow under `cre-runs/<date>/<run-id>/` and updates `cre-runs/index.json`. It skips fixture verdicts already filed on-chain. The current demo settlement broadcast is held until the position expiry at 2026-10-31 09:15 UTC.

CRE DON deployment requires Early Access. This project demonstrates simulation with broadcast to Sepolia and does not claim DON deployment.

## Contract checks

```powershell
Set-Location contracts
npm install
npx hardhat test
```

The contract accepts reports only from its configured CRE forwarder. It stores verdicts and paper terms, settles each position once, and bounds score changes. It has no balance or transfer functions.

## Boundaries

- Paper positions only. There is no exchange integration, order execution or live-trading mode.
- Telegram is the only live source adapter. Public channels only, plus sources the operator account legitimately belongs to.
- Media-only posts are skipped with a recorded reason. There is no OCR.
- Scores report settled history under the public mandate. They do not predict future calls.