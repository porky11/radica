import type { Post } from "./types.ts";

/** How the feed is ordered: newest first, or the best-liked posts of the last day, week, or ever. */
export type FeedSort = "recent" | "top24h" | "top7d" | "topAll";

const DAY_MS = 86_400_000;
const WINDOW_MS: Record<FeedSort, number> = { recent: Infinity, top24h: DAY_MS, top7d: 7 * DAY_MS, topAll: Infinity };

/** A post's score: likes (not its author's own) minus dislikes. */
export function postScore(likers: string[], dislikers: string[], author: string): number {
  const likes = new Set(likers);
  likes.delete(author);
  return likes.size - new Set(dislikers).size;
}

/**
 * `posts` ordered for `sort`. "recent" is newest first. A "top" keeps the posts of its window with a score above zero,
 * best first, the newest first among equals. `dislikersOf` is a log (not in the post), so it is passed in.
 */
export function sortPosts(posts: Post[], sort: FeedSort, likersOf: (p: Post) => string[], dislikersOf: (p: Post) => string[], now = Date.now()): Post[] {
  if (sort === "recent") return [...posts].sort((a, b) => b.timestamp - a.timestamp);
  const since = now - WINDOW_MS[sort];
  return posts
    .filter((p) => p.timestamp >= since)
    .map((p) => ({ p, score: postScore(likersOf(p), dislikersOf(p), p.author) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.timestamp - a.p.timestamp)
    .map((x) => x.p);
}
