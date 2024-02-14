import {
  useState,
  useEffect,
  SetStateAction,
  ReactEventHandler,
  FormEvent,
  ChangeEvent,
} from 'react';

import "./index.scss";

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
import ConnectButton from './connect.jsx';
import Header from './header.jsx';
import Deposit from './deposit.jsx';


function Component() {

  return (
    <>
      <Header></Header>
      <div className="container">
        <h1 className='title-page'>Transfer Ethereum privately</h1>
        <Deposit></Deposit>
      </div>
    </>
  );
}

export default Component;
