import {HardhatUserConfig} from "hardhat/types";
import "@nomiclabs/hardhat-waffle"
import "tsconfig-paths/register";
import "@typechain/hardhat"
import "@nomiclabs/hardhat-ethers"
import "hardhat-gas-reporter"

require("dotenv").config();

const privateKeys = (process.env.PRIVATE_KEYS ?? "0000000000000000000000000000000000000000000000000000000000000000").split(",")

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    testnet: {
      url: process.env.JSONRPC_URL ?? "http://localhost:8545",
      accounts: [
          ...privateKeys,
      ],
    },
    mainnet: {
      url: process.env.JSONRPC_URL ?? "http://localhost:8545",
      accounts: [
        ...privateKeys,
      ],
    },
    hardhat: {
      accounts: {
        accountsBalance: "10000000000000000000000000000000" // 10B ETH
      }
    }
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 21
  },
  typechain: {
    outDir: "types",
    target: "ethers-v5",
    alwaysGenerateOverloads: false,
    externalArtifacts: ["externalArtifacts/*.json"],
  },
};

export default config;
