import { test } from "node:test";
import assert from "node:assert/strict";
import { WebOfTrust } from "./wot.ts";

test("wot: classifies tiers correctly (me, roots/direct, extended, stranger)", () => {
  const me = "a".repeat(64);
  const alice = "b".repeat(64);
  const bob = "c".repeat(64);
  const charlie = "d".repeat(64);
  const stranger = "e".repeat(64);

  const followingOf = (pk: string) => {
    if (pk === alice) return [bob]; // alice follows bob
    if (pk === bob) return [charlie]; // bob follows charlie
    return [];
  };

  const wot = new WebOfTrust(me, [alice], [], followingOf);

  assert.equal(wot.trustTier(me), 1);
  assert.equal(wot.trustTier(alice), 1); // direct root
  assert.equal(wot.trustTier(bob), 2); // friend of friend
  assert.equal(wot.trustTier(charlie), 0); // 3rd degree: outside immediate tier 2
  assert.equal(wot.trustTier(stranger), 0); // outsider
  assert.ok(wot.isTrusted(alice));
  assert.ok(wot.isTrusted(bob));
  assert.ok(!wot.isTrusted(stranger));
});

test("wot: stranger dislikes carry 0 penalty and cannot penalize a post (Sybil resistance)", () => {
  const me = "a".repeat(64);
  const friend = "b".repeat(64);
  const bots = Array.from({ length: 50 }, (_, i) => i.toString(16).padStart(64, "0"));

  const wot = new WebOfTrust(me, [friend], []);
  const post = { id: "post_test", author: "author_pk" };

  // 50 anonymous bots dislike the post
  const result = wot.evaluatePost(post, [], bots);

  assert.equal(result.trustedDislikers.length, 0);
  assert.equal(result.wotScore, 0);
  assert.equal(result.isPenalized, false);
  assert.equal(result.penaltyReason, null);
});

test("wot: direct contact dislike penalizes a post unless trusted likes outweigh it", () => {
  const me = "a".repeat(64);
  const alice = "b".repeat(64);
  const bob = "c".repeat(64);

  const wot = new WebOfTrust(me, [alice, bob], []);
  const post = { id: "post_1", author: "author_pk" };

  // Alice (trusted contact) dislikes the post
  const res1 = wot.evaluatePost(post, [], [alice]);
  assert.ok(res1.isPenalized);
  assert.equal(res1.trustedDislikers.length, 1);
  assert.equal(res1.trustedDislikers[0], alice);
  assert.equal(res1.penaltyReason, "Disliked by a contact in your Web-of-Trust");

  // Bob (also trusted) and Me like the post, counterbalancing Alice
  const res2 = wot.evaluatePost(post, [bob, me], [alice]);
  assert.equal(res2.isPenalized, false); // Positive score (4) > Negative score (3)
  assert.equal(res2.trustedLikers.length, 2);
});

test("wot: community moderators act as trusted authorities for community posts", () => {
  const me = "a".repeat(64);
  const commMod = "m".repeat(64);
  const author = "x".repeat(64);

  // Even if user does not directly follow the community mod
  const wot = new WebOfTrust(me, [], []);
  const post = { id: "post_comm", author, community_id: "c_radica" };

  const res = wot.evaluatePost(post, [], [commMod], [commMod]);
  assert.ok(res.isPenalized);
  assert.ok(res.trustedDislikers.includes(commMod));
});
