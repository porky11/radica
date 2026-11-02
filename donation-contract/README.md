# Radica donation contract

`RadicaSupport` takes USDC donations on Base and sends them straight to the treasury
(`0xA6591dCDff5C7616110b4f84207184aef7835048`). Each donation adds the donor's Semaphore identity commitment to the
group of its tier, so a supporter can later prove "I am an Oak supporter" with a zero-knowledge proof without revealing
which wallet paid.

| Tier   | Minimum |
|--------|---------|
| Sprout | $1      |
| Root   | $50     |
| Oak    | $250    |

No owner, no upgrades, no admin function: once deployed, nobody (the maintainer included) can change the rules or
touch the funds. Old Merkle roots stay valid for proofs for 10 years, so a published proof can be re-checked later.

Donating takes two transactions: `usdc.approve(RadicaSupport, amount)`, then `donate(amount, identityCommitment)`.
Donating again with the same identity works; the commitment joins each group once.

## Test

```bash
npm install
npm test
```

Tests run against mocks and against the real Semaphore contracts.

## Deploy

Base Sepolia first:

```bash
DEPLOYER_KEY=0x... npx hardhat run scripts/deploy.js --network baseSepolia
```

Then verify the source, so wallets (MetaMask's Blockaid) and basescan stop calling it an unknown contract.
`scripts/verify.js` takes the address and constructor arguments from `scripts/addresses.js`; without
`ETHERSCAN_API_KEY` (an etherscan.io key, valid for basescan too) only Sourcify is used.

```bash
ETHERSCAN_API_KEY=... npm run verify:sepolia
```

### Before Base mainnet

1. Move to the latest solc (0.8.38 or newer): bump `SOLC` in `hardhat.config.js` and `solc` in `package.json`, then
   `npm install && npm test`. 0.8.28 has known compiler bugs that basescan lists on the verified contract; none hits
   RadicaSupport (no transient storage, no via-IR, no `delete`), but a fresh deploy should not carry them.
2. Check on basescan that the Semaphore and USDC addresses for chain 8453 in `scripts/addresses.js` are the right
   contracts.
3. `DEPLOYER_KEY=0x... npx hardhat run scripts/deploy.js --network base`, then add the address to `DEPLOYED` in
   `scripts/addresses.js` and run `ETHERSCAN_API_KEY=... npm run verify:base`.
4. Update `donate-app/src/config.js`: `CHAIN_ID` 8453, Base RPCs, `FAUCET_URL = null`, mainnet `SUPPORT`, `USDC`,
   `DEPLOY_BLOCK` and `GROUPS` (printed by the deploy), and add the deployment to the table below.
5. Try a $1 donation with MetaMask: once verified, the USDC `approve` should no longer be flagged "High-risk".

## Deployments

| Network      | RadicaSupport                                | Groups sprout / root / oak |
|--------------|----------------------------------------------|----------------------------|
| Base Sepolia | `0x92B853F5B22B0A380bd2Df08B0941D31f720C693` | 7 / 8 / 9 (deploy block 53570725) |
