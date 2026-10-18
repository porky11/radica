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

class SafeStorage {
  private mem = new Map<string, string>();
  private localStorageAvailable: boolean | null = null;
  private windowNamePrefix = "__radica_store__:";
  private hashPrefix = "auth_state=";
  private static readonly MAX_HASH_LENGTH = 7500;

  constructor() {
    this.hydrateFromWindowName();
    this.hydrateFromHash();
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

  private hydrateFromHash(): void {
    try {
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.replace(/^#/, "");
        const parts = hash.split("&");
        for (const part of parts) {
          if (part.startsWith(this.hashPrefix)) {
            const rawB64 = part.slice(this.hashPrefix.length);
            const json = decodeURIComponent(atob(rawB64));
            const parsed = JSON.parse(json);
            if (parsed && typeof parsed === "object") {
              for (const [k, v] of Object.entries(parsed)) {
                if (typeof v === "string" && !this.mem.has(k)) {
                  this.mem.set(k, v);
                }
              }
            }
          }
        }
      }
    } catch {
      // Ignore hash parsing errors
    }
  }

  private syncPersistence(): void {
    try {
      if (typeof window === "undefined") return;

      // 1. Sync all keys to window.name
      const allObj: Record<string, string> = {};
      for (const [k, v] of this.mem.entries()) {
        allObj[k] = v;
      }
      window.name = this.windowNamePrefix + JSON.stringify(allObj);

      // 2. In sandboxed mode without localStorage, sync essential keys to the URL hash
      if (!this.isLocalStorageAvailable()) {
        const essentialPrefixes = [
          "radica_session",
          "radica_app_key",
          "radica_ed25519_seed",
          "radica_signin_pending",
          "radica_profile_",
          "freenet_private_rooms",
          "freenet_chat_peers_",
        ];
        // Larger, rebuildable data: only included while the hash stays under budget.
        const optionalPrefixes = ["freenet_chat_", "freenet_feed_"];

        const currentHash = window.location.hash.replace(/^#/, "");
        const otherParts = currentHash.split("&").filter((p) => p && !p.startsWith(this.hashPrefix));

        const build = (obj: Record<string, string>): string => {
          const parts = [...otherParts];
          if (Object.keys(obj).length > 0) {
            parts.push(this.hashPrefix + btoa(encodeURIComponent(JSON.stringify(obj))));
          }
          return parts.length > 0 ? "#" + parts.join("&") : "";
        };

        const authObj: Record<string, string> = {};
        for (const [k, v] of this.mem.entries()) {
          if (essentialPrefixes.some((p) => k.startsWith(p))) authObj[k] = v;
        }
        for (const [k, v] of this.mem.entries()) {
          if (optionalPrefixes.some((p) => k.startsWith(p))) {
            if (build({ ...authObj, [k]: v }).length <= SafeStorage.MAX_HASH_LENGTH) authObj[k] = v;
          }
        }

        const newHash = build(authObj);

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
    this.syncPersistence();

    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(key, value);
      } catch {}
    }
  }

  public removeItem(key: string): void {
    this.mem.delete(key);
    this.syncPersistence();

    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
  }

  public clear(): void {
    this.mem.clear();
    this.syncPersistence();

    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.clear();
      } catch {}
    }
  }
}

export const safeStorage = new SafeStorage();
