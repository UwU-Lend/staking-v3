import {BigNumber, Contract} from "ethers";
import { IERC20, OnwardIncentivesController } from "../typechain-types";
import {POOL_CONFIGURATOR, incentivesControllerV3Fixture} from "./fixtures/IncentivesControllerV3";
import {SnapshotRestorer, loadFixture, takeSnapshot, time} from "@nomicfoundation/hardhat-network-helpers";

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {expect} from "chai";

const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const PRECISION = BigNumber.from(10).pow(12);

type PoolInfo = {
  totalSupply: BigNumber;
  allocPoint: BigNumber;
  lastRewardTime: BigNumber;
  accRewardPerShare: BigNumber;
  onwardIncentives: string;
};

type UserInfo = {
  amount: BigNumber;
  rewardDebt: BigNumber;
};

type WithdrawableBalance = {
  amount: BigNumber;
  penaltyAmount: BigNumber;
  amountWithoutPenalty: BigNumber;
};

type HandleActionCall = {
  token: string;
  user: string;
  balance: BigNumber;
  totalSupply: BigNumber;
}

const calcClaimableReward = (
  poolInfo: PoolInfo,
  userInfo: UserInfo,
  rewardsPerSecond: BigNumber,
  totalAllocPoint: BigNumber,
  blockTimestamp: BigNumber
): BigNumber => {
  let accRewardPerShare = poolInfo.accRewardPerShare;
  const lpSupply = poolInfo.totalSupply;
  if (blockTimestamp.gt(poolInfo.lastRewardTime) && lpSupply.toString() != "0") {
    const duration = blockTimestamp.sub(poolInfo.lastRewardTime);
    const reward = duration.mul(rewardsPerSecond).mul(poolInfo.allocPoint).div(totalAllocPoint);
    accRewardPerShare = accRewardPerShare.add(reward.mul(PRECISION).div(lpSupply));
  }
  return userInfo.amount.mul(accRewardPerShare).div(PRECISION).sub(userInfo.rewardDebt);
};

describe("IncentivesControllerV3", () => {
  describe("Deployment", () => {
    it("Should be deployed with correct parameters", async () => {
      const {controllerV2, controllerV3, rewardMinterV3} = await loadFixture(incentivesControllerV3Fixture);
      expect(controllerV3.address).to.properAddress;
      const configurator: string = await controllerV3.poolConfigurator();
      const minter: string = await controllerV3.rewardMinter();
      const controller: string = await controllerV3.incentivesController();
      expect(minter).to.equal(rewardMinterV3.address);
      expect(configurator).to.equal(POOL_CONFIGURATOR);
      expect(controller).to.equal(controllerV2.address);
    });
    it("Should be reverted if poolConfigurator address zero", async () => {
      const deployTx: Promise<Contract> = ethers.deployContract("IncentivesControllerV3", [
        ethers.constants.AddressZero,
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
      ]);
      await expect(deployTx).to.be.revertedWith("pool configurator not set");
    });
    it("Should be reverted if rewardMinter address zero", async () => {
      const deployTx: Promise<Contract> = ethers.deployContract("IncentivesControllerV3", [
        "0x0000000000000000000000000000000000000001",
        ethers.constants.AddressZero,
        "0x0000000000000000000000000000000000000002",
      ]);
      await expect(deployTx).to.be.revertedWith("reward minter not set");
    });
    it("Should be reverted if incentivesController address zero", async () => {
      const deployTx: Promise<Contract> = ethers.deployContract("IncentivesControllerV3", [
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
        ethers.constants.AddressZero,
      ]);
      await expect(deployTx).to.be.revertedWith("incentives controller not set");
    });
  });
  describe("setup", () => {
    it("Should be able to setup the controller with with correct parameters", async () => {
      const {controllerV2, controllerV3} = await loadFixture(incentivesControllerV3Fixture);
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
    it("Should be rejected if sender not owner", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, sender] = await ethers.getSigners();
      await expect(controllerV3.connect(sender).setup()).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  describe("addPool", () => {
    it("Should be able to add a pool", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      await ethers.provider.send("hardhat_setBalance", [
        POOL_CONFIGURATOR,
        BigNumber.from("1000000000000000000000").toHexString(),
      ]);
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
    it("Should be reverted if token address zero", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      await ethers.provider.send("hardhat_setBalance", [
        POOL_CONFIGURATOR,
        BigNumber.from("1000000000000000000000").toHexString(),
      ]);
      await expect(
        controllerV3.connect(configuratorSigner).addPool(ethers.constants.AddressZero, 1000)
      ).to.be.rejectedWith("token cannot be zero address");
    });
    it("Should be reverted if sender not pool configurator", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, sender] = await ethers.getSigners();
      await expect(controllerV3.connect(sender).addPool(DAI_ADDRESS, 1000)).to.be.rejectedWith(
        "only pool configurator can add pools"
      );
    });
    it("Should be reverted if pool already registered", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      await ethers.provider.send("hardhat_setBalance", [
        POOL_CONFIGURATOR,
        BigNumber.from("1000000000000000000000").toHexString(),
      ]);
      await expect(controllerV3.connect(configuratorSigner).addPool(DAI_ADDRESS, 1000)).to.be.not.rejected;
      await expect(controllerV3.connect(configuratorSigner).addPool(DAI_ADDRESS, 1000)).to.be.rejectedWith(
        "pool already registered"
      );
    });
  });
  describe("poolLength", () => {
    it("Should return correct pool length", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const length0: BigNumber = await controllerV3.poolLength();
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      await ethers.provider.send("hardhat_setBalance", [
        POOL_CONFIGURATOR,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      await controllerV3.connect(configuratorSigner).addPool(DAI_ADDRESS, 1000);
      const length1: BigNumber = await controllerV3.poolLength();
      expect(length0).to.equal(0);
      expect(length1).to.equal(1);
    });
  });
  describe("handleAction", () => {
    it("Sould be receive data from v2", async () => {
      const {controllerV2, controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
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
      const {controllerV2, controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      await controllerV3.setup();
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      const poolInfo3 = await controllerV3.poolInfo(tokenAddress);
      const rewardDebt3: BigNumber = balanceInWei1.mul(poolInfo3.accRewardPerShare).div(PRECISION);
      const userInfo3 = await controllerV3.userInfo(tokenAddress, user1.address);
      expect(userInfo3.amount).to.be.equal(balanceInWei1);
      expect(userInfo3.rewardDebt).to.be.equal(rewardDebt3);
    });
    it("Should be able to receive data from v2 and v3", async () => {
      const {controllerV2, controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      const balanceInWei2: BigNumber = ethers.utils.parseEther("1000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await controllerV3.setup();
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei2, balanceInWei2.add(totalSupply));
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
    it("Should be reverted if pool not registered", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user] = await ethers.getSigners();
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(DAI_ADDRESS);
      await ethers.provider.send("hardhat_setBalance", [DAI_ADDRESS, ethers.utils.parseEther("1000").toHexString()]);
      await expect(
        controllerV3
          .connect(tokenSigner)
          .handleAction(user.address, ethers.utils.parseEther("100"), ethers.utils.parseEther("1000"))
      ).to.be.revertedWith("pool not registered");
    });
    it("Should be don't reaction by very small amount", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      await controllerV3.setup();
      const [, user1] = await ethers.getSigners();
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(DAI_ADDRESS);
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      await ethers.provider.send("hardhat_setBalance", [
        configuratorSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      await expect(controllerV3.connect(configuratorSigner).addPool(tokenSigner.address, 1000)).to.be.not.rejected;
      await controllerV3.connect(tokenSigner).handleAction(user1.address, 1, ethers.utils.parseEther("100"));
      const userBaseClaimable1: BigNumber = await controllerV3.userBaseClaimable(user1.address);
      await controllerV3.connect(tokenSigner).handleAction(user1.address, 1, ethers.utils.parseEther("100"));
      const userBaseClaimable2: BigNumber = await controllerV3.userBaseClaimable(user1.address);
      expect(userBaseClaimable1).to.be.equal(0);
      expect(userBaseClaimable2).to.be.equal(0);
    });
    it("Should be reverted if amount is zero", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user] = await ethers.getSigners();
      const onwardIncentivesController = await ethers.deployContract("OnwardIncentivesController");
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(DAI_ADDRESS);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      await ethers.provider.send("hardhat_setBalance", [
        configuratorSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      await controllerV3.connect(configuratorSigner).addPool(tokenSigner.address, 1000);
      await controllerV3.setOnwardIncentives(tokenSigner.address, onwardIncentivesController.address);
      const lastCall1: HandleActionCall = await onwardIncentivesController.lastCall();
      await controllerV3.connect(tokenSigner).handleAction(user.address, 0, ethers.utils.parseEther("100"));
      const lastCall2: HandleActionCall = await onwardIncentivesController.lastCall();
      expect(lastCall1.token).to.be.equal(ethers.constants.AddressZero);
      expect(lastCall1.user).to.be.equal(ethers.constants.AddressZero);
      expect(lastCall1.balance).to.be.equal(0);
      expect(lastCall1.totalSupply).to.be.equal(0);
      expect(lastCall2.token).to.be.equal(tokenSigner.address);
      expect(lastCall2.user).to.be.equal(user.address);
      expect(lastCall2.balance).to.be.equal(0);
      expect(lastCall2.totalSupply).to.be.equal(ethers.utils.parseEther("100"));
    });
  });
  describe("claimableReward", () => {
    it("Should be able to receive data from v2", async () => {
      const {controllerV2, controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await controllerV3.setup();
      const blockTimestamp: BigNumber = BigNumber.from(await time.increase(86400 * 7));
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const poolInfo2 = await controllerV2.poolInfo(tokenAddress);
      const userInfo2 = await controllerV2.userInfo(tokenAddress, user1.address);
      const calcClaimableReward2 = calcClaimableReward(
        poolInfo2,
        userInfo2,
        rewardsPerSecond,
        totalAllocPoint,
        blockTimestamp
      );
      const claimableReward2: BigNumber[] = await controllerV2.claimableReward(user1.address, [token.address]);
      const claimableReward3: BigNumber[] = await controllerV3.claimableReward(user1.address, [token.address]);
      expect(claimableReward2[0]).to.be.equal(calcClaimableReward2);
      expect(claimableReward3[0]).to.be.equal(calcClaimableReward2);
    });
    it("Should be able to receive data from v3", async () => {
      const {controllerV2, controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      await controllerV3.setup();
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      const blockTimestamp: BigNumber = BigNumber.from(await time.increase(86400 * 7));
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const poolInfo3 = await controllerV3.poolInfo(tokenAddress);
      const userInfo3 = await controllerV3.userInfo(tokenAddress, user1.address);
      const calcClaimableReward3 = calcClaimableReward(
        poolInfo3,
        userInfo3,
        rewardsPerSecond,
        totalAllocPoint,
        blockTimestamp
      );
      const claimableReward3: BigNumber[] = await controllerV3.claimableReward(user1.address, [token.address]);
      expect(claimableReward3[0]).to.be.equal(calcClaimableReward3);
    });
    it("Should be able to receive data from v2 and v3", async () => {
      const {controllerV2, controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token: Contract = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      const balanceInWei2: BigNumber = ethers.utils.parseEther("1000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await controllerV3.setup();
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const blockTimestamp: BigNumber = BigNumber.from(await time.increase(86400 * 7));
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const poolInfo2 = await controllerV2.poolInfo(tokenAddress);
      const userInfo2 = await controllerV2.userInfo(tokenAddress, user1.address);
      const poolInfo3 = await controllerV3.poolInfo(tokenAddress);
      const userInfo3 = await controllerV3.userInfo(tokenAddress, user1.address);
      const calcClaimableReward2 = calcClaimableReward(
        poolInfo2,
        userInfo2,
        rewardsPerSecond,
        totalAllocPoint,
        blockTimestamp
      );
      const calcClaimableReward3 = calcClaimableReward(
        poolInfo3,
        userInfo3,
        rewardsPerSecond,
        totalAllocPoint,
        blockTimestamp
      );
      const claimableReward2: BigNumber[] = await controllerV2.claimableReward(user1.address, [token.address]);
      const claimableReward3: BigNumber[] = await controllerV3.claimableReward(user1.address, [token.address]);
      expect(claimableReward2[0]).to.be.equal(calcClaimableReward2);
      expect(claimableReward3[0]).to.be.equal(calcClaimableReward3);
    });
    it("Should be skipped empty pool", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user] = await ethers.getSigners();
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      await ethers.provider.send("hardhat_setBalance", [
        POOL_CONFIGURATOR,
        BigNumber.from("1000000000000000000000").toHexString(),
      ]);
      await controllerV3.connect(configuratorSigner).addPool(DAI_ADDRESS, 1000);
      const claimableReward: BigNumber[] = await controllerV3.claimableReward(user.address, [DAI_ADDRESS]);
      expect(claimableReward.length).to.be.equal(1);
      expect(claimableReward[0]).to.be.equal(0);
    });
  });
  describe("claim", () => {
    it("Should be able to claim (call v2 handleAction)", async () => {
      const {controllerV2, controllerV3, rewardMinterV3, rewardToken, rewardTokenHolder} = await loadFixture(
        incentivesControllerV3Fixture
      );
      const [, user1] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("1000"));
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei: BigNumber = ethers.utils.parseEther("1000");
      await controllerV2.connect(tokenSigner).handleAction(user1.address, balanceInWei, balanceInWei.add(totalSupply));
      await time.increase(86400 * 3);
      await controllerV3.setup();
      await time.increase(86400 * 3);
      const userBaseClaimable0: BigNumber = await controllerV2.userBaseClaimable(user1.address);
      const blockTimestamp: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1); // 1 second for call claim method
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const poolInfo = await controllerV3.poolInfo(tokenAddress);
      const userInfo = await controllerV2.userInfo(tokenAddress, user1.address);
      const calcClaimableReward2 = calcClaimableReward(
        poolInfo,
        userInfo,
        rewardsPerSecond,
        totalAllocPoint,
        blockTimestamp
      );
      const balanceBefore: BigNumber = await rewardToken.balanceOf(user1.address);
      await controllerV3.claim(user1.address, [token.address]);
      const balanceAfter: BigNumber = await rewardToken.balanceOf(user1.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.equals(calcClaimableReward2.add(userBaseClaimable0));
    });
    it("Should be able to claim (call v3 handleAction)", async () => {
      const {controllerV2, controllerV3, rewardMinterV3, rewardToken, rewardTokenHolder} = await loadFixture(
        incentivesControllerV3Fixture
      );
      const [, user1] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("1000"));
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      const balanceInWei2: BigNumber = ethers.utils.parseEther("2000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await time.increase(86400 * 3);
      await controllerV3.setup();
      await time.increase(86400 * 3);
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const userBaseClaimable0: BigNumber = await controllerV3.userBaseClaimable(user1.address);
      const userInfo = await controllerV3.userInfo(tokenAddress, user1.address);
      const blockTimestamp: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1); // 1 second for call claim method
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const poolInfo = await controllerV3.poolInfo(tokenAddress);
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const calcClaimableReward1 = calcClaimableReward(
        poolInfo,
        userInfo,
        rewardsPerSecond,
        totalAllocPoint,
        blockTimestamp
      );
      const balanceBefore: BigNumber = await rewardToken.balanceOf(user1.address);
      await controllerV3.claim(user1.address, [token.address]);
      const balanceAfter: BigNumber = await rewardToken.balanceOf(user1.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.equals(calcClaimableReward1.add(userBaseClaimable0));
    });
    it("Should be correctly called claim, it means that userBaseClaimable has accumulated effect", async () => {
      const {controllerV2, controllerV3, rewardMinterV3, rewardToken, rewardTokenHolder} = await loadFixture(
        incentivesControllerV3Fixture
      );
      const [, user1] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("1000"));
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      const balanceInWei2: BigNumber = ethers.utils.parseEther("2000");
      const balanceInWei3: BigNumber = ethers.utils.parseEther("3000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await time.increase(86400 * 3);
      const userBaseClaimable0: BigNumber = await controllerV2.userBaseClaimable(user1.address);
      await controllerV3.setup();
      await time.increase(86400 * 3);
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const userBaseClaimable1: BigNumber = await controllerV3.userBaseClaimable(user1.address);
      await time.increase(86400 * 3);
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei3, balanceInWei3.add(totalSupply));
      const userBaseClaimable2: BigNumber = await controllerV3.userBaseClaimable(user1.address);

      const userInfo = await controllerV3.userInfo(tokenAddress, user1.address);
      const blockTimestamp: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1); // 1 second for call claim method
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const poolInfo = await controllerV3.poolInfo(tokenAddress);
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const calcClaimableReward1 = calcClaimableReward(
        poolInfo,
        userInfo,
        rewardsPerSecond,
        totalAllocPoint,
        blockTimestamp
      );
      const balanceBefore: BigNumber = await rewardToken.balanceOf(user1.address);
      await controllerV3.claim(user1.address, [token.address]);
      const balanceAfter: BigNumber = await rewardToken.balanceOf(user1.address);
      expect(userBaseClaimable0).to.be.equal(0);
      expect(userBaseClaimable1).to.be.lt(userBaseClaimable2);
      expect(balanceAfter.sub(balanceBefore)).to.be.equals(calcClaimableReward1.add(userBaseClaimable2));

      // expect(balanceAfter.sub(balanceBefore)).to.be.equals(calcClaimableReward1);
    });
    it("Should be correct executed: handle action v2 -> migration -> claim v3 -> claim v3", async () => {
      const {controllerV2, controllerV3, rewardMinterV3, rewardToken, rewardTokenHolder} = await loadFixture(
        incentivesControllerV3Fixture
      );
      const [, user1] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("1000"));
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await time.increase(86400 * 5);
      await controllerV3.setup();
      await time.increase(86400 * 5);
      const userInfo = await controllerV2.userInfo(tokenAddress, user1.address);
      const blockTimestamp1: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const poolInfo = await controllerV3.poolInfo(tokenAddress);
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const calcClaimableReward1 = calcClaimableReward(
        poolInfo,
        userInfo,
        rewardsPerSecond,
        totalAllocPoint,
        blockTimestamp1
      );
      const balance0: BigNumber = await rewardToken.balanceOf(user1.address);
      await controllerV3.claim(user1.address, [token.address]);
      const balance1: BigNumber = await rewardToken.balanceOf(user1.address);
      const blockTimestamp2: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const calcClaimableReward2 = calcClaimableReward(
        poolInfo,
        userInfo,
        rewardsPerSecond,
        totalAllocPoint,
        blockTimestamp2
      );
      await controllerV3.claim(user1.address, [token.address]);
      const balance2: BigNumber = await rewardToken.balanceOf(user1.address);
      expect(calcClaimableReward1.sub(balance1)).to.be.gte(0);
      expect(calcClaimableReward1.sub(balance1)).to.be.lte(1e9);
      expect(calcClaimableReward2.sub(balance2)).to.be.gte(0);
      expect(calcClaimableReward2.sub(balance2)).to.be.lte(1e9);
    });
    it("Should be rejected if pool not registered", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user] = await ethers.getSigners();
      await expect(controllerV3.claim(user.address, [ethers.constants.AddressZero])).to.be.revertedWith(
        "pool not registered"
      );
    });
    it("Should be minted only maxMintableTokens", async () => {
      const {controllerV3, rewardToken, rewardMinterV3, rewardTokenHolder } = await loadFixture(incentivesControllerV3Fixture);
      const [, user] = await ethers.getSigners();
      await controllerV3.setup();
      const mintedTokens: BigNumber = await controllerV3.mintedTokens();
      const maxMintableTokens: BigNumber = await controllerV3.maxMintableTokens();
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(DAI_ADDRESS);
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      await ethers.provider.send("hardhat_setBalance", [tokenSigner.address, ethers.utils.parseEther("1000").toHexString()]);
      await ethers.provider.send("hardhat_setBalance", [configuratorSigner.address, ethers.utils.parseEther("1000").toHexString()]);
      await controllerV3.connect(configuratorSigner).addPool(DAI_ADDRESS, 1000);
      await controllerV3.connect(tokenSigner).handleAction(user.address, ethers.utils.parseEther("100"), ethers.utils.parseEther("100"));
      await time.increase(86400 * 365 * 20);
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("7000000"));
      await controllerV3.claim(user.address, [tokenSigner.address]);
      const balance1: BigNumber = await rewardToken.balanceOf(user.address);
      await time.increase(86400 * 365 * 1);
      await controllerV3.claim(user.address, [tokenSigner.address]);
      const balance12: BigNumber = await rewardToken.balanceOf(user.address);
      expect(balance1).to.be.equal(maxMintableTokens.sub(mintedTokens));
      expect(balance12).to.be.equal(balance1);
    });
    it("Should be mint tokens to receiver", async () => {
      const {controllerV3, rewardToken, rewardMinterV3, rewardTokenHolder } = await loadFixture(incentivesControllerV3Fixture);
      const [, user, receiver] = await ethers.getSigners();
      await controllerV3.setup();
      await controllerV3.connect(user).setClaimReceiver(receiver.address);
      const mintedTokens: BigNumber = await controllerV3.mintedTokens();
      const maxMintableTokens: BigNumber = await controllerV3.maxMintableTokens();
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(DAI_ADDRESS);
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      await ethers.provider.send("hardhat_setBalance", [tokenSigner.address, ethers.utils.parseEther("1000").toHexString()]);
      await ethers.provider.send("hardhat_setBalance", [configuratorSigner.address, ethers.utils.parseEther("1000").toHexString()]);
      await controllerV3.connect(configuratorSigner).addPool(DAI_ADDRESS, 1000);
      await controllerV3.connect(tokenSigner).handleAction(user.address, ethers.utils.parseEther("100"), ethers.utils.parseEther("100"));
      await time.increase(86400 * 365 * 20);
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("7000000"));
      await controllerV3.claim(user.address, [tokenSigner.address]);
      const userBalance1: BigNumber = await rewardToken.balanceOf(user.address);
      const receiverBalance1: BigNumber = await rewardToken.balanceOf(receiver.address);
      await time.increase(86400 * 365 * 1);
      await controllerV3.claim(user.address, [tokenSigner.address]);
      const userBalance2: BigNumber = await rewardToken.balanceOf(user.address);
      const receiverBalance2: BigNumber = await rewardToken.balanceOf(receiver.address);
      expect(userBalance1).to.be.equal(0);
      expect(userBalance2).to.be.equal(0);
      expect(receiverBalance1).to.be.equal(maxMintableTokens.sub(mintedTokens));
      expect(receiverBalance2).to.be.equal(receiverBalance1);
    });
  });
  describe("batchUpdateAllocPoint", () => {
    it("Should be possible called only owner", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [owner, notOwner] = await ethers.getSigners();
      await controllerV3.setup();
      await expect(
        controllerV3.connect(notOwner).batchUpdateAllocPoint([ethers.constants.AddressZero], [0])
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(controllerV3.connect(owner).batchUpdateAllocPoint([await controllerV3.registeredTokens(0)], [0])).to
        .be.not.rejected;
    });
    it("Should be able update alloc points in batch", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      await controllerV3.setup();
      const allocPoints = [1, 2, 3];
      const tokens: string[] = await Promise.all([
        controllerV3.registeredTokens(0),
        controllerV3.registeredTokens(1),
        controllerV3.registeredTokens(2),
      ]);
      await controllerV3.batchUpdateAllocPoint(tokens, allocPoints);
      for (let i = 0; i < tokens.length; i++) {
        const poolInfo = await controllerV3.poolInfo(tokens[i]);
        expect(poolInfo.allocPoint).to.be.equal(allocPoints[i]);
      }
    });
    it("Should be rejected if lengths tokens and allocPoints not equal", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      await expect(controllerV3.batchUpdateAllocPoint([], [1])).to.be.revertedWith("arrays not same length");
    });
    it("Should be rejected if pool not registered", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      await expect(controllerV3.batchUpdateAllocPoint([ethers.constants.AddressZero], [1])).to.be.revertedWith(
        "pool not registered"
      );
    });
    it("Should be update lastRewardTime and not updated accRewardPerShare if pool empty", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const configuratorSigner: SignerWithAddress = await ethers.getImpersonatedSigner(POOL_CONFIGURATOR);
      await ethers.provider.send("hardhat_setBalance", [
        POOL_CONFIGURATOR,
        BigNumber.from("1000000000000000000000").toHexString(),
      ]);
      await controllerV3.connect(configuratorSigner).addPool(DAI_ADDRESS, 1000);
      await controllerV3.batchUpdateAllocPoint([DAI_ADDRESS], [1]);
      const poolInfo: PoolInfo = await controllerV3.poolInfo(DAI_ADDRESS);
      expect(poolInfo.accRewardPerShare).to.be.equal(0);
    });
  });
  describe("setRewardMinter", () => {
    it("Should be possible called only owner", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(controllerV3.connect(notOwner).setRewardMinter(ethers.constants.AddressZero)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(controllerV3.connect(owner).setRewardMinter(ethers.constants.AddressZero)).to.be.not.rejected;
    });
    it("Should be able set reward minter", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [owner, newMinter] = await ethers.getSigners();
      await controllerV3.connect(owner).setRewardMinter(newMinter.address);
      expect(await controllerV3.rewardMinter()).to.be.equal(newMinter.address);
    });
  });
  describe("setOnwardIncentives", () => {
    it("Should be possible called only owner", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      await controllerV3.setup();
      const token: string = await controllerV3.registeredTokens(0);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(
        controllerV3.connect(notOwner).setOnwardIncentives(token, ethers.constants.AddressZero)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(controllerV3.connect(owner).setOnwardIncentives(token, ethers.constants.AddressZero)).to.be.not
        .rejected;
    });
    it("Should be able set onward incentives", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      await controllerV3.setup();
      const token: string = await controllerV3.registeredTokens(0);
      const [owner, newController] = await ethers.getSigners();
      await controllerV3.connect(owner).setOnwardIncentives(token, newController.address);
      const poolInfo: PoolInfo = await controllerV3.poolInfo(token);
      expect(poolInfo.onwardIncentives).to.be.equal(newController.address);
    });
    it("Should be rejected if pool not registered", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      await expect(
        controllerV3.setOnwardIncentives(ethers.constants.AddressZero, ethers.constants.AddressZero)
      ).to.be.revertedWith("pool not registered");
    });
  });
  describe("setClaimReceiver", () => {
    it("Should be able set claim receiver", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user1, claimReceiver] = await ethers.getSigners();
      await controllerV3.connect(user1).setClaimReceiver(claimReceiver.address);
      expect(await controllerV3.claimReceiver(user1.address)).to.be.equal(claimReceiver.address);
    });
    it("Should be rejected if receiver address zero", async () => {
      const {controllerV3} = await loadFixture(incentivesControllerV3Fixture);
      const [, user] = await ethers.getSigners();
      await expect(
        controllerV3.connect(user).setClaimReceiver(ethers.constants.AddressZero)
      ).to.be.rejectedWith("receiver cannot be zero address");
    });
  });
  describe("Scenarios", () => {
    it("Should be the correct executed: handle action v2 -> migration -> claim v3 (behavior identical to v2)", async () => {
      const {controllerV2, controllerV3, rewardMinterV2, rewardMinterV3, rewardToken, rewardTokenHolder} =
        await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("1000"));
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await time.increase(86400 * 5);
      await controllerV3.setup();
      await time.increase(86400 * 5);
      const snapshot1: SnapshotRestorer = await takeSnapshot();
      await time.increase(86400 * 5);
      const poolInfo1 = await controllerV2.poolInfo(tokenAddress);
      const userInfo1 = await controllerV2.userInfo(tokenAddress, user1.address);
      const totalAllocPoint1 = await controllerV2.totalAllocPoint();
      const rewardsPerSecond1: BigNumber = await controllerV2.rewardsPerSecond();
      const userBaseClaimable1: BigNumber = await controllerV2.userBaseClaimable(user1.address);
      const blockTimestamp1: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const calcClaimableReward1 = calcClaimableReward(
        poolInfo1,
        userInfo1,
        rewardsPerSecond1,
        totalAllocPoint1,
        blockTimestamp1
      );
      await controllerV2.connect(user1).claim(user1.address, [tokenAddress]);
      const withdrawable = await rewardMinterV2.withdrawableBalance(user1.address);
      await snapshot1.restore();
      await time.increase(86400 * 5);
      const poolInfo2 = await controllerV3.poolInfo(tokenAddress);
      const userInfo2 = await controllerV2.userInfo(tokenAddress, user1.address);
      const totalAllocPoint2 = await controllerV3.totalAllocPoint();
      const rewardsPerSecond2: BigNumber = await controllerV3.rewardsPerSecond();
      const userBaseClaimable2: BigNumber = await controllerV2.userBaseClaimable(user1.address);
      const blockTimestamp2: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const calcClaimableReward2 = calcClaimableReward(
        poolInfo2,
        userInfo2,
        rewardsPerSecond2,
        totalAllocPoint2,
        blockTimestamp2
      );
      const balanceBefore: BigNumber = await rewardToken.balanceOf(user1.address);
      await controllerV3.connect(user1).claim(user1.address, [tokenAddress]);
      const balanceAfter: BigNumber = await rewardToken.balanceOf(user1.address);
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equals(
        calcClaimableReward1.add(userBaseClaimable1)
      );
      expect(balanceAfter.sub(balanceBefore)).to.be.equals(calcClaimableReward2.add(userBaseClaimable2));
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equals(balanceAfter.sub(balanceBefore));
    });
    it("Should be the correct executed: handle action v2 -> migration -> handleAction v3 -> claim v3 (behavior identical to v2)", async () => {
      const {controllerV2, controllerV3, rewardMinterV2, rewardMinterV3, rewardToken, rewardTokenHolder} =
        await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("1000"));
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      const balanceInWei2: BigNumber = ethers.utils.parseEther("2000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await time.increase(86400 * 5);
      await controllerV3.setup();
      await time.increase(86400 * 5);
      const snapshot1: SnapshotRestorer = await takeSnapshot();
      await time.increase(86400 * 5);
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const blockTimestamp1: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const poolInfo1 = await controllerV2.poolInfo(tokenAddress);
      const userInfo1 = await controllerV2.userInfo(tokenAddress, user1.address);
      const totalAllocPoint1 = await controllerV2.totalAllocPoint();
      const rewardsPerSecond1: BigNumber = await controllerV2.rewardsPerSecond();
      const userBaseClaimable1: BigNumber = await controllerV2.userBaseClaimable(user1.address);
      const calcClaimableReward1 = calcClaimableReward(
        poolInfo1,
        userInfo1,
        rewardsPerSecond1,
        totalAllocPoint1,
        blockTimestamp1
      );
      await controllerV2.connect(user1).claim(user1.address, [tokenAddress]);
      const withdrawable: WithdrawableBalance = await rewardMinterV2.withdrawableBalance(user1.address);
      await snapshot1.restore();
      await time.increase(86400 * 5);
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const blockTimestamp2: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const poolInfo2 = await controllerV3.poolInfo(tokenAddress);
      const userInfo2 = await controllerV3.userInfo(tokenAddress, user1.address);
      const totalAllocPoint2 = await controllerV3.totalAllocPoint();
      const rewardsPerSecond2: BigNumber = await controllerV3.rewardsPerSecond();
      const userBaseClaimable2: BigNumber = await controllerV3.userBaseClaimable(user1.address);
      const calcClaimableReward2 = calcClaimableReward(
        poolInfo2,
        userInfo2,
        rewardsPerSecond2,
        totalAllocPoint2,
        blockTimestamp2
      );
      const balanceBefore: BigNumber = await rewardToken.balanceOf(user1.address);
      await controllerV3.connect(user1).claim(user1.address, [tokenAddress]);
      const balanceAfter: BigNumber = await rewardToken.balanceOf(user1.address);
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equals(
        calcClaimableReward1.add(userBaseClaimable1)
      );
      expect(balanceAfter.sub(balanceBefore)).to.be.equals(calcClaimableReward2.add(userBaseClaimable2));
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equal(balanceAfter.sub(balanceBefore));
    });
    it("Should be the correct executed: migration -> handleAction v3 -> claim v3 (behavior identical to v2)", async () => {
      const {controllerV2, controllerV3, rewardMinterV2, rewardMinterV3, rewardToken, rewardTokenHolder} =
        await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("1000"));
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      await time.increase(86400 * 5);
      await controllerV3.setup();
      await time.increase(86400 * 5);
      const snapshot1: SnapshotRestorer = await takeSnapshot();
      await time.increase(86400 * 5);
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      const blockTimestamp1: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const poolInfo1 = await controllerV2.poolInfo(tokenAddress);
      const userInfo1 = await controllerV2.userInfo(tokenAddress, user1.address);
      const totalAllocPoint1 = await controllerV2.totalAllocPoint();
      const rewardsPerSecond1: BigNumber = await controllerV2.rewardsPerSecond();
      const userBaseClaimable1: BigNumber = await controllerV2.userBaseClaimable(user1.address);
      const calcClaimableReward1 = calcClaimableReward(
        poolInfo1,
        userInfo1,
        rewardsPerSecond1,
        totalAllocPoint1,
        blockTimestamp1
      );
      await controllerV2.connect(user1).claim(user1.address, [tokenAddress]);
      const withdrawable: WithdrawableBalance = await rewardMinterV2.withdrawableBalance(user1.address);
      await snapshot1.restore();
      await time.increase(86400 * 5);
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      const blockTimestamp2: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const poolInfo2 = await controllerV3.poolInfo(tokenAddress);
      const userInfo2 = await controllerV3.userInfo(tokenAddress, user1.address);
      const totalAllocPoint2 = await controllerV3.totalAllocPoint();
      const rewardsPerSecond2: BigNumber = await controllerV3.rewardsPerSecond();
      const userBaseClaimable2: BigNumber = await controllerV3.userBaseClaimable(user1.address);
      const calcClaimableReward2 = calcClaimableReward(
        poolInfo2,
        userInfo2,
        rewardsPerSecond2,
        totalAllocPoint2,
        blockTimestamp2
      );
      const balanceBefore: BigNumber = await rewardToken.balanceOf(user1.address);
      await controllerV3.connect(user1).claim(user1.address, [tokenAddress]);
      const balanceAfter: BigNumber = await rewardToken.balanceOf(user1.address);
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equals(
        calcClaimableReward1.add(userBaseClaimable1)
      );
      expect(balanceAfter.sub(balanceBefore)).to.be.equals(calcClaimableReward2.add(userBaseClaimable2));
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equal(balanceAfter.sub(balanceBefore));
    });
    it("Should be the correct executed: user1 handle action v2 -> migration -> account2 handle action -> user1 claim (behavior identical to v2)", async () => {
      const {controllerV2, controllerV3, rewardMinterV2, rewardMinterV3, rewardToken, rewardTokenHolder} =
        await loadFixture(incentivesControllerV3Fixture);
      const [, user1, user2] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("1000"));
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      const balanceInWei2: BigNumber = ethers.utils.parseEther("2000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await time.increase(86400 * 5);
      await controllerV3.setup();
      await time.increase(86400 * 5);
      const snapshot1: SnapshotRestorer = await takeSnapshot();
      await time.increase(86400 * 5);
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user2.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const blockTimestamp1: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const poolInfo1 = await controllerV2.poolInfo(tokenAddress);
      const userInfo1 = await controllerV2.userInfo(tokenAddress, user1.address);
      const totalAllocPoint1 = await controllerV2.totalAllocPoint();
      const rewardsPerSecond1: BigNumber = await controllerV2.rewardsPerSecond();
      const userBaseClaimable1: BigNumber = await controllerV2.userBaseClaimable(user1.address);
      const calcClaimableReward1 = calcClaimableReward(
        poolInfo1,
        userInfo1,
        rewardsPerSecond1,
        totalAllocPoint1,
        blockTimestamp1
      );
      await controllerV2.connect(user1).claim(user1.address, [tokenAddress]);
      const withdrawable: WithdrawableBalance = await rewardMinterV2.withdrawableBalance(user1.address);
      await snapshot1.restore();
      await time.increase(86400 * 5);
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user2.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const blockTimestamp2: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const poolInfo2 = await controllerV3.poolInfo(tokenAddress);
      const userInfo2 = await controllerV2.userInfo(tokenAddress, user1.address);
      const totalAllocPoint2 = await controllerV3.totalAllocPoint();
      const rewardsPerSecond2: BigNumber = await controllerV3.rewardsPerSecond();
      const userBaseClaimable2: BigNumber = await controllerV2.userBaseClaimable(user1.address);
      const calcClaimableReward2 = calcClaimableReward(
        poolInfo2,
        userInfo2,
        rewardsPerSecond2,
        totalAllocPoint2,
        blockTimestamp2
      );
      const balanceBefore: BigNumber = await rewardToken.balanceOf(user1.address);
      await controllerV3.connect(user1).claim(user1.address, [tokenAddress]);
      const balanceAfter: BigNumber = await rewardToken.balanceOf(user1.address);
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equals(
        calcClaimableReward1.add(userBaseClaimable1)
      );
      expect(balanceAfter.sub(balanceBefore)).to.be.equals(calcClaimableReward2.add(userBaseClaimable2));
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equal(balanceAfter.sub(balanceBefore));
    });
    it("Should be the correct executed: user1 handle action v2 -> migration -> account2 handle action -> user1 claim. Equals claimable reward (behavior identical to v2", async () => {
      const {controllerV2, controllerV3, rewardMinterV2, rewardMinterV3, rewardToken, rewardTokenHolder} =
        await loadFixture(incentivesControllerV3Fixture);
      const [, user1, user2] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("1000"));
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      const balanceInWei2: BigNumber = ethers.utils.parseEther("2000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await time.increase(86400 * 5);
      await controllerV3.setup();
      await time.increase(86400 * 5);
      const snapshot1: SnapshotRestorer = await takeSnapshot();
      await time.increase(86400 * 5);
      const readyToVest1_1: BigNumber[] = await controllerV2.claimableReward(user1.address, [token.address]);
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user2.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const blockTimestamp1: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const readyToVest1_2: BigNumber[] = await controllerV2.claimableReward(user1.address, [token.address]);
      const poolInfo1 = await controllerV2.poolInfo(tokenAddress);
      const userInfo1 = await controllerV2.userInfo(tokenAddress, user1.address);
      const totalAllocPoint1 = await controllerV2.totalAllocPoint();
      const rewardsPerSecond1: BigNumber = await controllerV2.rewardsPerSecond();
      const userBaseClaimable1: BigNumber = await controllerV2.userBaseClaimable(user1.address);
      const calcClaimableReward1 = calcClaimableReward(
        poolInfo1,
        userInfo1,
        rewardsPerSecond1,
        totalAllocPoint1,
        blockTimestamp1
      );
      await controllerV2.connect(user1).claim(user1.address, [tokenAddress]);
      const withdrawable: WithdrawableBalance = await rewardMinterV2.withdrawableBalance(user1.address);
      await snapshot1.restore();
      await time.increase(86400 * 5);
      const readyToVest2_1: BigNumber[] = await controllerV3.claimableReward(user1.address, [token.address]);
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user2.address, balanceInWei2, balanceInWei2.add(totalSupply));
      const blockTimestamp2: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const readyToVest2_2: BigNumber[] = await controllerV3.claimableReward(user1.address, [token.address]);
      const poolInfo2 = await controllerV3.poolInfo(tokenAddress);
      const userInfo2 = await controllerV2.userInfo(tokenAddress, user1.address);
      const totalAllocPoint2 = await controllerV3.totalAllocPoint();
      const rewardsPerSecond2: BigNumber = await controllerV3.rewardsPerSecond();
      const userBaseClaimable2: BigNumber = await controllerV2.userBaseClaimable(user1.address);
      const calcClaimableReward2 = calcClaimableReward(
        poolInfo2,
        userInfo2,
        rewardsPerSecond2,
        totalAllocPoint2,
        blockTimestamp2
      );
      const balanceBefore: BigNumber = await rewardToken.balanceOf(user1.address);
      await controllerV3.connect(user1).claim(user1.address, [tokenAddress]);
      const balanceAfter: BigNumber = await rewardToken.balanceOf(user1.address);
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equals(
        calcClaimableReward1.add(userBaseClaimable1)
      );
      expect(balanceAfter.sub(balanceBefore)).to.be.equals(calcClaimableReward2.add(userBaseClaimable2));
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equal(balanceAfter.sub(balanceBefore));
      expect(readyToVest1_1[0]).to.be.equal(readyToVest2_1[0]);
      expect(readyToVest1_2[0]).to.be.equal(readyToVest2_2[0]);
    });
    it("Should be the correct executed: user1 handle action v1 -> migration -> account2 deposit -> account 1 withdraw -> account 1 claim", async () => {
      const {controllerV2, controllerV3, rewardMinterV2, rewardMinterV3, rewardToken, rewardTokenHolder} =
        await loadFixture(incentivesControllerV3Fixture);
      const [, user1, user2] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("1000"));
      const tokenAddress: string = await controllerV2.registeredTokens(0);
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(tokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const totalSupply: BigNumber = await token.totalSupply();
      const balanceInWei1: BigNumber = ethers.utils.parseEther("1000");
      const balanceInWei2: BigNumber = ethers.utils.parseEther("2000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, balanceInWei1, balanceInWei1.add(totalSupply));
      await time.increase(86400 * 5);
      await controllerV3.setup();
      await time.increase(86400 * 5);
      const snapshot1: SnapshotRestorer = await takeSnapshot();
      await time.increase(86400 * 5);
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user2.address, balanceInWei2, balanceInWei2.add(totalSupply));
      await time.increase(86400 * 5);
      await controllerV2.connect(tokenSigner).handleAction(user1.address, 0, totalSupply);
      const blockTimestamp1: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const poolInfo1 = await controllerV2.poolInfo(tokenAddress);
      const userInfo1 = await controllerV2.userInfo(tokenAddress, user1.address);
      const totalAllocPoint1 = await controllerV2.totalAllocPoint();
      const rewardsPerSecond1: BigNumber = await controllerV2.rewardsPerSecond();
      const userBaseClaimable1: BigNumber = await controllerV2.userBaseClaimable(user1.address);
      const calcClaimableReward1 = calcClaimableReward(
        poolInfo1,
        userInfo1,
        rewardsPerSecond1,
        totalAllocPoint1,
        blockTimestamp1
      );
      await controllerV2.connect(user1).claim(user1.address, [tokenAddress]);
      const withdrawable: WithdrawableBalance = await rewardMinterV2.withdrawableBalance(user1.address);
      await snapshot1.restore();
      await time.increase(86400 * 5);
      await controllerV3
        .connect(tokenSigner)
        .handleAction(user2.address, balanceInWei2, balanceInWei2.add(totalSupply));
      await time.increase(86400 * 5);
      await controllerV3.connect(tokenSigner).handleAction(user1.address, 0, totalSupply);
      const blockTimestamp2: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const poolInfo2 = await controllerV3.poolInfo(tokenAddress);
      const userInfo2 = await controllerV3.userInfo(tokenAddress, user1.address);
      const totalAllocPoint2 = await controllerV3.totalAllocPoint();
      const rewardsPerSecond2: BigNumber = await controllerV3.rewardsPerSecond();
      const userBaseClaimable2: BigNumber = await controllerV3.userBaseClaimable(user1.address);
      const calcClaimableReward2 = calcClaimableReward(
        poolInfo2,
        userInfo2,
        rewardsPerSecond2,
        totalAllocPoint2,
        blockTimestamp2
      );
      const balanceBefore: BigNumber = await rewardToken.balanceOf(user1.address);
      await controllerV3.connect(user1).claim(user1.address, [tokenAddress]);
      const balanceAfter: BigNumber = await rewardToken.balanceOf(user1.address);
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equals(
        calcClaimableReward1.add(userBaseClaimable1)
      );
      expect(balanceAfter.sub(balanceBefore)).to.be.equals(calcClaimableReward2.add(userBaseClaimable2));
      expect(withdrawable.amount.add(withdrawable.penaltyAmount)).to.be.equal(balanceAfter.sub(balanceBefore));
    });
    it("deposit -> wait 10days -> claimableReward([uToken]) -> migration -> borrow (handleAction) -> wait 10 days -> claimableReward([uToken, debtToken]) -> claim -> wait 10 days -> claimableReward([uToken, debtToken]) (precision claimableReward 99.99%)", async () => {
      const {controllerV2, controllerV3, rewardMinterV2, rewardMinterV3, rewardToken, rewardTokenHolder} =
        await loadFixture(incentivesControllerV3Fixture);
      const [, user1] = await ethers.getSigners();
      await rewardToken.connect(rewardTokenHolder).transfer(rewardMinterV3.address, ethers.utils.parseEther("1000"));
      const uTokenAddress: string = await controllerV2.registeredTokens(0);
      const debtTokenAddress: string = await controllerV2.registeredTokens(1);
      const uToken = await ethers.getContractAt("IERC20", uTokenAddress);
      const debtToken = await ethers.getContractAt("IERC20", debtTokenAddress);
      const tokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(uTokenAddress);
      const debtTokenSigner: SignerWithAddress = await ethers.getImpersonatedSigner(debtTokenAddress);
      await ethers.provider.send("hardhat_setBalance", [
        tokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      await ethers.provider.send("hardhat_setBalance", [
        debtTokenSigner.address,
        ethers.utils.parseEther("1000").toHexString(),
      ]);
      const uTotalSupply: BigNumber = await uToken.totalSupply();
      const debtTotalSupply: BigNumber = await debtToken.totalSupply();
      const uBalanceInWei: BigNumber = ethers.utils.parseEther("1000");
      const debtBalanceInWei: BigNumber = ethers.utils.parseEther("1000");
      await controllerV2
        .connect(tokenSigner)
        .handleAction(user1.address, uBalanceInWei, uBalanceInWei.add(uTotalSupply));
      await time.increase(86400 * 5);
      await controllerV3.setup();
      await controllerV3
        .connect(debtTokenSigner)
        .handleAction(user1.address, debtBalanceInWei, debtBalanceInWei.add(debtTotalSupply));
      const blockTimestamp: BigNumber = BigNumber.from((await time.increase(86400 * 5)) + 1);
      const uPoolInfo = await controllerV3.poolInfo(uToken.address);
      const uUserInfo = await controllerV2.userInfo(uToken.address, user1.address);
      const debtPoolInfo = await controllerV3.poolInfo(debtToken.address);
      const debtUserInfo = await controllerV3.userInfo(debtToken.address, user1.address);
      const totalAllocPoint = await controllerV3.totalAllocPoint();
      const rewardsPerSecond: BigNumber = await controllerV3.rewardsPerSecond();
      const uCalcClaimableReward1 = calcClaimableReward(
        uPoolInfo,
        uUserInfo,
        rewardsPerSecond,
        totalAllocPoint,
        blockTimestamp
      );
      const debtCalcClaimableReward1 = calcClaimableReward(
        debtPoolInfo,
        debtUserInfo,
        rewardsPerSecond,
        totalAllocPoint,
        blockTimestamp
      );
      const readyToVest: BigNumber[] = await controllerV3
        .connect(user1)
        .claimableReward(user1.address, [uToken.address, debtToken.address]);
      const readyToVestSum: BigNumber = readyToVest.reduce((a: BigNumber, b: BigNumber) => a.add(b));
      await controllerV3.connect(user1).claim(user1.address, [uToken.address, debtToken.address]);
      const rewardBalance: BigNumber = await rewardToken.balanceOf(user1.address);
      expect(readyToVestSum.mul(10000).div(rewardBalance)).to.be.equal(9999); // precision 99.99%
      expect(rewardBalance).to.be.equal(uCalcClaimableReward1.add(debtCalcClaimableReward1));
    });
  });
});
