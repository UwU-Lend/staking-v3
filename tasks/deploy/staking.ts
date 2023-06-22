import { IncentivesControllerV3, MultiFeeDistributionUNIV3POS, MultiFeeDistributionV3 } from "../../typechain-types";
import { deployIncentivesController, deployMultiFeeDistribution } from "../../helpers/contracts-deployments";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { setHRE } from "../../helpers/utils";
import { task } from "hardhat/config";
import { waitTx } from "../../helpers/contracts-helpers";

type TaskArgs = {};

const POOL_CONFIGURATOR = "0x408c9764993209DC772eB12FF641F4b55F5b005C";
const INCENTIVES_CONTROLLER = "0xDB5C23ae97f76dacC907f5F13bDa54131C8e9e5a";
const NFT = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const POS_CONFIG = {
  token0: '0x55C08ca52497e2f1534B59E2917BF524D4765257',
  token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  fee: '10000',
  tickLower: '-57800',
  tickUpper: '-35000',
}
const REWARD_TOKEN = "0x55C08ca52497e2f1534B59E2917BF524D4765257";
const REWARD_TOKEN_VAULT = "0x5776F9bf6568f252cE5Fa85F8fEe3c0d8dE914D8";

task("deploy:staking", "Deploy staking contract")
  .setAction(async ({  }: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    setHRE(hre);
    const treasury: MultiFeeDistributionUNIV3POS = await deployMultiFeeDistribution(NFT, POS_CONFIG, REWARD_TOKEN, REWARD_TOKEN_VAULT);
    const incentivesController: IncentivesControllerV3 = await deployIncentivesController(POOL_CONFIGURATOR, treasury.address, INCENTIVES_CONTROLLER);
    // await waitTx(await treasury.setIncentivesController(incentivesController.address));
  });