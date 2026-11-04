import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countLeadingZeroBits,
  createPoWChallenge,
  solvePoW,
  verifyPoW,
  DEFAULT_TIER0_DIFFICULTY,
  postIdWithPow,
  postHasPow,
} from "../src/pow.ts";

test("pow: countLeadingZeroBits correctly calculates zero bits", () => {
  assert.equal(countLeadingZeroBits(new Uint8Array([0, 0, 0, 0])), 32);
  assert.equal(countLeadingZeroBits(new Uint8Array([0, 0, 1, 0])), 23);
  assert.equal(countLeadingZeroBits(new Uint8Array([0x80, 0, 0, 0])), 0);
  assert.equal(countLeadingZeroBits(new Uint8Array([0x40, 0, 0, 0])), 1);
  assert.equal(countLeadingZeroBits(new Uint8Array([0x01, 0, 0, 0])), 7);
  assert.equal(countLeadingZeroBits(new Uint8Array([0x00, 0x0f, 0, 0])), 12);
});

test("pow: solves and verifies proof with required difficulty", async () => {
  const author = "a".repeat(64);
  const ts = 1730000000000;
  // Test with difficulty 10 for fast test execution
  const difficulty = 10;

  const proof = await solvePoW(author, ts, difficulty);

  assert.ok(proof);
  assert.equal(proof.challenge, createPoWChallenge(author, ts));
  assert.equal(proof.difficulty, difficulty);

  // Verification passes with matching parameters
  assert.ok(verifyPoW(proof, author, ts, difficulty));

  // Verification fails if author doesn't match
  assert.equal(verifyPoW(proof, "b".repeat(64), ts, difficulty), false);

  // Verification fails if timestamp doesn't match
  assert.equal(verifyPoW(proof, author, ts + 100, difficulty), false);

  // Verification fails if required difficulty is higher than proved
  assert.equal(verifyPoW(proof, author, ts, difficulty + 5), false);

  // Verification fails if nonce is tampered
  assert.equal(
    verifyPoW({ ...proof, nonce: proof.nonce + 1 }, author, ts, difficulty),
    false
  );
});


test("pow: a post id carries its proof, bound to author and timestamp, with nothing free to vary", async () => {
  const author = "c".repeat(64);
  const ts = 1_800_000_000_000;
  const proof = await solvePoW(author, ts, 8);
  const id = postIdWithPow(ts, proof);
  assert.equal(postHasPow({ id, author, timestamp: ts }, 8), true);
  assert.equal(postHasPow({ id, author: "d".repeat(64), timestamp: ts }, 8), false, "another author");
  assert.equal(postHasPow({ id, author, timestamp: ts + 1 }, 8), false, "another timestamp");
  assert.equal(postHasPow({ id: `${id.replace(/_p/, "_x1_p")}`, author, timestamp: ts }, 8), false, "a random part to reuse the proof");
  assert.equal(postHasPow({ id: postIdWithPow(ts), author, timestamp: ts }, 8), false, "no proof");
});
