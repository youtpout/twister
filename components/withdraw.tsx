import {
  useState,
  useEffect,
  SetStateAction,
  ReactEventHandler,
  FormEvent,
  ChangeEvent,
} from 'react';
import { Twister__factory } from "../typechain-types/index.js";
import addresses from "../utils/addresses.json";
import { gql } from "@apollo/client";

import { toast } from 'react-toastify';
import React from 'react';

import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend, } from '@noir-lang/backend_barretenberg';
import { CompiledCircuit, ProofData } from '@noir-lang/types';

import { useWeb3ModalProvider, useWeb3ModalAccount } from '@web3modal/ethers/react'
import { BrowserProvider, Contract, ethers, formatUnits } from 'ethers'

import circuit from '../circuits/target/noirstarter.json';
import { buildPoseidon } from "circomlibjs";
import { MerkleTree } from 'merkletreejs';
import client from "./apollo.js";


function Withdraw() {
  const [input, setInput] = useState({ secret: 'SecretPassword', oldAmount: 0.1, amount: 0.1, receiver: '', relayer: '' });
  const [proof, setProof] = useState<ProofData>();
  const [depositing, setDepositing] = useState<boolean>(false);
  const [noir, setNoir] = useState<Noir | null>(null);
  const [backend, setBackend] = useState<BarretenbergBackend | null>(null);

  const graphKey = "aaa25f535d2b23f0b720120163e189cf";

  const [rest, setRest] = useState<string>("");

  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();


  const getLeaves = async () => {
    const { data } = await client.query({
      query: gql`
        query MyQuery {
          addLeaves(first: 300 orderBy: leafIndex) {
            id
            client
            commitment
            leafIndex
          }
        }
      `, fetchPolicy: "no-cache"
    });

    console.log("data", data.addLeaves);
    return data.addLeaves;
  };


  // Handles input state
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target) setInput({ ...input, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    try {
      let amountA = ethers.parseEther(input.oldAmount.toString());
      let amountB = ethers.parseEther(input.amount.toString());
      let newAmount = amountA - amountB;
      let r = ethers.formatEther(newAmount.toString());
      setRest(r.toString());
    } catch (error) {

    }
  }, [input]);

  async function getProofInfo(secret: any, amount: any): Promise<{ leaf: any, nullifier: any }> {
    const poseidon = await buildPoseidon();
    const hash = poseidon.F.toString(poseidon([secret, amount]));
    const leaf = "0x" + BigInt(hash).toString(16);
    const hashN = poseidon.F.toString(poseidon([amount, secret]));
    const nullifier = "0x" + BigInt(hashN).toString(16);
    return { leaf, nullifier };
  }

  const withdrawAmount = async () => {
    try {
      if (depositing) {
        console.log("already withdraw");
        return;
      }
      setDepositing(true);
      console.log("withdrawing");


      await toast.promise(withdrawAction, {
        pending: 'Calculating proof...',
        success: 'Proof calculated!',
        error: 'Error calculating proof',
      });

    } catch (error) {
      console.log(error);
    }
  }



  function bufferToBigInt(buffer, start = 0, end = buffer.length) {
    const bufferAsHexString = buffer.slice(start, end).toString("hex");
    return BigInt(`0x${bufferAsHexString}`);
  }

  const fnConc = (x: Buffer[]) => {
    const hexa = x.map(z => {
      if (z.indexOf('0x') > -1) {
        return z;
      }
      return bufferToBigInt(z);
    })
    return hexa;
  };

  const withdrawAction = async () => {
    try {
      const bPoseidon = await buildPoseidon();

      let secret = ethers.keccak256(ethers.toUtf8Bytes(input.secret.toLowerCase()));
      let amountA = ethers.parseEther(input.oldAmount.toString());
      let amountB = ethers.parseEther(input.amount.toString());
      let newAmount = amountA - amountB;
      let oldAmount = "0x" + amountA.toString(16);
      let amountWithdraw = "0x" + amountB.toString(16);
      let amount = "0x" + newAmount.toString(16);

      let secretAmount = BigInt(secret);
      const maxModulo = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
      if (secretAmount > maxModulo) {
        do {
          secretAmount = secretAmount - maxModulo;
          secret = "0x" + secretAmount.toString(16);
        } while (secretAmount > maxModulo);
      }
    


      const fnHash = (x: Buffer[]) => {
        //console.log("x", x);
        const hash = bPoseidon.F.toString(bPoseidon([...x]));
        const res = "0x" + BigInt(hash).toString(16).padStart(64, 0);
        //console.log("res", res);
        return res;
      };


      const poseidonOld = await getProofInfo(secret, oldAmount);
      let nullifer = "0x" + poseidonOld.nullifier.replace('0x', '').padStart(64, 0);

      const poseidon = await getProofInfo(secret, amount);
      let leaf = "0x" + poseidon.leaf.replace('0x', '').padStart(64, 0);

      console.log("leaf", leaf);

      if (!isConnected) {
        toast.error("Connect your wallet");
        throw Error('User disconnected');
      }

      const ethersProvider = new BrowserProvider(walletProvider);
      const signer = await ethersProvider.getSigner();
      const address = addresses.verifier;
      const twister = Twister__factory.connect(address, signer);
      const root = await twister.getLastRoot();

      var leafs = await getLeaves();

      console.log("events", leafs);

      var arrayLeafs = Array(256).fill(0);
      for (let index = 0; index < leafs.length; index++) {
        const element = leafs[index].commitment;
        console.log("element", element);
        arrayLeafs[index] = element;
      }
      console.log("arrayLeafs", arrayLeafs);
      var leafInfo = leafs.find(x => x.commitment === poseidonOld.leaf);
      if (!leafInfo) {
        throw Error("No commitment found for this secret/amount pair");
      }
      var leafIndex = "0x" + leafInfo.leafIndex.toString(16);

      const merkleTree = new MerkleTree(arrayLeafs, fnHash, {
        sort: false,
        hashLeaves: false,
        sortPairs: false,
        sortLeaves: false,
        concatenator: fnConc
      });
      const nwitnessMerkle = merkleTree.getHexProof(poseidonOld.leaf);

      console.log("witness", nwitnessMerkle);

      let inputProof = {
        secret,
        oldAmount,
        witnesses: nwitnessMerkle,
        leafIndex: leafIndex,
        leaf: leaf,
        merkleRoot: root,
        nullifier: nullifer,
        amount: amountWithdraw,
        receiver: input.receiver,
        relayer: input.receiver,
        deposit: 0
      };

      console.log("inputProof", inputProof);

      const { proof, publicInputs } = await noir!.generateFinalProof(inputProof);
      console.log('Proof created: ', proof);
      setProof({ proof, publicInputs });

      let emptyValue = ethers.encodeBytes32String("");

      const tx = await twister.withdraw(inputProof.nullifier, inputProof.leaf, root, inputProof.receiver, inputProof.relayer, inputProof.amount, proof, emptyValue);
      await tx.wait();
    } catch (error) {
      console.log(error);
      toast.error(error.toString());
      throw error;
    }
    finally {
      setDepositing(false);
    }


  };


  const initNoir = async () => {
    // @ts-ignore
    const backend = new BarretenbergBackend(circuit, { threads: 8 });
    setBackend(backend);

    // @ts-ignore
    const noir = new Noir(circuit, backend);


    // await toast.promise(noir.init, {
    //   pending: 'Initializing Noir...',
    //   success: 'Noir initialized!',
    //   error: 'Error initializing Noir',
    // });
    setNoir(noir);
  };

  useEffect(() => {
    initNoir();
  }, []);

  return (
    <div className="tab-content">
      <div className='tab-form'>
        <span>Secret</span>
        <input className='input' name="secret" type={'text'} onChange={handleChange} value={input.secret} />
      </div>
      <div className='tab-form'>
        <span>Current amount (ETH)</span>
        <input className='input' name="oldAmount" type={'number'} onChange={handleChange} value={input.oldAmount} />
      </div>
      <div className='tab-form'>
        <span>Amount to withdraw (ETH)</span>
        <input className='input' name="amount" type={'number'} onChange={handleChange} value={input.amount} />
      </div>
      {/* <div className='tab-form'>
        <span>Relayer</span>
        <input className='input' name="relayer" type={'text'} onChange={handleChange} value={input.relayer} />
      </div> */}
      <div className='tab-form'>
        <span>Receiver</span>
        <input className='input' name="receiver" type={'text'} onChange={handleChange} value={input.receiver} />
      </div>
      <button className='button' onClick={withdrawAmount}>Withdraw</button>
      <div style={{ marginTop: "10px" }}>
        Remaining after withdraw : {rest} (ETH)
      </div>
    </div>
  );
}

export default Withdraw;
