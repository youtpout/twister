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
      witnesses: Array(7).fill(0),
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
    const proof = "0x2094e0e53dfd50b4589c952150a1a66b94b951552afa25124fb2f451fd39824029a85bdcbb14cb20c79c8405facba8ced51f8c352f0ebbb9b65b4ce16eea92210ace7dd4c1c92e61bf9f36c6a69cc90ea946cb83049fe386779793ec6a8de7a10a8057ef794542163ad13d2ff3f2d1a3f8515b71283005c288e961603caa2e2c11ee39797d289d4f7616b5370cdbf30099ede6f6d07d937d68c0bdee954f29a422d7262232c85d90424500a21b75483af214fbff16b7d8206c65cc46c35d282c09b681cdc5084dec190a235d4dd5a2d36a02c552e4b30fc16fd966e8afe4dcce01444ebc7500b0d904a2558fc7de8e227e1da3fd6d9612a3fbcdeb6a0a2029ea2163bf815e1808b1ea5fdaf1db7c1ead706e33d515e55bf619338b7ed7c22874175c7d08358bd871c6923c2b928f96bb2c0fe46415a0189a3d4dc5e7585e4f18163f48ba5bb178b449cf744d322c5b722010f6dbe9d0245e0f51b3277497cfaf13d425420144302534d95e1b400499a0223f16a158f95dad91510ced8ea72c9e256208d2f50e3331de351aec194af62fe20c00935b206309a2c350b2d99722fa210b10e58bdeca44a3e1d9466f177b236ad5e68dbd48e40a4d961c7ae20c114b03a1a0e4244335a2651b004552ba290a526199078d568e70321552d1a82156a21cb3efe785c9947317ec95e9a831736ccf655f87f3236189da3797ae8c096a9807f6ed7e042aa4a97ea2f19009e642976f808b66347bea6aae0860fe54c39a4a278f0f4b8cc51bedb314ca75ee8c0769f969a993279d73d0da88eedb926a2d7629dfb5c1e9f6fef26e89dabdad40097150cb20d0d5984279390a350a42f4fd6d1908f698013e49be789b5a8e46a137653f1d1bad0ea94751e811abaecf9d3f6125bd6b504256b0a6a5b6ffe8b4f4204aae603964d9da4ddff7ebc3c9759357a91f66b270dba28ad16db50167291aca968a5ed5f4ccfa1569f99404f06b9bbd0e219544c2e3506a449bbccb7bca03df23c47e96977a2fbd24c53bcc7b50b24aae13b4e36122ce6d3b8fcd59f254f3f82cf324c10852a1e4f3b86307a4cfbeba7e02b272ca33cad8c67e2b9a0dd400fbce8bd38004af76532b7add78d0db12dd6426952fa5404035887a7e7c8a5967ac263ae2486f8e6dd290577e68bbbe178f140afa773671fbe1072aa334dc18d7ee7bad64645e1dc4104c35ff5e479acf53ed2cf8c11b56ef771ed7eb56641bd30370706d8fe3e0a4636fc2d1926427d7d3c72b1ab0a83ef619526642059177f634f2b7ea2c4a698de843f1bc35204aa995400a93673407708e8673dcd79be836e2db691a468d907280ddc11c3b2fc35cb747275768a67dfb903241b1169bd69f3ccce9303311d9c10dc9bacdc6a952fef21d2c3adf66bb77e17ec36c05b86ec300aa21c4b93b26f4499146f67b02204b960705dcdaab0aaf98727ec34c418b34e11cc26fb30333703a6987bbf54570fdd9c01d2e313677bd8a53ad42e1962135bbbd7d0d73f5247228ad7df6fa32fbf8d4a21aad711a7ea98d55baf1d7bfa12d38e353013a1c8b14e9e8687e14473936c1421281e9de05bbfd80fb80ccb568f1cce887807fbd59de24aa26daa212e79ea9501afd1064e4f9744efdb05be49107687595838855271475680da9d216a56ffb7309e2e7fd91fcb40a7c4bc76f823c1e5e1a7cd3435bf86373dea3e1dd20fd933412296f027bcecc502c74c9c55d0e4c39f9fad7ad98fa733de53cbb58f49026a61e4bb7482c47e1035500f398446df1faf067e280a7551189ec10e590fc14f74e12669b8a44a8c9ad9035e46dc8a0f7eed5787c6cbeceb5786dbb20765351331c1ef6284a346576949edd906c915b3ce80cf7cf654f633bb01cd4df3999858479233ebd2e7de9f6a3e837796d9084694d609746ddcc7a581b9fe948865d41bbc12bc6f42218967e931ee7bb4e2ba76ca4f000cdbece4b2b9c3307f4764cc8e32d122a2e5cb924c999e4a954e38853a43ed6a86dd216beeb1c407b59f28aa6fd1f2a7ff2492b0df70c51652d520179c8d7ff3e61eae332ec0337bee23428404f552a03cf9d7c744de3e2b53e10c7b8431a85f4f11c1dd218e92ee183fbfce032c0032f98e642e7b46fdd16f0e8e33c5685d8bba8bc7fcdd9aaf5fca66a1ab54c6c099299c6151e4d390049d3ffba1c8f3c57978ca20d26f4ab30d90ab74b30dfaf02da03b90a3541ea26e84162d24e83aa6443b3aca128d58e5c0ccc4931eb31a10c8917163580fb6b861db754904b05b75b8244b997677ce13e4fe05876f149c81feae797512f3189390a43d393f52a97d1e12d46d9522829eccf67a213018c2f10563a13b22e3c6f39a7abec74fd50d9449e331e0f5a9ecfecfe7075a509ee332e6629c66452e3e9808dc9ab0f1d308b98064f9807d9584ec7e7cbf3cf4a397d183f611c0d937d2101203f4e0f6c8b3f2a0d5d68a9e066d7eb7a0b0d83c9dd74182f27dcd89e1dbec9960b34e941974848a048c63977fabe9ea5d27c5c382bf22cb52a69c966961f56f4d39421ca8021542a111f520d4198487ce887a12a889816d05173466017b14bddfe57ed89ccf6da7b7d636a40fd11020f20d80c1a790f2b4085d146e7f05a908a05bf65ffed70d9abd7443711304467c546eefb7f894f287d0b6dde2c92a12cea13ff15ad7bb3b7145d8154db35d2cdf4b2a8f0c3ab1e24d0d1705f312a63294c29bda7a76e3a9b8da7bb14f32a7b859466648b3bbc131b8428dc33b38af0c91cd1e55fd11243ea78357d6528e90793d3098a2acdb12c2c1c9fc030622970035c228a53293fbf0522a1dcb16367abe0ccacd356c0069e19c8a9905d01417d1594176a416d3ef9b5018992cf3bbc52300e660886743925044a1c7ca4dc15872d813e7800a0a8aa69616640759ad631f1fec3b91b74da680887f4e396546c4ad7d1d8416e07d57fec430017d3754df13b1d02fe9deb1cf41b7c1da6cf5d49e4f2231438a861b75ba77ad28ca4e5ebb98dedd60ee3e80e89";
    const tx = await verifierContract.deposit("0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf", proof, { value: resEth });
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
