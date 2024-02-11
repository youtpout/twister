import { expect } from 'chai';
import hre from 'hardhat';

import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';

import { compile, PathToFileSourceMap } from '@noir-lang/noir_wasm';
import { join } from 'path';
import { ProofData } from '@noir-lang/types';
import { readFileSync } from 'fs';

const getCircuit = async (name: string) => {
  const sourcePath = new URL('../circuits/src/main.nr', import.meta.url);
  const sourceMap = new PathToFileSourceMap();

  sourceMap.add_source_code(sourcePath.pathname, readFileSync(join(sourcePath.pathname), 'utf-8'));
  const compiled = compile(sourcePath.pathname, undefined, undefined, sourceMap);
  return compiled;
};

describe('It compiles noir program code, receiving circuit bytes and abi object.', () => {
  let noir: Noir;
  let correctProof: ProofData;

  before(async () => {
    const compiled = await getCircuit('main');
    const verifierContract = await hre.viem.deployContract('Twister');

    const verifierAddr = verifierContract.address;
    console.log(`Twister deployed to ${verifierAddr}`);

    // @ts-ignore
    const backend = new BarretenbergBackend(compiled.program);
    // @ts-ignore
    noir = new Noir(compiled.program, backend);
  });

  it('Should generate valid proof for correct input', async () => {
    const zero = 0x0000000000000000000000000000000000000000000000000000000000000000;
    const secret = 0x0000000000000000000000000000000000000000000000000000000000000001;
    const hundred = 0x0000000000000000000000000000000000000000000000000000000000000064;
    const input = {
      secret: 1,
      oldAmount: 100,
      witnesses: Array(16).fill(0),
      leafIndex: 0,
      leaf: 0,
      merkleRoot: 0,
      nullifier: 0,
      amount: 100,
      receiver: 0,
      relayer: 0,
      deposit: true
    };

    const leaf = 0x149ee2a34336978136552210f474ff05c8089726d3212eda41dc386e7f222c53;
    const nullifier = 0x221e24eef47a71db7759851c68c8652da18b4f09c4769f2d5b8c297fbb83f07b;
    // get result from proof (leaf,nullifier)
    // const { witness, returnValue } = await noir.execute(input);
    // console.log("result", returnValue);

    // Generate proof
    correctProof = await noir.generateFinalProof(input);
    expect(correctProof.proof instanceof Uint8Array).to.be.true;
  }).timeout(1000000);

  it('Should verify valid proof for correct input', async () => {
    const verification = await noir.verifyFinalProof(correctProof);
    expect(verification).to.be.true;
  });

  it('Should fail to generate valid proof for incorrect input', async () => {
    try {
      const input = { x: 1, y: 1 };
      const incorrectProof = await noir.generateFinalProof(input);
    } catch (err) {
      // TODO(Ze): Not sure how detailed we want this test to be
      expect(err instanceof Error).to.be.true;
      const error = err as Error;
      expect(error.message).to.contain('Cannot satisfy constraint');
    }
  });
});
