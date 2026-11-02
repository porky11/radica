// Post videos. Made on-device: frames sampled and scanned first (a blocked video is never encoded), then transcoded to
// a small H.264 + AAC MP4 with Mediabunny (WebCodecs). Published like a big chat attachment (sealed chunks + manifest,
// chatMedia.ts), so nodes hold ciphertext. A post names one as "radica-video:<manifest hash>:<key hex>".
import type { ImageModerationResult } from "./moderation";
import { keepChatMediaUrl, MAX_CHAT_FILE_BYTES, resolveChatMediaUrl, sealChatMediaChunked, uploadChatMedia, type ChatMediaItem } from "./chatMedia.ts";

export const VIDEO_PREFIX = "radica-video:";
const SCAN_EVERY_SEC = 2;
// The MP4 must fit the 25 MB chunked attachment cap, and readers download it whole: the longer the video, the lower
// the bitrate (and height), down to MIN_VIDEO_BPS. 10% kept for the MP4 container and encoder overshoot.
const BUDGET_BITS = MAX_CHAT_FILE_BYTES * 0.9 * 8;
const AUDIO_BPS = 64_000;
const MIN_VIDEO_BPS = 250_000;
const MAX_VIDEO_BPS = 1_200_000;
export const MAX_VIDEO_SEC = Math.floor(BUDGET_BITS / (MIN_VIDEO_BPS + AUDIO_BPS));

/** Video bitrate and height for a clip of `duration` s from a `sourceHeight` source; null when it is too long. */
export function videoPlan(duration: number, sourceHeight: number): { bitrate: number; height: number } | null {
  const bitrate = Math.min(MAX_VIDEO_BPS, Math.floor(BUDGET_BITS / duration) - AUDIO_BPS);
  if (!(bitrate >= MIN_VIDEO_BPS)) return null;
  return { bitrate, height: Math.min(sourceHeight, bitrate >= 800_000 ? 720 : bitrate >= 450_000 ? 480 : 360) };
}

export function videoRef(uri?: string): { hash: string; keyHex: string } | null {
  const m = /^radica-video:([0-9a-f]{64}):([0-9a-f]{64})$/.exec(uri ?? "");
  return m ? { hash: m[1], keyHex: m[2] } : null;
}

const item = (hash: string, keyHex: string): ChatMediaItem => ({ raw: "", kind: "file", mime: "video/mp4", hash, keyHex });

/** Seconds to sample for the scan: every SCAN_EVERY_SEC, plus the last frame. */
export function scanTimes(duration: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < duration; t += SCAN_EVERY_SEC) out.push(t);
  if (duration > 0 && out[out.length - 1] < duration - 0.5) out.push(duration - 0.5);
  return out;
}

/**
 * Scan `file` frame by frame with `scan`; stops at the first unverified or blocked (>= stopAt) frame. When nothing
 * stopped it, transcode it. Returns the worst scan, a poster blob, and the MP4 bytes (absent when stopped).
 */
export async function prepareVideo(
  file: Blob,
  scan: (frame: HTMLCanvasElement | OffscreenCanvas) => Promise<ImageModerationResult>,
  stopAt: number,
  onProgress?: (stage: "scan" | "encode", p: number) => void
): Promise<{ worst: ImageModerationResult; poster: Blob | null; bytes?: Uint8Array; audioDropped?: boolean }> {
  const M = await import("mediabunny");
  const input = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS });
  const duration = await input.computeDuration();
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error("No video track in this file.");
  const plan = videoPlan(duration, track.displayHeight);
  if (!plan) throw new Error(`Video is ${Math.round(duration)} s, over the ${Math.floor(MAX_VIDEO_SEC / 60)} min limit.`);

  const times = scanTimes(duration);
  const sink = new M.CanvasSink(track, { height: Math.min(512, track.displayHeight), fit: "contain" });
  let worst: ImageModerationResult = { isNSFW: false, score: 0, label: "Safe" };
  let poster: Blob | null = null;
  let i = 0;
  for await (const frame of sink.canvasesAtTimestamps(times)) {
    onProgress?.("scan", ++i / times.length);
    if (!frame) continue;
    const c = frame.canvas;
    if (!poster) poster = c instanceof HTMLCanvasElement ? await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.8)) : await c.convertToBlob({ type: "image/jpeg", quality: 0.8 });
    const r = await scan(c);
    if (r.unverified || r.score > worst.score) worst = r;
    if (r.unverified || r.score >= stopAt) return { worst, poster };
  }

  // AAC plays everywhere, but not every browser can encode it (WebCodecs): Opus in MP4 then (Chrome, Firefox, Safari 17+)
  const audioCodec = (await M.canEncodeAudio("aac", { bitrate: AUDIO_BPS })) ? "aac" : "opus";
  const output = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: "in-memory" }), target: new M.BufferTarget() });
  const conversion = await M.Conversion.init({
    input,
    output,
    video: { codec: "avc", bitrate: plan.bitrate, keyFrameInterval: 2, forceTranscode: true, ...(plan.height < track.displayHeight ? { height: plan.height } : {}) },
    audio: { codec: audioCodec, bitrate: AUDIO_BPS, forceTranscode: true },
  });
  if (!conversion.isValid) throw new Error("This browser cannot encode this video (H.264).");
  // the conversion stays valid without its sound: say so instead of posting a silent video unannounced
  const audioDropped = conversion.discardedTracks.some((d) => d.track.isAudioTrack());
  conversion.onProgress = (p) => onProgress?.("encode", p);
  await conversion.execute();
  const bytes = new Uint8Array(output.target.buffer!);
  if (bytes.byteLength > MAX_CHAT_FILE_BYTES) throw new Error("Encoded video is too big; try a shorter clip.");
  return { worst, poster, bytes, audioDropped };
}

/** Seal and publish the MP4; returns the post's media_uri. Kept locally so our own post plays at once. */
export async function publishVideo(bytes: Uint8Array, put: (b: Uint8Array) => Promise<unknown>, onProgress?: (done: number, total: number) => void): Promise<string> {
  const { blobs, hash, keyHex } = await sealChatMediaChunked(bytes);
  keepChatMediaUrl(hash, keyHex, bytes, "file", "video/mp4");
  await uploadChatMedia(blobs, put, onProgress);
  return `${VIDEO_PREFIX}${hash}:${keyHex}`;
}

/** A blob: URL for the video a media_uri names, or null when it is missing. */
export function videoUrl(uri: string, get: (hash: string) => Promise<Uint8Array | null>): Promise<string | null> {
  const ref = videoRef(uri);
  return ref ? resolveChatMediaUrl(item(ref.hash, ref.keyHex), get) : Promise.resolve(null);
}
