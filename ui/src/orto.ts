// Orto blog integration (github.com/scobru/orto) for Radica.
// Orto public blog posts on Freenet are replicated via its vault contract
// (orto_vault.wasm, parameterized by Viso persona or key) or shared as #fblog=<payload> links.
import { ContractKey } from "@freenetorg/freenet-stdlib";
import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex, hexToBytes } from "./crypto.ts";
import { escapeHtml as escape } from "./html.ts";

export const ORTO_SITE = "9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ";
export const ORTO_PATH = `/v1/contract/web/${ORTO_SITE}/`;
export const ORTO_VAULT_CODE_HASH = "9dc54994277db1a9add692c946bdbcb0d212e373c60b3c38b5e9a584c6a6ecee";

export interface OrtoPost {
  id: string;
  title: string;
  content: string;
  tags?: string[] | string;
  author?: string;
  authorAlias?: string;
  createdAt?: number;
}

export interface OrtoBlog {
  title: string;
  author: string;
  posts: OrtoPost[];
  url?: string;
}

export function decodeB64u(str: string): string {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeB64u(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Clean Markdown to a plain-text excerpt for preview cards. */
export function cleanExcerpt(md: string, maxLength = 160): string {
  if (!md) return "";
  const plain = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/[*_`~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLength ? plain.slice(0, maxLength - 1) + "…" : plain;
}

export function defaultNodeOrigin(): string {
  const loc = globalThis.location;
  const onNode = loc && (loc.port === "7509" || loc.pathname?.includes("/v1/contract/"));
  return onNode ? loc.origin : "http://127.0.0.1:7509";
}

/** Compute the Freenet contract key for an Orto vault derived from a Viso persona (32-byte hex). */
export async function ortoVaultKey(personaHex: string): Promise<ContractKey> {
  const personaBytes = hexToBytes(personaHex);
  const saltDigest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode("orto-vault-v1|viso|" + personaHex))
  );
  const saltBytes = saltDigest.slice(0, 16);
  const appPathBytes = new TextEncoder().encode(ORTO_PATH);
  const params = new Uint8Array([...personaBytes, ...saltBytes, ...appPathBytes]);
  const codeHash = hexToBytes(ORTO_VAULT_CODE_HASH);
  const instance = blake3(new Uint8Array([...codeHash, ...params]));
  return new ContractKey(instance, codeHash);
}

/** Parse public blog posts from an Orto vault state JSON. */
export function parseOrtoVaultPosts(stateBytes: Uint8Array): OrtoPost[] {
  try {
    const json = JSON.parse(new TextDecoder().decode(stateBytes));
    const records = json?.records;
    if (!records || typeof records !== "object") return [];
    const posts: OrtoPost[] = [];
    for (const [k, r] of Object.entries<any>(records)) {
      if (!k.startsWith("posts:") || r.deleted) continue;
      try {
        const p = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
        if (typeof p?.title === "string") {
          posts.push({
            id: p.id || k.slice(6),
            title: p.title,
            content: typeof p.content === "string" ? p.content : "",
            tags: p.tags,
            author: p.authorAlias || p.author || "Author",
            authorAlias: p.authorAlias,
            createdAt: Number(p.createdAt) || Number(r.updated_at) || 0,
          });
        }
      } catch {}
    }
    return posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch {
    return [];
  }
}

/** Generate a direct Orto Freenet URL to open a specific blog post via #fblog hash. */
export function ortoPostHref(origin: string, post: OrtoPost): string {
  const data = {
    id: post.id,
    title: post.title,
    content: post.content,
    tags: post.tags,
    author: post.authorAlias || post.author || "Author",
    createdAt: post.createdAt,
  };
  const payload = encodeB64u(JSON.stringify(data));
  return `${origin}/v1/contract/web/${ORTO_SITE}/#fblog=${payload}`;
}

const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

/** Parse an Orto blog URI or hash from what the user posts. */
export function parseOrtoUri(input: string): { post?: OrtoPost; isOrtoSite?: boolean; rawUrl: string } | null {
  const s = input.trim();
  const fblogIdx = s.indexOf("#fblog=");
  if (fblogIdx !== -1) {
    const rawPayload = s.slice(fblogIdx + 7).split("&")[0];
    try {
      const data = JSON.parse(decodeB64u(rawPayload));
      if (data && typeof data === "object") {
        return {
          post: {
            id: String(data.id || "post"),
            title: String(data.title || "Untitled"),
            content: String(data.content || ""),
            tags: data.tags,
            author: String(data.author || data.authorAlias || "Author"),
            createdAt: Number(data.createdAt) || 0,
          },
          rawUrl: s,
        };
      }
    } catch {}
  }
  if (s.includes(ORTO_SITE)) {
    return { isOrtoSite: true, rawUrl: s };
  }
  return null;
}

/** Detect an Orto blog link in a caption. */
export function ortoInCaption(caption: string): { post?: OrtoPost; isOrtoSite?: boolean; rawUrl: string } | null {
  // Matches #fblog=... links or Orto contract web links
  const re = /(?:https?:\/\/[^\s<>"']+|freenet:[^\s<>"']+|\/v[12]\/contract\/[^\s<>"']*)?(?:#fblog=[A-Za-z0-9_-]+|9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ[^\s<>"']*)/gi;
  const m = re.exec(caption);
  if (!m) return null;
  const cleaned = m[0].replace(TRAILING_PUNCT, "");
  return parseOrtoUri(cleaned);
}

/** Render an embedded Orto blog preview card if the caption contains an Orto blog link. */
export function ortoCard(caption: string, origin = defaultNodeOrigin()): string {
  const match = ortoInCaption(caption);
  if (!match) return "";

  if (match.post) {
    const p = match.post;
    const href = ortoPostHref(origin, p);
    const excerpt = cleanExcerpt(p.content, 180);
    const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "";
    const tagsStr = p.tags ? (Array.isArray(p.tags) ? p.tags.join(", ") : String(p.tags)) : "";

    return (
      `<div class="orto-card blog-post-card">` +
        `<div class="blog-embed-card">` +
          `<div class="blog-embed-head">` +
            `<span class="blog-badge orto-badge">&#x1F331; Orto Blog</span>` +
            `<span class="blog-embed-sitename">${escape(p.author || "Author")}'s Blog</span>` +
          `</div>` +
          `<a class="blog-embed-title" href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(p.title || "Untitled")}</a>` +
          (excerpt ? `<p class="blog-embed-excerpt">${escape(excerpt)}</p>` : "") +
          `<div class="blog-embed-footer">` +
            `<span class="blog-embed-meta">${escape(dateStr)}${tagsStr ? ` &middot; #${escape(tagsStr)}` : ""}</span>` +
            `<a class="blog-embed-btn btn-secondary btn-sm" href="${escape(href)}" target="_blank" rel="noopener noreferrer">Read on Orto &nearr;</a>` +
          `</div>` +
        `</div>` +
      `</div>`
    );
  }

  if (match.isOrtoSite) {
    const href = `${origin}/v1/contract/web/${ORTO_SITE}/#/`;
    return (
      `<div class="orto-card blog-post-card">` +
        `<div class="blog-embed-card">` +
          `<div class="blog-embed-head">` +
            `<span class="blog-badge orto-badge">&#x1F331; Orto</span>` +
          `</div>` +
          `<a class="blog-embed-title" href="${escape(href)}" target="_blank" rel="noopener noreferrer">Orto Workspace &amp; Blog</a>` +
          `<p class="blog-embed-excerpt">Encrypted notes, tasks, calendar, bookmarks, and public blog on Freenet.</p>` +
          `<div class="blog-embed-footer">` +
            `<a class="blog-embed-btn btn-secondary btn-sm" href="${escape(href)}" target="_blank" rel="noopener noreferrer">Open Orto &nearr;</a>` +
          `</div>` +
        `</div>` +
      `</div>`
    );
  }

  return "";
}

/** Hydrate any asynchronous Orto cards if needed. */
export function fillOrto(_root: ParentNode): void {
  // Synchronous fblog cards are self-contained; hook for future dynamic fetching
}

