import { test } from "node:test";
import assert from "node:assert/strict";
import { safeStorage } from "./storage.ts";

test("safeStorage: stores and retrieves items without throwing", () => {
  safeStorage.setItem("test_key", "test_val");
  assert.equal(safeStorage.getItem("test_key"), "test_val");

  safeStorage.removeItem("test_key");
  assert.equal(safeStorage.getItem("test_key"), null);
});

test("safeStorage: works when localStorage throws SecurityError", () => {
  const origLocalStorage = (globalThis as any).localStorage;
  try {
    Object.defineProperty(globalThis, "localStorage", {
      get() {
        throw new DOMException(
          "Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.",
          "SecurityError"
        );
      },
      configurable: true,
    });

    safeStorage.setItem("sandboxed_key", "secret123");
    assert.equal(safeStorage.getItem("sandboxed_key"), "secret123");
    safeStorage.removeItem("sandboxed_key");
    assert.equal(safeStorage.getItem("sandboxed_key"), null);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      value: origLocalStorage,
      configurable: true,
      writable: true,
    });
  }
});

test("safeStorage: preserves newest Moment media_uri in feed under budget and across hash reload", () => {
  const owner = "test_persona_pubkey_123456789";
  const profileKey = `radica_profile_${owner}`;
  const feedKey = `freenet_feed_${owner}`;

  safeStorage.setItem(
    profileKey,
    JSON.stringify({ display_name: "Tester", bio: "Bio", avatar_url: "data:image/svg+xml;base64,mock" })
  );

  const sampleMomentMedia = "data:image/webp;base64," + "A".repeat(1800);
  const feed = {
    owner,
    posts: {
      post_1: {
        id: "post_1",
        author: owner,
        category: "moment",
        caption: "Helicopter in the sky",
        media_uri: sampleMomentMedia,
        timestamp: Date.now(),
        sig: "sig_abc",
        likes: [],
        comments: {},
      },
      post_0: {
        id: "post_0",
        author: owner,
        category: "thought",
        caption: "Earlier thought",
        timestamp: Date.now() - 10000,
        sig: "sig_def",
        likes: [],
        comments: {},
      },
    },
    following: [],
    profile: { display_name: "Tester" },
  };

  safeStorage.setItem(feedKey, JSON.stringify(feed));

  // Compute the budgeted URL hash state
  const { authObj, hash } = safeStorage.computeBudgetedState();
  assert.ok(hash.length <= 7500, `Hash length ${hash.length} must be <= 7500`);
  assert.ok(authObj[feedKey], "Feed must be present in budgeted state");

  // Simulate F5 browser reload: clear memory and rehydrate strictly from hash
  safeStorage.clear();
  assert.equal(safeStorage.getItem(feedKey), null, "State must be empty after clear");

  safeStorage.hydrateFromHashString(hash);
  const reloaded = JSON.parse(safeStorage.getItem(feedKey) || "{}");
  assert.ok(reloaded.posts, "feed should contain posts after reload");
  assert.equal(reloaded.posts["post_1"]?.media_uri, sampleMomentMedia, "Newest Moment media_uri must survive reload");
  assert.equal(reloaded.posts["post_0"]?.caption, "Earlier thought", "Thought must survive reload");

  safeStorage.clear();
});

test("safeStorage: strips older moment media first when budget is tight, preserving newest moment media across reload", () => {
  const owner = "test_persona_pubkey_multi";
  const profileKey = `radica_profile_${owner}`;
  const feedKey = `freenet_feed_${owner}`;

  safeStorage.setItem(
    profileKey,
    JSON.stringify({ display_name: "MultiTester", bio: "Bio", avatar_url: "data:image/svg+xml;base64,mock" })
  );

  // Two moment images that together exceed 7500 char budget
  const momentMediaNew = "data:image/webp;base64," + "B".repeat(2400);
  const momentMediaOld = "data:image/webp;base64," + "C".repeat(3200);

  const feed = {
    owner,
    posts: {
      post_new: {
        id: "post_new",
        author: owner,
        category: "moment",
        caption: "Sunset today",
        media_uri: momentMediaNew,
        timestamp: 2000,
        sig: "sig_new",
        likes: [],
        comments: {},
      },
      post_old: {
        id: "post_old",
        author: owner,
        category: "moment",
        caption: "Helicopter yesterday",
        media_uri: momentMediaOld,
        timestamp: 1000,
        sig: "sig_old",
        likes: [],
        comments: {},
      },
    },
    following: [],
    profile: { display_name: "MultiTester" },
  };

  safeStorage.setItem(feedKey, JSON.stringify(feed));

  const { hash } = safeStorage.computeBudgetedState();
  assert.ok(hash.length <= 7500, `Hash length ${hash.length} must be <= 7500`);

  // Simulate F5 browser reload from hash
  safeStorage.clear();
  safeStorage.hydrateFromHashString(hash);

  const reloaded = JSON.parse(safeStorage.getItem(feedKey) || "{}");
  assert.ok(reloaded.posts, "feed should contain posts after reload");
  // Newest post keeps its media
  assert.equal(reloaded.posts["post_new"]?.media_uri, momentMediaNew, "Newest moment media must be kept across reload");
  // Older post is preserved (caption, comments, etc.) but its media is stripped to fit budget
  assert.equal(reloaded.posts["post_old"]?.caption, "Helicopter yesterday", "Older post caption must be kept across reload");
  assert.equal(reloaded.posts["post_old"]?.media_uri, undefined, "Older moment media should be stripped when exceeding budget");

  safeStorage.clear();
});
