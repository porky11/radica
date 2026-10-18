import test from "node:test";
import assert from "node:assert/strict";
import { generateDefaultAvatar } from "./avatar.ts";

test("avatar: generateDefaultAvatar produces deterministic data URIs", () => {
  const avatar1 = generateDefaultAvatar("5jQAw8QEzaTestKey");
  const avatar2 = generateDefaultAvatar("5jQAw8QEzaTestKey");
  const avatarOther = generateDefaultAvatar("DifferentPersonaKey");

  assert.ok(avatar1.startsWith("data:image/svg+xml;base64,"));
  assert.equal(avatar1, avatar2, "Same seed must produce identical avatar");
  assert.notEqual(avatar1, avatarOther, "Different seeds must produce different avatars");
});

test("avatar: generateDefaultAvatar handles empty and nullish seeds safely", () => {
  const fallback = generateDefaultAvatar();
  assert.ok(fallback.startsWith("data:image/svg+xml;base64,"));

  const emptyFallback = generateDefaultAvatar("");
  assert.equal(emptyFallback, fallback);
});
