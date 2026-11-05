// The Freenet apps Radica works with, and how to support its development: a quiet footer in the right panel and a
// card on the Updates page. Apps with a known site key open on the reader's own node; the others on their repository.
import { FREEPOLLS_SITE } from "./freepolls.ts";
import { FREENAMES_KEY } from "./freenames.ts";
import { DELTA_WEB } from "./delta.ts";
import { VISO_KEY } from "./whoiam.ts";
import { FREETUNES_SITE } from "./freetunes.ts";
import { ASOCIAL_SITE, ASOCIAL_REPO } from "./asocial.ts";
import { escapeHtml as esc } from "./html.ts";

export const SUPPORT_URL = "https://buymeacoffee.com/scobru";
export const ORTO_SITE = "9eBjDkH6ZXA6ehUyWBBjT6Xg4tQE4ALZjSsgXERds4yZ";

export interface EcosystemApp {
  name: string;
  what: string;
  /** Site key on Freenet (opens on the reader's node), when known. */
  key?: string;
  /** Repository, used when there is no site key. */
  repo: string;
}

export const ECOSYSTEM: EcosystemApp[] = [
  { name: "River", what: "group chat; Radica's private rooms are River rooms", repo: "https://github.com/freenet/river" },
  { name: "Viso", what: "identity and sign-in", key: VISO_KEY, repo: "https://github.com/scobru/viso" },
  { name: "FreeTunes", what: "music releases, played inside posts", key: FREETUNES_SITE, repo: "https://github.com/scobru/freetunes" },
  { name: "FreePolls", what: "anonymous polls in posts and chat", key: FREEPOLLS_SITE, repo: "https://github.com/scobru/freepolls" },
  { name: "FreeNames", what: "short names, profile sites and resolved links in posts", key: FREENAMES_KEY, repo: "https://github.com/scobru/freenames" },
  { name: "Delta", what: "blogs linked from profiles", key: DELTA_WEB, repo: "https://github.com/freenet/delta" },
  { name: "Orto", what: "encrypted organizer; reads your Radica feed in its Feeds tab", key: ORTO_SITE, repo: "https://github.com/scobru/orto" },
  { name: "Asocial", what: "browser & HTML5 games, played inside posts", key: ASOCIAL_SITE, repo: ASOCIAL_REPO },
];

const hrefOf = (app: EcosystemApp, origin: string) => (app.key ? `${origin}/v1/contract/web/${app.key}/#/` : app.repo);
const link = (href: string, label: string, cls: string, title = "") =>
  `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer"${title ? ` title="${esc(title)}"` : ""}>${esc(label)}</a>`;

/** One quiet line under the right panel: the apps, then the support link. */
export function ecosystemFooter(origin: string): string {
  const apps = ECOSYSTEM.map((a) => link(hrefOf(a, origin), a.name, "eco-link", a.what)).join(`<span aria-hidden="true"> · </span>`);
  return `<div>Built on Freenet with ${apps}</div><div>${link(SUPPORT_URL, "\u2615 Support Radica", "eco-link eco-support")}</div>`;
}

/** The longer version for the Updates page: what each app does, and the support link. */
export function ecosystemCard(origin: string): string {
  const rows = ECOSYSTEM.map(
    (a) => `<li>${link(hrefOf(a, origin), a.name, "eco-name")} <span class="eco-what">${esc(a.what)}</span></li>`
  ).join("");
  return `<h4>Works with</h4><ul class="eco-list">${rows}</ul>
    <p class="eco-note">Radica is built and maintained independently. If it is useful to you, you can support its development.</p>
    ${link(SUPPORT_URL, "\u2615 Buy me a coffee", "btn-secondary btn-sm eco-support-btn")}`;
}
