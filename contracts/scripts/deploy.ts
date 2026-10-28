import { ethers } from "hardhat";

// Ethereum Sepolia forwarder addresses from the CRE forwarder directory.
// Simulation (cre workflow simulate) uses the MockKeystoneForwarder.
// Production DON delivery uses the KeystoneForwarder and the owner moves the
// ledger over with setForwarderAddress afterwards.
const SEPOLIA_MOCK_FORWARDER = "0x15fC6ae953E024d975e77382eEeC56A9101f9F88";
const SEPOLIA_KEYSTONE_FORWARDER = "0xF8344CFd5c43616a4366C34E3EEE75af79a74482";
const SEPOLIA_CHAIN_SELECTOR = 16015286601757825753n;

async function main() {
  const forwarder = process.env.DEPLOY_FORWARDER ?? SEPOLIA_MOCK_FORWARDER;
  if (forwarder !== SEPOLIA_MOCK_FORWARDER && forwarder !== SEPOLIA_KEYSTONE_FORWARDER) {
    throw new Error(
      "DEPLOY_FORWARDER must be the Sepolia MockKeystoneForwarder or the Sepolia KeystoneForwarder",
    );
  }

  const ledger = await ethers.deployContract("RefrainLedger", [
    forwarder,
    SEPOLIA_CHAIN_SELECTOR,
  ]);
  await ledger.waitForDeployment();

  const address = await ledger.getAddress();
  console.log("RefrainLedger deployed to:", address);
  console.log("Forwarder:", forwarder);
  console.log("Chain selector:", SEPOLIA_CHAIN_SELECTOR.toString());
  console.log("Deployer:", (await ethers.getSigners())[0].address);
  console.log(
    "Explorer: https://sepolia.etherscan.io/address/" + address,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
