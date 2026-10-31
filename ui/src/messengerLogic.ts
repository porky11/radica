import { sha256 } from "@noble/hashes/sha2.js";

export interface PreviewItem {
  text: string;
  sender: string;
  timestamp: number;
  optimistic?: boolean;
}

const enc = new TextEncoder();

/** Closed-room preview hydration must skip community rooms, the currently open room, and unchanged stamps. */
export function shouldHydratePreview(opts: {
  type: "dm" | "priv" | "comm";
  roomId: string;
  openRoomId: string | null;
  stamp: number;
  lastHydratedStamp: number | undefined;
}): boolean {
  if (opts.type === "comm") return false;
  if (opts.openRoomId && opts.roomId === opts.openRoomId) return false;
  if (!opts.stamp || opts.lastHydratedStamp === opts.stamp) return false;
  return true;
}

/** Never overwrite a newer or pending optimistic preview with an older stored message. */
export function shouldUpdateCachedPreview(prev: PreviewItem | undefined, next: PreviewItem): boolean {
  if (!prev) return true;
  if (next.timestamp > prev.timestamp) return true;
  if (next.timestamp < prev.timestamp) return false;
  if (prev.optimistic && !next.optimistic) return true;
  if (!prev.optimistic && next.optimistic) return false;
  return prev.text !== next.text;
}

/** Deterministic SHA-256 Signal-style 60-digit safety number (12 blocks of 5 digits) over sorted Ed25519/room keys. */
export function computeSafetyBlocks(myPubkey: string, targetMaterial: string): string[] {
  const canonical = [myPubkey.toLowerCase(), targetMaterial.toLowerCase()].sort().join(":");
  const d1 = sha256(enc.encode(`radica-e2ee-v1:a:${canonical}`));
  const d2 = sha256(enc.encode(`radica-e2ee-v1:b:${canonical}`));
  const buf = new Uint8Array(64);
  buf.set(d1, 0);
  buf.set(d2, 32);
  const blocks: string[] = [];
  for (let i = 0; i < 12; i++) {
    const off = i * 5;
    const val =
      ((buf[off] * 0x100000000 +
        ((buf[off + 1] << 24) >>> 0) +
        (buf[off + 2] << 16) +
        (buf[off + 3] << 8) +
        buf[off + 4]) >>>
        0) %
      100000;
    blocks.push(String(val).padStart(5, "0"));
  }
  return blocks;
}

