import {BigNumber, Contract, ContractReceipt, ContractTransaction} from "ethers";
import {
  MultiFeeDistributionUNIV3POS,
  MultiFeeDistributionUNIV3POS__factory,
  MultiFeeDistributionV3,
} from "../typechain-types";
import fixture, {POSITION_CONFIG} from "./fixtures/MultiFeeDistributionUNIV3POS";
import {loadFixture, time} from "@nomicfoundation/hardhat-network-helpers";

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {UniswapNFTMock} from "../typechain-types/contracts/mocks/UniswapNFTMock";
import {ethers} from "hardhat";
import {expect} from "chai";
import {waitTx} from "../helpers/contracts-helpers";

type WithdrawableBalanceOutput = [BigNumber, BigNumber, BigNumber] & {
  amount: BigNumber;
  penaltyAmount: BigNumber;
  amountWithoutPenalty: BigNumber;
};

type EarnedBalancesOutput = [BigNumber, MultiFeeDistributionUNIV3POS.LockedBalanceStructOutput[]] & {
  total: BigNumber;
  earningsData: MultiFeeDistributionUNIV3POS.LockedBalanceStructOutput[];
};

type RewardDataOutput = {
  periodFinish: BigNumber;
  rewardRate: BigNumber;
  lastUpdateTime: BigNumber;
  rewardPerTokenStored: BigNumber;
  balance: BigNumber;
};

type PositionConfig = [string, string, number, number, number] & {
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
};

type AccountLiquidityOutput = [BigNumber, BigNumber, BigNumber] & {
  total: BigNumber;
  locked: BigNumber;
  unlockable: BigNumber;
};

describe("MultiFeeDistributionUNIV3POS", () => {
  describe("Deployment", () => {
    it("Should be deployed with correct parameters", async () => {
      const {treasury, nft, tokens} = await loadFixture(fixture);
      const nftAddress: string = await treasury.nft();
      const rewardToken: string = await treasury.rewardToken();
      const rewardTokenVault: string = await treasury.rewardTokenVault();
      const posConfig: PositionConfig = await treasury.getPosConfig();
      expect(treasury.address).to.be.properAddress;
      expect(nftAddress).to.be.equal(nft.address);
      expect(rewardToken).to.be.equal(tokens.contracts.uwu.address);
      expect(rewardTokenVault).to.be.equal("0x5776F9bf6568f252cE5Fa85F8fEe3c0d8dE914D8");
      expect(posConfig.token0).to.be.equal(POSITION_CONFIG.token0);
      expect(posConfig.token1).to.be.equal(POSITION_CONFIG.token1);
      expect(posConfig.fee.toString()).to.be.equal(POSITION_CONFIG.fee);
      expect(posConfig.tickLower.toString()).to.be.equal(POSITION_CONFIG.tickLower);
      expect(posConfig.tickUpper.toString()).to.be.equal(POSITION_CONFIG.tickUpper);
    });
    it("Should be reverted if nft address is zero", async () => {
      const deployTx: Promise<Contract> = ethers.deployContract("MultiFeeDistributionUNIV3POS", [
        ethers.constants.AddressZero,
        POSITION_CONFIG,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ]);
      await expect(deployTx).to.be.revertedWith("nft zero address");
    });
    it("Should be reverted if token0 address is zero", async () => {
      const config = {
        ...POSITION_CONFIG,
        token0: ethers.constants.AddressZero,
      };
      const deployTx: Promise<Contract> = ethers.deployContract("MultiFeeDistributionUNIV3POS", [
        "0x0000000000000000000000000000000000000001",
        config,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ]);
      await expect(deployTx).to.be.revertedWith("token0 zero address");
    });
    it("Should be reverted if token1 address is zero", async () => {
      const config = {
        ...POSITION_CONFIG,
        token1: ethers.constants.AddressZero,
      };
      const deployTx: Promise<Contract> = ethers.deployContract("MultiFeeDistributionUNIV3POS", [
        "0x0000000000000000000000000000000000000001",
        config,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ]);
      await expect(deployTx).to.be.revertedWith("token1 zero address");
    });
    it("Should be reverted if token0 equal token1", async () => {
      const config = {
        ...POSITION_CONFIG,
        token0: "0x0000000000000000000000000000000000000001",
        token1: "0x0000000000000000000000000000000000000001",
      };
      const deployTx: Promise<Contract> = ethers.deployContract("MultiFeeDistributionUNIV3POS", [
        "0x0000000000000000000000000000000000000001",
        config,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ]);
      await expect(deployTx).to.be.revertedWith("same tokens");
    });
    it("Should be reverted if reward token address is zero", async () => {
      const deployTx: Promise<Contract> = ethers.deployContract("MultiFeeDistributionUNIV3POS", [
        "0x0000000000000000000000000000000000000001",
        POSITION_CONFIG,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ]);
      await expect(deployTx).to.be.revertedWith("rewardToken zero address");
    });
    it("Should be reverted if reward token vault address is zero", async () => {
      const deployTx: Promise<Contract> = ethers.deployContract("MultiFeeDistributionUNIV3POS", [
        "0x0000000000000000000000000000000000000001",
        POSITION_CONFIG,
        "0x0000000000000000000000000000000000000001",
        ethers.constants.AddressZero,
      ]);
      await expect(deployTx).to.be.revertedWith("rewardTokenVault zero address");
    });
    it("Should be reverted if lower tick greater or equals upper tick", async () => {
      const config = {...POSITION_CONFIG, tickLower: 100, tickUpper: 100};
      const deployTx: Promise<Contract> = ethers.deployContract("MultiFeeDistributionUNIV3POS", [
        "0x0000000000000000000000000000000000000001",
        config,
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000001",
      ]);
      await expect(deployTx).to.be.revertedWith("invalid tick range");
    });
  });
  describe("Lock", () => {
    it("Should be able lock nft", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await expect(treasury.connect(recipient).lock([1])).to.be.not.rejected;
      const nftOwner: string = await nft.ownerOf(nftId);
      expect(nftOwner).to.be.equal(treasury.address);
    });
    it("Should be increase personal and total liquidity", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      const accountLiquidity1: AccountLiquidityOutput = await treasury.accountLiquidity(recipient.address);
      const liquiditySupply1: BigNumber = await treasury.liquiditySupply();
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const accountLiquidity2: AccountLiquidityOutput = await treasury.accountLiquidity(recipient.address);
      const liquiditySupply2: BigNumber = await treasury.liquiditySupply();
      expect(accountLiquidity1.total).to.be.equal(0);
      expect(liquiditySupply1).to.be.equal(0);
      expect(accountLiquidity2.total).to.be.equal(100);
      expect(liquiditySupply2).to.be.equal(100);
    });
    it("Should be reverted if fee different", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient1, recipient2] = await ethers.getSigners();
      const params1: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient1.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      const params2: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient2.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: "3000",
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params1);
      await nft.mint(params2);
      const nftId1: BigNumber = await nft.tokenOfOwnerByIndex(recipient1.address, 0);
      const nftId2: BigNumber = await nft.tokenOfOwnerByIndex(recipient2.address, 0);
      await nft.connect(recipient1).approve(treasury.address, nftId1);
      await nft.connect(recipient2).approve(treasury.address, nftId2);
      await expect(treasury.connect(recipient1).lock([nftId1])).to.be.not.rejected;
      await expect(treasury.connect(recipient2).lock([nftId2])).to.be.rejectedWith("Invalid fee");
    });
    it("Should be reverted if tickLower different", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient1, recipient2] = await ethers.getSigners();
      const params1: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient1.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      const params2: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient2.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: Number(Number(POSITION_CONFIG.tickLower) - 100).toString(),
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params1);
      await nft.mint(params2);
      const nftId1: BigNumber = await nft.tokenOfOwnerByIndex(recipient1.address, 0);
      const nftId2: BigNumber = await nft.tokenOfOwnerByIndex(recipient2.address, 0);
      await nft.connect(recipient1).approve(treasury.address, nftId1);
      await nft.connect(recipient2).approve(treasury.address, nftId2);
      await expect(treasury.connect(recipient1).lock([nftId1])).to.be.not.rejected;
      await expect(treasury.connect(recipient2).lock([nftId2])).to.be.rejectedWith("Invalid lower tick");
    });
    it("Should be reverted if tickUpper upper", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient1, recipient2] = await ethers.getSigners();
      const params1: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient1.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      const params2: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient2.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: Number(Number(POSITION_CONFIG.tickUpper) + 100).toString(),
        liquidity: 100,
      };
      await nft.mint(params1);
      await nft.mint(params2);
      const nftId1: BigNumber = await nft.tokenOfOwnerByIndex(recipient1.address, 0);
      const nftId2: BigNumber = await nft.tokenOfOwnerByIndex(recipient2.address, 0);
      await nft.connect(recipient1).approve(treasury.address, nftId1);
      await nft.connect(recipient2).approve(treasury.address, nftId2);
      await expect(treasury.connect(recipient1).lock([nftId1])).to.be.not.rejected;
      await expect(treasury.connect(recipient2).lock([nftId2])).to.be.rejectedWith("Invalid upper tick");
    });
    it("Should be reverted if token0 different", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient1, recipient2] = await ethers.getSigners();
      const params1: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient1.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      const params2: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient2.address,
        token0: ethers.constants.AddressZero,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params1);
      await nft.mint(params2);
      const nftId1: BigNumber = await nft.tokenOfOwnerByIndex(recipient1.address, 0);
      const nftId2: BigNumber = await nft.tokenOfOwnerByIndex(recipient2.address, 0);
      await nft.connect(recipient1).approve(treasury.address, nftId1);
      await nft.connect(recipient2).approve(treasury.address, nftId2);
      await expect(treasury.connect(recipient1).lock([nftId1])).to.be.not.rejected;
      await expect(treasury.connect(recipient2).lock([nftId2])).to.be.rejectedWith("Invalid token0");
    });
    it("Should be reverted if token1 different", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient1, recipient2] = await ethers.getSigners();
      const params1: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient1.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      const params2: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient2.address,
        token0: POSITION_CONFIG.token0,
        token1: ethers.constants.AddressZero,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params1);
      await nft.mint(params2);
      const nftId1: BigNumber = await nft.tokenOfOwnerByIndex(recipient1.address, 0);
      const nftId2: BigNumber = await nft.tokenOfOwnerByIndex(recipient2.address, 0);
      await nft.connect(recipient1).approve(treasury.address, nftId1);
      await nft.connect(recipient2).approve(treasury.address, nftId2);
      await expect(treasury.connect(recipient1).lock([nftId1])).to.be.not.rejected;
      await expect(treasury.connect(recipient2).lock([nftId2])).to.be.rejectedWith("Invalid token1");
    });
    it("Should be reverted if liquidity zero", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      const mintParams: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 0,
      };
      await nft.mint(mintParams);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await expect(treasury.connect(recipient).lock([nftId])).to.be.rejectedWith("Invalid liquidity");
    });
  });
  describe("WithdrawExpiredLocks", () => {
    it("Should be able withdraw expired locks", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      await time.increase(60 * 60 * 24 * 10); // 10 days
      await treasury.connect(recipient)["withdrawExpiredLocks()"]();
      expect(await nft.ownerOf(nftId)).to.be.equal(treasury.address);
      await time.increase(60 * 60 * 24 * 46); // 46 days
      await treasury.connect(recipient)["withdrawExpiredLocks()"]();
      expect(await nft.ownerOf(nftId)).to.be.equal(recipient.address);
    });
    it("Should be imposible withdraw when public exit diactivated and locks not expired", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const owner1: string = await nft.ownerOf(nftId);
      await time.increase(86400 * 10);
      await treasury.connect(recipient)["withdrawExpiredLocks()"]();
      const owner2: string = await nft.ownerOf(nftId);
      expect(owner1).to.be.equal(treasury.address);
      expect(owner2).to.be.equal(treasury.address);
    });
    it("Should be able to withdraw when public exit activated", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const owner1: string = await nft.ownerOf(nftId);
      await time.increase(86400 * 10);
      await treasury.publicExit();
      await treasury.connect(recipient)["withdrawExpiredLocks()"]();
      const owner2: string = await nft.ownerOf(nftId);
      expect(owner1).to.be.equal(treasury.address);
      expect(owner2).to.be.equal(recipient.address);
    });
    it("Should be decrease personal and total liquidity", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const accountLiquidity1: AccountLiquidityOutput = await treasury.accountLiquidity(recipient.address);
      const liquiditySupply1: BigNumber = await treasury.liquiditySupply();
      await time.increase(86400 * 56);
      await treasury.connect(recipient)["withdrawExpiredLocks()"]();
      const accountLiquidity2: AccountLiquidityOutput = await treasury.accountLiquidity(recipient.address);
      const liquiditySupply2: BigNumber = await treasury.liquiditySupply();
      expect(accountLiquidity1.total).to.be.equal(100);
      expect(liquiditySupply1).to.be.equal(100);
      expect(accountLiquidity2.total).to.be.equal(0);
      expect(liquiditySupply2).to.be.equal(0);
    });
  });
  describe("WithdrawExpiredLocks(nftIds)", () => {
    it("Should be able withdraw expired locks", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      await time.increase(60 * 60 * 24 * 10); // 10 days
      await treasury.connect(recipient)["withdrawExpiredLocks(uint256[])"]([nftId]);
      expect(await nft.ownerOf(nftId)).to.be.equal(treasury.address);
      await time.increase(60 * 60 * 24 * 46); // 46 days
      await treasury.connect(recipient)["withdrawExpiredLocks(uint256[])"]([nftId]);
      expect(await nft.ownerOf(nftId)).to.be.equal(recipient.address);
    });
    it("Should be imposible withdraw when public exit diactivated and locks not expired", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const owner1: string = await nft.ownerOf(nftId);
      await time.increase(86400 * 10);
      await treasury.connect(recipient)["withdrawExpiredLocks(uint256[])"]([nftId]);
      const owner2: string = await nft.ownerOf(nftId);
      expect(owner1).to.be.equal(treasury.address);
      expect(owner2).to.be.equal(treasury.address);
    });
    it("Should be able to withdraw when public exit activated", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const owner1: string = await nft.ownerOf(nftId);
      await time.increase(86400 * 10);
      await treasury.publicExit();
      await treasury.connect(recipient)["withdrawExpiredLocks(uint256[])"]([nftId]);
      const owner2: string = await nft.ownerOf(nftId);
      expect(owner1).to.be.equal(treasury.address);
      expect(owner2).to.be.equal(recipient.address);
    });
    it("Should be decrease personal and total liquidity", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const accountLiquidity1: AccountLiquidityOutput = await treasury.accountLiquidity(recipient.address);
      const liquiditySupply1: BigNumber = await treasury.liquiditySupply();
      await time.increase(86400 * 56);
      await treasury.connect(recipient)["withdrawExpiredLocks(uint256[])"]([nftId]);
      const accountLiquidity2: AccountLiquidityOutput = await treasury.accountLiquidity(recipient.address);
      const liquiditySupply2: BigNumber = await treasury.liquiditySupply();
      expect(accountLiquidity1.total).to.be.equal(100);
      expect(liquiditySupply1).to.be.equal(100);
      expect(accountLiquidity2.total).to.be.equal(0);
      expect(liquiditySupply2).to.be.equal(0);
    });
    it("Should be reverted if nft not locked", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await expect(treasury.connect(recipient)["withdrawExpiredLocks(uint256[])"]([nftId])).to.be.rejectedWith(
        "Not locked"
      );
    });
  });
  describe("accountLiquidity", () => {
    it("Should be able to get liquidity", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const liquidity0: {
        total: BigNumber;
        locked: BigNumber;
        unlockable: BigNumber;
      } = await treasury.accountLiquidity(recipient.address);
      expect(liquidity0.total).to.be.equal("100");
      expect(liquidity0.locked).to.be.equal("100");
      expect(liquidity0.unlockable).to.be.equal(0);
      await time.increase(60 * 60 * 24 * 56); // 56 days
      const liquidity1: {
        total: BigNumber;
        locked: BigNumber;
        unlockable: BigNumber;
      } = await treasury.accountLiquidity(recipient.address);
      expect(liquidity1.total).to.be.equal("100");
      expect(liquidity1.locked).to.be.equal(0);
      expect(liquidity1.unlockable).to.be.equal("100");
    });
  });
  describe("accountAllNFTs", () => {
    it("Should be able to get all nfts", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      const nextMineTime: number = (await time.latest()) + 1;
      await treasury.connect(recipient).lock([nftId]);
      const nfts0: MultiFeeDistributionV3.LockedNFTStructOutput[] = await treasury.accountAllNFTs(recipient.address);
      expect(nfts0.length).to.be.equal(1);
      expect(nfts0[0].id).to.be.equal(nftId);
      expect(nfts0[0].liquidity).to.be.equal("100");
      expect(nfts0[0].unlockTime).to.be.equal(nextMineTime + 60 * 60 * 24 * 56); // now + 56 days
    });
  });
  describe("accountLockedNFTs", () => {
    it("Should be able to get locked nfts", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      const nextMineTime: number = (await time.latest()) + 1;
      await treasury.connect(recipient).lock([nftId]);
      const nfts0: MultiFeeDistributionV3.LockedNFTStructOutput[] = await treasury.accountLockedNFTs(recipient.address);
      expect(nfts0.length).to.be.equal(1);
      expect(nfts0[0].id).to.be.equal(nftId);
      expect(nfts0[0].liquidity).to.be.equal("100");
      expect(nfts0[0].unlockTime).to.be.equal(nextMineTime + 60 * 60 * 24 * 56); // now + 56 days
      await time.increase(60 * 60 * 24 * 56); // 56 days
      const nfts1: MultiFeeDistributionV3.LockedNFTStructOutput[] = await treasury.accountLockedNFTs(recipient.address);
      expect(nfts1.length).to.be.equal(0);
    });
  });
  describe("accountUnlockableNFTs", () => {
    ``;
    it("Should be able to get unlockable nfts", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      const nextMineTime: number = (await time.latest()) + 1;
      await treasury.connect(recipient).lock([nftId]);
      const nfts0: MultiFeeDistributionV3.LockedNFTStructOutput[] = await treasury.accountUnlockableNFTs(
        recipient.address
      );
      expect(nfts0.length).to.be.equal(0);
      await time.increase(60 * 60 * 24 * 56); // 56 days
      const nfts1: MultiFeeDistributionV3.LockedNFTStructOutput[] = await treasury.accountUnlockableNFTs(
        recipient.address
      );
      expect(nfts1.length).to.be.equal(1);
      expect(nfts1[0].id).to.be.equal(nftId);
      expect(nfts1[0].liquidity).to.be.equal("100");
      expect(nfts1[0].unlockTime).to.be.equal(nextMineTime + 60 * 60 * 24 * 56); // now + 56 days
    });
  });
  describe("mint", () => {
    it("Should be able to mint to self", async () => {
      const {treasury, nft, tokens} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const minter: string = await treasury.incentivesController();
      const minterSigner: SignerWithAddress = await ethers.getImpersonatedSigner(minter);
      await ethers.provider.send("hardhat_setBalance", [
        minterSigner.address,
        BigNumber.from("1000000000000000000000").toHexString(),
      ]);
      const amountInWei = ethers.utils.parseEther("1000");
      const balance0: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      await treasury.connect(minterSigner).mint(treasury.address, amountInWei);
      const balance1: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      expect(balance1.sub(balance0)).to.be.equal(amountInWei);
      const earnedBalances: {total: BigNumber} = await treasury.earnedBalances(treasury.address);
      expect(earnedBalances.total).to.be.equal(0);
    });
    it("Should be able to mint to address", async () => {
      const {treasury, nft, tokens, minterSigner} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const amountInWei = ethers.utils.parseEther("1000");
      const balance0: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei);
      const balance1: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      expect(balance1.sub(balance0)).to.be.equal(amountInWei);
      const earnedBalances: {total: BigNumber} = await treasury.earnedBalances(recipient.address);
      expect(earnedBalances.total).to.be.equal(amountInWei);
    });
    it("Should be reverted if not minter", async () => {
      const {treasury} = await loadFixture(fixture);
      const [notMinter, recipient] = await ethers.getSigners();
      const amountInWei = ethers.utils.parseEther("1000");
      await expect(treasury.connect(notMinter).mint(recipient.address, amountInWei)).to.be.revertedWith("!minter");
    });
    it("Should be reverted if recipient address zero", async () => {
      const {treasury, minterSigner} = await loadFixture(fixture);
      const amountInWei = ethers.utils.parseEther("1000");
      await expect(treasury.connect(minterSigner).mint(ethers.constants.AddressZero, amountInWei)).to.be.revertedWith(
        "user address zero"
      );
    });
    it("Should be not reverted if amount zero", async () => {
      const {treasury, minterSigner} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      await expect(treasury.connect(minterSigner).mint(recipient.address, 0)).to.be.not.rejected;
    });
    it("Should be correct earned balances: mint -> wait (1 day) -> mint", async () => {
      const {treasury, minterSigner} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      const amountInWe1 = ethers.utils.parseEther("1000");
      const amountInWe2 = ethers.utils.parseEther("2000");
      await treasury.connect(minterSigner).mint(recipient.address, amountInWe1);
      await time.increase(86400 * 1);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWe2);
      const balance: EarnedBalancesOutput = await treasury.earnedBalances(recipient.address);
      expect(balance.total).to.be.equal(amountInWe1.add(amountInWe2));
      expect(balance.earningsData.length).to.be.equal(1);
      expect(balance.earningsData[0].amount).to.be.equal(amountInWe1.add(amountInWe2));
    });
  });
  describe("earnedBalances", () => {
    it("Should be able to get earned balances", async () => {
      const {treasury, nft, minterSigner} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const earnedBalances0: {total: BigNumber} = await treasury.earnedBalances(recipient.address);
      const amountInWei = ethers.utils.parseEther("1000");
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei);
      expect(earnedBalances0.total).to.be.equal(0);
      const earnedBalances1: {total: BigNumber} = await treasury.earnedBalances(recipient.address);
      expect(earnedBalances1.total).to.be.equal(amountInWei);
    });
    it("Should be return correct earned balances: mint -> wait (vesting duration) -> mint", async () => {
      const {treasury, minterSigner} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      const amountInWei: BigNumber = ethers.utils.parseEther("1000");
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei);
      await time.increase(86400 * 28);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei);
      const balance = await treasury.earnedBalances(recipient.address);
      expect(balance.total).to.be.equal(amountInWei);
      expect(balance.earningsData.length).to.be.equal(1);
      expect(balance.earningsData[0].amount).to.be.equal(amountInWei);
    });
    it("Should be return correct earned balances: mint -> wait (vesting duration) -> mint -> wait (5 days) -> mint -> wait (5 days)", async () => {
      const {treasury, minterSigner} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      const amountInWei1: BigNumber = ethers.utils.parseEther("1000");
      const amountInWei2: BigNumber = ethers.utils.parseEther("2000");
      const amountInWei3: BigNumber = ethers.utils.parseEther("3000");
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei1);
      await time.increase(86400 * 28);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei2);
      await time.increase(86400 * 7);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei3);
      await time.increase(86400 * 7);
      const balance = await treasury.earnedBalances(recipient.address);
      expect(balance.total).to.be.equal(amountInWei2.add(amountInWei3));
      expect(balance.earningsData.length).to.be.equal(2);
      expect(balance.earningsData[0].amount).to.be.equal(amountInWei2);
      expect(balance.earningsData[1].amount).to.be.equal(amountInWei3);
    });
  });
  describe("withdrawableBalance", () => {
    it("Should be able to get withdrawable balance", async () => {
      const {treasury, nft, minterSigner} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const amountInWei0 = ethers.utils.parseEther("1000");
      const amountInWei1 = ethers.utils.parseEther("2000");
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei0);
      await time.increase(86400 * 10);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei1);
      const balances0: WithdrawableBalanceOutput = await treasury.withdrawableBalance(recipient.address);
      await time.increase(86400 * 20);
      const balances1: WithdrawableBalanceOutput = await treasury.withdrawableBalance(recipient.address);
      await time.increase(86400 * 30);
      const balances2: WithdrawableBalanceOutput = await treasury.withdrawableBalance(recipient.address);
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
    it("Should be correct work if earned = 0", async () => {
      const {treasury} = await loadFixture(fixture);
      const balance: WithdrawableBalanceOutput = await treasury.withdrawableBalance(
        "0x0000000000000000000000000000000000000001"
      );
      expect(balance.amount).to.be.equal(0);
      expect(balance.penaltyAmount).to.be.equal(0);
      expect(balance.amountWithoutPenalty).to.be.equal(0);
    });
    it("Should be correct work when minting reward tokens at the user address", async () => {
      const {treasury, minterSigner} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      const amountInWei: BigNumber = ethers.utils.parseEther("1000");
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei);
      const balance: WithdrawableBalanceOutput = await treasury.withdrawableBalance(recipient.address);
      expect(balance.amount).to.be.equal(amountInWei.div(2));
      expect(balance.penaltyAmount).to.be.equal(amountInWei.div(2));
      expect(balance.amountWithoutPenalty).to.be.equal(0);
    });
    it("Should be correct work by scenario: mint -> wait (vesting duration) -> mint -> withdraw", async () => {
      const {treasury, minterSigner} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      const amountInWei: BigNumber = ethers.utils.parseEther("1000");
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei);
      await time.increase(86400 * 28);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei);
      await treasury.connect(recipient).withdraw();
      const balance: WithdrawableBalanceOutput = await treasury.withdrawableBalance(recipient.address);

      expect(balance.amount).to.be.equal(amountInWei.div(2));
      expect(balance.penaltyAmount).to.be.equal(amountInWei.div(2));
      expect(balance.amountWithoutPenalty).to.be.equal(0);
    });
  });
  describe("claimableRewards", () => {
    it("Should be able to get claimable rewards", async () => {
      const {treasury, nft, minterSigner} = await loadFixture(fixture);
      const [recipient1, recipient2] = await ethers.getSigners();
      await nft.mint({
        recipient: recipient1.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      });
      await nft.mint({
        recipient: recipient2.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      });

      const nftId1: BigNumber = await nft.tokenOfOwnerByIndex(recipient1.address, 0);
      const nftId2: BigNumber = await nft.tokenOfOwnerByIndex(recipient2.address, 0);
      await nft.connect(recipient1).approve(treasury.address, nftId1);
      await nft.connect(recipient2).approve(treasury.address, nftId2);
      await treasury.connect(recipient1).lock([nftId1]);
      await treasury.connect(recipient2).lock([nftId2]);
      const amountInWei1 = ethers.utils.parseEther("1000");
      await treasury.connect(minterSigner).mint(treasury.address, amountInWei1);
      await time.increase(86400 * 10);
      const claimableRewards1: MultiFeeDistributionUNIV3POS.RewardDataStructOutput[] = await treasury.claimableRewards(
        recipient1.address
      );
      await time.increase(86400 * 20);
      const claimableRewards2: MultiFeeDistributionUNIV3POS.RewardDataStructOutput[] = await treasury.claimableRewards(
        recipient1.address
      );
      await time.increase(86400 * 30);
      const claimableRewards3: MultiFeeDistributionUNIV3POS.RewardDataStructOutput[] = await treasury.claimableRewards(
        recipient1.address
      );
      expect(claimableRewards1).to.be.deep.equal(claimableRewards2);
      expect(claimableRewards1).to.be.deep.equal(claimableRewards3);
      expect(amountInWei1.div(2).sub(claimableRewards1[0].amount)).to.be.lte(1);
      expect(amountInWei1.div(2).sub(claimableRewards2[0].amount)).to.be.lte(1);
      expect(amountInWei1.div(2).sub(claimableRewards3[0].amount)).to.be.lte(1);
    });
  });
  describe("exit", () => {
    it("Should be able to exit early", async () => {
      const {treasury, nft, minterSigner, tokens} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const amountInWei0 = ethers.utils.parseEther("1000");
      const ownerBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei0);
      await time.increase(86400 * 10);
      const treasuryBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      await treasury.connect(recipient).exit(recipient.address);
      const treasuryBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      const ownerBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      expect(treasuryBalances0).to.be.equal(amountInWei0);
      expect(treasuryBalances1).to.be.equal(amountInWei0.div(2));
      expect(ownerBalances1).to.be.equal(amountInWei0.div(2).add(ownerBalances0));
    });
    it("Should be rejected it sender not authorized", async () => {
      const {treasury} = await loadFixture(fixture);
      const [authorizedSigner, notAuthorizedSigner] = await ethers.getSigners();
      await expect(treasury.connect(authorizedSigner).exit(notAuthorizedSigner.address)).to.be.revertedWith(
        "Not authorized"
      );
    });
  });
  describe("withdraw", () => {
    it("Should be nothing if not enough time has passed", async () => {
      const {treasury, nft, minterSigner, tokens} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const amountInWei0 = ethers.utils.parseEther("1000");
      const ownerBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei0);
      await time.increase(86400 * 10);
      await treasury.connect(recipient).withdraw();
      const ownerBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      expect(ownerBalances1).to.be.equal(ownerBalances0);
    });
    it("Should be able to withdraw", async () => {
      const {treasury, nft, minterSigner, tokens} = await loadFixture(fixture);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const amountInWei0 = ethers.utils.parseEther("1000");
      const ownerBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei0);
      await time.increase(86400 * 56);
      await treasury.connect(recipient).withdraw();
      const ownerBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      expect(ownerBalances1).to.be.equal(amountInWei0.add(ownerBalances0));
    });
    it("Should be able to withdraw if earned = 0", async () => {
      const {treasury} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      await expect(treasury.connect(recipient).withdraw()).to.be.not.reverted;
    });
    it("Should be correct withdraw by scenario: mint -> wait (vesting duration) -> mint -> wait (1 day) -> withdraw -> wait (1 day) -> withdraw", async () => {
      const {treasury, minterSigner, tokens} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      const amountInWei1: BigNumber = ethers.utils.parseEther("1000");
      const amountInWei2: BigNumber = ethers.utils.parseEther("2000");
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei1);
      await time.increase(86400 * 28);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei2);
      await time.increase(86400 * 1);
      const balanceBefore: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      await expect(treasury.connect(recipient).withdraw()).to.be.not.reverted;
      await time.increase(86400 * 1);
      await expect(treasury.connect(recipient).withdraw()).to.be.not.reverted;
      const balanceAfter: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.equal(amountInWei1);
    });
  });
  describe("GetReward", () => {
    it("Should be able to get reward (uwu,uToken)", async () => {
      const {treasury, nft, minterSigner, tokens} = await loadFixture(fixture);
      await treasury.addReward(tokens.contracts.dai.address);
      const [recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const uwuAmountInWei = ethers.utils.parseEther("1000");
      const daiAmountInWei = ethers.utils.parseEther("2000");
      const uwuBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      const daiBalances0: BigNumber = await tokens.contracts.dai.balanceOf(recipient.address);
      await treasury.connect(minterSigner).mint(treasury.address, uwuAmountInWei);
      await tokens.contracts.dai
        .connect(tokens.holders.dai)
        .transferFrom(tokens.holders.dai.address, treasury.address, daiAmountInWei);
      await treasury.getReward([tokens.contracts.uwu.address, tokens.contracts.dai.address]);
      await time.increase(86400 * 7);
      await treasury.connect(recipient).getReward([tokens.contracts.uwu.address, tokens.contracts.dai.address]);
      const uwuBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      const daiBalances1: BigNumber = await tokens.contracts.dai.balanceOf(recipient.address);
      expect(uwuBalances1.sub(uwuBalances0.add(uwuAmountInWei))).to.be.lessThanOrEqual(1);
      expect(daiBalances1.sub(daiBalances0.add(daiAmountInWei))).to.be.lessThanOrEqual(1);
    });
    it("Should be able distribute and get reward between lockers (uwu,uToken)", async () => {
      const {treasury, nft, minterSigner, tokens} = await loadFixture(fixture);
      await treasury.addReward(tokens.contracts.dai.address);
      const [, recipient1, recipient2] = await ethers.getSigners();
      const params1: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient1.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params1);
      const nftId1: BigNumber = await nft.tokenOfOwnerByIndex(recipient1.address, 0);
      await nft.connect(recipient1).approve(treasury.address, nftId1);
      await treasury.connect(recipient1).lock([nftId1]);
      const params2: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient2.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 200,
      };
      await nft.mint(params2);
      const nftId2: BigNumber = await nft.tokenOfOwnerByIndex(recipient2.address, 0);
      await nft.connect(recipient2).approve(treasury.address, nftId2);
      await treasury.connect(recipient2).lock([nftId2]);
      const liquidity0: AccountLiquidityOutput = await treasury.accountLiquidity(recipient1.address);
      const liquidity2: AccountLiquidityOutput = await treasury.accountLiquidity(recipient2.address);
      const liquiditySupply: BigNumber = await treasury.liquiditySupply();
      const uwuAmountInWei = ethers.utils.parseEther("1000");
      const daiAmountInWei = ethers.utils.parseEther("2000");
      const owner0UwuBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(recipient1.address);
      const owner0DaiBalances0: BigNumber = await tokens.contracts.dai.balanceOf(recipient1.address);
      const owner2UwuBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(recipient2.address);
      const owner2DaiBalances0: BigNumber = await tokens.contracts.dai.balanceOf(recipient2.address);
      await treasury.connect(minterSigner).mint(treasury.address, uwuAmountInWei);
      await tokens.contracts.dai
        .connect(tokens.holders.dai)
        .transferFrom(tokens.holders.dai.address, treasury.address, daiAmountInWei);
      await treasury.getReward([tokens.contracts.uwu.address, tokens.contracts.dai.address]);
      await time.increase(86400 * 7);
      await treasury.connect(recipient1).getReward([tokens.contracts.uwu.address, tokens.contracts.dai.address]);
      await treasury.connect(recipient2).getReward([tokens.contracts.uwu.address, tokens.contracts.dai.address]);
      const owner0UwuBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(recipient1.address);
      const owner0DaiBalances1: BigNumber = await tokens.contracts.dai.balanceOf(recipient1.address);
      const owner2UwuBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(recipient2.address);
      const owner2DaiBalances1: BigNumber = await tokens.contracts.dai.balanceOf(recipient2.address);
      const needUwu0 = liquidity0.locked.mul(uwuAmountInWei).div(liquiditySupply);
      const needDai0 = liquidity0.locked.mul(daiAmountInWei).div(liquiditySupply);
      const needUwu2 = liquidity2.locked.mul(uwuAmountInWei).div(liquiditySupply);
      const needDai2 = liquidity2.locked.mul(daiAmountInWei).div(liquiditySupply);
      expect(owner0UwuBalances1.sub(owner0UwuBalances0)).to.be.equal(needUwu0);
      expect(owner0DaiBalances1.sub(owner0DaiBalances0)).to.be.equal(needDai0);
      expect(owner2UwuBalances1.sub(owner2UwuBalances0)).to.be.equal(needUwu2);
      expect(owner2DaiBalances1.sub(owner2DaiBalances0)).to.be.equal(needDai2);
    });
    it("Should be rejected if reward token not registered", async () => {
      const {treasury, tokens} = await loadFixture(fixture);
      await expect(treasury.getReward([tokens.contracts.dai.address])).to.be.rejectedWith("Unknown reward token");
    });
    it("Should be skipped notify unseen by scenario: transfer -> getReward -> transfer -> wait (less 1 day) -> getReward", async () => {
      const {treasury, tokens} = await loadFixture(fixture);
      await treasury.addReward(tokens.contracts.dai.address);
      const amountInWe1 = ethers.utils.parseEther("1000");
      const amountInWe2 = ethers.utils.parseEther("2000");
      await tokens.contracts.dai.connect(tokens.holders.dai).transfer(treasury.address, amountInWe1);
      await treasury.getReward([tokens.contracts.dai.address]);
      await tokens.contracts.dai.connect(tokens.holders.dai).transfer(treasury.address, amountInWe2);
      await treasury.getReward([tokens.contracts.dai.address]);
      const rewardData = await treasury.rewardData(tokens.contracts.dai.address);
      expect(rewardData.balance).to.be.equal(amountInWe1);
    });
    it("Should be skipped notify unseen by scenario: transfer -> getReward -> transfer -> wait (gte 1 day) -> getReward", async () => {
      const {treasury, tokens} = await loadFixture(fixture);
      await treasury.addReward(tokens.contracts.dai.address);
      const amountInWe1 = ethers.utils.parseEther("1000");
      const amountInWe2 = ethers.utils.parseEther("2000");
      await tokens.contracts.dai.connect(tokens.holders.dai).transfer(treasury.address, amountInWe1);
      await treasury.getReward([tokens.contracts.dai.address]);
      await tokens.contracts.dai.connect(tokens.holders.dai).transfer(treasury.address, amountInWe2);
      await time.increase(86400 * 1);
      await treasury.getReward([tokens.contracts.dai.address]);
      const rewardData = await treasury.rewardData(tokens.contracts.dai.address);
      expect(rewardData.balance).to.be.equal(amountInWe1.add(amountInWe2));
    });
    it("Should be adjust reward", async () => {
      const {treasury, tokens, nft} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      const fee: BigNumber = await treasury.teamRewardFee();
      const teamRewardVault = "0x0000000000000000000000000000000000000123";
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      await treasury.setTeamRewardVault(teamRewardVault);
      await treasury.addReward(tokens.contracts.dai.address);
      const amountInWe = ethers.utils.parseEther("1000");
      await tokens.contracts.dai.connect(tokens.holders.dai).transfer(treasury.address, amountInWe);
      await time.increase(86400 * 1);
      await treasury.connect(recipient).getReward([tokens.contracts.dai.address]);
      await time.increase(86400 * 7);
      await treasury.connect(recipient).getReward([tokens.contracts.dai.address]);
      const balanceRecipient: BigNumber = await tokens.contracts.dai.balanceOf(recipient.address);
      const balanceTeamRewardVault: BigNumber = await tokens.contracts.dai.balanceOf(teamRewardVault);
      const feeAmount: BigNumber = amountInWe.mul(fee).div(10000);
      const amount = amountInWe.sub(feeAmount);
      expect(feeAmount.sub(balanceTeamRewardVault)).to.be.lte(1);
      expect(amount.sub(balanceRecipient)).to.be.lte(1);
    });
    it("Should be don't call transfer token if amount = 0", async () => {
      const {treasury, tokens, nft} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      const teamRewardVault = "0x0000000000000000000000000000000000000123";
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      await treasury.setTeamRewardVault(teamRewardVault);
      await treasury.addReward(tokens.contracts.dai.address);
      const amountInWe = 1;
      await tokens.contracts.dai.connect(tokens.holders.dai).transfer(treasury.address, amountInWe);
      await time.increase(86400 * 1);
      await treasury.connect(recipient).getReward([tokens.contracts.dai.address]);
      await time.increase(86400 * 7);
      await treasury.connect(recipient).getReward([tokens.contracts.dai.address]);
      const balanceTeamRewardVault: BigNumber = await tokens.contracts.dai.balanceOf(teamRewardVault);
      expect(balanceTeamRewardVault).to.be.equal(0);
    });
  });
  describe("addReward", () => {
    it("Should be able to add reward", async () => {
      const {treasury, tokens} = await loadFixture(fixture);
      await treasury.addReward(tokens.contracts.dai.address);
      await expect(treasury.getReward([tokens.contracts.dai.address])).to.be.not.rejected;
    });
    it("Should be able to add reward only once", async () => {
      const {treasury, tokens} = await loadFixture(fixture);
      await expect(treasury.addReward(tokens.contracts.dai.address)).to.be.not.rejected;
      await expect(treasury.addReward(tokens.contracts.dai.address)).to.be.rejectedWith("reward token already added");
    });
    it("Should be able to add reward only by owner", async () => {
      const {treasury, tokens} = await loadFixture(fixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).addReward(tokens.contracts.dai.address)).to.be.rejectedWith(
        "Ownable: caller is not the owner"
      );
      await expect(treasury.connect(owner).addReward(tokens.contracts.dai.address)).to.be.not.rejected;
    });
    it("Should be rejected if reward token is zero address", async () => {
      const {treasury} = await loadFixture(fixture);
      await expect(treasury.addReward(ethers.constants.AddressZero)).to.be.rejectedWith("zero address");
    });
  });
  describe("delegateExit", () => {
    it("Should be able to delegate exit", async () => {
      const {treasury, nft, minterSigner, tokens} = await loadFixture(fixture);
      const [, recipient, delegatedSigner] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const amountInWei0 = ethers.utils.parseEther("1000");
      const treasuryBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      const ownerBalances0: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      await treasury.connect(minterSigner).mint(recipient.address, amountInWei0);
      const treasuryBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      await time.increase(86400 * 28);
      await treasury.connect(recipient).delegateExit(delegatedSigner.address);
      await treasury.connect(delegatedSigner).exit(recipient.address);
      const treasuryBalances2: BigNumber = await tokens.contracts.uwu.balanceOf(treasury.address);
      const ownerBalances1: BigNumber = await tokens.contracts.uwu.balanceOf(recipient.address);
      expect(treasuryBalances0).to.be.equal(0);
      expect(treasuryBalances1).to.be.equal(amountInWei0);
      expect(treasuryBalances2).to.be.equal(0);
      expect(ownerBalances1).to.be.equals(amountInWei0.add(ownerBalances0));
    });
  });
  describe("lastTimeRewardApplicable", () => {
    it("Should be able to get last time reward applicable", async () => {
      const {treasury, tokens, minterSigner} = await loadFixture(fixture);
      await time.increase(1);
      const rewardData0: RewardDataOutput = await treasury.rewardData(tokens.contracts.uwu.address);
      const lastTimeRewardApplicable0: BigNumber = await treasury.lastTimeRewardApplicable(
        tokens.contracts.uwu.address
      );
      const amountInWei0 = ethers.utils.parseEther("1000");
      const latestTime: number = (await time.latest()) + 1;
      await treasury.connect(minterSigner).mint(treasury.address, amountInWei0);
      const lastTimeRewardApplicable1: BigNumber = await treasury.lastTimeRewardApplicable(
        tokens.contracts.uwu.address
      );
      await time.increase(86400 * 7);
      const lastTimeRewardApplicable2: BigNumber = await treasury.lastTimeRewardApplicable(
        tokens.contracts.uwu.address
      );
      await time.increase(86400 * 7);
      const lastTimeRewardApplicable3: BigNumber = await treasury.lastTimeRewardApplicable(
        tokens.contracts.uwu.address
      );
      expect(lastTimeRewardApplicable0).to.be.equal(rewardData0.periodFinish);
      expect(lastTimeRewardApplicable1).to.be.equal(latestTime); //  + 86400 * 7
      expect(lastTimeRewardApplicable2).to.be.equal(latestTime + 86400 * 7);
      expect(lastTimeRewardApplicable3).to.be.equal(latestTime + 86400 * 7);
    });
  });
  describe("publicExit", () => {
    it("Should be possible call the method only the owner", async () => {
      const {treasury} = await loadFixture(fixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).publicExit()).to.be.rejected;
      await expect(treasury.connect(owner).publicExit()).to.be.not.rejected;
    });
    it("Should be able set public exit flag", async () => {
      const {treasury} = await loadFixture(fixture);
      const publicExitAreSet0: boolean = await treasury.publicExitAreSet();
      await treasury.publicExit();
      const publicExitAreSet1: boolean = await treasury.publicExitAreSet();
      expect(publicExitAreSet0).to.be.equal(false);
      expect(publicExitAreSet1).to.be.equal(true);
    });
    it("Should be rejected if public exit flag already set", async () => {
      const {treasury} = await loadFixture(fixture);
      await expect(treasury.publicExit()).to.be.not.rejected;
      await expect(treasury.publicExit()).to.be.rejectedWith("public exit are set");
    });
  });
  describe("setTeamRewardVault", () => {
    it("Should be possible call the method only the owner", async () => {
      const {treasury} = await loadFixture(fixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).setTeamRewardVault(owner.address)).to.be.rejected;
      await expect(treasury.connect(owner).setTeamRewardVault(owner.address)).to.be.not.rejected;
    });
    it("Should be able set team reward vault", async () => {
      const {treasury} = await loadFixture(fixture);
      const [owner, otherSigner] = await ethers.getSigners();
      const teamRewardVault0: string = await treasury.teamRewardVault();
      await treasury.setTeamRewardVault(otherSigner.address);
      const teamRewardVault1: string = await treasury.teamRewardVault();
      expect(teamRewardVault1).to.not.be.equal(teamRewardVault0);
      expect(teamRewardVault1).to.be.equal(otherSigner.address);
    });
    it("Should be rejected when set zero address", async () => {
      const {treasury} = await loadFixture(fixture);
      await expect(treasury.setTeamRewardVault(ethers.constants.AddressZero)).to.be.rejectedWith("zero address");
    });
  });
  describe("setTeamRewardFee", () => {
    it("Should be possible call the method only the owner", async () => {
      const {treasury} = await loadFixture(fixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).setTeamRewardFee(1)).to.be.rejected;
      await expect(treasury.connect(owner).setTeamRewardFee(1)).to.be.not.rejected;
    });
    it("Should be able set team reward fee", async () => {
      const {treasury} = await loadFixture(fixture);
      const teamRewardFee0: BigNumber = await treasury.teamRewardFee();
      await treasury.setTeamRewardFee(1);
      const teamRewardFee1: BigNumber = await treasury.teamRewardFee();
      expect(teamRewardFee1).to.not.be.equal(teamRewardFee0);
      expect(teamRewardFee1).to.be.equal(1);
    });
    it("Should be rejected when set fee greater 50%", async () => {
      const {treasury} = await loadFixture(fixture);
      await expect(treasury.setTeamRewardFee(6000)).to.be.rejected; // 60%
    });
  });
  describe("getMinters", () => {
    it("Should be able get minters", async () => {
      const {treasury, minterSigner} = await loadFixture(fixture);
      const minters: string[] = await treasury.getMinters();
      expect(minters).to.be.deep.equal([minterSigner.address]);
    });
  });
  describe("setMinters", () => {
    it("Should be possible call the method only the owner", async () => {
      const {treasury} = await loadFixture(fixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).setMinters([owner.address])).to.be.rejected;
      await expect(treasury.connect(owner).setMinters([owner.address])).to.be.not.rejected;
    });
    it("Should be able set minters", async () => {
      const {treasury, minterSigner} = await loadFixture(fixture);
      const [owner, otherSigner] = await ethers.getSigners();
      const minters0: string[] = await treasury.getMinters();
      await treasury.setMinters([owner.address, otherSigner.address]);
      const minters1: string[] = await treasury.getMinters();
      expect(minters1).to.not.be.deep.equal(minters0);
      expect(minters1).to.be.deep.equal([owner.address, otherSigner.address]);
    });
  });
  describe("setIncentivesController", () => {
    it("Should be possible call the method only the owner", async () => {
      const {treasury} = await loadFixture(fixture);
      const [owner, notOwner] = await ethers.getSigners();
      await expect(treasury.connect(notOwner).setIncentivesController(owner.address)).to.be.rejected;
      await expect(treasury.connect(owner).setIncentivesController(owner.address)).to.be.not.rejected;
    });
    it("Should be able set incentives controller", async () => {
      const {treasury} = await loadFixture(fixture);
      const [, otherSigner] = await ethers.getSigners();
      const incentivesController0: string = await treasury.incentivesController();
      await treasury.setIncentivesController(otherSigner.address);
      const incentivesController1: string = await treasury.incentivesController();
      expect(incentivesController1).to.not.be.equal(incentivesController0);
      expect(incentivesController1).to.be.equal(otherSigner.address);
    });
    it("Should be rejected when set zero address", async () => {
      const {treasury} = await loadFixture(fixture);
      await expect(treasury.setIncentivesController(ethers.constants.AddressZero)).to.be.rejectedWith("zero address");
    });
  });
  describe("kick", () => {
    it("Should be able to kick if public exit are set", async () => {
      const {treasury} = await loadFixture(fixture);
      const [, account] = await ethers.getSigners();
      await expect(treasury.kick([account.address])).to.be.rejectedWith("public exit not set");
      await treasury.publicExit();
      await expect(treasury.kick([account.address])).to.be.not.rejected;
    });
    it("Should be reverted if called not owner", async () => {
      const {treasury} = await loadFixture(fixture);
      const [owner, notOwner, account] = await ethers.getSigners();
      await treasury.publicExit();
      await expect(treasury.connect(notOwner).kick([account.address])).to.be.rejectedWith(
        "Ownable: caller is not the owner"
      );
      await expect(treasury.connect(owner).kick([account.address])).to.be.not.rejected;
    });
    it("Should be reverted if users any address equal zero", async () => {
      const {treasury} = await loadFixture(fixture);
      await treasury.publicExit();
      await expect(treasury.kick([ethers.constants.AddressZero])).to.be.rejectedWith("user zero address");
    });
    it("Should be nft balance change after kicked", async () => {
      const {treasury, nft} = await loadFixture(fixture);
      const [, recipient] = await ethers.getSigners();
      const params: UniswapNFTMock.MintParamsStruct = {
        recipient: recipient.address,
        token0: POSITION_CONFIG.token0,
        token1: POSITION_CONFIG.token1,
        fee: POSITION_CONFIG.fee,
        tickLower: POSITION_CONFIG.tickLower,
        tickUpper: POSITION_CONFIG.tickUpper,
        liquidity: 100,
      };
      await nft.mint(params);
      const nftId: BigNumber = await nft.tokenOfOwnerByIndex(recipient.address, 0);
      await nft.connect(recipient).approve(treasury.address, nftId);
      await treasury.connect(recipient).lock([nftId]);
      const nftBalanceBefore: BigNumber = await nft.balanceOf(recipient.address);
      await treasury.publicExit();
      await treasury.kick([recipient.address]);
      const nftBalanceAfter: BigNumber = await nft.balanceOf(recipient.address);
      expect(nftBalanceBefore).to.be.equal(0);
      expect(nftBalanceAfter).to.be.equal(1);
    });
  });
});
