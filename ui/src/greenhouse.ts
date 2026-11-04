// Greenhouse: supporters plant ideas (a feature or a bug) with a closing date, and supporters vote on them, weighted
// by tier. It shows how the community feels; it does not decide what gets built. Everything lives in the signed
// `greenhouse` log: each entry carries its author's supporter receipt, so every reader checks it on their own device.
import type { LogEntry } from "./logfold.ts";
import type { SupporterTier } from "./supporter.ts";

export type SeedKind = "feature" | "bug";
export const SEED_STATUSES = { considering: "🔍 Considering", planned: "🗓️ Planned", done: "✅ Done", "not-now": "💤 Not now" } as const;
export type SeedStatus = keyof typeof SEED_STATUSES;
export const TIER_WEIGHT: Record<SupporterTier, number> = { sprout: 1, root: 2, oak: 3 };
export const SEED_DAYS = [3, 7, 14, 30];
const DAY_MS = 86_400_000;

export interface Seed {
  id: string; // `${author}:${entry id}`
  author: string;
  kind: SeedKind;
  title: string;
  text: string;
  ts: number;
  closes: number;
  up: number; // weighted
  down: number; // weighted (features only: a bug is there or it is not)
  voters: number;
  mine: -1 | 0 | 1;
  status?: SeedStatus;
}

const parse = (e: LogEntry): any => {
  try {
    return JSON.parse(e.body);
  } catch {
    return null;
  }
};

/** Each author's newest receipt token in the log: what their seeds and votes are checked against. */
export function greenhouseTokens(entries: LogEntry[]): Map<string, string> {
  const out = new Map<string, { ts: number; token: string }>();
  for (const e of entries) {
    const b = parse(e);
    if (typeof b?.receipt === "string" && e.ts >= (out.get(e.author)?.ts ?? -1)) out.set(e.author, { ts: e.ts, token: b.receipt });
  }
  return new Map([...out].map(([a, v]) => [a, v.token]));
}

/**
 * The seeds, open ones first (best score first), then closed ones (newest closing first).
 * `tierOf` gives an author's verified supporter tier: seeds and votes of anyone else are not counted.
 */
export function foldGreenhouse(entries: LogEntry[], tierOf: (author: string) => SupporterTier | undefined, me: string, maintainer: string): Seed[] {
  const sorted = [...entries].sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  const seeds = new Map<string, Seed>();
  for (const e of sorted) {
    const b = parse(e);
    if (b?.type !== "seed" || !tierOf(e.author) || (b.kind !== "feature" && b.kind !== "bug")) continue;
    const title = typeof b.title === "string" ? b.title.trim().slice(0, 120) : "";
    if (!title) continue;
    const days = SEED_DAYS.includes(b.days) ? b.days : 14;
    const id = `${e.author}:${e.id}`;
    seeds.set(id, { id, author: e.author, kind: b.kind, title, text: typeof b.text === "string" ? b.text.slice(0, 2000) : "", ts: e.ts, closes: e.ts + days * DAY_MS, up: 0, down: 0, voters: 0, mine: 0 });
  }
  // each voter's newest vote before the seed closes
  // shortcut: a vote's time is the voter's own clock, so a back-dated vote after closing still counts; fine for a poll that only orients
  const votes = new Map<string, { seed: Seed; author: string; v: number }>();
  for (const e of sorted) {
    const b = parse(e);
    const seed = typeof b?.seed === "string" ? seeds.get(b.seed) : undefined;
    if (!seed) continue;
    if (b.type === "status" && e.author === maintainer && (b.status === null || b.status in SEED_STATUSES)) seed.status = b.status ?? undefined;
    if (b.type === "vote" && tierOf(e.author) && e.ts >= seed.ts && e.ts <= seed.closes && [-1, 0, 1].includes(b.v))
      votes.set(`${e.author}|${seed.id}`, { seed, author: e.author, v: seed.kind === "bug" ? Math.max(0, b.v) : b.v });
  }
  for (const { seed, author, v } of votes.values()) {
    const w = TIER_WEIGHT[tierOf(author)!];
    if (v > 0) seed.up += w;
    if (v < 0) seed.down += w;
    if (v) seed.voters++;
    if (author === me) seed.mine = v as -1 | 0 | 1;
  }
  const now = Date.now();
  return [...seeds.values()].sort((a, b) => {
    const ao = a.closes > now, bo = b.closes > now;
    if (ao !== bo) return ao ? -1 : 1;
    return ao ? b.up - b.down - (a.up - a.down) || b.ts - a.ts : b.closes - a.closes;
  });
}
