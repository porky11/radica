import type { Post } from "./types.ts";

/** Posts kept per other person when drawing the timeline: it is paged 20 at a time, so older ones are never on the first screens. */
export const PEER_POSTS = 60;

/** The newest `n` posts of a stored feed. Parsing a big feed is what blocks the page, so this runs in a worker. */
export function newestPosts(raw: string, n = PEER_POSTS): Post[] {
  const posts: Record<string, Post> = JSON.parse(raw).posts ?? {};
  return Object.values(posts).sort((a, b) => b.timestamp - a.timestamp).slice(0, n);
}

let worker: Worker | undefined;
let seq = 0;
const waiting = new Map<number, (p: Post[]) => void>();

/** Same as `newestPosts`, off the main thread; parses inline where there is no Worker (tests). */
export function newestPostsAsync(raw: string): Promise<Post[]> {
  if (typeof Worker === "undefined") return Promise.resolve(newestPosts(raw));
  try {
    worker ??= Object.assign(new Worker(new URL("./feedlight.worker.ts", import.meta.url), { type: "module" }), {
      onmessage: (e: MessageEvent<{ id: number; posts: Post[] }>) => {
        waiting.get(e.data.id)?.(e.data.posts);
        waiting.delete(e.data.id);
      },
    });
  } catch {
    return Promise.resolve(newestPosts(raw));
  }
  return new Promise((resolve) => {
    const id = ++seq;
    waiting.set(id, resolve);
    worker!.postMessage({ id, raw });
  });
}
