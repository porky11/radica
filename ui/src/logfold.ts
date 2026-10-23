// Turning the signed entries of a log (log-contract) into app state. The contract guarantees who wrote each entry;
// what an author may do (moderate, edit a community) is decided here, by replaying entries in a fixed order.
import type { ChatMessage, Community, PrivateRoom } from "./types.ts";
import type { Cert } from "./whoiam.ts";

export type LogEntry = { author: string; id: string; ts: number; body: string; sig: string; cert?: Cert };

const ordered = (entries: LogEntry[]) =>
  [...entries].sort((a, b) => a.ts - b.ts || (a.author + a.id < b.author + b.id ? -1 : 1));

function bodies(entries: LogEntry[]): { e: LogEntry; b: any }[] {
  const out: { e: LogEntry; b: any }[] = [];
  for (const e of ordered(entries)) {
    try {
      out.push({ e, b: JSON.parse(e.body) });
    } catch {
      // not JSON: ignore
    }
  }
  return out;
}

const isMod = (c: Community, pk: string) => pk === c.creator || c.moderators.includes(pk);

/** Communities from the `communities` log, on top of `base` (the built-in ones). */
export function foldCommunities(entries: LogEntry[], base: Community[]): Community[] {
  const map = new Map<string, Community>(base.map((c) => [c.id, structuredClone(c)]));
  for (const { e, b } of bodies(entries)) {
    const a = e.author;
    if (b.type === "community_create") {
      const m = b.community ?? {};
      if (typeof m.id !== "string" || !/^c_[a-z0-9_]{1,40}$/.test(m.id)) continue;
      const cur = map.get(m.id);
      if (!cur) {
        map.set(m.id, {
          id: m.id,
          slug: m.id.slice(2),
          name: String(m.name ?? "").slice(0, 100),
          description: String(m.description ?? "").slice(0, 2000),
          avatar_url: typeof m.avatar_url === "string" ? m.avatar_url : undefined,
          created_at: e.ts,
          creator: a,
          moderators: [a],
          members: [a],
          banned_members: [],
          deleted_post_ids: [],
          sig: e.sig,
        });
      } else if (cur.creator === a) {
        cur.name = String(m.name ?? cur.name).slice(0, 100);
        cur.description = String(m.description ?? cur.description).slice(0, 2000);
        if (typeof m.avatar_url === "string") cur.avatar_url = m.avatar_url;
      }
      continue;
    }
    const c = map.get(b.community_id);
    if (!c) continue;
    const banned = (c.banned_members ??= []);
    const t = typeof b.target === "string" ? b.target : "";
    switch (b.type) {
      case "community_join":
        if (!banned.includes(a) && !c.members.includes(a)) c.members.push(a);
        break;
      case "community_leave":
        c.members = c.members.filter((m) => m !== a);
        break;
      case "community_mod_add":
        if (isMod(c, a) && t && !banned.includes(t) && !c.moderators.includes(t)) c.moderators.push(t);
        break;
      case "community_mod_remove":
        if (t !== c.creator && (a === c.creator || a === t)) c.moderators = c.moderators.filter((m) => m !== t);
        break;
      case "community_ban":
        if (isMod(c, a) && t && t !== c.creator) {
          if (!banned.includes(t)) banned.push(t);
          c.members = c.members.filter((m) => m !== t);
          c.moderators = c.moderators.filter((m) => m !== t);
        }
        break;
      case "community_unban":
        if (isMod(c, a)) c.banned_members = banned.filter((m) => m !== t);
        break;
      case "community_delete_post":
        if ((isMod(c, a) || a === b.post_author) && typeof b.post_id === "string" && !c.deleted_post_ids.includes(b.post_id))
          c.deleted_post_ids.push(b.post_id);
        break;
    }
  }
  return [...map.values()];
}

/**
 * Chat messages from a log: each message must be sent by the entry's author.
 * `canDelete(author, message)` says who may remove a message; `blocked(sender)` hides senders (e.g. banned).
 */
export function foldChat(
  entries: LogEntry[],
  roomId: string,
  canDelete: (author: string, m: ChatMessage) => boolean = (a, m) => a === m.sender,
  blocked: (sender: string) => boolean = () => false
): ChatMessage[] {
  const msgs = new Map<string, ChatMessage>();
  const deletes: { author: string; id: string }[] = [];
  for (const { e, b } of bodies(entries)) {
    if (b.type === "chat" && b.message?.sender === e.author && b.message.room_id === roomId && typeof b.message.id === "string") {
      msgs.set(b.message.id, b.message);
    } else if (b.type === "chat_delete" && b.roomId === roomId) {
      deletes.push({ author: e.author, id: b.messageId });
    }
  }
  for (const d of deletes) {
    const m = msgs.get(d.id);
    if (m && canDelete(d.author, m)) msgs.delete(d.id);
  }
  return [...msgs.values()].filter((m) => !blocked(m.sender)).sort((x, y) => x.timestamp - y.timestamp);
}

/**
 * The room as its creator last published it (in its own log or an invite), plus members who joined by link since.
 * A moderator the creator named can kick (`room_kick`, with the rotated keys): never the creator, never another moderator.
 */
export function foldRoom(entries: LogEntry[], roomId: string): PrivateRoom | null {
  let room: PrivateRoom | null = null;
  for (const { e, b } of bodies(entries)) {
    if ((b.type === "private_room" || b.type === "room_invite") && b.room?.id === roomId && b.room.creator === e.author) {
      room = structuredClone(b.room);
      room!.moderators = (room!.moderators ?? []).filter((m) => m !== room!.creator && room!.members.includes(m));
    } else if (b.type === "room_join" && b.roomId === roomId && room && !room.members.includes(e.author)) {
      room.members.push(e.author);
    } else if (b.type === "room_kick" && b.roomId === roomId && room && typeof b.target === "string") {
      const byCreator = e.author === room.creator;
      const mods = room.moderators ?? [];
      const allowed = byCreator || mods.includes(e.author);
      if (!allowed || b.target === room.creator || !room.members.includes(b.target) || (!byCreator && mods.includes(b.target))) continue;
      room.members = room.members.filter((m) => m !== b.target);
      room.moderators = mods.filter((m) => m !== b.target);
      const keys: Record<string, string> = typeof b.encrypted_keys === "object" && b.encrypted_keys ? b.encrypted_keys : {};
      room.encrypted_keys = Object.fromEntries(Object.entries(keys).filter(([m]) => room!.members.includes(m)));
      if (typeof b.name_encrypted === "string") room.name_encrypted = b.name_encrypted;
      room.keys_enc_pub = typeof b.keys_enc_pub === "string" ? b.keys_enc_pub : undefined;
    }
  }
  return room;
}
