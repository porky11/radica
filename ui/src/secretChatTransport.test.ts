import test from "node:test";
import assert from "node:assert/strict";
import * as ed from "@noble/ed25519";
import type { ChatMessage, UserIdentity } from "./types.ts";
import {
  addSecretChatPeer,
  removeSecretChatPeer,
  burnSecretMessage,
  readSecretChat,
  secretChatPeers,
  sendSecretChatMessage,
  type SecretChatTransport,
} from "./secretChatTransport.ts";

/** Published encryption keys (profiles): persona -> key. */
const encPubs = new Map<string, string>();

/** A local identity, or a Viso one: a persona key with a different app key that signs and decrypts. */
async function person(viso = false): Promise<UserIdentity> {
  const secretKey = crypto.getRandomValues(new Uint8Array(32));
  const encPub = ed.etc.bytesToHex(await ed.getPublicKeyAsync(secretKey));
  const pubkey = viso ? ed.etc.bytesToHex(await ed.getPublicKeyAsync(crypto.getRandomValues(new Uint8Array(32)))) : encPub;
  encPubs.set(pubkey, encPub);
  return { pubkey, secretKey, encPub, sign: async () => "sig" };
}

/** One device: its own page storage; `deliver` writes into the devices whose inbox is named. */
function device(network: Map<string, SecretChatTransport>, blocked: string[] = []): SecretChatTransport {
  const map = new Map<string, string>();
  const t: SecretChatTransport = {
    store: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) },
    blockedBy: () => new Set(blocked),
    visibleChat: (roomId) => JSON.parse(map.get(`freenet_chat_${roomId}`) || "[]"),
    encPubOf: async (k) => encPubs.get(k) ?? k,
    deliver: async (entry: any, inboxes) => {
      for (const who of inboxes) {
        const other = network.get(who);
        if (!other || other === t || entry.type !== "chat") continue;
        const key = `freenet_chat_${entry.message.room_id}`;
        other.store.setItem(key, JSON.stringify([...JSON.parse(other.store.getItem(key) || "[]"), entry.message]));
      }
    },
  };
  return t;
}

test("secretChatTransport: Alice sends, Bob reads it, and Alice still reads her own message", async () => {
  const [alice, bob] = [await person(), await person()];
  const network = new Map<string, SecretChatTransport>();
  const [ta, tb] = [device(network), device(network)];
  network.set(alice.pubkey, ta);
  network.set(bob.pubkey, tb);

  const sent = await sendSecretChatMessage(ta, alice, bob.pubkey, "ciao Bob", 0);
  assert.equal(sent.text, "ciao Bob");
  assert.ok(JSON.parse(ta.store.getItem(`freenet_chat_${sent.room_id}`)!)[0].text.startsWith("secret:v1:"), "stored sealed");

  assert.deepEqual((await readSecretChat(tb, bob, alice.pubkey)).map((m) => m.text), ["ciao Bob"]);
  assert.deepEqual((await readSecretChat(ta, alice, bob.pubkey)).map((m) => m.text), ["ciao Bob"]);
  assert.deepEqual(secretChatPeers(ta, alice.pubkey), [bob.pubkey]);
});

test("secretChatTransport: Viso users (app key, not persona key) read and are read", async () => {
  // one sender per pair: Secret Chat sessions live in the one global page storage, which the two test devices share
  for (const visoSends of [true, false]) {
    const [from, to] = visoSends ? [await person(true), await person()] : [await person(), await person(true)];
    const network = new Map<string, SecretChatTransport>();
    const [tf, tt] = [device(network), device(network)];
    network.set(from.pubkey, tf);
    network.set(to.pubkey, tt);

    await sendSecretChatMessage(tf, from, to.pubkey, "ciao", 0);
    assert.deepEqual((await readSecretChat(tt, to, from.pubkey)).map((m) => m.text), ["ciao"]);
    assert.deepEqual((await readSecretChat(tf, from, to.pubkey)).map((m) => m.text), ["ciao"]);
  }
});

test("secretChatTransport: expired and burned messages are gone; blocked people are not added", async () => {
  const [alice, bob] = [await person(), await person()];
  const ta = device(new Map());
  const roomKey = `freenet_chat_secret_${[alice.pubkey, bob.pubkey].sort().join("_")}`;
  const old: ChatMessage = { id: "old", room_id: "r", sender: bob.pubkey, text: "x", timestamp: 1, sig: "", burn_at: Date.now() - 1 };
  const keep: ChatMessage = { id: "keep", room_id: "r", sender: bob.pubkey, text: "plain", timestamp: 2, sig: "" };
  ta.store.setItem(roomKey, JSON.stringify([old, keep]));
  assert.deepEqual((await readSecretChat(ta, alice, bob.pubkey)).map((m) => m.id), ["keep"]);
  assert.deepEqual(JSON.parse(ta.store.getItem(roomKey)!).map((m: ChatMessage) => m.id), ["keep"]);

  burnSecretMessage(ta, roomKey.slice("freenet_chat_".length), "keep", alice.pubkey, bob.pubkey);
  assert.deepEqual(JSON.parse(ta.store.getItem(roomKey)!), []);

  const tBlocking = device(new Map(), [bob.pubkey]);
  addSecretChatPeer(tBlocking, alice.pubkey, bob.pubkey);
  assert.deepEqual(secretChatPeers(tBlocking, alice.pubkey), []);
});

test("secretChatTransport: a removed Secret Chat stays removed until a newer message", async () => {
  const [alice, bob] = [await person(), await person()];
  const ta = device(new Map());
  addSecretChatPeer(ta, alice.pubkey, bob.pubkey, 1000);
  removeSecretChatPeer(ta, alice.pubkey, bob.pubkey);
  addSecretChatPeer(ta, alice.pubkey, bob.pubkey, 1000); // the old inbox entry, replayed by a refresh
  assert.deepEqual(secretChatPeers(ta, alice.pubkey), []);
  addSecretChatPeer(ta, alice.pubkey, bob.pubkey, Date.now() + 1000); // a message sent after the removal
  assert.deepEqual(secretChatPeers(ta, alice.pubkey), [bob.pubkey]);
});

test("secretChatTransport: a timed message sent with the placeholder's id replaces it instead of showing twice", async () => {
  const [alice, bob] = [await person(), await person()];
  const network = new Map<string, SecretChatTransport>();
  const [ta, tb] = [device(network), device(network)];
  network.set(alice.pubkey, ta);
  network.set(bob.pubkey, tb);
  const id = "scmsg_placeholder_1";
  const roomKey = `freenet_chat_${(await sendSecretChatMessage(ta, alice, bob.pubkey, "first", 3600)).room_id}`;
  // the screen's placeholder, as main.ts stores it before sending
  ta.store.setItem(roomKey, JSON.stringify([...JSON.parse(ta.store.getItem(roomKey)!), { id, text: "ciao", sender: alice.pubkey }]));
  await sendSecretChatMessage(ta, alice, bob.pubkey, "ciao", 3600, undefined, id);
  const stored = JSON.parse(ta.store.getItem(roomKey)!);
  assert.equal(stored.filter((m: { id: string }) => m.id === id).length, 1);
  assert.ok(stored.find((m: { id: string }) => m.id === id).text.startsWith("secret:v1:"), "the placeholder's plain text is gone");
  assert.deepEqual((await readSecretChat(ta, alice, bob.pubkey)).map((m) => m.text), ["first", "ciao"]);
});
