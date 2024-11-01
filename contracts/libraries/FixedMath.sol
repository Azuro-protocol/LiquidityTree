// SPDX-License-Identifier: MIT

pragma solidity 0.8.27;

/// @title Fixed-point math tools
library FixedMath {
    uint256 constant ONE = 1e12;

    function mul(uint256 self, uint256 other) internal pure returns (uint256) {
        return (self * other) / ONE;
    }

    function div(uint256 self, uint256 other) internal pure returns (uint256) {
        return (self * ONE) / other;
    }
}
