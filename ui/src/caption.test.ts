import test from "node:test";
import assert from "node:assert/strict";
import { linkify, renderCaption } from "./caption.ts";

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

test("caption: chat text gets links but no hashtag filters", () => {
  assert.equal(linkify("a #tag <b>"), "a #tag &#60;b&#62;");
  assert.match(linkify("see https://x.org/a."), /<a class="post-link" href="https:\/\/x\.org\/a"[^>]*>https:\/\/x\.org\/a<\/a>\.$/);
});

test("caption: freenet: links open on the reader's node", () => {
  assert.match(
    linkify("see freenet:Hzr1Gh39ab/llms.txt."),
    /href="http:\/\/127\.0\.0\.1:7509\/v1\/contract\/web\/Hzr1Gh39ab\/llms\.txt"[^>]*>freenet:Hzr1Gh39ab\/llms\.txt<\/a>\.$/
  );
  assert.equal(linkify("freenet:short"), "freenet:short"); // too short for a contract id
});

test("caption: a node URL is shortened and re-pointed at the reader's node", () => {
  const html = linkify("try http://10.0.0.5:8080/v1/contract/web/9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ/");
  assert.match(html, /href="http:\/\/127\.0\.0\.1:7509\/v1\/contract\/web\/9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ\/"/);
  assert.match(html, />freenet:9eBjDk\u2026s4yZ<\/a>$/);
});
