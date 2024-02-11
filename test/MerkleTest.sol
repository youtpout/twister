// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '../src/MerkleTreeWithHistory.sol';

contract MerkleTest is MerkleTreeWithHistory {


    constructor() MerkleTreeWithHistory(2) {
    }

    function merkleLeaf(uint256 _index) external view returns (bytes32) {
        return filledSubtrees[_index];
    }

    function insert(bytes32 _commitment) external  {
       _insert(_commitment);
    }

}
