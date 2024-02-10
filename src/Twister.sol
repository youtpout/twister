// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import '../circuits/contract/noirstarter/plonk_vk.sol';
import './MerkleTreeWithHistory.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

contract Twister is MerkleTreeWithHistory, ReentrancyGuard {
    uint256 constant FEE = 0.0005 ether;
    uint256 constant MIN_AMOUNT = 0.001 ether;
    uint256 constant DEPTH = 8;

    uint256 index = 0;
    bytes32 root;
    mapping(uint256 => bytes32) leafs;
    mapping(bytes32 => bool) leafExist;
    mapping(bytes32 => bool) commitmentUsed;
    UltraVerifier public verifier;

    constructor() MerkleTreeWithHistory(16) {
        verifier = new UltraVerifier();
    }

    function merkleLeaf(uint256 _index) external view returns (bytes32) {
        return leafs[_index];
    }

    function merkleRoot() external view returns (bytes32) {
        return root;
    }

    function deposit(bytes32 _merkleLeaf, bytes calldata _proof) external payable nonReentrant {
        require(msg.value >= MIN_AMOUNT && (msg.value % MIN_AMOUNT) == 0, 'INCORRECT_AMOUNT');
        require(!leafExist[_merkleLeaf], 'LEAF_EXIST');
        leafs[index] = _merkleLeaf;
        leafExist[_merkleLeaf] = true;
        index++;
        bytes32[] memory _publicInputs = new bytes32[](2);

        _publicInputs[0] = _merkleLeaf;
        _publicInputs[1] = bytes32(0);
        _publicInputs[2] = bytes32(0);
        _publicInputs[3] = bytes32(msg.value);
        _publicInputs[4] = bytes32(0);
        _publicInputs[5] = bytes32(0);
        _publicInputs[6] = bytes32(uint256(1));

        // need to prove we deposit the correct amount
        try verifier.verify(_proof, _publicInputs) returns (bool success) {
            require(success, 'INVALID_PROOF');
            _insert(_merkleLeaf);
        } catch {
            revert('INVALID_PROOF');
        }
    }

    function withdraw(
        bytes32 _nullifier,
        // the new leaf added not the old one executed
        bytes32 _merkleLeaf,
        bytes32 _merkleRoot,
        address _receiver,
        address _relayer,
        uint256 _amount,
        bytes calldata _proof,
        bytes calldata _execution
    ) external nonReentrant {
        require(_amount >= MIN_AMOUNT && (_amount % MIN_AMOUNT) == 0, 'INCORRECT_AMOUNT');
        require(!commitmentUsed[_nullifier], 'REPLAYED_NULLIFIER');
        require(!leafExist[_merkleLeaf], 'LEAF_EXIST');
        require(_receiver != address(0), 'NO_RECEIVER');
        require(_relayer != address(0), 'NO_RELAYER');
        require(_receiver != address(this), 'BAD_RECEIVER');

        leafs[index] = _merkleLeaf;
        leafExist[_merkleLeaf] = true;
        index++;

        bytes32[] memory _publicInputs = new bytes32[](2);

        _publicInputs[0] = _merkleLeaf;
        _publicInputs[1] = _merkleRoot;
        _publicInputs[2] = _nullifier;
        _publicInputs[3] = bytes32(_amount);
        _publicInputs[4] = bytes32(uint256(uint160(_receiver)));
        _publicInputs[5] = bytes32(uint256(uint160(_relayer)));
        _publicInputs[6] = bytes32(0);

        try verifier.verify(_proof, _publicInputs) returns (bool success) {
            require(success, 'INVALID_PROOF');
            commitmentUsed[_nullifier] = true;
            uint256 amount = _amount;
            if (_relayer != _receiver) {
                amount -= FEE;
                (bool relayerPayed, ) = payable(_relayer).call{value: FEE}('');
                require(relayerPayed, 'relayer payed');
            }

            // possibility to execute smartcontract like swap
            (bool payed, ) = payable(msg.sender).call{value: amount}(_execution);
            require(payed, 'user payed');
            _insert(_merkleLeaf);
        } catch {
            revert('INVALID_PROOF');
        }
    }
}
