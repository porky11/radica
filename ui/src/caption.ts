// A post caption as HTML: text is escaped, links become anchors and #tags clickable filters.
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
const withTags = (nameOf: NameOf) => (t: string) => {
  let out = "";
  let last = 0;
  for (const m of t.matchAll(TOKEN_RE)) {
    out += escape(t.slice(last, m.index!));
    out += m[1] !== undefined
      ? `<span class="hashtag clickable-hashtag" data-tag="${m[1]}" title="Filter by #${m[1]}">#${m[1]}</span>`
      : mention(m[2], nameOf);
    last = m.index! + m[0].length;
  }
  return out + escape(t.slice(last));
};

/** The reader's node: this page's origin when served by a node, else the default local one. */
function nodeOrigin(): string {
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

/** Where a link goes and what it shows: contract links open on the reader's node and show a short id. */
function resolve(url: string): { href: string; label: string } {
  const m = CONTRACT_RE.exec(url);
  if (!m) return { href: url, label: webLabel(url) };
  const [, id, path] = m;
  return { href: `${nodeOrigin()}/v1/contract/web/${id}/${path}`, label: `freenet:${short(id)}${path ? "/" + path : ""}` };
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
/** A comment: escaped, with mentions (no links or tags, as before). */
export const renderComment = (text: string, nameOf: NameOf = keyName): string =>
  text.split(MENTION_RE).map((part, i) => (i % 2 ? mention(part, nameOf) : escape(part))).join(""); // odd parts: the captured keys
/** Chat text: escaped, with links but no hashtag filters. */
export const linkify = (text: string): string => render(text, escape);

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
