# CLAUDE.md: Refrain Build Instructions

This file is the operating manual for the coding agent building Refrain. Read it fully before writing any code, then follow BUILD_GUIDE.md phase by phase. APP_BLUEPRINT.md defines the system. FRONTEND_SPEC.md defines every pixel of the interface. PRODUCT.md fixes the scope boundaries. If two documents disagree, stop and report the conflict instead of choosing silently. SPEC_RESOLUTIONS.md records the owner-approved resolutions for convergence windows, extended frozen evidence and individual-call on-chain scoring. Apply those explicit amendments to the original shapes before implementation.

---

## What You Are Building

Refrain monitors up to 20 public Telegram channels, extracts every market call, detects when separate channels converge on the same asset or narrative, evaluates that convergence under a fixed public mandate, files the verdict on Ethereum Sepolia through a Chainlink CRE workflow, and settles paper positions so each channel builds a reliability record. It files rejections beside approvals. No real funds move anywhere in the system.

The submission targets two bounties in BLI Legal Tech Hackathon 2 on DoraHacks, deadline 1 November 2026: RYO-CHAN Autonomous Agents at $6,000, and Chainlink Best Workflow with CRE at two awards of $1,000.

---

## Non-Negotiable Rules

1. **Deterministic before language model.** Structured parsers, address extraction and URL parsing run first. The language model receives only unstructured residue and returns strict JSON. A malformed model response is discarded and logged. Never repair it by guessing field values.
2. **The language model never decides.** It extracts mentions, conviction, urgency and narrative tags, and it writes plain-language explanations from rule results. Every trading-relevant decision is a deterministic rule result with a reason code.
3. **CRE files every verdict.** The off-chain evaluator proposes a decision. The CRE verdict workflow recomputes the bundle hash and the rule results, checks prices under consensus and signs the report. If CRE has not filed it, the interface shows it as evaluated, never as filed.
4. **On-chain state is truth.** A verdict is marked filed only after the RefrainLedger event is observed. A position is settled only after the settlement event. The database mirrors the chain, never leads it.
5. **No fabricated figures.** Every number, timestamp, score, hash and log in the interface comes from the API, a contract read or a committed run file. Empty states are shown when data is absent. Fixture data is allowed only inside the labelled replay snapshot and must be real captured history, not invented posts.
6. **Paper only.** Do not add exchange execution, DEX routing, wallet trading, an API-key connection for trading, or a toggle that implies live trading exists. The ledger contract holds no balance and has no transfer function.
7. **Current CRE documentation wins.** Fetch the current Chainlink CRE docs and the cre-templates repository before writing workflow code. Resolve SDK imports, capability names, consensus helpers, secrets handling and the Sepolia forwarder address from the installed SDK version. Do not invent method names from memory.
8. **Canonical JSON is exact.** Keys sorted, no insignificant whitespace, integers or fixed decimal strings for numbers, call arrays ordered by post time then post ID. The collector side and the workflow side must hash identical bytes for the same bundle. One shared fixture test proves this before any broadcast run.
9. **Independence is the product.** A channel repeating one coin counts as one voice. A forwarded post contributes zero independent voices. Channels sharing referral markers inside one window are down-weighted and the link is recorded as evidence, not hidden.
10. **Rejected and deferred are filed too.** A build that only records approvals is a failed build. Every evaluated convergence event reaches a verdict with a reason code from the fixed list in APP_BLUEPRINT.md.

---

## Copy Rules

- Never use an em dash anywhere in the product, interface, code comments, commit messages or documentation. This includes the READMEs you generate inside subfolders and the marketing copy in the repository. Use commas, colons, full stops or line breaks.
- Avoid filler words such as robust, leverage in the business sense, streamline, comprehensive, ecosystem as decoration, and cutting-edge. Write plain operational language.
- Do not write marketing claims about profit, win rate predictions or future performance. Refrain reports settled history. It does not forecast.

---

## Repository Shape

```text
refrain/
  apps/
    web/                Next.js 14 App Router, TypeScript, Tailwind, motion/react
    api/                FastAPI service
    collector/          Telethon collector and replay importer
  packages/
    parsers/            Deterministic Telegram call parsers
    engine/             Convergence detection, bundle builder, ruleset evaluator
    shared-types/       TypeScript and Python contract types for bundles and reports
  cre/
    project.yaml
    secrets.yaml        Example committed with placeholder values only
    workflows/
      verdict/
        main.ts
        workflow.yaml
        config.json
      settlement/
        main.ts
        workflow.yaml
        config.json
  contracts/
    contracts/RefrainLedger.sol
    scripts/deploy.ts
    test/
  seed/
    sources.json        The audited eight-channel watchlist
    ruleset-v1.json     The starting mandate
    replay/             Frozen channel history snapshot
  cre-runs/
    YYYY-MM-DD/<run-id>/
      bundle.json
      simulation.log
      tx.txt
  assets/               Logo and favicon slots only, empty until the project owner supplies a mark
  docs/                 FRONTEND_SPEC.md, APP_BLUEPRINT.md, PRODUCT.md, BUILD_GUIDE.md
```

Keep one implementation of each rule in `packages/engine`. The CRE workflow reimplements only the rule arithmetic needed to verify a bundle, using the values in its own config and the ruleset hash, because workflow code cannot import the Python package. The shared fixture test in BUILD_GUIDE.md Phase 4 keeps the two implementations honest.

---

## Stack Pins

- Node 20 or newer for web and CRE. Bun only where the installed CRE SDK requires it; follow the SDK at install time and record the choice in the CRE README.
- Next.js 14 App Router. Tailwind with the design tokens defined in FRONTEND_SPEC.md section 1. Animation imports come from `motion/react`, not `framer-motion`.
- Python 3.12 for collector and API. Telethon for Telegram. FastAPI with Pydantic models that mirror `packages/shared-types`.
- Postgres through Supabase in production, local Postgres for development and replay. SQL migrations live in `apps/api/migrations/` and are applied in order.
- Solidity 0.8.x with Hardhat in `contracts/`. Deploy to Sepolia only. Mainnet access is read-only, for price feeds.
- CRE CLI installed from the official release page. Record the CLI version and SDK version in `cre/README.md` at install time.

---

## Secrets and Safety

- Telegram credentials belong to a dedicated secondary operator account, created by the project owner. The Telethon session file lives only on the collector host. It is excluded from version control along with every `.env` file.
- The CRE simulation wallet is Sepolia-only and faucet-funded. If you find a mainnet-capable key in any config, stop and report it.
- The CRE bearer secret protects the `/cre/*` API endpoints. The operator secret protects watchlist and rules editing. Both are server-side environment values, never sent to the browser.
- The extraction model key stays in the API environment. The browser never calls a model endpoint directly.
- Public API reads are rate-limited per IP at the host. Do not add open write endpoints.

---

## Definition of Done

A phase from BUILD_GUIDE.md is done only when all four hold:

1. The code for the phase is committed with a message naming the phase.
2. The phase acceptance test runs green, or its manual verification steps were performed and the result recorded in the commit body.
3. `npx tsc --noEmit` passes in `apps/web` and the CRE workflows typecheck before any simulation that phase performs.
4. No em dash appears anywhere in the diff. Run a search for the character before committing and fix every hit outside this rule's own mention of it.

The whole build is done when the checklist in APP_BLUEPRINT.md under Hackathon Deliverables Checklist is complete, including one broadcast verdict run and one broadcast settlement run with committed logs, and the live frontend passes the FRONTEND_SPEC.md section 16 self-check against real API data.

---

## When Blocked

Report the blocker with the exact error output, the command that produced it and what you already tried. Known external gates and their approved behaviour:

- CRE DON deployment requires Early Access approval. Do not wait for it. Simulation with broadcast is the deliverable.
- Telegram flood-wait responses during collector backfill. Honour the wait, log it, and continue. Do not rotate accounts or bypass limits.
- A price source going down during a verdict run. The workflow must defer with PRICE_DISAGREEMENT or stop with a logged error. It must never substitute an unrecorded source.
- Missing logo or favicon assets. The wordmark stays text. Do not invent a brand mark. Ask the project owner.

Do not reduce scope silently. If a feature cannot be built as specified, say which acceptance criterion fails and propose the smallest change that restores it.
