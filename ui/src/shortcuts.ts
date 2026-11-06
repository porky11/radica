// Radica Keyboard Shortcuts System
// Provides complete keyboard navigation and actions across feed, posts, composer, FreeTunes audio, and chat.

import { hasOpenModal } from "./modals.ts";

export interface ShortcutItem {
  keyLabel: string;
  category: "Navigation" | "Feed & Posts" | "Actions & Composing" | "Media & Audio" | "Chat & Messaging" | "General";
  description: string;
}

export const SHORTCUTS_LIST: ShortcutItem[] = [
  // Navigation
  { keyLabel: "g h", category: "Navigation", description: "Go to Home / Feed" },
  { keyLabel: "g c / g m", category: "Navigation", description: "Go to Direct Messages / Chat" },
  { keyLabel: "g n", category: "Navigation", description: "Go to Notifications & Activity" },
  { keyLabel: "g i", category: "Navigation", description: "Go to Identity & Keys" },
  { keyLabel: "g p", category: "Navigation", description: "Go to My Posts" },
  { keyLabel: "g s", category: "Navigation", description: "Go to Saved Posts" },
  { keyLabel: "g u", category: "Navigation", description: "Go to What's New" },
  { keyLabel: "g g", category: "Navigation", description: "Go to Greenhouse" },
  { keyLabel: "g b", category: "Navigation", description: "Go to Blocklists & Moderation" },
  { keyLabel: "?", category: "Navigation", description: "Open Keyboard Shortcuts Help" },

  // Feed & Posts
  { keyLabel: "j / ↓", category: "Feed & Posts", description: "Next post in feed" },
  { keyLabel: "k / ↑", category: "Feed & Posts", description: "Previous post in feed" },
  { keyLabel: "l", category: "Feed & Posts", description: "Like / Unlike selected post" },
  { keyLabel: "d", category: "Feed & Posts", description: "Dislike / Remove dislike on selected post" },
  { keyLabel: "s", category: "Feed & Posts", description: "Save / Bookmark selected post" },
  { keyLabel: "c / r", category: "Feed & Posts", description: "Reply / Comment on selected post" },
  { keyLabel: "o / Enter", category: "Feed & Posts", description: "Expand / Toggle comments on selected post" },
  { keyLabel: "x", category: "Feed & Posts", description: "Open more actions menu on selected post" },
  { keyLabel: "v", category: "Feed & Posts", description: "Reveal sensitive / NSFW media on selected post" },

  // Actions & Composing
  { keyLabel: "/", category: "Actions & Composing", description: "Focus feed search input" },
  { keyLabel: "n", category: "Actions & Composing", description: "New post (focus post caption composer)" },
  { keyLabel: "Ctrl + Enter", category: "Actions & Composing", description: "Plant post (composer) or Send comment" },
  { keyLabel: ".", category: "Actions & Composing", description: "Refresh feed" },

  // Media & Audio
  { keyLabel: "Space", category: "Media & Audio", description: "Play / Pause FreeTunes audio" },
  { keyLabel: "]", category: "Media & Audio", description: "Next track in FreeTunes playlist" },
  { keyLabel: "[", category: "Media & Audio", description: "Previous track in FreeTunes playlist" },
  { keyLabel: "Shift + M", category: "Media & Audio", description: "Mute / Unmute audio" },

  // Chat & Messaging
  { keyLabel: "Alt + ↓ / Alt + j", category: "Chat & Messaging", description: "Next conversation in chat inbox" },
  { keyLabel: "Alt + ↑ / Alt + k", category: "Chat & Messaging", description: "Previous conversation in chat inbox" },

  // General
  { keyLabel: "Esc", category: "General", description: "Close popup / Blur input / Clear selection" },
];

/** Check if the event target is an interactive text input where shortcuts must not fire. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as any;
  if (typeof HTMLElement !== "undefined" && !(el instanceof HTMLElement)) return false;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  if (tag === "input") {
    const type = (el.type || "").toLowerCase();
    const nonTextTypes = ["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image"];
    return !nonTextTypes.includes(type);
  }
  return false;
}

let gotoActive = false;
let gotoTimer: ReturnType<typeof setTimeout> | null = null;

export function isGotoActive(): boolean {
  return gotoActive;
}

export function showGotoHud(visible: boolean, customText?: string): void {
  gotoActive = visible;
  if (gotoTimer) {
    clearTimeout(gotoTimer);
    gotoTimer = null;
  }

  let hud = document.getElementById("keyboard-goto-hud");
  if (!hud && visible) {
    hud = document.createElement("div");
    hud.id = "keyboard-goto-hud";
    hud.className = "keyboard-hud";
    hud.setAttribute("role", "status");
    hud.setAttribute("aria-live", "polite");
    document.body.appendChild(hud);
  }

  if (hud) {
    if (visible) {
      hud.innerHTML =
        customText ||
        `Go to: <kbd>h</kbd> home · <kbd>c</kbd> chat · <kbd>n</kbd> notifs · <kbd>i</kbd> keys · <kbd>p</kbd> posts · <kbd>s</kbd> saved · <kbd>u</kbd> updates · <kbd>g</kbd> greenhouse · <kbd>b</kbd> blocklists · <kbd>?</kbd> help`;
      if (hud.style) hud.style.display = "flex";
      gotoTimer = setTimeout(() => {
        showGotoHud(false);
      }, 1800);
    } else {
      if (hud.style) hud.style.display = "none";
    }
  }
}

export function handleGotoKey(key: string): boolean {
  const k = key.toLowerCase();
  showGotoHud(false);

  switch (k) {
    case "h": {
      document.getElementById("rail-home-btn")?.click();
      return true;
    }
    case "c":
    case "m": {
      document.getElementById("open-chat-btn")?.click();
      return true;
    }
    case "n": {
      document.getElementById("open-notifs-btn")?.click();
      return true;
    }
    case "i": {
      document.getElementById("open-identity-btn")?.click();
      return true;
    }
    case "p": {
      document.getElementById("scope-myposts-btn")?.click();
      return true;
    }
    case "s": {
      document.querySelector<HTMLButtonElement>('[data-scope="saved"]')?.click();
      return true;
    }
    case "u": {
      document.getElementById("updates-open-btn")?.click();
      return true;
    }
    case "g": {
      document.getElementById("greenhouse-open-btn")?.click();
      return true;
    }
    case "b": {
      document.getElementById("blocklists-open-btn")?.click();
      return true;
    }
    case "?": {
      toggleShortcutsModal(true);
      return true;
    }
    default:
      return false;
  }
}

export function getSelectedPostCard(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".gram-card.keyboard-focused");
}

export function setSelectedPostCard(card: HTMLElement | null): void {
  const prev = document.querySelector<HTMLElement>(".gram-card.keyboard-focused");
  if (prev && prev !== card) {
    prev.classList.remove("keyboard-focused");
    prev.removeAttribute("tabindex");
  }
  if (card) {
    card.classList.add("keyboard-focused");
    card.setAttribute("tabindex", "-1");
    card.focus({ preventScroll: true });
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

export function clearSelectedPostCard(): void {
  setSelectedPostCard(null);
}

export function findNextCardIndex(cards: HTMLElement[], current: HTMLElement | null, direction: "next" | "prev"): number {
  if (cards.length === 0) return -1;
  if (current && cards.includes(current)) {
    const curIdx = cards.indexOf(current);
    return direction === "next" ? Math.min(curIdx + 1, cards.length - 1) : Math.max(curIdx - 1, 0);
  }

  // Find the card closest to top of viewport
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < cards.length; i++) {
    const rect = typeof cards[i].getBoundingClientRect === "function" ? cards[i].getBoundingClientRect() : { top: 0, bottom: 100 };
    if (rect.bottom > 80) {
      const dist = Math.abs(rect.top - 80);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  }
  return direction === "next" ? bestIdx : Math.max(bestIdx - 1, 0);
}

export function navigatePosts(direction: "next" | "prev", container?: HTMLElement | null): HTMLElement | null {
  const root = container || document.getElementById("posts-container");
  if (!root) return null;
  const cards = Array.from(root.querySelectorAll<HTMLElement>(".gram-card"));
  if (cards.length === 0) return null;

  const current = getSelectedPostCard();
  const nextIdx = findNextCardIndex(cards, current, direction);
  const targetCard = cards[nextIdx];
  if (targetCard) {
    setSelectedPostCard(targetCard);
    return targetCard;
  }
  return null;
}

export function triggerSelectedPostAction(
  action: "like" | "dislike" | "save" | "comment" | "toggle-comments" | "more" | "reveal-nsfw"
): boolean {
  const card = getSelectedPostCard();
  if (!card) return false;

  switch (action) {
    case "like": {
      const btn = card.querySelector<HTMLButtonElement>(".like-btn");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }
    case "dislike": {
      const btn = card.querySelector<HTMLButtonElement>(".dislike-btn");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }
    case "save": {
      const btn = card.querySelector<HTMLButtonElement>(".save-post-btn");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }
    case "comment": {
      const input = card.querySelector<HTMLTextAreaElement>("textarea.comment-input");
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return true;
      }
      const countBtn = card.querySelector<HTMLButtonElement>(".comment-count-btn");
      if (countBtn) {
        countBtn.click();
        const nextInput = card.querySelector<HTMLTextAreaElement>("textarea.comment-input");
        nextInput?.focus();
        return true;
      }
      return false;
    }
    case "toggle-comments": {
      const countBtn = card.querySelector<HTMLButtonElement>(".comment-count-btn");
      if (countBtn) {
        countBtn.click();
        return true;
      }
      return false;
    }
    case "more": {
      const details = card.querySelector<HTMLDetailsElement>("details.post-more");
      if (details) {
        details.open = !details.open;
        if (details.open) {
          details.querySelector<HTMLElement>(".action-btn, button")?.focus();
        }
        return true;
      }
      return false;
    }
    case "reveal-nsfw": {
      const nsfw = card.querySelector<HTMLElement>(".btn-reveal-nsfw, .nsfw-overlay");
      if (nsfw) {
        nsfw.click();
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

export function isShortcutsModalOpen(): boolean {
  const modal = document.getElementById("shortcuts-modal");
  return !!modal && modal.style.display !== "none" && modal.style.display !== "";
}

export function toggleShortcutsModal(show?: boolean): void {
  const modal = document.getElementById("shortcuts-modal");
  if (!modal) return;
  const shouldOpen = show !== undefined ? show : !isShortcutsModalOpen();
  modal.style.display = shouldOpen ? "flex" : "none";
  if (shouldOpen) {
    modal.querySelector<HTMLElement>("#shortcuts-close-btn")?.focus();
  }
}

export function toggleAudioPlayback(): boolean {
  const allAudio = Array.from(document.querySelectorAll<HTMLAudioElement>("audio"));
  const playing = allAudio.find((a) => !a.paused && !a.ended);
  if (playing) {
    playing.pause();
    return true;
  }

  const card = getSelectedPostCard();
  if (card) {
    const playBtn = card.querySelector<HTMLButtonElement>(".ft-play");
    if (playBtn) {
      playBtn.click();
      return true;
    }
    const audio = card.querySelector<HTMLAudioElement>("audio");
    if (audio) {
      void audio.play();
      return true;
    }
  }

  const ftPlay = document.querySelector<HTMLButtonElement>(".ft-play");
  if (ftPlay) {
    ftPlay.click();
    return true;
  }

  if (allAudio.length > 0) {
    void allAudio[0].play();
    return true;
  }

  return false;
}

export function stepAudioTrack(direction: "next" | "prev"): boolean {
  const allAudio = Array.from(document.querySelectorAll<HTMLAudioElement>("audio"));
  const playing = allAudio.find((a) => !a.paused && !a.ended);
  const card =
    playing?.closest<HTMLElement>(".ft-card") ||
    getSelectedPostCard()?.querySelector<HTMLElement>(".ft-card") ||
    document.querySelector<HTMLElement>(".ft-card");
  if (!card) return false;

  const rows = Array.from(card.querySelectorAll<HTMLButtonElement>(".ft-track-row"));
  if (rows.length <= 1) return false;

  const activeIdx = rows.findIndex((r) => r.classList.contains("active"));
  let targetIdx = 0;
  if (activeIdx !== -1) {
    targetIdx = direction === "next" ? (activeIdx + 1) % rows.length : (activeIdx - 1 + rows.length) % rows.length;
  }
  rows[targetIdx]?.click();
  return true;
}

export function toggleAudioMute(): boolean {
  const allAudio = Array.from(document.querySelectorAll<HTMLAudioElement>("audio"));
  if (allAudio.length === 0) return false;
  const anyUnmuted = allAudio.some((a) => !a.muted);
  allAudio.forEach((a) => {
    a.muted = anyUnmuted;
  });
  return true;
}

export function stepChatConversation(direction: "next" | "prev"): boolean {
  const modal = document.getElementById("chat-modal");
  if (!modal || modal.style.display === "none") return false;

  const items = Array.from(modal.querySelectorAll<HTMLElement>(".rm-conv-item, .chat-peer-item"));
  if (items.length === 0) return false;

  const activeIdx = items.findIndex((it) => it.classList.contains("active") || it.getAttribute("aria-selected") === "true");
  let nextIdx = 0;
  if (activeIdx !== -1) {
    nextIdx = direction === "next" ? (activeIdx + 1) % items.length : (activeIdx - 1 + items.length) % items.length;
  }
  items[nextIdx]?.click();
  items[nextIdx]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return true;
}

export function handleKeyboardShortcut(e: KeyboardEvent): boolean {
  // Handle Escape
  if (e.key === "Escape") {
    if (isGotoActive()) {
      showGotoHud(false);
      e.preventDefault();
      return true;
    }
    if (isShortcutsModalOpen()) {
      toggleShortcutsModal(false);
      e.preventDefault();
      return true;
    }
    if (isEditableTarget(e.target)) {
      (e.target as HTMLElement).blur();
      e.preventDefault();
      return true;
    }
    if (getSelectedPostCard()) {
      clearSelectedPostCard();
      e.preventDefault();
      return true;
    }
    // If modal is open, let modals.ts dismiss it
    return false;
  }

  // Handle Ctrl+Enter / Cmd+Enter inside text inputs
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    const target = e.target as HTMLElement | null;
    if (target?.id === "post-caption") {
      const publishBtn = document.getElementById("publish-btn") as HTMLButtonElement | null;
      if (publishBtn && !publishBtn.disabled) {
        e.preventDefault();
        publishBtn.click();
        return true;
      }
    }
    const commentBox = target?.closest<HTMLTextAreaElement>("textarea.comment-input");
    if (commentBox) {
      e.preventDefault();
      commentBox.form?.requestSubmit();
      return true;
    }
  }

  // If typing in an editable field or IME is active, do not trigger single-key navigation
  if (isEditableTarget(e.target) || e.isComposing) {
    return false;
  }

  // If in goto sequence mode:
  if (isGotoActive()) {
    e.preventDefault();
    return handleGotoKey(e.key);
  }

  const chatModal = document.getElementById("chat-modal");
  const isChatOpen = !!chatModal && chatModal.style.display !== "none" && chatModal.style.display !== "";

  if (isShortcutsModalOpen()) {
    if (e.key === "?" || e.key === "Escape") {
      e.preventDefault();
      toggleShortcutsModal(false);
      return true;
    }
    return false;
  }

  // Chat-specific conversation switching
  if (isChatOpen) {
    if (e.altKey && (e.key === "ArrowDown" || e.key.toLowerCase() === "j")) {
      e.preventDefault();
      return stepChatConversation("next");
    }
    if (e.altKey && (e.key === "ArrowUp" || e.key.toLowerCase() === "k")) {
      e.preventDefault();
      return stepChatConversation("prev");
    }
  }

  // If another modal is open, don't trigger background feed shortcuts
  if (hasOpenModal() && !isChatOpen) {
    if (e.key === "?") {
      e.preventDefault();
      toggleShortcutsModal(true);
      return true;
    }
    return false;
  }

  // Preserve standard browser shortcuts (Ctrl, Meta, or Alt combos)
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return false;
  }

  switch (e.key) {
    case "g": {
      e.preventDefault();
      showGotoHud(true);
      return true;
    }
    case "?": {
      e.preventDefault();
      toggleShortcutsModal(true);
      return true;
    }
    case "/": {
      const searchInput = document.getElementById("feed-search-input") as HTMLInputElement | null;
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        return true;
      }
      return false;
    }
    case "j":
    case "ArrowDown": {
      e.preventDefault();
      return !!navigatePosts("next");
    }
    case "k":
    case "ArrowUp": {
      e.preventDefault();
      return !!navigatePosts("prev");
    }
    case "l": {
      e.preventDefault();
      return triggerSelectedPostAction("like");
    }
    case "d": {
      e.preventDefault();
      return triggerSelectedPostAction("dislike");
    }
    case "s": {
      e.preventDefault();
      return triggerSelectedPostAction("save");
    }
    case "c":
    case "r": {
      if (getSelectedPostCard()) {
        e.preventDefault();
        return triggerSelectedPostAction("comment");
      }
      const postCaption = document.getElementById("post-caption") as HTMLTextAreaElement | null;
      if (postCaption) {
        e.preventDefault();
        postCaption.focus();
        postCaption.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      return false;
    }
    case "o":
    case "Enter": {
      if (getSelectedPostCard()) {
        e.preventDefault();
        return triggerSelectedPostAction("toggle-comments");
      }
      return false;
    }
    case "x": {
      if (getSelectedPostCard()) {
        e.preventDefault();
        return triggerSelectedPostAction("more");
      }
      return false;
    }
    case "v": {
      if (getSelectedPostCard()) {
        e.preventDefault();
        return triggerSelectedPostAction("reveal-nsfw");
      }
      return false;
    }
    case "n": {
      const postCaption = document.getElementById("post-caption") as HTMLTextAreaElement | null;
      if (postCaption) {
        e.preventDefault();
        postCaption.focus();
        postCaption.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      return false;
    }
    case ".": {
      e.preventDefault();
      document.getElementById("rail-home-btn")?.click();
      return true;
    }
    case " ": {
      if (toggleAudioPlayback()) {
        e.preventDefault();
        return true;
      }
      return false;
    }
    case "]":
    case ">": {
      if (stepAudioTrack("next")) {
        e.preventDefault();
        return true;
      }
      return false;
    }
    case "[":
    case "<": {
      if (stepAudioTrack("prev")) {
        e.preventDefault();
        return true;
      }
      return false;
    }
    case "M": {
      if (e.shiftKey && toggleAudioMute()) {
        e.preventDefault();
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

/** Install the global keyboard shortcut listener. */
export function initShortcuts(): () => void {
  const onKeydown = (e: KeyboardEvent) => {
    handleKeyboardShortcut(e);
  };

  document.addEventListener("keydown", onKeydown);

  // Wire up close button & guide modal shortcut button
  document.getElementById("shortcuts-close-btn")?.addEventListener("click", () => toggleShortcutsModal(false));
  document.getElementById("guide-shortcuts-btn")?.addEventListener("click", () => toggleShortcutsModal(true));

  return () => {
    document.removeEventListener("keydown", onKeydown);
  };
}
