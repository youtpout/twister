// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../circuits/contract/noirstarter/plonk_vk.sol";

contract Twister {
    uint256 index = 0;
    bytes32 root;
    mapping(uint256 => bytes32) leafs;
    mapping(bytes32 => bool) leafExist;
    mapping(address => uint256) daggersPossessed;
    mapping(bytes32 => bool) used;
    UltraVerifier public verifier;

    constructor() {
        verifier = new UltraVerifier();
    }

    function merkleLeaf(uint256 _index) external view returns (bytes32) {
        return leafs[_index];
    }

    function merkleRoot() external view returns (bytes32) {
        return root;
    }


    function deposit(bytes32 _merkleLeaf) external payable {
        require(!leafExist[_merkleLeaf], "LEAF_EXIST");
        leafs[index] = _merkleLeaf;
        leafExist[_merkleLeaf] = true;
        index++;
        computeRoot();
    }

    function computeRoot() private {
        bytes32 a = _hashPair(leafs[0], leafs[1]);
        bytes32 b = _hashPair(leafs[2], leafs[3]);
        bytes32 c = _hashPair(leafs[4], leafs[5]);
        bytes32 d = _hashPair(leafs[6], leafs[7]);
        bytes32 e = _hashPair(a, b);
        bytes32 f = _hashPair(c, d);
        root = _hashPair(e, f);
    }

    function withdraw(bytes32 _nullifier, bytes32 _merkleLeaf, uint256 amount, bytes calldata _proof) external {
        require(!used[_nullifier], "REPLAYED_NULLIFIER");
        require(!leafExist[_merkleLeaf], "LEAF_EXIST");
        leafs[index] = _merkleLeaf;
        leafExist[_merkleLeaf] = true;
        index++;

        bytes32[] memory _publicInputs = new bytes32[](2);
        
        _publicInputs[0] = root;
        _publicInputs[1] = _nullifier;

        try verifier.verify(_proof, _publicInputs) returns (bool success) {
            require(success, "INVALID_PROOF");
            used[_nullifier] = true;
            (bool payed, ) = payable(msg.sender).call{ value: amount}("");
            require(payed, "user payed");
        } catch {
            revert("INVALID_PROOF");
        }
    }

    function _hashPair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return _efficientHash(a, b);
    }

    function _efficientHash(
        bytes32 a,
        bytes32 b
    ) private pure returns (bytes32 value) {
        assembly {
            mstore(0x00, a)
            mstore(0x20, b)
            value := keccak256(0x00, 0x40)
        }
    }
}
