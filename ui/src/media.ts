// Post images kept in their own contract (media-contract/): a post names one as "radica-media:<BLAKE3 hex of its bytes>".
// Posts published before keep their image inside the feed as a data: URI.
import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex } from "./crypto.ts";

export const MEDIA_PREFIX = "radica-media:";

export const mediaHashOf = (bytes: Uint8Array): string => bytesToHex(blake3(bytes));

/** The image hash a media_uri names, or null for anything else (a data: URI, a link). */
export function mediaRef(uri?: string): string | null {
  const h = uri?.startsWith(MEDIA_PREFIX) ? uri.slice(MEDIA_PREFIX.length) : "";
  return /^[0-9a-f]{64}$/.test(h) ? h : null;
}

/** The bytes of a base64 image data: URI, or null. */
export function dataUrlBytes(uri: string): Uint8Array | null {
  const m = /^data:image\/[\w.+-]+;base64,([A-Za-z0-9+/=]+)$/.exec(uri);
  return m ? Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)) : null;
}

// shortcut: the oldest blob: URLs are released past MAX_URLS, an image scrolled far back is fetched again
const MAX_URLS = 200;
const urls = new Map<string, string>(); // hash -> blob: URL
const inflight = new Map<string, Promise<string | undefined>>();

/** Keep `bytes` as the image `hash` names; returns its blob: URL. */
export function keepMedia(hash: string, bytes: Uint8Array): string {
  let u = urls.get(hash);
  if (!u) {
    u = URL.createObjectURL(new Blob([bytes as BlobPart]));
    urls.set(hash, u);
    if (urls.size > MAX_URLS) {
      const [k, v] = urls.entries().next().value as [string, string];
      URL.revokeObjectURL(v);
      urls.delete(k);
    }
  }
  return u;
}

/** A blob: URL for image `hash`: kept, or fetched once with `get` (concurrent callers share the fetch). Undefined when
 *  the network has it not (yet). */
export function mediaUrl(hash: string, get: (hash: string) => Promise<Uint8Array | null>): Promise<string | undefined> {
  const kept = urls.get(hash);
  if (kept) return Promise.resolve(kept);
  let p = inflight.get(hash);
  if (!p) {
    p = get(hash)
      .then((b) => (b ? keepMedia(hash, b) : undefined), () => undefined)
      .finally(() => inflight.delete(hash));
    inflight.set(hash, p);
  }
  return p;
}
