# Refrain: Product Definition

## One Line

Refrain watches the channels people already follow and files a public verdict on whether separate voices truly agree, under rules written down before the outcome is known.

## The Problem

A trader following call channels cannot see agreement, they see repetition. One caller posting a coin nine times looks like nine confirmations. A call forwarded into five channels looks like five opinions. A timed call announced an hour ahead looks like organic excitement. Paid promotions sit inside the same feed as genuine research, referral codes and casino partner links included, and losing calls are edited or quietly buried while the wins are screenshot and pinned.

Ranking tools answer a different question. They show which wallet moved or which token trends. Nothing in the current toolset asks whether the voices reached a claim independently, decides under rules fixed in advance, refuses the cases that fail, and keeps every refusal beside every position with the settled outcome attached to each voice.

## The Product

Refrain treats every call-channel post as evidence. It monitors up to 20 public Telegram channels, extracts each call into a structured record tied to the exact words it came from, and groups calls into convergence events at two levels: the same asset, or the same narrative across different assets. Independence rules collapse repeats from one voice, remove forwarded copies and discount channels that share referral markers.

A versioned public mandate then decides each convergence: approved as a paper position with entry, size, stop, target and expiry fixed together, rejected with a reason code, or deferred where price sources disagree or data is incomplete. A Chainlink CRE workflow fetches the frozen evidence and prices under consensus, replays the mandate and files the verdict into a Sepolia ledger contract. A second CRE workflow settles due positions against recorded prices and moves each contributing channel's reliability score on-chain.

The result is one public record where every outcome, including the trades refused, is attached to the voices that produced it.

## Who It Serves

1. **Retail and youth traders** following Telegram call channels, who need to know whether agreement is real before they size a position of their own.
2. **Trading communities and channel curators** who maintain KOL lists and need a settled record per voice instead of screenshots picked after the fact.
3. **Compliance and legal reviewers** who need promotion conduct in one place: referral parameters, partner codes, scheduled call events and undisclosed placement language, each tied to the original post and the decision it produced. This is the legal-tech edge of the product. Refrain does not accuse. It preserves the record that a human reviewer would otherwise reconstruct by hand.

## The Mandate, Version 1

These values ship as ruleset version 1 and are public on the rules page and inside every case file.

| Rule | Value |
|---|---|
| Maximum monitored channels | 20 |
| Independent voices required | 3 |
| Convergence window, contract-address assets | 24 hours |
| Convergence window, listed USDT pairs | 6 hours |
| Weighted conviction floor | 55 of 100 |
| Paper size | 100 USDC base, scaled by weighted conviction, capped at 500 USDC |
| Default terms, contract assets | Stop at minus 15 percent, target at plus 35 percent, expiry at 48 hours |
| Default terms, listed pairs | Structured levels from the call where present, otherwise the contract-asset defaults at 24-hour expiry |
| Price agreement | Two recorded sources within 300 basis points for memecoin pairs, 50 basis points for listed pairs |
| Promotion veto | On. A convergence carried mainly by promotional posts is rejected |
| Rejected and deferred | Filed with reason codes, never discarded |

Conviction defaults where no model runs: structured call with levels 70, cashtag thesis 55, bare contract address 40, minus 15 where extreme multiplier language appears. Where the language model runs, its 0 to 100 conviction and urgency are recorded with the prompt version, and the deterministic rules consume them as inputs. The model never decides.

## Reason Codes

Every refusal names its rule. The fixed list:

- **QUORUM_NOT_MET:** independent voices below the mandate threshold
- **SINGLE_VOICE_REPETITION:** one channel repeated an asset until it resembled agreement
- **COPIED_EVIDENCE:** forwards or near-duplicate text carried the apparent convergence
- **COORDINATED_PUMP:** a pre-announced timed call or synchronized posting pattern
- **PROMOTION_VETO:** referral, casino or partner-code evidence dominated the event
- **LIQUIDITY_FLOOR:** recorded liquidity below the mandate minimum
- **PRICE_DISAGREEMENT:** the two recorded price sources diverged beyond tolerance
- **MANDATE_SIZE:** computed paper size fell outside the mandate limits
- **MISSING_EXIT_TERMS:** no stop, target or expiry could be fixed from the calls or defaults
- **STALE_EVIDENCE:** the window closed before evaluation with incomplete data

## Reliability Scoring

Each channel starts at 50.00. Scores move only from settled outcomes recorded on Sepolia: convergence positions the channel contributed an independent voice to, and structured futures calls settled against their own stated stop and first target. Winning voices gain in proportion to the conviction recorded at call time, losing voices lose on the same scale, expired outcomes move the score a quarter step toward neutral. A promotion classification is counted on the channel record and shown beside the score. The score is a report of settled history, never a forecast, and the interface says so wherever it appears.

## Boundaries

- Paper trading only. No real funds, no exchange connection, no trade execution of any kind.
- Public Telegram channels only in this build, plus sources the operator account legitimately belongs to. No private-group access on behalf of other users.
- X and Discord are designed as later source adapters behind the same interface. They are not claimed as working inputs.
- Media-only posts without machine-readable text are skipped with a recorded reason. There is no OCR and no guessing at screenshots.
- CRE workflows are demonstrated through open CLI simulation with broadcast to Sepolia. DON deployment requires Early Access approval and is not part of the submission claim.
- The ledger contract holds no balance and cannot move value. Sepolia only, with mainnet limited to read-only price feeds.
- Reliability scores describe settled past calls. They are not investment advice and not a prediction.

## Why This Fits the Two Bounties

**RYO-CHAN Autonomous Agents, $6,000.** The bounty spotlight describes a multi-KOL narrative agent that tracks the calls of up to 20 key opinion leaders on X and Telegram, detects when several converge on a narrative, scores conviction and urgency, and places practice bets under written rules when three or more converge within an hour. Refrain is that agent built from an audited real watchlist, with the convergence window set per asset family by the mandate, and with three additions the spotlight points toward: independence testing that separates agreement from repetition and forwarding, rejections filed beside approvals so selective history is impossible, and reliability scores settled on-chain per voice.

**Chainlink Best Workflow with CRE, two awards of $1,000.** Both verdict and settlement are CRE workflows that join a blockchain with external HTTP APIs and an AI-extracted evidence bundle. The verdict workflow fetches frozen evidence and multi-source prices under consensus, replays deterministic rules and writes a signed report to the ledger contract. The settlement workflow reads position terms back from the contract, fetches outcome prices externally and writes settlement and score updates on-chain. Remove CRE and nothing files, nothing opens and no score moves, which is the orchestration the bounty asks for. Successful simulation with broadcast is demonstrated with committed CLI logs and Sepolia transaction links.

## Success Criteria for the Hackathon Build

1. A judge opens the live site and inspects one approval and one rejection from raw post to Sepolia filing in under two minutes, with no wallet and no login.
2. The repository reproduces both fixture verdicts from a clone using the replay snapshot and the CRE dry-run commands in the README.
3. At least one broadcast verdict and one broadcast settlement are visible on Sepolia Etherscan with committed run logs.
4. Every figure in the interface traces to a stored record or a contract read. Nothing is invented, and stale data is labelled as replay.
