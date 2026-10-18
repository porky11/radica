import * as ed from "@noble/ed25519";
import { ed25519 as curveEd25519, x25519 } from "@noble/curves/ed25519.js";
import { sha512 } from "@noble/hashes/sha2.js";
import type { UserIdentity } from "./types.ts";

// Configure noble/ed25519 to use sha512
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));
ed.etc.sha512Async = (...m) => Promise.resolve(sha512(ed.etc.concatBytes(...m)));

import {
  getStoredSession,
  getAppKeySecret,
  createLocalIdentity,
  personaName,
  toBase58,
} from "./whoiam.ts";

export { personaName, toBase58 };

const enc = new TextEncoder();
const STORAGE_KEY = "spruce_ed25519_seed";

export async function getOrCreateIdentity(): Promise<UserIdentity> {
  const session = getStoredSession();

  if (session && session.type === "viso") {
    const appSk = await getAppKeySecret();
    return {
      pubkey: session.persona,
      secretKey: appSk,
      type: "viso",
      personaName: personaName(session.persona),
      sign: async (msg: string) => {
        const msgBytes = enc.encode(msg);
        const sig = await ed.signAsync(msgBytes, appSk);
        return ed.etc.bytesToHex(sig);
      },
    };
  }

  let hexSeed = localStorage.getItem(STORAGE_KEY);
  if (!hexSeed || hexSeed.length !== 64) {
    // Generate new local identity using standard whoiam format
    const personaHex = await createLocalIdentity();
    hexSeed = localStorage.getItem(STORAGE_KEY)!;
    const secretKey = ed.etc.hexToBytes(hexSeed);
    return {
      pubkey: personaHex,
      secretKey,
      type: "local",
      personaName: personaName(personaHex),
      sign: async (msg: string) => {
        const msgBytes = enc.encode(msg);
        const sig = await ed.signAsync(msgBytes, secretKey);
        return ed.etc.bytesToHex(sig);
      },
    };
  }

  const secretKey = ed.etc.hexToBytes(hexSeed);
  const pubkeyBytes = await ed.getPublicKeyAsync(secretKey);
  const pubkey = ed.etc.bytesToHex(pubkeyBytes);

  return {
    pubkey,
    secretKey,
    type: "local",
    personaName: personaName(pubkey),
    sign: async (msg: string) => {
      const msgBytes = enc.encode(msg);
      const sig = await ed.signAsync(msgBytes, secretKey);
      return ed.etc.bytesToHex(sig);
    },
  };
}

export function formatPostSignatureMessage(
  id: string,
  author: string,
  category: string,
  caption: string,
  media_uri: string | undefined,
  timestamp: number
): string {
  return `${id}:${author}:${category}:${caption}:${media_uri || ""}:${timestamp}`;
}

export function formatCommentSignatureMessage(
  id: string,
  post_id: string,
  author: string,
  text: string,
  timestamp: number
): string {
  return `${id}:${post_id}:${author}:${text}:${timestamp}`;
}

export function formatProfileSignatureMessage(
  displayName: string,
  bio: string,
  avatarUrl: string,
  updatedAt: number
): string {
  return `${displayName}:${bio}:${avatarUrl}:${updatedAt}`;
}

export function formatChatMessageSignatureMessage(
  id: string,
  roomId: string,
  sender: string,
  recipient: string = "community",
  text: string,
  timestamp: number
): string {
  return `${id}:${roomId}:${sender}:${recipient || "community"}:${text}:${timestamp}`;
}

export function formatCommunitySignatureMessage(
  id: string,
  slug: string,
  name: string,
  creator: string,
  createdAt: number
): string {
  return `${id}:${slug}:${name}:${creator}:${createdAt}`;
}

export function formatModActionSignatureMessage(
  communityId: string,
  action: "add_mod" | "remove_mod" | "delete_post",
  target: string,
  by: string,
  timestamp: number
): string {
  return `${communityId}:${action}:${target}:${by}:${timestamp}`;
}

// -------------------------------------------------------------
// 1-on-1 End-to-End Encryption (E2EE) via X25519 ECDH + AES-GCM
// -------------------------------------------------------------

const sharedKeyCache: Map<string, CryptoKey> = new Map();

export async function getSharedKey(mySecretKey: Uint8Array, peerPubkeyHex: string): Promise<CryptoKey> {
  const cacheKey = `${ed.etc.bytesToHex(mySecretKey.slice(0, 8))}_${peerPubkeyHex}`;
  const existing = sharedKeyCache.get(cacheKey);
  if (existing) return existing;

  // Convert Ed25519 secret and pubkey to Montgomery X25519 points
  const mySecX = curveEd25519.utils.toMontgomerySecret(mySecretKey);
  const peerPubBytes = ed.etc.hexToBytes(peerPubkeyHex);
  const peerPubX = curveEd25519.utils.toMontgomery(peerPubBytes);
  const sharedBytes = x25519.getSharedSecret(mySecX, peerPubX);

  const key = await crypto.subtle.importKey(
    "raw",
    sharedBytes as any,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  sharedKeyCache.set(cacheKey, key);
  return key;
}

export async function encryptDirectMessage(
  mySecretKey: Uint8Array,
  peerPubkeyHex: string,
  plaintext: string
): Promise<string> {
  try {
    const key = await getSharedKey(mySecretKey, peerPubkeyHex);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = enc.encode(plaintext);
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as any },
      key,
      encoded as any
    );
    const ivHex = ed.etc.bytesToHex(iv);
    const cipherHex = ed.etc.bytesToHex(new Uint8Array(ciphertextBuffer));
    return `e2e:${ivHex}:${cipherHex}`;
  } catch (err) {
    console.error("Encryption failed, falling back to plaintext:", err);
    return plaintext;
  }
}

export async function decryptDirectMessage(
  mySecretKey: Uint8Array,
  peerPubkeyHex: string,
  messageText: string
): Promise<string> {
  if (!messageText || !messageText.startsWith("e2e:")) {
    return messageText;
  }
  try {
    const parts = messageText.split(":");
    if (parts.length !== 3) return messageText;
    const [, ivHex, cipherHex] = parts;
    const iv = ed.etc.hexToBytes(ivHex);
    const ciphertext = ed.etc.hexToBytes(cipherHex);
    const key = await getSharedKey(mySecretKey, peerPubkeyHex);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as any },
      key,
      ciphertext as any
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.warn("Decryption failed for direct message:", err);
    return "[Encrypted message - unable to decrypt]";
  }
}
