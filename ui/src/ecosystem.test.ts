import test from "node:test";
import assert from "node:assert/strict";
import { ECOSYSTEM, ecosystemFooter, ecosystemCard, SUPPORT_URL } from "./ecosystem.ts";

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
});

test("ecosystem: links use nodeOrigin for known contracts and repos for others", () => {
  const origin = "http://127.0.0.1:7509";
  const footer = ecosystemFooter(origin);
  assert.ok(footer.includes(`${origin}/v1/contract/web/`));
  assert.ok(footer.includes(SUPPORT_URL));
  assert.ok(footer.includes("Support Radica"));

  const card = ecosystemCard(origin);
  assert.ok(card.includes("Works with"));
  assert.ok(card.includes("Buy me a coffee"));
});

