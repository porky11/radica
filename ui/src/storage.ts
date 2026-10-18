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
// 3. Syncs essential auth keys into the URL hash fragment (#auth=...) so state survives full iframe reloads.
// 4. Maintains an in-memory Map fallback that never throws under any condition.

class SafeStorage {
  private mem = new Map<string, string>();
  private localStorageAvailable: boolean | null = null;
  private windowNamePrefix = "__radica_store__:";
  private hashPrefix = "auth_state=";

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

      // 2. In sandboxed mode without localStorage, sync essential auth keys to URL hash
      if (!this.isLocalStorageAvailable()) {
        const authObj: Record<string, string> = {};
        for (const [k, v] of this.mem.entries()) {
          if (
            k.startsWith("radica_session") ||
            k.startsWith("radica_app_key") ||
            k.startsWith("radica_ed25519_seed") ||
            k.startsWith("radica_signin_pending") ||
            k.startsWith("freenet_feed_") ||
            k.startsWith("radica_profile_")
          ) {
            authObj[k] = v;
          }
        }

        if (Object.keys(authObj).length > 0) {
          const b64 = btoa(encodeURIComponent(JSON.stringify(authObj)));
          const currentHash = window.location.hash.replace(/^#/, "");
          const cleanHashParts = currentHash
            .split("&")
            .filter((p) => p && !p.startsWith(this.hashPrefix));
          cleanHashParts.push(this.hashPrefix + b64);
          const newHash = "#" + cleanHashParts.join("&");
          window.history.replaceState(null, "", window.location.pathname + window.location.search + newHash);
        }
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
