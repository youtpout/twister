import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react'
import ConnectButton from './connect.jsx';
import "./header.scss";

export default function Header() {
    return <header>
        <div className='title'>🌪️ Twister</div>
        <ConnectButton></ConnectButton>
    </header>;
}