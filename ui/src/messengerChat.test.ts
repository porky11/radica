import test from "node:test";
import assert from "node:assert/strict";
import { computeSafetyBlocks, shouldHydratePreview, shouldUpdateCachedPreview } from "./messengerLogic.ts";

test("shouldHydratePreview: never hydrates the currently open room (prevents River optimistic microtask spinlock)", () => {
  assert.equal(
    shouldHydratePreview({
      type: "priv",
      roomId: "river_abc123",
      openRoomId: "river_abc123",
      stamp: 1,
      lastHydratedStamp: 1700000005000,
    }),
    false
  );
});

test("shouldHydratePreview: skips community rooms, empty stamps, and already-hydrated stamps, but hydrates closed E2EE rooms", () => {
  assert.equal(
    shouldHydratePreview({
      type: "comm",
      roomId: "comm_radica",
      openRoomId: null,
      stamp: 100,
      lastHydratedStamp: undefined,
    }),
    false
  );
  assert.equal(
    shouldHydratePreview({
      type: "dm",
      roomId: "dm_1",
      openRoomId: "river_abc123",
      stamp: 0,
      lastHydratedStamp: undefined,
    }),
    false
  );
  assert.equal(
    shouldHydratePreview({
      type: "priv",
      roomId: "river_closed",
      openRoomId: "river_abc123",
      stamp: 1,
      lastHydratedStamp: 1,
    }),
    false
  );
  assert.equal(
    shouldHydratePreview({
      type: "priv",
      roomId: "river_closed",
      openRoomId: "river_abc123",
      stamp: 1,
      lastHydratedStamp: undefined,
    }),
    true
  );
  assert.equal(
    shouldHydratePreview({
      type: "dm",
      roomId: "dm_1",
      openRoomId: "river_abc123",
      stamp: 200,
      lastHydratedStamp: 100,
    }),
    true
  );
});

test("shouldUpdateCachedPreview: never overwrites a newer optimistic preview with an older stored message", () => {
  const optimistic = { text: "just sent in River", sender: "me", timestamp: 2000, optimistic: true };
  const olderCached = { text: "older cached river msg", sender: "peer", timestamp: 1000 };
  assert.equal(shouldUpdateCachedPreview(optimistic, olderCached), false);

  const confirmedSameTs = { text: "just sent in River", sender: "me", timestamp: 2000, optimistic: false };
  assert.equal(shouldUpdateCachedPreview(optimistic, confirmedSameTs), true);

  const confirmedNewer = { text: "just sent in River", sender: "me", timestamp: 2005, optimistic: false };
  assert.equal(shouldUpdateCachedPreview(optimistic, confirmedNewer), true);

  assert.equal(shouldUpdateCachedPreview(confirmedNewer, confirmedNewer), false);
});

test("computeSafetyBlocks: returns 12 deterministic 5-digit blocks symmetrically", () => {
  const a = "aa".repeat(32);
  const b = "bb".repeat(32);
  const blocksAB = computeSafetyBlocks(a, b);
  const blocksBA = computeSafetyBlocks(b, a);
  assert.deepEqual(blocksAB, blocksBA);
  assert.equal(blocksAB.length, 12);
  for (const block of blocksAB) {
    assert.match(block, /^\d{5}$/);
  }
});
