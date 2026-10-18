import test from "node:test";
import assert from "node:assert/strict";
import { censorTextAndPII, analyzeTextContent } from "./moderation.ts";

test("moderation: redacts sensitive PII (Credit Card, IBAN, Email, Codice Fiscale, Phone)", () => {
  // 1. Credit Card
  const ccText = "My card number is 4532-1488-9021-3456 please charge it.";
  const ccRes = censorTextAndPII(ccText);
  assert.equal(ccRes.hasCensoredPII, true);
  assert.ok(ccRes.censoredText.includes("[💳 CARD DATA REDACTED]"));
  assert.ok(!ccRes.censoredText.includes("4532-1488-9021-3456"));
  assert.ok(ccRes.details.includes("Credit card / payment details"));

  // 2. IBAN
  const ibanText = "Send the wire transfer to IT60X0542811101000000123456 immediately.";
  const ibanRes = censorTextAndPII(ibanText);
  assert.equal(ibanRes.hasCensoredPII, true);
  assert.ok(ibanRes.censoredText.includes("[🏦 IBAN REDACTED]"));
  assert.ok(!ibanRes.censoredText.includes("IT60X0542811101000000123456"));
  assert.ok(ibanRes.details.includes("Bank IBAN number"));

  // 3. Email
  const emailText = "Reach out to me at alice.freenet@example.org for inquiries.";
  const emailRes = censorTextAndPII(emailText);
  assert.equal(emailRes.hasCensoredPII, true);
  assert.ok(emailRes.censoredText.includes("[📧 EMAIL REDACTED]"));
  assert.ok(!emailRes.censoredText.includes("alice.freenet@example.org"));
  assert.ok(emailRes.details.includes("Email address"));

  // 4. Italian Codice Fiscale
  const cfText = "My tax identification number is RSSMRA85M01H501Z.";
  const cfRes = censorTextAndPII(cfText);
  assert.equal(cfRes.hasCensoredPII, true);
  assert.ok(cfRes.censoredText.includes("[🪪 TAX ID REDACTED]"));
  assert.ok(!cfRes.censoredText.includes("RSSMRA85M01H501Z"));
  assert.ok(cfRes.details.includes("Tax ID / Codice Fiscale"));

  // 5. Phone numbers
  const phoneText = "Call me directly at +39 349 123 4567 or 06 12345678.";
  const phoneRes = censorTextAndPII(phoneText);
  assert.equal(phoneRes.hasCensoredPII, true);
  assert.ok(phoneRes.censoredText.includes("[📱 PHONE NUMBER REDACTED]"));
  assert.ok(!phoneRes.censoredText.includes("349 123 4567"));
  assert.ok(phoneRes.details.includes("Phone number"));
});

test("moderation: censors profanities and hate speech in Italian and English", () => {
  // Italian profanities
  const itText = "Che cazzo stai dicendo pezzo di merda";
  const itRes = censorTextAndPII(itText);
  assert.equal(itRes.hasCensoredProfanity, true);
  assert.ok(!itRes.censoredText.toLowerCase().includes("cazzo"));
  assert.ok(!itRes.censoredText.toLowerCase().includes("merda"));
  assert.ok(itRes.censoredText.includes("*****"));
  assert.ok(itRes.details.includes("Inappropriate language / profanity"));

  // English profanities
  const enText = "This is fucking bullshit what an asshole";
  const enRes = censorTextAndPII(enText);
  assert.equal(enRes.hasCensoredProfanity, true);
  assert.ok(!enRes.censoredText.toLowerCase().includes("fucking"));
  assert.ok(!enRes.censoredText.toLowerCase().includes("asshole"));
  assert.ok(enRes.censoredText.includes("*******"));
  assert.ok(enRes.details.includes("Inappropriate language / profanity"));
});

test("moderation: preserves safe content and provides correct analyzeTextContent flags", () => {
  const cleanPost = "Spruce is an awesome decentralized social network built on Freenet with end-to-end privacy!";
  const cleanRes = censorTextAndPII(cleanPost);
  assert.equal(cleanRes.censoredText, cleanPost);
  assert.equal(cleanRes.hasCensoredPII, false);
  assert.equal(cleanRes.hasCensoredProfanity, false);
  assert.equal(cleanRes.details.length, 0);

  const analysis = analyzeTextContent(cleanPost);
  assert.equal(analysis.isToxic, false);
  assert.equal(analysis.containsPII, false);
  assert.equal(analysis.warnings.length, 0);

  const flaggedPost = "Contact secret@corp.com or I will fuck this up";
  const flaggedAnalysis = analyzeTextContent(flaggedPost);
  assert.equal(flaggedAnalysis.isToxic, true);
  assert.equal(flaggedAnalysis.containsPII, true);
  assert.equal(flaggedAnalysis.warnings.length, 2);
  assert.ok(flaggedAnalysis.warnings.includes("Email address"));
  assert.ok(flaggedAnalysis.warnings.includes("Inappropriate language / profanity"));
});
