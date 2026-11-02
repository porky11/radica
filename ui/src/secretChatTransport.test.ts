import test from "node:test";
import assert from "node:assert/strict";
import * as ed from "@noble/ed25519";
import type { ChatMessage, UserIdentity } from "./types.ts";
import {
  addSecretChatPeer,
  burnSecretMessage,
  readSecretChat,
  secretChatPeers,
  sendSecretChatMessage,
  type SecretChatTransport,
} from "./secretChatTransport.ts";

async function person(): Promise<UserIdentity> {
  const secretKey = crypto.getRandomValues(new Uint8Array(32));
  const pubkey = ed.etc.bytesToHex(await ed.getPublicKeyAsync(secretKey));
  return { pubkey, secretKey, encPub: pubkey, sign: async () => "sig" };
}

/** One device: its own page storage; `deliver` writes into the devices whose inbox is named. */
function device(network: Map<string, SecretChatTransport>, blocked: string[] = []): SecretChatTransport {
  const map = new Map<string, string>();
  const t: SecretChatTransport = {
    store: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) },
    blockedBy: () => new Set(blocked),
    visibleChat: (roomId) => JSON.parse(map.get(`freenet_chat_${roomId}`) || "[]"),
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
