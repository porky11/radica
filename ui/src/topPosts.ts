import type { Post } from "./types.ts";

/** How the feed is ordered: newest first, or the best-liked posts of the last day, week, or ever. */
export type FeedSort = "recent" | "top24h" | "top7d" | "topAll";

const DAY_MS = 86_400_000;
const WINDOW_MS: Record<FeedSort, number> = { recent: Infinity, top24h: DAY_MS, top7d: 7 * DAY_MS, topAll: Infinity };

/** What a like and a dislike count for, by who gave it (the reader's web of trust); each counts 1 when not given. */
export type Weights = { like(pubkey: string): number; dislike(pubkey: string): number };
const EQUAL: Weights = { like: () => 1, dislike: () => 1 };

/** A post's score: likes (not its author's own) minus dislikes, each by its giver's weight. */
export function postScore(likers: string[], dislikers: string[], author: string, w: Weights = EQUAL): number {
  const likes = new Set(likers);
  likes.delete(author);
  let score = 0;
  for (const k of likes) score += w.like(k);
  for (const k of new Set(dislikers)) score -= w.dislike(k);
  return score;
}

/** Posts dated further ahead than this are not shown: a contract has no clock, so a date far in the future would stay on top for good. */
export const FUTURE_SLACK_MS = 5 * 60_000;
export const isFuture = (p: { timestamp: number }, now = Date.now()): boolean => p.timestamp > now + FUTURE_SLACK_MS;

/**
 * `posts` ordered for `sort`. "recent" is newest first. A "top" keeps the posts of its window with a score above zero,
 * best first, the newest first among equals. `dislikersOf` is a log (not in the post), so it is passed in.
 */
export function sortPosts(posts: Post[], sort: FeedSort, likersOf: (p: Post) => string[], dislikersOf: (p: Post) => string[], now = Date.now(), weights?: Weights): Post[] {
  if (sort === "recent") return [...posts].sort((a, b) => b.timestamp - a.timestamp);
  const since = now - WINDOW_MS[sort];
  return posts
    .filter((p) => p.timestamp >= since)
    .map((p) => ({ p, score: postScore(likersOf(p), dislikersOf(p), p.author, weights) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.timestamp - a.p.timestamp)
    .map((x) => x.p);
}
