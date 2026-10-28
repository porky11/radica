import test from "node:test";
import assert from "node:assert/strict";
import { MEDIA_PREFIX, dataUrlBytes, keepMedia, mediaHashOf, mediaRef, mediaUrl } from "./media.ts";

const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
const hash = mediaHashOf(bytes);

test("media: a reference names a 64-hex hash, nothing else", () => {
  assert.equal(mediaRef(MEDIA_PREFIX + hash), hash);
  assert.equal(mediaRef("data:image/png;base64,AAAA"), null);
  assert.equal(mediaRef(MEDIA_PREFIX + "zz"), null);
  assert.equal(mediaRef(MEDIA_PREFIX + hash + '"><script>'), null);
  assert.equal(mediaRef(undefined), null);
});

test("media: data URI bytes round-trip", () => {
  const uri = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  assert.deepEqual(dataUrlBytes(uri), bytes);
  assert.equal(dataUrlBytes("https://x.org/a.png"), null);
});

test("media: one fetch per image, kept afterwards", async () => {
  let calls = 0;
  const get = async () => (calls++, bytes);
  const other = mediaHashOf(new Uint8Array([9]));
  const [a, b] = await Promise.all([mediaUrl(other, get), mediaUrl(other, get)]);
  assert.equal(calls, 1);
  assert.ok(a?.startsWith("blob:") && a === b);
  assert.equal(await mediaUrl(other, get), a);
  assert.equal(calls, 1);
  assert.equal(await mediaUrl(mediaHashOf(new Uint8Array([8])), async () => null), undefined, "missing: no URL");
  assert.ok(keepMedia(hash, bytes).startsWith("blob:"));
});
