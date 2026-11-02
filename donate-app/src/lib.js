// Pure helpers of the donate page: no wallet, no network, so they can be tested in Node.

export const TOKEN_PREFIX = "RADICA-ZK-V1:";
/** Fixed scope: one nullifier per identity, so the same donation cannot back two Radica identities. */
export const SCOPE = "radica-supporter-v1";
/** Message the wallet signs to derive the Semaphore identity: same wallet, same identity, nothing to back up. */
export const IDENTITY_MESSAGE =
  "Radica supporter identity v1\n\nSigning this creates your private supporter identity. It costs nothing and sends nothing.";

/** USDC has 6 decimals; thresholds match RadicaSupport. */
export const TIER_MIN = { sprout: 1_000_000n, root: 50_000_000n, oak: 250_000_000n };

export function tierOf(amount) {
  if (amount >= TIER_MIN.oak) return "oak";
  if (amount >= TIER_MIN.root) return "root";
  if (amount >= TIER_MIN.sprout) return "sprout";
  return null;
}

/** "12.5" -> 12500000n; null for anything that is not a positive amount with at most 6 decimals. */
export function parseUsd(text) {
  const m = /^\s*(\d+)(?:\.(\d{1,6}))?\s*$/.exec(text);
  if (!m) return null;
  const v = BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0"));
  return v > 0n ? v : null;
}

/** The proof's message: the Radica public key it vouches for. */
export function messageFor(pubkey) {
  const pk = pubkey.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(pk)) throw new Error("A Radica public key is 64 hexadecimal characters.");
  return BigInt(`0x${pk}`);
}

export function pubkeyOf(message) {
  return BigInt(message).toString(16).padStart(64, "0");
}

/** Inclusive [from, to] block ranges of at most `size` blocks covering from..to: public RPCs cap eth_getLogs ranges. */
export function blockRanges(from, to, size) {
  const out = [];
  for (let a = from; a <= to; a += size) out.push([a, a + size - 1n < to ? a + size - 1n : to]);
  return out;
}

const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

/** Portable token the supporter pastes into Radica; the attester checks it on-chain. */
export function encodeProofToken({ chainId, contract, tier, groupId, proof }) {
  const body = { v: 1, chainId, contract, tier, groupId: String(groupId), proof };
  return TOKEN_PREFIX + b64(JSON.stringify(body, (_, x) => (typeof x === "bigint" ? x.toString() : x)));
}

export function decodeProofToken(token) {
  const t = token.trim();
  if (!t.startsWith(TOKEN_PREFIX)) throw new Error(`Not a ${TOKEN_PREFIX} token`);
  const body = JSON.parse(unb64(t.slice(TOKEN_PREFIX.length)));
  if (body.v !== 1 || !["sprout", "root", "oak"].includes(body.tier) || !body.proof?.points) throw new Error("Malformed proof token");
  return body;
}
