import test from "node:test";
import assert from "node:assert/strict";
import { translateKeeping } from "../src/composeTranslate.ts";

const upper = async (t: string) => t.toUpperCase();

test("only the words are translated: links, mentions, tags, code, attachments and line breaks stay as written", async () => {
  const text = "ciao @Marco guarda https://example.org/a #freenet\n`codice` e [radica-cm1:img:x] fine. [qui](https://x.org)";
  assert.equal(
    await translateKeeping(text, "it", "en", upper),
    "CIAO @Marco GUARDA https://example.org/a #freenet\n`codice` E [radica-cm1:img:x] FINE. [qui](https://x.org)"
  );
});

test("pieces with no letters are not sent to the translator", async () => {
  let calls = 0;
  const count = async (t: string) => (calls++, t);
  await translateKeeping("@a @b 123 !!", "it", "en", count);
  assert.equal(calls, 0);
});
