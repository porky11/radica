# Radica attester

Bot that turns donations into supporter badges with no human in the loop:

1. A supporter makes a ZK proof on the donate page and pastes the `RADICA-ZK-V1:` token in Radica, which publishes it
   in the Freenet log `supporter-claims`.
2. The attester reads new claims, checks each one:
   - the proof is for the same Radica key that published the claim;
   - the scope, chain, contract and tier group are Radica's;
   - the donation (nullifier) was not already attested for another key;
   - `Semaphore.verifyProof` accepts it on-chain.
3. For a valid claim it signs a supporter receipt and publishes it in the log `supporter-receipts`; Radica picks it up
   and activates the badge.

The attester never learns which wallet donated, and every claim stays public, so anyone can re-check its work.

## Run

From the repository root, on a machine with Docker:

```bash
docker compose -f attester/docker-compose.yml up -d --build
```

```bash
docker compose -f attester/docker-compose.yml logs -f attester
```

The first start prints `attester key (add to RECEIPT_ISSUERS): <pubkey>`. Add that key to `RECEIPT_ISSUERS` in
`ui/src/supporter.ts` and publish Radica: until then, Radica ignores its receipts.

The key is in the `attester-data` volume (`/data/attester.key`). Back it up. If it leaks, remove it from
`RECEIPT_ISSUERS`: the thief can only mint badges, never touch funds.

Settings (environment): `FREENET_WS`, `RADICA_APP` (Radica's app path), `RPC_URLS` (comma separated), `POLL_MS`,
`DATA_DIR`. Chain addresses come from `donate-app/src/config.js`.

## Test

```bash
npm install && npm test
```

Needs `ui` and `donate-app` dependencies installed: the tests check receipts and log signatures against Radica's own code.
