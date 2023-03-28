import { BigNumber, Contract } from "ethers";
import { POOL_CONFIGURATOR, incentivesControllerV3Fixture } from "./fixtures/IncentivesControllerV3";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";

const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const PRECISION = BigNumber.from(10).pow(12);

type PoolInfo = {
  totalSupply: BigNumber,
  allocPoint: BigNumber,
  lastRewardTime: BigNumber,
  accRewardPerShare: BigNumber,
  onwardIncentives: string,
};

describe("IncentivesControllerV3", () => {
  describe.skip("Deployment", () => {
    it("Should be deployed with correct parameters", async () => {
      const { controllerV2, controllerV3, distributor } = await loadFixture(incentivesControllerV3Fixture);
      expect(controllerV3.address).to.properAddress;
      const configurator: string = await controllerV3.poolConfigurator();
      const minter: string = await controllerV3.rewardMinter();
      const controller: string = await controllerV3.incentivesController();
      expect(minter).to.equal(distributor.address);
      expect(configurator).to.equal(POOL_CONFIGURATOR);
      expect(controller).to.equal(controllerV2.address);
    });
  });
  describe.skip("setup", () => {
    it("Should be able to setup the controller with with correct parameters", async () => {
      const { controllerV2, controllerV3 } = await loadFixture(incentivesControllerV3Fixture);
      await expect(controllerV3.setup()).to.be.not.reverted;
      const startTimeV2: BigNumber = await controllerV2.startTime();
      const startTimeV3: BigNumber = await controllerV3.startTime();
      const rewardsPerSecondV2: BigNumber = await controllerV2.rewardsPerSecond();
      const rewardsPerSecondV3: BigNumber = await controllerV3.rewardsPerSecond();
      const mintedTokensV2: BigNumber = await controllerV2.mintedTokens();
      const mintedTokensV3: BigNumber = await controllerV3.mintedTokens();
      const maxMintableTokensV2: BigNumber = await controllerV2.maxMintableTokens();
      const maxMintableTokensV3: BigNumber = await controllerV3.maxMintableTokens();
      expect(startTimeV3).to.equal(startTimeV2);
      expect(rewardsPerSecondV3).to.equal(rewardsPerSecondV2);
      expect(mintedTokensV3).to.equal(mintedTokensV2);
      expect(maxMintableTokensV3).to.equal(maxMintableTokensV2);
      await expect(controllerV3.setup()).to.be.reverted;
    });
  });
  describe.skip("addPool", () => {
    it("Should be able to add a pool", async () => {
      const { controllerV3 } = await loadFixture(incentivesControllerV3Fixture);
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      await ethers.provider.send("hardhat_setBalance", [POOL_CONFIGURATOR, BigNumber.from("1000000000000000000000").toHexString()]);
      const latestTime: number = await time.latest();
      await controllerV3.connect(configuratorSigner).addPool(DAI_ADDRESS, 1000);
      const poolInfo: PoolInfo = await controllerV3.poolInfo(DAI_ADDRESS);
      const length: BigNumber = await controllerV3.poolLength();
      expect(length).to.equal(1);
      expect(poolInfo.totalSupply).to.equal(0);
      expect(poolInfo.allocPoint).to.equal(1000);
      expect(poolInfo.lastRewardTime).to.equal(latestTime + 1);
      expect(poolInfo.accRewardPerShare).to.equal(0);
      expect(poolInfo.onwardIncentives).to.equal(ethers.constants.AddressZero);
    });
  });
  describe.skip("poolLength", () => {
    it("Should return correct pool length", async () => {
      const { controllerV3 } = await loadFixture(incentivesControllerV3Fixture);
      const length0: BigNumber = await controllerV3.poolLength();
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      await ethers.provider.send("hardhat_setBalance", [POOL_CONFIGURATOR, ethers.utils.parseEther('1000').toHexString()]);
      await controllerV3.connect(configuratorSigner).addPool(DAI_ADDRESS, 1000);
      const length1: BigNumber = await controllerV3.poolLength();
      expect(length0).to.equal(0);
      expect(length1).to.equal(1);
    });
  });
  describe("handleAction", () => {
    it("Sould be receive data from v2", async () => {
      const { controllerV2, controllerV3 } = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send('hardhat_setBalance', [tokenSigner.address, ethers.utils.parseEther('1000').toHexString()]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther('1000');
      const balanceInWei2: BigNumber = ethers.utils.parseEther('2000');
      const balanceInWei3: BigNumber = ethers.utils.parseEther('3000');
      await controllerV2.connect(tokenSigner).handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await controllerV3.setup();
      await controllerV3.connect(tokenSigner).handleAction(user1.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const poolInfo0 = await controllerV3.poolInfo(tokenAddress);
      const rewardDebt0: BigNumber = balanceInWei2.mul(poolInfo0.accRewardPerShare).div(PRECISION);
      const userInfo0 = await controllerV3.userInfo(tokenAddress, user1.address);
      expect(userInfo0.amount).to.be.equal(balanceInWei2);
      expect(userInfo0.rewardDebt).to.be.equal(rewardDebt0);
      await controllerV3.connect(tokenSigner).handleAction(user1.address, balanceInWei3, balanceInWei3.add(totalSupply));
      const poolInfo1 = await controllerV3.poolInfo(tokenAddress);
      const rewardDebt1: BigNumber = balanceInWei3.mul(poolInfo1.accRewardPerShare).div(PRECISION);
      const userInfo1 = await controllerV3.userInfo(tokenAddress, user1.address);
      expect(userInfo1.amount).to.be.equal(balanceInWei3);
      expect(userInfo1.rewardDebt).to.be.equal(rewardDebt1);
    });
  });
  describe("claimableReward", () => {});
  describe("claim", () => {});

  describe("batchUpdateAllocPoint", () => {});
  describe("setRewardMinter", () => {});
  describe("setOnwardIncentives", () => {});
  describe("setClaimReceiver", () => {});
});