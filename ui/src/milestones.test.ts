import test from "node:test";
import assert from "node:assert/strict";
import { countsOf, nextUp, reached } from "./milestones.ts";
import type { Post } from "./types.ts";

const post = (comments: number, likes: number) =>
  ({
    comments: Object.fromEntries(Array.from({ length: comments }, (_, i) => [`c${i}`, {}])),
    likes: Object.fromEntries(Array.from({ length: likes }, (_, i) => [`l${i}`, { liked: true, ts: 1, sig: "" }])),
  }) as unknown as Post;

test("milestones: counts from posts, communities and people; whole feeds count when known", () => {
  assert.deepEqual(countsOf([post(2, 1), post(0, 3)], 4, 9), { posts: 2, communities: 4, people: 9, comments: 2, likes: 4, hosted: 0 });
  assert.equal(countsOf([post(0, 0)], 0, 0, 2500).posts, 2500);
});

test("milestones: reached ones, and one next per metric", () => {
  const c = { posts: 150, communities: 10, people: 0, comments: 0, likes: 99, hosted: 0 };
  assert.deepEqual(reached(c).map((m) => m.id), ["posts-100", "communities-10"]);
  assert.deepEqual(nextUp(c).map((m) => m.id), ["posts-1000", "communities-100", "people-10", "comments-100", "likes-100", "hosted-10"]);
});

test("milestones: the series never ends, and every milestone has a line", () => {
  const c = { posts: 20000, communities: 0, people: 0, comments: 0, likes: 0, hosted: 0 };
  assert.deepEqual(reached(c).map((m) => m.at), [100, 1000, 10000]);
  const next = nextUp(c)[0];
  assert.equal(next.id, "posts-100000");
  assert.match(next.text, /^100,000 posts\. \S/);
  const big = nextUp({ ...c, posts: 1e9 })[0];
  assert.equal(big.at, 1e10);
});

test("hosted feeds: a personal milestone with its own words", () => {
  const c = { posts: 0, communities: 0, people: 0, comments: 0, likes: 0, hosted: 12 };
  assert.deepEqual(reached(c).map((m) => m.id), ["hosted-10"]);
  assert.match(reached(c)[0].text, /Your node keeps 10/);
  assert.equal(countsOf([], 0, 0, 0, 7).hosted, 7);
});
