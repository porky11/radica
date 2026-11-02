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

Then Base mainnet with `--network base` (add its address to `DEPLOYED` in `scripts/addresses.js`, then `npm run verify:base`). Before mainnet, check on basescan that the Semaphore and USDC addresses in
`scripts/deploy.js` are the right contracts.

## Deployments

| Network      | RadicaSupport                                | Groups sprout / root / oak |
|--------------|----------------------------------------------|----------------------------|
| Base Sepolia | `0x92B853F5B22B0A380bd2Df08B0941D31f720C693` | 7 / 8 / 9 (deploy block 53570725) |
