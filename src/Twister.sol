// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '../circuits/contract/noirstarter/plonk_vk.sol';
import './MerkleTreeWithHistory.sol';
import 'forge-std/Test.sol';

contract Twister is MerkleTreeWithHistory {
    uint256 constant FEE = 0.0005 ether;
    uint256 constant MIN_AMOUNT = 0.001 ether;

    mapping(bytes32 => bool) public nullifierHashes;
    // we store all commitments just to prevent accidental deposits with the same commitment
    mapping(bytes32 => bool) public commitments;
    UltraVerifier public verifier;
    uint32 unlocked;

    event Deposit(
        address indexed depositor,
        bytes32 indexed commitment,
        uint32 leafIndex,
        uint256 timestamp
    );
    event Withdrawal(address indexed to, bytes32 indexed commitment, uint32 leafIndex);

    error Locked();

    // reentrancy guard
    modifier lock() {
        if (unlocked == 0) {
            revert Locked();
        }
        unlocked = 0;
        _;
        unlocked = 1;
    }

    constructor() MerkleTreeWithHistory(8) {
        verifier = new UltraVerifier();
        unlocked = 1;
    }

    function merkleLeaf(uint256 _index) external view returns (bytes32) {
        return filledSubtrees[_index];
    }

    function deposit(bytes32 _commitment, bytes calldata _proof) external payable lock {
        console.log('deposit %s', msg.value);
        // console.logBytes32(_commitment);
        // console.logBytes(_proof);
        require(msg.value >= MIN_AMOUNT && (msg.value % MIN_AMOUNT) == 0, 'INCORRECT_AMOUNT');
        require(!commitments[_commitment], 'The commitment has been submitted');
        require(_commitment != bytes32(uint256(0)), 'The commitment cant be empty');
        commitments[_commitment] = true;
        bytes32[] memory _publicInputs = new bytes32[](7);

        _publicInputs[0] = _commitment;
        _publicInputs[1] = bytes32(0);
        _publicInputs[2] = bytes32(0);
        _publicInputs[3] = bytes32(msg.value);
        _publicInputs[4] = bytes32(0);
        _publicInputs[5] = bytes32(0);
        _publicInputs[6] = bytes32(uint256(1));

        // need to prove we deposit the correct amount
        require(verifier.verify(_proof, _publicInputs), 'INVALID_PROOF_DEPOSIT');
        uint32 insertedIndex = _insert(_commitment);
        emit Deposit(msg.sender, _commitment, insertedIndex, block.timestamp);
    }

    function withdraw(
        bytes32 _nullifierHash,
        // the new leaf added not the old one executed
        bytes32 _commitment,
        bytes32 _root,
        address _receiver,
        address _relayer,
        uint256 _amount,
        bytes calldata _proof,
        bytes calldata _execution
    ) external lock {
        console.log('withdraw');
        require(_amount >= MIN_AMOUNT && (_amount % MIN_AMOUNT) == 0, 'INCORRECT_AMOUNT');
        require(!commitments[_commitment], 'The commitment has been submitted');
        require(!nullifierHashes[_nullifierHash], 'The note has been already spent');
        require(isKnownRoot(_root), 'Cannot find your merkle root'); // Make sure to use a recent one

        require(_receiver != address(0), 'NO_RECEIVER');
        require(_relayer != address(0), 'NO_RELAYER');
        require(_receiver != address(this), 'BAD_RECEIVER');

        nullifierHashes[_nullifierHash] = true;
        commitments[_commitment] = true;

        bytes32[] memory _publicInputs = new bytes32[](7);

        _publicInputs[0] = _commitment;
        _publicInputs[1] = _root;
        _publicInputs[2] = _nullifierHash;
        _publicInputs[3] = bytes32(_amount);
        _publicInputs[4] = bytes32(uint256(uint160(_receiver)));
        _publicInputs[5] = bytes32(uint256(uint160(_relayer)));
        _publicInputs[6] = bytes32(0);

        require(verifier.verify(_proof, _publicInputs), 'INVALID_PROOF_WITHDRAW');

        uint256 amount = _amount;
        if (_relayer != _receiver) {
            amount -= FEE;
            (bool relayerPayed, ) = payable(_relayer).call{value: FEE}('');
            require(relayerPayed, 'relayer payed');
        }

        // possibility to execute smartcontract like swap
        (bool payed, ) = payable(_receiver).call{value: amount}(_execution);
        require(payed, 'user payed');
        uint32 insertedIndex = _insert(_commitment);
        emit Withdrawal(_receiver, _commitment, insertedIndex);
    }
}
