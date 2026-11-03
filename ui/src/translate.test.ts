import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLang } from "./translate.ts";

test("detectLang tells the supported languages apart and declines short or unclear text", () => {
  assert.equal(detectLang("Oggi sono andato al mare e non c'era nessuno, anche perché pioveva"), "it");
  assert.equal(detectLang("The weather is nice and you should come with us, but not today"), "en");
  assert.equal(detectLang("Hoy hace mucho calor y no hay nadie en la playa porque está lloviendo"), "es");
  assert.equal(detectLang("Ich habe heute keine Zeit, aber das ist nicht schlimm und sie kommt auch"), "de");
  assert.equal(detectLang("Je pense que les gens sont pas prêts pour une vraie liberté sur internet"), "fr");
  assert.equal(detectLang("Eu não sei se você está muito ocupado, mas isso foi também bom"), "pt");
  assert.equal(detectLang("I wonder if there's anything important happening in the world today ..."), "en");
  assert.equal(detectLang("Hallo, sonst noch deutsche hier?"), "de");
  assert.equal(detectLang("Zumindest ich jetzt"), "de");
  assert.equal(detectLang("i will fix"), "en");
  assert.equal(detectLang("is fixed i thnk"), "en");
  assert.equal(detectLang("Looks like it's holding"), "en");
  assert.equal(detectLang("grazie mille"), "it");
  assert.equal(detectLang("ciao"), null);
  assert.equal(detectLang("#freenet 🚀"), null);
});
