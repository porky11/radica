import type { Post } from "./types.ts";

// shortcut: a soft budget the app picked, not a limit of Freenet or the contract (the contract only caps one photo).
export const FEED_BUDGET = 16 * 1024 * 1024;
export const FEED_TARGET = Math.floor(FEED_BUDGET * 0.75); // "free space" deletes down to here

export const postBytes = (p: Post): number => JSON.stringify(p).length;
export const feedBytes = (posts: Post[]): number => posts.reduce((n, p) => n + postBytes(p), 0);

/** Ids of the oldest posts to delete so the rest weighs at most `target`. */
export function oldestToFree(posts: Post[], target: number): string[] {
  let total = feedBytes(posts);
  const ids: string[] = [];
  for (const p of [...posts].sort((a, b) => a.timestamp - b.timestamp)) {
    if (total <= target) break;
    ids.push(p.id);
    total -= postBytes(p);
  }
  return ids;
}

export const formatBytes = (n: number): string => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
