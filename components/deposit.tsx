import {
  useState,
  useEffect,
  SetStateAction,
  ReactEventHandler,
  FormEvent,
  ChangeEvent,
} from 'react';
import { Twister__factory, Twister } from "../typechain-types/index.js";
import addresses from "../utils/addresses.json";

import { toast } from 'react-toastify';
import React from 'react';

import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend, } from '@noir-lang/backend_barretenberg';
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
  const [input, setInput] = useState({ secret: 'SecretPassword', amount: 0.01, server: true });
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

  const handleCheck = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target) setInput({ ...input, [e.target.name]: e.target.checked });
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

      if (!input.secret) {
        toast.error("Put a secret");
        setDepositing(false);
        return;
      }
      if (!input.amount || input.amount === "0") {
        toast.error("Put a amount");
        setDepositing(false);
        return;
      }



      await toast.promise(depositAction, {
        pending: 'Calculating proof...',
        success: 'Proof submitted!',
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
        witnesses: Array(8).fill("0x0"),
        leafIndex: "0x0",
        leaf: leaf,
        merkleRoot: "0x0",
        nullifier: "0x0",
        amount: amount,
        receiver: "0x0",
        relayer: "0x0",
        deposit: "0x1"
      };

      if (!isConnected) {
        toast.error("Connect your wallet");
        throw Error('User disconnected');
      }

      const ethersProvider = new BrowserProvider(walletProvider);
      const signer = await ethersProvider.getSigner();
      const address = addresses.verifier;
      const twister: Twister = Twister__factory.connect(address, signer);

      console.log("inputProof", inputProof);


      const commited = await twister.commitments(leaf);
      if (commited) {
        throw Error("This secret/amount pair was already submitted");
      }

      let proof;
      if (input.server) {
        try {

          const prove = await fetch('https://twister.azurewebsites.net/api/twister', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(inputProof)
          });
          console.log("prove", prove);
          const proveResult = await prove.json();
          proof = ethers.toBeArray("0x" + proveResult.proof);
          console.log("proveResult", proveResult);
        } catch (error) {
          throw Error("Proof generation by server failed, try generate proof on web browser.");
        }
      } else {
        const result = await noir!.generateFinalProof(inputProof);
        proof = result.proof;
      }
      console.log('Proof created: ', proof);

      const tx = await twister.deposit(inputProof.leaf, proof, { value: amount });
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
      <div className='tab-check'>
        <input name="server" id='server' type={'checkbox'} onChange={handleCheck} checked={input.server} />
        <label htmlFor="server" >Sindri's server proof</label>
      </div>
      <button className='button' onClick={depositAmount}>Deposit</button>
    </div>
  );
}

export default Deposit;
