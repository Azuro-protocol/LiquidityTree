// SPDX-License-Identifier: MIT

pragma solidity 0.8.27;

import "../LiquidityTree.sol";
import "../interface/ILiquidityTree.sol";

interface ILiquidityProtocol is ILiquidityTree {}

contract LiquidityProtocol is LiquidityTree {
    constructor(
        uint48 liquidityNodes,
        bool dynamicSize
    ) LiquidityTree(liquidityNodes, dynamicSize) {}

    function add(uint128 amount) external {
        _add(amount);
    }

    function addLimit(uint128 amount, uint48 leaf) external {
        _addLimit(amount, leaf);
    }

    function nodeAddLiquidity(
        uint128 amount
    ) external returns (uint48 resNode) {
        return _nodeAddLiquidity(amount);
    }

    function nodeWithdraw(
        uint48 leaf
    ) external returns (uint128 withdrawAmount) {
        return _nodeWithdraw(leaf);
    }

    function nodeWithdrawPercent(
        uint48 leaf,
        uint40 percent
    ) external returns (uint128 withdrawAmount) {
        return _nodeWithdrawPercent(leaf, percent);
    }

    function remove(uint128 amount) external {
        _remove(amount);
    }

    function removeLimit(uint128 amount, uint48 leaf) external {
        _removeLimit(amount, leaf);
    }
}
