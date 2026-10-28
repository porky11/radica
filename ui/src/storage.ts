// Safe Storage abstraction for Freenet dApps.
//
// In Freenet's web container (shell.html), the webapp is served in a sandboxed iframe
// that lacks the 'allow-same-origin' flag. In this environment:
// - Accessing `window.localStorage` throws a SecurityError:
//   "Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag."
// - Accessing `window.sessionStorage` also throws.
//
// SafeStorage provides a transparent, non-throwing storage interface that:
// 1. Attempts `window.localStorage` (when running outside the sandbox, e.g. Vite dev or Electron).
// 2. Uses `window.name` to survive in-frame navigations in sandboxed contexts.
// 3. Syncs essential auth/profile keys into the URL hash fragment (#auth_state=...). The hash is pushed to the
//    PARENT shell page through `{__freenet_shell__: true, type: "hash", hash}`: a browser refresh reloads the shell,
//    which forwards its own hash to the iframe. (history.replaceState inside the iframe alone is NOT enough.)
// 4. Maintains an in-memory Map fallback that never throws under any condition.

// Helper to encode a state object to a compact, URL-safe base64 string
function encodeBase64State(obj: Record<string, string>): string {
  try {
    const json = JSON.stringify(obj);
    if (typeof window !== "undefined" && typeof window.btoa === "function") {
      return window.btoa(
        encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16))
        )
      );
    }
    const globalBuffer = (globalThis as unknown as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer;
    if (globalBuffer) {
      return globalBuffer.from(json, "utf8").toString("base64");
    }
    return encodeURIComponent(json);
  } catch {
    return "";
  }
}

// Helper to decode state object from base64 supporting standard UTF-8, legacy, and raw formats
function decodeBase64State(rawB64: string): Record<string, string> | null {
  if (!rawB64) return null;
  // 1. Try standard UTF-8 Base64 decoding
  try {
    if (typeof window !== "undefined" && typeof window.atob === "function") {
      const binStr = window.atob(rawB64);
      const utf8Str = decodeURIComponent(
        Array.prototype.map
          .call(binStr, (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const parsed = JSON.parse(utf8Str);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}

  // 2. Try Node Buffer decoding
  try {
    const globalBuffer = (globalThis as unknown as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer;
    if (globalBuffer) {
      const json = globalBuffer.from(rawB64, "base64").toString("utf8");
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}

  // 3. Try legacy decodeURIComponent(atob(rawB64))
  try {
    if (typeof window !== "undefined" && typeof window.atob === "function") {
      const legacy = decodeURIComponent(window.atob(rawB64));
      const parsed = JSON.parse(legacy);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}

  // 4. Try raw atob
  try {
    if (typeof window !== "undefined" && typeof window.atob === "function") {
      const raw = window.atob(rawB64);
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}

  return null;
}

class SafeStorage {
  private mem = new Map<string, string>();
  private localStorageAvailable: boolean | null = null;
  private windowNamePrefix = "__radica_store__:";
  private hashPrefix = "auth_state=";
  // Strictly capped at 7500 chars because Freenet's parent shell truncates at 8192 (location.hash.slice(0, 8192)).
  private static readonly MAX_HASH_LENGTH = 7500;

  constructor() {
    this.hydrateFromWindowName();
    this.hydrateFromHash();
    // a write waits up to SYNC_DELAY_MS to be persisted: do it now when the page goes away or hides
    globalThis.addEventListener?.("pagehide", () => this.flush());
    globalThis.document?.addEventListener("visibilitychange", () => document.hidden && this.flush());
  }

  // Persisting serializes the whole store into window.name (every cached feed: megabytes) and rebuilds the hash.
  // Done on each write it froze the page for seconds during a sync; now once per burst of writes.
  private static readonly SYNC_DELAY_MS = 1000;
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  private scheduleSync(): void {
    if (this.syncTimer !== undefined) return;
    this.syncTimer = setTimeout(() => this.flush(), SafeStorage.SYNC_DELAY_MS);
  }

  /** Persist pending writes now. */
  public flush(): void {
    clearTimeout(this.syncTimer);
    this.syncTimer = undefined;
    this.syncPersistence();
  }

  private isLocalStorageAvailable(): boolean {
    if (this.localStorageAvailable !== null) return this.localStorageAvailable;
    try {
      if (typeof window === "undefined") {
        this.localStorageAvailable = false;
        return false;
      }
      const testKey = "__radica_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      this.localStorageAvailable = true;
      return true;
    } catch {
      this.localStorageAvailable = false;
      return false;
    }
  }

  private hydrateFromWindowName(): void {
    try {
      if (typeof window !== "undefined" && typeof window.name === "string" && window.name.startsWith(this.windowNamePrefix)) {
        const json = window.name.slice(this.windowNamePrefix.length);
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === "object") {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === "string") {
              this.mem.set(k, v);
            }
          }
        }
      }
    } catch {
      // Ignore if window.name is invalid JSON
    }
  }

  public hydrateFromHashString(hashString: string): void {
    try {
      const hash = hashString.replace(/^#/, "");
      const parts = hash.split("&");
      for (const part of parts) {
        if (part.startsWith(this.hashPrefix)) {
          const rawB64 = part.slice(this.hashPrefix.length);
          const parsed = decodeBase64State(rawB64);
          if (parsed && typeof parsed === "object") {
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === "string") {
                this.mem.set(k, v);
              }
            }
          }
        }
      }
    } catch {
      // Ignore hash parsing errors
    }
  }

  private hydrateFromHash(): void {
    try {
      if (typeof window !== "undefined" && window.location.hash) {
        this.hydrateFromHashString(window.location.hash);
      }
    } catch {
      // Ignore hash parsing errors
    }
  }

  public computeBudgetedState(otherParts: string[] = []): { authObj: Record<string, string>; hash: string } {
    // The shell cuts the hash at 8192 chars and a cut hash is unreadable: everything, identity included, would be lost.
    // So the identity keys always go in, and the rest only while it fits (the private rooms also live in the node's delegate).
    const criticalPrefixes = ["radica_session", "radica_app_key", "radica_ed25519_seed", "radica_signin_pending"];
    const softPrefixes = ["radica_profile_", "freenet_chat_peers_", "freenet_private_rooms", "radica_hidden_users"];
    // Larger data: budgeted strictly up to MAX_HASH_LENGTH (7500 chars)
    const optionalPrefixes = ["freenet_feed_", "freenet_chat_"];

    const build = (obj: Record<string, string>): string => {
      const parts = [...otherParts];
      if (Object.keys(obj).length > 0) {
        const encoded = encodeBase64State(obj);
        if (encoded) {
          parts.push(this.hashPrefix + encoded);
        }
      }
      return parts.length > 0 ? "#" + parts.join("&") : "";
    };

    const authObj: Record<string, string> = {};
    for (const [k, v] of this.mem.entries()) {
      if (criticalPrefixes.some((p) => k.startsWith(p))) authObj[k] = v;
    }
    const fits = (k: string, v: string) => build({ ...authObj, [k]: v }).length <= SafeStorage.MAX_HASH_LENGTH;
    for (const prefix of softPrefixes) {
      for (const [k, v] of this.mem.entries()) {
        if (!k.startsWith(prefix)) continue;
        if (fits(k, v)) {
          authObj[k] = v;
        } else if (k === "freenet_private_rooms") {
          // a room list that is too long: keep the newest rooms that fit
          try {
            const rooms = (JSON.parse(v) as { created_at?: number }[]).sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
            while (rooms.length && !fits(k, JSON.stringify(rooms))) rooms.pop();
            if (rooms.length) authObj[k] = JSON.stringify(rooms);
          } catch {
            // unreadable list: leave it out
          }
        }
      }
    }

    for (const [k, v] of this.mem.entries()) {
      if (optionalPrefixes.some((p) => k.startsWith(p))) {
        if (build({ ...authObj, [k]: v }).length <= SafeStorage.MAX_HASH_LENGTH) {
          authObj[k] = v;
        } else if (k.startsWith("freenet_feed_")) {
          // Gracefully trim feed: omit duplicate profile, keep recent posts, prioritizing media on newest Moment(s)
          try {
            const feed = JSON.parse(v);
            if (feed && feed.posts) {
              // Omit redundant feed.profile if radica_profile_<owner> is already stored in authObj
              const feedToSave: Record<string, any> = { ...feed };
              if (feed.owner && authObj[`radica_profile_${feed.owner}`]) {
                delete feedToSave.profile;
              }

              const postList = Object.values(feed.posts).sort(
                (a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0)
              ) as any[];

              // First check if feedToSave fits completely with all posts and all media!
              const fullCandidate = JSON.stringify(feedToSave);
              if (build({ ...authObj, [k]: fullCandidate }).length <= SafeStorage.MAX_HASH_LENGTH) {
                authObj[k] = fullCandidate;
              } else {
                // Smart fit: keep recent posts, prioritizing media on the most recent post(s)
                let currentPosts = postList.slice(0, 12).map((p) => ({ ...p }));

                const fits = (posts: any[]): boolean => {
                  const postsMap = Object.fromEntries(posts.map((p) => [p.id, p]));
                  const cand = JSON.stringify({ ...feedToSave, posts: postsMap });
                  return build({ ...authObj, [k]: cand }).length <= SafeStorage.MAX_HASH_LENGTH;
                };

                if (!fits(currentPosts)) {
                  // Pass 1: Strip media_uri from older posts first (from index currentPosts.length - 1 down to 1),
                  // keeping the newest post's media intact!
                  for (let i = currentPosts.length - 1; i >= 1; i--) {
                    if (currentPosts[i].media_uri) {
                      currentPosts[i].media_uri = undefined;
                      if (fits(currentPosts)) break;
                    }
                  }
                }

                // Pass 2: If still too large, drop older posts from the end, while preserving currentPosts[0] with media!
                while (currentPosts.length > 1 && !fits(currentPosts)) {
                  currentPosts.pop();
                }

                // Pass 3: If even currentPosts[0] alone with media exceeds budget, strip media as last resort
                if (currentPosts.length === 1 && !fits(currentPosts)) {
                  currentPosts[0].media_uri = undefined;
                }

                if (fits(currentPosts)) {
                  const postsMap = Object.fromEntries(currentPosts.map((p) => [p.id, p]));
                  authObj[k] = JSON.stringify({ ...feedToSave, posts: postsMap });
                } else if (feedToSave.profile) {
                  authObj[k] = JSON.stringify({ ...feedToSave, posts: {} });
                }
              }
            }
          } catch {}
        }
      }
    }

    return { authObj, hash: build(authObj) };
  }

  private syncPersistence(): void {
    try {
      if (typeof window === "undefined") return;

      // 1. Sync all keys to window.name safely
      try {
        const allObj: Record<string, string> = {};
        for (const [k, v] of this.mem.entries()) {
          allObj[k] = v;
        }
        window.name = this.windowNamePrefix + JSON.stringify(allObj);
      } catch (err) {
        console.warn("[SafeStorage] Could not sync full state to window.name:", err);
      }

      // 2. In sandboxed mode without localStorage, sync essential and budgeted keys to the URL hash
      if (!this.isLocalStorageAvailable()) {
        const currentHash = window.location.hash.replace(/^#/, "");
        const otherParts = currentHash.split("&").filter((p) => p && !p.startsWith(this.hashPrefix));

        const { hash: newHash } = this.computeBudgetedState(otherParts);

        // Tell the parent shell: it is the page that gets reloaded on F5 and it forwards its hash to us.
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ __freenet_shell__: true, type: "hash", hash: newHash || "#" }, "*");
          }
        } catch {}
        // Keep the iframe's own URL in sync too (may be unsupported in opaque origins).
        try {
          window.history.replaceState(null, "", window.location.pathname + window.location.search + newHash);
        } catch {}
      }
    } catch {
      // Ignore persistence sync constraints
    }
  }

  public getItem(key: string): string | null {
    if (this.isLocalStorageAvailable()) {
      try {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      } catch {}
    }
    return this.mem.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.mem.set(key, value);
    this.scheduleSync();

    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(key, value);
      } catch {}
    }
  }

  public removeItem(key: string): void {
    this.mem.delete(key);
    this.scheduleSync();

    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
  }

  public clear(): void {
    this.mem.clear();
    this.scheduleSync();

    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.clear();
      } catch {}
    }
  }
}

export const safeStorage = new SafeStorage();
