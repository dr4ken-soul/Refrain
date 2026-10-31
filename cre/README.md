# Refrain CRE workflows

Two Chainlink CRE workflows move a frozen evidence bundle to `RefrainLedger` on Ethereum Sepolia:

| Workflow | Reads | Writes |
| --- | --- | --- |
| `verdict` | pending candidate, frozen bundle, fresh entry price from two recorded sources | approved or rejected `VerdictReport` |
| `settlement` | open position, `getPosition` from the ledger, closed hourly candles, current price | `SettlementReport` and per-channel score deltas |

The workflow recomputes the bundle hash and every rule result before producing a report. Canonical bytes, rules and report codecs live in `shared/`.

## Versions

- CRE CLI 1.39.0
- `@chainlink/cre-sdk` 1.23.0
- viem 2.34.0
- zod 3.25.76
- Bun 1.4.4, required by `cre-compile`

## Layout

```text
cre/
  project.yaml
  secrets.yaml
  shared/                   canonical bytes, rules mirror, report codecs
  shared/fixture.test.ts    bundle hash and rules parity tests
  fixtures/                 approved and rejected deterministic bundles
  verdict/                  verdict workflow, config and workflow.yaml
  settlement/               settlement workflow, config and workflow.yaml
```

## Credentials

The repository-root `.env` is the only credentials file. `scripts/run_cre_cycle.py` reads it, supplies values to the CRE process environment, and redacts environment values from saved logs. Do not create `cre/.env` and do not pass the root file through the CLI `-e` flag. A failed local CLI invocation previously echoed the file contents to a terminal, so the wrapper avoids that path.

The relevant settings are `SEPOLIA_RPC_URL`, `CRE_ETH_PRIVATE_KEY`, `CRE_BEARER_SECRET`, `API_BASE_URL` and `ETHEREUM_MAINNET_RPC_URL`. The private key is for a dedicated Sepolia simulation wallet only. Mainnet access is read-only for price feeds.

## Windows path note

`cre-compile` breaks when the repository path contains a space. Create a junction and use it for CRE commands:

```text
cmd /c mklink /J C:\refrain "C:\Users\Paul\Documents\Coding Area\Hackathon\Refrain"
cd C:\refrain
```

## Run

Keep the API available at the `API_BASE_URL` in the root `.env`. From `C:\refrain`, run a dry pass:

```powershell
.\.venv\Scripts\python.exe .\scripts\run_cre_cycle.py --dry-run
```

Broadcast is explicit and checks that the configured RPC reports Sepolia chain ID 11155111:

```powershell
.\.venv\Scripts\python.exe .\scripts\run_cre_cycle.py --broadcast
```

The runner skips verdict hashes already recorded in the committed chain snapshot. It runs settlement against an open position and archives the bundle, workflow log and any transaction hash under `cre-runs/<date>/<run-id>/`. Do not broadcast the demo expiry settlement before 2026-10-31T09:15:00Z.

Run the parity tests from the `cre` directory:

```powershell
npm test
```

## Fixtures and chain state

`fixtures/verdict-approved.json` is a deterministic convergence fixture for WIF with three synthetic independent voices. `fixtures/verdict-rejected.json` is a deterministic single-voice repetition fixture. They are CRE test evidence, not captured Telegram posts.

The approved fixture expires at 2026-10-31T09:15:00Z. The settlement workflow must wait for a stop, target or expiry touch before it files.

## Deployments

| Item | Address |
| --- | --- |
| RefrainLedger, Sepolia | `0x03d2011c624016F7A5A9D02318c2fdba31c63278` |
| MockKeystoneForwarder, simulation | `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` |
| KeystoneForwarder, production | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |

The ledger uses the MockKeystoneForwarder so CRE simulation broadcasts are accepted. Before production delivery, the owner must call `setForwarderAddress(0xF8344CFd5c43616a4366C34E3EEE75af79a74482)`.

The staging configs set a 3,000,000 gas limit. A 1,000,000 limit ran out inside the ledger and the forwarder recorded a failed transmission even though the outer transaction succeeded.

## Recorded runs

- Approved verdict: [transaction](https://eth-sepolia.blockscout.com/tx/0xb09a064bac186b444e0b0b43bddd364ac47853e94741abb9c0da8f5f37fe503f), block 12026631. Position 1 is open, with entry 0.1746, stop 0.15, target 0.30, paper size 130 USDC and expiry 2026-10-31 09:15 UTC.
- Rejected verdict: [transaction](https://eth-sepolia.blockscout.com/tx/0x656d4efd7b26f77f5b488ff58b59423a51311cdecd253aa8e1045387a1ce377c), block 12026715.
- Settlement: not broadcast yet. The committed dry run found no closed hourly candle touch before expiry.