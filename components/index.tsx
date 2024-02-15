import {
  useState,
  useEffect,
  SetStateAction,
  ReactEventHandler,
  FormEvent,
  ChangeEvent,
} from 'react';

import "./index.scss";

import React from 'react';

import Header from './header.jsx';
import Deposit from './deposit.jsx';
import Withdraw from './withdraw.jsx';


function Component() {
  const [tabName, setTabName] = useState("deposit");

  return (
    <>
      <Header></Header>
      <div className="container">
        <h1 className='title-page'>Transfer Ethereum privately</h1>
        <div className='tab-block'>
          <div className='tab-header'>
            <span className={tabName === 'deposit' ? 'active' : ''} onClick={() => setTabName('deposit')}>Deposit</span>
            <span className={tabName === 'withdraw' ? 'active' : ''} onClick={() => setTabName('withdraw')}>Withdraw</span>
            {/* <span className={tabName === 'swap' ? 'active' : ''} onClick={() => setTabName('swap')}>Swap</span> */}
          </div>
          <div className='tab-container'>

            {tabName === "deposit" && <Deposit></Deposit>}
            {tabName === "withdraw" &&
              <Withdraw></Withdraw>}
          </div>
        </div>
        <div className='helper'>
          <h3>How to use</h3>
          <h4>Deposit</h4>
          <p>
            Write a custom secret password and keep it secret you will need it to withdraw, write the amount you want to deposit greater than 0.001 ether and in steps of 0.001 you can deposit for example 0.151 ether but not 0.1512 ether
          </p>
          <p>
            Also keep the amount you deposit, you will need it to withdraw
          </p>
          <h4>Withdraw</h4>
          <p>
            You must enter the secret and the amount entered during the deposit, in the amount to withdraw you can enter an amount equal to or less than the amount remaining in your account, you can withdraw a minimum of 0.001 eth and in steps of 0.001 eth
          </p>
          <p>Example you have deposited 0.5 ether with the secret "hello" and you want to withdraw 0.1 ether, when you withdraw you enter this secret "hello", as the amount 0.5 ether, and the amount to withdraw 0.1 ether</p>
          <p>So you have 0.4 ether left and you want to withdraw 0.2 ether again, at the next withdrawal, you enter the secret "hello", amount 0.4 ether, amount to withdraw 0.2 ether, this will allow you to make several withdrawals for the same deposit on different accounts</p>
        </div>
      </div>
    </>
  );
}

export default Component;
