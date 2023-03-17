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

describe("MultiFeeDistributionV3", () => {
  describe.skip("Deployment", () => {
    it("Should be deployed correct", async () => {
      const { treasury } = await loadFixture(ReplaceTreasuryFixture);
      expect(treasury.address).to.be.properAddress;
    });
  });
  describe.skip("Lock", () => {
    it("Should be able lock nft", async () => {
      const { treasury, nft, nftIds, nftOwners } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await nft.connect(nftOwners[2]).approve(treasury.address, nftIds[2]);
      await expect(treasury.connect(nftOwners[0]).lock([nftIds[0]])).to.be.not.rejected;
      await expect(treasury.connect(nftOwners[2]).lock([nftIds[2]])).to.be.not.rejected;
    });
    it("Should be locked for 56 days", async () => {});
  });
  describe.skip("WithdrawExpiredLocks", () => {
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
  describe.skip("accountLiquidity", () => {
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
  describe.skip("accountAllNFTs", () => {
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
  describe.skip("accountLockedNFTs", () => {
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
  describe.skip("accountUnlockableNFTs", () => {
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
  describe.skip("getLiquidity", () => {
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
  describe.skip("mint", () => {
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
  describe.skip("earnedBalances", () => {
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
  describe.skip("withdrawableBalance", () => {
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
  describe("claimableRewards", () => {});
  describe("exitEarly", () => {});
  describe("withdraw", () => {});
  describe("GetReward", () => {
    it("", async () => {});
  });
  describe("addReward", () => {});
  describe("delegateExit", () => {});
  describe("lastTimeRewardApplicable", () => {});
  describe("publicExit", () => {});


  describe("setTeamRewardVault", () => {});
  describe("setTeamRewardFee", () => {});
  describe("getMinters", () => {});
  describe("setMinters", () => {});
  describe("setIncentivesController", () => {});
  describe("setTickRange", () => {});
});

