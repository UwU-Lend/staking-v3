import { IncentivesControllerV3, MultiFeeDistributionUNIV3POS } from "../typechain-types/contracts";

import { Contract } from "ethers";
import { ContractId } from "../enums/contract-id.enum";
import { deployAndSave } from "./contracts-helpers";

export const deployIncentivesController = async (
  poolConfigurator: string,
  rewardMinter: string,
  incentivesController: string
) =>
  deployAndSave<IncentivesControllerV3>(ContractId.IncentivesControllerV3, [
    poolConfigurator,
    rewardMinter,
    incentivesController,
  ]);

export const deployMultiFeeDistribution = async <T extends Contract>(
  nft: string,
  posConfig: MultiFeeDistributionUNIV3POS.PositionConfigStruct,
  rewardToken: string,
  rewardTokenVault: string,
) => deployAndSave<MultiFeeDistributionUNIV3POS>(ContractId.MultiFeeDistributionUNIV3POS, [nft, posConfig, rewardToken, rewardTokenVault]);
