import test from "node:test";
import assert from "node:assert/strict";
import { freetunesCard, freetunesLink, parseRelease } from "./freetunes.ts";

const REL = "FhT3HnNwsKk7aa5MaGh9dtLFMcAHD8KdwYV2Sw7RVezY";
const CH = "9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ";
const link = (t = "") => `listen freenet:HiAQ4uXyz1234567Mqev/#/r/${REL}.${"ab".repeat(60)}${t} #music`;
const state = (meta: object) => new TextEncoder().encode(JSON.stringify({ meta_json: JSON.stringify(meta), sig: "x" }));

test("freetunes: the release and track of a link in a caption", () => {
  assert.deepEqual(freetunesLink(link()), { release: REL, track: 0 });
  assert.deepEqual(freetunesLink(link("/3")), { release: REL, track: 3 });
  assert.equal(freetunesLink("no music here #/r/short.abc"), null);
  assert.match(freetunesCard(link("/2")), new RegExp(`data-release="${REL}" data-track="2"`));
  assert.equal(freetunesCard("plain text"), "");
});

test("freetunes: a release state is checked before use", () => {
  const rel = parseRelease(state({ title: "Ship", artist: "Scobru", cover: { addr: CH }, tracks: [{ title: "One", chunks: [{ a: CH, ms: 1500 }, { a: CH, ms: 500 }] }] }))!;
  assert.equal(rel.tracks[0].ms, 2000);
  assert.equal(rel.cover, CH);
  // a chunk address that is not an id drops its track; a removed release is nothing
  assert.equal(parseRelease(state({ title: "x", artist: "y", tracks: [{ title: "bad", chunks: [{ a: "../../x", ms: 1 }] }] }))!.tracks.length, 0);
  assert.equal(parseRelease(state({ deleted: true, tracks: [] })), null);
  assert.equal(parseRelease(new TextEncoder().encode("not json")), null);
});
