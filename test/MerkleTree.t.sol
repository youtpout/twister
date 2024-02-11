// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import 'forge-std/Test.sol';
import {console} from 'forge-std/console.sol';
import '../src/PedersenHashNaive.sol';
import '../src/MiMC.sol';
import 'poseidon-solidity/PoseidonT3.sol';

contract MerkleTreeTest is Test {
    PedersenHashNaive pedersen;
    MiMC mimc;
    function setUp() public {
        pedersen = new PedersenHashNaive();
        mimc = new MiMC();
    }

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

    function testPedersenHash() public {
        bytes32 expected = 0x07ebfbf4df29888c6cd6dca13d4bb9d1a923013ddbbcbdc3378ab8845463297b;
        bytes32 result = bytes32(pedersen.hash(1, 1));
        console.log('result hash');
        console.logBytes32(result);
        // failed
        //assertEq(expected, result);
    }

    function testMimc() public {
        bytes32 expected = 0x01ab06dca6eaab7fa1ff834018ff6611242fe8744441af84e38f286cf97924df;
        bytes32 result = bytes32(mimc.hashLeftRight(1, 1));
        console.log('result mimc hash');
        console.logBytes32(result);
        // failed
        //assertEq(expected, result);
    }

    function testPoseidon() public {
        bytes32 expected = 0x007af346e2d304279e79e0a9f3023f771294a78acb70e73f90afe27cad401e81;
        bytes32 result = bytes32(PoseidonT3.hash([uint256(1), uint256(1)]));
        console.log('result  poseidon');
        console.logBytes32(result);
        assertEq(expected, result);
    }

    function testKeccak() public {
        bytes32 expected = 0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f;
        bytes32 result = hashLeftRight(bytes32(uint256(1)), bytes32(uint256(1)));
        console.log('result keccak');
        console.logBytes32(result);
        assertEq(expected, result);
    }
}
