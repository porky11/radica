import test from "node:test";
import assert from "node:assert/strict";
import { whyGone } from "../src/postGone.ts";

test("a tombstone in the author's feed means the author deleted it", () => {
  assert.equal(whyGone({ posts: {}, deleted: { p1: { sig: "s" } } }, "p1"), "deleted");
});
test("feed here, no post, no tombstone: not delivered yet", () => {
  assert.equal(whyGone({ posts: {}, deleted: { other: { sig: "s" } } }, "p1"), "undelivered");
  assert.equal(whyGone({ posts: {} }, "p1"), "undelivered");
});
test("no feed from the author yet: waiting", () => {
  assert.equal(whyGone(null, "p1"), "waiting");
});
