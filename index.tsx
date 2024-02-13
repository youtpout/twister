import React, { ReactNode, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import Component from './components/index';

import initNoirWasm from '@noir-lang/noir_wasm';
import initNoirC from '@noir-lang/noirc_abi';
import initACVM from '@noir-lang/acvm_js';
import { WagmiConfig } from 'wagmi';
import { config } from './utils/wagmi';

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
    ,
  </Providers>,
);
