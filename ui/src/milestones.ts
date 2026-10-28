// Community milestones, an easter egg (five quick clicks on the "Radica" title). Counted from what this node sees:
// there is no central counter on Freenet, which is the point.
import { likers, type Post } from "./types.ts";

export type Metric = "posts" | "communities" | "people" | "comments" | "likes";
export type Counts = Record<Metric, number>;
export interface Milestone { id: string; metric: Metric; at: number; text: string }

export const METRIC_LABELS: Record<Metric, string> = { posts: "posts", communities: "communities", people: "people", comments: "replies", likes: "likes" };

/** Each metric's series: the first threshold, then every power of ten after it, without end. */
const FIRST: Record<Metric, number> = { posts: 100, communities: 10, people: 10, comments: 100, likes: 100 };

const WRITTEN: Record<string, string> = {
  "posts-100": "100 posts. No server, no owner, no off switch.",
  "posts-1000": "1,000 posts, and not one of them sits on a company's disk.",
  "posts-10000": "10,000 posts. A library nobody can burn.",
  "communities-10": "10 communities. Nobody can shut a room down.",
  "communities-100": "100 communities, and no admin above their moderators.",
  "people-10": "10 people, zero accounts, zero data sold.",
  "people-100": "100 people who hold their own keys, and their own voice.",
  "people-1000": "1,000 people. A crowd no one can deplatform.",
  "comments-100": "100 replies. Every word signed, none censored.",
  "comments-1000": "1,000 replies, and no algorithm deciding who hears them.",
  "likes-100": "100 likes counted by peers, not by an algorithm.",
  "likes-1000": "1,000 likes. Attention you give, not attention sold.",
};

// past the written ones, a line from this pool (the same one for the same milestone, on every node)
const POOL = [
  "Still no server. Still no owner.",
  "Grown from the roots up, not handed down.",
  "Nobody's permission was asked.",
  "Every one of them signed, none of them for sale.",
  "No off switch, no landlord, no algorithm.",
  "Owned by the people who wrote it.",
];

const milestone = (metric: Metric, at: number): Milestone => {
  const id = `${metric}-${at}`;
  const text = WRITTEN[id] ?? `${at.toLocaleString("en")} ${METRIC_LABELS[metric]}. ${POOL[Math.round(Math.log10(at)) % POOL.length]}`;
  return { id, metric, at, text };
};

export function countsOf(posts: Post[], communities: number, people: number, totalPosts = posts.length): Counts {
  let comments = 0;
  let likes = 0;
  for (const p of posts) {
    comments += Object.keys(p.comments ?? {}).length;
    likes += likers(p).length;
  }
  return { posts: Math.max(totalPosts, posts.length), communities, people, comments, likes };
}

const METRICS = Object.keys(METRIC_LABELS) as Metric[];

/** Every milestone reached, oldest threshold first. */
export function reached(c: Counts): Milestone[] {
  const out: Milestone[] = [];
  for (const k of METRICS) for (let at = FIRST[k]; at <= c[k]; at *= 10) out.push(milestone(k, at));
  return out;
}

/** Per metric, the next milestone: shown with its progress; the ones after it stay "???". */
export function nextUp(c: Counts): Milestone[] {
  return METRICS.map((k) => {
    let at = FIRST[k];
    while (at <= c[k]) at *= 10;
    return milestone(k, at);
  });
}
