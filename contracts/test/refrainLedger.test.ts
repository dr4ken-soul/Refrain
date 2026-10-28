import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { RefrainLedger } from "../typechain-types";

const SEPOLIA_CHAIN_SELECTOR = 16015286601757825753n;

// A struct with dynamic members must be ABI encoded as a single element tuple
// containing the struct: the extra offset level is what the Solidity
// abi.decode(data, (Struct)) path expects. Flat lists only match that layout
// when every struct member is static.
const VERDICT_TUPLE_TYPE =
  "tuple(bytes32,bytes32,bytes32,uint8,uint8,uint8,uint8,uint256,uint256,uint256,uint256,uint64,uint64,uint64,uint64,bytes32[],bytes32[],uint8[])";
const SETTLEMENT_TUPLE_TYPE =
  "tuple(uint256,uint8,uint256,int256,uint64,uint64,bytes32[],bytes32[],int256[])";

function encodeVerdictPayload(r: VerdictReportInput): string {
  const body = coder.encode(
    [VERDICT_TUPLE_TYPE],
    [[
      r.caseHash,
      r.rulesetHash,
      r.assetHash,
      r.caseKind,
      r.decision,
      r.reason,
      r.direction,
      r.entryPrice1e8,
      r.stopPrice1e8,
      r.targetPrice1e8,
      r.sizeUnits,
      r.openedAt,
      r.expiresAt,
      r.chainSelector,
      r.scheduledAt,
      r.sourceHashes,
      r.callHashes,
      r.convictions,
    ]],
  );
  return coder.encode(["uint8", "bytes"], [1, body]);
}

function encodeSettlementPayload(r: SettlementReportInput): string {
  const body = coder.encode(
    [SETTLEMENT_TUPLE_TYPE],
    [[
      r.positionId,
      r.exitReason,
      r.exitPrice1e8,
      r.pnlUnits,
      r.chainSelector,
      r.scheduledAt,
      r.sourceHashes,
      r.callHashes,
      r.scoreDeltas,
    ]],
  );
  return coder.encode(["uint8", "bytes"], [2, body]);
}

interface VerdictReportInput {
  caseHash: string;
  rulesetHash: string;
  assetHash: string;
  caseKind: number;
  decision: number;
  reason: number;
  direction: number;
  entryPrice1e8: bigint;
  stopPrice1e8: bigint;
  targetPrice1e8: bigint;
  sizeUnits: bigint;
  openedAt: bigint;
  expiresAt: bigint;
  chainSelector: bigint;
  scheduledAt: bigint;
  sourceHashes: string[];
  callHashes: string[];
  convictions: number[];
}

interface SettlementReportInput {
  positionId: bigint;
  exitReason: number;
  exitPrice1e8: bigint;
  pnlUnits: bigint;
  chainSelector: bigint;
  scheduledAt: bigint;
  sourceHashes: string[];
  callHashes: string[];
  scoreDeltas: bigint[];
}

const coder = ethers.AbiCoder.defaultAbiCoder();

function textHash(label: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

interface FixtureResult {
  ledger: RefrainLedger;
  owner: Awaited<ReturnType<typeof ethers.getSigners>>[number];
  forwarder: Awaited<ReturnType<typeof ethers.getSigners>>[number];
}

async function deployFixture(): Promise<FixtureResult> {
  const [owner] = await ethers.getSigners();
  const forwarderAddress = ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)));
  const ledger = await ethers.deployContract("RefrainLedger", [
    forwarderAddress,
    SEPOLIA_CHAIN_SELECTOR,
  ]);
  return { ledger, owner, forwarder: await impersonate(forwarderAddress) };
}

const impersonatedAccounts = new Set<string>();

async function impersonate(address: string): Promise<FixtureResult["forwarder"]> {
  if (!impersonatedAccounts.has(address)) {
    await ethers.provider.send("hardhat_setBalance", [address, "0x84595161401484A000000"]);
    await ethers.provider.send("hardhat_impersonateAccount", [address]);
    impersonatedAccounts.add(address);
  }
  return await ethers.getSigner(address);
}

function baseVerdict(overrides: Partial<VerdictReportInput> = {}): VerdictReportInput {
  return {
    caseHash: textHash("case-1"),
    rulesetHash: textHash("ruleset-v1"),
    assetHash: textHash("asset-BTC"),
    caseKind: 0,
    decision: 0,
    reason: 0,
    direction: 0,
    entryPrice1e8: 10_000_000_000n, // 100.00 with 8 decimals
    stopPrice1e8: 9_000_000_000n,
    targetPrice1e8: 12_000_000_000n,
    sizeUnits: 5_000n, // paper USDC cents: 50.00 dollars
    openedAt: 1_759_000_000n,
    expiresAt: 1_759_003_600n,
    chainSelector: SEPOLIA_CHAIN_SELECTOR,
    scheduledAt: 1_759_000_100n,
    sourceHashes: [textHash("source-A")],
    callHashes: [textHash("call-1")],
    convictions: [70],
    ...overrides,
  };
}

function baseSettlement(overrides: Partial<SettlementReportInput> = {}): SettlementReportInput {
  return {
    positionId: 1n,
    exitReason: 0,
    exitPrice1e8: 12_000_000_000n,
    pnlUnits: 10_000n,
    chainSelector: SEPOLIA_CHAIN_SELECTOR,
    scheduledAt: 1_759_003_700n,
    sourceHashes: [textHash("source-A")],
    callHashes: [textHash("call-1")],
    scoreDeltas: [100n],
    ...overrides,
  };
}

describe("RefrainLedger", function () {
  describe("construction", function () {
    it("reverts a zero forwarder address", async function () {
      const factory = await ethers.getContractFactory("RefrainLedger");
      await expect(factory.deploy(ethers.ZeroAddress, SEPOLIA_CHAIN_SELECTOR)).to.be.revertedWithCustomError(
        factory,
        "InvalidForwarderAddress",
      );
    });

    it("supports IReceiver and ERC165 only", async function () {
      const { ledger } = await loadFixture(deployFixture);
      expect(await ledger.supportsInterface("0x01ffc9a7")).to.equal(true); // ERC165
      expect(await ledger.supportsInterface("0xffffffff")).to.equal(false);
      const receiverInterfaceId = ethers.keccak256(ethers.toUtf8Bytes("onReport(bytes,bytes)")).slice(0, 10);
      expect(await ledger.supportsInterface(receiverInterfaceId)).to.equal(true);
    });
  });

  describe("verdict filing", function () {
    it("reverts a report from a non-forwarder caller", async function () {
      const { ledger, owner } = await loadFixture(deployFixture);
      const payload = encodeVerdictPayload(baseVerdict());
      await expect(ledger.connect(owner).onReport("0x", payload)).to.be.revertedWithCustomError(
        ledger,
        "InvalidSender",
      );
    });

    it("files an approved verdict and opens one paper position", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const verdict = baseVerdict();
      const payload = encodeVerdictPayload(verdict);

      const tx = await ledger.connect(forwarder).onReport("0x", payload);
      await expect(tx).to.emit(ledger, "VerdictFiled").withArgs(
        verdict.caseHash,
        verdict.rulesetHash,
        verdict.assetHash,
        verdict.caseKind,
        verdict.decision,
        verdict.reason,
        verdict.direction,
      );
      await expect(tx).to.emit(ledger, "PositionOpened").withArgs(
        1n,
        verdict.caseHash,
        verdict.caseKind,
        verdict.direction,
        verdict.entryPrice1e8,
        verdict.stopPrice1e8,
        verdict.targetPrice1e8,
        verdict.sizeUnits,
        verdict.openedAt,
        verdict.expiresAt,
        verdict.sourceHashes,
        verdict.callHashes,
        verdict.convictions,
      );

      expect(await ledger.isVerdictRecorded(verdict.caseHash)).to.equal(true);
      const stored = await ledger.getVerdict(verdict.caseHash);
      expect(stored.decision).to.equal(verdict.decision);
      expect(stored.entryPrice1e8).to.equal(verdict.entryPrice1e8);
      expect(await ledger.getPositionCount()).to.equal(1n);

      const position = await ledger.getPosition(1n);
      expect(position.caseHash).to.equal(verdict.caseHash);
      expect(position.settled).to.equal(false);
    });

    it("reverts a second verdict for the same case hash", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const first = baseVerdict();
      await ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(first));

      const duplicate = baseVerdict({ scheduledAt: first.scheduledAt + 10n });
      await expect(
        ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(duplicate)),
      ).to.be.revertedWithCustomError(ledger, "CaseAlreadyFiled").withArgs(duplicate.caseHash);
    });

    it("reverts a report with a scheduled slot not newer than the last accepted one", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const first = baseVerdict();
      await ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(first));

      const stale = baseVerdict({ caseHash: textHash("case-2"), scheduledAt: first.scheduledAt });
      await expect(
        ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(stale)),
      ).to.be.revertedWithCustomError(ledger, "StaleReport");
    });

    it("reverts a report intended for another chain", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const wrongChain = baseVerdict({ chainSelector: 16015286601757825752n });
      await expect(
        ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(wrongChain)),
      ).to.be.revertedWithCustomError(ledger, "UnexpectedChainSelector");
    });

    it("reverts a rejected verdict that tries to open a position anyway", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const rejected = baseVerdict({ decision: 1, reason: 4 }); // Rejected, SINGLE_VOICE_REPETITION
      const tx = await ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(rejected));
      await expect(tx).to.emit(ledger, "VerdictFiled").withArgs(
        rejected.caseHash,
        rejected.rulesetHash,
        rejected.assetHash,
        rejected.caseKind,
        rejected.decision,
        rejected.reason,
        rejected.direction,
      );
      expect(await ledger.getPositionCount()).to.equal(0n);
      expect(await ledger.isVerdictRecorded(rejected.caseHash)).to.equal(true);
    });

    it("files a deferred verdict without opening a position", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const deferred = baseVerdict({ decision: 2, reason: 6 }); // Deferred, PRICE_UNAVAILABLE
      await ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(deferred));
      expect(await ledger.getPositionCount()).to.equal(0n);
      expect(await ledger.isVerdictRecorded(deferred.caseHash)).to.equal(true);
    });

    it("reverts misaligned contributor arrays", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const misaligned = baseVerdict({
        sourceHashes: [textHash("source-A"), textHash("source-B")],
      });
      await expect(
        ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(misaligned)),
      ).to.be.revertedWithCustomError(ledger, "ContributorArraysMismatch");
    });

    it("reverts a conviction above the 0 to 100 scale", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const inflated = baseVerdict({ convictions: [101] });
      await expect(
        ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(inflated)),
      ).to.be.revertedWithCustomError(ledger, "InvalidConviction");
    });

    it("reverts an approved verdict with an invalid position window", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const backwards = baseVerdict({ openedAt: 1_759_003_600n, expiresAt: 1_759_000_000n });
      await expect(
        ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(backwards)),
      ).to.be.revertedWithCustomError(ledger, "InvalidPositionWindow");
    });

    it("reverts an unknown report kind", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const payload = coder.encode(["uint8", "bytes"], [7, "0x"]);
      await expect(
        ledger.connect(forwarder).onReport("0x", payload),
      ).to.be.revertedWithCustomError(ledger, "UnknownReportKind");
    });
  });

  describe("settlement and scores", function () {
    it("settles once, moves the score and never settles again", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      await ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(baseVerdict()));

      const settlement = baseSettlement();
      const tx = await ledger.connect(forwarder).onReport("0x", encodeSettlementPayload(settlement));
      await expect(tx).to.emit(ledger, "PositionSettled").withArgs(
        settlement.positionId,
        settlement.exitReason,
        settlement.exitPrice1e8,
        settlement.pnlUnits,
      );
      await expect(tx).to.emit(ledger, "ScoreUpdated").withArgs(
        settlement.sourceHashes[0],
        settlement.scoreDeltas[0],
        settlement.scoreDeltas[0],
      );

      const position = await ledger.getPosition(1n);
      expect(position.settled).to.equal(true);
      expect(position.exitReason).to.equal(settlement.exitReason);
      expect(position.pnlUnits).to.equal(settlement.pnlUnits);
      expect(await ledger.getScore(settlement.sourceHashes[0])).to.equal(settlement.scoreDeltas[0]);
      expect(await ledger.isCallScored(settlement.callHashes[0])).to.equal(true);

      const second = baseSettlement({ exitReason: 3, scheduledAt: settlement.scheduledAt + 10n });
      await expect(
        ledger.connect(forwarder).onReport("0x", encodeSettlementPayload(second)),
      ).to.be.revertedWithCustomError(ledger, "PositionAlreadySettled");
    });

    it("reverts a settlement that introduces sources instead of the recorded contributors", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      await ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(baseVerdict()));

      const forged = baseSettlement({
        sourceHashes: [textHash("source-Z")],
        callHashes: [textHash("call-1")],
        scoreDeltas: [500n],
      });
      await expect(
        ledger.connect(forwarder).onReport("0x", encodeSettlementPayload(forged)),
      ).to.be.revertedWithCustomError(ledger, "ContributorMismatch");
    });

    it("reverts a source-call commitment that was already scored on another position", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const sharedCall = textHash("call-1");
      await ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(baseVerdict()));
      await ledger
        .connect(forwarder)
        .onReport(
          "0x",
          encodeVerdictPayload(
            baseVerdict({
              caseHash: textHash("case-2"),
              scheduledAt: 1_759_000_200n,
              sourceHashes: [textHash("source-B")],
              callHashes: [sharedCall],
              convictions: [60],
            }),
          ),
        );

      const settleFirst = baseSettlement();
      await ledger.connect(forwarder).onReport("0x", encodeSettlementPayload(settleFirst));

      const settleSecond = baseSettlement({
        positionId: 2n,
        scheduledAt: 1_759_003_800n,
        sourceHashes: [textHash("source-B")],
        callHashes: [sharedCall],
        scoreDeltas: [50n],
      });
      await expect(
        ledger.connect(forwarder).onReport("0x", encodeSettlementPayload(settleSecond)),
      ).to.be.revertedWithCustomError(ledger, "CallAlreadyScored").withArgs(sharedCall);
    });

    it("clamps oversized deltas to plus and minus 500 hundredths", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const sourceA = textHash("source-A");
      const sourceB = textHash("source-B");
      await ledger
        .connect(forwarder)
        .onReport(
          "0x",
          encodeVerdictPayload(
            baseVerdict({
              sourceHashes: [sourceA, sourceB],
              callHashes: [textHash("call-1"), textHash("call-2")],
              convictions: [70, 60],
            }),
          ),
        );

      const settlement = baseSettlement({
        sourceHashes: [sourceA, sourceB],
        callHashes: [textHash("call-1"), textHash("call-2")],
        scoreDeltas: [900n, -900n],
      });
      const tx = await ledger.connect(forwarder).onReport("0x", encodeSettlementPayload(settlement));
      await expect(tx).to.emit(ledger, "ScoreUpdated").withArgs(sourceA, 500n, 500n);
      // SourceB starts at 0 so a negative delta lands on the floor immediately.
      await expect(tx).to.emit(ledger, "ScoreUpdated").withArgs(sourceB, -500n, 0n);
    });

    it("holds the score ceiling at 10000 hundredths", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const source = textHash("source-A");

      let scheduledAt = 1_759_000_100n;
      let settleAt = 1_759_003_700n;
      // 19 max deltas bring the score to 9500.
      for (let i = 1; i <= 19; i++) {
        await ledger
          .connect(forwarder)
          .onReport(
            "0x",
            encodeVerdictPayload(
              baseVerdict({
                caseHash: textHash(`ceiling-case-${i}`),
                scheduledAt,
                sourceHashes: [source],
                callHashes: [textHash(`ceiling-call-${i}`)],
              }),
            ),
          );
        await ledger
          .connect(forwarder)
          .onReport(
            "0x",
            encodeSettlementPayload(
              baseSettlement({
                positionId: BigInt(i),
                scheduledAt: settleAt,
                sourceHashes: [source],
                callHashes: [textHash(`ceiling-call-${i}`)],
                scoreDeltas: [500n],
              }),
            ),
          );
        scheduledAt += 10n;
        settleAt += 10n;
      }
      expect(await ledger.getScore(source)).to.equal(9500n);

      // A reported delta of 1000 is clamped to 500 and lands exactly on the ceiling.
      await ledger
        .connect(forwarder)
        .onReport(
          "0x",
          encodeVerdictPayload(
            baseVerdict({
              caseHash: textHash("ceiling-case-20"),
              scheduledAt,
              sourceHashes: [source],
              callHashes: [textHash("ceiling-call-20")],
            }),
          ),
        );
      const clampTx = await ledger
        .connect(forwarder)
        .onReport(
          "0x",
          encodeSettlementPayload(
            baseSettlement({
              positionId: 20n,
              scheduledAt: settleAt,
              sourceHashes: [source],
              callHashes: [textHash("ceiling-call-20")],
              scoreDeltas: [1_000n],
            }),
          ),
        );
      await expect(clampTx).to.emit(ledger, "ScoreUpdated").withArgs(source, 500n, 10_000n);
      scheduledAt += 10n;
      settleAt += 10n;

      // Further gains cannot push past the ceiling.
      await ledger
        .connect(forwarder)
        .onReport(
          "0x",
          encodeVerdictPayload(
            baseVerdict({
              caseHash: textHash("ceiling-case-21"),
              scheduledAt,
              sourceHashes: [source],
              callHashes: [textHash("ceiling-call-21")],
            }),
          ),
        );
      const ceilingTx = await ledger
        .connect(forwarder)
        .onReport(
          "0x",
          encodeSettlementPayload(
            baseSettlement({
              positionId: 21n,
              scheduledAt: settleAt,
              sourceHashes: [source],
              callHashes: [textHash("ceiling-call-21")],
              scoreDeltas: [500n],
            }),
          ),
        );
      await expect(ceilingTx).to.emit(ledger, "ScoreUpdated").withArgs(source, 500n, 10_000n);
      expect(await ledger.getScore(source)).to.equal(10_000n);
    });

    it("holds the score floor at zero", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      const source = textHash("source-A");
      await ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(baseVerdict()));
      const tx = await ledger
        .connect(forwarder)
        .onReport(
          "0x",
          encodeSettlementPayload(
            baseSettlement({ scoreDeltas: [-900n] }),
          ),
        );
      await expect(tx).to.emit(ledger, "ScoreUpdated").withArgs(source, -500n, 0n);
      expect(await ledger.getScore(source)).to.equal(0n);
    });
  });

  describe("owner powers", function () {
    it("pauses verdict filings while settlements keep working", async function () {
      const { ledger, owner, forwarder } = await loadFixture(deployFixture);
      await ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(baseVerdict()));
      expect(await ledger.filingsPaused()).to.equal(false);

      const pausedTx = await ledger.connect(owner).setFilingsPaused(true);
      await expect(pausedTx).to.emit(ledger, "FilingsPausedSet").withArgs(true);

      const blocked = baseVerdict({ caseHash: textHash("case-2"), scheduledAt: 1_759_000_200n });
      await expect(
        ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(blocked)),
      ).to.be.revertedWithCustomError(ledger, "FilingsPaused");

      const settlement = baseSettlement({ scheduledAt: 1_759_003_700n });
      await ledger.connect(forwarder).onReport("0x", encodeSettlementPayload(settlement));
      expect((await ledger.getPosition(1n)).settled).to.equal(true);
      expect(await ledger.filingsPaused()).to.equal(true);
    });

    it("reassigns the forwarder and enforces it", async function () {
      const { ledger, owner, forwarder } = await loadFixture(deployFixture);
      const newForwarderAddress = ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)));
      const newForwarder = await impersonate(newForwarderAddress);

      await expect(
        ledger.connect(owner).setForwarderAddress(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(ledger, "InvalidForwarderAddress");

      const tx = await ledger.connect(owner).setForwarderAddress(newForwarderAddress);
      await expect(tx).to.emit(ledger, "ForwarderUpdated").withArgs(forwarder.address, newForwarderAddress);

      const oldCaller = ledger.connect(forwarder).onReport("0x", encodeVerdictPayload(baseVerdict()));
      await expect(oldCaller).to.be.revertedWithCustomError(ledger, "InvalidSender");

      await ledger.connect(newForwarder).onReport("0x", encodeVerdictPayload(baseVerdict()));
      expect(await ledger.isVerdictRecorded(textHash("case-1"))).to.equal(true);
    });

    it("limits owner powers to non-owner callers", async function () {
      const { ledger, forwarder } = await loadFixture(deployFixture);
      await expect(ledger.connect(forwarder).setFilingsPaused(true)).to.be.revertedWithCustomError(
        ledger,
        "OwnableUnauthorizedAccount",
      );
      await expect(
        ledger.connect(forwarder).setForwarderAddress(forwarder.address),
      ).to.be.revertedWithCustomError(ledger, "OwnableUnauthorizedAccount");
    });
  });
});
