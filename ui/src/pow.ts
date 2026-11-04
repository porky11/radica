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

/**
 * Solves a PoW challenge for an author and timestamp.
 * Periodically yields to keep the UI responsive.
 */
export async function solvePoW(
  author: string,
  timestamp: number,
  difficulty = DEFAULT_TIER0_DIFFICULTY,
  category = "post",
  onProgress?: (attempts: number) => void
): Promise<PoWProof> {
  const challenge = createPoWChallenge(author, timestamp, category);
  let nonce = 0;
  const BATCH_SIZE = 8192;

  while (true) {
    for (let i = 0; i < BATCH_SIZE; i++) {
      const data = enc.encode(`${challenge}:${nonce}`);
      const h = sha256(data);
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
    // Yield to the event loop so the UI remains interactive
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
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

/** Leading zero bits of the proof `nonce` for `author` at `timestamp` (0 for a nonce that is not a number). */
export function powBits(author: string, timestamp: number, nonce: number, kind: string): number {
  if (!Number.isSafeInteger(nonce) || nonce < 0 || !Number.isFinite(timestamp)) return 0;
  return countLeadingZeroBits(sha256(enc.encode(`${createPoWChallenge(author, timestamp, kind)}:${nonce}`)));
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

/** Whether a post pays its proof of work (one hash): the nonce in its id, against its author and timestamp. */
export function postHasPow(post: { id: string; author: string; timestamp: number }, bits = POST_POW_BITS, kind: PowKind = "post"): boolean {
  const m = new RegExp(`^${ID_PREFIX[kind]}_(\\d+)_p(\\d{1,15})$`).exec(post.id);
  if (!m || Number(m[1]) !== post.timestamp) return false;
  const h = sha256(enc.encode(`${createPoWChallenge(post.author, post.timestamp, kind)}:${m[2]}`));
  return countLeadingZeroBits(h) >= bits;
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

