import test from "node:test";
import assert from "node:assert/strict";
import {
  asocialLink,
  asocialPersonOf,
  asocialCard,
  asocialProfileCard,
  asocialWorkHref,
  asocialPersonHref,
  asocialOwnStoreKey,
  asocialWorksStoreKey,
  parseAsocialProfile,
  parseAsocialWorks,
  decodeKeyBytes,
  ASOCIAL_REPO,
  type AsocialData,
} from "../src/asocial.ts";
import { fromBase58, toBase58 } from "../src/crypto.ts";

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

test("asocialProfileCard: renders nickname and works pills when AsocialData is provided", () => {
  const pubkey = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
  const asocialKey = "HMw5xHKmMuH2ufbC4XPSj8EEecbnTp9RgnNMfEWRATdF";
  const data: AsocialData = {
    key: asocialKey,
    name: "Scobru",
    about: "Open source damage dealer",
    works: [
      {
        title: "Distant Worlds",
        description: "An endless procedural planet explorer",
        kind: "game",
      },
    ],
  };

  const html = asocialProfileCard(pubkey, asocialKey, data);
  assert.ok(html.includes("Scobru"));
  assert.ok(html.includes("HMw5xH…WRATdF"));
  assert.ok(html.includes("Creator &#38; player on Asocial"));
  assert.ok(html.includes("blog-card-pages"));
  assert.ok(html.includes("Distant Worlds"));
  assert.ok(html.includes(encodeURIComponent("Distant Worlds")));
});

test("asocial store keys: derives deterministic contract keys for own and works stores", () => {
  const key = "HMw5xHKmMuH2ufbC4XPSj8EEecbnTp9RgnNMfEWRATdF";
  const bytes = decodeKeyBytes(key);
  assert.ok(bytes);
  assert.equal(bytes?.length, 32);

  const ownKey = asocialOwnStoreKey(key);
  assert.ok(ownKey);
  assert.equal(ownKey.codePart().length, 32);
  assert.ok(ownKey.encode().length > 20);

  const worksKey = asocialWorksStoreKey(key, "asocial");
  assert.ok(worksKey);
  assert.equal(worksKey.codePart().length, 32);
  assert.ok(worksKey.encode().length > 20);
});

function mockRecord(author: Uint8Array, slotStr: string, body: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const slot = enc.encode(slotStr);
  const out = new Uint8Array(32 + 1 + slot.length + 8 + 4 + body.length + 8 + 64);
  const view = new DataView(out.buffer);
  out.set(author, 0);
  out[32] = slot.length;
  out.set(slot, 33);
  let pos = 33 + slot.length;
  view.setBigUint64(pos, 1700000000n, true);
  pos += 8;
  view.setUint32(pos, body.length, true);
  pos += 4;
  out.set(body, pos);
  pos += body.length;
  view.setBigUint64(pos, 42n, true); // nonce
  pos += 8;
  out.set(new Uint8Array(64), pos); // signature
  return out;
}

function writeTag(tag: number, val: Uint8Array): Uint8Array {
  return new Uint8Array([tag, val.length, ...val]);
}

test("parseAsocialProfile: extracts nickname and about from own store records", () => {
  const enc = new TextEncoder();
  const author = new Uint8Array(32).fill(7);
  const body = new Uint8Array([
    ...writeTag(1, enc.encode("Scobru")),
    ...writeTag(2, enc.encode("Game maker")),
  ]);
  const recBytes = mockRecord(author, "profile", body);

  const profile = parseAsocialProfile(recBytes);
  assert.equal(profile.name, "Scobru");
  assert.equal(profile.about, "Game maker");
});

test("parseAsocialWorks: extracts works and ignores withdrawals", () => {
  const enc = new TextEncoder();
  const author = new Uint8Array(32).fill(9);
  const pubkeyStr = toBase58(author);

  const workBody = new Uint8Array([
    ...writeTag(1, new Uint8Array([4])), // kind: link
    ...writeTag(5, enc.encode("Distant Worlds")),
    ...writeTag(9, enc.encode("Procedural planet explorer")),
  ]);

  const liveWork = mockRecord(author, "Distant Worlds", workBody);
  const withdrawnWork = mockRecord(author, "Old Game", new Uint8Array(0)); // empty body = withdrawn

  const combined = new Uint8Array([...liveWork, ...withdrawnWork]);
  const works = parseAsocialWorks(combined, pubkeyStr);

  assert.equal(works.length, 1);
  assert.equal(works[0].title, "Distant Worlds");
  assert.equal(works[0].description, "Procedural planet explorer");
  assert.equal(works[0].kind, "link");
});
