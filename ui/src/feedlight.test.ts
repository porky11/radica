import test from "node:test";
import assert from "node:assert/strict";
import { newestPosts, newestPostsAsync } from "./feedlight.ts";

const raw = JSON.stringify({ posts: { a: { id: "a", timestamp: 1 }, b: { id: "b", timestamp: 3 }, c: { id: "c", timestamp: 2 } } });

test("newest first, capped", () => {
  assert.deepEqual(newestPosts(raw, 2).map((p) => p.id), ["b", "c"]);
});
test("async falls back to inline without Worker", async () => {
  assert.equal((await newestPostsAsync(raw))[0].id, "b");
});
