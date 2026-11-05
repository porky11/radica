import test from "node:test";
import assert from "node:assert/strict";
import {
  FH_SITE,
  FH_LIST_CODE_HASH,
  fhLink,
  fhPersonaHex,
  fhListKey,
  parseFhSitesJson,
  parseFhListState,
  parseFhProfileInput,
  fhCard,
  fhProfileCard,
  fhSiteHref,
  fhShareHref,
} from "../src/fh.ts";
import { personaName } from "../src/whoiam.ts";

const PERSONA_HEX = "464b576da4cc5bcf31febd41a863ac251d04024c19f1786b24ca6620a0cce53b";
const PERSONA_B58 = personaName(PERSONA_HEX);

test("fh: persona key parsing handles both 64-hex and Base58", () => {
  assert.equal(fhPersonaHex(PERSONA_HEX), PERSONA_HEX);
  assert.equal(fhPersonaHex(PERSONA_B58), PERSONA_HEX);
  assert.equal(fhPersonaHex("invalid-key!"), null);
});

test("fh: link detection in captions", () => {
  const webLink = `Explore my sites: http://127.0.0.1:7509/v1/contract/web/${FH_SITE}/#/u/${PERSONA_B58}`;
  const ref1 = fhLink(webLink);
  assert.ok(ref1);
  assert.equal(ref1.persona, PERSONA_HEX);
  assert.equal(ref1.siteKey, FH_SITE);

  const hashLink = `Check #/u/${PERSONA_B58} on FH`;
  const ref2 = fhLink(hashLink);
  assert.ok(ref2);
  assert.equal(ref2.persona, PERSONA_HEX);

  assert.equal(fhLink("just regular message"), null);
});

test("fh: contract key derivation uses frozen WASM hash and persona parameters", () => {
  const key = fhListKey(PERSONA_HEX);
  assert.ok(key.codePart());
  assert.equal(key.codePart()?.length, 32);
});

test("fh: JSON and state parsing", () => {
  const sampleSites = [
    { name: "FreeNames", key: "CDC7PTxNxfaNnJ3RJs8UrNHTScpT2NTujhvUiwirVejE", hash: "#/", group: "Utility" },
    { name: "FreeTunes", key: "HiAQ4ucHkDKw6ShMa9ipX73h9XxdyGD5cN2DSW78Mqev", hash: "", group: "Media" },
  ];

  const parsed = parseFhSitesJson(JSON.stringify(sampleSites));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, "FreeNames");
  assert.equal(parsed[0].group, "Utility");

  const stateBytes = new TextEncoder().encode(JSON.stringify({
    list: JSON.stringify(sampleSites),
    ts: 123456789,
    sig: "test",
  }));
  const state = parseFhListState(stateBytes);
  assert.ok(state);
  assert.equal(state.sites.length, 2);
  assert.equal(state.ts, 123456789);
});

test("fh: profile input accepts share links, keys, and exported JSON", () => {
  const p1 = parseFhProfileInput(`http://127.0.0.1:7509/v1/contract/web/${FH_SITE}/#/u/${PERSONA_B58}`);
  assert.equal(p1?.kind, "persona");
  if (p1?.kind === "persona") assert.equal(p1.persona, PERSONA_HEX);

  const p2 = parseFhProfileInput(PERSONA_B58);
  assert.equal(p2?.kind, "persona");
  if (p2?.kind === "persona") assert.equal(p2.persona, PERSONA_HEX);

  const p3 = parseFhProfileInput(JSON.stringify([{ name: "MySite", key: "CDC7PTxNxfaNnJ3RJs8UrNHTScpT2NTujhvUiwirVejE" }]));
  assert.equal(p3?.kind, "json");
  if (p3?.kind === "json") assert.equal(p3.sites.length, 1);
});

test("fh: card and profile card rendering", () => {
  const cardHtml = fhCard(`Look at http://127.0.0.1:7509/v1/contract/web/${FH_SITE}/#/u/${PERSONA_B58}`);
  assert.match(cardHtml, /fh-card/);
  assert.match(cardHtml, /Fisherman's Horizon/);

  const profileCardHtml = fhProfileCard("Scobru", {
    persona: PERSONA_HEX,
    sites: [
      { name: "Radica", key: "CDC7PTxNxfaNnJ3RJs8UrNHTScpT2NTujhvUiwirVejE", hash: "#/", group: "Social" },
    ],
    ts: 12345,
  });
  assert.match(profileCardHtml, /Bookmarks on Fisherman's Horizon/);
  assert.match(profileCardHtml, /Radica/);
  assert.match(profileCardHtml, /Social/);
});

