// SPDX-License-Identifier: MIT

pragma solidity 0.8.27;

interface ILiquidityTree {
    function nodeWithdrawView(
        uint48 leaf
    ) external view returns (uint128 withdrawAmount);
}
