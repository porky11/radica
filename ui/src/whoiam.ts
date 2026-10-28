import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// Ensure noble ed25519 uses sha512
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));
ed.etc.sha512Async = (...m) => Promise.resolve(sha512(ed.etc.concatBytes(...m)));

const enc = new TextEncoder();
const hex = (b: Uint8Array) => ed.etc.bytesToHex(b);
const unhex = (h: string) => ed.etc.hexToBytes(h);

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58 (Bitcoin alphabet), the standard way Viso, whoiam and Freenet display public keys. */
export function toBase58(b: Uint8Array): string {
  const d: number[] = [];
  for (const byte of b) {
    let carry = byte;
    for (let i = 0; i < d.length; i++) {
      carry += d[i] << 8;
      d[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      d.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (const byte of b) {
    if (byte) break;
    out += "1";
  }
  return out + d.reverse().map((x) => B58[x]).join("");
}

export const personaName = (pkHex: string): string => {
  try {
    return toBase58(unhex(pkHex));
  } catch {
    return pkHex.slice(0, 8);
  }
};

/** Message signed by Viso/whoiam: "whoiam-connect-v1" || pk || u32le len || base || u32le len || challenge || u64le ts */
export function connectMessage(pk: Uint8Array, base: string, challenge: string, ts: number): Uint8Array {
  const parts = [enc.encode("whoiam-connect-v1"), pk];
  for (const f of [base, challenge]) {
    const b = enc.encode(f);
    parts.push(new Uint8Array(new Uint32Array([b.length]).buffer), b);
  }
  parts.push(new Uint8Array(new BigUint64Array([BigInt(ts)]).buffer));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export interface Proof {
  pk: string;
  sig: string;
  ts: number;
  challenge: string;
  base: string;
}

export interface Cert {
  base: string;
  challenge: string;
  ts: number;
  sig: string;
}

export interface StoredSession {
  persona: string; // 32-byte hex pubkey
  type: "viso" | "local";
  cert?: Cert;
}

/** Verify signature from Viso or delegated key */
export async function verifyProof(l: Proof): Promise<boolean> {
  try {
    const rawPk = unhex(l.pk);
    const rawSig = unhex(l.sig);

    // 1. Try base as given
    const msg1 = connectMessage(rawPk, l.base, l.challenge, l.ts);
    if (await ed.verifyAsync(rawSig, msg1, rawPk)) {
      return true;
    }

    // 2. Try base without trailing slash
    const baseNoSlash = l.base.replace(/\/+$/, "");
    if (baseNoSlash !== l.base) {
      const msg2 = connectMessage(rawPk, baseNoSlash, l.challenge, l.ts);
      if (await ed.verifyAsync(rawSig, msg2, rawPk)) {
        return true;
      }
    }

    // 3. Try base with trailing slash
    const baseWithSlash = l.base.endsWith("/") ? l.base : l.base + "/";
    if (baseWithSlash !== l.base) {
      const msg3 = connectMessage(rawPk, baseWithSlash, l.challenge, l.ts);
      if (await ed.verifyAsync(rawSig, msg3, rawPk)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/** Official Viso web contract on Freenet */
export const VISO_KEY = "GzHy3jnEtj26EoGqMsBpoawcY378hK9kp91rTcNYiAac";
export const WHOIAM_KEY = VISO_KEY;

export const officialViso = (): string => {
  // served by a node (any host or port): stay on it. Only outside a node (e.g. Vite on 5173) assume the default local gateway.
  const onNode = location.port === "7509" || (location.pathname ?? "").includes("/v1/contract/");
  if (location.port && !onNode) {
    return `http://127.0.0.1:7509/v1/contract/web/${VISO_KEY}/`;
  }
  return `${location.protocol}//${location.host}/v1/contract/web/${VISO_KEY}/`;
};

const LINK_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/** Our own base URL without query parameters */
export const linkBase = (): string =>
  `${location.protocol}//${location.host}${location.pathname}`;

/** What Viso is asked to sign: the fixed default node host plus our path. The certificate is published with every
 * record and only its path matters to the contracts, so the user's own node host stays out of it. */
export const canonicalBase = (): string => `http://127.0.0.1:7509${appPath()}`;

/** The path Radica is served at (`/v1/contract/web/<key>/`): Viso delegations and the contracts are bound to it. */
export const appPath = (): string => {
  if (typeof location === "undefined") return "";
  // same app, same contracts: "…/<key>", "…/<key>/" and "…/<key>/index.html" must not become different networks
  const m = /^\/v1\/contract\/web\/[^/]+/.exec(location.pathname);
  return m ? `${m[0]}/` : location.pathname;
};

import { safeStorage } from "./storage.ts";

let appKey: Promise<Uint8Array> | undefined;

/** Persistent app key secret for delegating actions: kept by the node's identity delegate, else in page storage. */
export function getAppKeySecret(): Promise<Uint8Array> {
  return (appKey ??= (async () => {
    let own = safeStorage.getItem("radica_app_key") || safeStorage.getItem("spruce_app_key");
    if (!own || own.length !== 64) own = hex(ed.utils.randomPrivateKey());
    const skHex = (await import("./delegate.ts").then((m) => m.nodeAppKey(own), () => null)) ?? own; // the node's key wins: it survives the Viso redirect
    safeStorage.setItem("radica_app_key", skHex);
    return unhex(skHex);
  })());
}

/** Return the app public key in hex */
export async function getAppKeyPubkey(): Promise<string> {
  const sk = await getAppKeySecret();
  return hex(await ed.getPublicKeyAsync(sk));
}

/** Build Viso sign-in redirect URL */
export async function startSignIn(visoUrl: string): Promise<string> {
  const u = new URL(visoUrl);
  const isAllowedHost =
    u.host === location.host ||
    u.host === "127.0.0.1:7509" ||
    u.host === "localhost:7509" ||
    (location.port && location.port !== "7509");

  if (!isAllowedHost || !/^\/v[12]\/contract\/web\/[^/]+\/?$/.test(u.pathname)) {
    throw new Error(
      "Please enter the address of your Viso site on this node (e.g. http://127.0.0.1:7509/v1/contract/web/GzHy3jnEtj26EoGqMsBpoawcY378hK9kp91rTcNYiAac/)."
    );
  }
  const appKeyHex = await getAppKeyPubkey();
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
  const challenge = `wd1.${appKeyHex}.${nonce}`;

  safeStorage.setItem("radica_signin_pending", challenge);
  safeStorage.setItem("radica_viso_url", u.origin + u.pathname);

  return `${u.origin}${u.pathname}?connect=v1&challenge=${challenge}&return=${encodeURIComponent(linkBase())}&base=${encodeURIComponent(canonicalBase())}`;
}

/** Handle return callback from Viso */
/** Check Viso's answer and keep the session. `replayed`: the URL was the callback of a sign-in already done (a reload). */
export async function finishSignIn(q: URLSearchParams): Promise<{ persona: string; replayed: boolean }> {
  if (q.get("viso") === "denied" || q.get("whoiam") === "denied") {
    throw new Error("You chose not to share a persona in Viso.");
  }
  const pending = safeStorage.getItem("radica_signin_pending") || safeStorage.getItem("spruce_signin_pending");
  safeStorage.removeItem("radica_signin_pending");
  safeStorage.removeItem("spruce_signin_pending");

  const persona = q.get("pk") ?? "";
  const cert: Cert = {
    base: canonicalBase(),
    challenge: q.get("challenge") ?? "",
    ts: Number(q.get("ts")),
    sig: q.get("sig") ?? "",
  };

  // A reload replays the callback URL of a sign-in already done (the shell keeps it): that persona is signed in, no error.
  const done = (raw: string | null) => {
    try {
      const s = JSON.parse(raw ?? "");
      return s?.persona === persona && !!cert.sig && s?.cert?.sig === cert.sig;
    } catch {
      return false;
    }
  };
  if (done(safeStorage.getItem("radica_session"))) return { persona, replayed: true };
  const saved = await import("./delegate.ts").then((m) => m.nodeGet("viso-session"), () => null); // page storage may be reset
  if (done(saved)) {
    safeStorage.setItem("radica_session", saved!);
    return { persona, replayed: true };
  }

  // If pending challenge is present in storage, enforce exact match.
  // In sandboxed opaque iframes where memory is reset upon navigation,
  // authentication relies on the cryptographic Ed25519 signature of the persona and timestamp freshness.
  if (pending && cert.challenge !== pending) {
    throw new Error("This sign-in is unknown or was already used. Please start again from the Identity panel.");
  }
  if (!Number.isFinite(cert.ts) || Math.abs(Date.now() - cert.ts) > LINK_MAX_AGE_MS) {
    throw new Error("The sign-in request expired or system clock is out of sync. Please try again.");
  }
  const delegated = cert.challenge.split(".")[1];
  if (delegated !== (await getAppKeyPubkey())) {
    throw new Error("The app key changed while you were away (storage was reset). Please start the sign-in again.");
  }
  let valid = await verifyProof({ ...cert, pk: persona });
  if (!valid) {
    // a Viso that predates `base` signed our own origin+path: it works, but that cert shows the node host
    cert.base = linkBase();
    valid = await verifyProof({ ...cert, pk: persona });
  }
  if (!valid) {
    throw new Error("Viso persona cryptographic signature failed to verify.");
  }

  const session: StoredSession = { persona, type: "viso", cert };
  safeStorage.setItem("radica_session", JSON.stringify(session));
  void import("./delegate.ts").then((m) => m.nodePut("viso-session", JSON.stringify(session))); // like local-seed: survives cleared page storage (delegate keys take no '_')
  return { persona, replayed: false };
}

/** Create or import an Ed25519 local keypair */
export async function createLocalIdentity(secretHex?: string): Promise<string> {
  const sk = secretHex?.replace(/\s/g, "").toLowerCase() || hex(ed.utils.randomPrivateKey());
  if (!/^[0-9a-f]{64}$/.test(sk)) {
    throw new Error("The private key must be exactly 64 hexadecimal characters.");
  }

  const persona = hex(await ed.getPublicKeyAsync(unhex(sk)));
  const appKeyHex = await getAppKeyPubkey();
  const cert: Cert = {
    base: canonicalBase(),
    challenge: `wd1.${appKeyHex}.${hex(crypto.getRandomValues(new Uint8Array(16)))}`,
    ts: Date.now(),
    sig: "",
  };
  cert.sig = hex(
    await ed.signAsync(
      connectMessage(unhex(persona), cert.base, cert.challenge, cert.ts),
      unhex(sk)
    )
  );

  safeStorage.setItem("radica_ed25519_seed", sk);
  void import("./delegate.ts").then((m) => (m.nodePut("local-seed", sk), m.nodePut("viso-session", ""))); // survives refresh, new tabs and cleared page storage
  const session: StoredSession = { persona, type: "local", cert };
  safeStorage.setItem("radica_session", JSON.stringify(session));
  return persona;
}

/** Get the secret key of the local persona (null if signed in via Viso) */
export function localIdentityKey(): string | null {
  return safeStorage.getItem("radica_ed25519_seed") || safeStorage.getItem("spruce_ed25519_seed") || null;
}

/** Get active session if any */
export function getStoredSession(): StoredSession | null {
  const raw = safeStorage.getItem("radica_session") || safeStorage.getItem("spruce_session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

/** Sign out from current identity */
export function signOut(): void {
  void import("./delegate.ts").then((m) => (m.nodePut("local-seed", ""), m.nodePut("viso-session", "")));
  safeStorage.removeItem("radica_session");
  safeStorage.removeItem("radica_ed25519_seed");
  safeStorage.removeItem("spruce_session");
  safeStorage.removeItem("spruce_ed25519_seed");
}

/** Open external or node-shell page safely */
export const goTo = (href: string) => {
  if (window.parent !== window) {
    parent.postMessage({ __freenet_shell__: true, type: "navigate", href }, "*");
  } else {
    location.href = href;
  }
};
