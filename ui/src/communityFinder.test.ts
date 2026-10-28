import test from "node:test";
import assert from "node:assert/strict";
import { findCommunities, slugOf, type CommunitySort } from "./communityFinder.ts";
import type { Community } from "./types.ts";

const comm = (slug: string, members: number, created_at = 1, name = slug, description = ""): Community =>
  ({ id: `c_${slug}`, slug, name, description, created_at, members: Array.from({ length: members }, (_, i) => `m${i}`) }) as unknown as Community;

const all = [comm("dev", 5, 3), comm("art", 9, 1, "Art Studio"), comm("music", 2, 2, "Music", "songs and bands"), comm("zen", 9, 5)];
const find = (query: string, sort: CommunitySort = "members", pinned: string[] = [], limit = 50, postsIn = new Map<string, number>()) =>
  findCommunities({ communities: all, query, sort, pinned: (c) => pinned.includes(c.slug), postsIn, limit });
const slugs = (r: ReturnType<typeof find>) => r.shown.map((c) => c.slug);

test("finder: matches slug, name and description, ignoring case and a leading r/", () => {
  assert.deepEqual(slugs(find("R/DE")), ["dev"]);
  assert.deepEqual(slugs(find("studio")), ["art"]);
  assert.deepEqual(slugs(find("bands")), ["music"]);
  assert.deepEqual(slugs(find("")), ["art", "zen", "dev", "music"]);
});

test("finder: joined communities stay above the rest, each group in the chosen order", () => {
  const r = find("", "members", ["music", "dev"]);
  assert.deepEqual(slugs(r), ["dev", "music", "art", "zen"]);
  assert.equal(r.pinnedCount, 2);
});

test("finder: sort by popularity (posts seen, then members), newest and name", () => {
  assert.deepEqual(slugs(find("", "popular", [], 50, new Map([["c_music", 4]]))), ["music", "art", "zen", "dev"]);
  assert.deepEqual(slugs(find("", "newest")), ["zen", "dev", "music", "art"]);
  assert.deepEqual(slugs(find("", "name")), ["art", "dev", "music", "zen"]);
});

test("finder: the limit cuts the list and counts what is left", () => {
  const r = find("", "name", [], 3);
  assert.deepEqual(slugs(r), ["art", "dev", "music"]);
  assert.equal(r.more, 1);
});

test("finder: a name nobody has offers to create it, one that exists does not", () => {
  assert.equal(find("Fresh Idea!").create, "freshidea");
  assert.equal(find("r/dev").create, undefined);
  assert.equal(find("DEV").create, undefined);
  assert.equal(find("").create, undefined);
  assert.equal(find("!!!").create, undefined);
  assert.equal(find("de").create, "de"); // "de" matches dev, but is not a community itself
});

test("finder: slugOf is what createCommunity makes", () => {
  assert.equal(slugOf(" r/My Club-9_x "), "myclub9_x");
  assert.equal(slugOf("x".repeat(60)).length, 40);
});
