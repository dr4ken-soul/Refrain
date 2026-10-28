import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// The project env file lives at the repository root.
dotenv.config({ path: "../.env" });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL ?? "",
      accounts: process.env.CRE_ETH_PRIVATE_KEY ? [process.env.CRE_ETH_PRIVATE_KEY] : [],
    },
    // Same chain through Blockscout's keyless Etherscan-compatible API so the
    // deployment can be source verified without an Etherscan API key.
    "sepolia-blockscout": {
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL ?? "",
      accounts: process.env.CRE_ETH_PRIVATE_KEY ? [process.env.CRE_ETH_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      "sepolia-blockscout": "no-key-needed",
    },
    customChains: [
      {
        network: "sepolia-blockscout",
        chainId: 11155111,
        urls: {
          apiURL: "https://eth-sepolia.blockscout.com/api",
          browserURL: "https://eth-sepolia.blockscout.com",
        },
      },
    ],
  },
};

export default config;
