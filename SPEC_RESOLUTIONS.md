# Approved specification resolutions

The owner approved the recommended resolution of the three specification conflicts raised during the initial document review. This file records the resulting implementation contract. It does not claim that the application, contracts or workflows have been implemented or tested.

## 1. Convergence windows

Ruleset version 1 uses 24 hours for contract-address assets and 6 hours for listed USDT pairs. PRODUCT.md and BUILD_GUIDE.md supply the numeric values. FRONTEND_SPEC.md now states the same windows. Later versions must render their actual values from the API rather than repeat version 1 copy.

## 2. Frozen evidence needed for deterministic verification

EvidenceBundle keeps its existing fields and adds caseKind and a required evidence object. Missing required evidence cannot silently pass a rule. No rule may depend on mutable database state that is absent from the frozen bundle or an explicitly recorded CRE price read.

The evidence object must include:

- Every contributing call's ID, source hash, original Telegram message ID and timestamp, direction, conviction, narrative tags and exact extraction span.
- The frozen post text, entity URLs, original content hash, forward origin and any recorded edit timestamp, sufficient to inspect the evidence independently of the current Telegram message.
- Per-source reliability in integer hundredths of a point at freeze time. The bundle records both the initial neutral score or confirmed on-chain score and the confirmed block used for a chain-derived score.
- The complete call list before repeat collapse, its canonical order and the first independent call retained for each source. Repeated posts remain evidence, not extra voices.
- Referral markers, promotional classifications and reasons, scheduled-call evidence, and the independence weight applied to each source. Weights use integer basis points. Shared markers and the sources they link remain visible.
- Liquidity observations with the provider, pool or pair locator, observation timestamp and integer USD cents. Missing liquidity is recorded as missing rather than replaced with an invented value.
- The exact versioned rule parameters and arithmetic inputs used for coordination, promotion dominance, reliability weighting and liquidity evaluation. Any thresholds absent from the original mandate must be explicitly agreed before ruleset v1 is activated.

The canonical hash covers these fields. Python and TypeScript must share a fixture that tests the entire extended shape. CRE checks the active config's ruleset hash, recomputes arithmetic and verifies recorded market inputs before signing. The original canonical ordering rules still apply.

## 3. Individual structured-call positions

Use the same paper ledger and the same CRE verdict and settlement paths for both convergence and individual structured calls. Do not add an off-chain score update shortcut.

- caseKind is convergence or individual_call. A single structured call with explicit entry, stop and at least one target can create an individual-call case. Its first target is the settlement target.
- An individual-call case records one call and one source. Agreement rules are explicitly marked not applicable to this case kind, not falsely reported as passed. Promotion, data validity, price, paper risk and exit rules still apply.
- Individual-call cases are stored with an explicit case kind and excluded from convergence-event counts. The migration must preserve the documented public event references and include the new case kind.
- Extend VerdictReport with caseKind and aligned sourceHashes, callHashes and convictions arrays. For convergence, retain the earliest independent eligible call per source. The ledger stores these contributor commitments with the opened position.
- A callHash identifies an immutable frozen call, not its mutable display text. The case hash also includes caseKind, preventing confusion between individual and convergence cases.
- Settlement must match the position's recorded contributor list. A report may not introduce arbitrary sources or substitute conviction values.
- A source-call commitment receives an outcome score effect at most once across individual and convergence positions. The ledger enforces this attribution guard. Paper positions may both settle, but a call already scored cannot earn or lose points twice. The runner must refresh attribution state before preparing a report.
- Score changes remain bounded, start from the documented neutral score and become visible only after confirmed ScoreUpdated events. Individual positions appear in the ledger with their case kind.

These report additions must be implemented together in Solidity, Python, TypeScript, ABI encoding, indexer, fixtures and tests before deployment. No deployed ledger ABI currently exists to migrate.

## Unchanged completion gates

The phase acceptance tests, real captured replay requirement, Sepolia broadcast evidence, deployment, demo video and submission checks remain required. Approving these resolutions does not turn absent credentials or unperformed acceptance tests into a pass.
