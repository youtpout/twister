// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import 'poseidon-solidity/PoseidonT3.sol';

// From a popular climatic event
contract MerkleTreeWithHistory {
    uint32 public levels;

    // the following variables are made public for easier testing and debugging and
    // are not supposed to be accessed in regular code

    // filledSubtrees and roots could be bytes32[size], but using mappings makes it cheaper because
    // it removes index range check on every interaction
    mapping(uint256 => bytes32) public filledSubtrees;
    mapping(uint256 => bytes32) public roots;
    uint32 public constant ROOT_HISTORY_SIZE = 30;
    uint32 public currentRootIndex = 0;
    uint32 public nextIndex = 0;

    constructor(uint32 _levels) {
        require(_levels > 0, '_levels should be greater than zero');
        require(_levels < 16, '_levels should be less than 16');
        levels = _levels;

        for (uint32 i = 0; i < _levels; i++) {
            filledSubtrees[i] = zeros(i);
        }

        roots[0] = zeros(_levels - 1);
    }

    /**
    @dev Hash 2 tree leaves
    */
    function hashLeftRight(bytes32 _left, bytes32 _right) public pure returns (bytes32 value) {
        value = bytes32(PoseidonT3.hash([uint256(_left), uint256(_right)]));
    }

    function _insert(bytes32 _leaf) internal returns (uint32 index) {
        uint32 _nextIndex = nextIndex;
        require(
            _nextIndex != uint32(2) ** levels,
            'Merkle tree is full. No more leaves can be added'
        );
        uint32 currentIndex = _nextIndex;
        bytes32 currentLevelHash = _leaf;
        bytes32 left;
        bytes32 right;

        for (uint32 i = 0; i < levels; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = zeros(i);
                filledSubtrees[i] = currentLevelHash;
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = hashLeftRight(left, right);
            currentIndex /= 2;
        }

        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        roots[newRootIndex] = currentLevelHash;
        nextIndex = _nextIndex + 1;
        return _nextIndex;
    }

    /**
    @dev Whether the root is present in the root history
  */
    function isKnownRoot(bytes32 _root) public view returns (bool) {
        if (_root == 0) {
            return false;
        }
        uint32 _currentRootIndex = currentRootIndex;
        uint32 i = _currentRootIndex;
        do {
            if (_root == roots[i]) {
                return true;
            }
            if (i == 0) {
                i = ROOT_HISTORY_SIZE;
            }
            i--;
        } while (i != _currentRootIndex);
        return false;
    }

    /**
    @dev Returns the last root
  */
    function getLastRoot() public view returns (bytes32) {
        return roots[currentRootIndex];
    }

    /// @dev provides Zero (Empty) elements for a poseidon MerkleTree. Up to 16 levels
    function zeros(uint256 i) public pure returns (bytes32) {
        if (i == 0) return bytes32(0);
        else if (i == 1)
            return bytes32(0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864);
        else if (i == 2)
            return bytes32(0x1069673dcdb12263df301a6ff584a7ec261a44cb9dc68df067a4774460b1f1e1);
        else if (i == 3)
            return bytes32(0x18f43331537ee2af2e3d758d50f72106467c6eea50371dd528d57eb2b856d238);
        else if (i == 4)
            return bytes32(0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a);
        else if (i == 5)
            return bytes32(0x2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f55);
        else if (i == 6)
            return bytes32(0x2dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78);
        else if (i == 7)
            return bytes32(0x078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d);
        else if (i == 8)
            return bytes32(0x2fa5e5f18f6027a6501bec864564472a616b2e274a41211a444cbe3a99f3cc61);
        else if (i == 9)
            return bytes32(0x0e884376d0d8fd21ecb780389e941f66e45e7acce3e228ab3e2156a614fcd747);
        else if (i == 10)
            return bytes32(0x1b7201da72494f1e28717ad1a52eb469f95892f957713533de6175e5da190af2);
        else if (i == 11)
            return bytes32(0x1f8d8822725e36385200c0b201249819a6e6e1e4650808b5bebc6bface7d7636);
        else if (i == 12)
            return bytes32(0x2c5d82f66c914bafb9701589ba8cfcfb6162b0a12acf88a8d0879a0471b5f85a);
        else if (i == 13)
            return bytes32(0x14c54148a0940bb820957f5adf3fa1134ef5c4aaa113f4646458f270e0bfbfd0);
        else if (i == 14)
            return bytes32(0x190d33b12f986f961e10c0ee44d8b9af11be25588cad89d416118e4bf4ebe80c);
        else if (i == 15)
            return bytes32(0x2a7c7c9b6ce5880b9f6f228d72bf6a575a526f29c66ecceef8b753d38bba7323);
        else revert('Index out of bounds');
    }
}
