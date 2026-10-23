import test from "node:test";
import assert from "node:assert/strict";
import { renderCaption } from "./caption.ts";

test("caption: links become anchors, hashtags filters, everything else is escaped", () => {
  assert.equal(
    renderCaption("https://google.com"),
    '<a class="post-link" href="https://google.com" target="_blank" rel="noopener noreferrer nofollow">https://google.com</a>'
  );
  const html = renderCaption("read http://a.org/x#frag, then #p2p <b>");
  assert.match(html, /href="http:\/\/a\.org\/x#frag"/); // a # inside a link is not a hashtag
  assert.match(html, /<\/a>, then <span class="hashtag clickable-hashtag" data-tag="p2p"/);
  assert.match(html, /&#60;b&#62;$/);
});

test("caption: punctuation after a link stays outside it and markup cannot break out of the href", () => {
  assert.match(renderCaption("(see https://x.org/a)."), /https:\/\/x\.org\/a<\/a>\)\.$/);
  const evil = renderCaption('https://x.org/"onmouseover="alert(1)');
  assert.ok(!evil.includes('"onmouseover'));
  assert.equal(renderCaption("javascript:alert(1) no link"), "javascript:alert(1) no link");
});
