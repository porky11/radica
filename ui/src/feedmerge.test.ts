import test from "node:test";
import assert from "node:assert/strict";
import { overlayFeed } from "./feedmerge.ts";
import type { FeedState, Post } from "./types.ts";

const post = (id: string, extra: Partial<Post> = {}): Post =>
  ({ id, author: "me", category: "thought", caption: id, timestamp: 1, sig: "s", is_nsfw: false, likes: {}, comments: {}, ...extra }) as Post;

test("feedmerge: local changes survive a network state that lacks them", () => {
  const net: FeedState = {
    owner: "me",
    posts: { p1: post("p1", { likes: { bob: { liked: true, ts: 5, sig: "b" } } }), p2: post("p2") },
    following: ["x"],
    following_updated_at: 10,
  };
  const comment = { id: "c1", post_id: "p1", author: "al", text: "hi", timestamp: 2, sig: "c" };
  const deltas: FeedState[] = [
    { owner: "me", posts: { p3: post("p3") }, following: [] },
    { owner: "me", posts: { p1: post("p1", { comments: { "al:c1": comment }, likes: { bob: { liked: false, ts: 3, sig: "old" } } }) }, following: [] },
    { owner: "me", posts: {}, following: ["x", "y"], following_updated_at: 20, following_sig: "f" },
    { owner: "me", posts: {}, following: ["z"], following_updated_at: 5, following_sig: "older" },
    { owner: "me", posts: {}, following: [], deleted: { p2: { sig: "d" } } },
  ];
  for (const d of deltas) overlayFeed(net, d);
  assert.deepEqual(Object.keys(net.posts).sort(), ["p1", "p3"]);
  assert.deepEqual(net.posts.p1.comments, { "al:c1": comment });
  assert.equal(net.posts.p1.likes.bob.ts, 5); // the newer like wins
  assert.deepEqual(net.following, ["x", "y"]);
  assert.ok(net.deleted?.p2);
  overlayFeed(net, { owner: "me", posts: { p2: post("p2") }, following: [] });
  assert.equal(net.posts.p2, undefined); // a deleted post does not come back
});
