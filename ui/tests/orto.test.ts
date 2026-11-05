import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeB64u,
  encodeB64u,
  cleanExcerpt,
  ortoPostHref,
  parseOrtoUri,
  ortoInCaption,
  ortoCard,
  ortoVaultKey,
  parseOrtoVaultPosts,
  ORTO_SITE,
} from "../src/orto.ts";

test("orto: base64url encode and decode roundtrip", () => {
  const original = JSON.stringify({ id: "p1", title: "Test Post", content: "Markdown body" });
  const encoded = encodeB64u(original);
  const decoded = decodeB64u(encoded);
  assert.equal(decoded, original);
  assert.deepEqual(JSON.parse(decoded), { id: "p1", title: "Test Post", content: "Markdown body" });
});

test("orto: cleanExcerpt strips markdown formatting and truncates", () => {
  const md = "# Heading 1\n\nThis is **bold** and _italic_ with a [link](https://example.com) and an ![image](img.png).\n> Quote text\n`code` snippet.";
  const excerpt = cleanExcerpt(md, 100);
  assert.ok(!excerpt.includes("#"));
  assert.ok(!excerpt.includes("*"));
  assert.ok(!excerpt.includes("img.png"));
  assert.ok(excerpt.includes("This is bold and italic with a link"));
  assert.ok(excerpt.includes("Quote text"));
  assert.ok(excerpt.includes("code snippet"));
});

test("orto: parseOrtoUri and ortoInCaption from fblog link", () => {
  const post = {
    id: "post-101",
    title: "Decentralized Musings",
    content: "Writing notes on Freenet with Orto.",
    tags: ["freenet", "orto"],
    author: "scobru",
    createdAt: 1730790000000,
  };
  const url = `http://127.0.0.1:7509/v1/contract/web/${ORTO_SITE}/#fblog=${encodeB64u(JSON.stringify(post))}`;
  const parsed = parseOrtoUri(url);
  assert.ok(parsed?.post);
  assert.equal(parsed?.post?.id, "post-101");
  assert.equal(parsed?.post?.title, "Decentralized Musings");
  assert.equal(parsed?.post?.author, "scobru");

  const caption = `Hey everyone! I just published a new article: ${url} check it out!`;
  const found = ortoInCaption(caption);
  assert.ok(found?.post);
  assert.equal(found?.post?.title, "Decentralized Musings");

  const cardHtml = ortoCard(caption);
  assert.ok(cardHtml.includes("orto-card"));
  assert.ok(cardHtml.includes("Decentralized Musings"));
  assert.ok(cardHtml.includes("Orto Blog"));
  assert.ok(cardHtml.includes("Read on Orto"));
  assert.ok(cardHtml.includes("post-link"));

  // Also handles #/fblog= and freenet: URLs
  const slashUrl = `freenet:${ORTO_SITE}/#/fblog=${encodeB64u(JSON.stringify(post))}`;
  const slashParsed = parseOrtoUri(slashUrl);
  assert.ok(slashParsed?.post);
  assert.equal(slashParsed?.post?.title, "Decentralized Musings");
});

test("orto: ortoVaultKey derives deterministic contract key", async () => {
  const persona = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const key = await ortoVaultKey(persona);
  assert.ok(key);
  assert.equal(typeof key.encode(), "string");
  assert.ok(key.encode().length > 30);
});

test("orto: parseOrtoVaultPosts parses public posts from vault state", () => {
  const vault = {
    updated_at: 1730790000000,
    records: {
      "posts:p-1": {
        data: JSON.stringify({ id: "p-1", title: "First Post", content: "Hello world", authorAlias: "alice", createdAt: 100 }),
        updated_at: 100,
        deleted: false,
      },
      "posts:p-2": {
        data: JSON.stringify({ id: "p-2", title: "Second Post", content: "More updates", authorAlias: "alice", createdAt: 200 }),
        updated_at: 200,
        deleted: false,
      },
      "posts:p-deleted": {
        data: JSON.stringify({ id: "p-deleted", title: "Old Post" }),
        updated_at: 150,
        deleted: true,
      },
      "notes:n-1": {
        data: "encrypted-ciphertext",
        updated_at: 150,
      },
    },
  };
  const bytes = new TextEncoder().encode(JSON.stringify(vault));
  const posts = parseOrtoVaultPosts(bytes);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].id, "p-2"); // Newest first
  assert.equal(posts[0].title, "Second Post");
  assert.equal(posts[1].id, "p-1");
  assert.equal(posts[1].title, "First Post");
});

