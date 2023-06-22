import { BigNumber } from 'ethers';
import { Contract } from 'ethers';
import { IERC20 } from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import incentivesControllerV1ABI from '../../abi/InsentivesControllerV1.json';
import incentivesControllerV2ABI from '../../abi/InsentivesControllerV2.json';
import multiFeeDistributionV2ABI from '../../abi/MultiFeeDistributionV2.json';

export type IncentivesControllerV3FixtureResult = {
  controllerV1: Contract;
  controllerV2: Contract;
  controllerV3: Contract;
  // distributor: Contract;
  rewardMinterV2: Contract;
  rewardMinterV3: Contract;
  rewardToken: IERC20;
  rewardTokenHolder: SignerWithAddress;
}

export const MAX_MINTABLE = '6975000000000000000000000';
export const POOL_CONFIGURATOR = '0x408c9764993209DC772eB12FF641F4b55F5b005C';
export const REWARD_TOKEN = '0x55C08ca52497e2f1534B59E2917BF524D4765257';
export const INCENTIVES_CONTROLLER_V1 = '0x21953192664867e19F85E96E1D1Dd79dc31cCcdB';
export const INCENTIVES_CONTROLLER_V2 = '0xDB5C23ae97f76dacC907f5F13bDa54131C8e9e5a';
export const MULTI_FEE_DISTRIBUTION_V2 = '0x0a7B2A21027F92243C5e5E777aa30BB7969b0188';
export const REWARD_TOKEN_HOLDER = '0xC671A6B1415dE6549B05775Ee4156074731190c6';

export const incentivesControllerV3Fixture = async (): Promise<IncentivesControllerV3FixtureResult> => {
  const rewardToken = await ethers.getContractAt('IERC20', REWARD_TOKEN);
  await ethers.provider.send('hardhat_setBalance', [REWARD_TOKEN_HOLDER, ethers.utils.parseEther('1000').toHexString()]);
  const rewardTokenHolder = await ethers.getImpersonatedSigner(REWARD_TOKEN_HOLDER);
  const Distributor = await ethers.getContractFactory('MultiFeeDistributionMock');
  const rewardMinterV3 = await Distributor.deploy(rewardToken.address);
  const controllerV1 = new ethers.Contract(INCENTIVES_CONTROLLER_V1, incentivesControllerV1ABI, ethers.provider);
  const controllerV2 = new ethers.Contract(INCENTIVES_CONTROLLER_V2, incentivesControllerV2ABI, ethers.provider);
  const rewardMinterV2 = new ethers.Contract(MULTI_FEE_DISTRIBUTION_V2, multiFeeDistributionV2ABI, ethers.provider);
  const IncentivesControllerV3 = await ethers.getContractFactory('IncentivesControllerV3');
  const controllerV3 = await IncentivesControllerV3.deploy(POOL_CONFIGURATOR, rewardMinterV3.address, controllerV2.address);
  return { controllerV1, controllerV2, controllerV3, rewardMinterV2, rewardMinterV3, rewardToken, rewardTokenHolder };
}