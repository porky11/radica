import test from "node:test";
import assert from "node:assert/strict";
import { feedBytes, oldestToFree } from "./feedsize.ts";
import type { Post } from "./types.ts";

const post = (id: string, timestamp: number, media = ""): Post => ({ id, timestamp, caption: "", media_uri: media } as unknown as Post);

test("feedsize: frees the oldest posts first, only as many as needed", () => {
  const posts = [post("new", 3, "x".repeat(100)), post("old", 1, "x".repeat(100)), post("mid", 2, "x".repeat(100))];
  const one = feedBytes([posts[0]]);
  assert.deepEqual(oldestToFree(posts, one * 3 + 10), []); // already under the target
  assert.deepEqual(oldestToFree(posts, one * 2 + 10), ["old"]);
  assert.deepEqual(oldestToFree(posts, one + 10), ["old", "mid"]);
  assert.deepEqual(oldestToFree(posts, 0), ["old", "mid", "new"]);
});
