import {
  useState,
  useEffect,
  SetStateAction,
  ReactEventHandler,
  FormEvent,
  ChangeEvent,
} from 'react';

import { toast } from 'react-toastify';
import React from 'react';

import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend, } from '@noir-lang/backend_barretenberg';
import { CompiledCircuit, ProofData } from '@noir-lang/types';
import { compile, createFileManager } from '@noir-lang/noir_wasm';

import { useAccount, useConnect, useContractWrite } from 'wagmi';
import { contractCallConfig } from '../utils/wagmi.jsx';
import { bytesToHex } from 'viem';
import circuit from '../circuits/target/noirstarter.json';


function Component() {
  const [input, setInput] = useState({ x: 0, y: 0 });
  const [proof, setProof] = useState<ProofData>();
  const [noir, setNoir] = useState<Noir | null>(null);
  const [backend, setBackend] = useState<BarretenbergBackend | null>(null);

  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const { write, data, error, isLoading, isError } = useContractWrite({
    ...contractCallConfig,
    functionName: 'verify',
  });

  // Handles input state
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target) setInput({ ...input, [e.target.name]: e.target.value });
  };

  // Calculates proof
  const calculateProof = async () => {
    const calc = new Promise(async (resolve, reject) => {
      const { proof, publicInputs } = await noir!.generateFinalProof(input);
      console.log('Proof created: ', proof);
      setProof({ proof, publicInputs });
      resolve(proof);
    });
    toast.promise(calc, {
      pending: 'Calculating proof...',
      success: 'Proof calculated!',
      error: 'Error calculating proof',
    });
  };

  const verifyProof = async () => {
    const verifyOffChain = new Promise(async (resolve, reject) => {
      if (proof) {
        const verification = await noir!.verifyFinalProof({
          proof: proof.proof,
          publicInputs: proof.publicInputs,
        });
        console.log('Proof verified: ', verification);
        resolve(verification);
      }
    });

    toast.promise(verifyOffChain, {
      pending: 'Verifying proof off-chain...',
      success: 'Proof verified off-chain!',
      error: 'Error verifying proof',
    });

    connectors.map(c => c.ready && connect({ connector: c }));

    if (proof) {
      write?.({
        args: [bytesToHex(proof.proof)],
      });
    }
  };

  useEffect(() => {
    if (proof) {
      verifyProof();
      return () => {
        backend!.destroy();
      };
    }
  }, [proof]);

  useEffect(() => {
    if (data) toast.success('Proof verified on-chain!');
  }, [data]);

  const initNoir = async () => {
        // @ts-ignore
    const backend = new BarretenbergBackend(circuit, { threads: 8 });
    setBackend(backend);

    // @ts-ignore
    const noir = new Noir(circuit, backend);

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

    await toast.promise(noir.generateFinalProof(input), {
      pending: 'Initializing Noir...',
      success: 'Noir initialized!',
      error: 'Error initializing Noir',
    });
    setNoir(noir);
  };

  useEffect(() => {
    initNoir();
  }, []);

  return (
    <div className="container">
      <h1>Example starter</h1>
      <h2>This circuit checks that x and y are different</h2>
      <p>Try it!</p>
      <input name="x" type={'number'} onChange={handleChange} value={input.x} />
      <input name="y" type={'number'} onChange={handleChange} value={input.y} />
      <button onClick={calculateProof}>Calculate proof</button>
    </div>
  );
}

export default Component;
