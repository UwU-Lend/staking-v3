import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

import { BigNumber } from "ethers";
import { ReplaceTreasuryFixture } from "./fixtures/ReplaceTreasuryFixture";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("MultiFeeDistributionV3", () => {
  describe("Deployment", () => {
    it("Should be deployed correct", async () => {
      const { treasury } = await loadFixture(ReplaceTreasuryFixture);
      expect(treasury.address).to.be.properAddress;
    });
  });
  describe("Lock", () => {
    it("Should be able lock nft", async () => {
      const { treasury, nft, nftIds, nftOwners } = await loadFixture(ReplaceTreasuryFixture);
      await nft.connect(nftOwners[0]).approve(treasury.address, nftIds[0]);
      await nft.connect(nftOwners[2]).approve(treasury.address, nftIds[2]);
      await treasury.connect(nftOwners[0]).lock([nftIds[0]]);
      await treasury.connect(nftOwners[2]).lock([nftIds[2]]);
    });
  });
});

