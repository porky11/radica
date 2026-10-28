// Community milestones, an easter egg (five quick clicks on the "Radica" title). Counted from what this node sees:
// there is no central counter on Freenet, which is the point.
import { likers, type Post } from "./types.ts";

export type Metric = "posts" | "communities" | "people" | "comments" | "likes";
export type Counts = Record<Metric, number>;
export interface Milestone { id: string; metric: Metric; at: number; text: string }

const M = (metric: Metric, at: number, text: string): Milestone => ({ id: `${metric}-${at}`, metric, at, text });

export const MILESTONES: Milestone[] = [
  M("posts", 100, "100 posts. No server, no owner, no off switch."),
  M("posts", 1000, "1,000 posts, and not one of them sits on a company's disk."),
  M("posts", 10000, "10,000 posts. A library nobody can burn."),
  M("communities", 10, "10 communities. Nobody can shut a room down."),
  M("communities", 50, "50 communities, each one owned by its people."),
  M("communities", 100, "100 communities, and no admin above their moderators."),
  M("people", 10, "10 people, zero accounts, zero data sold."),
  M("people", 100, "100 people who hold their own keys, and their own voice."),
  M("people", 1000, "1,000 people. A crowd no one can deplatform."),
  M("comments", 100, "100 replies. Every word signed, none censored."),
  M("comments", 1000, "1,000 replies, and no algorithm deciding who hears them."),
  M("likes", 100, "100 likes counted by peers, not by an algorithm."),
  M("likes", 1000, "1,000 likes. Attention you give, not attention sold."),
];

export const METRIC_LABELS: Record<Metric, string> = { posts: "posts", communities: "communities", people: "people", comments: "replies", likes: "likes" };

export function countsOf(posts: Post[], communities: number, people: number): Counts {
  let comments = 0;
  let likes = 0;
  for (const p of posts) {
    comments += Object.keys(p.comments ?? {}).length;
    likes += likers(p).length;
  }
  return { posts: posts.length, communities, people, comments, likes };
}

export const reached = (c: Counts): Milestone[] => MILESTONES.filter((m) => c[m.metric] >= m.at);

/** Per metric, the first milestone not reached yet: shown with its progress, the ones after it stay "???". */
export const nextUp = (c: Counts): Milestone[] =>
  (Object.keys(METRIC_LABELS) as Metric[]).flatMap((k) => MILESTONES.find((m) => m.metric === k && c[k] < m.at) ?? []);
