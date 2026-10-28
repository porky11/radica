import type { Post, ProfileInfo } from "./types.ts";
import { overlayFeed } from "./feedmerge.ts";

/** Posts kept per other person when drawing the timeline: it is paged 20 at a time, so older ones are never on the first screens. */
export const PEER_POSTS = 60;

/** What the page needs of another person's feed: their newest posts and their profile; `text`: the feed with a delta applied. */
export type LightFeed = { posts: Post[]; profile?: ProfileInfo; text?: string; total?: number };

/** The stored feed `raw` with `delta` (from a change notification) applied, as JSON text. */
export function mergeFeedText(raw: string, delta: string): string {
  return JSON.stringify(overlayFeed(JSON.parse(raw), JSON.parse(delta)));
}

/** `lightFeed` of `raw`, or of `raw` with `delta` applied (then `text` is the merged feed). Throws on unreadable JSON. */
export function lightFeedOf(raw: string, delta?: string): LightFeed {
  if (delta === undefined) return lightFeed(raw);
  const text = mergeFeedText(raw, delta);
  return { ...lightFeed(text), text };
}

/** The newest `n` posts and the profile of a stored feed. Parsing a big feed is what blocks the page, so this runs in a worker. */
export function lightFeed(raw: string, n = PEER_POSTS): LightFeed {
  const feed = JSON.parse(raw);
  const all = Object.values<Post>(feed.posts ?? {});
  const posts = all.sort((a, b) => b.timestamp - a.timestamp).slice(0, n);
  return { posts, profile: feed.profile ?? undefined, total: all.length };
}

let worker: Worker | undefined;
let broken = false;
let answered = false;
let seq = 0;
const waiting = new Map<number, { raw: string; delta?: string; resolve: (f: LightFeed) => void }>();

const parseInline = (raw: string, delta?: string): LightFeed => {
  try {
    return lightFeedOf(raw, delta);
  } catch {
    return { posts: [] };
  }
};

/** The worker could not load or run (Safari in Freenet's sandboxed page): parse here from now on, the waiting ones too. */
function giveUpWorker() {
  broken = true;
  worker?.terminate();
  for (const w of waiting.values()) w.resolve(parseInline(w.raw, w.delta));
  waiting.clear();
}

/** Same as `lightFeedOf`, off the main thread; inline where there is no working Worker (tests, some browsers). Unreadable: no posts, no `text`. */
export function lightFeedAsync(raw: string, delta?: string): Promise<LightFeed> {
  if (broken || typeof Worker === "undefined") return Promise.resolve(parseInline(raw, delta));
  try {
    if (!worker) {
      worker = Object.assign(new Worker(new URL("./feedlight.worker.ts", import.meta.url), { type: "module" }), {
        onmessage: (e: MessageEvent<{ id: number; feed: LightFeed }>) => {
          answered = true;
          waiting.get(e.data.id)?.resolve(e.data.feed);
          waiting.delete(e.data.id);
        },
        onerror: giveUpWorker, // otherwise a worker that never loads leaves every other person's feed unread
        onmessageerror: giveUpWorker,
      });
      setTimeout(() => answered || giveUpWorker(), 5000); // nor an error event: a worker silent from the start
    }
  } catch {
    broken = true;
    return Promise.resolve(parseInline(raw, delta));
  }
  return new Promise((resolve) => {
    const id = ++seq;
    waiting.set(id, { raw, delta, resolve });
    worker!.postMessage({ id, raw, delta });
  });
}
