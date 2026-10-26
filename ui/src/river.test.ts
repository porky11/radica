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

test("river: a private room built, joined and read through the committed river.wasm", async () => {
  const call = await loadRiver(readFileSync(new URL("./river.wasm", import.meta.url)));
  const [ann, bob, eve] = [keys(1), keys(2), keys(3)];
  const apply = (state: string, delta: string) => call({ op: "apply", owner_vk: ann.vk, state, delta }).state as string;
  const say = (who: { sk: string }, state: string, text: string, extra = {}) =>
    apply(state, call({ op: "message", author_sk: who.sk, owner_vk: ann.vk, state, text, time_ms: Date.now(), ...extra }).delta);

  let state = call({ op: "new_room", owner_sk: ann.sk, name: "SOS", nickname: "Ann", private: true, time_ms: Date.now() }).state;
  state = say(ann, state, "hello");
  const inv = call({ op: "invite", inviter_sk: ann.sk, owner_vk: ann.vk, state, invitee_vk: bob.vk });
  state = say(bob, state, "hi", { join: { member: inv.member, secret: inv.secret }, nickname: "Bob" });
  // not a member: no room secret, so nothing to send (and River would drop it anyway)
  assert.throws(() => say(eve, state, "spam"), /no room secret/);

  const view = call({ op: "read", owner_vk: ann.vk, state, member_sk: bob.sk });
  assert.equal(view.name, "SOS");
  assert.deepEqual(view.messages.map((m: any) => [m.author, m.text]), [[ann.vk, "hello"], [bob.vk, "hi"]]);
  assert.equal(call({ op: "read", owner_vk: ann.vk, state, member_sk: eve.sk }).messages.length, 0);
  assert.throws(() => call({ op: "invite", inviter_sk: bob.sk, owner_vk: ann.vk, state, invitee_vk: eve.vk }), /only the room owner/);
});
