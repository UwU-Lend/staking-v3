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

type UserInfo = {
  amount: BigNumber;
  rewardDebt: BigNumber;
}

const calcClaimableReward = (poolInfo: PoolInfo, userInfo: UserInfo, rewardsPerSecond: BigNumber, totalAllocPoint: BigNumber, blockTimestamp: BigNumber ): BigNumber => {
  let accRewardPerShare = poolInfo.accRewardPerShare;
  const lpSupply = poolInfo.totalSupply;
  if (blockTimestamp.gt(poolInfo.lastRewardTime) && lpSupply.toString() != '0') {
    const duration = blockTimestamp.sub(poolInfo.lastRewardTime);
    const reward = duration.mul(rewardsPerSecond).mul(poolInfo.allocPoint).div(totalAllocPoint);
    accRewardPerShare = accRewardPerShare.add(reward.mul(PRECISION).div(lpSupply));
  }
  return userInfo.amount.mul(accRewardPerShare).div(PRECISION).sub(userInfo.rewardDebt);
}

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
  describe.skip("handleAction", () => {
    it("Sould be receive data from v2", async () => {
      const { controllerV2, controllerV3 } = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send('hardhat_setBalance', [tokenSigner.address, ethers.utils.parseEther('1000').toHexString()]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther('1000');
      await controllerV2.connect(tokenSigner).handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await controllerV3.setup();
      const poolInfo2 = await controllerV2.poolInfo(tokenAddress);
      const rewardDebt2: BigNumber = balanceInWei1.mul(poolInfo2.accRewardPerShare).div(PRECISION);
      const userInfo2 = await controllerV2.userInfo(tokenAddress, user1.address);
      const userInfo3 = await controllerV3.userInfo(tokenAddress, user1.address);
      expect(userInfo2.amount).to.be.equal(balanceInWei1);
      expect(userInfo2.rewardDebt).to.be.equal(rewardDebt2);
      expect(userInfo3.amount).to.be.equal(0);
      expect(userInfo3.rewardDebt).to.be.equal(0);
    });
    it("Sould be receive data from v3", async () => {
      const { controllerV2, controllerV3 } = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send('hardhat_setBalance', [tokenSigner.address, ethers.utils.parseEther('1000').toHexString()]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther('1000');
      await controllerV3.setup();
      await controllerV3.connect(tokenSigner).handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      const poolInfo3 = await controllerV3.poolInfo(tokenAddress);
      const rewardDebt3: BigNumber = balanceInWei1.mul(poolInfo3.accRewardPerShare).div(PRECISION);
      const userInfo3 = await controllerV3.userInfo(tokenAddress, user1.address);
      expect(userInfo3.amount).to.be.equal(balanceInWei1);
      expect(userInfo3.rewardDebt).to.be.equal(rewardDebt3);
    });
    it("Should be able to receive data from v2 and v3", async () => {
      const { controllerV2, controllerV3 } = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send('hardhat_setBalance', [tokenSigner.address, ethers.utils.parseEther('1000').toHexString()]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther('1000');
      const balanceInWei2: BigNumber = ethers.utils.parseEther('1000');
      await controllerV2.connect(tokenSigner).handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await controllerV3.setup();
      await controllerV3.connect(tokenSigner).handleAction(user1.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const poolInfo2 = await controllerV2.poolInfo(tokenAddress);
      const rewardDebt2: BigNumber = balanceInWei1.mul(poolInfo2.accRewardPerShare).div(PRECISION);
      const userInfo2 = await controllerV2.userInfo(tokenAddress, user1.address);
      const poolInfo3 = await controllerV3.poolInfo(tokenAddress);
      const rewardDebt3: BigNumber = balanceInWei2.mul(poolInfo3.accRewardPerShare).div(PRECISION);
      const userInfo3 = await controllerV3.userInfo(tokenAddress, user1.address);
      expect(userInfo2.amount).to.be.equal(balanceInWei1);
      expect(userInfo2.rewardDebt).to.be.equal(rewardDebt2);
      expect(userInfo3.amount).to.be.equal(balanceInWei2);
      expect(userInfo3.rewardDebt).to.be.equal(rewardDebt3);
    });
  });
  describe.skip("claimableReward", () => {
    it("Should be able to receive data from v2", async () => {
      const { controllerV2, controllerV3 } = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send('hardhat_setBalance', [tokenSigner.address, ethers.utils.parseEther('1000').toHexString()]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther('1000');
      await controllerV2.connect(tokenSigner).handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await controllerV3.setup();
      const blockTimestamp: BigNumber = BigNumber.from(await time.increase(86400 * 7));
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const poolInfo2 = await controllerV2.poolInfo(tokenAddress);
      const userInfo2 = await controllerV2.userInfo(tokenAddress, user1.address);
      const calcClaimableReward2 = calcClaimableReward(poolInfo2, userInfo2, rewardsPerSecond, totalAllocPoint, blockTimestamp);
      const claimableReward2: BigNumber[] = await controllerV2.claimableReward(user1.address, [token.address]);
      const claimableReward3: BigNumber[] = await controllerV3.claimableReward(user1.address, [token.address]);
      expect(claimableReward2[0]).to.be.equal(calcClaimableReward2);
      expect(claimableReward3[0]).to.be.equal(calcClaimableReward2);
    });
    it("Should be able to receive data from v3", async () => {
      const { controllerV2, controllerV3 } = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send('hardhat_setBalance', [tokenSigner.address, ethers.utils.parseEther('1000').toHexString()]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther('1000');
      await controllerV3.setup();
      await controllerV3.connect(tokenSigner).handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      const blockTimestamp: BigNumber = BigNumber.from(await time.increase(86400 * 7));
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const poolInfo3 = await controllerV3.poolInfo(tokenAddress);
      const userInfo3 = await controllerV3.userInfo(tokenAddress, user1.address);
      const calcClaimableReward3 = calcClaimableReward(poolInfo3, userInfo3, rewardsPerSecond, totalAllocPoint, blockTimestamp);
      const claimableReward3: BigNumber[] = await controllerV3.claimableReward(user1.address, [token.address]);
      expect(claimableReward3[0]).to.be.equal(calcClaimableReward3);
    });
    it("Should be able to receive data from v2 and v3", async () => {
      const { controllerV2, controllerV3 } = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send('hardhat_setBalance', [tokenSigner.address, ethers.utils.parseEther('1000').toHexString()]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther('1000');
      const balanceInWei2: BigNumber = ethers.utils.parseEther('1000');
      await controllerV2.connect(tokenSigner).handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await controllerV3.setup();
      await controllerV3.connect(tokenSigner).handleAction(user1.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const blockTimestamp: BigNumber = BigNumber.from(await time.increase(86400 * 7));
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const poolInfo2 = await controllerV2.poolInfo(tokenAddress);
      const userInfo2 = await controllerV2.userInfo(tokenAddress, user1.address);
      const poolInfo3 = await controllerV3.poolInfo(tokenAddress);
      const userInfo3 = await controllerV3.userInfo(tokenAddress, user1.address);
      const calcClaimableReward2 = calcClaimableReward(poolInfo2, userInfo2, rewardsPerSecond, totalAllocPoint, blockTimestamp);
      const calcClaimableReward3 = calcClaimableReward(poolInfo3, userInfo3, rewardsPerSecond, totalAllocPoint, blockTimestamp);
      const claimableReward2: BigNumber[] = await controllerV2.claimableReward(user1.address, [token.address]);
      const claimableReward3: BigNumber[] = await controllerV3.claimableReward(user1.address, [token.address]);
      expect(claimableReward2[0]).to.be.equal(calcClaimableReward2);
      expect(claimableReward3[0]).to.be.equal(calcClaimableReward3);
    });
  });
  describe("claim", () => {
    it("Should be able to claim (call v2 handleAction)", async () => {
      const { controllerV2, controllerV3, distributor, rewardToken, rewardTokenHolder } = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(distributor.address, ethers.utils.parseEther('1000'));
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send('hardhat_setBalance', [tokenSigner.address, ethers.utils.parseEther('1000').toHexString()]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei: BigNumber = ethers.utils.parseEther('1000');
      await controllerV2.connect(tokenSigner).handleAction(user1.address, balanceInWei, balanceInWei.add(totalSupply));
      await time.increase(86400 * 3);
      await controllerV3.setup();
      await time.increase(86400 * 5);


      const blockTimestamp: BigNumber = BigNumber.from(await time.increase(86400 * 7));
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const poolInfo2 = await controllerV2.poolInfo(tokenAddress);
      const userInfo2 = await controllerV2.userInfo(tokenAddress, user1.address);
      const calcClaimableReward2 = calcClaimableReward(poolInfo2, userInfo2, rewardsPerSecond, totalAllocPoint, blockTimestamp);
      // const claimableReward3: BigNumber[] = await controllerV3.claimableReward(user1.address, [token.address]);


      const balanceBefore: BigNumber = await rewardToken.balanceOf(user1.address);
      await controllerV3.claim(user1.address, [token.address]);
      const balanceAfter: BigNumber = await rewardToken.balanceOf(user1.address);

      console.log('Balances', balanceAfter.sub(balanceBefore), calcClaimableReward2);


      // expect(balanceAfter.sub(balanceBefore)).to.be.equals(userBaseClaimable.add(calcReward));
    });
    it("Should be able to claim (call v2 handleAction twice)", async () => {});
    it("Should be able to claim (call v3 handleAction)", async () => {});
    it("Should be able to claim (call v3 handleAction twice)", async () => {});
    it("Should be correct executed: handle action v2 -> migration -> claim v3 -> claim v3", async () => {});
  });

  describe("batchUpdateAllocPoint", () => {});
  describe("setRewardMinter", () => {});
  describe("setOnwardIncentives", () => {});
  describe("setClaimReceiver", () => {});
});