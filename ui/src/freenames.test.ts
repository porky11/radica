import test from "node:test";
import assert from "node:assert/strict";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { namesOf, nameHref, ownerOf } from "./freenames.ts";

const A = "aa".repeat(32), B = "bb".repeat(32);
const ADMIN = "4498bd4c2ab992afa152bc9b968e246cf70dc4fa5a670b23c33e73b8516ce9f3";
const h = (name: string, o: string, nonce: number) => bytesToHex(sha256(new TextEncoder().encode(`fnc1|${ADMIN}|${name}|${o}|${nonce}`)));
const reg = (s: object) => new TextEncoder().encode(JSON.stringify(s));

test("freenames: the lowest proof hash owns a name, a pin overrides it", () => {
  const s = { claims: { shared: { [A]: { nonce: 1 }, [B]: { nonce: 2 } }, solo: { [A]: { nonce: 7 } }, pinned: { [A]: { nonce: 1 } }, held: { [A]: { nonce: 1 } } }, pins: { map: { pinned: B, held: "" } } };
  const winner = h("shared", A, 1) < h("shared", B, 2) ? A : B;
  assert.equal(ownerOf(s, "shared"), winner);
  assert.equal(ownerOf(s, "pinned"), B);
  assert.equal(ownerOf(s, "held"), null); // reserved
  assert.deepEqual(namesOf(reg(s), A), (winner === A ? ["shared", "solo"] : ["solo"]));
  assert.deepEqual(namesOf(reg(s), B), (winner === B ? ["pinned", "shared"] : ["pinned"]));
});

test("freenames: a malformed registry gives no names", () => {
  assert.deepEqual(namesOf(new TextEncoder().encode("nope"), A), []);
  assert.deepEqual(namesOf(reg({ claims: { "Bad Name": { [A]: { nonce: 1 } } }, pins: { map: {} } }), A), []);
  assert.equal(nameHref("http://n", "scobru"), "http://n/v1/contract/web/CDC7PTxNxfaNnJ3RJs8UrNHTScpT2NTujhvUiwirVejE/#/go/scobru");
});
