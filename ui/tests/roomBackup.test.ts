import test from "node:test";
import assert from "node:assert/strict";
import { mergeRoomBackup } from "../src/roomBackup.ts";
import type { PrivateRoom } from "../src/types.ts";

const room = (id: string, members: string[]) => ({ id, members }) as PrivateRoom;

test("a save before the restore keeps the rooms only the backup has", () => {
  const out = mergeRoomBackup([room("chan", ["me"])], [room("chan", ["me"]), room("river_a", ["me"])], "me");
  assert.deepEqual(out.map((r) => r.id), ["chan", "river_a"]);
});

test("a room I was removed from here is not brought back from the backup", () => {
  const out = mergeRoomBackup([room("a", ["other"])], [room("a", ["me", "other"])], "me");
  assert.deepEqual(out, []);
});
