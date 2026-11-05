import test from "node:test";
import assert from "node:assert/strict";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  namesOf,
  nameHref,
  ownerOf,
  sitesOf,
  parseFreenameUri,
  targetOfRecord,
  resolveName,
  getResolvedFreename,
  setResolvedFreename,
  clearResolvedFreenames,
  freenameInCaption,
  freenamesCard,
  fillFreenames,
  zoneKey,
  registryKey,
} from "../src/freenames.ts";

const A = "aa".repeat(32), B = "bb".repeat(32);
const ADMIN = "4498bd4c2ab992afa152bc9b968e246cf70dc4fa5a670b23c33e73b8516ce9f3";
const h = (name: string, o: string, nonce: number) => bytesToHex(sha256(new TextEncoder().encode(`fnc1|${ADMIN}|${name}|${o}|${nonce}`)));
const reg = (s: object) => new TextEncoder().encode(JSON.stringify(s));

test("freenames: the lowest proof hash owns a name, a pin overrides it", () => {
  const s = { claims: { shared: { [A]: { nonce: 1 }, [B]: { nonce: 2 } }, solo: { [A]: { nonce: 7 } }, pinned: { [A]: { nonce: 1 } }, held: { [A]: { nonce: 1 } } }, pins: { map: { pinned: B, held: "" } } };
  const winner = h("shared", A, 1) < h("shared", B, 2) ? A : B;
  assert.equal(ownerOf(s, "shared"), winner);
  assert.equal(ownerOf(s, "pinned"), B);
  assert.equal(ownerOf(s, "held"), null); // reserved
  assert.deepEqual(namesOf(reg(s), A), (winner === A ? ["shared", "solo"] : ["solo"]));
  assert.deepEqual(namesOf(reg(s), B), (winner === B ? ["pinned", "shared"] : ["pinned"]));
});

test("freenames: a malformed registry gives no names", () => {
  assert.deepEqual(namesOf(new TextEncoder().encode("nope"), A), []);
  assert.deepEqual(namesOf(reg({ claims: { "Bad Name": { [A]: { nonce: 1 } } }, pins: { map: {} } }), A), []);
  assert.equal(nameHref("http://n", "scobru"), "http://n/v1/contract/web/CDC7PTxNxfaNnJ3RJs8UrNHTScpT2NTujhvUiwirVejE/#/go/scobru");
});

test("freenames: the sites a zone points to, checked", () => {
  const ID = "HiAQ4ucHkDKw6ShMa9ipX73h9XxdyGD5cN2DSW78Mqev";
  const zone = reg({ records: { freetunes: { target: ID }, "@": { target: ID }, fh: { target: "" }, "Bad!": { target: ID }, evil: { target: "../x" } } });
  assert.deepEqual(sitesOf(zone), [{ name: "@", target: ID }, { name: "freetunes", target: ID }]);
  assert.deepEqual(sitesOf(new TextEncoder().encode("{}")), []);
});

test("freenames: parseFreenameUri recognizes human-readable FreeNames URIs and subpaths", () => {
  // standard name/sub
  assert.deepEqual(parseFreenameUri("freenet:scobru/fh"), {
    first: "scobru",
    sub: "fh",
    subpath: "",
    canonical: "scobru/fh",
  });

  // with subpath and hash
  assert.deepEqual(parseFreenameUri("freenet:scobru/fh/album/1#intro"), {
    first: "scobru",
    sub: "fh",
    subpath: "/album/1#intro",
    canonical: "scobru/fh",
  });

  // root zone under freenet:
  assert.deepEqual(parseFreenameUri("freenet:scobru/@"), {
    first: "scobru",
    sub: "@",
    subpath: "",
    canonical: "scobru",
  });

  // fn: scheme supports bare name
  assert.deepEqual(parseFreenameUri("fn:scobru"), {
    first: "scobru",
    sub: "@",
    subpath: "",
    canonical: "scobru",
  });

  assert.deepEqual(parseFreenameUri("fn:scobru/fh"), {
    first: "scobru",
    sub: "fh",
    subpath: "",
    canonical: "scobru/fh",
  });

  // bare canonical name (stored in data-freenames attribute) with allowBare=true
  assert.equal(parseFreenameUri("scobru/orto"), null);
  assert.deepEqual(parseFreenameUri("scobru/orto", true), {
    first: "scobru",
    sub: "orto",
    subpath: "",
    canonical: "scobru/orto",
  });

  // raw persona key as first segment
  assert.deepEqual(parseFreenameUri(`freenet:${A}/fh`), {
    first: A,
    sub: "fh",
    subpath: "",
    canonical: `${A}/fh`,
  });

  // Non-names / contract IDs are ignored
  assert.equal(parseFreenameUri("freenet:short"), null); // no subname under freenet:
  assert.equal(parseFreenameUri("freenet:HiAQ4ucHkDKw6ShMa9ipX73h9XxdyGD5cN2DSW78Mqev/docs"), null); // uppercase contract ID
  assert.equal(parseFreenameUri("https://google.com"), null);
  assert.equal(parseFreenameUri("freenet:bad_name!/fh"), null);
});

test("freenames: targetOfRecord extracts clean base58 contract id", () => {
  const ID = "HiAQ4ucHkDKw6ShMa9ipX73h9XxdyGD5cN2DSW78Mqev";
  const z1 = reg({ records: { fh: { target: ID } } });
  assert.equal(targetOfRecord(z1, "fh"), ID);

  const z2 = reg({ records: { fh: { target: `/v1/contract/web/${ID}/` } } });
  assert.equal(targetOfRecord(z2, "fh"), ID);

  // tombstone or missing
  const z3 = reg({ records: { fh: { target: "" } } });
  assert.equal(targetOfRecord(z3, "fh"), null);
  assert.equal(targetOfRecord(z3, "nonexistent"), null);
});

test("freenames: resolveName resolves freenet:name/sub to exact target and caches", async () => {
  clearResolvedFreenames();
  const TARGET = "HiAQ4ucHkDKw6ShMa9ipX73h9XxdyGD5cN2DSW78Mqev";
  const regState = { claims: { scobru: { [A]: { nonce: 1 } } }, pins: { map: {} } };
  const zoneState = { records: { fh: { target: TARGET } } };

  let fetches = 0;
  const mockFetch = async (key: any) => {
    fetches++;
    if (key.encode() === registryKey().encode()) return reg(regState);
    if (key.encode() === zoneKey(A).encode()) return reg(zoneState);
    return null;
  };

  const res = await resolveName("freenet:scobru/fh#play", mockFetch);
  assert.deepEqual(res, {
    owner: A,
    target: TARGET,
    canonical: "scobru/fh",
    subpath: "#play",
  });

  // Cached: second call should not re-fetch
  const res2 = await resolveName("freenet:scobru/fh", mockFetch);
  assert.equal(res2?.target, TARGET);
  assert.equal(fetches, 2); // 1 reg + 1 zone
  assert.equal(getResolvedFreename("scobru/fh")?.target, TARGET);

  // Resolves bare canonical name (what dataset.freenames stores)
  const res3 = await resolveName("scobru/fh", mockFetch);
  assert.equal(res3?.target, TARGET);
  assert.equal(res3?.canonical, "scobru/fh");
});

test("freenames: freenameInCaption and freenamesCard extract and render card", () => {
  clearResolvedFreenames();
  const caption = "Check out our site at freenet:scobru/fh! It's awesome.";
  const fn = freenameInCaption(caption);
  assert.equal(fn?.canonical, "scobru/fh");

  const cardHtml = freenamesCard(caption, "http://127.0.0.1:7509");
  assert.match(cardHtml, /class="fn-card"/);
  assert.match(cardHtml, /data-freenames="scobru\/fh"/);
  assert.match(cardHtml, /FreeNames &middot; scobru\/fh/);

  // When resolved in cache:
  setResolvedFreename("scobru/fh", { owner: A, target: "HiAQ4ucHkDKw6ShMa9ipX73h9XxdyGD5cN2DSW78Mqev" });
  const resolvedCard = freenamesCard(caption, "http://127.0.0.1:7509");
  assert.match(resolvedCard, /data-resolved="true"/);
  assert.match(resolvedCard, /href="http:\/\/127\.0\.0\.1:7509\/v1\/contract\/web\/HiAQ4ucHkDKw6ShMa9ipX73h9XxdyGD5cN2DSW78Mqev\/"/);
});
