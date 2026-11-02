import test from "node:test";
import assert from "node:assert/strict";
import { MAX_VIDEO_SEC, scanTimes, videoPlan, videoRef } from "./video.ts";

test("videoRef reads hash and key, rejects anything else", () => {
  const h = "a".repeat(64), k = "b".repeat(64);
  assert.deepEqual(videoRef(`radica-video:${h}:${k}`), { hash: h, keyHex: k });
  assert.equal(videoRef(`radica-media:${h}`), null);
  assert.equal(videoRef(`radica-video:${h}`), null);
  assert.equal(videoRef(`radica-video:${h}:${k}"><x`), null);
  assert.deepEqual(videoRef(`radica-video:${h}:${k}:${"c".repeat(64)}`), { hash: h, keyHex: k, posterHash: "c".repeat(64) });
});

test("scanTimes samples every 2 s and the end", () => {
  assert.deepEqual(scanTimes(5), [0, 2, 4, 4.5]);
  assert.deepEqual(scanTimes(4.2), [0, 2, 4]);
  assert.deepEqual(scanTimes(0), []);
});

test("videoPlan fits any allowed length in the cap, lowering quality as it grows", () => {
  assert.deepEqual(videoPlan(60, 1080), { bitrate: 1_200_000, height: 720 });
  assert.deepEqual(videoPlan(60, 360), { bitrate: 1_200_000, height: 360 });
  const p = videoPlan(285, 1080)!;
  assert.equal(p.height, 480);
  assert.ok(((p.bitrate + 64_000) * 285) / 8 < 25 * 1024 * 1024 * 0.9);
  assert.ok(MAX_VIDEO_SEC >= 590 && MAX_VIDEO_SEC <= 610);
  assert.equal(videoPlan(MAX_VIDEO_SEC, 1080)?.height, 360);
  assert.equal(videoPlan(MAX_VIDEO_SEC + 5, 1080), null);
});
