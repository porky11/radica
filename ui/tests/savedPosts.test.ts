import { test } from "node:test";
import assert from "node:assert/strict";
import { isSaved, savedPosts, toggleSaved } from "../src/savedPosts.ts";

const post = (id: string, caption = "hi") => ({ id, author: "a", caption, timestamp: 1, category: "thought" }) as any;

test("saving toggles, newest first, per identity, and drops the oldest past the size cap", () => {
  assert.equal(toggleSaved("me", post("1")), true);
  assert.equal(toggleSaved("me", post("2")), true);
  assert.deepEqual(savedPosts("me").map((p) => p.id), ["2", "1"]);
  assert.equal(isSaved("me", post("1")), true);
  assert.equal(isSaved("other", post("1")), false);
  assert.equal(toggleSaved("me", post("1")), false);
  assert.deepEqual(savedPosts("me").map((p) => p.id), ["2"]);
  for (let i = 0; i < 80; i++) toggleSaved("big", post(`b${i}`, "x".repeat(4000)));
  const kept = savedPosts("big");
  assert.ok(kept.length < 80 && kept[0].id === "b79", `kept ${kept.length}`);
});
