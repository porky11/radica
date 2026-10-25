// A post caption as HTML: text is escaped, links become anchors and #tags clickable filters.
const escape = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// `freenet:<contract>[/path]` is host-agnostic: it opens on the reader's own node
const URL_RE = /(?:https?:\/\/|freenet:[1-9A-HJ-NP-Za-km-z]{8,})[^\s<>"']*/g;
const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

// hashtags are found in the raw text: after escaping, "&#60;" would look like the tag "#60"
const TAG_RE = /#([a-zA-Z0-9_\u00C0-\u017F]+)/g;
const withTags = (t: string) => {
  let out = "";
  let last = 0;
  for (const m of t.matchAll(TAG_RE)) {
    out += escape(t.slice(last, m.index!)) + `<span class="hashtag clickable-hashtag" data-tag="${m[1]}" title="Filter by #${m[1]}">#${m[1]}</span>`;
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

/** Where a link goes and what it shows: contract links open on the reader's node and show a short id. */
function resolve(url: string): { href: string; label: string } {
  const m = CONTRACT_RE.exec(url);
  if (!m) return { href: url, label: url };
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

export const renderCaption = (caption: string): string => render(caption, withTags);
/** Chat text: escaped, with links but no hashtag filters. */
export const linkify = (text: string): string => render(text, escape);
