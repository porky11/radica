import test from "node:test";
import assert from "node:assert/strict";
import { linkCard, linkify, md, renderCaption, renderChatText, renderPost, renderComment, mentionsIn, plainMentions } from "./caption.ts";
import { namesToKeys } from "./mentionPicker.ts";

test("caption: links become anchors, hashtags filters, everything else is escaped", () => {
  assert.equal(
    renderCaption("https://google.com"),
    '<a class="post-link" href="https://google.com" target="_blank" rel="noopener noreferrer nofollow">google.com</a>'
  );
  const html = renderCaption("read http://a.org/x#frag, then #p2p <b>");
  assert.match(html, /href="http:\/\/a\.org\/x#frag"/); // a # inside a link is not a hashtag
  assert.match(html, /<\/a>, then <span class="hashtag clickable-hashtag" data-tag="p2p"/);
  assert.match(html, /&#60;b&#62;$/);
});

test("caption: punctuation after a link stays outside it and markup cannot break out of the href", () => {
  assert.match(renderCaption("(see https://x.org/a)."), />x\.org\/a<\/a>\)\.$/);
  const evil = renderCaption('https://x.org/"onmouseover="alert(1)');
  assert.ok(!evil.includes('"onmouseover'));
  assert.equal(renderCaption("javascript:alert(1) no link"), "javascript:alert(1) no link");
});

test("caption: chat text gets links but no hashtag filters", () => {
  assert.equal(linkify("a #tag <b>"), "a #tag &#60;b&#62;");
  assert.match(linkify("see https://x.org/a."), /<a class="post-link" href="https:\/\/x\.org\/a"[^>]*>x\.org\/a<\/a>\.$/);
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

test("caption: web links show a short label, and a post gets a card for its first web link", () => {
  const long = "https://www.youtube.com/watch?v=2XqdW4A5w2M&list=RD2XqdW4A5w2M&start_radio=1";
  assert.match(linkify(long), />www\.youtube\.com\/watch\?v=2XqdW4A5w2M&#38;list=\u2026<\/a>$/);
  const card = linkCard(`UH YEAAH! ${long}`);
  assert.match(card, /class="link-card" href="https:\/\/www\.youtube\.com\/watch/);
  assert.match(card, />youtube\.com<.*Watch on YouTube/);
  assert.match(linkCard("see https://x.org/a."), /href="https:\/\/x\.org\/a"/);
  assert.equal(linkCard("freenet:Hzr1Gh39ab/llms.txt and no web link"), "");
  assert.ok(!linkCard('https://x.org/"onmouseover="alert(1)').includes('"onmouseover'));
});

test("caption: in a post the carded link leaves the text, other links stay", () => {
  const { html, card } = renderPost("UH YEAAH!\n\nhttps://www.youtube.com/watch?v=a&list=b");
  assert.equal(html, "UH YEAAH!");
  assert.match(card, /href="https:\/\/www\.youtube\.com\/watch\?v=a&#38;list=b"/);
  const two = renderPost("a https://x.org/1 and https://y.org/2");
  assert.ok(!two.html.includes("x.org/1"));
  assert.match(two.html, /y\.org\/2/);
  assert.deepEqual(renderPost("no links #tag").card, "");
});

test("mentions: stored as @key, shown as @Name that opens the profile, escaped", () => {
  const a = "a".repeat(64);
  const b = "0123456789abcdef".repeat(4);
  const names: Record<string, string> = { [a]: "Pi <Chi>", [b]: "Ivvor" };
  const nameOf = (pk: string) => names[pk];
  const html = renderCaption(`hi @${a} and @${b}, #p2p`, nameOf);
  assert.match(html, new RegExp(`class="mention author-clickable" data-author="${a}"[^>]*>@Pi &#60;Chi&#62;</span>`));
  assert.match(html, />@Ivvor<\/span>, /);
  assert.match(html, /data-tag="p2p"/);
  assert.equal(renderComment(`<b> @${b}!`, nameOf), `&#60;b&#62; <span class="mention author-clickable" data-author="${b}" title="Persona: ${b}">@Ivvor</span>!`);
  assert.deepEqual(mentionsIn(`@${a} @${b} @${a} @${a}f`), [a, b]); // a longer hex run is no mention
  assert.equal(plainMentions(`hey @${b}`, nameOf), "hey @Ivvor");
  assert.equal(renderCaption("mail@" + "a".repeat(10)), "mail@" + "a".repeat(10));
});

test("mentions: picked names become keys, the longer name first", () => {
  const picks = new Map([["Ann", "k1"], ["Ann Lee", "k2"]]);
  assert.equal(namesToKeys("@Ann Lee and @Ann, not Ann", picks), "@k2 and @k1, not Ann");
});

test("inline Markdown: bold, italic, strike, code; snake_case and code stay as typed", () => {
  assert.equal(md("I wonder if **Markdown** works"), "I wonder if <strong>Markdown</strong> works");
  assert.equal(md("*a* and _b_ ~~c~~"), "<em>a</em> and <em>b</em> <del>c</del>");
  assert.equal(md("snake_case_name 2*3*4"), "snake_case_name 2*3*4");
  assert.equal(md("`**x**`"), "<code>**x**</code>");
  assert.equal(renderComment("**<b>**"), "<strong>&#60;b&#62;</strong>");
  assert.match(renderCaption("**#p2p** https://x.org/a_b_c"), /href="https:\/\/x\.org\/a_b_c"/);
});

test("chat: a River mention shows as @Name", () => {
  assert.equal(linkify("@[Scobru](rv:7D63B74P) potresti?"), `<span class="mention">@Scobru</span> potresti?`);
  assert.equal(linkify("@[<b>](rv:X1)"), `<span class="mention">@&#60;b&#62;</span>`);
});

test("caption: long contract paths get a short label, FreeTunes releases and tracks a named one", () => {
  const rel = "#/r/FhT3HnNwsKk7aa5MaGh9dtLFMcAHD8KdwYV2Sw7RVezY." + "ab".repeat(60);
  const id = "HiAQ4uXyz1234567Mqev";
  assert.match(linkify(`freenet:${id}/${rel}`), />freenet:HiAQ4u…Mqev\/♪ release<\/a>$/);
  assert.match(linkify(`freenet:${id}/${rel}/2`), />freenet:HiAQ4u…Mqev\/♪ track 3<\/a>$/);
  assert.match(linkify(`freenet:${id}/${rel}`), new RegExp(`href="[^"]+/${id}/#/r/FhT3`)); // the link itself is untouched
  assert.match(linkify(`freenet:${id}/some/very/long/path/to/a/file.txt`), />freenet:HiAQ4u…Mqev\/some\/very\/long\/path\/…<\/a>$/);
});

test("messenger chat: River and Radica mentions show as @Name, no hashtag filters, Markdown kept", () => {
  const pk = "ab".repeat(32);
  const nameOf = (k: string) => (k === pk ? "Ivvor" : k.slice(0, 8));
  assert.equal(renderChatText("@[Scobru](rv:7D63B74P) potresti?", nameOf), `<span class="mention">@Scobru</span> potresti?`);
  assert.equal(renderChatText("@[<b>](rv:X1)", nameOf), `<span class="mention">@&#60;b&#62;</span>`);
  assert.match(renderChatText(`ciao @${pk} **ok** #tag`, nameOf), /^ciao <span class="mention author-clickable" data-author="(?:ab)+"[^>]*>@Ivvor<\/span> <strong>ok<\/strong> #tag$/);
  assert.equal(plainMentions("@[Scobru](rv:7D63B74P) hi"), "@Scobru hi");
});
