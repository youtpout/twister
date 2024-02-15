import '@nomicfoundation/hardhat-toolbox-viem';
import '@nomicfoundation/hardhat-viem';
import '@nomicfoundation/hardhat-chai-matchers';
import "@nomicfoundation/hardhat-foundry";
import "@nomicfoundation/hardhat-ethers";
import '@typechain/hardhat';
import "@nomicfoundation/hardhat-verify";

import { HardhatUserConfig } from 'hardhat/config';

import * as dotenv from 'dotenv';
import { subtask } from 'hardhat/config';
import { TASK_COMPILE_SOLIDITY } from 'hardhat/builtin-tasks/task-names';
import { join } from 'path';
import { writeFile } from 'fs/promises';
dotenv.config();

subtask(TASK_COMPILE_SOLIDITY).setAction(async (_, { config }, runSuper) => {
  const superRes = await runSuper();

  try {
    await writeFile(join(config.paths.root, 'artifacts', 'package.json'), '{ "type": "commonjs" }');
  } catch (error) {
    console.error('Error writing package.json: ', error);
  }

  return superRes;
});

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 5000 },
    },
  },
  networks: {
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.MUMBAI_ALCHEMY_KEY}`,
      accounts: [process.env.MUMBAI_DEPLOYER_PRIVATE_KEY as string],
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.SEPOLIA_ALCHEMY_KEY}`,
      accounts: [process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY as string],
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
    scrollSepolia: {
      url: `https://sepolia-rpc.scroll.io`,
      accounts: [process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY as string],
    },
    hardhat: {
      mining: {
        auto: true,
        interval: 1000,
      },
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY as string,
    customChains: [
      {
        network: 'scrollSepolia',
        chainId: 534351,
        urls: {
          apiURL: 'https://sepolia-blockscout.scroll.io/api',
          browserURL: 'https://sepolia-blockscout.scroll.io/',
        },
      },
    ],
  },
  paths: {
    sources: './src',
  },
};

export default config;
