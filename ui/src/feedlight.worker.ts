import { newestPosts } from "./feedlight.ts";

self.onmessage = (e: MessageEvent<{ id: number; raw: string }>) => {
  let posts: unknown[] = [];
  try { posts = newestPosts(e.data.raw); } catch { /* unreadable feed: no posts */ }
  (self as unknown as Worker).postMessage({ id: e.data.id, posts });
};
