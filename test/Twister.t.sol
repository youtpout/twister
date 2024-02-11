// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import 'forge-std/Test.sol';
import {console} from 'forge-std/console.sol';
import '../src/Twister.sol';
import 'poseidon-solidity/PoseidonT3.sol';

contract MerkleTreeTest is Test {
    Twister twister;
    bytes proofBytes;
    function setUp() public {
        twister = new Twister();
        string memory proofFilePath = './circuits/proofs/noirstarter.proof';
        string memory proof = vm.readLine(proofFilePath);

        proofBytes = vm.parseBytes(proof);
    }

    function testDeposit() public {
        bytes32 leaf = 0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf;
        bytes32 nullifier = 0x1e3c6527094f6f524dcf9a514f823f9c0cdd20fb7f879c7bdf58bd2e7d3e0656;

        twister.deposit{value: 0.25 ether}(leaf, proofBytes);
    }
}
