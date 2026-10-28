import type { Post, ProfileInfo } from "./types.ts";

/** Posts kept per other person when drawing the timeline: it is paged 20 at a time, so older ones are never on the first screens. */
export const PEER_POSTS = 60;

/** What the page needs of another person's feed: their newest posts and their profile. */
export type LightFeed = { posts: Post[]; profile?: ProfileInfo };

/** The newest `n` posts and the profile of a stored feed. Parsing a big feed is what blocks the page, so this runs in a worker. */
export function lightFeed(raw: string, n = PEER_POSTS): LightFeed {
  const feed = JSON.parse(raw);
  const posts: Post[] = Object.values<Post>(feed.posts ?? {}).sort((a, b) => b.timestamp - a.timestamp).slice(0, n);
  return { posts, profile: feed.profile ?? undefined };
}

let worker: Worker | undefined;
let seq = 0;
const waiting = new Map<number, (f: LightFeed) => void>();

/** Same as `lightFeed`, off the main thread; parses inline where there is no Worker (tests). An unreadable feed is empty. */
export function lightFeedAsync(raw: string): Promise<LightFeed> {
  const inline = () => {
    try {
      return Promise.resolve(lightFeed(raw));
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
    worker!.postMessage({ id, raw });
  });
}
