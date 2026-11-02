// Secret Chat transport (see CONTEXT.md): storing, sending, reading and burning Secret Chat messages. The crypto is in
// secretChat.ts; this module only needs page storage, the blocklist, a room's stored messages and a way to deliver an
// entry to inbox logs, so FreenetClient plugs in the network and a test plugs in memory.

import type { ChatMessage, UserIdentity } from "./types.ts";
import {
  cancelMessageBurn,
  decryptSecretMessage,
  encryptSecretMessage,
  getActiveSecretChatTTL,
  getOrCreateSecretSession,
  getSecretRoomId,
} from "./secretChat.ts";
import { burnAtOf } from "./conversationState.ts";
import { formatChatMessageSignatureMessage } from "./crypto.ts";

export interface SecretChatTransport {
  /** Page storage (messages, peers). */
  store: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  /** People `me` has blocked. */
  blockedBy(me: string): Set<string>;
  /** A room's stored messages, without those before the last time I cleared it. */
  visibleChat(roomId: string): ChatMessage[];
  /** Deliver `entry` live to open tabs and peers, and into each of these inbox logs. */
  deliver(entry: object, inboxes: string[]): Promise<void>;
}

/** The scratchpad keeps the newest messages of a Secret Chat only. */
const MAX_STORED = 25;
const UNREADABLE = "[Secret message - unable to decrypt or forward secrecy key expired]";

const peersKey = (me: string) => `radica_secret_peers_${me}`;
const roomKey = (roomId: string) => `freenet_chat_${roomId}`;
const readList = <T>(t: SecretChatTransport, key: string): T[] => JSON.parse(t.store.getItem(key) || "[]");

export function secretChatPeers(t: SecretChatTransport, me: string): string[] {
  const blocked = t.blockedBy(me);
  return readList<string>(t, peersKey(me)).filter((p) => !blocked.has(p));
}

export function addSecretChatPeer(t: SecretChatTransport, me: string, peer: string): void {
  if (!me || !peer || me === peer || t.blockedBy(me).has(peer)) return;
  const peers = readList<string>(t, peersKey(me));
  if (!peers.includes(peer)) t.store.setItem(peersKey(me), JSON.stringify([...peers, peer]));
}

export function removeSecretChatPeer(t: SecretChatTransport, me: string, peer: string): void {
  if (!me || !peer) return;
  t.store.setItem(peersKey(me), JSON.stringify(readList<string>(t, peersKey(me)).filter((p) => p !== peer)));
}

/** Seal `text` with a fresh ratchet key, keep the ciphertext, and deliver it to both inboxes. Returns the message with
 *  its plain text, for the sender's own screen. */
export async function sendSecretChatMessage(
  t: SecretChatTransport,
  identity: UserIdentity,
  recipient: string,
  text: string,
  ttlSeconds?: number,
  replyTo?: string
): Promise<ChatMessage> {
  const roomId = getSecretRoomId(identity.pubkey, recipient);
  const id = `scmsg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = Date.now();
  const ttl = ttlSeconds ?? getActiveSecretChatTTL(roomId);

  const session = getOrCreateSecretSession(identity.secretKey, identity.pubkey, recipient, ttl);
  const { ciphertext } = await encryptSecretMessage(session, text, ttl);
  const sig = await identity.sign(formatChatMessageSignatureMessage(id, roomId, identity.pubkey, recipient, ciphertext, timestamp));

  const message: ChatMessage = {
    id,
    room_id: roomId,
    sender: identity.pubkey,
    recipient,
    text: ciphertext,
    timestamp,
    sig,
    is_secret: true,
    ttl_seconds: ttl,
    burn_at: ttl > 0 ? timestamp + ttl * 1000 : undefined,
    ...(replyTo ? { reply_to: replyTo } : {}),
  };

  const stored = [...readList<ChatMessage>(t, roomKey(roomId)), message].slice(-MAX_STORED);
  t.store.setItem(roomKey(roomId), JSON.stringify(stored)); // ciphertext at rest

  addSecretChatPeer(t, identity.pubkey, recipient);
  addSecretChatPeer(t, recipient, identity.pubkey);
  await t.deliver({ type: "chat", message }, [recipient, identity.pubkey]);
  return { ...message, text };
}

/** The Secret Chat with `peer`, decrypted; messages past their burn time are dropped from storage. */
export async function readSecretChat(t: SecretChatTransport, identity: UserIdentity, peer: string): Promise<ChatMessage[]> {
  const roomId = getSecretRoomId(identity.pubkey, peer);
  const messages = t.visibleChat(roomId);
  const now = Date.now();
  const live = messages.filter((m) => !m.burn_at || m.burn_at > now);
  if (live.length !== messages.length) t.store.setItem(roomKey(roomId), JSON.stringify(live));

  return Promise.all(
    live.map(async (msg) => {
      if (!msg.text?.startsWith("secret:v1:")) return msg;
      try {
        const dec = await decryptSecretMessage(identity.secretKey, identity.pubkey, peer, msg.text, msg.sender === identity.pubkey);
        return { ...msg, text: dec.text, ttl_seconds: dec.ttl, burn_at: burnAtOf({ ...msg, ttl_seconds: dec.ttl }) };
      } catch {
        return { ...msg, text: UNREADABLE };
      }
    })
  );
}

/** Remove a message here and tell my other devices and the peer to remove it too. */
export function burnSecretMessage(t: SecretChatTransport, roomId: string, messageId: string, me?: string, peer?: string): void {
  cancelMessageBurn(messageId);
  t.store.setItem(roomKey(roomId), JSON.stringify(readList<ChatMessage>(t, roomKey(roomId)).filter((m) => m.id !== messageId)));
  const inboxes = [me, peer].filter((k): k is string => !!k);
  void t.deliver({ type: "chat_burn", roomId, messageId }, inboxes).catch(() => {});
}
