import { BigNumber, Contract } from "ethers";
import { MultiFeeDistributionV3, MultiFeeDistributionV3__factory } from "../../typechain-types";
import { TokensContracts, getTokensContracts, getTokensDecimals, getTokensHolders } from "../../utils/tokens";
import hre, { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import distributorABI from '../../abi/MultiFeeDistributionV2.json';
import kyberSwapNFTABI from '../../abi/KyberSwapNFT.json';

const DISTRIBUTOR_ADDRESS = '0x0a7B2A21027F92243C5e5E777aa30BB7969b0188';
const KYBERSWAP_NFT_ADDRESS = '0x2B1c7b41f6A8F2b2bc45C3233a5d5FB3cD6dC9A8';
const KYBERSWAP_NFT_IDS = [861, 867, 868];
// 0,0x0000000000000000000000000000000000000000,51,-65040,-40140,84710803113366835301,0,0
// -67140,-47700

type ReplaceTreasuryFixtureResult = {
  treasury: MultiFeeDistributionV3;
  nftIds: [number, number, number];
  nftOwners: [SignerWithAddress, SignerWithAddress, SignerWithAddress];
  nft: Contract;
  tokens: {
    contracts: Record<keyof TokensContracts, Contract>;
    decimals: Record<keyof TokensContracts, number>;
    holders: Record<keyof TokensContracts, SignerWithAddress>;
  };
}
export const ReplaceTreasuryFixture = async (): Promise<ReplaceTreasuryFixtureResult> => {
  const [deployer] = await ethers.getSigners();
  const MultiFeeDistributionV3Factory: MultiFeeDistributionV3__factory = await ethers.getContractFactory("MultiFeeDistributionV3");
  const distributor = new ethers.Contract(DISTRIBUTOR_ADDRESS, distributorABI, ethers.provider);
  const rewardTokenAddress: string = await distributor.rewardToken();
  const rewardTokenVaultAddress: string = await distributor.rewardTokenVault();
  const incentivesControllerAddress: string = await distributor.incentivesController();
  const kyberSwapNFT: Contract = new ethers.Contract(KYBERSWAP_NFT_ADDRESS, kyberSwapNFTABI, ethers.provider);
  const owner0: string = await kyberSwapNFT.ownerOf(KYBERSWAP_NFT_IDS[0]);
  const owner1: string = await kyberSwapNFT.ownerOf(KYBERSWAP_NFT_IDS[1]);
  const owner2: string = await kyberSwapNFT.ownerOf(KYBERSWAP_NFT_IDS[2]);
  const signer0 = await ethers.getImpersonatedSigner(owner0);
  const signer1 = await ethers.getImpersonatedSigner(owner1);
  const signer2 = await ethers.getImpersonatedSigner(owner2);
  await ethers.provider.send('hardhat_setBalance', [owner0, BigNumber.from('1000000000000000000000').toHexString()]);
  await ethers.provider.send('hardhat_setBalance', [owner1, BigNumber.from('1000000000000000000000').toHexString()]);
  await ethers.provider.send('hardhat_setBalance', [owner2, BigNumber.from('1000000000000000000000').toHexString()]);
  const nftIds: [number, number, number] = [KYBERSWAP_NFT_IDS[0], KYBERSWAP_NFT_IDS[1], KYBERSWAP_NFT_IDS[2]];
  const nftOwners: [SignerWithAddress, SignerWithAddress, SignerWithAddress] = [signer0, signer1, signer2];
  const tokens = {
    contracts: await getTokensContracts(hre),
    decimals: await getTokensDecimals(hre),
    holders: await getTokensHolders(hre),
  };
  const poolId = 51;
  const tickRange: [number, number] = [-65040, -40140];
  const treasury: MultiFeeDistributionV3 = await MultiFeeDistributionV3Factory.deploy(KYBERSWAP_NFT_ADDRESS, poolId, tickRange, rewardTokenAddress, rewardTokenVaultAddress);
  await treasury.deployed();
  await treasury.setIncentivesController(incentivesControllerAddress);
  return { treasury, nftIds, nftOwners, tokens, nft: kyberSwapNFT };
}