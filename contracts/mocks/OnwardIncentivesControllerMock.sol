// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IOnwardIncentivesController} from "../interfaces/IOnwardIncentivesController.sol";

contract OnwardIncentivesController is IOnwardIncentivesController {
  struct HandleActionCall {
    address token;
    address user;
    uint256 balance;
    uint256 totalSupply;
  }
  HandleActionCall public lastCall;
  function handleAction(address _token, address _user, uint256 _balance, uint256 _totalSupply) external {
    lastCall = HandleActionCall(_token, _user, _balance, _totalSupply);
  }
}