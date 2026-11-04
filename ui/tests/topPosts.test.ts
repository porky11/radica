import test from "node:test";
import assert from "node:assert/strict";
import { isFuture, postScore, sortPosts } from "../src/topPosts.ts";
import { likers, type Post } from "../src/types.ts";

const DAY = 86_400_000;
const now = Date.now();
const post = (id: string, ageDays: number, liked: string[], author = "a"): Post =>
  ({ id, author, timestamp: now - ageDays * DAY, likes: Object.fromEntries(liked.map((k) => [k, { liked: true }])) }) as unknown as Post;
const noDislikes = () => [];
const ids = (ps: Post[]) => ps.map((p) => p.id);

test("score: own like does not count, duplicates count once, dislikes subtract", () => {
  assert.equal(postScore(["a", "b", "c"], [], "a"), 2);
  assert.equal(postScore(["b", "b"], ["c", "c"], "a"), 0);
  assert.equal(postScore(["b"], ["c", "d"], "a"), -1);
});

test("recent: newest first, likes ignored", () => {
  const ps = [post("old", 3, ["x", "y"]), post("new", 0, []), post("mid", 1, ["x"])];
  assert.deepEqual(ids(sortPosts(ps, "recent", likers, noDislikes, now)), ["new", "mid", "old"]);
});

test("top: best score first, ties to the newest, nothing at zero or below", () => {
  const ps = [post("p1", 0.5, ["x"]), post("p2", 0.2, ["x", "y"]), post("p3", 0.1, ["x"]), post("none", 0.1, []), post("down", 0.1, ["x"])];
  const dislikers = (p: Post) => (p.id === "down" ? ["y"] : []);
  assert.deepEqual(ids(sortPosts(ps, "top24h", likers, dislikers, now)), ["p2", "p3", "p1"]);
});

test("top window: 24h and 7d drop older posts, all keeps them", () => {
  const ps = [post("today", 0.5, ["x"]), post("week", 5, ["x", "y", "z"]), post("old", 40, ["x", "y", "z", "w"])];
  assert.deepEqual(ids(sortPosts(ps, "top24h", likers, noDislikes, now)), ["today"]);
  assert.deepEqual(ids(sortPosts(ps, "top7d", likers, noDislikes, now)), ["week", "today"]);
  assert.deepEqual(ids(sortPosts(ps, "topAll", likers, noDislikes, now)), ["old", "week", "today"]);
});

test("does not mutate its input", () => {
  const ps = [post("a", 2, ["x"]), post("b", 0, [])];
  sortPosts(ps, "recent", likers, noDislikes, now);
  assert.deepEqual(ids(ps), ["a", "b"]);
});


test("weighted score: a stranger's like counts nothing, a friend's 2, a friend of a friend's 1; dislikes 0, 3, 1.5", () => {
  const w = {
    like: (k: string) => (k === "friend" ? 2 : k === "fof" ? 1 : 0),
    dislike: (k: string) => (k === "friend" ? 3 : k === "fof" ? 1.5 : 0),
  };
  assert.equal(postScore(["s1", "s2", "s3", "s4"], [], "a", w), 0, "a farm of strangers");
  assert.equal(postScore(["friend", "fof", "s1"], [], "a", w), 3);
  assert.equal(postScore(["friend"], ["fof", "s1", "s2"], "a", w), 0.5);
});

test("top with weights: strangers' likes do not put a post in, and their dislikes do not take one out", () => {
  const w = { like: (k: string) => (k === "friend" ? 2 : 0), dislike: (k: string) => (k === "friend" ? 3 : 0) };
  const ps = [post("farmed", 0.1, ["b1", "b2", "b3", "b4"]), post("liked", 0.2, ["friend"]), post("attacked", 0.3, ["friend"])];
  const dislikers = (p: Post) => (p.id === "attacked" ? ["b1", "b2", "b3"] : []);
  assert.deepEqual(ids(sortPosts(ps, "top24h", likers, dislikers, now, w)), ["liked", "attacked"]);
});

test("a post dated beyond the slack is in the future; one within it, or in the past, is not", () => {
  assert.equal(isFuture({ timestamp: now + 10 * 60_000 }, now), true);
  assert.equal(isFuture({ timestamp: now + 60_000 }, now), false);
  assert.equal(isFuture({ timestamp: now - DAY }, now), false);
});
