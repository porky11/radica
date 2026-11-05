import type { FeedState } from "./types.ts";

export type WhyGone = "deleted" | "undelivered" | "waiting";

/** Why a post is not shown: its author took it back (a signed tombstone in their feed), their feed is here but the post is not, or their feed has not arrived. */
export function whyGone(feed: Pick<FeedState, "posts" | "deleted"> | null, postId: string): WhyGone {
  if (!feed) return "waiting";
  if (feed.deleted?.[postId]) return "deleted";
  return "undelivered";
}

export const GONE_MESSAGE: Record<WhyGone, string> = {
  deleted: "The author deleted this post.",
  undelivered: "This post is not here yet: the author's feed arrived without it, so the network may still be delivering it. Try again in a moment.",
  waiting: "Still waiting for the author's feed from the network. Try again in a moment.",
};
