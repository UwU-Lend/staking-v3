import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IERC20 } from "../typechain-types/contracts/interfaces/IERC20";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import erc20ABI from "../abi/erc20.json";

export type TokensAddresses = {
  uwu: string;
  dai: string;
  frax: string;
  weth: string;
  wbtc: string;
  sifu: string;
  mim: string;
  lusd: string;
  sspell: string;
  crv: string;
  wmemo: string;
  usdt: string;
  sifum: string;
  blusd: string;
};

const tokensDecimals: Record<keyof TokensAddresses, number> = {
  uwu: 18,
  dai: 18,
  frax: 18,
  weth: 18,
  wbtc: 8,
  sifu: 18,
  mim: 18,
  lusd: 18,
  sspell: 18,
  crv: 18,
  wmemo: 18,
  usdt: 6,
  sifum: 18,
  blusd: 18,
}

export const getTokensDecimals = async (hre: HardhatRuntimeEnvironment): Promise<Record<keyof TokensAddresses, number>>  => tokensDecimals;

const tokensAddresses: TokensAddresses = {
  uwu: '0x55C08ca52497e2f1534B59E2917BF524D4765257',
  dai: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  frax: '0x853d955aCEf822Db058eb8505911ED77F175b99e',
  weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  wbtc: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  sifu: '0x29127fE04ffa4c32AcAC0fFe17280ABD74eAC313',
  mim: '0x99D8a9C45b2ecA8864373A26D1459e3Dff1e17F3',
  lusd: '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0',
  sspell: '0x26FA3fFFB6EfE8c1E69103aCb4044C26B9A106a9',
  crv: '0xD533a949740bb3306d119CC777fa900bA034cd52',
  wmemo: '0x3b79a28264fC52c7b4CEA90558AA0B162f7Faf57',
  usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  sifum: '0x5938999Dd0cC4d480c3B1a451AECc78aE4dDaab5',
  blusd: '0xB9D7DdDca9a4AC480991865EfEf82E01273F79C3',
};

export type TokensContracts = {
  uwu: IERC20;
  dai: IERC20;
  frax: IERC20;
  weth: IERC20;
  wbtc: IERC20;
  sifu: IERC20;
  mim: IERC20;
  lusd: IERC20;
  sspell: IERC20;
  crv: IERC20;
  wmemo: IERC20;
  usdt: IERC20;
  sifum: IERC20;
  blusd: IERC20;
};

export const getTokensContracts = async (hre: HardhatRuntimeEnvironment): Promise<TokensContracts> => {
  const uwu = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.uwu) as IERC20;
  const dai = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.dai) as IERC20;
  const frax = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.frax) as IERC20;
  const weth = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.weth) as IERC20;
  const wbtc = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.wbtc) as IERC20;
  const sifu = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.sifu) as IERC20;
  const mim = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.mim) as IERC20;
  const lusd = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.lusd) as IERC20;
  const sspell = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.sspell) as IERC20;
  const crv = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.crv) as IERC20;
  const wmemo = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.wmemo) as IERC20;
  const usdt = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.usdt) as IERC20;
  const sifum = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.sifum) as IERC20;
  const blusd = await hre.ethers.getContractAt(erc20ABI, tokensAddresses.blusd) as IERC20;

  return { uwu, dai, frax, weth, wbtc, sifu, mim, lusd, sspell, crv, wmemo, usdt, sifum, blusd };
}

export type TokensHolders = {
  uwu: SignerWithAddress;
  dai: SignerWithAddress;
  frax: SignerWithAddress;
  weth: SignerWithAddress;
  wbtc: SignerWithAddress;
  sifu: SignerWithAddress;
  mim: SignerWithAddress;
  lusd: SignerWithAddress;
  sspell: SignerWithAddress;
  crv: SignerWithAddress;
  wmemo: SignerWithAddress;
  usdt: SignerWithAddress;
  sifum: SignerWithAddress;
  blusd: SignerWithAddress;
};

export const getTokensHolders = async (hre: HardhatRuntimeEnvironment): Promise<TokensHolders> => {
  const uwu: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0xC671A6B1415dE6549B05775Ee4156074731190c6');
  const dai: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643');
  const frax: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2');
  const weth: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0xF04a5cC80B1E94C69B48f5ee68a08CD2F09A7c3E');
  const wbtc: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0xBF72Da2Bd84c5170618Fbe5914B0ECA9638d5eb5');
  const sifu: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0xCD18eAa163733Da39c232722cBC4E8940b1D8888');
  const mim: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0xbbc4A8d076F4B1888fec42581B6fc58d242CF2D5');
  const lusd: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0x66017D22b0f8556afDd19FC67041899Eb65a21bb');
  const sspell: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0xF5BCE5077908a1b7370B9ae04AdC565EBd643966')
  const crv: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2');
  const wmemo: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0x4594910245b585a90003AD2DD7445Ff2f3F84BE2');
  const usdt: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0x5041ed759Dd4aFc3a72b8192C143F72f4724081A');
  const sifum: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0x5DD596C901987A2b28C38A9C1DfBf86fFFc15d77');
  const blusd: SignerWithAddress = await hre.ethers.getImpersonatedSigner('0x74ED5d42203806c8CDCf2F04Ca5F60DC777b901c');
  
  await hre.ethers.provider.send("hardhat_setBalance", [uwu.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [dai.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [frax.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [weth.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [wbtc.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [sifu.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [mim.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [lusd.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [sspell.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [crv.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [wmemo.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [usdt.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [sifum.address, BigNumber.from('1000000000000000000000').toHexString()]);
  await hre.ethers.provider.send("hardhat_setBalance", [blusd.address, BigNumber.from('1000000000000000000000').toHexString()]);

  return { uwu, dai, frax, weth, wbtc, sifu, mim, lusd, sspell, crv, wmemo, usdt, sifum, blusd };
}