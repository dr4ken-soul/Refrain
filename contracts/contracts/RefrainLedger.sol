// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IReceiver} from "./interfaces/IReceiver.sol";

/**
 * @title RefrainLedger
 * @notice On-chain paper ledger for the Refrain convergence engine.
 *
 * Chainlink CRE workflows deliver reports through the configured Chainlink
 * forwarder. Each report carries a leading kind marker followed by the ABI
 * encoded body:
 *
 *   kind 1: VerdictReport     one verdict per case hash
 *   kind 2: SettlementReport  one settlement per paper position
 *
 * An approved verdict opens a paper position. A settlement closes that
 * position once and moves each contributing source-call commitment's
 * reliability score by a bounded delta. Every entry is paper bookkeeping:
 * the contract has no payable entry point, holds no asset and exposes no
 * balance or transfer function.
 *
 * Owner powers are intentionally limited to setting the forwarder address
 * and pausing verdict filings, per the product blueprint. The contract
 * implements the IReceiver checks directly instead of inheriting the
 * Chainlink ReceiverTemplate so that no additional owner setters exist.
 * Metadata is accepted as delivered (62 or 64 bytes on production
 * KeystoneForwarder delivery) and is not used for identity checks, which
 * keeps simulation with the MockKeystoneForwarder working.
 *
 * Replay protections per the current CRE consumer contract guide:
 * - cross-chain: every report embeds the target chain selector, which must
 *   equal the immutable deployment selector;
 * - same-chain: every report embeds the cron scheduled slot time, which must
 *   be strictly greater than the last accepted time for its kind.
 */
contract RefrainLedger is IReceiver, Ownable {
    // ------------------------------------------------------------- enums

    enum CaseKind {
        Convergence,
        IndividualCall
    }

    enum Decision {
        Approved,
        Rejected,
        Deferred
    }

    enum Direction {
        Long,
        Short,
        SpotBuy
    }

    enum ExitReason {
        Target,
        Stop,
        Expiry
    }

    // ----------------------------------------------------------- structs

    /// @notice Verdict payload delivered by the verdict workflow.
    /// @dev Decoded from the report body after the kind marker.
    struct VerdictReport {
        bytes32 caseHash;
        bytes32 rulesetHash;
        bytes32 assetHash;
        uint8 caseKind;
        uint8 decision;
        uint8 reason;
        uint8 direction;
        uint256 entryPrice1e8;
        uint256 stopPrice1e8;
        uint256 targetPrice1e8;
        uint256 sizeUnits;
        uint64 openedAt;
        uint64 expiresAt;
        uint64 chainSelector;
        uint64 scheduledAt;
        bytes32[] sourceHashes;
        bytes32[] callHashes;
        uint8[] convictions;
    }

    /// @notice Settlement payload delivered by the settlement workflow.
    struct SettlementReport {
        uint256 positionId;
        uint8 exitReason;
        uint256 exitPrice1e8;
        int256 pnlUnits;
        uint64 chainSelector;
        uint64 scheduledAt;
        bytes32[] sourceHashes;
        bytes32[] callHashes;
        int256[] scoreDeltas;
    }

    /// @notice Stored verdict. The case hash is the storage key.
    struct Verdict {
        uint8 caseKind;
        uint8 decision;
        uint8 reason;
        uint8 direction;
        uint256 entryPrice1e8;
        uint256 stopPrice1e8;
        uint256 targetPrice1e8;
        uint256 sizeUnits;
        uint64 openedAt;
        uint64 expiresAt;
        uint64 scheduledAt;
    }

    /// @notice Stored paper position opened by an approved verdict.
    /// contributorsCommit binds the position to the contributor lists that
    /// the settlement report must repeat exactly.
    struct Position {
        bytes32 caseHash;
        uint8 caseKind;
        uint8 direction;
        uint256 entryPrice1e8;
        uint256 stopPrice1e8;
        uint256 targetPrice1e8;
        uint256 sizeUnits;
        uint64 openedAt;
        uint64 expiresAt;
        bool settled;
        uint8 exitReason;
        uint256 exitPrice1e8;
        int256 pnlUnits;
        bytes32 contributorsCommit;
    }

    // ---------------------------------------------------------- constants

    /// @notice Report kind marker for a verdict report.
    uint8 public constant KIND_VERDICT = 1;
    /// @notice Report kind marker for a settlement report.
    uint8 public constant KIND_SETTLEMENT = 2;

    /// @notice Maximum absolute per-source score delta in hundredths.
    int256 public constant MAX_SCORE_DELTA = 500;
    /// @notice Lowest and highest reliability score in hundredths.
    int256 public constant MIN_SCORE = 0;
    int256 public constant MAX_SCORE = 10_000;
    /// @notice Highest valid conviction on the 0 to 100 scale.
    uint8 public constant MAX_CONVICTION = 100;

    // ------------------------------------------------------------ errors

    error InvalidForwarderAddress();
    error InvalidSender(address sender);
    error UnexpectedChainSelector(uint64 received, uint64 expected);
    error StaleReport(uint64 scheduledAt, uint64 lastAccepted);
    error FilingsPaused();
    error CaseAlreadyFiled(bytes32 caseHash);
    error UnknownReportKind(uint8 kind);
    error InvalidCaseKind(uint8 caseKind);
    error InvalidDecision(uint8 decision);
    error InvalidDirection(uint8 direction);
    error InvalidExitReason(uint8 exitReason);
    error InvalidConviction(uint8 conviction);
    error InvalidPositionWindow(uint64 openedAt, uint64 expiresAt);
    error ContributorArraysMismatch(
        uint256 sourceCount,
        uint256 callCount,
        uint256 convictionCount
    );
    error UnknownPosition(uint256 positionId);
    error PositionAlreadySettled(uint256 positionId);
    error ContributorMismatch(uint256 positionId);
    error CallAlreadyScored(bytes32 callHash);

    // ------------------------------------------------------------ events

    event VerdictFiled(
        bytes32 indexed caseHash,
        bytes32 rulesetHash,
        bytes32 assetHash,
        uint8 caseKind,
        uint8 decision,
        uint8 reason,
        uint8 direction
    );
    event PositionOpened(
        uint256 indexed positionId,
        bytes32 indexed caseHash,
        uint8 caseKind,
        uint8 direction,
        uint256 entryPrice1e8,
        uint256 stopPrice1e8,
        uint256 targetPrice1e8,
        uint256 sizeUnits,
        uint64 openedAt,
        uint64 expiresAt,
        bytes32[] sourceHashes,
        bytes32[] callHashes,
        uint8[] convictions
    );
    event PositionSettled(
        uint256 indexed positionId,
        uint8 exitReason,
        uint256 exitPrice1e8,
        int256 pnlUnits
    );
    event ScoreUpdated(bytes32 indexed sourceHash, int256 delta, int256 newScore);
    event ForwarderUpdated(address indexed previousForwarder, address indexed newForwarder);
    event FilingsPausedSet(bool paused);

    // ----------------------------------------------------------- storage

    address private s_forwarder;
    bool private s_filingsPaused;

    uint64 private immutable EXPECTED_CHAIN_SELECTOR;

    mapping(bytes32 => Verdict) private s_verdicts;
    mapping(bytes32 => bool) private s_verdictRecorded;
    uint256 private s_positionCount;
    mapping(uint256 => Position) private s_positions;
    mapping(bytes32 => int256) private s_scores;
    mapping(bytes32 => bool) private s_scoredCall;
    uint64 private s_lastVerdictScheduledAt;
    uint64 private s_lastSettlementScheduledAt;

    // -------------------------------------------------------- constructor

    /// @param forwarder_ Chainlink forwarder allowed to call onReport. Use the
    /// MockKeystoneForwarder for simulation and the KeystoneForwarder for
    /// production delivery.
    /// @param chainSelector_ Chain selector of the deployment chain, verified
    /// on every report to reject cross-chain replays.
    constructor(address forwarder_, uint64 chainSelector_) Ownable(msg.sender) {
        if (forwarder_ == address(0)) {
            revert InvalidForwarderAddress();
        }
        if (chainSelector_ == 0) {
            revert UnexpectedChainSelector(0, 0);
        }
        s_forwarder = forwarder_;
        EXPECTED_CHAIN_SELECTOR = chainSelector_;
        emit ForwarderUpdated(address(0), forwarder_);
    }

    // ----------------------------------------------------------- receive

    /// @notice Delivers a report to the ledger. Only the configured forwarder
    /// may call this function. Metadata is accepted as delivered and unused.
    function onReport(
        bytes calldata metadata,
        bytes calldata report
    ) external override {
        // Metadata (62 or 64 bytes on production delivery) is accepted as
        // delivered and intentionally unused; no metadata length check so
        // simulation with the MockKeystoneForwarder keeps working.
        metadata;
        if (msg.sender != s_forwarder) {
            revert InvalidSender(msg.sender);
        }
        (uint8 kind, bytes memory body) = abi.decode(report, (uint8, bytes));
        if (kind == KIND_VERDICT) {
            _fileVerdict(abi.decode(body, (VerdictReport)));
        } else if (kind == KIND_SETTLEMENT) {
            _settlePosition(abi.decode(body, (SettlementReport)));
        } else {
            revert UnknownReportKind(kind);
        }
    }

    // --------------------------------------------------------- reporting

    function _fileVerdict(VerdictReport memory r) internal {
        if (s_filingsPaused) {
            revert FilingsPaused();
        }
        if (r.chainSelector != EXPECTED_CHAIN_SELECTOR) {
            revert UnexpectedChainSelector(r.chainSelector, EXPECTED_CHAIN_SELECTOR);
        }
        if (r.scheduledAt == 0 || r.scheduledAt <= s_lastVerdictScheduledAt) {
            revert StaleReport(r.scheduledAt, s_lastVerdictScheduledAt);
        }
        if (s_verdictRecorded[r.caseHash]) {
            revert CaseAlreadyFiled(r.caseHash);
        }
        if (r.caseKind > uint8(CaseKind.IndividualCall)) {
            revert InvalidCaseKind(r.caseKind);
        }
        if (r.decision > uint8(Decision.Deferred)) {
            revert InvalidDecision(r.decision);
        }
        if (
            r.sourceHashes.length != r.callHashes.length ||
            r.callHashes.length != r.convictions.length
        ) {
            revert ContributorArraysMismatch(
                r.sourceHashes.length,
                r.callHashes.length,
                r.convictions.length
            );
        }
        for (uint256 i = 0; i < r.convictions.length; i++) {
            if (r.convictions[i] > MAX_CONVICTION) {
                revert InvalidConviction(r.convictions[i]);
            }
        }
        s_verdictRecorded[r.caseHash] = true;
        s_lastVerdictScheduledAt = r.scheduledAt;
        s_verdicts[r.caseHash] = Verdict({
            caseKind: r.caseKind,
            decision: r.decision,
            reason: r.reason,
            direction: r.direction,
            entryPrice1e8: r.entryPrice1e8,
            stopPrice1e8: r.stopPrice1e8,
            targetPrice1e8: r.targetPrice1e8,
            sizeUnits: r.sizeUnits,
            openedAt: r.openedAt,
            expiresAt: r.expiresAt,
            scheduledAt: r.scheduledAt
        });
        emit VerdictFiled(
            r.caseHash,
            r.rulesetHash,
            r.assetHash,
            r.caseKind,
            r.decision,
            r.reason,
            r.direction
        );
        if (r.decision == uint8(Decision.Approved)) {
            _openPosition(r);
        }
    }

    function _openPosition(VerdictReport memory r) internal {
        if (r.direction > uint8(Direction.SpotBuy)) {
            revert InvalidDirection(r.direction);
        }
        if (r.entryPrice1e8 == 0 || r.sizeUnits == 0) {
            revert InvalidPositionWindow(r.openedAt, r.expiresAt);
        }
        if (r.openedAt == 0 || r.expiresAt < r.openedAt) {
            revert InvalidPositionWindow(r.openedAt, r.expiresAt);
        }
        uint256 positionId = s_positionCount + 1;
        s_positionCount = positionId;
        Position storage position = s_positions[positionId];
        position.caseHash = r.caseHash;
        position.caseKind = r.caseKind;
        position.direction = r.direction;
        position.entryPrice1e8 = r.entryPrice1e8;
        position.stopPrice1e8 = r.stopPrice1e8;
        position.targetPrice1e8 = r.targetPrice1e8;
        position.sizeUnits = r.sizeUnits;
        position.openedAt = r.openedAt;
        position.expiresAt = r.expiresAt;
        position.contributorsCommit = keccak256(abi.encode(r.sourceHashes, r.callHashes));
        emit PositionOpened(
            positionId,
            r.caseHash,
            r.caseKind,
            r.direction,
            r.entryPrice1e8,
            r.stopPrice1e8,
            r.targetPrice1e8,
            r.sizeUnits,
            r.openedAt,
            r.expiresAt,
            r.sourceHashes,
            r.callHashes,
            r.convictions
        );
    }

    function _settlePosition(SettlementReport memory r) internal {
        if (r.chainSelector != EXPECTED_CHAIN_SELECTOR) {
            revert UnexpectedChainSelector(r.chainSelector, EXPECTED_CHAIN_SELECTOR);
        }
        if (r.scheduledAt == 0 || r.scheduledAt <= s_lastSettlementScheduledAt) {
            revert StaleReport(r.scheduledAt, s_lastSettlementScheduledAt);
        }
        if (r.exitReason > uint8(ExitReason.Expiry)) {
            revert InvalidExitReason(r.exitReason);
        }
        if (r.positionId == 0 || r.positionId > s_positionCount) {
            revert UnknownPosition(r.positionId);
        }
        Position storage position = s_positions[r.positionId];
        if (position.settled) {
            revert PositionAlreadySettled(r.positionId);
        }
        if (
            r.sourceHashes.length != r.callHashes.length ||
            r.callHashes.length != r.scoreDeltas.length
        ) {
            revert ContributorArraysMismatch(
                r.sourceHashes.length,
                r.callHashes.length,
                r.scoreDeltas.length
            );
        }
        if (keccak256(abi.encode(r.sourceHashes, r.callHashes)) != position.contributorsCommit) {
            revert ContributorMismatch(r.positionId);
        }
        for (uint256 i = 0; i < r.sourceHashes.length; i++) {
            bytes32 callHash = r.callHashes[i];
            if (s_scoredCall[callHash]) {
                revert CallAlreadyScored(callHash);
            }
            s_scoredCall[callHash] = true;
            _applyScore(r.sourceHashes[i], r.scoreDeltas[i]);
        }
        position.settled = true;
        position.exitReason = r.exitReason;
        position.exitPrice1e8 = r.exitPrice1e8;
        position.pnlUnits = r.pnlUnits;
        emit PositionSettled(r.positionId, r.exitReason, r.exitPrice1e8, r.pnlUnits);
    }

    /// @notice Applies one bounded delta to one source score and clamps the
    /// result to the score floor and ceiling.
    function _applyScore(bytes32 sourceHash, int256 delta) internal {
        int256 clamped = delta;
        if (clamped > MAX_SCORE_DELTA) {
            clamped = MAX_SCORE_DELTA;
        } else if (clamped < -MAX_SCORE_DELTA) {
            clamped = -MAX_SCORE_DELTA;
        }
        int256 newScore = s_scores[sourceHash] + clamped;
        if (newScore > MAX_SCORE) {
            newScore = MAX_SCORE;
        } else if (newScore < MIN_SCORE) {
            newScore = MIN_SCORE;
        }
        s_scores[sourceHash] = newScore;
        emit ScoreUpdated(sourceHash, clamped, newScore);
    }

    // ------------------------------------------------------------ owner

    /// @notice Points the ledger at a new forwarder, for example when moving
    /// from the simulation MockKeystoneForwarder to the production
    /// KeystoneForwarder. Zero addresses are rejected.
    function setForwarderAddress(address forwarder_) external onlyOwner {
        if (forwarder_ == address(0)) {
            revert InvalidForwarderAddress();
        }
        address previous = s_forwarder;
        s_forwarder = forwarder_;
        emit ForwarderUpdated(previous, forwarder_);
    }

    /// @notice Pauses or resumes verdict filings. Settlements are not gated so
    /// open paper positions can always be closed.
    function setFilingsPaused(bool paused) external onlyOwner {
        s_filingsPaused = paused;
        emit FilingsPausedSet(paused);
    }

    // ------------------------------------------------------------- views

    function getVerdict(bytes32 caseHash) external view returns (Verdict memory) {
        return s_verdicts[caseHash];
    }

    function isVerdictRecorded(bytes32 caseHash) external view returns (bool) {
        return s_verdictRecorded[caseHash];
    }

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return s_positions[positionId];
    }

    function getPositionCount() external view returns (uint256) {
        return s_positionCount;
    }

    function getScore(bytes32 sourceHash) external view returns (int256) {
        return s_scores[sourceHash];
    }

    function isCallScored(bytes32 callHash) external view returns (bool) {
        return s_scoredCall[callHash];
    }

    function forwarderAddress() external view returns (address) {
        return s_forwarder;
    }

    function filingsPaused() external view returns (bool) {
        return s_filingsPaused;
    }

    function expectedChainSelector() external view returns (uint64) {
        return EXPECTED_CHAIN_SELECTOR;
    }

    // -------------------------------------------------------------- ERC165

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
