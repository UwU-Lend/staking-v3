// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MultiFeeDistributionMock {
  IERC20 public immutable rewardToken;

  constructor(IERC20 _rewardToken) {
    rewardToken = _rewardToken;
  }

  function mint(address user, uint amount) external {
    rewardToken.transfer(user, amount);
  }
}
