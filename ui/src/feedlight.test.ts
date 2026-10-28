import test from "node:test";
import assert from "node:assert/strict";
import { lightFeed, lightFeedAsync } from "./feedlight.ts";

const raw = JSON.stringify({ posts: { a: { id: "a", timestamp: 1 }, b: { id: "b", timestamp: 3 }, c: { id: "c", timestamp: 2 } }, profile: { display_name: "Ann" } });

test("newest first, capped, with profile", () => {
  const f = lightFeed(raw, 2);
  assert.deepEqual(f.posts.map((p) => p.id), ["b", "c"]);
  assert.equal(f.profile?.display_name, "Ann");
});
test("async falls back to inline without Worker", async () => {
  assert.equal((await lightFeedAsync(raw)).posts[0].id, "b");
});
test("unreadable feed is empty", async () => {
  assert.deepEqual((await lightFeedAsync("{oops")).posts, []);
});
