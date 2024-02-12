import { expect } from 'chai';
import hre from 'hardhat';
import { Buffer } from 'buffer';
import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { compile, PathToFileSourceMap } from '@noir-lang/noir_wasm';
import { join } from 'path';
import { ProofData } from '@noir-lang/types';
import { readFileSync } from 'fs';
import { MerkleTree } from 'merkletreejs';
import { buildPoseidon } from "circomlibjs";
import { Twister } from "../typechain-types/src/Twister.js";

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

  it('Should verify valid proof from nargo prove', async () => {
    const verification = await noir.verifyFinalProof(correctProof);
    expect(verification).to.be.true;
    let resEth = hre.ethers.parseEther("0.25");
    // proof generate with nargo prove
    const proof = "2cb483a6c7cb56a7211b0130d7802a7e78330b18c9854248485bda81fe8515a70391ed4d4bfdefc5c9008b90d9826446a70c0105f3d5fdfe69c7d83df2896d38115ae1d080bf4da408dcb014a63c0dfbce2db69816479956bf0d1f8e31fa0ffa2a184cb78e9446c26c1c297791ea825f21b04d1b5f8f383dd78970e8e71a8dac254c97a75b1a0de980c27b327ca421615afca97ff562930ab4284b306ff0c84b1b517206e2c947cdaccb87367da980d9f6f8143cda5a066c7f566ac065e083e8106be5898e02a95d8fa4bd0a25a2c2a961a1e3c70b5f453787bc55ee18229cc01f43f022851956808b75c6c48929bbfb6b610f10512db20500f52a7e59c31d2029e6db8fa0458299b15182f7a3b338424ed565e3378808ac4ff03cc18fbc356f18ac7c17391863675a77239ed4d6061df11210098b432f2cc5cfe43e34880e0505e01686172225be3af78e6c2b1c8586ddca23669a22fd854f9998071e51a72613a4e12a87d1ce7111aadd8945a1fc7258e6937b0f7ef0c8207a52fb32615b41112f4c1d2f7e728557dad4323f6011b7964a725e8a11f97bd8d654439878c42120f367b1c0a8db43b482f8400d094feedbee23a6e4f050685b3411a91aee88062186f97896b157c91e1df5bc439f825724f737313c464576aef33c468f88d3541775d07547067ad96f2e2ad22c94b185c71228488de23c0a68616762cf535c6212f28cd73ed02c1780e7d9d9f412753dfe43b2a3f4e57fd47e93f2982c0fe93111abdc4f792518d7593b55b6a255c6da36698f7b0df54886a20f017342a88a4b0e5077bdf9559c14c749d98c1ac7b3bb3c95be5fc929b7f05f548b1549b91b9316ae3f493ea8e8ca89bba587aeb811315dff2ea1500210e11c6214437eea9dfb1cf04344e99fd39f6b12f52f149f480e6f9cb34a15fc0b8b674890574476ea32303f98f473c69bb73d97446c83fc253ea40967dd73f66568bab0580a7c04f9b01e9d5bd891fc15d462688b88b9761e3539bd1a7078e556bf2097eddba0141a68137ce9040e5046b842f9a7783f8388ab3ceda38f4c354bbaa41fd58ea2a88c121dad2291ed8e47d0298cfc3089d166276760d0cbd1cc04ca4531431a0fadd93522a0ed49c7d04368ff9ef0189e0076ba48728d81161ed0b2d63fba8023145b790d8701385a6c7ca6c682f0090d7a723adead0a6f037491d923c15e4b45a3896b12884f969c75f9112108db9474bf52afe104798b95e194c072a0b819c685964c26098fc5fc879df127291ad7983266965d6f6407dcd26f467e8a33f519e74ce00076dd50225a6d61937e854bc655b694731f44c8e0b683094dc30717f94b64d73043ab8ffd04dfd7fccbb2b66173baf4f71951ee1da2edb8fa2c94682ec93585065a8ad73e1eb08b963e8d114456d885d87cf22860fa36ec9200f66b0335756c1b4a2ee3e357f5e482c36ab998e8b79a69f7cf19bcf2f57658e2099f2dfdb2820bf2086fe3d5086c0cbf5917e16efae4edc8d4c1de4e39ae3c54563a933d714b20e7758fad45d1cacee6c79dbfd844731c84a3a264a8fcba65ca21b718accef405b69bd0bb66731a31023be49c3d343e5a8221f8d466231c557e54fc60bcceda27b454b507e23379d12743d09e556359fb08e1671fcf85d4e2035306c43b8653281126265b10e64ced5d4ae805ccdbd63aadbb680f47d465d39497419e0e113116039041d82159bf76edf87066a7869041ba971f6e723d50dded48120a9c45ee03dacd440d14721008c20ea2f478c2ab118bc8be2c6aed79a9f42ffb768a20c419f9d63c132e41a46d88667770b55403c71d2668886cef11b3f313f1e40ffd35289492b9bf6ee90ceb5a8239b3f04ba2a3176e8401c5a156ea3c89607d6b8e8603c8d6360102cbee5e30bb6b6917891f4d1c512418035ed278c2f01e6219eb98286f43668ad3ed61f0961af7b2409c92415a6f3ad5f2e68e15fdf0761dbb23850eaa3768d689e21e58a3904019bc8e6e742dad5c2f3f2a438b779e5cbd6c87510f58a2c181493503f14a72f0908752aa650b08008d8f90e2a12b8eb862887b6e1336c6e349ec5870350084d0d882e47db40b673b313b96a532f56122c382206f00d2dd4245af4aa25b5fa847746a652737dfc84c9b94d3c1243b47dae9f1e49f281062d463247a534d8e786c6186414da124c42cb277dcbbb131bbda540d970c21f04845332afd138d2728def253f6179a96e998f51d98c37a1845f15a29f4e62b095e100452032bbca9ac84929cf7fe578d50c563bcf0b87f391a8dc3f81cc300c00437ac87c72717497f449d77c22004bc12e657e7cb96239573505203d22a22bb736ba293a34df049edd20623b3ce9152f24239f7496e1fbc1c2b722c6bd8277ea70be7f71ca9107a4dcded13757d24019b14e2526f3fae767afb310bd70917474206ba1be11eb0042629ea2c688e8a30cded6503e182f30ceb925f9b3def2a07c3b33bd0737c66d9d934ad6c4774f3afaf6c4848b4308395e968a6539fd50f171d78897755dcf1f8c53eab3026d04ccdaebe064853a52370bc4191f44145215daff498114ad69468bf59ddd135da42b5341578be8d77f6fb42cc2218615721896c40e8f345f6e1a8f9ea935d37b49eab36ea0000259b61ddaf22d39a302a2efbd75db4ade856d72c1a304924d5adf2070091ae6d033c3919a9ff63cc49ad199d0280fbe3be0dc93251e630e4f358e2a21233ded50133a7e49cfc0a39867a0f398bbaa82af9e62e69a50cc355518df8c5837250d8311a31c67ff2fc29d9932d41bf669a18f6338e401f9224e109fd88c12c233730d0fd6d8238486e7032a91274b30a031bdb7a11859604d670932348d69436363d1391849315e56b8cf6650288903526e884291a0106b794a153df06bc5c431b6afef08c9068322794bb121c3e18fcd2cd2a931420c83b876900578e03195681c75534a5fdd693cf3ca2d42d6ea5f35d8c9f7d0f0f5589544ac0baa71b6bb7befe546fb9c0aa784bdb1988";
    const tx = await verifierContract.deposit("0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf", proof, { value: resEth });
    await tx.wait();

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
