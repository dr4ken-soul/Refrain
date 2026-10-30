# Refrain CRE workflows

Two Chainlink CRE workflows move a frozen evidence bundle from the API to
`RefrainLedger` on Ethereum Sepolia:

| Workflow | Trigger | Reads | Writes |
| --- | --- | --- | --- |
| `verdict` | cron every hour | pending candidate, frozen bundle, fresh entry price from two recorded sources | approved or rejected `VerdictReport` |
| `settlement` | cron every hour | due positions from the API, `getPosition` from the ledger, closed hourly candles, current price | `SettlementReport` plus per-channel score deltas |

The workflows never decide anything the Python engine did not already decide:
the bundle hash and every rule result are recomputed from the frozen bundle
before a report is produced. TypeScript mirrors of the canonical byte encoding
and the ruleset are in `shared/`.

## Versions

- CRE CLI 1.39.0 (`C:\Users\Paul\AppData\Local\Programs\cre\cre.exe`)
- `@chainlink/cre-sdk` 1.23.0
- viem 2.34.0, zod 3.25.76
- bun 1.4.4, required by `cre-compile` for TypeScript workflows

## Layout

```
cre/
  project.yaml              RPC settings per target
  secrets.yaml              secret id to environment variable mapping
  shared/                   canonical bytes, ruleset mirror, report codecs
  shared/fixture.test.ts    bundle hash and rules parity tests
  fixtures/                 approved and rejected frozen bundles
  verdict/                  verdict workflow, config, workflow.yaml
  settlement/               settlement workflow, config, workflow.yaml
```

## Credentials

The repository root `.env` is the single credentials file. Never copy it into
`cre/`. Simulation and broadcast both read it through `-e ../.env`, and
`project.yaml` reads `SEPOLIA_RPC_URL` from the process environment, which the
CLI populates from that file.

Relevant keys: `SEPOLIA_RPC_URL`, `CRE_ETH_PRIVATE_KEY`, `CRE_BEARER_SECRET`.
The CLI signs simulated broadcasts with `CRE_ETH_PRIVATE_KEY`.

## Incremental TypeScript imports

Both workflows import `../shared/*` directly. The CRE compiler bundles files
outside the workflow directory, so there is no copy step.

## Windows path note

`cre-compile` breaks when the project path contains a space. Create a junction
once and run the CLI from it:

```
cmd /c mklink /J C:\refrain "C:\Users\Paul\Documents\Coding Area\Hackathon\Refrain"
cd C:\refrain\cre
```

## Run

Start the stub API from the repository root (port 8000):

```
.venv\Scripts\python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Simulate without broadcasting:

```
cre workflow simulate ./verdict -T staging-settings --non-interactive --trigger-index 0 -e ../.env
cre workflow simulate ./settlement -T staging-settings --non-interactive --trigger-index 0 -e ../.env
```

Broadcast to Sepolia:

```
cre workflow simulate ./verdict -T staging-settings --non-interactive --trigger-index 0 --broadcast -e ../.env
cre workflow simulate ./settlement -T staging-settings --non-interactive --trigger-index 0 --broadcast -e ../.env
```

Run the parity tests:

```
npm test
```

## Fixtures

`fixtures/verdict-approved.json` freezes one convergence case on WIF with three
independent voices and live dexscreener and geckoterminal observations taken
when the fixture was generated. `fixtures/verdict-rejected.json` freezes a
single voice repeating the same call three times.

Regenerate (requires network access, rewrites both fixtures and prints the new
hashes):

```
.venv\Scripts\python scripts\make_cre_fixtures.py
```

The approved case expires at 2026-10-31T09:15:00Z, 48 hours after its last
call. The settlement workflow cannot file an expiry before that instant.

## Deployments

| Item | Address |
| --- | --- |
| RefrainLedger (Sepolia) | `0x03d2011c624016F7A5A9D02318c2fdba31c63278` |
| MockKeystoneForwarder (simulation) | `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` |
| KeystoneForwarder (production) | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |

The ledger was deployed with the MockKeystoneForwarder so that simulated
broadcasts are accepted. Before production delivery the owner must call
`setForwarderAddress(0xF8344CFd5c43616a4366C34E3EEE75af79a74482)`.

`config.staging.json` carries the ledger as `receiver` and a gas limit of
3,000,000. The forwarder forwards nearly all remaining gas to `onReport`; a
1,000,000 limit ran out inside the ledger and the forwarder recorded a failed
transmission without reverting the outer transaction.

## Recorded runs

- `cre-runs/verdict-broadcast.log`: approved verdict broadcast on
  2026-10-30T13:19:36Z, transaction
  `0xb09a064bac186b444e0b0b43bddd364ac47853e94741abb9c0da8f5f37fe503f`.
  Sepolia state: position 1 open, entry 0.1746, stop 0.15, target 0.30,
  paper size 130 USDC, expiry 2026-10-31T09:15:00Z.
