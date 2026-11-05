import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const enc = new TextEncoder();

/** Default difficulty: 16 leading zero bits (~65,536 hash operations, ~50-150ms on modern CPUs). */
export const DEFAULT_TIER0_DIFFICULTY = 16;

export interface PoWProof {
  challenge: string;
  nonce: number;
  hash: string;
  difficulty: number;
}

/** Builds the canonical challenge string for a post or action. */
export function createPoWChallenge(author: string, timestamp: number, category = "post"): string {
  return `radica:pow:v1:${category}:${author}:${timestamp}`;
}

/** Counts leading zero bits in a hash byte array. */
export function countLeadingZeroBits(bytes: Uint8Array): number {
  let zeros = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0) {
      zeros += 8;
    } else {
      zeros += Math.clz32(b) - 24;
      break;
    }
  }
  return zeros;
}

// Self-contained SHA-256 PoW worker loaded via blob: URL so 18-20 bit grinding runs off the main thread
// even inside Freenet's opaque-origin (null) sandboxed iframe.
const POW_WORKER_SRC = `
const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
const W = new Uint32Array(64);
const block = new Uint8Array(128);
const dv = new DataView(block.buffer);
const enc = new TextEncoder();

function checkSha256(len, difficulty) {
  const bitLen = len * 8;
  const total = ((len + 9 + 63) & ~63);
  block.fill(0, len, total);
  block[len] = 0x80;
  dv.setUint32(total - 4, bitLen >>> 0, false);
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const x = W[i - 15], y = W[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0; h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
  }
  const z0 = Math.clz32(h0);
  const zeros = z0 < 32 ? z0 : 32 + Math.clz32(h1);
  if (zeros < difficulty) return null;
  return [h0,h1,h2,h3,h4,h5,h6,h7].map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
}

self.onmessage = (e) => {
  const { id, challenge, difficulty } = e.data;
  const prefix = enc.encode(challenge + ":");
  block.set(prefix, 0);
  const base = prefix.length;
  let nonce = 0;
  while (true) {
    for (let i = 0; i < 32768; i++) {
      const s = String(nonce);
      const nLen = s.length;
      for (let j = 0; j < nLen; j++) block[base + j] = s.charCodeAt(j);
      const hash = checkSha256(base + nLen, difficulty);
      if (hash !== null) {
        self.postMessage({ id, done: true, nonce, hash });
        return;
      }
      nonce++;
    }
    self.postMessage({ id, done: false, attempts: nonce });
  }
};
`;

let powWorker: Worker | undefined;
let powWorkerUrl: string | undefined;
let powBroken = false;
let powSeq = 0;
const powWaiting = new Map<
  number,
  {
    onProgress?: (n: number) => void;
    resolve: (r: { nonce: number; hash: string }) => void;
    reject: (e: unknown) => void;
  }
>();

function failPowWorker(err: unknown) {
  powBroken = true;
  powWorker?.terminate();
  powWorker = undefined;
  if (powWorkerUrl) {
    URL.revokeObjectURL(powWorkerUrl);
    powWorkerUrl = undefined;
  }
  for (const w of powWaiting.values()) w.reject(err);
  powWaiting.clear();
}

async function solvePoWInline(
  challenge: string,
  difficulty: number,
  onProgress?: (attempts: number) => void
): Promise<PoWProof> {
  const prefix = enc.encode(`${challenge}:`);
  const buf = new Uint8Array(prefix.length + 20);
  buf.set(prefix, 0);
  const base = prefix.length;
  let nonce = 0;
  const BATCH_SIZE = 8192;

  while (true) {
    for (let i = 0; i < BATCH_SIZE; i++) {
      const s = String(nonce);
      const nLen = s.length;
      for (let j = 0; j < nLen; j++) buf[base + j] = s.charCodeAt(j);
      const h = sha256(buf.subarray(0, base + nLen));
      if (countLeadingZeroBits(h) >= difficulty) {
        return {
          challenge,
          nonce,
          hash: bytesToHex(h),
          difficulty,
        };
      }
      nonce++;
    }
    onProgress?.(nonce);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Solves a PoW challenge for an author and timestamp.
 * Runs inside a Blob Web Worker when available so UI and pointer events never stall; falls back to chunked inline hashing.
 */
export async function solvePoW(
  author: string,
  timestamp: number,
  difficulty = DEFAULT_TIER0_DIFFICULTY,
  category = "post",
  onProgress?: (attempts: number) => void
): Promise<PoWProof> {
  const challenge = createPoWChallenge(author, timestamp, category);
  if (!powBroken && typeof Worker !== "undefined" && challenge.length < 105) {
    try {
      if (!powWorker) {
        powWorkerUrl = URL.createObjectURL(new Blob([POW_WORKER_SRC], { type: "text/javascript" }));
        powWorker = Object.assign(new Worker(powWorkerUrl), {
          onmessage: (e: MessageEvent<{ id: number; done: boolean; nonce?: number; hash?: string; attempts?: number }>) => {
            const w = powWaiting.get(e.data.id);
            if (!w) return;
            if (e.data.done) {
              powWaiting.delete(e.data.id);
              w.resolve({ nonce: e.data.nonce!, hash: e.data.hash! });
            } else if (e.data.attempts !== undefined) {
              w.onProgress?.(e.data.attempts);
            }
          },
          onerror: (err: ErrorEvent) => failPowWorker(err),
          onmessageerror: (err: MessageEvent) => failPowWorker(err),
        });
      }
      const res = await new Promise<{ nonce: number; hash: string }>((resolve, reject) => {
        const id = ++powSeq;
        powWaiting.set(id, { onProgress, resolve, reject });
        powWorker!.postMessage({ id, challenge, difficulty });
      });
      const proof: PoWProof = { challenge, nonce: res.nonce, hash: res.hash, difficulty };
      if (verifyPoW(proof, author, timestamp, difficulty, category)) return proof;
    } catch {
      powBroken = true;
    }
  }
  return solvePoWInline(challenge, difficulty, onProgress);
}

/** Anti-bot cost of a post by someone not trusted by everyone: ~260k hashes, a second or two in a browser. */
export const POST_POW_BITS = 18;
/** Comments cost less: a fraction of a second, done in the background after the comment shows. */
export const COMMENT_POW_BITS = 16;
const ID_PREFIX = { post: "post", comment: "comm" } as const;
export type PowKind = keyof typeof ID_PREFIX;
/** What announcing myself in the public directory costs: ~1M hashes, about 5 s in a browser, once a session. Readers weigh a
 *  newcomer's chance of a place in their Explore by the work this took (see logfold.ts directoryWeights). */
export const ANNOUNCE_POW_BITS = 20;

const powBitsCache = new Map<string, number>();

/** Leading zero bits of the proof `nonce` for `author` at `timestamp` (0 for a nonce that is not a number). */
export function powBits(author: string, timestamp: number, nonce: number, kind: string): number {
  if (!Number.isSafeInteger(nonce) || nonce < 0 || !Number.isFinite(timestamp)) return 0;
  const key = `${kind}:${author}:${timestamp}:${nonce}`;
  const hit = powBitsCache.get(key);
  if (hit !== undefined) return hit;
  const bits = countLeadingZeroBits(sha256(enc.encode(`${createPoWChallenge(author, timestamp, kind)}:${nonce}`)));
  if (powBitsCache.size >= 4096) powBitsCache.clear();
  powBitsCache.set(key, bits);
  return bits;
}

/** Posts from before this lack the proof (older clients): readers leave them alone. */
export const POST_POW_SINCE = Date.UTC(2026, 10, 7);

/** A post id carrying its proof of work: the feed contract keeps the id and the author's signature covers it,
 *  while a separate `pow` field would be dropped by the contract. */
export function postIdWithPow(timestamp: number, proof?: PoWProof, kind: PowKind = "post"): string {
  // nothing free in the id: one proof cannot be reused for many posts by varying a random part
  const p = ID_PREFIX[kind];
  return proof ? `${p}_${timestamp}_p${proof.nonce}` : `${p}_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;
}

const POW_ID_RE: Record<PowKind, RegExp> = {
  post: /^post_(\d+)_p(\d{1,15})$/,
  comment: /^comm_(\d+)_p(\d{1,15})$/,
};
const postPowCache = new Map<string, boolean>();

/** Whether a post pays its proof of work (one hash): the nonce in its id, against its author and timestamp. */
export function postHasPow(post: { id: string; author: string; timestamp: number }, bits = POST_POW_BITS, kind: PowKind = "post"): boolean {
  const key = `${kind}:${bits}:${post.author}:${post.timestamp}:${post.id}`;
  const hit = postPowCache.get(key);
  if (hit !== undefined) return hit;
  const m = POW_ID_RE[kind].exec(post.id);
  const ok = !!m && Number(m[1]) === post.timestamp && countLeadingZeroBits(sha256(enc.encode(`${createPoWChallenge(post.author, post.timestamp, kind)}:${m[2]}`))) >= bits;
  if (postPowCache.size >= 4096) postPowCache.clear();
  postPowCache.set(key, ok);
  return ok;
}

/**
 * Synchronous verification of a PoW proof (instantaneous single hash).
 */
export function verifyPoW(
  proof: PoWProof | null | undefined,
  expectedAuthor: string,
  expectedTimestamp: number,
  minDifficulty = DEFAULT_TIER0_DIFFICULTY,
  category = "post"
): boolean {
  if (!proof || typeof proof.nonce !== "number" || typeof proof.hash !== "string") {
    return false;
  }

  const expectedChallenge = createPoWChallenge(expectedAuthor, expectedTimestamp, category);
  if (proof.challenge !== expectedChallenge) {
    return false;
  }

  if (proof.difficulty < minDifficulty) {
    return false;
  }

  const calculatedHash = sha256(enc.encode(`${expectedChallenge}:${proof.nonce}`));
  const calculatedHex = bytesToHex(calculatedHash);

  if (calculatedHex !== proof.hash) {
    return false;
  }

  return countLeadingZeroBits(calculatedHash) >= proof.difficulty;
}
