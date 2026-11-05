// Asocial game integration (gitlab.com/porky11/asocial) for Radica.
// Asocial is a decentralized platform for small browser and HTML5/WASM games on Freenet.
// Games run as web contracts on the reader's node (/v1/contract/web/<key>/) and can be played
// directly inside Radica posts and linked to user profiles.
import { escapeHtml as esc } from "./html.ts";
import { defaultNodeOrigin } from "./orto.ts";

/** Asocial's portal web app contract on Freenet. */
export const ASOCIAL_SITE = "BhhLhAiMAcZaSEJ31Zwri59D3F3E112DY6w3J51iLJT9";
export const ASOCIAL_REPO = "https://gitlab.com/porky11/asocial";

const BS58_ID = "[1-9A-HJ-NP-Za-km-z]{20,60}";

// Patterns to detect Asocial works/games in captions:
// 1) #work/<publisher>/<title> or #/work/... or #asocial/work/... or full node url with #work/...
const WORK_HASH_RE = new RegExp(`(?:#\\/?work\\/|#\\/?asocial(?:-work)?\\/|\\/v1\\/contract\\/web\\/[^/\\s]+\\/#\\/?work\\/)(${BS58_ID})\\/([^?\\s#]+)(?:\\?([^\\s]+))?`, "i");

// 2) Explicit direct asocial game web app contract: #asocial-game/<contractKey> or #game/<contractKey>
const GAME_CONTRACT_RE = new RegExp(`(?:#\\/?asocial-game\\/|#\\/?game\\/)(${BS58_ID})(?:\\?([^\\s]+))?`, "i");

// 3) Person / profile links: #person/<key> or #/person/<key>
const PERSON_HASH_RE = new RegExp(`(?:#\\/?person\\/|#\\/?asocial-person\\/|\\/v1\\/contract\\/web\\/[^/\\s]+\\/#\\/?person\\/)(${BS58_ID})`, "i");
const RAW_KEY_RE = new RegExp(`^(${BS58_ID}|[0-9a-fA-F]{64})$`);

export interface AsocialWorkRef {
  raw: string;
  publisher?: string;
  title: string;
  siteKey?: string;
  params?: string;
}

/** Detect an Asocial game or work link inside a post caption. */
export function asocialLink(caption: string): AsocialWorkRef | null {
  if (!caption) return null;

  const mWork = WORK_HASH_RE.exec(caption);
  if (mWork) {
    const rawTitle = mWork[2];
    const decodedTitle = (() => {
      try {
        return decodeURIComponent(rawTitle);
      } catch {
        return rawTitle;
      }
    })();
    return {
      raw: mWork[0],
      publisher: mWork[1],
      title: decodedTitle,
      params: mWork[3],
    };
  }

  const mGame = GAME_CONTRACT_RE.exec(caption);
  if (mGame) {
    return {
      raw: mGame[0],
      siteKey: mGame[1],
      title: "Asocial Game",
      params: mGame[2],
    };
  }

  return null;
}

/** Parse an Asocial author or person key from an input string or URL. */
export function asocialPersonOf(input: string): string | null {
  const s = input.trim();
  const m = PERSON_HASH_RE.exec(s);
  if (m) return m[1];
  return RAW_KEY_RE.test(s) ? s : null;
}

/** Helper to shorten a base58 or hex key for display. */
function shortKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 6)}…${key.slice(-6)}`;
}

/** Get the external URL to open an Asocial work on the node's portal or fallback to repo. */
export function asocialWorkHref(work: AsocialWorkRef, origin = defaultNodeOrigin()): string {
  if (ASOCIAL_SITE) {
    if (work.publisher && work.title) {
      return `${origin}/v1/contract/web/${ASOCIAL_SITE}/#work/${work.publisher}/${encodeURIComponent(work.title)}${work.params ? `?${work.params}` : ""}`;
    }
    if (work.siteKey) {
      return `${origin}/v1/contract/web/${work.siteKey}/`;
    }
  }
  if (work.siteKey) {
    return `${origin}/v1/contract/web/${work.siteKey}/`;
  }
  if (work.publisher && work.title) {
    return `https://p11c.xyz/asocial/#work/${work.publisher}/${encodeURIComponent(work.title)}${work.params ? `?${work.params}` : ""}`;
  }
  return ASOCIAL_REPO;
}

/** Get the link to an Asocial author profile. */
export function asocialPersonHref(key: string, origin = defaultNodeOrigin()): string {
  const cleanKey = asocialPersonOf(key) || key;
  if (ASOCIAL_SITE) {
    return `${origin}/v1/contract/web/${ASOCIAL_SITE}/#person/${cleanKey}`;
  }
  return `https://p11c.xyz/asocial/#person/${cleanKey}`;
}

/** The placeholder card rendered inside a Radica post. */
export function asocialCard(caption: string, origin = defaultNodeOrigin()): string {
  const work = asocialLink(caption);
  if (!work) return "";

  const openHref = asocialWorkHref(work, origin);
  const cleanTitle = work.title.replace(/[-_]/g, " ");

  return (
    `<div class="asocial-card" ` +
      `data-title="${esc(work.title)}" ` +
      (work.publisher ? `data-publisher="${esc(work.publisher)}" ` : "") +
      (work.siteKey ? `data-site="${esc(work.siteKey)}" ` : "") +
      (work.params ? `data-params="${esc(work.params)}" ` : "") +
    `>` +
      `<div class="asocial-card-head">` +
        `<span class="asocial-badge">&#x1F3AE; Asocial Game</span>` +
        (work.publisher ? `<span class="asocial-pubkey">by ${esc(shortKey(work.publisher))}</span>` : "") +
      `</div>` +
      `<div class="asocial-card-body">` +
        `<div class="asocial-card-icon" aria-hidden="true">&#x1F579;&#xFE0F;</div>` +
        `<div class="asocial-card-info">` +
          `<div class="asocial-card-title">${esc(cleanTitle)}</div>` +
          `<div class="asocial-card-desc">Decentralized HTML5 game on Freenet</div>` +
        `</div>` +
        `<button type="button" class="asocial-play-btn btn-primary btn-sm" aria-label="Play ${esc(cleanTitle)}">` +
          `&#x25B6; Play in Radica` +
        `</button>` +
      `</div>` +
      `<div class="asocial-card-footer">` +
        `<a class="asocial-ext-link" href="${esc(openHref)}" target="_blank" rel="noopener noreferrer">` +
          `Open in Asocial &nearr;` +
        `</a>` +
      `</div>` +
    `</div>`
  );
}

/** Initialize all Asocial cards under root, attaching iframe player and control handshake. */
export function fillAsocial(root: ParentNode, origin = defaultNodeOrigin()): void {
  root.querySelectorAll<HTMLElement>(".asocial-card:not([data-initialized])").forEach((card) => {
    card.dataset.initialized = "true";
    const playBtn = card.querySelector<HTMLButtonElement>(".asocial-play-btn");
    if (!playBtn) return;

    playBtn.addEventListener("click", () => {
      const title = card.dataset.title || "Asocial Game";
      const publisher = card.dataset.publisher;
      const siteKey = card.dataset.site;
      const params = card.dataset.params || "";

      // Determine game source URL for iframe:
      let gameUrl = "";
      if (siteKey) {
        gameUrl = `${origin}/v1/contract/web/${siteKey}/${params ? `?${params}` : ""}`;
      } else if (ASOCIAL_SITE && publisher) {
        gameUrl = `${origin}/v1/contract/web/${ASOCIAL_SITE}/#work/${publisher}/${encodeURIComponent(title)}${params ? `?${params}` : ""}`;
      } else {
        // Direct link or fallback
        gameUrl = `${origin}/v1/contract/web/${publisher || ""}/`;
      }

      const initialHtml = card.innerHTML;
      const cleanTitle = title.replace(/[-_]/g, " ");

      card.innerHTML =
        `<div class="asocial-player-wrap">` +
          `<div class="asocial-player-toolbar">` +
            `<span class="asocial-player-title">&#x1F3AE; <b>${esc(cleanTitle)}</b></span>` +
            `<div class="asocial-player-actions">` +
              `<button type="button" class="asocial-tool-btn asocial-pause-btn" title="Pause / Resume" aria-label="Pause">&#x23EF;</button>` +
              `<button type="button" class="asocial-tool-btn asocial-mute-btn" title="Mute / Unmute" aria-label="Mute">&#x1F50A;</button>` +
              `<button type="button" class="asocial-tool-btn asocial-fs-btn" title="Toggle Fullscreen" aria-label="Fullscreen">&#x26F6;</button>` +
              `<button type="button" class="asocial-tool-btn asocial-close-btn" title="Close Game" aria-label="Close">&#x2715;</button>` +
            `</div>` +
          `</div>` +
          `<iframe ` +
            `class="asocial-iframe" ` +
            `src="${esc(gameUrl)}" ` +
            `sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms" ` +
            `allow="autoplay; gamepad; fullscreen" ` +
            `title="${esc(cleanTitle)}"` +
          `></iframe>` +
        `</div>`;

      const wrap = card.querySelector<HTMLElement>(".asocial-player-wrap")!;
      const iframe = card.querySelector<HTMLIFrameElement>(".asocial-iframe")!;
      const pauseBtn = card.querySelector<HTMLButtonElement>(".asocial-pause-btn")!;
      const muteBtn = card.querySelector<HTMLButtonElement>(".asocial-mute-btn")!;
      const fsBtn = card.querySelector<HTMLButtonElement>(".asocial-fs-btn")!;
      const closeBtn = card.querySelector<HTMLButtonElement>(".asocial-close-btn")!;

      let isPaused = false;
      let isMuted = false;

      // Asocial player controls handshake:
      // When the game iframe announces `{ asocial: "controls", supports: ["pause", "volume", "speed"] }`
      const onMessage = (ev: MessageEvent) => {
        if (ev.source !== iframe.contentWindow) return;
        if (ev.data && typeof ev.data === "object" && ev.data.asocial === "controls") {
          // Handshake initial volume
          iframe.contentWindow?.postMessage(
            { asocial: "control", control: "volume", value: isMuted ? 0.0 : 1.0 },
            "*"
          );
        }
      };
      window.addEventListener("message", onMessage);

      pauseBtn.onclick = () => {
        isPaused = !isPaused;
        pauseBtn.innerHTML = isPaused ? "&#x25B6;" : "&#x23EF;";
        iframe.contentWindow?.postMessage(
          { asocial: "control", control: isPaused ? "pause" : "resume" },
          "*"
        );
      };

      muteBtn.onclick = () => {
        isMuted = !isMuted;
        muteBtn.innerHTML = isMuted ? "&#x1F507;" : "&#x1F50A;";
        iframe.contentWindow?.postMessage(
          { asocial: "control", control: "volume", value: isMuted ? 0.0 : 1.0 },
          "*"
        );
      };

      fsBtn.onclick = () => {
        if (!document.fullscreenElement) {
          void wrap.requestFullscreen?.().catch(() => {});
        } else {
          void document.exitFullscreen?.().catch(() => {});
        }
      };

      closeBtn.onclick = () => {
        window.removeEventListener("message", onMessage);
        // Clear iframe to kill audio and process
        iframe.src = "about:blank";
        card.innerHTML = initialHtml;
        card.removeAttribute("data-initialized");
        fillAsocial(card.parentElement || card, origin);
      };
    });
  });
}

/** Render the Asocial profile section for user profile modal. */
export function asocialProfileCard(pubkey: string, asocialKey: string, origin = defaultNodeOrigin()): string {
  const href = asocialPersonHref(asocialKey, origin);
  return (
    `<div class="blog-card asocial-profile-card">` +
      `<a class="blog-card-head" href="${esc(href)}" target="_blank" rel="noopener noreferrer">` +
        `<span class="link-card-icon" aria-hidden="true">&#x1F3AE;</span>` +
        `<span class="link-card-text">` +
          `<span class="link-card-host">Asocial Games Profile</span>` +
          `<span class="link-card-title">@${esc(shortKey(asocialKey))}</span>` +
          `<span class="blog-card-desc">Creator & player on Asocial (HTML5 games on Freenet)</span>` +
        `</span>` +
        `<span class="blog-card-open" aria-hidden="true">&nearr;</span>` +
      `</a>` +
    `</div>`
  );
}
