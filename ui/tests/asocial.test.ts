import test from "node:test";
import assert from "node:assert/strict";
import {
  asocialLink,
  asocialPersonOf,
  asocialCard,
  asocialProfileCard,
  asocialWorkHref,
  asocialPersonHref,
  ASOCIAL_REPO,
} from "../src/asocial.ts";

test("asocialLink: detects #work/<publisher>/<title> links in captions", () => {
  const caption = "Check out this awesome game: #work/54RwkjvbrXRzjyg4z2EbNCzw3Qwx5YpWQegpMyCTwibE/space-blaster on Freenet!";
  const link = asocialLink(caption);
  assert.ok(link);
  assert.equal(link?.publisher, "54RwkjvbrXRzjyg4z2EbNCzw3Qwx5YpWQegpMyCTwibE");
  assert.equal(link?.title, "space-blaster");
});

test("asocialLink: detects url-encoded titles and query options", () => {
  const caption = "Playing http://127.0.0.1:7509/v1/contract/web/EqJ5YpEEV3XLqEvKWLQHFhGAac2qXzSUoE6k2zbdnXBr/#work/54RwkjvbrXRzjyg4z2EbNCzw3Qwx5YpWQegpMyCTwibE/Super%20Platformer?level=3&hard=true";
  const link = asocialLink(caption);
  assert.ok(link);
  assert.equal(link?.publisher, "54RwkjvbrXRzjyg4z2EbNCzw3Qwx5YpWQegpMyCTwibE");
  assert.equal(link?.title, "Super Platformer");
  assert.equal(link?.params, "level=3&hard=true");
});

test("asocialLink: detects direct game contract links", () => {
  const caption = "Testing a new build: #asocial-game/9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ?debug=1";
  const link = asocialLink(caption);
  assert.ok(link);
  assert.equal(link?.siteKey, "9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ");
  assert.equal(link?.params, "debug=1");
});

test("asocialLink: returns null when no asocial link is present", () => {
  assert.equal(asocialLink("Just a normal post about cats #cats #freenet"), null);
  assert.equal(asocialLink(""), null);
});

test("asocialPersonOf: parses author keys and #person/ URLs", () => {
  const key = "54RwkjvbrXRzjyg4z2EbNCzw3Qwx5YpWQegpMyCTwibE";
  assert.equal(asocialPersonOf(key), key);
  assert.equal(asocialPersonOf(`#person/${key}`), key);
  assert.equal(asocialPersonOf(`http://127.0.0.1:7509/v1/contract/web/portalKey/#person/${key}`), key);

  // Hex format
  const hexKey = "3c4fb1c726ac4bccc564fea5d1d74100ec5477605bfec868dea60879d9b6d975";
  assert.equal(asocialPersonOf(hexKey), hexKey);

  // Invalid key
  assert.equal(asocialPersonOf("invalid string!"), null);
});

test("asocialCard: renders playable game card with play button", () => {
  const caption = "Look at this: #work/54RwkjvbrXRzjyg4z2EbNCzw3Qwx5YpWQegpMyCTwibE/dungeon_crawler";
  const html = asocialCard(caption);
  assert.ok(html.includes("asocial-card"));
  assert.ok(html.includes("dungeon crawler"));
  assert.ok(html.includes("asocial-play-btn"));
  assert.ok(html.includes("Play in Radica"));
});

test("asocialProfileCard: renders profile view block", () => {
  const pubkey = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
  const asocialKey = "54RwkjvbrXRzjyg4z2EbNCzw3Qwx5YpWQegpMyCTwibE";
  const html = asocialProfileCard(pubkey, asocialKey);
  assert.ok(html.includes("asocial-profile-card"));
  assert.ok(html.includes("Asocial Games Profile"));
  assert.ok(html.includes("54Rwkj…CTwibE"));
  assert.ok(html.includes("/v1/contract/web/BhhLhAiMAcZaSEJ31Zwri59D3F3E112DY6w3J51iLJT9/#person/54RwkjvbrXRzjyg4z2EbNCzw3Qwx5YpWQegpMyCTwibE"));
  assert.equal(
    asocialPersonHref(asocialKey, "http://127.0.0.1:7509"),
    "http://127.0.0.1:7509/v1/contract/web/BhhLhAiMAcZaSEJ31Zwri59D3F3E112DY6w3J51iLJT9/#person/54RwkjvbrXRzjyg4z2EbNCzw3Qwx5YpWQegpMyCTwibE"
  );
});
