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
    return await ed.verifyAsync(
      unhex(l.sig),
      connectMessage(unhex(l.pk), l.base, l.challenge, l.ts),
      unhex(l.pk)
    );
  } catch {
    return false;
  }
}

/** Official Viso web contract on Freenet */
export const VISO_KEY = "GzHy3jnEtj26EoGqMsBpoawcY378hK9kp91rTcNYiAac";
export const WHOIAM_KEY = VISO_KEY;

export const officialViso = (): string => {
  // If in development (e.g. Vite on port 5173) or accessed outside standard Freenet gateway 7509,
  // target the Freenet node HTTP gateway directly at 127.0.0.1:7509
  if (location.port && location.port !== "7509") {
    return `http://127.0.0.1:7509/v1/contract/web/${VISO_KEY}/`;
  }
  return `${location.protocol}//${location.host}/v1/contract/web/${VISO_KEY}/`;
};

const LINK_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/** Our own base URL without query parameters */
export const linkBase = (): string =>
  `${location.protocol}//${location.host}${location.pathname}`;

/** Persistent app key secret for delegating actions */
export async function getAppKeySecret(): Promise<Uint8Array> {
  let skHex = localStorage.getItem("spruce_app_key");
  if (!skHex || skHex.length !== 64) {
    const randomKey = ed.utils.randomPrivateKey();
    skHex = hex(randomKey);
    localStorage.setItem("spruce_app_key", skHex);
  }
  return unhex(skHex);
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

  localStorage.setItem("spruce_signin_pending", challenge);
  localStorage.setItem("spruce_viso_url", u.origin + u.pathname);

  return `${u.origin}${u.pathname}?connect=v1&challenge=${challenge}&return=${encodeURIComponent(linkBase())}`;
}

/** Handle return callback from Viso */
export async function finishSignIn(q: URLSearchParams): Promise<string> {
  if (q.get("viso") === "denied" || q.get("whoiam") === "denied") {
    throw new Error("You chose not to share a persona in Viso.");
  }
  const pending = localStorage.getItem("spruce_signin_pending");
  localStorage.removeItem("spruce_signin_pending");

  const persona = q.get("pk") ?? "";
  const cert: Cert = {
    base: linkBase(),
    challenge: q.get("challenge") ?? "",
    ts: Number(q.get("ts")),
    sig: q.get("sig") ?? "",
  };

  if (!pending || cert.challenge !== pending) {
    throw new Error("This sign-in is unknown or was already used. Please start again from the Identity panel.");
  }
  if (!Number.isFinite(cert.ts) || Math.abs(Date.now() - cert.ts) > LINK_MAX_AGE_MS) {
    throw new Error("The sign-in request expired or system clock is out of sync. Please try again.");
  }
  const valid = await verifyProof({ ...cert, pk: persona });
  if (!valid) {
    throw new Error("Viso persona cryptographic signature failed to verify.");
  }

  const session: StoredSession = { persona, type: "viso", cert };
  localStorage.setItem("spruce_session", JSON.stringify(session));
  return persona;
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
    base: linkBase(),
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

  localStorage.setItem("spruce_ed25519_seed", sk);
  const session: StoredSession = { persona, type: "local", cert };
  localStorage.setItem("spruce_session", JSON.stringify(session));
  return persona;
}

/** Get the secret key of the local persona (null if signed in via Viso) */
export function localIdentityKey(): string | null {
  return localStorage.getItem("spruce_ed25519_seed") || null;
}

/** Get active session if any */
export function getStoredSession(): StoredSession | null {
  const raw = localStorage.getItem("spruce_session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

/** Sign out from current identity */
export function signOut(): void {
  localStorage.removeItem("spruce_session");
  localStorage.removeItem("spruce_ed25519_seed");
}

/** Open external or node-shell page safely */
export const goTo = (href: string) => {
  if (window.parent !== window) {
    parent.postMessage({ __freenet_shell__: true, type: "navigate", href }, "*");
  } else {
    location.href = href;
  }
};
