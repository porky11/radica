// A post caption as HTML: text is escaped, links become anchors, #tags clickable filters, and inline Markdown is styled.
import { mediaRef } from "./media.ts";
import { escapeHtml as escape } from "./html.ts";
import { heavyUrl } from "./heavyAssets.ts";

// hashtags are found in the raw text: after escaping, "&#60;" would look like the tag "#60"
const TAG_RE = /#([a-zA-Z0-9_\u00C0-\u017F]+)/g;
/** A mention is "@" and the persona's hex key; it shows as "@Name" (old clients show the key). */
export const MENTION_RE = /@([0-9a-f]{64})(?![0-9a-f])/g;
const TOKEN_RE = new RegExp(`${TAG_RE.source}|${MENTION_RE.source}`, "g");
export type NameOf = (pubkey: string) => string;
const keyName: NameOf = (pk) => pk.slice(0, 8);
// River writes a mention as "@[Name](rv:<member id>)"
const RIVER_MENTION_RE = /@\[([^\]\n]{1,64})\]\(rv:[0-9A-Za-z]+\)/g;

/** The personas a text mentions, once each. */
export const mentionsIn = (t: string): string[] => [...new Set(Array.from(t.matchAll(MENTION_RE), (m) => m[1]))];
/** The text with each mention as "@Name" (for notifications and excerpts), River's "@[Name](rv:id)" included. */
export const plainMentions = (t: string, nameOf: NameOf = keyName): string =>
  t.replace(MENTION_RE, (_, pk) => `@${nameOf(pk)}`)
   .replace(RIVER_MENTION_RE, (_, name) => `@${name}`)
   .replace(/(?<![@!])\[([^\]\r\n]{1,256})\][ \t\r\n]*\([^)\s]+\)/g, "$1");

const mention = (pk: string, nameOf: NameOf) =>
  `<span class="mention author-clickable" data-author="${pk}" title="Persona: ${pk}">@${escape(nameOf(pk))}</span>`;

const CODE_BLOCK_RE = /(```(?:[a-zA-Z0-9_#-]+)?\r?\n?[\s\S]*?```)/g;
const QUOTE_BLOCK_RE = /(?:^|\n)((?:(?:&#62;|>)[ \t]*[^\n]+(?:\r?\n|$))+)/g;

/** Inline and block Markdown on escaped text: code blocks, blockquotes, inline `code`, **bold**, *italic* / _italic_, ~~strike~~. */
export const md = (h: string): string =>
  h.split(CODE_BLOCK_RE).map((block, bIdx) => {
    if (bIdx % 2 === 1) {
      const inner = block
        .replace(/^```(?:[a-zA-Z0-9_#-]+)?\r?\n?/, "")
        .replace(/\r?\n?```$/, "");
      return `<pre class="chat-pre"><code>${inner}</code></pre>`;
    }
    return block.split(/(`[^`\n]+`)/).map((part, i) => {
      if (i % 2 === 1) {
        return `<code>${part.slice(1, -1)}</code>`;
      }
      return part
        .replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, "<strong>$1</strong>")
        .replace(/~~(?=\S)([^~\n]*?\S)~~/g, "<del>$1</del>")
        .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, "$1<em>$2</em>")
        .replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, "$1<em>$2</em>")
        .replace(QUOTE_BLOCK_RE, (match, qb) => {
          const lines = qb
            .trimEnd()
            .split(/\r?\n/)
            .map((line: string) => line.replace(/^(?:&#62;|>)[ \t]?/, ""))
            .join("\n");
          const prefix = match.startsWith("\n") ? "\n" : "";
          const suffix = match.endsWith("\n") ? "\n" : "";
          return `${prefix}<blockquote class="chat-quote">${lines}</blockquote>${suffix}`;
        });
    }).join("");
  }).join("");

const escMd = (t: string) => md(escape(t));
const withTags = (nameOf: NameOf) => (t: string) => {
  let out = "";
  let last = 0;
  for (const m of t.matchAll(TOKEN_RE)) {
    out += escMd(t.slice(last, m.index!));
    out += m[1] !== undefined
      ? `<span class="hashtag clickable-hashtag" data-tag="${m[1]}" title="Filter by #${m[1]}">#${m[1]}</span>`
      : mention(m[2], nameOf);
    last = m.index! + m[0].length;
  }
  return out + escMd(t.slice(last));
};

/** The reader's node: this page's origin when served by a node, else the default local one. */
export function nodeOrigin(): string {
  const loc = globalThis.location;
  const onNode = loc && (loc.port === "7509" || loc.pathname.includes("/v1/contract/"));
  return onNode ? loc.origin : "http://127.0.0.1:7509";
}

// a contract link, from `freenet:<id>[/path]` or any node's `/v1/contract/web/<id>[/path]` (absolute or relative)
const CONTRACT_RE = /^(?:freenet:|(?:https?:\/\/[^/\s]+)?\/v[12]\/contract\/(?:web\/)?)([1-9A-HJ-NP-Za-km-z]{8,})\/?([^\s]*)$/;
const short = (id: string) => (id.length > 12 ? `${id.slice(0, 6)}\u2026${id.slice(-4)}` : id);

// Markdown links: [label](url), with optional spaces/newlines between ] and (
// Excludes @[Name](rv:...) (River mentions) and ![alt](url) (images) via negative lookbehind
const MD_LINK_RE = /(?<![@!])\[([^\]\r\n]{1,256})\][ \t\r\n]*\(([^)\s]+)\)/;
// Raw URLs: web links, freenet: links, or relative node contract paths
const RAW_URL_RE = /(?:https?:\/\/|freenet:[1-9A-HJ-NP-Za-km-z]{8,}|\/v[12]\/contract\/(?:web\/)?[1-9A-HJ-NP-Za-km-z]{8,})[^\s<>"']*/;
const LINK_RE = new RegExp(`(${MD_LINK_RE.source})|(${RAW_URL_RE.source})`, "g");
const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^(?:javascript|vbscript|data):/i.test(trimmed)) {
    return false;
  }
  return /^(?:https?:\/\/|freenet:[1-9A-HJ-NP-Za-km-z]{8,}|\/v[12]\/contract\/|\/|#|mailto:)/i.test(trimmed);
}

// a web link shows its host and path, without the scheme, cut when long
const webLabel = (url: string) => {
  const bare = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return bare.length > 42 ? bare.slice(0, 41) + "\u2026" : bare;
};

// a FreeTunes release page: "#/r/<release id>.<its parameters, 96+ hex>", optionally "/<track number>"
const FREETUNES_RE = /^#\/r\/[1-9A-HJ-NP-Za-km-z]+\.[0-9a-f]{96,}(?:\/(\d+))?$/;
/** A contract link's path, short: app routes carry long keys nobody reads. */
const pathLabel = (path: string) => {
  const ft = FREETUNES_RE.exec(path);
  if (ft) return ft[1] ? `\u266A track ${Number(ft[1]) + 1}` : "\u266A release";
  return path.length > 24 ? path.slice(0, 20) + "\u2026" : path;
};

/** Where a link goes and what it shows: contract links open on the reader's node and show a short id. */
function resolve(url: string, customLabel?: string): { href: string; label: string } {
  const m = CONTRACT_RE.exec(url);
  if (!m) {
    let href = url;
    if (url.startsWith("/")) {
      href = `${nodeOrigin()}${url}`;
    }
    return { href, label: customLabel ?? webLabel(url) };
  }
  const [, id, path] = m;
  return {
    href: `${nodeOrigin()}/v1/contract/web/${id}/${path}`,
    label: customLabel ?? `freenet:${short(id)}${path ? "/" + pathLabel(path) : ""}`,
  };
}

/** Links as anchors; the text around them goes through `text` (escaping, and for captions also #tags). */
function render(caption: string, text: (t: string) => string): string {
  let out = "";
  let last = 0;
  for (const m of caption.matchAll(LINK_RE)) {
    const start = m.index!;
    if (m[1] !== undefined) {
      const full = m[1];
      const label = m[2];
      const url = m[3];
      if (!isSafeUrl(url)) {
        out += text(caption.slice(last, start + full.length));
        last = start + full.length;
        continue;
      }
      out += text(caption.slice(last, start));
      const { href, label: resolvedLabel } = resolve(url, label);
      out += `<a class="post-link" href="${escape(href)}" target="_blank" rel="noopener noreferrer nofollow" title="${escape(href)}">${md(escape(resolvedLabel))}</a>`;
      last = start + full.length;
    } else if (m[4] !== undefined) {
      const raw = m[4];
      const trail = TRAILING_PUNCT.exec(raw)?.[0] ?? ""; // "see https://x.org." must not link the full stop
      const url = raw.slice(0, raw.length - trail.length);
      out += text(caption.slice(last, start));
      const { href, label } = resolve(url);
      out += `<a class="post-link" href="${escape(href)}" target="_blank" rel="noopener noreferrer nofollow">${escape(label)}</a>${escape(trail)}`;
      last = start + raw.length;
    }
  }
  return out + text(caption.slice(last));
}

export const renderCaption = (caption: string, nameOf: NameOf = keyName): string => render(caption, withTags(nameOf));
/** A comment: escaped, with mentions and Markdown (no links or tags, as before). */
const MD_IMG_RE = /!\[([^\]]*)\]\(((?:radica-media:[0-9a-f]{64}|https?:\/\/[^\s)]+|data:image\/[^\s)]+|blob:[^\s)]+|\.?\/?gifs\/[^\s)]+))\)/gi;
const STANDALONE_MEDIA_RE = /(?:^|\s)(radica-media:[0-9a-f]{64}|https?:\/\/[^\s<>"']+\.(?:gif|png|jpe?g|webp)(?:\?[^\s<>"']*)?|\.?\/?gifs\/[^\s<>"']+)(?=\s|$)/gi;
const safeUrl = (u: string) => (/^(data:image\/|https?:\/\/|blob:|\.?\/?gifs\/)/i.test(u) ? escape(heavyUrl(u)) : "");

export function extractCommentMedia(text: string): { cleanText: string; media: { alt: string; url: string }[] } {
  const media: { alt: string; url: string }[] = [];
  MD_IMG_RE.lastIndex = 0;
  let clean = (text || "").replace(MD_IMG_RE, (_, alt, url) => {
    media.push({ alt: String(alt || "").trim(), url: String(url || "").trim() });
    return "";
  });

  if (media.length === 0) {
    STANDALONE_MEDIA_RE.lastIndex = 0;
    clean = clean.replace(STANDALONE_MEDIA_RE, (match, url) => {
      media.push({ alt: "Media", url: String(url || "").trim() });
      return match.startsWith(" ") ? " " : "";
    });
  }

  return { cleanText: clean.replace(/[ \t]+/g, " ").trim(), media };
}

/** A comment: escaped, with mentions, Markdown, and embedded image/GIF support. */
export function renderComment(text: string, nameOf: NameOf = keyName): string {
  const { cleanText, media } = extractCommentMedia(text);
  const textHtml = cleanText
    ? cleanText.split(MENTION_RE).map((part, i) => (i % 2 ? mention(part, nameOf) : escMd(part))).join("")
    : "";

  const mediaHtml = media
    .map((item) => {
      const h = mediaRef(item.url);
      const attr = h ? `data-media="${h}"` : `src="${safeUrl(item.url)}"`;
      if (!attr || attr === 'src=""') return "";
      return `<div class="comment-media"><img ${attr} alt="${escape(item.alt || "Comment media")}" loading="lazy" class="comment-img" /></div>`;
    })
    .join("");

  if (textHtml && mediaHtml) {
    return `${textHtml} ${mediaHtml}`;
  }
  return textHtml || mediaHtml;
}

const chatText = (t: string) =>
  t.split(RIVER_MENTION_RE).map((part, i) => (i % 2 ? `<span class="mention">@${escape(part)}</span>` : escMd(part))).join("");
/** Chat text: escaped, with links and River mentions but no hashtag filters. */
export const linkify = (text: string): string => render(text, chatText);

const CHAT_TOKEN_RE = new RegExp(`${RIVER_MENTION_RE.source}|${MENTION_RE.source}`, "g");
const richChatText = (nameOf: NameOf) => (t: string) => {
  let out = "";
  let last = 0;
  for (const m of t.matchAll(CHAT_TOKEN_RE)) {
    out += escMd(t.slice(last, m.index!));
    out += m[1] !== undefined ? `<span class="mention">@${escape(m[1])}</span>` : mention(m[2], nameOf);
    last = m.index! + m[0].length;
  }
  return out + escMd(t.slice(last));
};
/** Chat text for the Messenger view: links, River mentions, Radica mentions (@key as @Name) and inline Markdown; no hashtag filters. */
export const renderChatText = (text: string, nameOf: NameOf = keyName): string => render(text, richChatText(nameOf));

/** A post: its caption, and a card for its first web link, whose URL then leaves the text (the card stands for it). */
export function renderPost(caption: string, nameOf: NameOf = keyName): { html: string; card: string } {
  const card = linkCard(caption);
  if (!card) return { html: renderCaption(caption, nameOf), card };
  const url = /href="([^"]+)"/.exec(card)![1].replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  const text = caption.replace(url, "").replace(/[ \t]+\n/g, "\n").trimEnd();
  return { html: renderCaption(text, nameOf), card };
}

/** A card for the first web link of a post (site and a call to open it): Freenet's CSP allows no embeds or previews. */
export function linkCard(caption: string): string {
  // Markdown links are inline links with explicit labels; only standalone raw web links get an external card preview.
  const withoutMd = caption.replace(new RegExp(MD_LINK_RE.source, "g"), "");
  for (const m of withoutMd.matchAll(new RegExp(RAW_URL_RE.source, "g"))) {
    const url = m[0].replace(TRAILING_PUNCT, "");
    if (CONTRACT_RE.test(url) || !/^https?:\/\//.test(url)) continue;
    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    const video = /(^|\.)(youtube\.com|youtu\.be)$/.test(host);
    return `<a class="link-card" href="${escape(url)}" target="_blank" rel="noopener noreferrer nofollow"><span class="link-card-icon" aria-hidden="true">${video ? "\u25B6" : "\u2197"}</span><span class="link-card-text"><span class="link-card-host">${escape(host)}</span><span class="link-card-title">${video ? "Watch on YouTube" : "Open link"}</span></span></a>`;
  }
  return "";
}
