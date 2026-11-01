import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeChatMediaToken,
  parseChatMedia,
  maskChatMediaTokens,
  summarizeChatMediaText,
  sealChatMedia,
  openChatMedia,
  normalizeAudioMime,
  formatMediaDuration,
  defaultWaveform,
  normalizePeaksToBars,
  chatMediaCardsHtml,
  MAX_CHAT_MEDIA_PLAIN,
} from "./chatMedia.ts";

test("chatMedia: formatMediaDuration formats seconds properly", () => {
  assert.equal(formatMediaDuration(0), "0:00");
  assert.equal(formatMediaDuration(5), "0:05");
  assert.equal(formatMediaDuration(65), "1:05");
  assert.equal(formatMediaDuration(120), "2:00");
  assert.equal(formatMediaDuration(365), "6:05");
});

test("chatMedia: normalizeAudioMime maps audio formats to safe MIME strings", () => {
  assert.equal(normalizeAudioMime("audio/webm"), "audio/webm");
  assert.equal(normalizeAudioMime("audio/ogg"), "audio/ogg");
  assert.equal(normalizeAudioMime("audio/mp3", "track.mp3"), "audio/mpeg");
  assert.equal(normalizeAudioMime("", "speech.opus"), "audio/ogg");
  assert.equal(normalizeAudioMime("audio/x-wav"), "audio/wav");
  assert.equal(normalizeAudioMime("application/octet-stream", "note.m4a"), "audio/mp4");
  assert.equal(normalizeAudioMime("application/pdf"), null);
});

test("chatMedia: defaultWaveform and normalizePeaksToBars generate valid heights", () => {
  const wf = defaultWaveform("deadbeef12345678", 28);
  assert.equal(wf.length, 28);
  assert.ok(wf.every((v) => v >= 2 && v <= 15));

  const sampled = normalizePeaksToBars([0.1, 0.5, 0.9, 0.2, 0.8, 0.4], 6);
  assert.equal(sampled.length, 6);
  assert.ok(sampled.every((v) => v >= 2 && v <= 15));
});

test("chatMedia: image token encoding, parsing, and caption separation", () => {
  const hash = "a".repeat(64);
  const keyHex = "b".repeat(64);
  const token = encodeChatMediaToken({
    kind: "img",
    mime: "image/webp",
    hash,
    keyHex,
    width: 800,
    height: 600,
  });

  assert.equal(token, `[radica-cm1:img:image/webp:${hash}:${keyHex}:800x600]`);

  const fullMsg = `Look at this sunset!\n${token}\nWhat do you think?`;
  const { items, caption } = parseChatMedia(fullMsg);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "img");
  assert.equal(items[0].mime, "image/webp");
  assert.equal(items[0].hash, hash);
  assert.equal(items[0].keyHex, keyHex);
  assert.equal(items[0].width, 800);
  assert.equal(items[0].height, 600);
  assert.equal(caption, "Look at this sunset!\n\nWhat do you think?");
});

test("chatMedia: voice and audio token encoding, parsing with waveform", () => {
  const hash = "c".repeat(64);
  const keyHex = "d".repeat(64);
  const waveform = [3, 8, 12, 15, 6, 4];
  const token = encodeChatMediaToken({
    kind: "voice",
    mime: "audio/webm",
    hash,
    keyHex,
    durationSec: 14.5,
    waveform,
  });

  assert.equal(token, `[radica-cm1:voice:audio/webm:${hash}:${keyHex}:14.5:38cf64]`);

  const { items, caption } = parseChatMedia(`Here is my voice memo:\n${token}`);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "voice");
  assert.equal(items[0].durationSec, 14.5);
  assert.deepEqual(items[0].waveform, waveform);
  assert.equal(caption, "Here is my voice memo:");
});

test("chatMedia: maskChatMediaTokens protects tokens during regex passes", () => {
  const hash = "e".repeat(64);
  const keyHex = "f".repeat(64);
  const token = `[radica-cm1:img:image/jpeg:${hash}:${keyHex}:640x480]`;
  const text = `Hey call 123-456-7890 ${token}`;

  const { masked, restore } = maskChatMediaTokens(text);
  assert.ok(!masked.includes(token));
  assert.ok(masked.includes("\uE0200\uE021"));

  const censored = masked.replace(/123-456-7890/, "[PHONE]");
  const restored = restore(censored);
  assert.equal(restored, `Hey call [PHONE] ${token}`);
});

test("chatMedia: summarizeChatMediaText creates crisp human preview labels", () => {
  const hash = "1".repeat(64);
  const keyHex = "2".repeat(64);
  const imgToken = `[radica-cm1:img:image/webp:${hash}:${keyHex}:400x300]`;
  const voiceToken = `[radica-cm1:voice:audio/webm:${hash}:${keyHex}:42]`;

  assert.equal(summarizeChatMediaText(imgToken), "📷 Photo");
  assert.equal(summarizeChatMediaText(`Check this out\n${imgToken}`), "📷 Check this out");
  assert.equal(summarizeChatMediaText(voiceToken), "🎙️ Voice message (0:42)");
  assert.equal(summarizeChatMediaText(`Listen to this\n${voiceToken}`), "🎙️ (0:42) Listen to this");
});

test("chatMedia: sealChatMedia and openChatMedia encrypt & decrypt with BLAKE3 verification", async () => {
  const plainText = "Hello Freenet decentralization audio test!";
  const plainBytes = new TextEncoder().encode(plainText);

  const { sealed, hash, keyHex } = await sealChatMedia(plainBytes);
  assert.ok(sealed.byteLength > plainBytes.byteLength);
  assert.equal(hash.length, 64);
  assert.equal(keyHex.length, 64);

  // Successful decryption
  const decrypted = await openChatMedia(sealed, hash, keyHex);
  assert.ok(decrypted);
  assert.equal(new TextDecoder().decode(decrypted!), plainText);

  // Tampered ciphertext fails
  const tampered = new Uint8Array(sealed);
  tampered[15] ^= 0x42;
  const failTamper = await openChatMedia(tampered, hash, keyHex);
  assert.equal(failTamper, null);

  // Wrong key fails
  const wrongKey = "0".repeat(64);
  const failKey = await openChatMedia(sealed, hash, wrongKey);
  assert.equal(failKey, null);
});

test("chatMedia: chatMediaCardsHtml renders valid markup", () => {
  const hash = "9".repeat(64);
  const keyHex = "8".repeat(64);
  const imgHtml = chatMediaCardsHtml([
    {
      raw: "",
      kind: "img",
      mime: "image/webp",
      hash,
      keyHex,
      width: 600,
      height: 400,
    },
  ]);
  assert.ok(imgHtml.includes('class="cm-card cm-img-card"'));
  assert.ok(imgHtml.includes(`data-cm-hash="${hash}"`));

  const audioHtml = chatMediaCardsHtml([
    {
      raw: "",
      kind: "voice",
      mime: "audio/webm",
      hash,
      keyHex,
      durationSec: 18,
      waveform: [5, 10, 15],
    },
  ]);
  assert.ok(audioHtml.includes('class="cm-card cm-audio-card"'));
  assert.ok(audioHtml.includes('class="cm-waveform"'));
  assert.ok(audioHtml.includes("0:18"));
});

