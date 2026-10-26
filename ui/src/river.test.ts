import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ed25519 } from "@noble/curves/ed25519.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { loadRiver } from "./river.ts";

const keys = (seed: number) => {
  const sk = new Uint8Array(32).fill(seed);
  return { sk: bytesToHex(sk), vk: bytesToHex(ed25519.getPublicKey(sk)) };
};

test("river: a room built, joined and read through the committed river.wasm", async () => {
  const call = await loadRiver(readFileSync(new URL("./river.wasm", import.meta.url)));
  const [ann, bob, eve] = [keys(1), keys(2), keys(3)];
  const apply = (state: string, delta: string) => call({ op: "apply", owner_vk: ann.vk, state, delta }).state as string;

  let state = call({ op: "new_room", owner_sk: ann.sk, name: "Radica", nickname: "Ann" }).state;
  state = apply(state, call({ op: "message", author_sk: ann.sk, owner_vk: ann.vk, text: "hello", time_ms: 1 }).delta);
  const member = call({ op: "invite", inviter_sk: ann.sk, owner_vk: ann.vk, invitee_vk: bob.vk }).member;
  state = apply(state, call({ op: "message", author_sk: bob.sk, owner_vk: ann.vk, text: "hi", time_ms: 2, member, nickname: "Bob" }).delta);
  // not a member: River drops the message
  assert.equal(apply(state, call({ op: "message", author_sk: eve.sk, owner_vk: ann.vk, text: "spam", time_ms: 3 }).delta), state);

  const view = call({ op: "read", owner_vk: ann.vk, state });
  assert.equal(view.name, "Radica");
  assert.deepEqual(view.messages.map((m: any) => [m.author, m.text]), [[ann.vk, "hello"], [bob.vk, "hi"]]);
  assert.throws(() => call({ op: "message", author_sk: eve.sk, owner_vk: ann.vk, text: "x", time_ms: 4, member }), /another key/);
});
