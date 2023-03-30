import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

import { BigNumber } from "ethers";
import { MultiFeeDistributionV3 } from "../typechain-types";
import { ReplaceTreasuryFixture } from "./fixtures/ReplaceTreasuryFixture";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";

type WithdrawableBalanceOutput = {
  amount: BigNumber;
  penaltyAmount: BigNumber;
  amountWithoutPenalty: BigNumber;
}

type RewardDataOutput = {
  periodFinish: BigNumber;
  rewardRate: BigNumber;
  lastUpdateTime: BigNumber;
  rewardPerTokenStored: BigNumber;
  balance: BigNumber;
}

describe("MultiFeeDistributionV3", () => {
  describe("Deployment", () => {
    it("Should be deployed with correct parameters", async () => {
      const { treasury, nft, tokens } = await loadFixture(ReplaceTreasuryFixture);
      const nftAddress: string = await treasury.nft();
      const poolId: BigNumber = await treasury.poolId();
      const tickRange: [number, number] = await Promise.all([treasury.tickRange(0), treasury.tickRange(1)]);
      const rewardToken: string = await treasury.rewardToken();
      const rewardTokenVault: string = await treasury.rewardTokenVault();
      expect(treasury.address).to.be.properAddress;
      expect(nftAddress).to.be.equal(nft.address);
      expect(poolId).to.be.equal(51);
      expect(tickRange).to.be.deep.equal([-65040, -40140]);
      expect(rewardToken).to.be.equal(tokens.contracts.uwu.address);
      expect(rewardTokenVault).to.be.equal('0x5776F9bf6568f252cE5Fa85F8fEe3c0d8dE914D8');
    });
  });
  describe("Lock", () => {
    it("Should be able lock nft", async () => {
      const { treasury, nft, nftIds, nftOwners } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await nft.connect(nftOwners[2]).approve(treasury.address, nftIds[2]);
      await expect(treasury.connect(nftOwners[0]).lock([nftIds[0]])).to.be.not.rejected;
      await expect(treasury.connect(nftOwners[2]).lock([nftIds[2]])).to.be.not.rejected;
    });
    it("Should be locked for 56 days", async () => {});
  });
  describe("WithdrawExpiredLocks", () => {
    it("Should be able withdraw expired locks", async () => {
      const { treasury, nft, nftIds, nftOwners } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      await time.increase(60 * 60 * 24 * 10); // 10 days
      await treasury.connect(nftOwners[0]).withdrawExpiredLocks();
      expect(await nft.ownerOf(nftIds[0])).to.be.equal(treasury.address);
      await time.increase(60 * 60 * 24 * 46); // 46 days
      await treasury.connect(nftOwners[0]).withdrawExpiredLocks();
      expect(await nft.ownerOf(nftIds[0])).to.be.equal(nftOwners[0].address);
    });
  });
  describe("accountLiquidity", () => {
    it("Should be able to get liquidity", async () => {
      const { treasury, nft, nftIds, nftOwners } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const liquidity0: { total: BigNumber; locked: BigNumber; unlockable: BigNumber; } = await treasury.accountLiquidity(nftOwners[0].address);
      expect(liquidity0.total).to.be.equal('84710803113366835301');
      expect(liquidity0.locked).to.be.equal('84710803113366835301');
      expect(liquidity0.unlockable).to.be.equal(0);
      await time.increase(60 * 60 * 24 * 56); // 56 days
      const liquidity1: { total: BigNumber; locked: BigNumber; unlockable: BigNumber; } = await treasury.accountLiquidity(nftOwners[0].address);
      expect(liquidity1.total).to.be.equal('84710803113366835301');
      expect(liquidity1.locked).to.be.equal(0);
      expect(liquidity1.unlockable).to.be.equal('84710803113366835301');
    });
  });
  describe("accountAllNFTs", () => {
    it("Should be able to get all nfts", async () => {
      const { treasury, nft, nftIds, nftOwners } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      const nextMineTime: number = await time.latest() + 1;
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const nfts0: MultiFeeDistributionV3.LockedNFTStructOutput[] = await treasury.accountAllNFTs(nftOwners[0].address);
      expect(nfts0.length).to.be.equal(1);
      expect(nfts0[0].id).to.be.equal(nftIds[0]);
      expect(nfts0[0].liquidity).to.be.equal('84710803113366835301');
      expect(nfts0[0].unlockTime).to.be.equal(nextMineTime + 60 * 60 * 24 * 56); // now + 56 days
    });
  });
  describe("accountLockedNFTs", () => {
    it("Should be able to get locked nfts", async () => {
      const { treasury, nft, nftIds, nftOwners } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      const nextMineTime: number = await time.latest() + 1;
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const nfts0: MultiFeeDistributionV3.LockedNFTStructOutput[] = await treasury.accountLockedNFTs(nftOwners[0].address);
      expect(nfts0.length).to.be.equal(1);
      expect(nfts0[0].id).to.be.equal(nftIds[0]);
      expect(nfts0[0].liquidity).to.be.equal('84710803113366835301');
      expect(nfts0[0].unlockTime).to.be.equal(nextMineTime + 60 * 60 * 24 * 56); // now + 56 days
      await time.increase(60 * 60 * 24 * 56); // 56 days
      const nfts1: MultiFeeDistributionV3.LockedNFTStructOutput[] = await treasury.accountLockedNFTs(nftOwners[0].address);
      expect(nfts1.length).to.be.equal(0);
    });
  });
  describe("accountUnlockableNFTs", () => {
    it("Should be able to get unlockable nfts", async () => {
      const { treasury, nft, nftIds, nftOwners } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      const nextMineTime: number = await time.latest() + 1;
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const nfts0: MultiFeeDistributionV3.LockedNFTStructOutput[] = await treasury.accountUnlockableNFTs(nftOwners[0].address);
      expect(nfts0.length).to.be.equal(0);
      await time.increase(60 * 60 * 24 * 56); // 56 days
      const nfts1: MultiFeeDistributionV3.LockedNFTStructOutput[] = await treasury.accountUnlockableNFTs(nftOwners[0].address);
      expect(nfts1.length).to.be.equal(1);
      expect(nfts1[0].id).to.be.equal(nftIds[0]);
      expect(nfts1[0].liquidity).to.be.equal('84710803113366835301');
      expect(nfts1[0].unlockTime).to.be.equal(nextMineTime + 60 * 60 * 24 * 56); // now + 56 days
    });
  });
  describe("getLiquidity", () => {
    it("Should be able to get liquidity", async () => {
      const { treasury, nft, nftIds, nftOwners } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const liquidity0: BigNumber = await treasury.getLiquidity(nft.address, nftIds[0]);
      const liquidity1: BigNumber = await treasury.getLiquidity(nft.address, nftIds[1]);
      const liquidity2: BigNumber = await treasury.getLiquidity(nft.address, nftIds[2]);
      expect(liquidity0).to.be.equal('84710803113366835301');
      expect(liquidity1).to.be.equal('584328024880157215');
      expect(liquidity2).to.be.equal('1646696424726920380');
    });
  });
  describe("mint", () => {
    it("Should be able to mint to self", async () => {
      const { treasury, nft, nftIds, nftOwners, tokens } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const minter: string = await treasury.incentivesController();
      const minterSigner: SignerWithAddress = await ethers.getImpersonatedSigner(minter);
      await ethers.provider.send("hardhat_setBalance", [minterSigner.address, BigNumber.from('1000000000000000000000').toHexString()]);
      const amountInWei = ethers.utils.parseEther('1000');
      const balance0: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      await treasury.connect(minterSigner).mint(treasury.address, amountInWei);
      const balance1: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      expect(balance1.sub(balance0)).to.be.equal(amountInWei);
      const earnedBalances: { total: BigNumber; } = await treasury.earnedBalances(treasury.address);
      expect(earnedBalances.total).to.be.equal(0);
    });
    it("Should be able to mint to address", async () => {
      const { treasury, nft, nftIds, nftOwners, tokens, minterSigner } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const amountInWei = ethers.utils.parseEther('1000');
      const balance0: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      await treasury.connect(minterSigner).mint(nftOwners[0].address, amountInWei);
      const balance1: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      expect(balance1.sub(balance0)).to.be.equal(amountInWei);
      const earnedBalances: { total: BigNumber; } = await treasury.earnedBalances(nftOwners[0].address);
      expect(earnedBalances.total).to.be.equal(amountInWei);
    });
  });
  describe("earnedBalances", () => {
    it("Should be able to get earned balances", async () => {
      const { treasury, nft, nftIds, nftOwners, minterSigner } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const earnedBalances0: { total: BigNumber; } = await treasury.earnedBalances(nftOwners[0].address);
      const amountInWei = ethers.utils.parseEther('1000');
      await treasury.connect(minterSigner).mint(nftOwners[0].address, amountInWei);
      expect(earnedBalances0.total).to.be.equal(0);
      const earnedBalances1: { total: BigNumber; } = await treasury.earnedBalances(nftOwners[0].address);
      expect(earnedBalances1.total).to.be.equal(amountInWei);
    });
  });
  describe("withdrawableBalance", () => {
    it("Should be able to get withdrawable balance", async () => {
      const { treasury, nft, nftIds, nftOwners, minterSigner } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const amountInWei0 = ethers.utils.parseEther('1000');
      const amountInWei1 = ethers.utils.parseEther('2000');
      await treasury.connect(minterSigner).mint(nftOwners[0].address, amountInWei0);
      await time.increase(86400 * 10);
      await treasury.connect(minterSigner).mint(nftOwners[0].address, amountInWei1);
      const balances0: WithdrawableBalanceOutput = await treasury.withdrawableBalance(nftOwners[0].address);
      await time.increase(86400 * 20);
      const balances1: WithdrawableBalanceOutput = await treasury.withdrawableBalance(nftOwners[0].address);
      await time.increase(86400 * 30);
      const balances2: WithdrawableBalanceOutput = await treasury.withdrawableBalance(nftOwners[0].address);
      expect(balances0.amount).to.be.equal(amountInWei0.add(amountInWei1).div(2));
      expect(balances0.penaltyAmount).to.be.equal(amountInWei0.add(amountInWei1).div(2));
      expect(balances0.amountWithoutPenalty).to.be.equal(0);
      expect(balances1.amount).to.be.equal(amountInWei0.add(amountInWei1.div(2)));
      expect(balances1.penaltyAmount).to.be.equal(amountInWei1.div(2));
      expect(balances1.amountWithoutPenalty).to.be.equal(amountInWei1.div(2));
      expect(balances2.amount).to.be.equal(amountInWei0.add(amountInWei1));
      expect(balances2.penaltyAmount).to.be.equal(0);
      expect(balances2.amountWithoutPenalty).to.be.equal(amountInWei0.add(amountInWei1));
    });
  });
  describe("claimableRewards", () => {
    // it("Should be able to get claimable rewards", async () => {
    //   const { treasury, nft, nftIds, nftOwners, minterSigner } = await loadFixture(ReplaceTreasuryFixture);
    //   await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
    //   await nft.connect(nftOwners[2]).approve(treasury.address, nftIds[2]);
    //   await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
    //   await treasury.connect(nftOwners[2]).lock([nftIds[2]]);
    //   const amountInWei0 = ethers.utils.parseEther('1000');
    //   const amountInWei1 = ethers.utils.parseEther('2000');
    //   await treasury.connect(minterSigner).mint(treasury.address, amountInWei0);
    //   await treasury.connect(minterSigner).mint(treasury.address, amountInWei1);
    //   await time.increase(86400 * 10);
    //   await treasury.connect(minterSigner).mint(nftOwners[0].address, amountInWei1);
    //   const balances0: WithdrawableBalanceOutput = await treasury.withdrawableBalance(nftOwners[0].address);
    //   await time.increase(86400 * 20);
    //   const balances1: WithdrawableBalanceOutput = await treasury.withdrawableBalance(nftOwners[0].address);
    //   await time.increase(86400 * 30);
    //   const balances2: WithdrawableBalanceOutput = await treasury.withdrawableBalance(nftOwners[0].address);
    //   expect(balances0.amount).to.be.equal(amountInWei0.add(amountInWei1).div(2));
    //   expect(balances0.penaltyAmount).to.be.equal(amountInWei0.add(amountInWei1).div(2));
    //   expect(balances0.amountWithoutPenalty).to.be.equal(0);
    //   expect(balances1.amount).to.be.equal(amountInWei0.add(amountInWei1.div(2)));
    //   expect(balances1.penaltyAmount).to.be.equal(amountInWei1.div(2));
    //   expect(balances1.amountWithoutPenalty).to.be.equal(amountInWei1.div(2));
    //   expect(balances2.amount).to.be.equal(amountInWei0.add(amountInWei1));
    //   expect(balances2.penaltyAmount).to.be.equal(0);
    //   expect(balances2.amountWithoutPenalty).to.be.equal(amountInWei0.add(amountInWei1));
    // });
  });
  describe("exit", () => {
    it("Should be able to exit early", async () => {
      const { treasury, nft, nftIds, nftOwners, minterSigner, tokens } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const amountInWei0 = ethers.utils.parseEther('1000');
      const ownerBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      await treasury.connect(minterSigner).mint(nftOwners[0].address, amountInWei0);
      await time.increase(86400 * 10);
      const treasuryBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      await treasury.connect(nftOwners[0]).exit(nftOwners[0].address);
      const treasuryBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      const ownerBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      expect(treasuryBalances0).to.be.equal(amountInWei0);
      expect(treasuryBalances1).to.be.equal(amountInWei0.div(2));
      expect(ownerBalances1).to.be.equal(amountInWei0.div(2).add(ownerBalances0));
    });
  });
  describe("withdraw", () => {
    it('Should be nothing if not enough time has passed', async () => {
      const { treasury, nft, nftIds, nftOwners, minterSigner, tokens } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const amountInWei0 = ethers.utils.parseEther('1000');
      const ownerBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      await treasury.connect(minterSigner).mint(nftOwners[0].address, amountInWei0);
      await time.increase(86400 * 10);
      await treasury.connect(nftOwners[0]).withdraw();
      const ownerBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      expect(ownerBalances1).to.be.equal(ownerBalances0);
    });
    it("Should be able to withdraw", async () => {
      const { treasury, nft, nftIds, nftOwners, minterSigner, tokens } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const amountInWei0 = ethers.utils.parseEther('1000');
      const ownerBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      await treasury.connect(minterSigner).mint(nftOwners[0].address, amountInWei0);
      await time.increase(86400 * 56);
      await treasury.connect(nftOwners[0]).withdraw();
      const ownerBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      expect(ownerBalances1).to.be.equal(amountInWei0.add(ownerBalances0));
    });
  });
  describe("GetReward", () => {
    it("Should be able to get reward (uwu,uToken)", async () => {
      const { treasury, nft, nftIds, nftOwners, minterSigner, tokens } = await loadFixture(ReplaceTreasuryFixture);
      await treasury.addReward(tokens.contracts.dai.address);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const uwuAmountInWei = ethers.utils.parseEther('1000');
      const daiAmountInWei = ethers.utils.parseEther('2000');
      const uwuBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      const daiBalances0: BigNumber = await tokens.contracts.dai.balanceOf(nftOwners[0].address);
      await treasury.connect(minterSigner).mint(treasury.address, uwuAmountInWei);
      await tokens.contracts.dai.connect(tokens.holders.dai).transferFrom(tokens.holders.dai.address, treasury.address, daiAmountInWei);
      await treasury.getReward([tokens.contracts.uwu.address, tokens.contracts.dai.address]);
      await time.increase(86400 * 7);
      await treasury.connect(nftOwners[0]).getReward([tokens.contracts.uwu.address, tokens.contracts.dai.address]);
      const uwuBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      const daiBalances1: BigNumber = await tokens.contracts.dai.balanceOf(nftOwners[0].address);
      expect(uwuBalances1.sub(uwuBalances0.add(uwuAmountInWei))).to.be.lessThanOrEqual(1);
      expect(daiBalances1.sub(daiBalances0.add(daiAmountInWei))).to.be.lessThanOrEqual(1);
    });
    it("Should be able distribute and get reward between lockers (uwu,uToken)", async () => {
      const { treasury, nft, nftIds, nftOwners, minterSigner, tokens } = await loadFixture(ReplaceTreasuryFixture);
      await treasury.addReward(tokens.contracts.dai.address);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await nft.connect(nftOwners[2]).approve(treasury.address, nftIds[2]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      await treasury.connect(nftOwners[2]).lock([nftIds[2]]);
      const liquidity0: BigNumber = await treasury.getLiquidity(nft.address, nftIds[0]);
      const liquidity2: BigNumber = await treasury.getLiquidity(nft.address, nftIds[2]);
      const liquiditySupply: BigNumber = await treasury.liquiditySupply();
      const uwuAmountInWei = ethers.utils.parseEther('1000');
      const daiAmountInWei = ethers.utils.parseEther('2000');
      const owner0UwuBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      const owner0DaiBalances0: BigNumber = await tokens.contracts.dai.balanceOf(nftOwners[0].address);
      const owner2UwuBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[2].address);
      const owner2DaiBalances0: BigNumber = await tokens.contracts.dai.balanceOf(nftOwners[2].address);
      await treasury.connect(minterSigner).mint(treasury.address, uwuAmountInWei);
      await tokens.contracts.dai.connect(tokens.holders.dai).transferFrom(tokens.holders.dai.address, treasury.address, daiAmountInWei);
      await treasury.getReward([tokens.contracts.uwu.address, tokens.contracts.dai.address]);
      await time.increase(86400 * 7);
      await treasury.connect(nftOwners[0]).getReward([tokens.contracts.uwu.address, tokens.contracts.dai.address]);
      await treasury.connect(nftOwners[2]).getReward([tokens.contracts.uwu.address, tokens.contracts.dai.address]);
      const owner0UwuBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      const owner0DaiBalances1: BigNumber = await tokens.contracts.dai.balanceOf(nftOwners[0].address);
      const owner2UwuBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[2].address);
      const owner2DaiBalances1: BigNumber = await tokens.contracts.dai.balanceOf(nftOwners[2].address);
      const needUwu0 = liquidity0.mul(uwuAmountInWei).div(liquiditySupply);
      const needDai0 = liquidity0.mul(daiAmountInWei).div(liquiditySupply);
      const needUwu2 = liquidity2.mul(uwuAmountInWei).div(liquiditySupply);
      const needDai2 = liquidity2.mul(daiAmountInWei).div(liquiditySupply);
      expect(owner0UwuBalances1.sub(owner0UwuBalances0)).to.be.equal(needUwu0);
      expect(owner0DaiBalances1.sub(owner0DaiBalances0)).to.be.equal(needDai0);
      expect(owner2UwuBalances1.sub(owner2UwuBalances0)).to.be.equal(needUwu2);
      expect(owner2DaiBalances1.sub(owner2DaiBalances0)).to.be.equal(needDai2);
    });
  });
  describe("addReward", () => {
    it("Should be able to add reward", async () => {
      const { treasury, tokens } = await loadFixture(ReplaceTreasuryFixture);
      await treasury.addReward(tokens.contracts.dai.address);
      await expect(treasury.getReward([tokens.contracts.dai.address])).to.be.not.rejected;
    });
  });
  describe("delegateExit", () => {
    it("Should be able to delegate exit", async () => {
      const { treasury, nft, nftIds, nftOwners, minterSigner, tokens } = await loadFixture(ReplaceTreasuryFixture);
      const [, delegatedSigner] = await ethers.getSigners();
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      const amountInWei0 = ethers.utils.parseEther('1000');
      const treasuryBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      const ownerBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      await treasury.connect(minterSigner).mint(nftOwners[0].address, amountInWei0);
      const treasuryBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      await time.increase(86400 * 28);
      await treasury.connect(nftOwners[0]).delegateExit(delegatedSigner.address);
      await treasury.connect(delegatedSigner).exit(nftOwners[0].address);
      const treasuryBalances2: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      const ownerBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(nftOwners[0].address);
      expect(treasuryBalances0).to.be.equal(0);
      expect(treasuryBalances1).to.be.equal(amountInWei0);
      expect(treasuryBalances2).to.be.equal(0);
      expect(ownerBalances1).to.be.equals(amountInWei0.add(ownerBalances0));
    });
  });
  describe("lastTimeRewardApplicable", () => {
    it("Should be able to get last time reward applicable", async () => {
      const { treasury, tokens, minterSigner } = await loadFixture(ReplaceTreasuryFixture);
      await time.increase(1);
      const rewardData0: RewardDataOutput = await treasury.rewardData(tokens.contracts.uwu.address);
      const lastTimeRewardApplicable0: BigNumber = await treasury.lastTimeRewardApplicable(tokens.contracts.uwu.address);
      const amountInWei0 = ethers.utils.parseEther('1000');
      const latestTime: number = await time.latest() + 1;
      await treasury.connect(minterSigner).mint(treasury.address, amountInWei0);
      const lastTimeRewardApplicable1: BigNumber = await treasury.lastTimeRewardApplicable(tokens.contracts.uwu.address);
      await time.increase(86400 * 7);
      const lastTimeRewardApplicable2: BigNumber = await treasury.lastTimeRewardApplicable(tokens.contracts.uwu.address);
      await time.increase(86400 * 7);
      const lastTimeRewardApplicable3: BigNumber = await treasury.lastTimeRewardApplicable(tokens.contracts.uwu.address);
      expect(lastTimeRewardApplicable0).to.be.equal(rewardData0.periodFinish);
      expect(lastTimeRewardApplicable1).to.be.equal(latestTime); //  + 86400 * 7
      expect(lastTimeRewardApplicable2).to.be.equal(latestTime + 86400 * 7);
      expect(lastTimeRewardApplicable3).to.be.equal(latestTime + 86400 * 7);
    });
  });
  describe("publicExit", () => {
    it('Should be possible call the method only the owner', async () => {
      const { treasury } = await loadFixture(ReplaceTreasuryFixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).publicExit()).to.be.rejected;
      await expect(treasury.connect(owner).publicExit()).to.be.not.rejected;
    });
    it("Should be able set public exit flag", async () => {
      const { treasury, nft, nftIds, nftOwners, minterSigner, tokens } = await loadFixture(ReplaceTreasuryFixture);
      const publicExitAreSet0: boolean = await treasury.publicExitAreSet();
      await treasury.publicExit();
      const publicExitAreSet1: boolean = await treasury.publicExitAreSet();
      expect(publicExitAreSet0).to.be.equal(false);
      expect(publicExitAreSet1).to.be.equal(true);
    });
  });
  describe("setTeamRewardVault", () => {
    it('Should be possible call the method only the owner', async () => {
      const { treasury } = await loadFixture(ReplaceTreasuryFixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).setTeamRewardVault(owner.address)).to.be.rejected;
      await expect(treasury.connect(owner).setTeamRewardVault(owner.address)).to.be.not.rejected;
    });
    it("Should be able set team reward vault", async () => {
      const { treasury } = await loadFixture(ReplaceTreasuryFixture);
      const [owner, otherSigner] = await ethers.getSigners();
      const teamRewardVault0: string = await treasury.teamRewardVault();
      await treasury.setTeamRewardVault(otherSigner.address);
      const teamRewardVault1: string = await treasury.teamRewardVault();
      expect(teamRewardVault1).to.not.be.equal(teamRewardVault0);
      expect(teamRewardVault1).to.be.equal(otherSigner.address);
    });
  });
  describe("setTeamRewardFee", () => {
    it('Should be possible call the method only the owner', async () => {
      const { treasury } = await loadFixture(ReplaceTreasuryFixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).setTeamRewardFee(1)).to.be.rejected;
      await expect(treasury.connect(owner).setTeamRewardFee(1)).to.be.not.rejected;
    });
    it("Should be able set team reward fee", async () => {
      const { treasury } = await loadFixture(ReplaceTreasuryFixture);
      const [owner] = await ethers.getSigners();
      const teamRewardFee0: BigNumber = await treasury.teamRewardFee();
      await treasury.setTeamRewardFee(1);
      const teamRewardFee1: BigNumber = await treasury.teamRewardFee();
      expect(teamRewardFee1).to.not.be.equal(teamRewardFee0);
      expect(teamRewardFee1).to.be.equal(1);
    });
  });
  describe("getMinters", () => {
    it("Should be able get minters", async () => {
      const { treasury, minterSigner } = await loadFixture(ReplaceTreasuryFixture);
      const minters: string[] = await treasury.getMinters();
      expect(minters).to.be.deep.equal([minterSigner.address]);
    });
  });
  describe("setMinters", () => {
    it('Should be possible call the method only the owner', async () => {
      const { treasury } = await loadFixture(ReplaceTreasuryFixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).setMinters([owner.address])).to.be.rejected;
      await expect(treasury.connect(owner).setMinters([owner.address])).to.be.not.rejected;
    });
    it("Should be able set minters", async () => {
      const { treasury, minterSigner } = await loadFixture(ReplaceTreasuryFixture);
      const [owner, otherSigner] = await ethers.getSigners();
      const minters0: string[] = await treasury.getMinters();
      await treasury.setMinters([owner.address, otherSigner.address]);
      const minters1: string[] = await treasury.getMinters();
      expect(minters1).to.not.be.deep.equal(minters0);
      expect(minters1).to.be.deep.equal([owner.address, otherSigner.address]);
    });
  });
  describe("setIncentivesController", () => {
    it('Should be possible call the method only the owner', async () => {
      const { treasury } = await loadFixture(ReplaceTreasuryFixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).setIncentivesController(owner.address)).to.be.rejected;
      await expect(treasury.connect(owner).setIncentivesController(owner.address)).to.be.not.rejected;
    });
    it("Should be able set incentives controller", async () => {
      const { treasury, minterSigner } = await loadFixture(ReplaceTreasuryFixture);
      const [owner, otherSigner] = await ethers.getSigners();
      const incentivesController0: string = await treasury.incentivesController();
      await treasury.setIncentivesController(otherSigner.address);
      const incentivesController1: string = await treasury.incentivesController();
      expect(incentivesController1).to.not.be.equal(incentivesController0);
      expect(incentivesController1).to.be.equal(otherSigner.address);
    });
  });
  describe("setTickRange", () => {
    it('Should be possible call the method only the owner', async () => {
      const { treasury } = await loadFixture(ReplaceTreasuryFixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).setTickRange([1, 2])).to.be.rejected;
      await expect(treasury.connect(owner).setTickRange([1, 2])).to.be.not.rejected;
    });
    it("Should be able set tick range", async () => {
      const { treasury } = await loadFixture(ReplaceTreasuryFixture);
      const tickRange0_0: number = await treasury.tickRange(0);
      const tickRange0_1: number = await treasury.tickRange(1);
      await treasury.setTickRange([1, 2]);
      const tickRange1_0: number = await treasury.tickRange(0);
      const tickRange1_1: number = await treasury.tickRange(1);
      expect(tickRange1_0).to.not.be.equal(tickRange0_0);
      expect(tickRange1_1).to.not.be.equal(tickRange0_1);
      expect(tickRange1_0).to.be.deep.equal(1);
      expect(tickRange1_1).to.be.deep.equal(2);
    });
  });
});

