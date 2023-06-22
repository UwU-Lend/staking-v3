module.exports = {
  configureYulOptimizer: true,
  skipFiles: ['mocks/UniswapNFTMock.sol', 'mocks/MultiFeeDistributionMock.sol', 'mocks/OnwardIncentivesControllerMock.sol', 'MultiFeeDistributionV3.sol'],
}