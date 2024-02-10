// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import 'forge-std/Test.sol';
import {console} from 'forge-std/console.sol';

contract MerkleTreeTest is Test {
    function setUp() public {}

    function testMerkleTreeZero() public {

        bytes32 value = bytes32(uint256(0));
        for (uint256 index = 0; index < 16; index++) {
            value = hashLeftRight(value, value);
            console.log('result hash');
            console.logBytes32(value);
        }
    }

    function hashLeftRight(bytes32 _left, bytes32 _right) public pure returns (bytes32 value) {
        assembly {
            mstore(0x00, _left)
            mstore(0x20, _right)
            value := keccak256(0x00, 0x40)
        }
    }
}
