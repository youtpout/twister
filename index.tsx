import React, { ReactNode, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import Component from './components/index';
import "@fontsource/space-grotesk";

import initNoirWasm from '@noir-lang/noir_wasm';
import initNoirC from '@noir-lang/noirc_abi';
import initACVM from '@noir-lang/acvm_js';
import { WagmiConfig } from 'wagmi';
import { config } from './utils/wagmi';

import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react'

// 1. Get projectId at https://cloud.walletconnect.com
const projectId = 'f94b94e9d7b3bbb37b15452ca3e8fef1'

// 2. Set chains
const mainnet = {
  chainId: 1,
  name: 'Ethereum',
  currency: 'ETH',
  explorerUrl: 'https://etherscan.io',
  rpcUrl: 'https://cloudflare-eth.com'
}

const hardhat = {
  chainId: 31337,
  name: 'Hardhat',
  currency: 'ETH',
  explorerUrl: 'https://etherscan.io',
  rpcUrl: 'http://localhost:8545'
}


const scrollSepolia = {
  chainId: 534351,
  name: 'Scroll Sepolia',
  currency: 'ETH',
  explorerUrl: 'https://sepolia.scrollscan.com',
  rpcUrl: 'https://sepolia-rpc.scroll.io/'
}


// 3. Create modal
const metadata = {
  name: 'Twister',
  description: 'Twister is an anonymous transfer POC on scroll sepolia created with noir.',
  url: 'https://youtpout.github.io/twister/', // origin must match your domain & subdomain
  icons: ['https://youtpout.github.io/twister/twister.png']
}

createWeb3Modal({
  ethersConfig: defaultConfig({ metadata }),
  chains: [scrollSepolia],
  projectId,
  enableAnalytics: true // Optional - defaults to your Cloud configuration
})


const InitWasm = ({ children }) => {
  const [init, setInit] = React.useState(false);
  useEffect(() => {
    (async () => {
      await Promise.all([
        import("@noir-lang/noirc_abi").then(module =>
          module.default(new URL("@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm", import.meta.url).toString())
        ),
        import("@noir-lang/acvm_js").then(module =>
          module.default(new URL("@noir-lang/acvm_js/web/acvm_js_bg.wasm", import.meta.url).toString())
        )
      ]);
      setInit(true);
    })();
  });

  return <div>{init && children}</div>;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return <WagmiConfig config={config}>{mounted && children}</WagmiConfig>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Providers>
    <InitWasm>
      <Component />
      <ToastContainer />
    </InitWasm>
  </Providers>,
);
