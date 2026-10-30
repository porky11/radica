// FreeNames (github.com/scobru/freenames): the short public names a persona owns, shown on its profile. Read-only, the
// same owner rule as FreeNames and FH (FH's src/names.ts): the admin's pin, else the claim with the lowest proof hash.
// Nothing to set in Radica: a name counts only when FreeNames' registry gives it to this persona.
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { ContractKey } from "@freenetorg/freenet-stdlib";
import { keyOf } from "./riverPointer.ts";
import { hexToBytes } from "./crypto.ts";

export const FREENAMES_KEY = "CDC7PTxNxfaNnJ3RJs8UrNHTScpT2NTujhvUiwirVejE";
const FREENAMES_PATH = `/v1/contract/web/${FREENAMES_KEY}/`;
const REGISTRY_ADMIN = "4498bd4c2ab992afa152bc9b968e246cf70dc4fa5a670b23c33e73b8516ce9f3"; // FreeNames' ui/src/lib.ts
// shortcut: blake3 of FreeNames' published ui/src/registry.wasm; if FreeNames ships new registry code, update it here
const REGISTRY_CODE = "79eba61ac4e4020f5b7823fd0f88db508909a82753e9bb3a8d1e91c37cb40476";

export interface RegState { claims: Record<string, Record<string, { nonce: number }>>; pins: { map: Record<string, string> } }

export const registryKey = (): ContractKey =>
  keyOf(REGISTRY_CODE, new Uint8Array([...hexToBytes(REGISTRY_ADMIN), ...new TextEncoder().encode(FREENAMES_PATH)]));

const NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** The owner of a registry name: the admin's pin if any ("" = reserved), else the claim with the lowest proof hash. */
export function ownerOf(s: RegState, name: string): string | null {
  if (name in s.pins.map) return s.pins.map[name] || null;
  let best: { o: string; h: string } | null = null;
  for (const [o, c] of Object.entries(s.claims[name] ?? {})) {
    const h = bytesToHex(sha256(new TextEncoder().encode(`fnc1|${REGISTRY_ADMIN}|${name}|${o}|${c.nonce}`)));
    if (!best || h < best.h) best = { o, h };
  }
  return best?.o ?? null;
}

/** The names a persona owns, sorted; registry state from the network, so malformed parts are ignored. */
export function namesOf(state: Uint8Array, persona: string): string[] {
  try {
    const s = JSON.parse(new TextDecoder().decode(state)) as RegState;
    if (typeof s?.claims !== "object" || typeof s?.pins?.map !== "object") return [];
    const names = new Set([...Object.keys(s.claims), ...Object.keys(s.pins.map)]);
    return [...names].filter((n) => NAME.test(n) && ownerOf(s, n) === persona).sort();
  } catch {
    return [];
  }
}

/** FreeNames' lookup page for a name. */
export const nameHref = (origin: string, name: string) => `${origin}/v1/contract/web/${FREENAMES_KEY}/#/go/${encodeURIComponent(name)}`;
