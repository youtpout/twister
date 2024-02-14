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
            <span className={tabName === 'swap' ? 'active' : ''} onClick={() => setTabName('swap')}>Swap</span>
          </div>
          <div className='tab-container'>

            {tabName === "deposit" && <Deposit></Deposit>}
            {tabName === "withdraw" &&
              <Withdraw></Withdraw>}
          </div>
        </div>
      </div>
    </>
  );
}

export default Component;
