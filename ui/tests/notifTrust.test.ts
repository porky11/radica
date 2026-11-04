import test from "node:test";
import assert from "node:assert/strict";
import { splitNotifs } from "../src/notifTrust.ts";

test("notifications: those from people I trust stay, the rest go under Others, order kept", () => {
  const list = [{ from: "friend", id: 1 }, { from: "stranger", id: 2 }, { from: "friend", id: 3 }, { from: "bot", id: 4 }];
  const { main, others } = splitNotifs(list, (k) => k === "friend");
  assert.deepEqual(main.map((n) => n.id), [1, 3]);
  assert.deepEqual(others.map((n) => n.id), [2, 4]);
});
