// A Viso persona's public profile (name and bio), read from the persona's own identity contract, as Viso's demo does.
// The node serving it is untrusted: the profile slot is shown only when its signature by the persona key checks out.
// Format: github.com/scobru/viso, docs/resources.md and common/src/state.rs.
import * as ed from "@noble/ed25519";
import { blake3 } from "@noble/hashes/blake3.js";
import { asBytes, asNumber, asString, cborDecode, cborEncode, mapGet } from "./cbor.ts";

/** blake3 of Viso's identity_contract.wasm (ui/contracts, pinned in scripts/wasm-hashes.txt by its sha256 29aaf06a…).
 *  shortcut: a new Viso contract build moves every persona's address; update this hash with it. */
export const VISO_IDENTITY_CODE_HASH = "20ec0599f4b7c9f2e2d0034e26b8195eb2d02b8ccb791643f5751e75e2477a89";

const enc = new TextEncoder();
const hex = (h: string) => ed.etc.hexToBytes(h);
const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
const u32le = (n: number) => new Uint8Array(new Uint32Array([n]).buffer);
const u64le = (n: number) => new Uint8Array(new BigUint64Array([BigInt(n)]).buffer);

/** The contract's parameters, CBOR { version: 1, pubkey }: with the code hash they give the persona's address. */
export const visoIdentityParams = (pkHex: string) => cborEncode({ version: 1, pubkey: hex(pkHex) });

/** The persona's identity contract instance id: blake3(code hash || params), like any Freenet contract. */
export const visoIdentityInstance = (pkHex: string) => blake3(cat(hex(VISO_IDENTITY_CODE_HASH), visoIdentityParams(pkHex)));

/** The signed profile in a persona's identity state, or null (no profile, a destroyed persona, a bad signature). */
export async function visoProfileOf(state: Uint8Array, pkHex: string): Promise<{ name: string; bio: string } | null> {
  try {
    const s = cborDecode(state);
    if (mapGet(s, "destroyed") != null) return null;
    const slot = mapGet(mapGet(s, "slots"), "profile");
    if (!slot) return null;
    const bytes = asBytes(mapGet(slot, "bytes"));
    const time = asNumber(mapGet(slot, "time_ms"));
    if (!bytes.length) return null; // a deleted profile
    const name = enc.encode("profile");
    const msg = cat(enc.encode("whoiam-slot-v1"), hex(pkHex), u32le(name.length), name, u64le(time), blake3(bytes));
    if (!(await ed.verifyAsync(asBytes(mapGet(slot, "sig")), msg, hex(pkHex)))) return null;
    const p = cborDecode(bytes);
    // Viso's own limits (64 and 280 characters); plain text, never markup
    return { name: [...asString(mapGet(p, "name"))].slice(0, 64).join("").trim(), bio: [...asString(mapGet(p, "bio"))].slice(0, 280).join("") };
  } catch {
    return null;
  }
}
