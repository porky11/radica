import test from "node:test";
import assert from "node:assert/strict";
import { scanTimes, videoRef } from "./video.ts";

test("videoRef reads hash and key, rejects anything else", () => {
  const h = "a".repeat(64), k = "b".repeat(64);
  assert.deepEqual(videoRef(`radica-video:${h}:${k}`), { hash: h, keyHex: k });
  assert.equal(videoRef(`radica-media:${h}`), null);
  assert.equal(videoRef(`radica-video:${h}`), null);
  assert.equal(videoRef(`radica-video:${h}:${k}"><x`), null);
});

test("scanTimes samples every 2 s and the end", () => {
  assert.deepEqual(scanTimes(5), [0, 2, 4, 4.5]);
  assert.deepEqual(scanTimes(4.2), [0, 2, 4]);
  assert.deepEqual(scanTimes(0), []);
});
