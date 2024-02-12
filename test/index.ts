import { expect } from 'chai';
import hre from 'hardhat';
import { Buffer } from 'buffer';

import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';

import { compile, PathToFileSourceMap } from '@noir-lang/noir_wasm';
import { join } from 'path';
import { ProofData } from '@noir-lang/types';
import { readFileSync } from 'fs';
import { buffer, text } from 'stream/consumers';

import { MerkleTree } from 'merkletreejs';
import { buildPoseidon } from "circomlibjs";

const getCircuit = async (name: string) => {
  const sourcePath = new URL('../circuits/src/main.nr', import.meta.url);
  const sourceMap = new PathToFileSourceMap();

  sourceMap.add_source_code(sourcePath.pathname, readFileSync(join(sourcePath.pathname), 'utf-8'));
  const compiled = compile(sourcePath.pathname, undefined, undefined, sourceMap);
  return compiled;
};


const getCircuitGenerator = async (name: string) => {
  const sourcePath = new URL('../generator/src/main.nr', import.meta.url);
  const sourceMap = new PathToFileSourceMap();

  sourceMap.add_source_code(sourcePath.pathname, readFileSync(join(sourcePath.pathname), 'utf-8'));
  const compiled = compile(sourcePath.pathname, undefined, undefined, sourceMap);
  return compiled;
};



describe('It compiles noir program code, receiving circuit bytes and abi object.', () => {
  let noir: Noir;
  let noirGenerator: Noir;
  let correctProof: ProofData;
  let verifierContract: any;

  before(async () => {
    const compiled = await getCircuit('main');
    const compiledGenerator = await getCircuitGenerator('main');

    const UltraVerifier = await hre.ethers.getContractFactory("UltraVerifier");
    verifierContract = await UltraVerifier.deploy();
    console.log(`Verifier deployed to ${verifierContract.address}`);

    // @ts-ignore
    const backend = new BarretenbergBackend(compiled.program);
    // @ts-ignore
    noir = new Noir(compiled.program, backend);

    // @ts-ignore
    const backendGenerator = new BarretenbergBackend(compiledGenerator.program);
    // @ts-ignore
    noirGenerator = new Noir(compiledGenerator.program, backendGenerator);
  });

  function bufferToBigInt(buffer, start = 0, end = buffer.length) {
    const bufferAsHexString = buffer.slice(start, end).toString("hex");
    return BigInt(`0x${bufferAsHexString}`);
  }


  it('Should generate valid proof for correct input', async () => {

    const poseidon = await buildPoseidon();
    const hash = poseidon.F.toString(poseidon([1, 250000000000000000]));
    console.log("hash", "0x" + BigInt(hash).toString(16));

    const hash2 = poseidon.F.toString(poseidon([0, 0]));
    console.log("hash2", "0x" + BigInt(hash2).toString(16));

    // function to use poseidon hash wirh merkletreejs
    const fnHash = (x: Buffer[]) => {
      console.log("x", [...x]);
      const hash = poseidon.F.toString(poseidon([...x]));
      console.log("hash", "0x" + BigInt(hash).toString(16));
      const res = BigInt(poseidon.F.toString(poseidon([...x])));
      console.log(res);
      return "0x" + BigInt(hash).toString(16);
    };

    const fnConc = (x: Buffer[]) => {
      const hexa = x.map(z => {
        console.log("z", z);
        if (z.indexOf('0x') > -1) {
          return z;
        }
        return bufferToBigInt(z);
      })
      console.log("conc", hexa);
      console.log("hexa", "0x" + BigInt(hexa[0]).toString(16));
      return hexa;
    };

    const merkleTree = new MerkleTree(Array(4).fill(0), fnHash, {
      sort: false,
      hashLeaves: false,
      concatenator: fnConc
    });
    const root = merkleTree.getHexRoot();
    console.log("root", root);

    // get result from proof (leaf,nullifier)
    let inputGenerate = {
      secret: 1,
      amount: 250000000000000000
    }
    const { witness, returnValue } = await noirGenerator.execute(inputGenerate);
    console.log("returnValue", returnValue);

    var bn = BigInt(returnValue[0]);
    var d = bn.toString(10);
    console.log("decimal", d);

    let input = {
      secret: 1,
      oldAmount: 250000000000000000,
      witnesses: Array(7).fill(0),
      leafIndex: 0,
      leaf: returnValue[0],
      merkleRoot: 0,
      nullifier: 0,
      amount: 250000000000000000,
      receiver: 0,
      relayer: 0,
      deposit: 1
    };


    // Generate proof
    correctProof = await noir.generateFinalProof(input);
    expect(correctProof.proof instanceof Uint8Array).to.be.true;
    console.log("proof public inputs", correctProof.publicInputs);
  }).timeout(1000000);

  it('Should verify valid proof for correct input', async () => {
    const verification = await noir.verifyFinalProof(correctProof);
    expect(verification).to.be.true;
    const abi = hre.ethers.AbiCoder.defaultAbiCoder();
    const publicInputs = Array(7).fill("0x0000000000000000000000000000000000000000000000000000000000000000");
    publicInputs[0] = "0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf";
    publicInputs[3] = "0x00000000000000000000000000000000000000000000000003782dace9d90000";
    publicInputs[6] = "0x0000000000000000000000000000000000000000000000000000000000000001";
    const params = abi.encode(
      ["bytes32[]"], // encode as address array
      [publicInputs]);
    const tx = await verifierContract.verify(correctProof.proof, params);
    await tx.wait();

  });

  it('Should fail to generate valid proof for incorrect input', async () => {
    try {
      let input = {
        secret: 2,
        oldAmount: 250000000000000000,
        witnesses: Array(7).fill(0),
        leafIndex: 0,
        leaf: "0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf",
        merkleRoot: 0,
        nullifier: '0x1e3c6527094f6f524dcf9a514f823f9c0cdd20fb7f879c7bdf58bd2e7d3e0656',
        amount: 250000000000000000,
        receiver: 0,
        relayer: 0,
        deposit: 1,

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
