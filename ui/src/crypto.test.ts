import test from "node:test";
import assert from "node:assert/strict";
import * as ed from "@noble/ed25519";
import {
  formatPostSignatureMessage,
  formatCommentSignatureMessage,
  formatProfileSignatureMessage,
  formatChatMessageSignatureMessage,
  formatCommunitySignatureMessage,
  formatModActionSignatureMessage,
  encryptDirectMessage,
  decryptDirectMessage,
} from "./crypto.ts";

test("crypto: message formatters generate deterministic structured strings", () => {
  const postMsg = formatPostSignatureMessage(
    "p123",
    "author_hex",
    "Technology",
    "Hello world!",
    "freenet://media123",
    1700000000
  );
  assert.equal(postMsg, "p123:author_hex:Technology:Hello world!:freenet://media123:1700000000");

  const commentMsg = formatCommentSignatureMessage(
    "c456",
    "p123",
    "commenter_hex",
    "Great post!",
    1700000050
  );
  assert.equal(commentMsg, "c456:p123:commenter_hex:Great post!:1700000050");

  const profileMsg = formatProfileSignatureMessage(
    "Alice",
    "Decentralized builder",
    "avatar.png",
    1700000100
  );
  assert.equal(profileMsg, "Alice:Decentralized builder:avatar.png:1700000100");

  const chatMsg = formatChatMessageSignatureMessage(
    "m789",
    "general",
    "alice_hex",
    "bob_hex",
    "Secret hello",
    1700000150
  );
  assert.equal(chatMsg, "m789:general:alice_hex:bob_hex:Secret hello:1700000150");

  const commMsg = formatCommunitySignatureMessage(
    "comm-tech",
    "tech",
    "Technology",
    "creator_hex",
    1700000200
  );
  assert.equal(commMsg, "comm-tech:tech:Technology:creator_hex:1700000200");

  const modMsg = formatModActionSignatureMessage(
    "comm-tech",
    "delete_post",
    "post_bad",
    "mod_hex",
    1700000250
  );
  assert.equal(modMsg, "comm-tech:delete_post:post_bad:mod_hex:1700000250");
});

test("crypto: 1-on-1 E2EE encryption & decryption via X25519 ECDH + AES-GCM", async () => {
  // Alice keypair
  const alicePriv = ed.utils.randomPrivateKey();
  const alicePub = await ed.getPublicKeyAsync(alicePriv);
  const alicePubHex = ed.etc.bytesToHex(alicePub);

  // Bob keypair
  const bobPriv = ed.utils.randomPrivateKey();
  const bobPub = await ed.getPublicKeyAsync(bobPriv);
  const bobPubHex = ed.etc.bytesToHex(bobPub);

  const secretMessage = "Confidential P2P transmission over Freenet 🚀🔒";

  // Alice encrypts for Bob
  const encrypted = await encryptDirectMessage(alicePriv, bobPubHex, secretMessage);
  assert.ok(encrypted.startsWith("e2e:"), "Ciphertext must have e2e: prefix");

  const parts = encrypted.split(":");
  assert.equal(parts.length, 3, "Encrypted format must be e2e:<ivHex>:<cipherHex>");
  assert.equal(parts[1].length, 24, "IV must be 12 bytes (24 hex characters)");
  assert.notEqual(parts[2], secretMessage, "Plaintext must not be exposed");

  // Bob decrypts from Alice
  const decryptedByBob = await decryptDirectMessage(bobPriv, alicePubHex, encrypted);
  assert.equal(decryptedByBob, secretMessage);

  // Bob replies to Alice
  const reply = "Received loud and clear, Alice!";
  const encryptedReply = await encryptDirectMessage(bobPriv, alicePubHex, reply);
  const decryptedByAlice = await decryptDirectMessage(alicePriv, bobPubHex, encryptedReply);
  assert.equal(decryptedByAlice, reply);
});

test("crypto: E2EE handles tampered ciphertexts and non-e2e plaintexts gracefully", async () => {
  const alicePriv = ed.utils.randomPrivateKey();
  const bobPriv = ed.utils.randomPrivateKey();
  const alicePubHex = ed.etc.bytesToHex(await ed.getPublicKeyAsync(alicePriv));
  const bobPubHex = ed.etc.bytesToHex(await ed.getPublicKeyAsync(bobPriv));

  const encrypted = await encryptDirectMessage(alicePriv, bobPubHex, "Secret data");

  // Tamper ciphertext
  const tampered = encrypted.slice(0, -4) + "0000";
  const decryptedTampered = await decryptDirectMessage(bobPriv, alicePubHex, tampered);
  assert.equal(decryptedTampered, "[Encrypted message - unable to decrypt]");

  // Plaintext without e2e: prefix passes through untouched
  const plainText = "Standard community chat message without encryption";
  const decryptedPlain = await decryptDirectMessage(bobPriv, alicePubHex, plainText);
  assert.equal(decryptedPlain, plainText);
});
