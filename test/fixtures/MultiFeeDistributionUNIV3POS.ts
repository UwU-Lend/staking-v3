import { BigNumber, Contract, ContractReceipt, ContractTransaction, Event } from "ethers";
import { MultiFeeDistributionUNIV3POS, MultiFeeDistributionUNIV3POS__factory, UniswapNFTMock, UniswapNFTMock__factory } from "../../typechain-types";
import { TokensContracts, getTokensContracts, getTokensDecimals, getTokensHolders } from "../../utils/tokens";
import hre, { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import distributorABI from '../../abi/MultiFeeDistributionV2.json';
import { time } from "@nomicfoundation/hardhat-network-helpers";

type FixtureResult = {
  treasury: MultiFeeDistributionUNIV3POS;
  nft: Contract;
  minterSigner: SignerWithAddress;
  tokens: {
    contracts: Record<keyof TokensContracts, Contract>;
    decimals: Record<keyof TokensContracts, number>;
    holders: Record<keyof TokensContracts, SignerWithAddress>;
  };
};

export type PositionConfig = {
  token0: string;
  token1: string;
  fee: string;
  tickLower: string;
  tickUpper: string;
};

export const POSITION_CONFIG: PositionConfig = {
  token0: '0x55C08ca52497e2f1534B59E2917BF524D4765257',
  token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  fee: '10000',
  tickLower: '-73200',
  tickUpper: '-30000',
};

type MintParams = {
  fee: string;
  tickLower: string;
  tickUpper: string;
  amount0Desired: string;
  amount1Desired: string;
  amount0Min: string;
  amount1Min: string;
}

const DISTRIBUTOR_ADDRESS = '0x0a7B2A21027F92243C5e5E777aa30BB7969b0188';

const fixture = async (): Promise<FixtureResult> => {
  const [, owner1] = await ethers.getSigners();
  const TreasuryFactory: MultiFeeDistributionUNIV3POS__factory = await ethers.getContractFactory("MultiFeeDistributionUNIV3POS");
  const distributor = new ethers.Contract(DISTRIBUTOR_ADDRESS, distributorABI, ethers.provider);
  const rewardTokenAddress: string = await distributor.rewardToken();
  const rewardTokenVaultAddress: string = await distributor.rewardTokenVault();
  const incentivesControllerAddress: string = await distributor.incentivesController();
  const nftFactory: UniswapNFTMock__factory = await ethers.getContractFactory('UniswapNFTMock');
  const nft: UniswapNFTMock = await nftFactory.deploy();
  const rewardTokenVaultSigner: SignerWithAddress = await ethers.getImpersonatedSigner(rewardTokenVaultAddress);
  await ethers.provider.send('hardhat_setBalance', [rewardTokenVaultSigner.address, BigNumber.from('1000000000000000000000').toHexString()]);
  const tokens = {
    contracts: await getTokensContracts(hre),
    decimals: await getTokensDecimals(hre),
    holders: await getTokensHolders(hre),
  };
  const treasury = await TreasuryFactory.deploy(nft.address, POSITION_CONFIG, rewardTokenAddress, rewardTokenVaultAddress);
  await treasury.deployed();
  await treasury.setIncentivesController(incentivesControllerAddress);
  await treasury.setMinters([incentivesControllerAddress]);
  await tokens.contracts.uwu.connect(rewardTokenVaultSigner).approve(treasury.address, ethers.constants.MaxUint256);
  const minterSigner: SignerWithAddress = await ethers.getImpersonatedSigner(incentivesControllerAddress);
  await ethers.provider.send("hardhat_setBalance", [minterSigner.address, BigNumber.from('1000000000000000000000').toHexString()]);
  return { treasury, nft, minterSigner, tokens };
}

export default fixture;
