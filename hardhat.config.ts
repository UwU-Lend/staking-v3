require("dotenv").config();

import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-contract-sizer";

import { ENetwork } from "./enums/network.enum";
import { HardhatUserConfig } from "hardhat/config";
import { getAllFiles } from "./helpers/utils";
import path from "node:path";

const modulesPath = path.resolve(__dirname, './tasks');
const modulesList = getAllFiles(modulesPath);
modulesList.forEach((modulePath: string) => require(modulePath));

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    [ENetwork.main]: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      chainId: 1,
      accounts: process.env.PRIVATE_KEYS !== undefined ? process.env.PRIVATE_KEYS.split(",") : [],
    },
    [ENetwork.hardhat]: {
      forking: {
        url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        blockNumber: 17117470,
      },
    },
    [ENetwork.local]: {
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
