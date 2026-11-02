import test from "node:test";
import assert from "node:assert/strict";
import { burnAtOf, checksHtml, createConversationState, deliveryOf, dmPeerOf, nextTtl, TYPING_SHOWN_MS } from "./conversationState.ts";
import type { ChatMessage } from "./types.ts";

const A = "a".repeat(64);
const B = "b".repeat(64);

test("conversationState: burnAtOf prefers burn_at, else timestamp + ttl, else never", () => {
  assert.equal(burnAtOf({ timestamp: 1000, burn_at: 5000, ttl_seconds: 10 }), 5000);
  assert.equal(burnAtOf({ timestamp: 1000, ttl_seconds: 10 }), 11000);
  assert.equal(burnAtOf({ timestamp: 1000, ttl_seconds: 0 }), undefined);
  assert.equal(burnAtOf({ timestamp: 1000 }), undefined);
});

test("conversationState: nextTtl cycles the presets and wraps to Off", () => {
  assert.equal(nextTtl(0), 10);
  assert.equal(nextTtl(10), 30);
  assert.equal(nextTtl(86400), 0);
  assert.equal(nextTtl(12345), 0); // unknown value starts the cycle over
});

test("conversationState: dmPeerOf finds the peer of DMs and Secret Chats only", () => {
  assert.equal(dmPeerOf(`${A}:${B}`, A), B);
  assert.equal(dmPeerOf(`${A}:${B}`, B), A);
  assert.equal(dmPeerOf(`secret_${A}_${B}`, A), B);
  assert.equal(dmPeerOf(`${A}:${B}`, "c".repeat(64)), null);
  assert.equal(dmPeerOf("comm_radica", A), null);
  assert.equal(dmPeerOf("privroom_river_0123", A), null);
});

test("conversationState: delivery and its checks", () => {
  assert.equal(deliveryOf({ id: "msg_opt_1", timestamp: 5 }, 0), "sending");
  assert.equal(deliveryOf({ id: "m1", timestamp: 5 }, 0), "sent");
  assert.equal(deliveryOf({ id: "m1", timestamp: 5 }, 5), "read");
  assert.equal(deliveryOf({ id: "m1", timestamp: 6 }, 5), "sent");
  assert.equal(deliveryOf({ id: "m1", timestamp: 6, is_read: true }, 0), "read");
  assert.match(checksHtml("read", "rm"), /class="rm-checks read"/);
  assert.match(checksHtml("sending", "rv"), /^<span class="rv-checks ".*>✓<\/span>$/);
});

function msg(id: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id, room_id: "r", sender: A, text: "", timestamp: Date.now(), sig: "", ...extra };
}

test("conversationState: expired messages burn once, even across sweeps; others burn on time", async () => {
  const burned: string[] = [];
  const room = { roomId: `secret_${A}_${B}`, messages: [msg("old", { burn_at: Date.now() - 1 }), msg("soon", { burn_at: Date.now() + 40 }), msg("keep")] };
  const state = createConversationState({
    me: () => A,
    secretRooms: () => [room],
    burn: async (_roomId, id) => {
      burned.push(id);
    },
    sendTyping: () => {},
  });
  state.sweepBurns();
  state.sweepBurns();
  assert.deepEqual(burned, ["old"]);
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(burned, ["old", "soon"]);
});

test("conversationState: typing is throttled out and expires in", () => {
  let t = 10_000;
  const sent: string[] = [];
  const changes: string[] = [];
  const state = createConversationState({
    me: () => A,
    secretRooms: () => [],
    burn: async () => {},
    sendTyping: (r) => sent.push(r),
    now: () => t,
  });
  state.localTyping("r1");
  t += 1000;
  state.localTyping("r1");
  t += 2000;
  state.localTyping("r1");
  assert.deepEqual(sent, ["r1", "r1"]);

  state.onTypingChange((r) => changes.push(r));
  state.remoteTyping("r1", A); // me: ignored
  state.remoteTyping("r1", B);
  assert.deepEqual(state.typersIn("r1"), [B]);
  assert.deepEqual(changes, ["r1"]);
  t += TYPING_SHOWN_MS + 1;
  assert.deepEqual(state.typersIn("r1"), []);
});
