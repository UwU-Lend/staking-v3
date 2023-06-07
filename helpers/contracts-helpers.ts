import { Contract, ContractFactory, ContractReceipt, ContractTransaction } from "ethers";

import { ContractId } from "../enums/contract-id.enum";
import chalk from "chalk";
import { ethers } from "hardhat";
import fs from "node:fs";
import { getDb } from "./contracts-getters";
import { getHRE } from "./utils";
import path from "node:path";

export const saveInDb = async (id: string, address: string) => {
  getDb().set(`${id}`, address).write();
}

export const saveVerifyArgs = async (id: string, args: (string | string[])[]) => {
  const dirPath: string = path.resolve(__dirname, '..', 'verify', getHRE().network.name);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(
    path.resolve(dirPath, `${id}.args.js`),
    `module.exports = ${JSON.stringify(args, null, 2)};`,
  );
}

export const saveVerifyLibs = async (id: string, libs: Record<string, string> = {}) => {
  const dirPath: string = path.resolve(__dirname, '..', 'verify', getHRE().network.name);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(
    path.resolve(dirPath, `${id}.libs.js`),
    `module.exports = ${JSON.stringify(libs, null, 2)};`,
  );
}

export const waitTx = async (tx: ContractTransaction): Promise<ContractReceipt> => {
  return await tx.wait();
};

export const deployAndSave = async <T extends Contract>(
  name: (ContractId | string),
  args: any[],
  verbose: boolean = true,
): Promise<T> => {
  const factory: ContractFactory = await getHRE().ethers.getContractFactory(`${name}`);
  const contract: Contract = await factory.deploy(...args);
  verbose ? console.log(chalk.cyan('Deploying'), chalk.yellow(name), chalk.cyan('in tx:'), chalk.gray(contract.deployTransaction.hash)) : null;
  const receipt: ContractReceipt = await waitTx(contract.deployTransaction);
  await saveInDb(`${name}`, contract.address);
  await saveVerifyArgs(`${name}`, args);
  verbose ? console.log(chalk.green(`Deployed ${chalk.yellow(name)} at ${chalk.white(contract.address)} in ${chalk.blue(receipt.gasUsed.toString())} gas (${chalk.green(getHRE().ethers.utils.formatEther(receipt.effectiveGasPrice.mul(receipt.gasUsed)))} ETH)`)) : null;
  return contract as T;
};