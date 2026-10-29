import test from "node:test";
import assert from "node:assert/strict";
import { decodeCbor, deltaPrefixOf, parseSite, pointerKey, siteParams, verifyPointer } from "./delta.ts";
import { hexToBytes } from "./crypto.ts";

// Delta's published record (pointer-records.toml, delta.site-contract version 1).
const RECORD = "0000000190bc44f4f2e76aeb5aec732920c1d73ffa3d108f6e661ad84474774b246fabe359b78970b1853843340b8862e2330ad946f02fd801e44803d81e1de4a3b583909d74277582215312ccb196e0faadeda0365b4b0b25a9bf32083e5a4b40ca8507";

test("delta: the pointer's address and Delta's signed record", async () => {
  assert.equal(pointerKey().encode(), "6a8ZBaFft9wVFd1mAWVRRZepXXrnQNzRCD5tqM71hBm5");
  assert.deepEqual(await verifyPointer(hexToBytes(RECORD)), { version: 1, codeHash: RECORD.slice(8, 72) });
  const bumped = hexToBytes(RECORD);
  bumped[3] = 2;
  assert.equal(await verifyPointer(bumped), null);
});

test("delta: prefix from a pasted address", () => {
  assert.equal(deltaPrefixOf("Abc123defG"), "Abc123defG");
  assert.equal(deltaPrefixOf("http://127.0.0.1:7509/v1/contract/web/EqJ5YpEEV3XLqEvKWLQHFhGAac2qXzSUoE6k2zbdnXBr/#Abc123defG/4/hello"), "Abc123defG");
  assert.equal(deltaPrefixOf("not a site"), null);
});

// a small CBOR writer for the fixture (definite lengths, as ciborium)
const head = (major: number, n: number) => (n < 24 ? [(major << 5) | n] : n < 256 ? [(major << 5) | 24, n] : [(major << 5) | 26, n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
const enc = (x: unknown): number[] => {
  if (typeof x === "number") return head(0, x);
  if (typeof x === "string") { const b = [...new TextEncoder().encode(x)]; return [...head(3, b.length), ...b]; }
  if (x instanceof Uint8Array) return [...head(2, x.length), ...x];
  if (x instanceof Map) return [...head(5, x.size), ...[...x].flatMap(([k, v]) => [...enc(k), ...enc(v)])];
  const e = Object.entries(x as object);
  return [...head(5, e.length), ...e.flatMap(([k, v]) => [...enc(k), ...enc(v)])];
};

test("delta: params as ciborium writes SiteParameters", () => {
  assert.deepEqual(siteParams("Abc123defG"), new Uint8Array(enc({ prefix: "Abc123defG" })));
});

test("delta: a SiteState's name and pages, newest first", () => {
  const page = (title: string, at: number) => ({ title, content: "# hi", updated_at: at, signature: new Uint8Array(64), order: 0 });
  const state = {
    owner: new Uint8Array(32),
    config: { config: { version: 2, name: "My Blog", description: "notes" }, signature: new Uint8Array(64) },
    pages: new Map([[1, page("Hello", 1700000000)], [2, page("Second", 1700000500)]]),
    next_page_id: 3,
    deleted_pages: new Map(),
  };
  assert.deepEqual(parseSite(new Uint8Array(enc(state))), {
    name: "My Blog",
    description: "notes",
    pages: [{ id: 2, title: "Second", updatedAt: 1700000500 }, { id: 1, title: "Hello", updatedAt: 1700000000 }],
  });
  assert.equal(parseSite(new Uint8Array([0xff])), null);
  assert.deepEqual(decodeCbor(new Uint8Array([0x82, 0x20, 0xf5])), [-1, true]);
});
