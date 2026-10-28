import type { Community } from "./types.ts";

export type CommunitySort = "popular" | "members" | "newest" | "name";

export interface FinderInput {
  communities: Community[];
  /** What was typed; a leading `r/` is ignored. */
  query: string;
  sort: CommunitySort;
  /** Communities I joined, or the one on screen, stay above the rest. */
  pinned: (c: Community) => boolean;
  /** Posts seen per community id (the feed already loaded). */
  postsIn: Map<string, number>;
  /** How many tiles to show. */
  limit: number;
}

export interface FinderResult {
  shown: Community[];
  /** Pinned ones among `shown`. */
  pinnedCount: number;
  /** Matches left out by the limit. */
  more: number;
  /** The slug a new community would get, when the typed name matches none. */
  create?: string;
}

/** The slug `createCommunity` makes from what was typed. */
export const slugOf = (raw: string): string =>
  raw.trim().toLowerCase().replace(/^r\//, "").replace(/[^a-z0-9_]/g, "").slice(0, 40);

const compare = (sort: CommunitySort, postsIn: Map<string, number>) => (a: Community, b: Community): number => {
  const byName = a.slug.localeCompare(b.slug);
  switch (sort) {
    case "popular":
      return (postsIn.get(b.id) ?? 0) - (postsIn.get(a.id) ?? 0) || b.members.length - a.members.length || byName;
    case "members":
      return b.members.length - a.members.length || byName;
    case "newest":
      return b.created_at - a.created_at || byName;
    case "name":
      return byName;
  }
};

export function findCommunities(input: FinderInput): FinderResult {
  const q = input.query.trim().toLowerCase().replace(/^r\//, "");
  const matches = input.communities.filter(
    (c) => !q || c.slug.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
  );
  const order = compare(input.sort, input.postsIn);
  const pinned = matches.filter(input.pinned).sort(order);
  const rest = matches.filter((c) => !input.pinned(c)).sort(order);
  const all = [...pinned, ...rest];
  const shown = all.slice(0, input.limit);
  const slug = slugOf(input.query);
  const taken = input.communities.some((c) => c.slug.toLowerCase() === slug || c.id.toLowerCase() === slug);
  return {
    shown,
    pinnedCount: Math.min(pinned.length, shown.length),
    more: all.length - shown.length,
    create: q && slug && !taken ? slug : undefined,
  };
}
