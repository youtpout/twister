// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import 'forge-std/Test.sol';
import {console} from 'forge-std/console.sol';
import '../src/Twister.sol';
import '../src/PoseidonT3.sol';
import '../circuits/contract/noirstarter/plonk_vk.sol';
import './MerkleTest.sol';

contract TwisterTest is Test {
    Twister twister;
    bytes proofBytes;
    UltraVerifier public verifier;
    MerkleTest public merkleTest;

    function setUp() public {
        twister = new Twister();
        string memory proofFilePath = './circuits/proofs/noirstarter.proof';
        string memory proof = vm.readLine(proofFilePath);
        verifier = new UltraVerifier();
        merkleTest = new MerkleTest();

        proofBytes = vm.parseBytes(proof);
    }

    function testVerifier() public {
        bytes32 leaf = 0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf;
        bytes32 nullifier = 0x1e3c6527094f6f524dcf9a514f823f9c0cdd20fb7f879c7bdf58bd2e7d3e0656;

        bytes32[] memory _publicInputs = new bytes32[](7);

        _publicInputs[0] = leaf;
        _publicInputs[1] = bytes32(0);
        _publicInputs[2] = bytes32(0);
        _publicInputs[3] = bytes32(uint256(250000000000000000));
        _publicInputs[4] = bytes32(0);
        _publicInputs[5] = bytes32(0);
        _publicInputs[6] = bytes32(uint256(1));

        bool result = verifier.verify(proofBytes, _publicInputs);
    }

    function testDeposit() public {
        bytes32 root1 = twister.getLastRoot();
        console.log('before root');
        console.logBytes32(root1);

        bytes32 leaf = 0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf;
        bytes32 nullifier = 0x1e3c6527094f6f524dcf9a514f823f9c0cdd20fb7f879c7bdf58bd2e7d3e0656;

        twister.deposit{value: 0.25 ether}(leaf, proofBytes);

        bytes32 root = twister.getLastRoot();
        console.log('Last root');
        console.logBytes32(root);
    }

    function testMerkleZero() public {
        bytes32 root1 = merkleTest.getLastRoot();
        console.log('before root');
        console.logBytes32(root1);
        bytes32[] memory witnesses = getWitnesses();
        bytes32 calcRoot = computeRoot(bytes32(0), witnesses, 0);
        //assertEq(root1, calcRoot);

        merkleTest.insert(0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf);
        bytes32 root = merkleTest.getLastRoot();
        console.log('medium root');
        console.logBytes32(root);

        for (uint32 i = 0; i < 8; i++) {
            bytes32 t = merkleTest.filledSubtrees(i);
            console.log('subtrees');
            console.logBytes32(t);
        }

        merkleTest.insert(0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf);
        bytes32 root3 = merkleTest.getLastRoot();
        console.log('Last root');
        console.logBytes32(root3);

        console.log('---test');
        console.logBytes32(
            hashLeftRight(
                0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf,
                bytes32(0)
            )
        );
        console.logBytes32(
            hashLeftRight(
                0x2e49708d29134206c69d3e92d40707352af01bba15f6dc71fa4030550a4e0bab,
                0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864
            )
        );
    }

    function getWitnesses() private returns (bytes32[] memory witnesses) {
        witnesses = new bytes32[](7);
        for (uint256 i = 0; i < witnesses.length; i++) {
            witnesses[i] = merkleTest.zeros(i);
        }
    }

    function getWitnesses256(bytes32[] memory leafs) private returns (bytes32[] memory witnesses) {
        witnesses = new bytes32[](7);
        for (uint256 i = 0; i < witnesses.length; i++) {
            witnesses[i] = merkleTest.zeros(i);
        }
    }

    function computeRoot(
        bytes32 leaf,
        bytes32[] memory witnesses,
        uint256 index
    ) private returns (bytes32 current) {
        uint256 n = witnesses.length;
        uint256[] memory indexBits = new uint256[](256);
        uint256 k = 0;
        while (index > 0) {
            uint256 bit = index % 2;
            uint256 quotient = index / 2;
            indexBits[k] = bit;
            k++;
            index = quotient;
        }
        current = leaf;
        for (uint i = 0; i < n; i++) {
            uint256 pathBit = indexBits[i];
            if (pathBit == 0) {
                current = hashLeftRight(current, witnesses[i]);
            } else {
                current = hashLeftRight(witnesses[i], current);
            }
        }
    }

    function hashLeftRight(bytes32 _left, bytes32 _right) public pure returns (bytes32 value) {
        value = bytes32(PoseidonT3.hash([uint256(_left), uint256(_right)]));
    }
}
