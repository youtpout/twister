import { expect } from 'chai';
import hre from 'hardhat';

import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';

import { compile, PathToFileSourceMap } from '@noir-lang/noir_wasm';
import { join } from 'path';
import { ProofData } from '@noir-lang/types';
import { readFileSync } from 'fs';
import { text } from 'stream/consumers';
import { ethers, network } from "hardhat";

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

    verifierContract = await hre.viem.deployContract('UltraVerifier');
    const verifierAddr = verifierContract.address;
    console.log(`Verifier deployed to ${verifierAddr}`);

    // @ts-ignore
    const backend = new BarretenbergBackend(compiled.program);
    // @ts-ignore
    noir = new Noir(compiled.program, backend);

    // @ts-ignore
    const backendGenerator = new BarretenbergBackend(compiledGenerator.program);
    // @ts-ignore
    noirGenerator = new Noir(compiledGenerator.program, backendGenerator);
  });

  it('Should generate valid proof for correct input', async () => {
    // get result from proof (leaf,nullifier)
    let inputGenerate = {
      secret: 1,
      amount: 250000000000000000
    }
    const { witness, returnValue } = await noirGenerator.execute(inputGenerate);
    console.log("returnValue", returnValue);


    let input = {
      secret: 1,
      oldAmount: 250000000000000000,
      witnesses: Array(16).fill(0),
      leafIndex: 0,
      leaf: returnValue[0],
      merkleRoot: 0,
      nullifier: returnValue[1],
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
    const tx = await verifierContract.verify(correctProof.proof, correctProof.publicInputs);
    await tx.wait();

  });

  it('Should fail to generate valid proof for incorrect input', async () => {
    try {
      let input = {
        secret: 2,
        oldAmount: 250000000000000000,
        witnesses: Array(16).fill(0),
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
