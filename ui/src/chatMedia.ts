// End-to-end encrypted images, voice notes, and audio attachments for Radica chat.
// Every attachment is sealed on-device with a fresh random 256-bit AES-GCM key before publishing to Freenet's
// content-addressed `media-contract` (up to 768 KB). The random key travels only inside the chat message itself,
// so Freenet nodes hold opaque ciphertext and deleting the message crypto-shreds the attachment key.

import { bytesToHex, hexToBytes } from "./crypto.ts";
import { mediaHashOf } from "./media.ts";
import { compressPostImageFile } from "./avatar.ts";

/** Hard cap enforced by media-contract/src/lib.rs (`MAX_MEDIA = 768 * 1024`). */
export const MAX_CHAT_MEDIA_SEALED = 768 * 1024;
/** 12-byte AES-GCM IV + 16-byte authentication tag = 28 bytes overhead. */
export const MAX_CHAT_MEDIA_PLAIN = MAX_CHAT_MEDIA_SEALED - 28;

/** Bigger files are split into sealed chunks (one media contract each) plus a sealed manifest listing them. */
export const MAX_CHAT_FILE_BYTES = 25 * 1024 * 1024;
const CHUNK_MANIFEST_MAGIC = "radica-chunks1\n";

export const WAVEFORM_BARS = 28;

export type ChatMediaKind = "img" | "voice" | "audio" | "file";

export interface ChatMediaItem {
  raw: string;
  kind: ChatMediaKind;
  mime: string;
  hash: string; // 64-char hex BLAKE3 of sealed payload
  keyHex: string; // 64-char hex 256-bit AES-GCM key
  width?: number;
  height?: number;
  durationSec?: number;
  waveform?: number[]; // 0..15 integer bar heights
  sizeBytes?: number;
  filename?: string;
}

export interface PreparedChatMedia {
  kind: ChatMediaKind;
  bytes: Uint8Array;
  mime: string;
  label: string;
  previewUrl: string;
  width?: number;
  height?: number;
  durationSec?: number;
  waveform?: number[];
  sizeBytes?: number;
  filename?: string;
}

export const SAFE_IMAGE_MIMES = new Set([
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/gif",
]);

export const SAFE_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/aac",
]);

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Normalize browser/OS audio MIME strings to our strict safe allowlist. */
export function normalizeAudioMime(rawMime: string, filename = ""): string | null {
  const base = (rawMime || "").split(";")[0].trim().toLowerCase();
  if (SAFE_AUDIO_MIMES.has(base)) return base;
  if (base === "audio/mp3" || base === "audio/mpeg3" || base === "audio/x-mpeg-3") return "audio/mpeg";
  if (base === "audio/x-m4a" || base === "audio/m4a" || base === "video/mp4") return "audio/mp4";
  if (base === "audio/x-wav" || base === "audio/wave") return "audio/wav";
  if (base === "audio/x-aac") return "audio/aac";
  if (base === "audio/opus") return "audio/ogg";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "ogg" || ext === "oga" || ext === "opus") return "audio/ogg";
  if (ext === "m4a" || ext === "mp4") return "audio/mp4";
  if (ext === "webm") return "audio/webm";
  if (ext === "wav") return "audio/wav";
  if (ext === "aac") return "audio/aac";
  return null;
}

export function formatMediaDuration(sec?: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(sec) ? (sec as number) : 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileExtensionIcon(filename = ""): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return "📕";
  if (["zip", "tar", "gz", "7z", "rar", "bz2", "xz"].includes(ext)) return "📦";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "📝";
  if (["xls", "xlsx", "ods", "csv"].includes(ext)) return "📊";
  if (["ppt", "pptx", "odp"].includes(ext)) return "📈";
  if (["txt", "md", "json", "xml", "yaml", "yml"].includes(ext)) return "📄";
  if (["mp3", "ogg", "wav", "flac", "aac", "m4a"].includes(ext)) return "🎵";
  if (["mp4", "webm", "mkv", "avi", "mov"].includes(ext)) return "🎬";
  return "📎";
}

export function defaultWaveform(seedHex: string, bars = WAVEFORM_BARS): number[] {
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const code = seedHex.charCodeAt(i % Math.max(1, seedHex.length)) || 7;
    const v = 3 + ((code * (i + 5) * 13) % 11);
    out.push(Math.max(2, Math.min(15, v)));
  }
  return out;
}

function encodeWaveformHex(wf?: number[]): string {
  if (!wf || !wf.length) return "";
  return wf
    .slice(0, 32)
    .map((v) => Math.max(0, Math.min(15, Math.round(v))).toString(16))
    .join("");
}

function decodeWaveformHex(hex?: string): number[] | undefined {
  if (!hex || !/^[0-9a-f]{1,32}$/i.test(hex)) return undefined;
  return Array.from(hex.toLowerCase(), (c) => parseInt(c, 16));
}

// Token syntax:
//   [radica-cm1:img:<mime>:<hash64>:<key64>:<w>x<h>]
//   [radica-cm1:<voice|audio>:<mime>:<hash64>:<key64>:<durSec>(:<wfHex>)?]
//   [radica-cm1:file:<mime>:<hash64>:<key64>:<sizeBytes>:<filenameHex>]
const TOKEN_RE = /\[radica-cm1:(img|voice|audio|file):([a-z0-9/+.-]+):([0-9a-f]{64}):([0-9a-f]{64}):([0-9a-z.]+)(?::([0-9a-f]+))?\]/gi;

export function encodeChatMediaToken(item: Omit<ChatMediaItem, "raw">): string {
  const hash = item.hash.toLowerCase();
  const keyHex = item.keyHex.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash) || !/^[0-9a-f]{64}$/.test(keyHex)) {
    throw new Error("Invalid media hash or encryption key");
  }
  if (item.kind === "img") {
    if (!SAFE_IMAGE_MIMES.has(item.mime)) throw new Error(`Unsupported image MIME: ${item.mime}`);
    const w = Math.max(0, Math.min(9999, Math.round(item.width ?? 0)));
    const h = Math.max(0, Math.min(9999, Math.round(item.height ?? 0)));
    return `[radica-cm1:img:${item.mime}:${hash}:${keyHex}:${w}x${h}]`;
  }
  if (item.kind === "file") {
    const size = Math.max(0, Math.round(item.sizeBytes ?? 0));
    const safeName = (item.filename || "file").slice(0, 120);
    const nameHex = bytesToHex(new TextEncoder().encode(safeName));
    const safeMime = item.mime && /^[a-z0-9/+.-]+$/i.test(item.mime) ? item.mime.toLowerCase() : "application/octet-stream";
    return `[radica-cm1:file:${safeMime}:${hash}:${keyHex}:${size}:${nameHex}]`;
  }
  if (!SAFE_AUDIO_MIMES.has(item.mime)) throw new Error(`Unsupported audio MIME: ${item.mime}`);
  const dur = Math.max(0, Math.min(3600, Math.round((item.durationSec ?? 0) * 10) / 10));
  const wf = encodeWaveformHex(item.waveform);
  return `[radica-cm1:${item.kind}:${item.mime}:${hash}:${keyHex}:${dur}${wf ? `:${wf}` : ""}]`;
}

function parseMatchedToken(m: RegExpExecArray): ChatMediaItem | null {
  const raw = m[0];
  const kind = m[1].toLowerCase() as ChatMediaKind;
  const mime = m[2].toLowerCase();
  const hash = m[3].toLowerCase();
  const keyHex = m[4].toLowerCase();
  const meta1 = m[5].toLowerCase();
  const meta2 = m[6];

  if (kind === "img") {
    if (!SAFE_IMAGE_MIMES.has(mime)) return null;
    const dim = /^(\d{1,4})x(\d{1,4})$/.exec(meta1);
    const width = dim ? Number(dim[1]) : 0;
    const height = dim ? Number(dim[2]) : 0;
    return {
      raw,
      kind,
      mime,
      hash,
      keyHex,
      ...(width > 0 && height > 0 ? { width, height } : {}),
    };
  }

  if (kind === "file") {
    const sizeBytes = Number(meta1);
    let filename = "file";
    if (meta2 && /^[0-9a-f]+$/i.test(meta2)) {
      try {
        filename = new TextDecoder().decode(hexToBytes(meta2));
      } catch {}
    }
    return {
      raw,
      kind,
      mime: mime || "application/octet-stream",
      hash,
      keyHex,
      sizeBytes: Number.isFinite(sizeBytes) && sizeBytes >= 0 ? sizeBytes : undefined,
      filename,
    };
  }

  if (!SAFE_AUDIO_MIMES.has(mime)) return null;
  const dur = Number(meta1);
  if (!Number.isFinite(dur) || dur < 0 || dur > 3600) return null;
  const waveform = decodeWaveformHex(meta2);
  return {
    raw,
    kind,
    mime,
    hash,
    keyHex,
    durationSec: dur,
    ...(waveform ? { waveform } : {}),
  };
}

/** Extract all valid media attachments from a chat message and return the clean remaining caption text. */
export function parseChatMedia(text: string): { items: ChatMediaItem[]; caption: string } {
  if (!text || !text.includes("[radica-cm1:")) return { items: [], caption: text || "" };
  const items: ChatMediaItem[] = [];
  let out = "";
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const parsed = parseMatchedToken(m);
    if (!parsed) continue;
    out += text.slice(last, m.index);
    items.push(parsed);
    last = m.index + m[0].length;
  }
  if (!items.length) return { items: [], caption: text };
  out += text.slice(last);
  const caption = out.replace(/^\n+|\n+$/g, "").trim();
  return { items, caption };
}

/** Mask attachment tokens before PII/profanity regex passes so hex/digits inside tokens are never altered. */
export function maskChatMediaTokens(text: string): { masked: string; restore: (s: string) => string } {
  if (!text.includes("[radica-cm1:")) return { masked: text, restore: (s) => s };
  const saved: string[] = [];
  TOKEN_RE.lastIndex = 0;
  const masked = text.replace(TOKEN_RE, (full) => `\uE020${saved.push(full) - 1}\uE021`);
  return {
    masked,
    restore: (s: string) => (saved.length ? s.replace(/\uE020(\d+)\uE021/g, (_, i) => saved[Number(i)] ?? "") : s),
  };
}

/** Human-friendly single-line summary for Inbox previews, Reply banners, Quote boxes, and Search. */
export function summarizeChatMediaText(text: string, formatPlain?: (t: string) => string): string {
  const { items, caption } = parseChatMedia(text);
  const cleanCaption = (formatPlain ? formatPlain(caption) : caption).replace(/\s+/g, " ").trim();
  if (!items.length) return cleanCaption;

  const first = items[0];
  let badge = "📷 Photo";
  if (first.kind === "voice") {
    badge = `🎙️ Voice message (${formatMediaDuration(first.durationSec)})`;
  } else if (first.kind === "audio") {
    badge = `🎵 Audio (${formatMediaDuration(first.durationSec)})`;
  } else if (first.kind === "file") {
    const sz = first.sizeBytes ? ` (${formatBytes(first.sizeBytes)})` : "";
    badge = `📄 ${first.filename || "File"}${sz}`;
  }
  if (items.length > 1) badge += ` +${items.length - 1}`;
  if (!cleanCaption) return badge;
  const shortPrefix =
    first.kind === "img"
      ? "📷"
      : first.kind === "voice"
      ? `🎙️ (${formatMediaDuration(first.durationSec)})`
      : first.kind === "audio"
      ? "🎵"
      : "📄";
  return `${shortPrefix} ${cleanCaption}`;
}

// ---------------------------------------------------------------------------
// Per-attachment AES-256-GCM encryption & BLAKE3 integrity verification
// ---------------------------------------------------------------------------

export async function sealChatMedia(plainBytes: Uint8Array): Promise<{
  sealed: Uint8Array;
  hash: string;
  keyHex: string;
}> {
  if (!plainBytes.byteLength) throw new Error("Media file is empty");
  if (plainBytes.byteLength > MAX_CHAT_MEDIA_PLAIN) {
    throw new Error(
      `Attachment is ${Math.round(plainBytes.byteLength / 1024)} KB, exceeding Freenet's ${Math.floor(MAX_CHAT_MEDIA_PLAIN / 1024)} KB chat media limit.`
    );
  }
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    cryptoKey,
    plainBytes as BufferSource
  );
  const sealed = new Uint8Array(12 + cipherBuf.byteLength);
  sealed.set(iv, 0);
  sealed.set(new Uint8Array(cipherBuf), 12);
  return {
    sealed,
    hash: mediaHashOf(sealed),
    keyHex: bytesToHex(keyBytes),
  };
}

export async function openChatMedia(
  sealed: Uint8Array,
  expectedHash: string,
  keyHex: string
): Promise<Uint8Array | null> {
  if (
    !sealed ||
    sealed.byteLength <= 28 ||
    sealed.byteLength > MAX_CHAT_MEDIA_SEALED ||
    !/^[0-9a-f]{64}$/i.test(expectedHash) ||
    !/^[0-9a-f]{64}$/i.test(keyHex)
  ) {
    return null;
  }
  if (mediaHashOf(sealed) !== expectedHash.toLowerCase()) return null;
  try {
    const keyBytes = hexToBytes(keyHex.toLowerCase());
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes as BufferSource,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const iv = sealed.subarray(0, 12);
    const body = sealed.subarray(12);
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      cryptoKey,
      body as BufferSource
    );
    return new Uint8Array(plainBuf);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Decrypted Blob URL Cache (keyed by hash + key prefix, LRU capped)
// ---------------------------------------------------------------------------

const MAX_BLOB_URLS = 150;
const blobCache = new Map<string, string>(); // `${hash}:${keyPrefix}` -> blob: URL
const inflightResolves = new Map<string, Promise<string | null>>();

function cacheKeyOf(hash: string, keyHex: string): string {
  return `${hash.toLowerCase()}:${keyHex.toLowerCase().slice(0, 16)}`;
}

function safeMimeForKind(kind: ChatMediaKind, mime: string): string {
  if (kind === "img") return SAFE_IMAGE_MIMES.has(mime) ? mime : "image/jpeg";
  if (kind === "file") return mime && /^[a-z0-9/+.-]+$/i.test(mime) ? mime : "application/octet-stream";
  return SAFE_AUDIO_MIMES.has(mime) ? mime : "audio/webm";
}

export function keepChatMediaUrl(
  hash: string,
  keyHex: string,
  plainBytes: Uint8Array,
  kind: ChatMediaKind,
  mime: string
): string {
  const ck = cacheKeyOf(hash, keyHex);
  const existing = blobCache.get(ck);
  if (existing) return existing;
  const safeMime = safeMimeForKind(kind, mime);
  const url = URL.createObjectURL(new Blob([plainBytes as BlobPart], { type: safeMime }));
  blobCache.set(ck, url);
  if (blobCache.size > MAX_BLOB_URLS) {
    const [oldestKey, oldestUrl] = blobCache.entries().next().value as [string, string];
    try {
      URL.revokeObjectURL(oldestUrl);
    } catch {}
    blobCache.delete(oldestKey);
  }
  return url;
}

export function resolveChatMediaUrl(
  item: ChatMediaItem,
  getSealed: (hash: string) => Promise<Uint8Array | null>
): Promise<string | null> {
  const ck = cacheKeyOf(item.hash, item.keyHex);
  const hit = blobCache.get(ck);
  if (hit) return Promise.resolve(hit);
  let p = inflightResolves.get(ck);
  if (!p) {
    p = fetchChatMedia(item.hash, item.keyHex, getSealed)
      .then((plain) => {
        if (!plain) return null;
        return keepChatMediaUrl(item.hash, item.keyHex, plain, item.kind, item.mime);
      })
      .catch(() => null)
      .finally(() => inflightResolves.delete(ck));
    inflightResolves.set(ck, p);
  }
  return p;
}

/** Revoke any cached decrypted Blob URLs referenced by a deleted/cleared message. */
export function revokeChatMediaInText(text: string): void {
  const { items } = parseChatMedia(text);
  for (const item of items) {
    const ck = cacheKeyOf(item.hash, item.keyHex);
    const url = blobCache.get(ck);
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
      blobCache.delete(ck);
    }
  }
}

// ---------------------------------------------------------------------------
// Client-side Image Compression, Audio Decoding & Voice Note Recording
// ---------------------------------------------------------------------------

function dataUriToBytesAndMime(uri: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(uri);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (!SAFE_IMAGE_MIMES.has(mime)) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

/**
 * Seal an attachment of any size up to MAX_CHAT_FILE_BYTES. Small ones give one blob, as before. Bigger ones are cut
 * into chunks sealed with the same key, followed by a sealed manifest of their hashes; `hash` names the manifest, so
 * the chat token format does not change. Publish every blob in `blobs`.
 */
export async function sealChatMediaChunked(plainBytes: Uint8Array): Promise<{
  blobs: Uint8Array[];
  hash: string;
  keyHex: string;
}> {
  if (plainBytes.byteLength <= MAX_CHAT_MEDIA_PLAIN) {
    const { sealed, hash, keyHex } = await sealChatMedia(plainBytes);
    return { blobs: [sealed], hash, keyHex };
  }
  if (plainBytes.byteLength > MAX_CHAT_FILE_BYTES) {
    throw new Error(
      `File is ${Math.round(plainBytes.byteLength / 1024 / 1024)} MB, over the ${MAX_CHAT_FILE_BYTES / 1024 / 1024} MB chat attachment limit.`
    );
  }
  const keyHex = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const blobs: Uint8Array[] = [];
  const hashes: string[] = [];
  for (let off = 0; off < plainBytes.byteLength; off += MAX_CHAT_MEDIA_PLAIN) {
    const sealed = await sealWithKey(plainBytes.subarray(off, off + MAX_CHAT_MEDIA_PLAIN), keyHex);
    blobs.push(sealed);
    hashes.push(mediaHashOf(sealed));
  }
  const manifest = await sealWithKey(new TextEncoder().encode(CHUNK_MANIFEST_MAGIC + hashes.join("\n")), keyHex);
  blobs.push(manifest);
  return { blobs, hash: mediaHashOf(manifest), keyHex };
}

async function sealWithKey(plainBytes: Uint8Array, keyHex: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", hexToBytes(keyHex) as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, cryptoKey, plainBytes as BufferSource);
  const sealed = new Uint8Array(12 + cipherBuf.byteLength);
  sealed.set(iv, 0);
  sealed.set(new Uint8Array(cipherBuf), 12);
  return sealed;
}

/** Fetch and open an attachment; a chunk manifest is followed and its chunks joined. Null if any piece is missing. */
export async function fetchChatMedia(
  hash: string,
  keyHex: string,
  getSealed: (hash: string) => Promise<Uint8Array | null>
): Promise<Uint8Array | null> {
  const sealed = await getSealed(hash);
  const plain = sealed && (await openChatMedia(sealed, hash, keyHex));
  if (!plain) return null;
  const head = new TextDecoder().decode(plain.subarray(0, CHUNK_MANIFEST_MAGIC.length));
  if (head !== CHUNK_MANIFEST_MAGIC) return plain;
  const hashes = new TextDecoder().decode(plain.subarray(CHUNK_MANIFEST_MAGIC.length)).split("\n");
  if (!hashes.length || hashes.some((h) => !/^[0-9a-f]{64}$/.test(h))) return null;
  const parts = await Promise.all(
    hashes.map(async (h) => {
      const c = await getSealed(h);
      return c && openChatMedia(c, h, keyHex);
    })
  );
  if (parts.some((part) => !part)) return null;
  const total = parts.reduce((n, part) => n + part!.byteLength, 0);
  if (total > MAX_CHAT_FILE_BYTES) return null;
  const out = new Uint8Array(total);
  let off = 0;
  for (const part of parts) {
    out.set(part!, off);
    off += part!.byteLength;
  }
  return out;
}

function measureImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

export async function prepareChatImageFile(file: File | Blob): Promise<PreparedChatMedia> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }
  let dataUri = await compressPostImageFile(file, 1280, 0.82);
  let decoded = dataUriToBytesAndMime(dataUri);
  if (!decoded || decoded.bytes.byteLength > MAX_CHAT_MEDIA_PLAIN) {
    dataUri = await compressPostImageFile(file, 860, 0.7);
    decoded = dataUriToBytesAndMime(dataUri);
  }
  if (!decoded) throw new Error("Could not encode image.");
  if (decoded.bytes.byteLength > MAX_CHAT_MEDIA_PLAIN) {
    throw new Error("Image is still too large after compression (max 750 KB).");
  }
  const { width, height } = await measureImageDimensions(dataUri);
  const previewUrl = URL.createObjectURL(new Blob([decoded.bytes as BlobPart], { type: decoded.mime }));
  const kb = Math.max(1, Math.round(decoded.bytes.byteLength / 1024));
  return {
    kind: "img",
    bytes: decoded.bytes,
    mime: decoded.mime,
    label: `Photo (${width && height ? `${width}×${height} · ` : ""}${kb} KB)`,
    previewUrl,
    ...(width && height ? { width, height } : {}),
  };
}

/** Downsample an array of non-negative amplitudes into `bars` integers in 2..15. */
export function normalizePeaksToBars(peaks: number[], bars = WAVEFORM_BARS): number[] {
  if (!peaks.length) return new Array(bars).fill(4);
  const bucketed: number[] = [];
  for (let i = 0; i < bars; i++) {
    const start = Math.floor((i * peaks.length) / bars);
    const end = Math.max(start + 1, Math.floor(((i + 1) * peaks.length) / bars));
    let sum = 0;
    let max = 0;
    for (let j = start; j < end && j < peaks.length; j++) {
      const v = Math.abs(peaks[j]) || 0;
      sum += v;
      if (v > max) max = v;
    }
    const avg = sum / Math.max(1, end - start);
    bucketed.push(max * 0.65 + avg * 0.35);
  }
  const peakMax = Math.max(...bucketed, 0.001);
  return bucketed.map((v) => Math.max(2, Math.min(15, Math.round((v / peakMax) * 13) + 2)));
}

async function analyzeAudioBlob(bytes: Uint8Array, mime: string): Promise<{ durationSec: number; waveform: number[] }> {
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (AudioCtx) {
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioCtx();
      const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const audioBuf = await ctx.decodeAudioData(copy);
      const data = audioBuf.getChannelData(0);
      const step = Math.max(1, Math.floor(data.length / 280));
      const samples: number[] = [];
      for (let i = 0; i < data.length; i += step) samples.push(Math.abs(data[i]));
      return {
        durationSec: Math.max(0.5, Math.round(audioBuf.duration * 10) / 10),
        waveform: normalizePeaksToBars(samples, WAVEFORM_BARS),
      };
    } catch {
      // Fallback to HTMLAudioElement metadata below
    } finally {
      if (ctx) void ctx.close().catch(() => {});
    }
  }

  // Fallback duration via <audio> element
  const durationSec = await new Promise<number>((resolve) => {
    if (typeof Audio === "undefined") return resolve(0);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const a = new Audio();
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? Math.round(d * 10) / 10 : 0);
    };
    a.preload = "metadata";
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    setTimeout(() => done(a.duration), 2000);
    a.src = url;
  });

  return {
    durationSec,
    waveform: defaultWaveform(mediaHashOf(bytes).slice(0, 32), WAVEFORM_BARS),
  };
}

export async function prepareChatAudioFile(
  file: File | Blob,
  kind: "voice" | "audio" = "audio",
  knownDurationSec?: number,
  knownWaveform?: number[]
): Promise<PreparedChatMedia> {
  const filename = file instanceof File ? file.name : "";
  const mime = normalizeAudioMime(file.type, filename);
  if (!mime) {
    throw new Error("Unsupported audio format. Use MP3, OGG/Opus, WebM, M4A, WAV, or AAC.");
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (!bytes.byteLength) throw new Error("Audio file is empty.");
  if (bytes.byteLength > MAX_CHAT_MEDIA_PLAIN) {
    const kb = Math.round(bytes.byteLength / 1024);
    throw new Error(
      `Audio file is ${kb} KB (max ${Math.floor(MAX_CHAT_MEDIA_PLAIN / 1024)} KB per chat message). Try a shorter clip or share full tracks via FreeTunes!`
    );
  }

  let durationSec = knownDurationSec ?? 0;
  let waveform = knownWaveform;
  if (!durationSec || !waveform?.length) {
    const analyzed = await analyzeAudioBlob(bytes, mime);
    if (!durationSec) durationSec = analyzed.durationSec;
    if (!waveform?.length) waveform = analyzed.waveform;
  }

  const previewUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const kb = Math.max(1, Math.round(bytes.byteLength / 1024));
  const baseTitle = kind === "voice" ? "Voice message" : filename ? filename.slice(0, 32) : "Audio";
  return {
    kind,
    bytes,
    mime,
    label: `${baseTitle} (${formatMediaDuration(durationSec)} · ${kb} KB)`,
    previewUrl,
    durationSec,
    waveform,
  };
}

export async function prepareChatDocFile(file: File | Blob, explicitName?: string): Promise<PreparedChatMedia> {
  const filename = explicitName || (file instanceof File ? file.name : "") || "document";
  const rawMime = (file.type || "").split(";")[0].trim().toLowerCase();
  const mime = /^[a-z0-9/+.-]+$/.test(rawMime) ? rawMime : "application/octet-stream";
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (!bytes.byteLength) throw new Error("File is empty.");
  if (bytes.byteLength > MAX_CHAT_FILE_BYTES) {
    const mb = Math.round(bytes.byteLength / 1024 / 1024);
    throw new Error(`File is ${mb} MB, over the ${MAX_CHAT_FILE_BYTES / 1024 / 1024} MB chat attachment limit.`);
  }
  const previewUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const sizeBytes = bytes.byteLength;
  const kb = Math.max(1, Math.round(sizeBytes / 1024));
  return {
    kind: "file",
    bytes,
    mime,
    label: `${filename} (${kb} KB)`,
    previewUrl,
    sizeBytes,
    filename,
  };
}

export interface VoiceRecorderSession {
  stop: () => Promise<PreparedChatMedia | null>;
  cancel: () => void;
}

function pickRecorderMime(): { recorderMime: string; safeMime: string } {
  const candidates: [string, string][] = [
    ["audio/webm;codecs=opus", "audio/webm"],
    ["audio/ogg;codecs=opus", "audio/ogg"],
    ["audio/mp4", "audio/mp4"],
    ["audio/webm", "audio/webm"],
  ];
  if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
    for (const [rec, safe] of candidates) {
      if (MediaRecorder.isTypeSupported(rec)) return { recorderMime: rec, safeMime: safe };
    }
  }
  return { recorderMime: "", safeMime: "audio/webm" };
}

export async function startVoiceRecording(opts: {
  onTick?: (elapsedSec: number, level0to15: number, approxBytes: number) => void;
  onMaxReached?: () => void;
}): Promise<VoiceRecorderSession> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      throw new Error(
        "Microphone requires a secure origin. Replace '127.0.0.1' with 'localhost' in your address bar (http://localhost:7509/...) to grant mic access."
      );
    }
    throw new Error("Microphone access is not available in this browser.");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || String(err);
    if (msg.includes("Invalid security origin") || (err as { name?: string })?.name === "SecurityError") {
      throw new Error(
        "Freenet web gateway sandboxes contracts inside an iframe that blocks hardware mic access. You can attach audio files directly, or run via dev server / desktop app."
      );
    }
    throw err;
  }

  if (typeof MediaRecorder === "undefined") {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("Audio recording (MediaRecorder) is not supported in this browser.");
  }

  const { recorderMime, safeMime } = pickRecorderMime();
  let recorder: MediaRecorder;
  try {
    recorder = recorderMime
      ? new MediaRecorder(stream, { mimeType: recorderMime, audioBitsPerSecond: 24_000 })
      : new MediaRecorder(stream, { audioBitsPerSecond: 24_000 });
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const chunks: Blob[] = [];
  let totalBytes = 0;
  let cancelled = false;
  let stopped = false;
  let maxTriggered = false;
  const startedAt = Date.now();
  const liveSamples: number[] = [];

  // Optional live mic amplitude sampling via Web Audio AnalyserNode
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let timeDomain: Uint8Array | null = null;
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      timeDomain = new Uint8Array(analyser.fftSize);
    }
  } catch {
    // Recording still succeeds without live AnalyserNode
  }

  const SAFE_RECORD_CAP = MAX_CHAT_MEDIA_PLAIN - 20_480; // ~20 KB safety headroom before stop flush

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
      totalBytes += ev.data.size;
      if (!maxTriggered && totalBytes >= SAFE_RECORD_CAP) {
        maxTriggered = true;
        opts.onMaxReached?.();
      }
    }
  };

  const tickTimer = setInterval(() => {
    if (stopped || cancelled) return;
    let peak = 0.08;
    if (analyser && timeDomain) {
      analyser.getByteTimeDomainData(timeDomain as Uint8Array<ArrayBuffer>);
      let maxDev = 0;
      for (let i = 0; i < timeDomain.length; i++) {
        const dev = Math.abs(timeDomain[i] - 128) / 128;
        if (dev > maxDev) maxDev = dev;
      }
      peak = maxDev;
    }
    liveSamples.push(peak);
    const level = Math.max(2, Math.min(15, Math.round(Math.min(1, peak * 3.2) * 13) + 2));
    const elapsedSec = (Date.now() - startedAt) / 1000;
    opts.onTick?.(elapsedSec, level, totalBytes);
    if (!maxTriggered && elapsedSec >= 240) {
      maxTriggered = true;
      opts.onMaxReached?.();
    }
  }, 120);

  const cleanupHardware = () => {
    clearInterval(tickTimer);
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {}
    }
    if (audioCtx) {
      void audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  };

  recorder.start(250);

  return {
    cancel() {
      if (stopped || cancelled) return;
      cancelled = true;
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {}
      cleanupHardware();
    },
    stop(): Promise<PreparedChatMedia | null> {
      if (cancelled) return Promise.resolve(null);
      if (stopped) return Promise.resolve(null);
      stopped = true;
      const elapsedSec = Math.max(0.5, Math.round(((Date.now() - startedAt) / 1000) * 10) / 10);
      return new Promise((resolve, reject) => {
        const finalize = async () => {
          cleanupHardware();
          if (cancelled || !chunks.length) return resolve(null);
          try {
            const actualMime = normalizeAudioMime(recorder.mimeType || safeMime) ?? safeMime;
            const blob = new Blob(chunks, { type: actualMime });
            const wf = liveSamples.length >= 4 ? normalizePeaksToBars(liveSamples, WAVEFORM_BARS) : undefined;
            const prepared = await prepareChatAudioFile(blob, "voice", elapsedSec, wf);
            resolve(prepared);
          } catch (err) {
            reject(err);
          }
        };
        if (recorder.state === "inactive") {
          void finalize();
        } else {
          recorder.addEventListener("stop", () => void finalize(), { once: true });
          try {
            recorder.stop();
          } catch {
            void finalize();
          }
        }
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Chat Bubble Media Cards & Interactive Hydration
// ---------------------------------------------------------------------------

export function chatMediaCardsHtml(items: ChatMediaItem[]): string {
  if (!items.length) return "";
  return items
    .map((item) => {
      const attrs = `data-cm-kind="${esc(item.kind)}" data-cm-mime="${esc(item.mime)}" data-cm-hash="${esc(item.hash)}" data-cm-key="${esc(item.keyHex)}"`;
      if (item.kind === "img") {
        const ratio =
          item.width && item.height
            ? `style="aspect-ratio: ${item.width} / ${item.height};"`
            : "";
        return `<div class="cm-card cm-img-card" ${attrs}>
          <div class="cm-img-wrap" ${ratio}>
            <div class="cm-img-status">🔒 Decrypting photo…</div>
          </div>
        </div>`;
      }

      if (item.kind === "file") {
        const fname = item.filename || "file";
        const icon = fileExtensionIcon(fname);
        const sizeStr = formatBytes(item.sizeBytes);
        return `<div class="cm-card cm-file-card" ${attrs} data-cm-filename="${esc(fname)}" data-cm-size="${item.sizeBytes ?? 0}">
          <div class="cm-file-icon">${icon}</div>
          <div class="cm-file-info">
            <div class="cm-file-name" title="${esc(fname)}">${esc(fname)}</div>
            <div class="cm-file-meta">${esc(sizeStr)} · 🔒 Encrypted</div>
          </div>
          <button type="button" class="cm-file-download" title="Download ${esc(fname)}" aria-label="Download ${esc(fname)}">⬇️</button>
        </div>`;
      }

      const durStr = formatMediaDuration(item.durationSec);
      const bars = item.waveform?.length ? item.waveform : defaultWaveform(item.hash, WAVEFORM_BARS);
      const barsHtml = bars
        .map((h, idx) => {
          const pct = Math.round((Math.max(2, Math.min(15, h)) / 15) * 100);
          return `<span class="cm-wf-bar" data-bar-idx="${idx}" style="height: ${Math.max(16, pct)}%;"></span>`;
        })
        .join("");
      const kindBadge = item.kind === "voice" ? "🎙️ Voice" : "🎵 Audio";
      return `<div class="cm-card cm-audio-card" ${attrs} data-cm-dur="${item.durationSec ?? 0}">
        <button type="button" class="cm-audio-play" aria-label="Play ${item.kind === "voice" ? "voice message" : "audio"}">▶</button>
        <div class="cm-audio-main">
          <div class="cm-waveform" role="slider" aria-label="Seek audio" tabindex="0">${barsHtml}</div>
          <div class="cm-audio-meta">
            <span class="cm-audio-time">${esc(durStr)}</span>
            <span class="cm-audio-kind">${kindBadge}</span>
          </div>
        </div>
        <button type="button" class="cm-speed-btn" title="Playback speed">1×</button>
        <audio preload="none"></audio>
      </div>`;
    })
    .join("");
}

function pauseAllOtherAudio(except: HTMLAudioElement): void {
  document.querySelectorAll<HTMLAudioElement>(".cm-audio-card audio, .ft-card audio").forEach((a) => {
    if (a !== except && !a.paused) a.pause();
  });
}

export function fillChatMedia(
  root: ParentNode,
  getSealed: (hash: string) => Promise<Uint8Array | null>
): void {
  root.querySelectorAll<HTMLElement>(".cm-card:not([data-cm-state])").forEach((card) => {
    const kind = (card.dataset.cmKind || "img") as ChatMediaKind;
    const mime = card.dataset.cmMime || "";
    const hash = card.dataset.cmHash || "";
    const keyHex = card.dataset.cmKey || "";
    if (!hash || !keyHex) return;

    const filename = card.dataset.cmFilename || "";
    const sizeBytes = Number(card.dataset.cmSize || 0);

    const item: ChatMediaItem = {
      raw: "",
      kind,
      mime,
      hash,
      keyHex,
      durationSec: Number(card.dataset.cmDur || 0),
      sizeBytes: sizeBytes > 0 ? sizeBytes : undefined,
      filename: filename || undefined,
    };

    if (kind === "img") {
      const wrap = card.querySelector<HTMLElement>(".cm-img-wrap");
      if (!wrap) return;
      const loadImg = () => {
        card.dataset.cmState = "loading";
        wrap.innerHTML = `<div class="cm-img-status">🔒 Decrypting photo…</div>`;
        void resolveChatMediaUrl(item, getSealed).then((blobUrl) => {
          if (!blobUrl) {
            card.dataset.cmState = "missing";
            wrap.innerHTML = `<button type="button" class="cm-retry-btn">📷 Photo not on node yet · Tap to retry</button>`;
            wrap.querySelector(".cm-retry-btn")?.addEventListener("click", (ev) => {
              ev.stopPropagation();
              loadImg();
            });
            return;
          }
          card.dataset.cmState = "ready";
          const img = document.createElement("img");
          img.src = blobUrl;
          img.alt = "Encrypted chat photo";
          img.loading = "lazy";
          wrap.innerHTML = "";
          wrap.appendChild(img);
        });
      };
      loadImg();
      return;
    }

    if (kind === "file") {
      card.dataset.cmState = "ready";
      const dlBtn = card.querySelector<HTMLButtonElement>(".cm-file-download");
      const fname = card.dataset.cmFilename || item.filename || "file";
      if (!dlBtn) return;
      let downloading = false;
      dlBtn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        if (downloading) return;
        downloading = true;
        dlBtn.disabled = true;
        dlBtn.textContent = "⏳";
        try {
          const blobUrl = await resolveChatMediaUrl(item, getSealed);
          if (!blobUrl) {
            dlBtn.textContent = "⚠️";
            setTimeout(() => {
              dlBtn.textContent = "⬇️";
            }, 2500);
            return;
          }
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          a.remove();
          dlBtn.textContent = "✓";
          setTimeout(() => {
            dlBtn.textContent = "⬇️";
          }, 2000);
        } catch {
          dlBtn.textContent = "❌";
          setTimeout(() => {
            dlBtn.textContent = "⬇️";
          }, 2500);
        } finally {
          downloading = false;
          dlBtn.disabled = false;
        }
      });
      return;
    }

    // Audio / Voice Note player hydration
    card.dataset.cmState = "ready";
    const playBtn = card.querySelector<HTMLButtonElement>(".cm-audio-play");
    const wfEl = card.querySelector<HTMLElement>(".cm-waveform");
    const timeEl = card.querySelector<HTMLElement>(".cm-audio-time");
    const speedBtn = card.querySelector<HTMLButtonElement>(".cm-speed-btn");
    const audio = card.querySelector<HTMLAudioElement>("audio");
    if (!playBtn || !wfEl || !timeEl || !audio) return;

    const bars = Array.from(wfEl.querySelectorAll<HTMLElement>(".cm-wf-bar"));
    const knownDur = Number(card.dataset.cmDur || 0);
    const speeds = [1, 1.5, 2];
    let speedIdx = 0;
    let loaded = false;
    let loading = false;

    const effectiveDuration = () =>
      Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : knownDur;

    const updateProgress = () => {
      const dur = effectiveDuration();
      const cur = audio.currentTime || 0;
      const ratio = dur > 0 ? Math.max(0, Math.min(1, cur / dur)) : 0;
      const litCount = Math.round(ratio * bars.length);
      for (let i = 0; i < bars.length; i++) {
        bars[i].classList.toggle("played", i < litCount);
      }
      if (!audio.paused || cur > 0) {
        timeEl.textContent = `${formatMediaDuration(cur)} / ${formatMediaDuration(dur)}`;
      } else {
        timeEl.textContent = formatMediaDuration(dur);
      }
    };

    audio.addEventListener("play", () => {
      pauseAllOtherAudio(audio);
      playBtn.textContent = "⏸";
      card.classList.add("playing");
    });

    audio.addEventListener("pause", () => {
      playBtn.textContent = "▶";
      card.classList.remove("playing");
      updateProgress();
    });

    audio.addEventListener("ended", () => {
      playBtn.textContent = "▶";
      card.classList.remove("playing");
      audio.currentTime = 0;
      for (const b of bars) b.classList.remove("played");
      timeEl.textContent = formatMediaDuration(effectiveDuration());
    });

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateProgress);

    const ensureAudioLoaded = async (): Promise<boolean> => {
      if (loaded) return true;
      if (loading) return false;
      loading = true;
      const prevTimeText = timeEl.textContent;
      timeEl.textContent = "Decrypting…";
      playBtn.disabled = true;
      try {
        const blobUrl = await resolveChatMediaUrl(item, getSealed);
        if (!blobUrl) {
          timeEl.textContent = "Not on node · Retry";
          return false;
        }
        audio.src = blobUrl;
        audio.playbackRate = speeds[speedIdx];
        loaded = true;
        timeEl.textContent = prevTimeText;
        return true;
      } finally {
        loading = false;
        playBtn.disabled = false;
      }
    };

    playBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      if (!loaded) {
        const ok = await ensureAudioLoaded();
        if (!ok) return;
      }
      if (audio.paused) {
        await audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    });

    wfEl.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const rect = wfEl.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      if (!loaded) {
        const ok = await ensureAudioLoaded();
        if (!ok) return;
      }
      const dur = effectiveDuration();
      if (dur > 0) {
        audio.currentTime = ratio * dur;
        updateProgress();
      }
      if (audio.paused) await audio.play().catch(() => {});
    });

    speedBtn?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      speedIdx = (speedIdx + 1) % speeds.length;
      const rate = speeds[speedIdx];
      audio.playbackRate = rate;
      speedBtn.textContent = `${rate}×`;
    });
  });
}

