import test from "node:test";
import assert from "node:assert/strict";
import { MILESTONES, countsOf, nextUp, reached } from "./milestones.ts";
import type { Post } from "./types.ts";

const post = (comments: number, likes: number) =>
  ({
    comments: Object.fromEntries(Array.from({ length: comments }, (_, i) => [`c${i}`, {}])),
    likes: Object.fromEntries(Array.from({ length: likes }, (_, i) => [`l${i}`, { liked: true, ts: 1, sig: "" }])),
  }) as unknown as Post;

test("milestones: counts from posts, communities and people", () => {
  assert.deepEqual(countsOf([post(2, 1), post(0, 3)], 4, 9), { posts: 2, communities: 4, people: 9, comments: 2, likes: 4 });
});

test("milestones: reached ones, and one next per metric", () => {
  const c = { posts: 150, communities: 10, people: 0, comments: 0, likes: 99 };
  assert.deepEqual(reached(c).map((m) => m.id), ["posts-100", "communities-10"]);
  assert.deepEqual(nextUp(c).map((m) => m.id), ["posts-1000", "communities-50", "people-10", "comments-100", "likes-100"]);
  const all = Object.fromEntries(Object.keys(c).map((k) => [k, 1e9])) as typeof c;
  assert.equal(reached(all).length, MILESTONES.length);
  assert.equal(nextUp(all).length, 0);
});
