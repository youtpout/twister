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

function uuidv4() {
  return "1000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}



function Deposit() {
  const [input, setInput] = useState({ secret: 'SecretPassword', amount: 0.1 });
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

  const depositAmount = async () => {
    try {
      if (depositing) {
        console.log("already deposit");
        return;
      }
      setDepositing(true);
      console.log("depositing");


      await toast.promise(depositAction, {
        pending: 'Calculating proof...',
        success: 'Proof calculated!',
        error: 'Error calculating proof',
      });

    } catch (error) {
      console.log(error);
    }
  }

  const depositAction = async () => {
    try {
      let secret = ethers.keccak256(ethers.toUtf8Bytes(input.secret.toLowerCase()));
      let amount = "0x" + ethers.parseEther(input.amount.toString()).toString(16);
      let secretAmount = BigInt(secret);
      const maxModulo = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
      if (secretAmount > maxModulo) {
        do {
          secretAmount = secretAmount - maxModulo;
          secret = "0x" + secretAmount.toString(16);
        } while (secretAmount > maxModulo);
      }


      const poseidon = await getProofInfo(secret, amount);
      let leaf = "0x" + poseidon.leaf.replace('0x', '').padStart(64, 0);

      console.log("input", input);

      let inputProof = {
        secret,
        oldAmount: amount,
        witnesses: Array(8).fill(0),
        leafIndex: 0,
        leaf: leaf,
        merkleRoot: 0,
        nullifier: 0,
        amount: amount,
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

      console.log("inputProof", inputProof);

      if (true) {
        const formData = new URLSearchParams();
        let data = 'secret= 1\noldAmount= 250000000000000000\nwitnesses= [0,0,0,0,0,0,0,0]\nleafIndex= 0\nleaf= \"0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf\"\nmerkleRoot= 0\nnullifier= 0\namount= 250000000000000000\nreceiver= 0\nrelayer= 0\ndeposit= 1';
        formData.append("proof_input", JSON.stringify(data));
        const prove = await fetch("https://sindri.app/api/v1/circuit/1f73ed8a-4963-4c0c-94ba-1791ac1f0b9d/prove", {
          method: "POST",
          body: formData,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "Authorization": "Bearer sindri-Y1qkOKoN734PWkUCxwrJ2a1WhnZtIwLG-Stsk"
          },
        });
        console.log("prove", prove);
        const proveResult = await prove.json();
        console.log("proveResult", proveResult);
      }

      const { proof, publicInputs } = await noir!.generateFinalProof(inputProof);
      console.log('Proof created: ', proof);
      setProof({ proof, publicInputs });

      const address = addresses.verifier;
      const twister = Twister__factory.connect(address, signer);
      const tx = await twister.deposit(inputProof.leaf, proof, { value: amount });
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
        <span>Amount (ETH)</span>
        <input className='input' name="amount" type={'number'} onChange={handleChange} value={input.amount} />
      </div>
      <button className='button' onClick={depositAmount}>Deposit</button>
    </div>
  );
}

export default Deposit;
