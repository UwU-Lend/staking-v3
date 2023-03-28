require("dotenv").config();

import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";

import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    main: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      chainId: 1,
      accounts: process.env.PRIVATE_KEYS !== undefined ? process.env.PRIVATE_KEYS.split(",") : [],
    },
    hardhat: {
      forking: {
        url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        blockNumber: 16926135,
      },
    },
    local: {
      url: "http://127.0.0.1:8545/",
      chainId: 31337,
    }
  },
  mocha: {
    timeout: 40000
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};

export default config;
