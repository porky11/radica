import { lightFeed, type LightFeed } from "./feedlight.ts";

self.onmessage = (e: MessageEvent<{ id: number; raw: string }>) => {
  let feed: LightFeed = { posts: [] };
  try { feed = lightFeed(e.data.raw); } catch { /* unreadable feed: no posts */ }
  (self as unknown as Worker).postMessage({ id: e.data.id, feed });
};
