import test from "node:test";
import assert from "node:assert/strict";
import { isSoundEnabled, setSoundEnabled, toggleSoundEnabled, playPopSound, SOUND_STORAGE_KEY } from "../src/sound.ts";
import { safeStorage } from "../src/storage.ts";

test("sound: preferences are persisted in safeStorage and default to enabled", () => {
  safeStorage.removeItem(SOUND_STORAGE_KEY);
  assert.equal(isSoundEnabled(), true, "Sound should be enabled by default");

  setSoundEnabled(false);
  assert.equal(isSoundEnabled(), false);
  assert.equal(safeStorage.getItem(SOUND_STORAGE_KEY), "false");

  const toggled = toggleSoundEnabled();
  assert.equal(toggled, true);
  assert.equal(isSoundEnabled(), true);

  setSoundEnabled(true);
});

test("sound: playPopSound runs safely without DOM AudioContext", () => {
  // In pure Node.js environment without window.AudioContext, it must return false and never throw
  const res = playPopSound();
  assert.equal(typeof res, "boolean");
});

test("sound: playPopSound synthesizes with Web Audio API mock", () => {
  let createdOsc = 0;
  let createdGain = 0;
  let connectedDest = 0;
  let startedOsc = 0;

  const mockOsc = () => ({
    type: "sine",
    frequency: {
      setValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
    },
    connect: () => {},
    start: () => { createdOsc++; startedOsc++; },
    stop: () => {},
  });

  const mockGain = () => ({
    gain: {
      value: 1,
      setValueAtTime: () => {},
      linearRampToValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
    },
    connect: (dest: unknown) => {
      createdGain++;
      if (dest === "DESTINATION") connectedDest++;
    },
  });

  const mockCtx = {
    currentTime: 10,
    state: "running",
    destination: "DESTINATION",
    createOscillator: mockOsc,
    createGain: mockGain,
    resume: async () => {},
  };

  (globalThis as any).window = {
    AudioContext: function () {
      return mockCtx;
    },
  };

  setSoundEnabled(true);
  const played = playPopSound(true);
  assert.equal(played, true);
  assert.equal(startedOsc, 2, "Should start main pop oscillator and snap transient");
  assert.equal(connectedDest, 2, "Both gain nodes should connect to destination");

  // Disabled should not play
  setSoundEnabled(false);
  const playedDisabled = playPopSound(false);
  assert.equal(playedDisabled, false);

  // Clean up global mock
  delete (globalThis as any).window;
  setSoundEnabled(true);
});
