// The HTML helpers every view builds its strings with. One copy: escaping is what keeps other people's text from
// running as markup in our page.

/** Escapes text for both element content and quoted attribute values. */
export function escapeHtml(text: unknown): string {
  return String(text ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Image URLs from other users: only images, https and blob URLs (no javascript: and the like), escaped. */
export function safeUrl(u: string | undefined): string {
  return u && /^(data:image\/|https?:\/\/|blob:)/i.test(u) ? escapeHtml(u) : "";
}

/** A long key as its first and last six characters. */
export function shortenKey(k: string): string {
  if (k.length <= 12) return k;
  return `${k.substring(0, 6)}...${k.substring(k.length - 6)}`;
}
