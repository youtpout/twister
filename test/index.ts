import { expect } from 'chai';
import hre from 'hardhat';
import { Buffer } from 'buffer';
import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { compile, createFileManager } from '@noir-lang/noir_wasm';
import { join } from 'path';
import { ProofData } from '@noir-lang/types';
import { readFileSync } from 'fs';
import { MerkleTree } from 'merkletreejs';
import { buildPoseidon } from "circomlibjs";
import { Twister__factory } from "../typechain-types/index.js";

const getCircuit = async (name: string) => {
  const sourcePath = new URL('../circuits/', import.meta.url);
  let fm = createFileManager(sourcePath.pathname);
  const compiled = compile(fm);
  return compiled;
};


const getCircuitGenerator = async (name: string) => {
  const sourcePath = new URL('../generator/', import.meta.url);
  let fm = createFileManager(sourcePath.pathname);
  const compiled = compile(fm);
  return compiled;
};



describe('It compiles noir program code, receiving circuit bytes and abi object.', () => {
  let noir: Noir;
  let noirGenerator: Noir;
  let correctProof: ProofData;
  let verifierContract: Twister;
  let witnessMerkle;
  let poseidon;

  before(async () => {
    const compiled = await getCircuit('main');
    const compiledGenerator = await getCircuitGenerator('main');

    const UltraVerifier = await hre.ethers.getContractFactory("Twister");
    const deployed = await UltraVerifier.deploy();
    verifierContract = deployed as any as Twister;
    console.log(`Verifier deployed to ${deployed.address}`);

    // @ts-ignore
    const backend = new BarretenbergBackend(compiled.program);
    // @ts-ignore
    noir = new Noir(compiled.program, backend);

    // @ts-ignore
    const backendGenerator = new BarretenbergBackend(compiledGenerator.program);
    // @ts-ignore
    noirGenerator = new Noir(compiledGenerator.program, backendGenerator);

    poseidon = await buildPoseidon();
  });

  function bufferToBigInt(buffer, start = 0, end = buffer.length) {
    const bufferAsHexString = buffer.slice(start, end).toString("hex");
    return BigInt(`0x${bufferAsHexString}`);
  }

  // function to use poseidon hash wirh merkletreejs
  const fnHash = (x: Buffer[]) => {
    //console.log("x", x);
    const hash = poseidon.F.toString(poseidon([...x]));
    const res = "0x" + BigInt(hash).toString(16).padStart(64, 0);
    //console.log("res", res);
    return res;
  };

  const fnConc = (x: Buffer[]) => {
    const hexa = x.map(z => {
      if (z.indexOf('0x') > -1) {
        return z;
      }
      return bufferToBigInt(z);
    })
    return hexa;
  };

  async function getProofInfo(secret: any, amount: any): Promise<{ leaf: any, nullifier: any }> {
    const poseidon = await buildPoseidon();
    const hash = poseidon.F.toString(poseidon([secret, amount]));
    const leaf = "0x" + BigInt(hash).toString(16);
    const hashN = poseidon.F.toString(poseidon([amount, secret]));
    const nullifier = "0x" + BigInt(hashN).toString(16);
    return { leaf, nullifier };
  }

  it('Should generate valid merkle', async () => {
    const hash = poseidon.F.toString(poseidon([1, 250000000000000000]));
    console.log("hash", "0x" + BigInt(hash).toString(16));

    const hash2 = poseidon.F.toString(poseidon([0, 0]));
    console.log("hash2", "0x" + BigInt(hash2).toString(16));

    const hashw = poseidon.F.toString(poseidon([1, 150000000000000000]));
    console.log("leaf withdraw", "0x" + BigInt(hashw).toString(16));



    const merkleLeaf = Array(256).fill(0);
    merkleLeaf[0] = "0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf";
    const merkleTree = new MerkleTree(merkleLeaf, fnHash, {
      sort: false,
      hashLeaves: false,
      sortPairs: false,
      sortLeaves: false,
      concatenator: fnConc
    });
    const root = merkleTree.getHexRoot();
    witnessMerkle = merkleTree.getHexProof("0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf");
    console.log("root", root);
    console.log("witness", witnessMerkle.map(x => BigInt(x)));
  });

  it('Should generate valid proof for correct input', async () => {


    // get result from proof (leaf,nullifier)
    let inputGenerate = {
      secret: 1,
      amount: 250000000000000000
    }
    const { witness, returnValue } = await noirGenerator.execute(inputGenerate);
    console.log("returnValue", returnValue);

    // var bn = BigInt(returnValue[0]);
    // var d = bn.toString(10);
    // console.log("decimal", d);

    let input = {
      secret: 1,
      oldAmount: 250000000000000000,
      witnesses: Array(8).fill(0),
      leafIndex: 0,
      leaf: "0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf",
      merkleRoot: 0,
      nullifier: 0,
      amount: 250000000000000000,
      receiver: 0,
      relayer: 0,
      deposit: 1,
      token: 0
    };

    // link 0x7273ebbB21F8D8AcF2bC12E71a08937712E9E40c
    // Generate proof
    correctProof = await noir.generateFinalProof(input);
    expect(correctProof.proof instanceof Uint8Array).to.be.true;
    console.log("proof public inputs", correctProof.publicInputs);
  }).timeout(1000000);

  it('Should verify valid proof for correct input', async () => {
    const verification = await noir.verifyFinalProof(correctProof);
    expect(verification).to.be.true;
    let resEth = hre.ethers.parseEther("0.25");
    const tx = await verifierContract.deposit("0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf", correctProof.proof, { value: resEth });
    await tx.wait();

  });

  it('Should withdraw', async () => {

    // get result from proof (leaf,nullifier)
    const proofDepositInfo = await getProofInfo(1, 250000000000000000);
    const proofWithdrawInfo = await getProofInfo(1, 150000000000000000);
    console.log("proofDepositInfo", proofDepositInfo);
    console.log("proofWithdrawInfo", proofWithdrawInfo);
    const root = await verifierContract.getLastRoot();
    console.log("root", root);

    let input = {
      secret: 1,
      oldAmount: 250000000000000000,
      witnesses: witnessMerkle,
      leafIndex: 0,
      leaf: proofWithdrawInfo.leaf,
      merkleRoot: root,
      nullifier: proofDepositInfo.nullifier,
      amount: 100000000000000000,
      receiver: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      relayer: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      deposit: 0,
      token: 0
    };

    let resEth = hre.ethers.parseEther("0.1");
    let emptyValue = hre.ethers.encodeBytes32String("");
    // Generate proof
    const withdrawProof = await noir.generateFinalProof(input);
    const tx = await verifierContract.withdraw(input.nullifier, input.leaf, root, input.receiver, input.receiver, resEth, withdrawProof.proof, emptyValue);
    await tx.wait();
    const bal = await hre.ethers.provider.getBalance("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    console.log("balance", bal);

  }).timeout(1000000);

  it('Should second withdraw', async () => {
    var event = await verifierContract.queryFilter(verifierContract.filters.AddLeaf);
    var leafs = event.map(x => x.args[1]);

    var arrayLeafs = Array(256).fill(0);
    for (let index = 0; index < leafs.length; index++) {
      const element = leafs[index];
      arrayLeafs[index] = element;
    }

    console.log("leafs", leafs);

    const merkleTree = new MerkleTree(arrayLeafs, fnHash, {
      sort: false,
      hashLeaves: false,
      sortPairs: false,
      sortLeaves: false,
      concatenator: fnConc
    });
    const nwitnessMerkle = merkleTree.getHexProof(leafs[leafs.length - 1]);
    // get result from proof (leaf,nullifier)
    const proofDepositInfo = await getProofInfo(1, 250000000000000000);
    const proofWithdrawInfo = await getProofInfo(1, 150000000000000000);
    const proofWithdrawInfo2 = await getProofInfo(1, 0);
    const root = await verifierContract.getLastRoot();

    let input = {
      secret: 1,
      oldAmount: 150000000000000000,
      witnesses: nwitnessMerkle,
      leafIndex: 1,
      leaf: proofWithdrawInfo2.leaf,
      merkleRoot: root,
      nullifier: proofWithdrawInfo.nullifier,
      amount: 150000000000000000,
      receiver: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      relayer: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      deposit: 0,
      token: 0
    };

    let resEth = hre.ethers.parseEther("0.15");
    let emptyValue = hre.ethers.encodeBytes32String("");
    // Generate proof
    const withdrawProof = await noir.generateFinalProof(input);
    const tx = await verifierContract.withdraw(input.nullifier, input.leaf, root, input.receiver, input.receiver, resEth, withdrawProof.proof, emptyValue);
    await tx.wait();
    const bal = await hre.ethers.provider.getBalance("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    console.log("balance", bal);

    var events = await verifierContract.queryFilter(verifierContract.filters.AddLeaf);
    console.log("events", events.map(e => e.args));
  }).timeout(1000000);


  it('Should failed to generate valid proof for bigger amount than deposit', async () => {
    var event = await verifierContract.queryFilter(verifierContract.filters.AddLeaf);
    try {
      // get result from proof (leaf,nullifier)
      const proofDepositInfo = await getProofInfo(1, 250000000000000000);
      const proofWithdrawInfo = await getProofInfo(1, 300000000000000000);
      console.log("proofDepositInfo", proofDepositInfo);
      console.log("proofWithdrawInfo", proofWithdrawInfo);
      const root = await verifierContract.getLastRoot();
      console.log("root", root);

      let input = {
        secret: 1,
        oldAmount: 250000000000000000,
        witnesses: witnessMerkle,
        leafIndex: 0,
        leaf: proofWithdrawInfo.leaf,
        merkleRoot: root,
        nullifier: proofDepositInfo.nullifier,
        amount: 100000000000000000,
        receiver: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        relayer: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        deposit: 0,
        token: 0
      };


      // Generate proof
      const withdrawProof = await noir.generateFinalProof(input);
      await verifierContract.withdraw(input.nullifier, input.leaf, root, input.receiver, input.receiver, input.amount, withdrawProof.proof, "");

    } catch (err) {
      // TODO(Ze): Not sure how detailed we want this test to be
      expect(err instanceof Error).to.be.true;
      const error = err as Error;
      expect(error.message).to.contain('Cannot satisfy constraint');
    }
  });

  it('Should fail to generate valid proof for incorrect input', async () => {
    try {
      let input = {
        secret: 2,
        oldAmount: 250000000000000000,
        witnesses: Array(8).fill(0),
        leafIndex: 0,
        leaf: "0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf",
        merkleRoot: 0,
        nullifier: '0x1e3c6527094f6f524dcf9a514f823f9c0cdd20fb7f879c7bdf58bd2e7d3e0656',
        amount: 250000000000000000,
        receiver: 0,
        relayer: 0,
        deposit: 1,
        token: 0
      };
      const incorrectProof = await noir.generateFinalProof(input);
    } catch (err) {
      // TODO(Ze): Not sure how detailed we want this test to be
      expect(err instanceof Error).to.be.true;
      const error = err as Error;
      expect(error.message).to.contain('Cannot satisfy constraint');
    }
  });
});
