import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, safeUrl, shortenKey } from "./html.ts";

test("html: escapeHtml neutralises markup in content and quoted attributes", () => {
  assert.equal(escapeHtml(`<img src=x onerror="a('b')">&`), "&#60;img src=x onerror=&#34;a(&#39;b&#39;)&#34;&#62;&#38;");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(42), "42");
});

test("html: safeUrl keeps images, https and blob URLs only, escaped", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("data:text/html,<b>"), "");
  assert.equal(safeUrl(undefined), "");
  assert.equal(safeUrl('https://a.b/x?q="y"'), "https://a.b/x?q=&#34;y&#34;");
  assert.equal(safeUrl("blob:abc"), "blob:abc");
});

test("html: shortenKey keeps short keys and cuts long ones", () => {
  assert.equal(shortenKey("abc"), "abc");
  assert.equal(shortenKey("0123456789abcdef"), "012345...abcdef");
});
