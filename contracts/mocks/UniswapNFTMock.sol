// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {IUniswapV3PositionManager} from "../interfaces/IUniswapV3PositionManager.sol";

contract UniswapNFTMock is IUniswapV3PositionManager, ERC721, ERC721Enumerable {

  struct MintParams {
    address recipient;
    address token0;
    address token1;
    uint24 fee;
    int24 tickLower;
    int24 tickUpper;
    uint128 liquidity;
  }

  // details about the uniswap position
  struct Position {
    address token0;
    address token1;
    uint24 fee;
    // the tick range of the position
    int24 tickLower;
    int24 tickUpper;
    // the liquidity of the position
    uint128 liquidity;
  }


  /// @dev The token ID position data
  mapping(uint256 => Position) private _positions;
  /// @dev The ID of the next token that will be minted. Skips 0
  uint176 private nextId = 1;

  constructor() ERC721("Uniswap NFT", "UNFT") {}

  function mint(MintParams calldata params) external returns (uint256 tokenId) {
    _mint(params.recipient, (tokenId = nextId++));
    _positions[tokenId] = Position({
      token0: params.token0,
      token1: params.token1,
      fee: params.fee,
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      liquidity: params.liquidity
    });
  }

  function positions(uint256 tokenId) external view
    returns (
      uint96 nonce,
      address operator,
      address token0,
      address token1,
      uint24 fee,
      int24 tickLower,
      int24 tickUpper,
      uint128 liquidity,
      uint256 feeGrowthInside0LastX128,
      uint256 feeGrowthInside1LastX128,
      uint128 tokensOwed0,
      uint128 tokensOwed1
    )
  {
    Position memory position = _positions[tokenId];
    return (
      0,
      address(0),
      position.token0,
      position.token1,
      position.fee,
      position.tickLower,
      position.tickUpper,
      position.liquidity,
      0,
      0,
      0,
      0
    );
  }

  function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
    internal
    override(ERC721, ERC721Enumerable)
  {
    super._beforeTokenTransfer(from, to, tokenId, batchSize);
  }

  function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC721, ERC721Enumerable)
    returns (bool)
  {
    return super.supportsInterface(interfaceId);
  }
}