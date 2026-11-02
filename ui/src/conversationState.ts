// Conversation state (see CONTEXT.md): everything about a conversation that is not the message text — when each
// message burns, how far the peer has read, who is typing, the next TTL. Both chat views (Messenger and Classic)
// read it from here instead of keeping their own copies.

import type { ChatMessage } from "./types.ts";
import { TTL_PRESETS, isSecretRoomId, peerFromSecretRoomId, scheduleMessageBurn } from "./secretChat.ts";

/** Send at most one "typing" signal per this many ms. */
export const TYPING_SEND_EVERY_MS = 2500;
/** A "typing" signal shows for this long unless another one arrives. */
export const TYPING_SHOWN_MS = 4000;

/** When a message burns, or undefined if it never does. */
export function burnAtOf(m: Pick<ChatMessage, "timestamp" | "ttl_seconds" | "burn_at">): number | undefined {
  if (m.burn_at) return m.burn_at;
  return m.ttl_seconds && m.ttl_seconds > 0 ? m.timestamp + m.ttl_seconds * 1000 : undefined;
}

/** The TTL after `current` in the preset cycle (Off → 10s → … → 24h → Off). */
export function nextTtl(current: number): number {
  const i = TTL_PRESETS.findIndex((p) => p.seconds === current);
  return TTL_PRESETS[(i + 1) % TTL_PRESETS.length].seconds;
}

/** The other person of a one-to-one conversation (direct message or Secret Chat); null for rooms and communities. */
export function dmPeerOf(roomId: string, me: string): string | null {
  if (isSecretRoomId(roomId)) return peerFromSecretRoomId(roomId, me) || null;
  const m = /^([0-9a-f]{64}):([0-9a-f]{64})$/.exec(roomId);
  if (!m) return null;
  return m[1] === me ? m[2] : m[2] === me ? m[1] : null;
}

export type Delivery = "sending" | "sent" | "read";

/** Where one of my messages stands: still going to the node, stored, or read by the peer (peer read mark). */
export function deliveryOf(m: Pick<ChatMessage, "id" | "timestamp" | "is_read">, peerReadUpto: number): Delivery {
  if (m.id.startsWith("msg_opt_")) return "sending";
  return m.is_read || (peerReadUpto > 0 && m.timestamp <= peerReadUpto) ? "read" : "sent";
}

/** The ✓ / ✓✓ marks of one of my messages; `prefix` is the view's class prefix ("rm" Messenger, "rv" Classic). */
export function checksHtml(delivery: Delivery, prefix: "rm" | "rv"): string {
  const title = delivery === "read" ? "Read by recipient" : delivery === "sending" ? "Sending to node…" : "Signed & stored on node";
  return `<span class="${prefix}-checks ${delivery === "read" ? "read" : ""}" title="${title}">${delivery === "sending" ? "✓" : "✓✓"}</span>`;
}

/** Refresh every countdown ([data-burn-at]) under `root`; a run-out message fades out of the page. Removing it from
 *  storage is the job of `sweepBurns`, which runs whether or not the conversation is open. */
export function tickBurnCountdowns(root: ParentNode, now = Date.now()): void {
  root.querySelectorAll<HTMLElement>("[data-burn-at]").forEach((tag) => {
    const left = Number(tag.dataset.burnAt) - now;
    if (left > 0) {
      const val = tag.querySelector(".rm-ttl-val, .rv-ttl-val");
      if (val) val.textContent = `${Math.ceil(left / 1000)}s`;
      return;
    }
    const row = tag.closest<HTMLElement>(".rm-msg-row, .chat-bubble");
    if (!row || row.dataset.burning) return;
    row.dataset.burning = "1";
    row.classList.add(row.classList.contains("rm-msg-row") ? "rm-msg-burning" : "rv-msg-burning");
    setTimeout(() => row.remove(), 380);
  });
}

export interface ConversationDeps {
  /** My public key, once signed in. */
  me: () => string | undefined;
  /** The stored messages of every Secret Chat (still sealed is fine: only ids and burn times are read). */
  secretRooms: () => { roomId: string; messages: ChatMessage[] }[];
  /** Remove a message from storage and tell the peer. */
  burn: (roomId: string, messageId: string) => Promise<void>;
  sendTyping: (roomId: string) => void;
  now?: () => number;
}

export type ConversationState = ReturnType<typeof createConversationState>;

export function createConversationState(deps: ConversationDeps) {
  const now = deps.now ?? Date.now;
  const burning = new Set<string>();
  let lastTypingSent = 0;
  const typing = new Map<string, Map<string, number>>(); // room -> sender -> shown until
  const typingListeners = new Set<(roomId: string) => void>();
  const typingChanged = (roomId: string) => typingListeners.forEach((cb) => cb(roomId));

  return {
    /** Schedule every stored message with a TTL to burn at its time; those already past burn now. Safe to call
     *  often (at sign-in and on every sync): a message is burned once. */
    sweepBurns(): void {
      for (const { roomId, messages } of deps.secretRooms()) {
        for (const m of messages) {
          const at = burnAtOf(m);
          if (!at || burning.has(m.id)) continue;
          scheduleMessageBurn(m.id, at, () => {
            if (burning.has(m.id)) return;
            burning.add(m.id);
            void deps.burn(roomId, m.id).catch((e) => {
              burning.delete(m.id);
              console.warn("[Conversation] Could not burn", m.id, e);
            });
          });
        }
      }
    },

    /** I typed in `roomId`: tell the peers, at most once per TYPING_SEND_EVERY_MS. */
    localTyping(roomId: string): void {
      const t = now();
      if (t - lastTypingSent <= TYPING_SEND_EVERY_MS) return;
      lastTypingSent = t;
      deps.sendTyping(roomId);
    },

    /** Someone signalled typing in `roomId`. */
    remoteTyping(roomId: string, sender: string): void {
      if (sender === deps.me()) return;
      if (!typing.has(roomId)) typing.set(roomId, new Map());
      typing.get(roomId)!.set(sender, now() + TYPING_SHOWN_MS);
      typingChanged(roomId);
      setTimeout(() => typingChanged(roomId), TYPING_SHOWN_MS + 50);
    },

    /** Who is typing in `roomId` right now (never me). */
    typersIn(roomId: string): string[] {
      const t = now();
      return [...(typing.get(roomId) ?? new Map<string, number>())].filter(([, until]) => until > t).map(([s]) => s);
    },

    /** Called with a room id whenever who is typing there may have changed. */
    onTypingChange(cb: (roomId: string) => void): () => void {
      typingListeners.add(cb);
      return () => typingListeners.delete(cb);
    },
  };
}
