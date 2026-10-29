// A post caption as HTML: text is escaped, links become anchors, #tags clickable filters, and inline Markdown is styled.
const escape = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// `freenet:<contract>[/path]` is host-agnostic: it opens on the reader's own node
const URL_RE = /(?:https?:\/\/|freenet:[1-9A-HJ-NP-Za-km-z]{8,})[^\s<>"']*/g;
const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

// hashtags are found in the raw text: after escaping, "&#60;" would look like the tag "#60"
const TAG_RE = /#([a-zA-Z0-9_\u00C0-\u017F]+)/g;
/** A mention is "@" and the persona's hex key; it shows as "@Name" (old clients show the key). */
export const MENTION_RE = /@([0-9a-f]{64})(?![0-9a-f])/g;
const TOKEN_RE = new RegExp(`${TAG_RE.source}|${MENTION_RE.source}`, "g");
export type NameOf = (pubkey: string) => string;
const keyName: NameOf = (pk) => pk.slice(0, 8);

/** The personas a text mentions, once each. */
export const mentionsIn = (t: string): string[] => [...new Set(Array.from(t.matchAll(MENTION_RE), (m) => m[1]))];
/** The text with each mention as "@Name" (for notifications and excerpts). */
export const plainMentions = (t: string, nameOf: NameOf = keyName): string => t.replace(MENTION_RE, (_, pk) => `@${nameOf(pk)}`);

const mention = (pk: string, nameOf: NameOf) =>
  `<span class="mention author-clickable" data-author="${pk}" title="Persona: ${pk}">@${escape(nameOf(pk))}</span>`;
/** Inline Markdown on escaped text: `code`, **bold**, *italic* / _italic_, ~~strike~~ (nothing inside code). */
export const md = (h: string): string =>
  h.split(/(`[^`\n]+`)/).map((part, i) => i % 2 ? `<code>${part.slice(1, -1)}</code>` : part
    .replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, "<strong>$1</strong>")
    .replace(/~~(?=\S)([^~\n]*?\S)~~/g, "<del>$1</del>")
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, "$1<em>$2</em>")).join("");
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
// a contract link, from `freenet:<id>[/path]` or any node's `/v1/contract/web/<id>[/path]`
const CONTRACT_RE = /^(?:freenet:|https?:\/\/[^/\s]+\/v[12]\/contract\/web\/)([1-9A-HJ-NP-Za-km-z]{8,})\/?([^\s]*)$/;
const short = (id: string) => (id.length > 12 ? `${id.slice(0, 6)}\u2026${id.slice(-4)}` : id);

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
function resolve(url: string): { href: string; label: string } {
  const m = CONTRACT_RE.exec(url);
  if (!m) return { href: url, label: webLabel(url) };
  const [, id, path] = m;
  return { href: `${nodeOrigin()}/v1/contract/web/${id}/${path}`, label: `freenet:${short(id)}${path ? "/" + pathLabel(path) : ""}` };
}

/** Links as anchors; the text around them goes through `text` (escaping, and for captions also #tags). */
function render(caption: string, text: (t: string) => string): string {
  let out = "";
  let last = 0;
  for (const m of caption.matchAll(URL_RE)) {
    const start = m.index!;
    const trail = TRAILING_PUNCT.exec(m[0])?.[0] ?? ""; // "see https://x.org." must not link the full stop
    const url = m[0].slice(0, m[0].length - trail.length);
    out += text(caption.slice(last, start));
    const { href, label } = resolve(url);
    out += `<a class="post-link" href="${escape(href)}" target="_blank" rel="noopener noreferrer nofollow">${escape(label)}</a>${escape(trail)}`;
    last = start + m[0].length;
  }
  return out + text(caption.slice(last));
}

export const renderCaption = (caption: string, nameOf: NameOf = keyName): string => render(caption, withTags(nameOf));
/** A comment: escaped, with mentions and Markdown (no links or tags, as before). */
export const renderComment = (text: string, nameOf: NameOf = keyName): string =>
  text.split(MENTION_RE).map((part, i) => (i % 2 ? mention(part, nameOf) : escMd(part))).join(""); // odd parts: the captured keys
// River writes a mention as "@[Name](rv:<member id>)"
const RIVER_MENTION_RE = /@\[([^\]\n]{1,64})\]\(rv:[0-9A-Za-z]+\)/g;
const chatText = (t: string) => t.split(RIVER_MENTION_RE).map((part, i) => (i % 2 ? `<span class="mention">@${escape(part)}</span>` : escape(part))).join("");
/** Chat text: escaped, with links and River mentions but no hashtag filters. */
export const linkify = (text: string): string => render(text, chatText);

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
  for (const m of caption.matchAll(URL_RE)) {
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
