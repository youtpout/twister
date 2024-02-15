# TWISTER

There is already a popular protocol for depositing an amount and withdrawing it from another account, but unfortunately the deposit amounts are predefined. Would you like to be able to deposit any amount in increments of 0.001 eth and withdraw that amount in one or more transactions.

[Scroll sepolia address 0xda8c05c7f2783b0a8c1410636d379d0cd7cbd644](https://sepolia.scrollscan.dev/address/0xda8c05c7f2783b0a8c1410636d379d0cd7cbd644#code)


# Noir with Vite and Hardhat

[![Netlify Status](https://api.netlify.com/api/v1/badges/e4bd1ebc-6be1-4ed2-8be8-18f70382ae22/deploy-status)](https://app.netlify.com/sites/noir-vite-hardhat/deploys)

This example uses [Vite](https://vite.dev/) as the frontend framework, and
[Hardhat](https://hardhat.org/) to deploy and test.

## Getting Started

Want to get started in a pinch? Start your project in a free Github Codespace!

[![Start your project in a free Github Codespace!](https://github.com/codespaces/badge.svg)](https://codespaces.new/noir-lang/noir-starter/tree/main)

In the meantime, follow these simple steps to work on your own machine:

1. Install [yarn](https://yarnpkg.com/) (tested on yarn v1.22.19)

2. Install [Node.js >20.10 (latest LTS)](https://nodejs.org/en) (tested on v18.17.0)

3. Install [noirup](https://noir-lang.org/getting_started/nargo_installation/#option-1-noirup) with

   ```bash
   curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
   ```

4. Install Nargo with

   ```bash
   noirup
   ```

5. Install dependencies with

   ```bash
   yarn
   ```

## Generate verifier contract

### Contract

The deployment assumes a verifier contract has been generated by nargo. In order to do this, run:

```bash
cd circuits
nargo codegen-verifier
```

A file named `plonk_vk.sol` should appear in the `circuits/contracts/with_foundry` folder.

### Test locally

1. Copy `vite-hardhat/.env.example` to a new file `vite-hardhat/.env`.

2. Start a local development EVM at <http://localhost:8545> with

   ```bash
   npx hardhat node
   ```

   or if foundry is preferred, with

   ```bash
   anvil
   ```

3. Run the [example test file](./test/index.test.ts) with

   ```bash
   yarn test
   ```

The test demonstrates basic usage of Noir in a TypeScript Node.js environment.

### Deploy locally

1. Copy `vite-hardhat/.env.example` to a new file `vite-hardhat/.env`.

2. Start a local development EVM at <http://localhost:8545> with

   ```bash
   npx hardhat node
   ```

   or if foundry is preferred, with

   ```bash
   anvil
   ```

3. Build the project and deploy contracts to the local development chain with

   ```bash
   NETWORK=localhost yarn build
   ```

   > **Note:** If the deployment fails, try removing `yarn.lock` and reinstalling dependencies with
   > `yarn`.

4. Once your contracts are deployed and the build is finished, you can preview the built website with

   ```bash
   yarn preview
   ```

### Deploy on networks

You can choose any other network in `hardhat.config.ts` and deploy there using this `NETWORK`
environment variable.

For example, `NETWORK=mumbai yarn build` or `NETWORK=sepolia yarn build`.

Make sure you:

- Update the deployer private keys in `vite-hardhat/.env`
- Have funds in the deployer account
- Add keys for alchemy (to act as a node) in `vite-hardhat/.env`

Feel free to contribute with other networks in `hardhat.config.ts`
