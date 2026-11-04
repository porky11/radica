import test from "node:test";
import assert from "node:assert/strict";
import { newNotes, shortNote } from "../src/versionCheck.ts";

test("versionCheck: notes are the new release's entries this build lacks, first sentence only", () => {
  assert.equal(shortNote("Fixed: chats. More words here."), "Fixed: chats.");
  assert.equal(shortNote("x".repeat(150)).length, 100);
  const local = [{ text: "Old one." }];
  assert.deepEqual(newNotes([{ text: "New thing. Details." }, { text: "Old one." }], local), ["New thing."]);
  assert.deepEqual(newNotes([{ text: "Old one." }], local), []);
});
