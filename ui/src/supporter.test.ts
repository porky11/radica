import test from "node:test";
import assert from "node:assert/strict";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";
import {
  DONATION_ADDRESSES,
  explorerTxUrl,
  issueReceipt,
  verifyReceipt,
  parseReceiptToken,
  serializeReceipt,
  receiptMessage,
  supporterBadge,
  getStoredReceipt,
  saveStoredReceipt,
  clearStoredReceipt,
  type SupporterReceipt,
} from "./supporter.ts";

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));
ed.etc.sha512Async = (...m) => Promise.resolve(sha512(ed.etc.concatBytes(...m)));

test("supporter: donation addresses match official ETH and BTC addresses", () => {
  assert.equal(DONATION_ADDRESSES.eth, "0xA6591dCDff5C7616110b4f84207184aef7835048");
  assert.equal(DONATION_ADDRESSES.btc, "bc1qm9lrzy9yq35pwps0mald6r6u0r3z4m5pusdcyw");
});

test("supporter: issue and verify receipt roundtrip (ETH and BTC)", async () => {
  // Generate a test maintainer keypair
  const maintainerSk = ed.utils.randomPrivateKey();
  const maintainerPkBytes = await ed.getPublicKeyAsync(maintainerSk);
  const maintainerPkHex = ed.etc.bytesToHex(maintainerPkBytes);

  const donorSk = ed.utils.randomPrivateKey();
  const donorPk = ed.etc.bytesToHex(await ed.getPublicKeyAsync(donorSk));

  // 1. Issue an ETH receipt
  const ethToken = await issueReceipt(maintainerSk, donorPk, "root", "eth", 1730556000000);

  assert.ok(ethToken.startsWith("RADICA-RECEIPT-V1:"));

  // Verify ETH receipt against maintainer key
  const verifiedEth = await verifyReceipt(ethToken, donorPk, maintainerPkHex);
  assert.equal(verifiedEth.donor_pk, donorPk);
  assert.equal(verifiedEth.tier, "root");
  assert.equal(verifiedEth.chain, "eth");
  assert.equal(verifiedEth.tx_hash, "");
  assert.equal(verifiedEth.ts, 1730556000000);

  // 2. Issue a BTC receipt
  const btcToken = await issueReceipt(maintainerSk, donorPk, "oak", "btc", 1730556100000);

  const verifiedBtc = await verifyReceipt(btcToken, donorPk, maintainerPkHex);
  assert.equal(verifiedBtc.donor_pk, donorPk);
  assert.equal(verifiedBtc.tier, "oak");
  assert.equal(verifiedBtc.chain, "btc");
});

test("supporter: legacy v1 receipt carrying a tx hash still verifies", async () => {
  const maintainerSk = ed.utils.randomPrivateKey();
  const maintainerPkHex = ed.etc.bytesToHex(await ed.getPublicKeyAsync(maintainerSk));
  const donorPk = "ab".repeat(32);
  const legacy = { donor_pk: donorPk, tier: "root" as const, chain: "eth" as const, tx_hash: "0xdeadbeef", ts: 1730000000000 };
  const sig = ed.etc.bytesToHex(await ed.signAsync(receiptMessage(legacy), maintainerSk));
  const verified = await verifyReceipt(serializeReceipt({ v: 1, ...legacy, sig }), donorPk, maintainerPkHex);
  assert.equal(verified.tx_hash, "0xdeadbeef");
});

test("supporter: rejects receipt when claimed by wrong donor identity", async () => {
  const maintainerSk = ed.utils.randomPrivateKey();
  const maintainerPkHex = ed.etc.bytesToHex(await ed.getPublicKeyAsync(maintainerSk));

  const alicePk = ed.etc.bytesToHex(await ed.getPublicKeyAsync(ed.utils.randomPrivateKey()));
  const bobPk = ed.etc.bytesToHex(await ed.getPublicKeyAsync(ed.utils.randomPrivateKey()));

  const tokenForAlice = await issueReceipt(maintainerSk, alicePk, "sprout", "eth", Date.now());

  // Alice verifies her own token -> OK
  await assert.doesNotReject(verifyReceipt(tokenForAlice, alicePk, maintainerPkHex));

  // Bob tries to use Alice's token -> REJECTED
  await assert.rejects(
    () => verifyReceipt(tokenForAlice, bobPk, maintainerPkHex),
    /Receipt belongs to another identity/
  );
});

test("supporter: rejects tampered or forged receipt", async () => {
  const maintainerSk = ed.utils.randomPrivateKey();
  const maintainerPkHex = ed.etc.bytesToHex(await ed.getPublicKeyAsync(maintainerSk));
  const attackerSk = ed.utils.randomPrivateKey();

  const donorPk = ed.etc.bytesToHex(await ed.getPublicKeyAsync(ed.utils.randomPrivateKey()));

  // 1. Signed by attacker instead of real maintainer
  const forgedToken = await issueReceipt(attackerSk, donorPk, "oak", "eth", Date.now());
  await assert.rejects(
    () => verifyReceipt(forgedToken, donorPk, maintainerPkHex),
    /receipt was not signed by the Radica maintainer/
  );

  // 2. Tampered payload: token signed for 'sprout' but altered to 'oak'
  const realToken = await issueReceipt(maintainerSk, donorPk, "sprout", "eth", 1730000000000);
  const parsed = parseReceiptToken(realToken);
  parsed.tier = "oak"; // Tamper!
  const tamperedToken = serializeReceipt(parsed);

  await assert.rejects(
    () => verifyReceipt(tamperedToken, donorPk, maintainerPkHex),
    /receipt was not signed by the Radica maintainer/
  );
});

test("supporter: badge metadata formatting", () => {
  const sproutEth: SupporterReceipt = {
    v: 1,
    donor_pk: "aaa",
    tier: "sprout",
    chain: "eth",
    tx_hash: "0x1",
    ts: 1000,
    sig: "fff",
  };
  const badge1 = supporterBadge(sproutEth);
  assert.equal(badge1.label, "Sprout Supporter (ETH)");
  assert.equal(badge1.icon, "🌱");
  assert.equal(badge1.badgeClass, "badge-supporter-sprout");

  const oakBtc: SupporterReceipt = {
    v: 1,
    donor_pk: "bbb",
    tier: "oak",
    chain: "btc",
    tx_hash: "tx1",
    ts: 2000,
    sig: "fff",
  };
  const badge2 = supporterBadge(oakBtc);
  assert.equal(badge2.label, "Oak Supporter (BTC)");
  assert.equal(badge2.icon, "🌳");
  assert.equal(badge2.badgeClass, "badge-supporter-oak");
});

test("supporter: safeStorage save and retrieve", async () => {
  const maintainerSk = ed.utils.randomPrivateKey();
  const donorPk = "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff";
  const token = await issueReceipt(maintainerSk, donorPk, "root", "btc", 1730000000000);

  saveStoredReceipt(token, donorPk);
  const stored = getStoredReceipt(donorPk);

  assert.ok(stored);
  assert.equal(stored.donor_pk, donorPk);
  assert.equal(stored.tier, "root");
  assert.equal(stored.chain, "btc");

  clearStoredReceipt(donorPk);
  assert.equal(getStoredReceipt(donorPk), null);
});


test("supporter: explorer links only for well-formed tx ids", () => {
  const h = "ab".repeat(32);
  assert.equal(explorerTxUrl("eth", ` 0x${h.toUpperCase()} `), `https://blockscan.com/tx/0x${h}`);
  assert.equal(explorerTxUrl("btc", h), `https://mempool.space/tx/${h}`);
  assert.equal(explorerTxUrl("eth", h), null); // missing 0x
  assert.equal(explorerTxUrl("btc", `0x${h}`), null);
  assert.equal(explorerTxUrl("eth", "0x12/../evil"), null);
});
