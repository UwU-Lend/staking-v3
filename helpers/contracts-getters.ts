import { Contract, ContractFactory } from "ethers";

import { ContractId } from "../enums/contract-id.enum";
import JSONFile from "lowdb/adapters/FileSync";
import { getHRE } from "./utils";
import lowdb from "lowdb";
import path from "node:path";

export const getContractAt = async <T = Contract>(
  name: ContractId | string,
  address?: string
): Promise<T> => {
  const factory: ContractFactory = await getHRE().ethers.getContractFactory(`${name}`);
  return factory.attach(address || getDb().get(`${name}`).value()) as T;
};

export const getDb = () => {
  let networkName = getHRE().network.name;
  const file = path.resolve(".", "db", `${networkName}.json`);
  const adapter = new JSONFile(file);
  return lowdb(adapter);
};
