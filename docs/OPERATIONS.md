# Local operations

The repository-root `.env` is the only credentials file. Copy `.env.example` to `.env` once, fill in the owner-controlled values, and keep `.env` ignored. Do not create app-specific or CRE copies of the credentials.

## Telegram collector

The owner must complete Telegram login in a local interactive terminal. The login code and any two-step verification never go into chat or a log.

```powershell
.\scripts\telegram-login.ps1
.\.venv\Scripts\python.exe -m collector status
.\.venv\Scripts\python.exe -m collector init-db
.\.venv\Scripts\python.exe -m collector backfill --days 14
.\.venv\Scripts\python.exe -m collector export seed/replay/posts.jsonl
```

The export contains captured public-channel history. Do not hand-edit posts or substitute test fixture text. The current public API still reads the committed CRE fixture replay; collector history is not yet wired into the public API store.

## Sepolia event indexer

The indexer verifies Sepolia chain ID, waits for the configured number of confirmations, and stores each RefrainLedger event with its transaction and log position. It resumes from its database cursor. A transaction is applied atomically so reruns do not double-count scores.

```powershell
Set-Location apps\api
..\..\.venv\Scripts\python.exe -m api.indexer --once
```

Omit `--once` to keep polling. The database read model receives confirmed ledger events, but public API pages still serve the committed fixture replay until the live database read path is enabled.

## CRE runner

The runner reads the root `.env`, passes those settings to the CRE child process, and redacts environment values from archived logs. It does not pass the credentials file through the CRE CLI `-e` option.

On Windows, run from the no-space junction described in `cre/README.md`:

```powershell
Set-Location C:\refrain
.\.venv\Scripts\python.exe .\scripts\run_cre_cycle.py --dry-run
```

A dry run is the default. It archives each workflow log and the frozen bundle under `cre-runs/<date>/<run-id>/`, then updates `cre-runs/index.json`. Existing case hashes and settled positions are skipped. The settlement handler may run before expiry and report that there is nothing to file.

After a local dry run and a Sepolia RPC chain-ID check, a single broadcast pass is:

```powershell
.\.venv\Scripts\python.exe .\scripts\run_cre_cycle.py --broadcast
```

The open demo position expires at `2026-10-31T09:15:00Z`. Do not broadcast its expiry settlement before that time. Review the archived log, bundle and transaction hash, then commit the run artifacts with the relevant phase work.

For an hourly operator-machine schedule, create a Windows Task Scheduler job that runs the same script with `--broadcast` from `C:\refrain`. Keep the local API available. The runner is not a hosted service, and the current replay API exposes no new real Telegram candidates.
