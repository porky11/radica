import test from "node:test";
import assert from "node:assert/strict";
import { foldChat, foldCommunities, foldRoom, type LogEntry } from "./logfold.ts";

let n = 0;
const entry = (author: string, ts: number, body: object): LogEntry => ({ author, id: `e${n++}`, ts, body: JSON.stringify(body), sig: "" });
const [owner, mod, user, mallory] = ["aa", "bb", "cc", "dd"].map((c) => c.repeat(32));

test("logfold: community authority comes from the creator and its moderators", () => {
  const log = [
    entry(owner, 1, { type: "community_create", community: { id: "c_cats", name: "Cats" } }),
    entry(mallory, 2, { type: "community_create", community: { id: "c_cats", name: "Taken over" } }),
    entry(user, 3, { type: "community_join", community_id: "c_cats" }),
    entry(mallory, 4, { type: "community_mod_add", community_id: "c_cats", target: mallory }),
    entry(owner, 5, { type: "community_mod_add", community_id: "c_cats", target: mod }),
    entry(mallory, 6, { type: "community_ban", community_id: "c_cats", target: user }),
    entry(mod, 7, { type: "community_ban", community_id: "c_cats", target: mallory }),
    entry(mallory, 8, { type: "community_join", community_id: "c_cats" }),
    entry(mod, 9, { type: "community_ban", community_id: "c_cats", target: owner }),
    entry(user, 10, { type: "community_delete_post", community_id: "c_cats", post_id: "p1", post_author: owner }),
    entry(mod, 11, { type: "community_delete_post", community_id: "c_cats", post_id: "p2", post_author: user }),
  ];
  const [c] = foldCommunities(log, []);
  assert.equal(c.name, "Cats");
  assert.equal(c.creator, owner);
  assert.deepEqual(c.moderators, [owner, mod]);
  assert.deepEqual(c.members, [owner, user]);
  assert.deepEqual(c.banned_members, [mallory]);
  assert.deepEqual(c.deleted_post_ids, ["p2"]);
  // the order entries arrive in does not matter
  assert.deepEqual(foldCommunities([...log].reverse(), []), [c]);
});

test("logfold: chat keeps messages sent by the entry author and honors who may delete", () => {
  const msg = (id: string, sender: string, ts: number) => ({ id, room_id: "r", sender, text: id, timestamp: ts, sig: "" });
  const log = [
    entry(user, 1, { type: "chat", message: msg("m1", user, 1) }),
    entry(mallory, 2, { type: "chat", message: msg("m2", user, 2) }), // forged sender
    entry(mallory, 3, { type: "chat", message: msg("m3", mallory, 3) }),
    entry(mallory, 4, { type: "chat_delete", roomId: "r", messageId: "m1" }),
    entry(user, 5, { type: "chat", message: { ...msg("m4", user, 5), room_id: "other" } }),
  ];
  assert.deepEqual(foldChat(log, "r").map((m) => m.id), ["m1", "m3"]);
  assert.deepEqual(foldChat(log, "r", () => true, (s) => s === mallory).map((m) => m.id), []);
});

test("logfold: a room descriptor counts only from its creator", () => {
  const room = { id: "privroom_1", creator: owner, name_encrypted: "x", members: [owner, user], encrypted_keys: {}, created_at: 1, sig: "" };
  const log = [
    entry(owner, 1, { type: "private_room", room }),
    entry(mallory, 2, { type: "private_room", room: { ...room, members: [mallory] } }),
    entry(mod, 3, { type: "room_join", roomId: "privroom_1" }),
  ];
  assert.deepEqual(foldRoom(log, "privroom_1")?.members, [owner, user, mod]);
  assert.equal(foldRoom([log[1]], "privroom_1"), null);
});

test("logfold: room moderators can kick members, but not the creator or each other", () => {
  const room = { id: "privroom_1", creator: owner, name_encrypted: "n0", members: [owner, mod, user, mallory], moderators: [mod, mallory.replace(/d/g, "e")], encrypted_keys: {}, created_at: 1, sig: "" };
  const kick = (author: string, ts: number, target: string, extra: object = {}) =>
    entry(author, ts, { type: "room_kick", roomId: "privroom_1", target, name_encrypted: "n1", encrypted_keys: { [owner]: "k", [mod]: "k", [user]: "k", [mallory]: "k" }, keys_enc_pub: mod, ...extra });
  const log = [
    entry(owner, 1, { type: "private_room", room }),
    kick(mallory, 2, user), // not a moderator
    kick(mod, 3, owner), // the creator cannot be kicked
    kick(mod, 4, mod), // a moderator cannot kick a moderator (including themselves)
    kick(mod, 5, user), // allowed
  ];
  const r = foldRoom(log, "privroom_1")!;
  assert.deepEqual(r.members, [owner, mod, mallory]);
  assert.deepEqual(r.moderators, [mod]); // names that are not members are dropped
  assert.equal(r.name_encrypted, "n1");
  assert.equal(r.keys_enc_pub, mod);
  assert.deepEqual(Object.keys(r.encrypted_keys).sort(), [owner, mod, mallory].sort()); // the kicked member's key is gone
  assert.deepEqual(foldRoom([...log].reverse(), "privroom_1"), r); // arrival order does not matter
  // the creator can kick a moderator, who then loses the role
  const byOwner = foldRoom([...log, kick(owner, 6, mod, { keys_enc_pub: undefined })], "privroom_1")!;
  assert.deepEqual(byOwner.members, [owner, mallory]);
  assert.deepEqual(byOwner.moderators, []);
  assert.equal(byOwner.keys_enc_pub, undefined);
});
