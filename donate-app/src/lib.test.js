import test from "node:test";
import assert from "node:assert/strict";
import { Identity } from "@semaphore-protocol/core";
import { tierOf, parseUsd, messageFor, pubkeyOf, encodeProofToken, decodeProofToken } from "./lib.js";

test("tiers match the contract thresholds", () => {
  assert.equal(tierOf(999_999n), null);
  assert.equal(tierOf(1_000_000n), "sprout");
  assert.equal(tierOf(49_999_999n), "sprout");
  assert.equal(tierOf(50_000_000n), "root");
  assert.equal(tierOf(250_000_000n), "oak");
});

test("USD amounts parse to 6-decimal units", () => {
  assert.equal(parseUsd("1"), 1_000_000n);
  assert.equal(parseUsd("12.5"), 12_500_000n);
  assert.equal(parseUsd("0.000001"), 1n);
  for (const bad of ["", "0", "-1", "1.1234567", "1e3", "abc"]) assert.equal(parseUsd(bad), null, bad);
});

test("Radica pubkey round-trips through the proof message", () => {
  const pk = "0a".repeat(32);
  assert.equal(pubkeyOf(messageFor(pk.toUpperCase())), pk);
  assert.throws(() => messageFor("xyz"));
});

test("identity from the same wallet signature is the same identity", () => {
  const sig = "0x" + "ab".repeat(65);
  assert.equal(new Identity(sig).commitment, new Identity(sig).commitment);
  assert.notEqual(new Identity(sig).commitment, new Identity("0x" + "cd".repeat(65)).commitment);
});

test("proof token round-trips and rejects garbage", () => {
  const proof = { merkleTreeDepth: 1, merkleTreeRoot: "1", nullifier: "2", message: "3", scope: "4", points: Array(8).fill("5") };
  const t = encodeProofToken({ chainId: 84532, contract: "0xabc", tier: "oak", groupId: 9n, proof });
  const d = decodeProofToken(t);
  assert.equal(d.groupId, "9");
  assert.deepEqual(d.proof, proof);
  assert.throws(() => decodeProofToken("RADICA-ZK-V1:e30="));
  assert.throws(() => decodeProofToken("nope"));
});
