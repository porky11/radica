// Posts I saved for later, kept on this device (and with my identity: the key is durable, see durable.ts). A copy of
// each post is kept, so it stays readable after it drops out of the feeds my node reads.
import { safeStorage } from "./storage.ts";
import type { Post } from "./types.ts";

const PREFIX = "radica_saved_posts_";
/** The identity delegate refuses values over 256 KB: the oldest saves go first past this. */
const MAX_BYTES = 200_000;

const keyOf = (me: string) => PREFIX + me;
export const savedId = (p: { author: string; id: string }) => `${p.author}:${p.id}`;

let memo: { raw: string; ids: Set<string>; posts: Post[] } = { raw: "", ids: new Set(), posts: [] };

/** My saved posts, newest save first (parsed once per change: every feed card asks). */
function load(me: string): typeof memo {
  const raw = safeStorage.getItem(keyOf(me)) || "[]";
  if (raw === memo.raw) return memo;
  let posts: Post[] = [];
  try {
    const list = JSON.parse(raw);
    if (Array.isArray(list)) posts = list.filter((p) => p && typeof p.id === "string" && typeof p.author === "string");
  } catch {
    // unreadable: as if empty
  }
  return (memo = { raw, ids: new Set(posts.map(savedId)), posts });
}

export const savedPosts = (me: string): Post[] => load(me).posts.slice();

export const isSaved = (me: string, p: { author: string; id: string }) => load(me).ids.has(savedId(p));

/** Save or unsave `post`; returns whether it is saved now. */
export function toggleSaved(me: string, post: Post): boolean {
  const rest = savedPosts(me).filter((s) => savedId(s) !== savedId(post));
  const saved = rest.length === savedPosts(me).length;
  const list = saved ? [post, ...rest] : rest;
  while (list.length > 1 && JSON.stringify(list).length > MAX_BYTES) list.pop();
  safeStorage.setItem(keyOf(me), JSON.stringify(list));
  return saved;
}
