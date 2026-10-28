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
let seq = 0;
const waiting = new Map<number, (f: LightFeed) => void>();

/** Same as `lightFeedOf`, off the main thread; inline where there is no Worker (tests). Unreadable: no posts, no `text`. */
export function lightFeedAsync(raw: string, delta?: string): Promise<LightFeed> {
  const inline = () => {
    try {
      return Promise.resolve(lightFeedOf(raw, delta));
    } catch {
      return Promise.resolve({ posts: [] });
    }
  };
  if (typeof Worker === "undefined") return inline();
  try {
    worker ??= Object.assign(new Worker(new URL("./feedlight.worker.ts", import.meta.url), { type: "module" }), {
      onmessage: (e: MessageEvent<{ id: number; feed: LightFeed }>) => {
        waiting.get(e.data.id)?.(e.data.feed);
        waiting.delete(e.data.id);
      },
    });
  } catch {
    return inline();
  }
  return new Promise((resolve) => {
    const id = ++seq;
    waiting.set(id, resolve);
    worker!.postMessage({ id, raw, delta });
  });
}
