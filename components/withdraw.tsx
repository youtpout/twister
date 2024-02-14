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

import { toast } from 'react-toastify';
import React from 'react';

import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend, } from '@noir-lang/backend_barretenberg';
import { CompiledCircuit, ProofData } from '@noir-lang/types';
import { compile, createFileManager } from '@noir-lang/noir_wasm';

import { useWeb3ModalProvider, useWeb3ModalAccount } from '@web3modal/ethers/react'
import { BrowserProvider, Contract, ethers, formatUnits } from 'ethers'

import circuit from '../circuits/target/noirstarter.json';
import { buildPoseidon } from "circomlibjs";



function Withdraw() {
  const [input, setInput] = useState({ secret: 'SecretPassword', oldAmount: 0.1, amount: 0.1, receiver: '', relayer: '' });
  const [proof, setProof] = useState<ProofData>();
  const [depositing, setDepositing] = useState<boolean>(false);
  const [noir, setNoir] = useState<Noir | null>(null);
  const [backend, setBackend] = useState<BarretenbergBackend | null>(null);

  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();

  // Handles input state
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target) setInput({ ...input, [e.target.name]: e.target.value });
  };


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

  const withdrawAction = async () => {
    try {
      let secret = ethers.keccak256(ethers.toUtf8Bytes(input.secret.toLowerCase()));
      let oldAmount = "0x" + ethers.parseEther(input.oldAmount.toString()).toString(16);
      let amount = "0x" + ethers.parseEther(input.amount.toString()).toString(16);

      const poseidonOld = await getProofInfo(secret, oldAmount);
      let nullifer = poseidonOld.nullifier;

      const poseidon = await getProofInfo(secret, amount);
      let leaf = poseidon.leaf;

      console.log("leaf", leaf);

      const root = "0x";

      let inputProof = {
        secret,
        oldAmount,
        witnesses: Array(8).fill(0),
        leafIndex: 0,
        leaf: leaf,
        merkleRoot: 0,
        nullifier: nullifer,
        amount,
        receiver: 0,
        relayer: 0,
        deposit: 1
      };

      if (!isConnected) {
        toast.error("Connect your wallet");
        throw Error('User disconnected');
      }

      const ethersProvider = new BrowserProvider(walletProvider);
      const signer = await ethersProvider.getSigner();


      const { proof, publicInputs } = await noir!.generateFinalProof(inputProof);
      console.log('Proof created: ', proof);
      setProof({ proof, publicInputs });


      const address = addresses.verifier;
      const twister = Twister__factory.connect(address, signer);
      const tx = await twister.withdraw(inputProof.leaf, proof, { value: amount });
      await tx.wait();
    } catch (error) {
      console.log(error);
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
      <div className='tab-form'>
        <span>Relayer</span>
        <input className='input' name="relayer" type={'text'} onChange={handleChange} value={input.relayer} />
      </div>
      <div className='tab-form'>
        <span>Receiver</span>
        <input className='input' name="receiver" type={'text'} onChange={handleChange} value={input.receiver} />
      </div>
      <button className='button' onClick={withdrawAmount}>Withdraw</button>
    </div>
  );
}

export default Withdraw;
