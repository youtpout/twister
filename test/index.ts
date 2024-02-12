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
import { Twister } from "../typechain-types/src/Twister.js";

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
  });

  function bufferToBigInt(buffer, start = 0, end = buffer.length) {
    const bufferAsHexString = buffer.slice(start, end).toString("hex");
    return BigInt(`0x${bufferAsHexString}`);
  }

  it('Should generate valid merkle', async () => {
    const poseidon = await buildPoseidon();
    const hash = poseidon.F.toString(poseidon([1, 250000000000000000]));
    console.log("hash", "0x" + BigInt(hash).toString(16));

    const hash2 = poseidon.F.toString(poseidon([0, 0]));
    console.log("hash2", "0x" + BigInt(hash2).toString(16));

    const hashw = poseidon.F.toString(poseidon([1, 150000000000000000]));
    console.log("leaf withdraw", "0x" + BigInt(hashw).toString(16));

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
    const witness = merkleTree.getHexProof("0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf");
    console.log("root", root);
    console.log("witness", witness.map(x => BigInt(x)));
  });

  it('Should generate valid proof for correct input', async () => {


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
      witnesses: Array(8).fill(0),
      leafIndex: 0,
      leaf: "0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf",
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
    let resEth = hre.ethers.parseEther("0.25");
    const tx = await verifierContract.deposit("0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf", correctProof.proof, { value: resEth });
    await tx.wait();

  });

  // it('Should verify valid proof from nargo prove', async () => {
  //   const verification = await noir.verifyFinalProof(correctProof);
  //   expect(verification).to.be.true;
  //   let resEth = hre.ethers.parseEther("0.25");
  //   // proof generate with nargo prove
  //   const proof = "0x272f3247bda6f0e1e1f3e6ddc27b3b39bc1207378eb25301bd6711b7f6d71ff92c21c9fddc2b37f64069db6b1442eb73637bfd3d916e51517d8a41bf52c6dbeb0303a8959bc0b9ba5898b3f23716e229c13a6ab51ad0a295d83438bd3280cdfd2d2ac36e999a6c855213128d9e022773a626e87825366efcb06a0df858125de427ae4025c002e11123d56b2cba2c0cb46ab66d3a9f205f446b6927b488bbf05705e1084fb2da0a4cbc75a470ce41dcb35a77a43977d9060698348be73087d31b1485fedae90cd595fcbba639ef99798de87820fb46f00318679cefd5090e20b1041da5cbe3fbc6c3777a3c27173cdf6adcb9e86bb2646a18f49bed94e24e70c1126e9729d539e3feec59ca41695420205a984a8d1bda3b55ae18230aeae348132570bdb006e4dbbad0643c28f75f0b9c51313231b21b6fe65531f2af77bf42d1150fd49c3a6a2578588180f9f8cbb062f6d52401dff4264cf72ffcfed31f8d8e1026edd7d6fcd935c5692a9a699f38d84693a9d36637c8d382160f9567210ec11ff86e325f5f860e731938aaa6ac7696067c7bb7e0aeb247079a850648620bd3196f6fca4823538e0088b8f6c101e9ca460b984b0583203d9aba67f522e2a8f11c5d57fa5147601a04c51b027d23035a3287843e98c5c7f2a6a231c0aee23aa7164f865068c358beb67a1ff5b553d2e06fb4ebcc93bb8824602cfed20928e76b1e0a2407c9e3aa8ff711a740ba31433303ed6bcdf8d5325631904c7fd0820db60ca255a393c986de2a2ee4674507f8f59398a82bea7e7b72fb749e9612496b352b3d0b6a6cd5f06a9a5a5969ae11b2206cd518c6507acfaf0b222ea602e00d4104ae474df412a0695c123c2499b51ac490eebf6d4c023ffefe7eab65df15dbe721142231fcc2906d740f3dc9deabe58673173b0af3ecab55e1c1dab449f17c3a04934444fb51aa8193711bb728a5ddb664750dd6bcee980e8311be905ca0aae02c111540614406fe777d020a9939b6c96dd9e96aeb0a3e1aa62615c0b53d9af702fc336fba6dc2556404c591dc5cb3b9acd40df4138b150ca1817163c113fde72edf8f69d9153fe423ef40434fba498cd2eda8585358490b8ab5fadb5557bb62028ab320507de385ed4b43b524a99af7c4e76ad4d6a698b902267c5d848af88621b688a21997ccfe38223f82caa2affbd133d87ddb849d67052b2bca3979080325fa671dd10e0b660dd9ff5c6b5ec34597caa78246313e71c7b0d16fb242a25909902acbfc99058b6bacde3c2d3e598d24195fd220ac912c748d89c7d566b4aa0e4d02d8ea8c37e18c9cd2bc1d7c08394e17c2cd1e830bac7b23747277592dcd074ce37e892361547bf0c3359ba8cdeeda2c3d99114483ca7377acaa32971b380a501c1aa815a8a44f431ca9b84ac15651c8468d44a366c440ac736f6c3e8144211fd058b66759bf79c4d7ecd528fdcb816c46fcdf55f7f3e6892e33b59f958e1b9b8e6cef528a328d0c4e8a1908b77dc7d1b589e7afb42a2e38016ce95080892079ca8d0ed58a455c5a2a1826cb3ea19d260bef020e076298ba1312d4fe7b4d07a15f1a65847e801df7085f2d94fe30777d55dbf6aba80c27806f1cbd6badf510faf9ea49b8126caad7c3b8d105c24747f2b764b105c52ec05134bcb5510e1f263fa872419197831412257d6572e08a19918a0dfdfa897b98bde0f1c19f79590d0be6c7bc033dbd789dff9114259fcc0d43f405becdee27c718e5ca6b3f52a922a9b9c7666bb112f80a64ebb9924b4806b5fcad482f3e508f7fc340f74e8c713050edb7fcc91f0b2534984a9a917d09725c17418c9204aac9ecbdff6e16f1620f90e73ed49d4834df75446fdcbeb29288e6776d78d654e562a6bbacdeea10050b447e571089ca43c7da6b724229f01eb8dbea8ba5606c554fd36847e1245675032167a3649e856a272c9c9c47058478db35822179284f8601a897435c2ee93d0debc1424cefadf6f6fafe73e35dd5c6cdba70fbcedc595fc0467f93e85d63f6180f8250cc2521bec32d8196e8047e4538e66f09ea27b093ae8599068ffea9890863eb89a2e9b2fd9420c708e008cd8e674beda0914cbf9d60679fa9df2d9e2308476085e2ef5c95f1b43455a978c8196ceb85a5ba9f77dd6d8ffa7c5b54dd2d2e5a4e48d19861303e795b15fbe3fdab9442dcf169def55c8fec16e45c653d520366df36214941abff75fec773e78e518c62499b47789041c7d5ef7faaef426012b8f3e0b1c1853b7e9f16a22d5b21e8191dc93ee8131ad76d5ad1d3bd9292a627a0bc7b567ef659a6714288d594c77de9394fbdf20efab257c8476911de8388157f4558554532b3b6d360a86c15b13cbe67a7488462b48491ebb9fd30cef79721ed4cad7656ae1b4818a3984aea0b35aa8891030d3ff01dcb6d81dfc001df8e2d5c7a5c348cebdfcdfdbc52f3a72360583a1d9616d1e7926eb89d7cce609bbb0142b8914dbf1bbebb028eed7ef1c835032e6dc2bb363445c2788e0e7d0d8d4d1d7d4182d009fb9db802a949b88225217622496db243ee23dd96415a3df39f4316ff50d6e15b5224f9ada03479e628bc8a879273083e891304b2a71c3526dfe01c8daa8c7e9aee5a274a6f42f092e3bbfb389158ddb3c1001facc007c6b529251547a86819645b9e0236fb986107030e2b83b0badeb60963492bfc17ef5ac8d9162ab837281756a288adf6ca079a6a33fae485121ab40e605684af7fcc6137600734034cbab65d8c1defbadb194e3a403d121e4f795be6428b18deec4ea6791814273ef951314bcb74f496bdd25763593f7c6430fe27ec921158ae87901913861abd9bb68f6b9bf69ebf9375003cc151febfaf679ddc196069940e5e3ad878701405a974c689b9b5b68779286ddefe01497c1617d1cfb6d7bb24202c64feaff3181c9b9bc9bb319db4006a453f4fbb87fe8c68dae5e0173ff507cd5699a5552a2ba877c0a0f34137c8369b62b20b9742bb45c17381465f10d303eb9816dea4a8";
  //   const tx = await verifierContract.deposit("0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf", proof, { value: resEth });
  //   await tx.wait();

  // });

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
