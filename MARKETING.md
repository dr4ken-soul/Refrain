# Refrain: Submission and Marketing Copy

## Positioning

Refrain is an autonomous evidence agent for the call channels traders already follow. Its job is narrow: decide whether several voices reached the same claim independently, and file that verdict where it cannot be edited later. Every positioning line below follows one rule. Refrain reports settled history and preserved evidence. It never forecasts prices, promises returns or ranks voices by claims they made about themselves.

## Name and Tagline

**Refrain.** The line that repeats across every voice, and the act of holding back when the evidence is not there. Both readings are load-bearing. Convergence is the product finding the refrain across channels. Restraint is the product refusing to file a position when the refrain turns out to be one voice, a forwarded copy or a scheduled promotion.

Tagline options, first is primary:

1. One voice can repeat itself. Separate voices agreeing is a different thing.
2. Every claim filed. Every refusal kept.
3. Restraint, recorded.

## DoraHacks Submission Summary

**Short version, for the Build card:**

Refrain monitors up to 20 public Telegram call channels, extracts every market call and files a Sepolia verdict on whether separate voices truly converge. A fixed public mandate evaluates each convergence, a Chainlink CRE workflow fetches the frozen evidence and prices under consensus and writes the verdict on-chain, and a second CRE workflow settles paper positions so each channel builds a reliability record. Approvals, rejections and deferrals are all filed. Paper only, no real funds.

**Long version, for the Build page:**

Call channels produce repetition that looks like agreement. One caller posts a coin nine times in a day. A forwarded message lands in five channels. A call is announced an hour in advance with a referral bot attached. Casino and exchange promotions sit inside the same feed as genuine research. Nothing a follower can see separates independent agreement from volume, copying or coordination, and the calls that fail are edited or buried while the wins are pinned.

Refrain treats each post as evidence. It monitors up to 20 public Telegram channels, extracts every call into a structured record tied to the exact words it came from, and groups calls into convergence events at two levels: the same asset, or the same narrative across different assets. Independence rules collapse repeats from one voice, remove forwarded copies and discount channels that share referral markers.

A versioned public mandate decides each convergence before any outcome is known: approved as a paper position with entry, size, stop, target and expiry fixed together, rejected with a named reason code, or deferred where price sources disagree. The Chainlink CRE verdict workflow fetches the frozen evidence bundle and multi-source prices under consensus, replays the mandate and writes a signed report to RefrainLedger on Sepolia. The CRE settlement workflow later reads the position terms back from the contract, applies first-touch logic against recorded prices and writes the outcome plus per-channel score movements on-chain. Deterministic parsers and rules do the deciding; a language model only extracts unstructured calls and explains rule results in plain language.

The public interface shows the whole record without a wallet: the live evidence board, one complete case file from raw posts to transaction, the reliability index per channel, rejected trades with their reason codes, the mandate itself and a real CRE simulation log. The demo watchlist is eight real channels audited on 26 October 2026, including one kept deliberately as a red-flag specimen so judges can watch the system refuse it.

CRE workflows are demonstrated through open CLI simulation with broadcast to Sepolia, with each run log committed beside the bundle it filed. DON deployment needs Early Access approval and is not claimed.

## Bounty Fit Statements

**RYO-CHAN Autonomous Agents ($6,000), primary target.** The bounty spotlight describes a multi-KOL narrative agent tracking up to 20 key opinion leaders, detecting narrative convergence, scoring conviction and urgency, and placing practice bets under written rules. Refrain implements that spotlight against an audited real Telegram watchlist and adds independence testing, filed rejections and on-chain settled reliability scores. The agent runs the full loop itself: collect, extract, converge, decide, file, settle, score.

**Chainlink Best Workflow with CRE (two awards of $1,000).** Two CRE workflows join Sepolia with external HTTP APIs and an AI-extracted evidence bundle. The verdict workflow consumes the API, price sources and contract state, then produces a signed report the ledger accepts. The settlement workflow reads terms from the contract and closes positions from external price data, writing score updates on-chain. Remove CRE and nothing files, nothing opens and no score moves. Simulation with broadcast is shown through committed logs and Sepolia transaction links.

Theme fit for the Build form: Agent-Native Legal Infrastructure. Refrain is an AI agent whose evidence bundles, rule results and promotion records give reviewers a machine-readable trail of the kind legal and compliance work depends on, without claiming to give legal advice.

## Demo Video Script, Under Three Minutes

1. **Open on the problem, 20 seconds.** Show the landing hero. Say: one voice can repeat itself until it looks like agreement. Refrain files verdicts on whether agreement is real.
2. **Show the watchlist, 20 seconds.** Eight real channels with assigned roles, including the red-flag specimen. Say these were audited before a line of code, and the audit shaped the rules.
3. **Show one approval, 60 seconds.** Open the case file. Raw posts with recognition boxes, independence count, ordered rule results, paper terms, then the CRE log and the Sepolia transaction. Say the language model extracted and explained, while fixed rules decided and CRE filed.
4. **Show one rejection, 40 seconds.** The red-flag specimen rejected for single-voice repetition or promotion evidence. Say the refusal is filed on the same ledger as the position, so the record cannot be curated afterwards.
5. **Show settlement and scoring, 30 seconds.** A settled position and a score moving, each linked to its transaction.
6. **Close on the boundary, 10 seconds.** Paper only. Public channels. Rules public before outcomes. Replay works with the collector off.

## Launch Post Drafts

**Post 1, launch:**

We built Refrain for BLI Legal Tech Hackathon 2.

It watches up to 20 public Telegram call channels, extracts every call, and tests whether separate voices actually agree, or whether one voice repeated itself, a call was forwarded around, or a promotion was dressed up as research.

A fixed public mandate decides each convergence. A Chainlink CRE workflow files the verdict on Sepolia. Approvals open paper positions. Rejections are filed beside them with reason codes. Settlements move each channel's reliability score on-chain.

Paper only. Rules public before outcomes. The record belongs to everyone.

**Post 2, the refusal:**

The feature we are proudest of is a rejection.

One channel in our watchlist posted the same contract nine times in a day and announced a timed call in advance. Most feeds would call that momentum. Refrain counted one independent voice, flagged the promotion evidence and filed a rejection with its reason code, on-chain, beside every position it did open.

Agreement is a test, not a volume count.

**Post 3, technical:**

How a Refrain verdict is filed:

The collector freezes the evidence bundle and hashes it. The CRE verdict workflow fetches the same bundle and two price sources under consensus, recomputes the hash, replays the mandate rules and writes a signed report to RefrainLedger on Sepolia. A second workflow settles positions from the terms stored in the contract and moves channel scores.

Change one character in the evidence and the workflow stops before signing. That is the point.

## Copy Rules for All Public Text

- No em dash characters anywhere, including social posts and the DoraHacks page.
- No return forecasts, win-rate promises or language implying the paper record predicts markets.
- Reliability is described as settled history, never as trust in future calls.
- The CRE demonstration method is stated plainly: simulation with broadcast, not DON deployment.
- X and Discord are described as designed adapters, never as working inputs.
- Channel handles on the public watchlist may be named as monitored sources. Promotion findings are described as recorded evidence patterns, not accusations of wrongdoing.

## Judge Checklist, Printed on the Build Page

1. Open the live site. No wallet needed.
2. Read the current record and open the latest case file.
3. Follow its transaction link to Sepolia Etherscan.
4. Open one rejected dossier and read its reason code.
5. Check the reliability index and one score movement against its settlement transaction.
6. Read the mandate on the rules page and compare its hash with the case file.
7. Clone the repository, run the replay importer and the CRE dry-run commands from the README.
