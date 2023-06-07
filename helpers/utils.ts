import { HardhatRuntimeEnvironment } from "hardhat/types";
import fs from "node:fs";
import path from "node:path";

let HRE: HardhatRuntimeEnvironment;

export const setHRE = (_hre: HardhatRuntimeEnvironment) => {
  HRE = _hre;
}

export const getHRE = (): HardhatRuntimeEnvironment => HRE;

export const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []) => {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  })
  return arrayOfFiles
};