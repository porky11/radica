// The attester's decisions and signatures, with no network: Freenet and the chain are passed in, so tests run offline.
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { stringToHex } from "viem";
import { decodeProofToken, pubkeyOf, SCOPE } from "../../donate-app/src/lib.js";

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

const enc = new TextEncoder();
export const CLAIMS_LOG = "supporter-claims";
export const RECEIPTS_LOG = "supporter-receipts";
/** Semaphore turns a non-numeric string scope into its bytes32 encoding (ethers encodeBytes32String). */
export const SCOPE_FIELD = BigInt(stringToHex(SCOPE, { size: 32 })).toString();

/** Log entry signature: must match log-contract entry_msg and ui/src/crypto.ts formatLogEntryMessage. */
export function logEntryMessage(log, app, author, id, ts, body) {
  const params = bytesToHex(enc.encode(`radica/${log}|${app}`));
  return `radica/log/v1:${params}:${author}:${id}:${ts}:${body}`;
}

export async function signEntry(sk, log, app, bodyObj, now = Date.now()) {
  const author = bytesToHex(await ed.getPublicKeyAsync(sk));
  const id = now.toString(36) + bytesToHex(crypto.getRandomValues(new Uint8Array(3)));
  const body = JSON.stringify(bodyObj);
  const sig = bytesToHex(await ed.signAsync(enc.encode(logEntryMessage(log, app, author, id, now, body)), sk));
  return { author, id, ts: now, body, sig };
}

/** Supporter receipt token: must match ui/src/supporter.ts issueReceipt (no tx hash, day-rounded time). */
export async function issueReceipt(sk, donorPk, tier, now = Date.now()) {
  const ts = Math.floor(now / 864e5) * 864e5;
  const payload = { donor_pk: donorPk.toLowerCase(), tier, chain: "eth", tx_hash: "", ts };
  const msg = `radica/receipt/v1:${payload.donor_pk}:${tier}:eth::${ts}`;
  const sig = bytesToHex(await ed.signAsync(enc.encode(msg), sk));
  const json = JSON.stringify({ v: 1, ...payload, sig });
  return `RADICA-RECEIPT-V1:${btoa(String.fromCharCode(...enc.encode(json)))}`;
}

/**
 * Decide on one claim entry. `seen` maps nullifier -> pubkey already attested; `verifyOnChain(groupId, proof)` asks the
 * Semaphore contract. Returns { ok: true, donor, tier, nullifier } or { ok: false, reason }.
 */
export async function judgeClaim(entry, { chainId, contract, groups, seen, verifyOnChain }) {
  let claim;
  try {
    const body = JSON.parse(entry.body);
    if (body.type !== "claim" || typeof body.token !== "string") return { ok: false, reason: "not a claim" };
    claim = decodeProofToken(body.token);
  } catch (e) {
    return { ok: false, reason: `bad token: ${e.message}` };
  }
  const { proof, tier } = claim;
  if (claim.chainId !== chainId || String(claim.contract).toLowerCase() !== contract.toLowerCase()) return { ok: false, reason: "other chain or contract" };
  if (String(claim.groupId) !== String(groups[tier])) return { ok: false, reason: "group does not match tier" };
  if (String(proof.scope) !== SCOPE_FIELD) return { ok: false, reason: "wrong scope" };
  let donor;
  try {
    donor = pubkeyOf(proof.message);
  } catch {
    return { ok: false, reason: "bad message" };
  }
  if (donor !== entry.author) return { ok: false, reason: "proof is for another Radica key" };
  const prior = seen.get(String(proof.nullifier));
  if (prior && prior !== donor) return { ok: false, reason: "donation already attested for another key" };
  if (!(await verifyOnChain(BigInt(claim.groupId), proof))) return { ok: false, reason: "proof rejected on-chain" };
  return { ok: true, donor, tier, nullifier: String(proof.nullifier) };
}

export { bytesToHex, hexToBytes };
