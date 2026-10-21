import type { FeedState } from "./types.ts";

/** Apply `d` (a change the network has not accepted yet) on top of `f`, with the feed contract's merge rules. */
export function overlayFeed(f: FeedState, d: FeedState): FeedState {
  if (d.profile && (!f.profile || d.profile.updated_at > f.profile.updated_at)) f.profile = d.profile;
  if ((d.following_updated_at ?? 0) > (f.following_updated_at ?? 0)) {
    f.following = d.following;
    f.following_updated_at = d.following_updated_at;
    f.following_sig = d.following_sig;
    f.following_cert = d.following_cert;
  }
  for (const [id, del] of Object.entries(d.deleted ?? {})) {
    delete f.posts[id];
    f.deleted = { ...f.deleted, [id]: del };
  }
  for (const [id, p] of Object.entries(d.posts)) {
    if (f.deleted?.[id]) continue;
    const cur = (f.posts[id] ??= { ...p, likes: {}, comments: {} });
    cur.comments = { ...cur.comments, ...p.comments };
    cur.likes = { ...cur.likes };
    for (const [k, l] of Object.entries(p.likes ?? {})) if (!cur.likes[k] || l.ts > cur.likes[k].ts) cur.likes[k] = l;
  }
  return f;
}
