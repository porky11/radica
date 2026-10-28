import { lightFeedOf, type LightFeed } from "./feedlight.ts";

self.onmessage = (e: MessageEvent<{ id: number; raw: string; delta?: string }>) => {
  let feed: LightFeed = { posts: [] };
  try { feed = lightFeedOf(e.data.raw, e.data.delta); } catch { /* unreadable feed or delta: no posts, no text */ }
  (self as unknown as Worker).postMessage({ id: e.data.id, feed });
};
