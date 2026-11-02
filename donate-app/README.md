# Radica donate page

Static page, outside Freenet (wallets cannot reach the Freenet sandbox), for the `RadicaSupport` contract:

1. connect a wallet;
2. sign a message to derive the Semaphore supporter identity (same wallet, same identity);
3. donate USDC (approve, then `donate`);
4. paste a Radica public key and generate a zero-knowledge proof of the tier, bound to that key. The proof is checked
   on-chain (`Semaphore.verifyProof`) before it is shown, and comes out as a `RADICA-ZK-V1:` token.

No server and no keys: build it and host `dist/` anywhere (GitHub Pages, IPFS).

```bash
npm install
npm test
npm run build
```

Contract addresses are in `src/config.js` (Base Sepolia for now). Group members come from the Semaphore subgraph; the
page checks the group root against the chain before proving, so a wrong index cannot produce a bad proof.
