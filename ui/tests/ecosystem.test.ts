import test from "node:test";
import assert from "node:assert/strict";
import { ECOSYSTEM, ecosystemFooter, ecosystemCard, SUPPORT_URL, ORTO_SITE } from "../src/ecosystem.ts";

test("ecosystem: includes all requested projects", () => {
  const names = ECOSYSTEM.map((e) => e.name);
  assert.ok(names.includes("River"));
  assert.ok(names.includes("Viso"));
  assert.ok(names.includes("FreeTunes"));
  const freetunes = ECOSYSTEM.find((e) => e.name === "FreeTunes");
  assert.equal(freetunes?.key, "HiAQ4ucHkDKw6ShMa9ipX73h9XxdyGD5cN2DSW78Mqev");
  assert.ok(names.includes("FreePolls"));
  assert.ok(names.includes("FreeNames"));
  assert.ok(names.includes("Delta"));
  assert.ok(names.includes("Orto"));
  assert.ok(names.includes("Asocial"));
  const asocial = ECOSYSTEM.find((e) => e.name === "Asocial");
  assert.equal(asocial?.repo, "https://gitlab.com/porky11/asocial");
  assert.equal(asocial?.key, "BhhLhAiMAcZaSEJ31Zwri59D3F3E112DY6w3J51iLJT9");
  const orto = ECOSYSTEM.find((e) => e.name === "Orto");
  assert.equal(orto?.key, "9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ");
  assert.equal(ORTO_SITE, "9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ");
});

test("ecosystem: links use nodeOrigin for known contracts and repos for others", () => {
  const origin = "http://127.0.0.1:7509";
  const footer = ecosystemFooter(origin);
  assert.ok(footer.includes(`${origin}/v1/contract/web/`));
  assert.ok(footer.includes(`${origin}/v1/contract/web/9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ/#/`));
  assert.ok(footer.includes(SUPPORT_URL));
  assert.ok(footer.includes("Support Radica"));

  const card = ecosystemCard(origin);
  assert.ok(card.includes("Works with"));
  assert.ok(card.includes("Buy me a coffee"));
  assert.ok(card.includes("9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ"));
});
