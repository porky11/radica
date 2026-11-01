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

