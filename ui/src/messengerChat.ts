import {
  computeSafetyBlocks,
  shouldHydratePreview,
  shouldUpdateCachedPreview,
  type PreviewItem,
} from "./messengerLogic.ts";
export { computeSafetyBlocks, shouldHydratePreview, shouldUpdateCachedPreview, type PreviewItem };
import { personaName } from "./crypto.ts";
import { plainMentions, renderCaption } from "./caption.ts";
import { CHAT_REACTIONS } from "./logfold.ts";
import { safeStorage } from "./storage.ts";
import { generateDefaultAvatar } from "./avatar.ts";
import { fillFreetunes, freetunesCard } from "./freetunes.ts";
import { fillFreepolls, freepollsCard, type PollNet } from "./freepolls.ts";
import { freenet } from "./freenet.ts";
import type { ChatMessage, Community, PrivateRoom, UserIdentity } from "./types.ts";

export type ChatLayoutMode = "messenger" | "classic";

export interface MessengerActiveState {
  peer: string | null;
  privateRoom: PrivateRoom | null;
  community: Community | null;
  shownMessages: ChatMessage[];
  replyingTo: ChatMessage | null;
  online: boolean;
}

export interface MessengerDeps {
  rootEl: HTMLElement;
  pollNet: PollNet;
  isVisible?: () => boolean;
  getIdentity: () => UserIdentity | null;
  getAllPrivateRooms: () => PrivateRoom[];
  getJoinedCommunities: () => Community[];
  getAllCommunities: () => Community[];
  getFollowingKeys: () => string[];
  getActiveState: () => MessengerActiveState;
  getChatReadMap: () => Record<string, number>;
  openRoomId: () => string | null;
  getAuthorDisplayName: (pubkey: string) => string;
  getAuthorAvatarUrl: (pubkey: string) => string;
  shortenKey: (key: string) => string;
  escapeHtml: (value: unknown) => string;
  safeUrl: (url: string | undefined) => string;

  onSelectPeer: (pubkey: string) => Promise<void>;
  onSelectPrivateRoom: (room: PrivateRoom) => Promise<void>;
  onSelectCommunity: (comm: Community) => Promise<void>;
  onSendMessage: (rawText: string, sourceBox?: HTMLElement) => Promise<boolean>;
  onSetReply: (msg: ChatMessage | null) => void;
  onReactMessage: (roomId: string, msgId: string, emoji: string, peer?: string) => Promise<void>;
  onDeleteMessage: (roomId: string, msgId: string) => Promise<void>;
  onClearActiveChat: () => Promise<void>;
  onRemovePeer: (peerPubkey: string) => void;
  onLeavePrivateRoom: (room: PrivateRoom) => Promise<void>;
  onOpenCreateRoomModal: () => void;
  onOpenJoinRoomModal: () => void;
  onOpenInviteRoomModal: () => void;
  onGetInviteLink: (room: PrivateRoom) => Promise<string | null>;
  onOpenUserProfile: (pubkey: string) => void;
  onOpenPostLink: (e: Event, anchor: HTMLAnchorElement) => void;
  onCreatePollLink: (question: string, options: string[], multi: boolean) => Promise<string>;
  onSwitchLayout: (mode: ChatLayoutMode) => void;
  onToggleFullscreen: () => void;
  onCloseChat: () => void;
  showToast: (msg: string, type?: "info" | "warning" | "error") => void;
}

interface UnifiedConversation {
  key: string; // "dm:<pk>" | "priv:<roomId>" | "comm:<commId>"
  roomId: string;
  type: "dm" | "priv" | "comm";
  name: string;
  dupSuffix?: string;
  origin?: string;
  avatarUrl?: string;
  avatarFallbackSeed?: string;
  monogram?: string;
  pinned: boolean;
  unread: number;
  lastTs: number;
  previewText: string;
  previewMine: boolean;
  previewOptimistic: boolean;
  peerPk?: string;
  privateRoom?: PrivateRoom;
  community?: Community;
}

const PALETTE_KEY = "radica_messenger_palette";

const CLOCK_FMT = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" });
const SHORT_WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const SHORT_DATE_FMT = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });
const LONG_DATE_FMT = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long" });
const LONG_DATE_YEAR_FMT = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" });

const SENDER_COLORS = ["#2d7a47", "#9a5b13", "#2b6cb0", "#805ad5", "#b83280", "#c05621"];
function senderColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length];
}

function makeMonogram(label: string, isComm = false): string {
  const clean = label.replace(/^#?r\//i, "").trim();
  if (!clean) return isComm ? "#" : "RM";
  if (isComm) return `#${clean.slice(0, 1).toUpperCase()}`;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function formatInboxTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return CLOCK_FMT.format(d);
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  const diffDays = Math.floor((now.getTime() - ts) / (24 * 60 * 60 * 1000));
  if (diffDays < 7) {
    return SHORT_WEEKDAY_FMT.format(d);
  }
  return SHORT_DATE_FMT.format(d);
}

function formatDateSeparator(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.getFullYear() !== now.getFullYear() ? LONG_DATE_YEAR_FMT.format(d) : LONG_DATE_FMT.format(d);
}

function formatClock(ts: number): string {
  return CLOCK_FMT.format(new Date(ts));
}

export function createMessengerChat(deps: MessengerDeps) {
  const { rootEl, escapeHtml, safeUrl, shortenKey } = deps;

  let activeFilter: "all" | "unread" | "dm" | "priv" | "comm" = "all";
  let inboxQuery = "";
  let threadQuery = "";
  let drawerOpen = false;
  let mobileShowThread = true;
  let lastRenderedConvKey = "";

  // Real decrypted last-message cache keyed by roomId (never mock data)
  const previewCache = new Map<string, PreviewItem>();
  // Tracks which roomId + latestStoredTs we already hydrated so we don't re-decrypt unchanged rooms
  const hydratedStamp = new Map<string, number>();
  let hydrating = false;
  let inboxRunning = false;
  let inboxQueued = false;
  let lastConvListHtml = "";
  const rowSrc = new WeakMap<Element, string>();

  const isVisible = () => (deps.isVisible ? deps.isVisible() : true);

  function reconcileRows(container: HTMLElement, items: { key: string; html: string }[]): boolean {
    const old = new Map<string, Element>();
    let changed = false;
    for (const n of Array.from(container.children) as HTMLElement[]) {
      const k = n.dataset.rowKey;
      if (k) old.set(k, n);
      else {
        n.remove();
        changed = true;
      }
    }
    const keep = new Set<Element>();
    let cursor: Element | null = container.firstElementChild;
    for (const { key, html } of items) {
      let el = old.get(key);
      if (!el || rowSrc.get(el) !== html) {
        const tpl = document.createElement("template");
        tpl.innerHTML = html.trim();
        el = tpl.content.firstElementChild!;
        (el as HTMLElement).dataset.rowKey = key;
        rowSrc.set(el, html);
        changed = true;
      }
      keep.add(el);
      if (el === cursor) cursor = cursor.nextElementSibling;
      else {
        container.insertBefore(el, cursor);
        changed = true;
      }
    }
    for (const n of old.values()) {
      if (!keep.has(n)) {
        n.remove();
        changed = true;
      }
    }
    return changed;
  }

  const roomNameCache = new Map<string, string>();

  function pinnedSet(): Set<string> {
    const me = deps.getIdentity()?.pubkey;
    if (!me) return new Set();
    try {
      const list = JSON.parse(safeStorage.getItem(`radica_pinned_chats_${me}`) || "[]");
      return new Set(Array.isArray(list) ? list : []);
    } catch {
      return new Set();
    }
  }

  function togglePinned(convKey: string): boolean {
    const me = deps.getIdentity()?.pubkey;
    if (!me) return false;
    const set = pinnedSet();
    const next = !set.has(convKey);
    if (next) set.add(convKey);
    else set.delete(convKey);
    safeStorage.setItem(`radica_pinned_chats_${me}`, JSON.stringify([...set]));
    return next;
  }

  function verifiedSet(): Set<string> {
    const me = deps.getIdentity()?.pubkey;
    if (!me) return new Set();
    try {
      const list = JSON.parse(safeStorage.getItem(`radica_verified_chats_${me}`) || "[]");
      return new Set(Array.isArray(list) ? list : []);
    } catch {
      return new Set();
    }
  }

  function toggleVerified(targetId: string): boolean {
    const me = deps.getIdentity()?.pubkey;
    if (!me) return false;
    const set = verifiedSet();
    const next = !set.has(targetId);
    if (next) set.add(targetId);
    else set.delete(targetId);
    safeStorage.setItem(`radica_verified_chats_${me}`, JSON.stringify([...set]));
    return next;
  }

  function activeConvKey(): string | null {
    const st = deps.getActiveState();
    if (st.privateRoom) return `priv:${st.privateRoom.id}`;
    if (st.community) return `comm:${st.community.id}`;
    if (st.peer) return `dm:${st.peer}`;
    return null;
  }

  function safetyTarget(): { id: string; material: string; label: string } | null {
    const st = deps.getActiveState();
    if (st.peer) {
      return {
        id: `dm:${st.peer}`,
        material: st.peer,
        label: deps.getAuthorDisplayName(st.peer),
      };
    }
    if (st.privateRoom) {
      const name = roomNameCache.get(st.privateRoom.id) || "E2EE Group";
      return {
        id: `priv:${st.privateRoom.id}`,
        material: st.privateRoom.river?.owner || `${st.privateRoom.creator}:${st.privateRoom.id}`,
        label: name,
      };
    }
    return null;
  }

  // Mount static DOM shell inside rootEl
  const savedPalette = safeStorage.getItem(PALETTE_KEY) === "signal" ? "signal" : "radici";
  rootEl.setAttribute("data-palette", savedPalette);

  rootEl.innerHTML = `
    <div class="rm-workspace" id="rm-workspace">
      <!-- UNIFIED INBOX SIDEBAR -->
      <aside class="rm-inbox" aria-label="Conversations">
        <div class="rm-inbox-header">
          <div class="rm-inbox-title-wrap">
            <h2 class="rm-inbox-title">Messages</h2>
            <div class="rm-node-pill" id="rm-node-pill">
              <span class="dot"></span>
              <span id="rm-node-label">Connecting to node…</span>
            </div>
          </div>
          <div class="rm-inbox-actions">
            <button type="button" class="rm-icon-btn rm-narrow-only" data-layout-mode="classic" title="Classic view" aria-label="Classic view">🏛️</button>
            <button type="button" class="rm-icon-btn" id="rm-btn-palette" title="Switch palette: Radici Warm / Signal Crisp">
              <svg viewBox="0 0 24 24" class="svg-icon icon-md"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
            </button>
            <button type="button" class="rm-icon-btn" id="rm-btn-new-chat" title="New direct message or E2EE private room">
              <svg viewBox="0 0 24 24" class="svg-icon icon-md"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button type="button" class="rm-icon-btn rm-narrow-only" id="rm-btn-inbox-close" title="Close chat and return to feed">✕</button>
          </div>
        </div>

        <div class="rm-search-box">
          <div class="rm-search-inner">
            <svg viewBox="0 0 24 24" class="svg-icon icon-sm"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              id="rm-inbox-search"
              class="rm-search-input"
              placeholder="Search contacts, groups, or #communities…"
              autocomplete="off"
            />
            <button type="button" class="rm-search-clear" id="rm-inbox-search-clear" title="Clear search">✕</button>
          </div>
        </div>

        <div class="rm-filter-bar" id="rm-filter-bar" role="tablist">
          <button type="button" class="rm-filter-chip active" data-filter="all">All</button>
          <button type="button" class="rm-filter-chip" data-filter="unread">Unread <span class="rm-chip-count" id="rm-chip-unread-count">0</span></button>
          <button type="button" class="rm-filter-chip" data-filter="dm">DMs 🔒</button>
          <button type="button" class="rm-filter-chip" data-filter="priv">Groups 🔒</button>
          <button type="button" class="rm-filter-chip" data-filter="comm">Communities #</button>
        </div>

        <div class="rm-conv-list" id="rm-conv-list"></div>

        <div class="rm-inbox-footer">
          <button type="button" class="rm-link-btn" id="rm-btn-create-room" title="Create new E2EE private room">+ New Room</button>
          <button type="button" class="rm-link-btn" id="rm-btn-invite-code" title="Join via zero-knowledge invite link or code">
            <svg viewBox="0 0 24 24" class="svg-icon icon-xs"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Invite Code</span>
          </button>
        </div>
      </aside>

      <!-- ACTIVE CONVERSATION STAGE -->
      <main class="rm-stage">
        <header class="rm-chat-header">
          <div class="rm-header-left">
            <button type="button" class="rm-icon-btn rm-mobile-back" id="rm-btn-mobile-back" title="Back to conversations">
              <svg viewBox="0 0 24 24" class="svg-icon icon-md"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button type="button" class="rm-header-peer" id="rm-header-peer-trigger" title="Open contact / room details">
              <div id="rm-header-avatar-slot"></div>
              <div class="rm-header-info">
                <div class="rm-header-name-row">
                  <span class="rm-header-name" id="rm-header-title">Select a conversation</span>
                  <span class="rm-trust-pill" id="rm-header-trust-badge" style="display: none;"></span>
                </div>
                <div class="rm-header-sub" id="rm-header-subtitle">Choose a contact or room from the left sidebar</div>
              </div>
            </button>
          </div>

          <div class="rm-header-controls">
            <div class="rm-mode-switch" role="group" aria-label="Chat layout">
              <button type="button" class="rm-mode-btn active" data-layout-mode="messenger" title="Messenger view" aria-label="Messenger view">💬</button>
              <button type="button" class="rm-mode-btn" data-layout-mode="classic" title="Classic view" aria-label="Classic view">🏛️</button>
            </div>

            <button type="button" class="rm-icon-btn" id="rm-btn-invite-top" title="Invite to private room" style="display: none;">
              <svg viewBox="0 0 24 24" class="svg-icon icon-md"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            </button>
            <button type="button" class="rm-icon-btn" id="rm-btn-thread-search" title="Search in conversation">
              <svg viewBox="0 0 24 24" class="svg-icon icon-md"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button type="button" class="rm-icon-btn" id="rm-btn-safety-verify" title="Verify E2EE Safety Number" style="display: none;">
              <svg viewBox="0 0 24 24" class="svg-icon icon-md"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            </button>
            <button type="button" class="rm-icon-btn" id="rm-btn-drawer-toggle" title="Contact / room info">
              <svg viewBox="0 0 24 24" class="svg-icon icon-md"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
            <button type="button" class="rm-icon-btn" id="rm-btn-fullscreen" title="Full screen">
              <svg viewBox="0 0 24 24" class="svg-icon icon-sm"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            </button>
            <button type="button" class="rm-icon-btn" id="rm-btn-close" title="Close chat and return to feed">✕</button>
          </div>
        </header>

        <div class="rm-thread-search" id="rm-thread-search-bar">
          <svg viewBox="0 0 24 24" class="svg-icon icon-sm" style="color: var(--rm-text-muted);"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="rm-thread-search-input" placeholder="Find in conversation…" autocomplete="off" />
          <button type="button" class="rm-icon-btn" id="rm-thread-search-close" title="Close search">✕</button>
        </div>

        <div class="rm-messages-scroller" id="rm-messages-scroller">
          <div class="rm-messages-track" id="rm-messages-track"></div>
        </div>

        <div class="rm-composer-outer" id="rm-composer-outer">
          <div class="rm-composer-track">
            <div class="rm-reply-banner" id="rm-reply-banner">
              <div class="rm-reply-banner-text" id="rm-reply-banner-text"></div>
              <button type="button" class="rm-icon-btn" id="rm-reply-banner-cancel" style="width: 24px; height: 24px;" title="Cancel reply">✕</button>
            </div>

            <div class="rm-attach-menu" id="rm-attach-menu">
              <button type="button" class="rm-attach-item" data-attach="mention">👤 Mention someone (@)</button>
              <button type="button" class="rm-attach-item" data-attach="poll">📊 Create FreePolls Poll</button>
              <button type="button" class="rm-attach-item" data-attach="room-link" id="rm-attach-room-link">🔑 Insert Room Invite Link</button>
              <button type="button" class="rm-attach-item" data-attach="my-key">🪪 Insert My Public Key</button>
            </div>

            <form class="rm-composer-row" id="rm-composer-form">
              <button type="button" class="rm-plus-btn" id="rm-btn-attach" title="Quick Freenet actions">
                <svg viewBox="0 0 24 24" class="svg-icon icon-md"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <div class="rm-input-pill">
                <textarea
                  id="rm-composer-input"
                  class="rm-textarea"
                  rows="1"
                  autocomplete="off"
                  placeholder="Write a message…"
                ></textarea>
                <button type="button" class="rm-emoji-btn" id="rm-btn-quick-emoji" title="Insert 🌱">🌱</button>
              </div>
              <button type="submit" class="rm-send-btn" id="rm-btn-send" title="Send message (Enter)">
                <svg viewBox="0 0 24 24" class="svg-icon icon-md" style="transform: translateX(1px);">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </main>

      <!-- SLIDE-OVER INFO & MEMBERS DRAWER -->
      <aside class="rm-drawer" id="rm-info-drawer" aria-label="Conversation Details">
        <div class="rm-drawer-top">
          <span id="rm-drawer-header-label">Details</span>
          <button type="button" class="rm-icon-btn" id="rm-btn-drawer-close" title="Close panel">✕</button>
        </div>
        <div id="rm-drawer-content"></div>
      </aside>
    </div>

    <!-- REAL SHA-256 SAFETY NUMBER MODAL -->
    <div class="rm-modal-backdrop" id="rm-safety-modal">
      <div class="rm-modal">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>E2EE Safety Number</h3>
          <button type="button" class="rm-icon-btn" id="rm-safety-modal-close">✕</button>
        </div>
        <p style="margin: 0; font-size: 0.82rem; color: var(--rm-text-secondary); line-height: 1.45;">
          Numeric blocks computed via <b>SHA-256</b> over your real cryptographic keys (<code id="rm-safety-me-name" style="font-weight:700;"></code>) and <b id="rm-safety-peer-name"></b>'s keys. If they match on both devices, this session is end-to-end authentic.
        </p>
        <div class="rm-safety-grid" id="rm-safety-grid"></div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="rm-link-btn" id="rm-btn-copy-safety">Copy Safety Number</button>
          <button type="button" class="rm-icebreaker-btn" style="margin-top: 0;" id="rm-btn-mark-verified">✓ Mark Verified</button>
        </div>
      </div>
    </div>

    <!-- NEW CONVERSATION / START REAL DM MODAL -->
    <div class="rm-modal-backdrop" id="rm-new-chat-modal">
      <div class="rm-modal">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>New Conversation</h3>
          <button type="button" class="rm-icon-btn" id="rm-new-chat-close">✕</button>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="rm-link-btn" id="rm-modal-create-room">+ New E2EE Group</button>
          <button type="button" class="rm-link-btn" id="rm-modal-join-room">🔑 Join with Invite Code</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 0.75rem; font-weight: 700; color: var(--rm-text-muted); text-transform: uppercase;">Start DM by public key (64-hex) or search contacts</label>
          <div style="display: flex; gap: 6px;">
            <input type="text" id="rm-new-chat-input" class="rm-field-input" placeholder="Paste 64-hex pubkey or filter by name…" autocomplete="off" />
            <button type="button" class="rm-icebreaker-btn" id="rm-new-chat-go" style="margin-top: 0; white-space: nowrap;">Open DM</button>
          </div>
        </div>
        <div class="rm-contact-picker-list" id="rm-contact-picker-list"></div>
      </div>
    </div>

    <!-- REAL FREEPOLLS IN-CHAT CREATOR MODAL -->
    <div class="rm-modal-backdrop" id="rm-poll-modal">
      <div class="rm-modal">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>New FreePolls Poll</h3>
          <button type="button" class="rm-icon-btn" id="rm-poll-close">✕</button>
        </div>
        <p style="margin: 0; font-size: 0.8rem; color: var(--rm-text-secondary);">
          Publishes a live FreePolls contract on your Freenet node and sends an interactive poll to this conversation.
        </p>
        <input type="text" id="rm-poll-question" class="rm-field-input" placeholder="Poll question…" maxlength="300" />
        <textarea id="rm-poll-options" class="rm-field-input" rows="4" placeholder="One option per line (at least 2)…"></textarea>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--rm-text-secondary); cursor: pointer;">
          <input type="checkbox" id="rm-poll-multi" /> Allow multiple choices
        </label>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="rm-link-btn" id="rm-poll-cancel">Cancel</button>
          <button type="button" class="rm-icebreaker-btn" id="rm-poll-submit" style="margin-top: 0;">Publish & Send</button>
        </div>
      </div>
    </div>
  `;

  // Grab mounted DOM elements
  const workspaceEl = rootEl.querySelector("#rm-workspace") as HTMLElement;
  const nodePillEl = rootEl.querySelector("#rm-node-pill") as HTMLElement;
  const nodeLabelEl = rootEl.querySelector("#rm-node-label") as HTMLElement;
  const inboxSearchEl = rootEl.querySelector("#rm-inbox-search") as HTMLInputElement;
  const inboxSearchClearEl = rootEl.querySelector("#rm-inbox-search-clear") as HTMLButtonElement;
  const filterBarEl = rootEl.querySelector("#rm-filter-bar") as HTMLElement;
  const chipUnreadCountEl = rootEl.querySelector("#rm-chip-unread-count") as HTMLElement;
  const convListEl = rootEl.querySelector("#rm-conv-list") as HTMLElement;

  const headerAvatarSlotEl = rootEl.querySelector("#rm-header-avatar-slot") as HTMLElement;
  const headerTitleEl = rootEl.querySelector("#rm-header-title") as HTMLElement;
  const headerTrustBadgeEl = rootEl.querySelector("#rm-header-trust-badge") as HTMLElement;
  const headerSubtitleEl = rootEl.querySelector("#rm-header-subtitle") as HTMLElement;
  const inviteTopBtn = rootEl.querySelector("#rm-btn-invite-top") as HTMLButtonElement;
  const safetyTopBtn = rootEl.querySelector("#rm-btn-safety-verify") as HTMLButtonElement;
  const drawerToggleBtn = rootEl.querySelector("#rm-btn-drawer-toggle") as HTMLButtonElement;

  const threadSearchBarEl = rootEl.querySelector("#rm-thread-search-bar") as HTMLElement;
  const threadSearchInputEl = rootEl.querySelector("#rm-thread-search-input") as HTMLInputElement;
  const messagesScrollerEl = rootEl.querySelector("#rm-messages-scroller") as HTMLElement;
  const messagesTrackEl = rootEl.querySelector("#rm-messages-track") as HTMLElement;

  const replyBannerEl = rootEl.querySelector("#rm-reply-banner") as HTMLElement;
  const replyBannerTextEl = rootEl.querySelector("#rm-reply-banner-text") as HTMLElement;
  const attachMenuEl = rootEl.querySelector("#rm-attach-menu") as HTMLElement;
  const composerFormEl = rootEl.querySelector("#rm-composer-form") as HTMLFormElement;
  const composerInputEl = rootEl.querySelector("#rm-composer-input") as HTMLTextAreaElement;
  const sendBtnEl = rootEl.querySelector("#rm-btn-send") as HTMLButtonElement;

  const drawerEl = rootEl.querySelector("#rm-info-drawer") as HTMLElement;
  const drawerHeaderLabelEl = rootEl.querySelector("#rm-drawer-header-label") as HTMLElement;
  const drawerContentEl = rootEl.querySelector("#rm-drawer-content") as HTMLElement;

  const safetyModalEl = rootEl.querySelector("#rm-safety-modal") as HTMLElement;
  const safetyMeNameEl = rootEl.querySelector("#rm-safety-me-name") as HTMLElement;
  const safetyPeerNameEl = rootEl.querySelector("#rm-safety-peer-name") as HTMLElement;
  const safetyGridEl = rootEl.querySelector("#rm-safety-grid") as HTMLElement;
  const markVerifiedBtnEl = rootEl.querySelector("#rm-btn-mark-verified") as HTMLButtonElement;

  const newChatModalEl = rootEl.querySelector("#rm-new-chat-modal") as HTMLElement;
  const newChatInputEl = rootEl.querySelector("#rm-new-chat-input") as HTMLInputElement;
  const contactPickerListEl = rootEl.querySelector("#rm-contact-picker-list") as HTMLElement;

  const pollModalEl = rootEl.querySelector("#rm-poll-modal") as HTMLElement;
  const pollQuestionEl = rootEl.querySelector("#rm-poll-question") as HTMLInputElement;
  const pollOptionsEl = rootEl.querySelector("#rm-poll-options") as HTMLTextAreaElement;
  const pollMultiEl = rootEl.querySelector("#rm-poll-multi") as HTMLInputElement;
  const pollSubmitBtnEl = rootEl.querySelector("#rm-poll-submit") as HTMLButtonElement;

  function fitInput() {
    if (!composerInputEl.value) {
      composerInputEl.style.height = "";
      composerInputEl.style.overflowY = "hidden";
      return;
    }
    composerInputEl.style.height = "auto";
    const sh = composerInputEl.scrollHeight;
    composerInputEl.style.height = `${Math.min(132, sh)}px`;
    composerInputEl.style.overflowY = sh > 132 ? "auto" : "hidden";
  }

  /** Inspect stored raw messages of a room synchronously for sorting timestamp & optimistic state. */
  function storedRoomMeta(roomId: string): { lastTs: number; lastSender: string; rawText: string; count: number; optimistic: boolean } {
    const cleared = Number(safeStorage.getItem(`freenet_chat_cleared_${roomId}`) || 0);
    try {
      const list: ChatMessage[] = JSON.parse(safeStorage.getItem(`freenet_chat_${roomId}`) || "[]");
      const visible = list.filter((m) => m.timestamp > cleared);
      if (!visible.length) return { lastTs: 0, lastSender: "", rawText: "", count: 0, optimistic: false };
      const last = visible[visible.length - 1];
      return {
        lastTs: last.timestamp || 0,
        lastSender: last.sender || "",
        rawText: last.text || "",
        count: visible.length,
        optimistic: last.id.startsWith("msg_opt_"),
      };
    } catch {
      return { lastTs: 0, lastSender: "", rawText: "", count: 0, optimistic: false };
    }
  }

  function formatPreviewLine(text: string, sender: string, me: string, type: "dm" | "priv" | "comm"): string {
    const clean = plainMentions(text, deps.getAuthorDisplayName).replace(/\s+/g, " ").trim();
    if (!clean) return "🔒 Encrypted message";
    if (sender === me) return clean;
    if (type !== "dm" && sender) {
      const who = sender === "system" ? "System" : deps.getAuthorDisplayName(sender);
      return `${who}: ${clean}`;
    }
    return clean;
  }

  async function buildUnifiedConversations(): Promise<UnifiedConversation[]> {
    const identity = deps.getIdentity();
    if (!identity) return [];
    const me = identity.pubkey;
    const st = deps.getActiveState();
    const read = deps.getChatReadMap();
    const openId = deps.openRoomId();
    const pins = pinnedSet();

    // Update previewCache directly from currently open conversation if messages are loaded
    if (openId && st.shownMessages.length > 0) {
      const last = st.shownMessages[st.shownMessages.length - 1];
      previewCache.set(openId, {
        text: last.text,
        sender: last.sender,
        timestamp: last.timestamp,
        optimistic: last.id.startsWith("msg_opt_"),
      });
      const openStoredTs = storedRoomMeta(openId).lastTs;
      if (openStoredTs) hydratedStamp.set(openId, openStoredTs);
    } else if (openId && st.shownMessages.length === 0) {
      previewCache.delete(openId);
    }

    const items: UnifiedConversation[] = [];

    // 1. Private Rooms (AES-256-GCM & River WASM)
    const rooms = deps.getAllPrivateRooms();
    await Promise.all(
      rooms.map(async (r) => {
        const name = await freenet
          .getPrivateRoomDecryptedName(identity, r)
          .catch(() => roomNameCache.get(r.id) || `Private Room (${r.id.slice(9, 15)})`);
        roomNameCache.set(r.id, name);

        const since = read[r.id] ?? Date.now();
        const unread = openId === r.id ? 0 : freenet.unreadCount(r.id, me, since);
        const meta = storedRoomMeta(r.id);
        const cached = previewCache.get(r.id);
        const lastTs = Math.max(cached?.timestamp ?? 0, meta.lastTs, r.created_at || 0);

        let previewText = "No messages · E2EE encrypted room";
        let previewMine = false;
        let previewOptimistic = false;
        if (cached && cached.timestamp >= meta.lastTs) {
          previewMine = cached.sender === me;
          previewOptimistic = !!cached.optimistic;
          previewText = formatPreviewLine(cached.text, cached.sender, me, "priv");
        } else if (meta.count > 0) {
          previewMine = meta.lastSender === me;
          previewOptimistic = meta.optimistic;
          previewText = meta.rawText && !meta.rawText.startsWith("sym:")
            ? formatPreviewLine(meta.rawText, meta.lastSender, me, "priv")
            : "🔒 Encrypted message…";
        }

        items.push({
          key: `priv:${r.id}`,
          roomId: r.id,
          type: "priv",
          name,
          origin: r.river ? "River" : undefined,
          monogram: makeMonogram(name, false),
          pinned: pins.has(`priv:${r.id}`),
          unread,
          lastTs,
          previewText,
          previewMine,
          previewOptimistic,
          privateRoom: r,
        });
      })
    );

    // 2. Community Rooms
    for (const c of deps.getJoinedCommunities()) {
      const roomId = `comm_${c.id}`;
      const since = read[roomId] ?? Date.now();
      const unread = openId === roomId ? 0 : freenet.unreadCount(roomId, me, since);
      const meta = storedRoomMeta(roomId);
      const cached = previewCache.get(roomId);
      const lastTs = Math.max(cached?.timestamp ?? 0, meta.lastTs, c.created_at || 0);

      let previewText = c.description ? c.description : `Public room #r/${c.slug}`;
      let previewMine = false;
      let previewOptimistic = false;
      if (meta.count > 0) {
        previewMine = meta.lastSender === me;
        previewOptimistic = meta.optimistic;
        previewText = formatPreviewLine(meta.rawText, meta.lastSender, me, "comm");
      } else if (cached) {
        previewMine = cached.sender === me;
        previewOptimistic = !!cached.optimistic;
        previewText = formatPreviewLine(cached.text, cached.sender, me, "comm");
      }

      items.push({
        key: `comm:${c.id}`,
        roomId,
        type: "comm",
        name: `r/${c.slug}`,
        monogram: makeMonogram(c.slug, true),
        pinned: pins.has(`comm:${c.id}`),
        unread,
        lastTs,
        previewText,
        previewMine,
        previewOptimistic,
        community: c,
      });
    }

    // 3. Direct Messages
    const rawPeers = Array.from(
      new Set([
        ...freenet.getChatPeers(me),
        ...deps.getFollowingKeys(),
        ...(st.peer ? [st.peer] : []),
      ])
    );
    freenet.warmPeers(rawPeers);
    const knownPeers = rawPeers.filter(
      (pk) => pk && pk !== me && (pk === st.peer || !freenet.isChatPeerRemoved(me, pk))
    );

    const nameCount = new Map<string, number>();
    for (const pk of knownPeers) {
      const dn = deps.getAuthorDisplayName(pk);
      nameCount.set(dn, (nameCount.get(dn) ?? 0) + 1);
    }

    for (const pk of knownPeers) {
      const roomId = freenet.getRoomId(me, pk);
      const displayName = deps.getAuthorDisplayName(pk);
      const fromRiver = freenet.riverOnly.has(pk);
      const since = read[roomId] ?? Date.now();
      const unread = openId === roomId ? 0 : freenet.unreadCount(roomId, me, since);
      const meta = storedRoomMeta(roomId);
      const cached = previewCache.get(roomId);
      const lastTs = Math.max(cached?.timestamp ?? 0, meta.lastTs);

      let previewText = "No messages · Tap to start";
      let previewMine = false;
      let previewOptimistic = false;
      if (cached && cached.timestamp >= meta.lastTs) {
        previewMine = cached.sender === me;
        previewOptimistic = !!cached.optimistic;
        previewText = formatPreviewLine(cached.text, cached.sender, me, "dm");
      } else if (meta.count > 0) {
        previewMine = meta.lastSender === me;
        previewOptimistic = meta.optimistic;
        const isPlain = meta.rawText && !meta.rawText.startsWith("e2e:") && !meta.rawText.startsWith("sym:");
        previewText = isPlain ? formatPreviewLine(meta.rawText, meta.lastSender, me, "dm") : "🔒 Encrypted message…";
      } else if (fromRiver) {
        const roomsIn = Object.values(freenet.riverOnly.get(pk) ?? {});
        if (roomsIn.length) previewText = `In ${roomsIn.join(", ")}`;
      }

      items.push({
        key: `dm:${pk}`,
        roomId,
        type: "dm",
        name: displayName,
        dupSuffix: (nameCount.get(displayName) ?? 0) > 1 ? pk.slice(0, 4) : undefined,
        origin: fromRiver ? "River" : undefined,
        avatarUrl: deps.getAuthorAvatarUrl(pk),
        avatarFallbackSeed: pk,
        pinned: pins.has(`dm:${pk}`),
        unread,
        lastTs,
        previewText,
        previewMine,
        previewOptimistic,
        peerPk: pk,
      });
    }

    // Sort: Pinned first, then by real chronological lastTs descending, then alphabetical
    items.sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      if (b.lastTs !== a.lastTs) return b.lastTs - a.lastTs;
      return a.name.localeCompare(b.name);
    });

    return items;
  }

  /** Asynchronously decrypts the last message of closed E2EE DMs / Private Rooms so previews show real text. */
  async function hydrateClosedPreviews(convs: UnifiedConversation[]) {
    if (hydrating || !isVisible()) return;
    const identity = deps.getIdentity();
    if (!identity) return;
    hydrating = true;
    let changed = false;
    try {
      for (const c of convs) {
        if (!isVisible()) break;
        const openId = deps.openRoomId();
        const meta = storedRoomMeta(c.roomId);
        const stamp = meta.lastTs || (c.type === "priv" && c.origin === "River" ? 1 : 0);
        if (
          !shouldHydratePreview({
            type: c.type,
            roomId: c.roomId,
            openRoomId: openId,
            stamp,
            lastHydratedStamp: hydratedStamp.get(c.roomId),
          })
        ) {
          continue;
        }
        hydratedStamp.set(c.roomId, stamp);

        // Yield to macrotask queue between rooms so WASM reads never starve UI input or WebSocket frames
        await new Promise((r) => setTimeout(r, 0));
        if (!isVisible()) break;

        try {
          const msgs =
            c.type === "dm" && c.peerPk
              ? await freenet.getChatMessages(identity, c.peerPk)
              : c.type === "priv" && c.privateRoom
                ? await freenet.getPrivateRoomChatMessages(identity, c.privateRoom)
                : [];
          // Update stamp again in case reading a River room updated localStorage freenet_chat_<roomId>
          const afterTs = storedRoomMeta(c.roomId).lastTs;
          if (afterTs) hydratedStamp.set(c.roomId, afterTs);

          if (msgs.length > 0 && deps.openRoomId() !== c.roomId) {
            const last = msgs[msgs.length - 1];
            const nextPreview: PreviewItem = {
              text: last.text,
              sender: last.sender,
              timestamp: last.timestamp,
              optimistic: last.id.startsWith("msg_opt_"),
            };
            const prev = previewCache.get(c.roomId);
            if (shouldUpdateCachedPreview(prev, nextPreview)) {
              previewCache.set(c.roomId, nextPreview);
              changed = true;
            }
          }
        } catch {
          // ignore single room read failure
        }
      }
    } finally {
      hydrating = false;
    }
    if (changed && isVisible()) void refreshInbox(true);
  }

  async function refreshInbox(skipHydrate = false) {
    if (!isVisible()) return;
    if (inboxRunning) {
      inboxQueued = true;
      return;
    }
    inboxRunning = true;
    try {
      do {
        inboxQueued = false;
        const identity = deps.getIdentity();
        if (!identity || !isVisible()) return;

        updateStatusBanner();
        const allConvs = await buildUnifiedConversations();
        if (!isVisible()) return;
        const totalUnreadConvs = allConvs.filter((c) => c.unread > 0).length;
        chipUnreadCountEl.textContent = String(totalUnreadConvs);

        const q = inboxQuery.trim().toLowerCase();
        const activeKey = activeConvKey();

        const filtered = allConvs.filter((c) => {
          if (activeFilter === "unread" && c.unread === 0) return false;
          if (activeFilter === "dm" && c.type !== "dm") return false;
          if (activeFilter === "priv" && c.type !== "priv") return false;
          if (activeFilter === "comm" && c.type !== "comm") return false;
          if (q) {
            const hay = `${c.name} ${c.peerPk ?? ""} ${c.previewText}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });

        let nextHtml = "";
        if (filtered.length === 0) {
          nextHtml = `
            <div style="padding: 28px 14px; text-align: center; color: var(--rm-text-muted); font-size: 0.83rem; line-height: 1.5;">
              ${allConvs.length === 0
                ? `No conversations yet.<br/>Click the <b>✏️</b> icon above to start an encrypted chat or create a room.`
                : `No conversations match this filter.`}
            </div>
          `;
        } else {
          nextHtml = filtered
            .map((c) => {
              const isActive = c.key === activeKey;
              let avatarHtml = "";
              if (c.type === "dm") {
                const fallback = generateDefaultAvatar(c.avatarFallbackSeed || "radica");
                avatarHtml = `
                  <div class="rm-conv-avatar-wrap">
                    <img class="rm-conv-avatar" src="${safeUrl(c.avatarUrl) || fallback}" alt="${escapeHtml(c.name)}" onerror="this.onerror=null;this.src='${fallback}'" />
                    <span class="rm-avatar-subbadge" title="E2EE Direct Messages">
                      <svg viewBox="0 0 24 24" class="svg-icon" style="width:10px;height:10px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </span>
                  </div>
                `;
              } else if (c.type === "priv") {
                avatarHtml = `
                  <div class="rm-conv-avatar-wrap">
                    <div class="rm-room-monogram priv">${escapeHtml(c.monogram || "RM")}</div>
                    <span class="rm-avatar-subbadge" title="E2EE Private Group">
                      <svg viewBox="0 0 24 24" class="svg-icon" style="width:10px;height:10px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </span>
                  </div>
                `;
              } else {
                avatarHtml = `
                  <div class="rm-conv-avatar-wrap">
                    <div class="rm-room-monogram comm">${escapeHtml(c.monogram || "#")}</div>
                    <span class="rm-avatar-subbadge comm-dot" title="Public Community">#</span>
                  </div>
                `;
              }

              const checkPrefix = c.previewMine
                ? `<span style="color: var(--rm-accent); font-weight:700;">${c.previewOptimistic ? "✓" : "✓✓"} You:</span> `
                : "";

              return `
                <button type="button" class="rm-conv-item ${isActive ? "active" : ""} ${c.unread > 0 ? "unread" : ""}" data-conv-key="${escapeHtml(c.key)}">
                  ${avatarHtml}
                  <div class="rm-conv-body">
                    <div class="rm-conv-top">
                      <div class="rm-conv-name-row">
                        <span class="rm-conv-name">${escapeHtml(c.name)}</span>
                        ${c.dupSuffix ? `<span class="rm-origin-pill">${escapeHtml(c.dupSuffix)}</span>` : ""}
                        ${c.origin ? `<span class="rm-origin-pill">${escapeHtml(c.origin)}</span>` : ""}
                      </div>
                      <span class="rm-conv-time">${escapeHtml(c.lastTs ? formatInboxTime(c.lastTs) : "")}</span>
                    </div>
                    <div class="rm-conv-bottom">
                      <span class="rm-conv-preview">${checkPrefix}${escapeHtml(c.previewText)}</span>
                      <div class="rm-conv-meta-right">
                        ${c.pinned ? `<span class="rm-pin-icon" title="Pinned conversation">📌</span>` : ""}
                        ${c.unread > 0 ? `<span class="rm-unread-pill">${c.unread > 99 ? "99+" : c.unread}</span>` : ""}
                      </div>
                    </div>
                  </div>
                </button>
              `;
            })
            .join("");
        }

        if (nextHtml !== lastConvListHtml) {
          lastConvListHtml = nextHtml;
          convListEl.innerHTML = nextHtml;
        }

        if (!skipHydrate) {
          void hydrateClosedPreviews(allConvs);
        }
      } while (inboxQueued);
    } finally {
      inboxRunning = false;
    }
  }

  function updateStatusBanner() {
    const st = deps.getActiveState();
    const rootsCount = deps.getFollowingKeys().length;
    nodePillEl.classList.toggle("online", st.online);
    nodeLabelEl.textContent = st.online
      ? `Freenet connected${rootsCount ? ` · ${rootsCount} roots` : ""}`
      : "Local archive · Offline";
  }

  /** Computes real shared rooms & communities with a peer for the Signal First-Contact card & Drawer! */
  function sharedSpacesWithPeer(peerPk: string): string[] {
    const shared: string[] = [];
    for (const r of deps.getAllPrivateRooms()) {
      const members = (r.river ? freenet.riverRoster(r.id)?.members : undefined) ?? r.members;
      if (members.includes(peerPk)) {
        shared.push(roomNameCache.get(r.id) || `Room (${r.id.slice(9, 15)})`);
      }
    }
    const riverMap = freenet.riverOnly.get(peerPk);
    if (riverMap) {
      for (const rn of Object.values(riverMap)) {
        if (rn && !shared.includes(rn)) shared.push(rn);
      }
    }
    for (const c of deps.getAllCommunities()) {
      if (c.members.includes(peerPk)) {
        const label = `r/${c.slug}`;
        if (!shared.includes(label)) shared.push(label);
      }
    }
    return shared;
  }

  function renderHeader() {
    const st = deps.getActiveState();
    const verified = verifiedSet();

    if (st.peer) {
      const pk = st.peer;
      const name = deps.getAuthorDisplayName(pk);
      const avatar = deps.getAuthorAvatarUrl(pk);
      const fallback = generateDefaultAvatar(pk);
      const isVerified = verified.has(`dm:${pk}`);
      const isRiver = freenet.riverOnly.has(pk);

      headerAvatarSlotEl.innerHTML = `<img class="rm-header-avatar" src="${safeUrl(avatar) || fallback}" alt="${escapeHtml(name)}" onerror="this.onerror=null;this.src='${fallback}'" />`;
      headerTitleEl.textContent = name;
      headerTrustBadgeEl.style.display = "inline-flex";
      headerTrustBadgeEl.className = "rm-trust-pill";
      headerTrustBadgeEl.textContent = isVerified ? "🔒 E2EE · ✓ Verified" : "🔒 E2EE Private";
      headerSubtitleEl.textContent = `${st.online ? "Node online" : "Local"} · @${shortenKey(personaName(pk))} · ${isRiver ? "River E2EE Bridge" : "X25519 + AES-256-GCM"}`;
      composerInputEl.placeholder = `Encrypted message to ${name}…`;
      composerInputEl.disabled = false;
      sendBtnEl.disabled = false;
      inviteTopBtn.style.display = "none";
      safetyTopBtn.style.display = "inline-flex";
    } else if (st.privateRoom) {
      const r = st.privateRoom;
      const name = roomNameCache.get(r.id) || `Room (${r.id.slice(9, 15)})`;
      const memberCount = (r.river ? freenet.riverRoster(r.id)?.members.length : undefined) ?? r.members.length;
      const isVerified = verified.has(`priv:${r.id}`);

      headerAvatarSlotEl.innerHTML = `<div class="rm-header-monogram rm-room-monogram priv">${escapeHtml(makeMonogram(name, false))}</div>`;
      headerTitleEl.textContent = name;
      headerTrustBadgeEl.style.display = "inline-flex";
      headerTrustBadgeEl.className = "rm-trust-pill";
      headerTrustBadgeEl.textContent = isVerified ? "🔒 E2EE Group · ✓" : "🔒 E2EE Group";
      headerSubtitleEl.textContent = `${memberCount} members · ${r.river ? "River WASM Contract · E2EE" : "AES-256-GCM + X25519"}`;
      composerInputEl.placeholder = `Message ${name} (E2EE)…`;
      composerInputEl.disabled = false;
      sendBtnEl.disabled = false;
      inviteTopBtn.style.display = "inline-flex";
      safetyTopBtn.style.display = "inline-flex";
    } else if (st.community) {
      const c = st.community;
      const count = freenet.getCommunityParticipants(c).length;
      headerAvatarSlotEl.innerHTML = `<div class="rm-header-monogram rm-room-monogram comm">${escapeHtml(makeMonogram(c.slug, true))}</div>`;
      headerTitleEl.textContent = `r/${c.slug}`;
      headerTrustBadgeEl.style.display = "inline-flex";
      headerTrustBadgeEl.className = "rm-trust-pill public";
      headerTrustBadgeEl.textContent = "🌐 Public Room";
      headerSubtitleEl.textContent = `${count} participants · ${c.name} · Public Ed25519 signed`;
      composerInputEl.placeholder = `Public message in #r/${c.slug}…`;
      composerInputEl.disabled = false;
      sendBtnEl.disabled = false;
      inviteTopBtn.style.display = "none";
      safetyTopBtn.style.display = "none";
    } else {
      headerAvatarSlotEl.innerHTML = "";
      headerTitleEl.textContent = "Messages on Freenet";
      headerTrustBadgeEl.style.display = "none";
      headerSubtitleEl.textContent = "Select a contact, E2EE group, or community";
      composerInputEl.placeholder = "Select a conversation first…";
      composerInputEl.disabled = true;
      sendBtnEl.disabled = true;
      inviteTopBtn.style.display = "none";
      safetyTopBtn.style.display = "none";
    }
  }

  function renderReplyBanner() {
    const identity = deps.getIdentity();
    const reply = deps.getActiveState().replyingTo;
    const openId = deps.openRoomId();
    if (!reply || !openId || reply.room_id !== openId) {
      replyBannerEl.classList.remove("open");
      return;
    }
    const who = reply.sender === identity?.pubkey ? "yourself" : deps.getAuthorDisplayName(reply.sender);
    const excerpt = plainMentions(reply.text, deps.getAuthorDisplayName).replace(/\s+/g, " ").slice(0, 90);
    replyBannerTextEl.innerHTML = `Replying to <b>${escapeHtml(who)}</b>: ${escapeHtml(excerpt)}`;
    replyBannerEl.classList.add("open");
  }

  function renderThread(scrollToBottom = false) {
    if (!isVisible()) return;
    const identity = deps.getIdentity();
    if (!identity) return;
    const me = identity.pubkey;
    const st = deps.getActiveState();
    const curKey = activeConvKey() || "";
    const switchedConv = curKey !== lastRenderedConvKey;
    lastRenderedConvKey = curKey;

    const wasNearBottom =
      messagesScrollerEl.scrollHeight - messagesScrollerEl.scrollTop - messagesScrollerEl.clientHeight < 90;
    const prevScrollTop = messagesScrollerEl.scrollTop;

    renderHeader();
    renderReplyBanner();

    const openId = deps.openRoomId();
    if (!openId) {
      messagesTrackEl.innerHTML = `
        <div class="rm-first-contact-card">
          <h3>Welcome to Messages</h3>
          <div class="rm-first-contact-mutual">
            Choose a conversation from the left sidebar or start a new end-to-end encrypted direct message.
          </div>
          <button type="button" class="rm-icebreaker-btn" id="rm-empty-start-btn">✏️ New Conversation</button>
        </div>
      `;
      messagesTrackEl.querySelector("#rm-empty-start-btn")?.addEventListener("click", () => openNewChatModal());
      return;
    }

    // Security / Public Context Banner at top of stream
    const bannerHtml =
      st.community
        ? `<div class="rm-e2ee-banner">
            <span>🌐 Public community chat for <b>#r/${escapeHtml(st.community.slug)}</b>. Messages are signed with Ed25519 and visible on the node.</span>
          </div>`
        : `<div class="rm-e2ee-banner">
            <span>🔒 Messages in this conversation are end-to-end encrypted on your Freenet node.</span>
            <button type="button" id="rm-inline-verify-btn">Verify safety number</button>
          </div>`;

    const allMsgs = st.shownMessages;
    const q = threadQuery.trim().toLowerCase();
    const msgs = q
      ? allMsgs.filter((m) => plainMentions(m.text, deps.getAuthorDisplayName).toLowerCase().includes(q))
      : allMsgs;

    if (msgs.length === 0) {
      let cardHtml = "";
      if (q) {
        cardHtml = `
          <div class="rm-first-contact-card">
            <h3>No results</h3>
            <div class="rm-first-contact-mutual">No messages contain "${escapeHtml(threadQuery)}".</div>
          </div>
        `;
      } else if (st.peer) {
        const pk = st.peer;
        const name = deps.getAuthorDisplayName(pk);
        const avatar = deps.getAuthorAvatarUrl(pk);
        const fallback = generateDefaultAvatar(pk);
        const shared = sharedSpacesWithPeer(pk);
        const isRiverOnly = freenet.riverOnly.has(pk);
        cardHtml = `
          <div class="rm-first-contact-card">
            <img src="${safeUrl(avatar) || fallback}" alt="${escapeHtml(name)}" onerror="this.onerror=null;this.src='${fallback}'" />
            <h3>${escapeHtml(name)}</h3>
            <span class="rm-first-contact-key">@${escapeHtml(shortenKey(personaName(pk)))}</span>
            <div class="rm-first-contact-mutual">
              ${shared.length
                ? `In common on Freenet: <b>${escapeHtml(shared.join(", "))}</b>`
                : `Direct E2EE session ready · Zero central servers`}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px;">
              ${!isRiverOnly ? `<button type="button" class="rm-link-btn" data-open-profile="${escapeHtml(pk)}">View Profile</button>` : ""}
              <button type="button" class="rm-icebreaker-btn" style="margin-top:0;" data-prefill-hello="${escapeHtml(name)}">👋 Say hello to ${escapeHtml(name)}</button>
            </div>
          </div>
        `;
      } else if (st.privateRoom) {
        const name = roomNameCache.get(st.privateRoom.id) || "Private Room";
        cardHtml = `
          <div class="rm-first-contact-card">
            <div class="rm-room-monogram priv" style="width:68px;height:68px;font-size:1.4rem;">${escapeHtml(makeMonogram(name, false))}</div>
            <h3>${escapeHtml(name)}</h3>
            <div class="rm-first-contact-mutual">
              End-to-end encrypted group room. Only authorized members hold the key to read messages.
            </div>
            <button type="button" class="rm-icebreaker-btn" id="rm-empty-invite-btn">➕ Invite Members</button>
          </div>
        `;
      } else if (st.community) {
        cardHtml = `
          <div class="rm-first-contact-card">
            <div class="rm-room-monogram comm" style="width:68px;height:68px;font-size:1.4rem;">${escapeHtml(makeMonogram(st.community.slug, true))}</div>
            <h3>#r/${escapeHtml(st.community.slug)}</h3>
            <div class="rm-first-contact-mutual">${escapeHtml(st.community.description || `Welcome to the ${st.community.name} community chatroom!`)}</div>
          </div>
        `;
      }
      messagesTrackEl.innerHTML = bannerHtml + cardHtml;
      return;
    }

    // Group & render real messages in Signal style
    const isGroup = !st.peer;
    const roomCreator = st.privateRoom
      ? freenet.riverRoster(st.privateRoom.id)?.creator ?? st.privateRoom.creator
      : st.community?.creator ?? "";
    const roomMods = st.privateRoom
      ? freenet.riverRoster(st.privateRoom.id)?.moderators ?? st.privateRoom.moderators ?? []
      : st.community?.moderators ?? [];
    const iAmCommMod = !!(st.community && (st.community.creator === me || st.community.moderators.includes(me)));

    const msgById = new Map<string, ChatMessage>();
    for (const x of allMsgs) msgById.set(x.id, x);
    const dateLabels = msgs.map((m) => formatDateSeparator(m.timestamp));

    let lastDateStr = "";
    let hasEmbeddedCards = false;
    const rowItems: { key: string; html: string }[] = [{ key: `banner:${curKey}`, html: bannerHtml }];

    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const prev = msgs[i - 1];
      const next = msgs[i + 1];

      const dateLabel = dateLabels[i];
      if (dateLabel !== lastDateStr) {
        rowItems.push({ key: `sep:${dateLabel}:${i}`, html: `<div class="rm-date-sep">${escapeHtml(dateLabel)}</div>` });
        lastDateStr = dateLabel;
      }

      const isMine = m.sender === me;
      const groupedPrev =
        !!prev &&
        dateLabels[i - 1] === dateLabel &&
        prev.sender === m.sender &&
        m.timestamp - prev.timestamp < 5 * 60 * 1000;
      const groupedNext =
        !!next &&
        dateLabels[i + 1] === dateLabel &&
        next.sender === m.sender &&
        next.timestamp - m.timestamp < 5 * 60 * 1000;

      const senderName = isMine ? "You" : m.sender === "system" ? "Radica Genesis" : deps.getAuthorDisplayName(m.sender);

      // Sender label inside first bubble of a run in group/community rooms
      let roleBadge = "";
      if (isGroup && !isMine) {
        if (m.sender === roomCreator) roleBadge = `<span class="rm-role-tag">👑 Founder</span>`;
        else if (roomMods.includes(m.sender)) roleBadge = `<span class="rm-role-tag">🛡️ Mod</span>`;
      }
      const canOpenSender = !isMine && m.sender !== "system" && !freenet.riverOnly.has(m.sender);
      const senderHtml =
        isGroup && !isMine && !groupedPrev
          ? `<div class="rm-sender-label" ${canOpenSender ? `data-open-profile="${escapeHtml(m.sender)}"` : ""} style="color: ${senderColor(m.sender)};">
              <span>${escapeHtml(senderName)}</span>${roleBadge}
            </div>`
          : "";

      // Reply quote lookup (O(1) via msgById)
      let quoteHtml = "";
      if (m.reply_to) {
        const orig = msgById.get(m.reply_to);
        const origAuthor = orig
          ? orig.sender === me
            ? "You"
            : deps.getAuthorDisplayName(orig.sender)
          : "Message";
        const origText = orig
          ? plainMentions(orig.text, deps.getAuthorDisplayName).replace(/\s+/g, " ").slice(0, 100)
          : "no longer available";
        quoteHtml = `
          <div class="rm-quote-box" data-jump-msg="${escapeHtml(m.reply_to)}">
            <span class="rm-quote-author">${escapeHtml(origAuthor)}</span>
            <span class="rm-quote-text">${escapeHtml(origText)}</span>
          </div>
        `;
      }

      // Rich body + FreeTunes / FreePolls cards
      const bodyHtml = renderCaption(m.text, deps.getAuthorDisplayName);
      const cardsHtml = freetunesCard(m.text) + freepollsCard(m.text);
      if (cardsHtml) hasEmbeddedCards = true;

      // Reactions (only protocol-valid CHAT_REACTIONS)
      const reactionEntries = Object.entries(m.reactions ?? {}).filter(
        ([emoji, who]) => CHAT_REACTIONS.includes(emoji) && who.length > 0
      );
      const hasReactions = reactionEntries.length > 0;
      const reactionsHtml = hasReactions
        ? `<div class="rm-reactions-row">
            ${reactionEntries
              .map(([emoji, who]) => {
                const iReacted = who.includes(me);
                const names = who.map((pk) => (pk === me ? "You" : deps.getAuthorDisplayName(pk))).join(", ");
                return `<button type="button" class="rm-react-pill ${iReacted ? "mine" : ""}" data-react-emoji="${escapeHtml(emoji)}" data-room-id="${escapeHtml(openId)}" data-msg-id="${escapeHtml(m.id)}" title="${escapeHtml(names)}">
                  <span>${emoji}</span><span>${who.length}</span>
                </button>`;
              })
              .join("")}
          </div>`
        : "";

      const canDelete = st.privateRoom
        ? !st.privateRoom.river || isMine
        : st.community
          ? isMine || iAmCommMod
          : true;

      const hoverBarHtml = `
        <div class="rm-hover-bar">
          ${CHAT_REACTIONS.map(
            (emoji) =>
              `<button type="button" data-react-emoji="${escapeHtml(emoji)}" data-room-id="${escapeHtml(openId)}" data-msg-id="${escapeHtml(m.id)}" title="React ${emoji}">${emoji}</button>`
          ).join("")}
          <button type="button" data-reply-msg="${escapeHtml(m.id)}" title="Reply">↩</button>
          ${
            canDelete
              ? `<button type="button" class="rm-del-act" data-del-msg="${escapeHtml(m.id)}" data-room-id="${escapeHtml(openId)}" title="Delete message">🗑️</button>`
              : ""
          }
        </div>
      `;

      // Avatar on last message of incoming run (Signal style)
      const fallbackAvatar = generateDefaultAvatar(m.sender || "radica");
      const avatarGutterHtml = !isMine
        ? `<div class="rm-avatar-gutter">
            ${
              !groupedNext
                ? `<img class="rm-msg-avatar" src="${safeUrl(deps.getAuthorAvatarUrl(m.sender)) || fallbackAvatar}" alt="${escapeHtml(senderName)}" ${canOpenSender ? `data-open-profile="${escapeHtml(m.sender)}"` : ""} onerror="this.onerror=null;this.src='${fallbackAvatar}'" />`
                : ""
            }
          </div>`
        : "";

      const isOpt = m.id.startsWith("msg_opt_");
      const checksHtml = isMine
        ? `<span class="rm-checks" title="${isOpt ? "Sending to node…" : "Signed & stored on node"}">${isOpt ? "✓" : "✓✓"}</span>`
        : "";

      rowItems.push({
        key: `msg:${m.id}`,
        html: `<div class="rm-msg-row ${isMine ? "mine" : "theirs"} ${groupedPrev ? "grouped-prev" : ""} ${groupedNext ? "grouped-next" : ""} ${hasReactions ? "has-reactions" : ""}" data-msg-id="${escapeHtml(m.id)}">
          ${isMine ? hoverBarHtml : avatarGutterHtml}
          <div class="rm-bubble-wrap">
            <div class="rm-bubble">
              ${senderHtml}
              ${quoteHtml}
              <span class="rm-bubble-text">${bodyHtml}</span>
              ${cardsHtml}
              <span class="rm-meta-float">
                <span>${escapeHtml(formatClock(m.timestamp))}</span>
                ${checksHtml}
              </span>
            </div>
            ${reactionsHtml}
          </div>
          ${!isMine ? hoverBarHtml : ""}
        </div>`,
      });
    }

    const rowsChanged = reconcileRows(messagesTrackEl, rowItems);

    // Hydrate any embedded FreeTunes / FreePolls contracts inside chat bubbles only when present & changed
    if (rowsChanged && hasEmbeddedCards) {
      fillFreetunes(messagesTrackEl, (id) => freenet.appContract(id));
      fillFreepolls(messagesTrackEl, deps.pollNet);
    }

    if (scrollToBottom || switchedConv || wasNearBottom) {
      messagesScrollerEl.scrollTop = messagesScrollerEl.scrollHeight;
    } else {
      messagesScrollerEl.scrollTop = prevScrollTop;
    }
  }

  function refreshDrawer() {
    if (!isVisible()) return;
    const identity = deps.getIdentity();
    if (!identity) return;
    const me = identity.pubkey;
    const st = deps.getActiveState();
    const curKey = activeConvKey();
    if (!curKey) {
      drawerHeaderLabelEl.textContent = "Details";
      drawerContentEl.innerHTML = `<div style="padding: 18px; font-size: 0.82rem; color: var(--rm-text-muted);">Select a conversation to view details and members.</div>`;
      return;
    }

    const isPinned = pinnedSet().has(curKey);
    const verified = verifiedSet();
    const sTarget = safetyTarget();
    const safetyPreview = sTarget ? computeSafetyBlocks(me, sTarget.material).slice(0, 4).join(" ") + " ••••" : "";

    if (st.peer) {
      const pk = st.peer;
      const name = deps.getAuthorDisplayName(pk);
      const avatar = deps.getAuthorAvatarUrl(pk);
      const fallback = generateDefaultAvatar(pk);
      const isRiverOnly = freenet.riverOnly.has(pk);
      const shared = sharedSpacesWithPeer(pk);
      const isVer = verified.has(`dm:${pk}`);

      drawerHeaderLabelEl.textContent = "Contact Info";
      drawerContentEl.innerHTML = `
        <div class="rm-drawer-hero">
          <img src="${safeUrl(avatar) || fallback}" alt="${escapeHtml(name)}" onerror="this.onerror=null;this.src='${fallback}'" />
          <div class="rm-drawer-name">${escapeHtml(name)}</div>
          <div class="rm-drawer-handle">@${escapeHtml(shortenKey(personaName(pk)))}</div>
          <div class="rm-quick-tiles">
            ${
              !isRiverOnly
                ? `<button type="button" class="rm-tile-btn" data-open-profile="${escapeHtml(pk)}"><span>👤</span><span>Profile</span></button>`
                : `<button type="button" class="rm-tile-btn" data-copy-pk="${escapeHtml(pk)}"><span>📋</span><span>Copy Key</span></button>`
            }
            <button type="button" class="rm-tile-btn" data-toggle-pin="${escapeHtml(curKey)}">
              <span>📌</span><span>${isPinned ? "Pinned" : "Pin"}</span>
            </button>
            <button type="button" class="rm-tile-btn" data-clear-chat="1">
              <span>🧹</span><span>Clear</span>
            </button>
          </div>
        </div>

        <div class="rm-drawer-section">
          <h4>E2EE Session Security</h4>
          <div class="rm-safety-card">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <strong>${isRiverOnly ? "River Direct Bridge" : "X25519 + AES-256-GCM"}</strong>
              <span style="color:var(--rm-online);font-weight:700;font-size:0.72rem;">${isVer ? "✓ Verified" : "Active"}</span>
            </div>
            <div class="rm-safety-code">${escapeHtml(safetyPreview)}</div>
            <button type="button" class="rm-link-btn" style="align-self:flex-start;" id="rm-drawer-verify-btn">Verify full safety number</button>
          </div>
        </div>

        <div class="rm-drawer-section">
          <h4>Full Public Key</h4>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--rm-bg-subtle);padding:8px 10px;border-radius:10px;">
            <code style="font-size:0.68rem;word-break:break-all;color:var(--rm-text-secondary);">${escapeHtml(pk)}</code>
            <button type="button" class="rm-mini-act" data-copy-pk="${escapeHtml(pk)}">Copy</button>
          </div>
        </div>

        ${
          shared.length > 0
            ? `<div class="rm-drawer-section">
                <h4>Shared Rooms & Communities</h4>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${shared.map((s) => `<span class="rm-link-btn" style="cursor:default;">${escapeHtml(s)}</span>`).join("")}
                </div>
              </div>`
            : ""
        }

        <div class="rm-drawer-section" style="border-bottom:none;">
          <button type="button" class="rm-link-btn" data-remove-peer="${escapeHtml(pk)}" style="width:100%;justify-content:center;color:var(--rm-danger);border-color:var(--rm-danger-soft);background:var(--rm-danger-soft);">
            Remove from recent chats
          </button>
        </div>
      `;
      return;
    }

    if (st.privateRoom) {
      const room = st.privateRoom;
      const name = roomNameCache.get(room.id) || "Private Room";
      const roster = room.river ? freenet.riverRoster(room.id) : undefined;
      const members = roster?.members ?? room.members;
      const creator = roster?.creator ?? room.creator;
      const roomMods = roster?.moderators ?? room.moderators ?? [];
      const isRoomCreator = me === creator;
      const iAmRoomMod = roomMods.includes(me);
      const isVer = verified.has(`priv:${room.id}`);

      drawerHeaderLabelEl.textContent = "E2EE Group Info";
      const memberRows = members
        .map((mPk) => {
          const isCreator = mPk === creator;
          const isYou = mPk === me;
          const isMod = roomMods.includes(mPk);
          const canKick = !isYou && !isCreator && (isRoomCreator || (iAmRoomMod && !isMod));
          const mName = deps.getAuthorDisplayName(mPk);
          const mAvatar = deps.getAuthorAvatarUrl(mPk);
          const mFallback = generateDefaultAvatar(mPk);

          return `
            <div class="rm-member-row">
              <img src="${safeUrl(mAvatar) || mFallback}" alt="${escapeHtml(mName)}" ${!isYou && !freenet.riverOnly.has(mPk) ? `data-open-profile="${escapeHtml(mPk)}"` : ""} onerror="this.onerror=null;this.src='${mFallback}'" />
              <div class="rm-member-meta">
                <div class="rm-member-name">
                  <span>${escapeHtml(mName)}</span>
                  ${isCreator ? `<span class="rm-role-tag">👑 Founder</span>` : ""}
                  ${isMod ? `<span class="rm-role-tag">🛡️ Mod</span>` : ""}
                  ${isYou ? `<span class="rm-role-tag">You</span>` : ""}
                </div>
                <div class="rm-member-sub">@${escapeHtml(shortenKey(personaName(mPk)))}</div>
              </div>
              <div class="rm-member-actions">
                ${!isYou ? `<button type="button" class="rm-mini-act" data-dm-pk="${escapeHtml(mPk)}" title="Direct Message">💬</button>` : ""}
                <button type="button" class="rm-mini-act" data-copy-pk="${escapeHtml(mPk)}" title="Copy public key">📋</button>
                ${
                  isRoomCreator && !isYou && !isCreator
                    ? `<button type="button" class="rm-mini-act" data-room-mod="${escapeHtml(mPk)}" data-mod-on="${isMod ? "0" : "1"}">${isMod ? "Unmod" : "Mod"}</button>`
                    : ""
                }
                ${
                  canKick
                    ? `<button type="button" class="rm-mini-act danger" data-room-kick="${escapeHtml(mPk)}" title="Kick and rotate key">Kick</button>`
                    : ""
                }
              </div>
            </div>
          `;
        })
        .join("");

      drawerContentEl.innerHTML = `
        <div class="rm-drawer-hero">
          <div class="rm-drawer-monogram rm-room-monogram priv">${escapeHtml(makeMonogram(name, false))}</div>
          <div class="rm-drawer-name">${escapeHtml(name)}</div>
          <div class="rm-drawer-handle">${members.length} members · ${room.river ? "River WASM Contract" : "AES-256-GCM"}</div>
          <div class="rm-quick-tiles">
            <button type="button" class="rm-tile-btn" data-invite-room="1"><span>➕</span><span>Invite</span></button>
            <button type="button" class="rm-tile-btn" data-toggle-pin="${escapeHtml(curKey)}"><span>📌</span><span>${isPinned ? "Pinned" : "Pin"}</span></button>
            <button type="button" class="rm-tile-btn" data-copy-room-link="1"><span>🔗</span><span>Link</span></button>
          </div>
        </div>

        <div class="rm-drawer-section">
          <h4>Room Security</h4>
          <div class="rm-safety-card">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <strong>${room.river ? "River E2EE Room Key" : "AES-256 Symmetric Key"}</strong>
              <span style="color:var(--rm-online);font-weight:700;font-size:0.72rem;">${isVer ? "✓ Verified" : "Encrypted"}</span>
            </div>
            <div class="rm-safety-code">${escapeHtml(safetyPreview)}</div>
            <button type="button" class="rm-link-btn" style="align-self:flex-start;" id="rm-drawer-verify-btn">Verify room fingerprint</button>
          </div>
        </div>

        <div class="rm-drawer-section">
          <h4>Members (${members.length})</h4>
          <div>${memberRows}</div>
        </div>

        <div class="rm-drawer-section" style="border-bottom:none;">
          ${
            room.river
              ? `<button type="button" class="rm-link-btn" data-export-river-id="1" style="width:100%;justify-content:center;">🪪 Export River Identity (Export ID)</button>`
              : ""
          }
          <button type="button" class="rm-link-btn" data-clear-chat="1" style="width:100%;justify-content:center;">🧹 Clear local history</button>
          <button type="button" class="rm-link-btn" data-leave-room="1" style="width:100%;justify-content:center;color:var(--rm-danger);border-color:var(--rm-danger-soft);background:var(--rm-danger-soft);">
            ${isRoomCreator ? "Remove room from list" : "Leave room"}
          </button>
        </div>
      `;
      return;
    }

    if (st.community) {
      const comm = st.community;
      const isUserMod = me === comm.creator || comm.moderators.includes(me);
      const commPks = freenet.getCommunityParticipants(comm);
      const allDisplayPks = Array.from(new Set([...commPks, ...(isUserMod ? comm.banned_members || [] : [])]));

      drawerHeaderLabelEl.textContent = "Community Info";
      const memberRows = allDisplayPks
        .map((mPk) => {
          const isCreator = mPk === comm.creator;
          const isMod = comm.moderators.includes(mPk);
          const isYou = mPk === me;
          const isBanned = !!(comm.banned_members && comm.banned_members.includes(mPk));
          const mName = mPk === "system" ? "Radica Genesis" : deps.getAuthorDisplayName(mPk);
          const mAvatar = deps.getAuthorAvatarUrl(mPk);
          const mFallback = generateDefaultAvatar(mPk);

          return `
            <div class="rm-member-row ${isBanned ? "banned" : ""}">
              <img src="${safeUrl(mAvatar) || mFallback}" alt="${escapeHtml(mName)}" ${!isYou && mPk !== "system" ? `data-open-profile="${escapeHtml(mPk)}"` : ""} onerror="this.onerror=null;this.src='${mFallback}'" />
              <div class="rm-member-meta">
                <div class="rm-member-name">
                  <span>${escapeHtml(mName)}</span>
                  ${isCreator ? `<span class="rm-role-tag">👑 Founder</span>` : ""}
                  ${!isCreator && isMod ? `<span class="rm-role-tag">🛡️ Mod</span>` : ""}
                  ${isBanned ? `<span class="rm-role-tag" style="color:var(--rm-danger);">Banned</span>` : ""}
                  ${isYou ? `<span class="rm-role-tag">You</span>` : ""}
                </div>
                <div class="rm-member-sub">@${escapeHtml(shortenKey(mPk))}</div>
              </div>
              <div class="rm-member-actions">
                ${!isYou && mPk !== "system" && !isBanned ? `<button type="button" class="rm-mini-act" data-dm-pk="${escapeHtml(mPk)}" title="Direct Message">💬</button>` : ""}
                ${mPk !== "system" ? `<button type="button" class="rm-mini-act" data-copy-pk="${escapeHtml(mPk)}" title="Copy public key">📋</button>` : ""}
                ${
                  isUserMod && !isYou && !isCreator && mPk !== "system"
                    ? isBanned
                      ? `<button type="button" class="rm-mini-act" data-comm-unban="${escapeHtml(mPk)}">Unban</button>`
                      : `<button type="button" class="rm-mini-act danger" data-comm-ban="${escapeHtml(mPk)}">Ban</button>`
                    : ""
                }
              </div>
            </div>
          `;
        })
        .join("");

      drawerContentEl.innerHTML = `
        <div class="rm-drawer-hero">
          <div class="rm-drawer-monogram rm-room-monogram comm">${escapeHtml(makeMonogram(comm.slug, true))}</div>
          <div class="rm-drawer-name">#r/${escapeHtml(comm.slug)}</div>
          <div class="rm-drawer-handle">${escapeHtml(comm.name)} · ${commPks.length} participants</div>
          ${comm.description ? `<p style="font-size:0.79rem;color:var(--rm-text-secondary);margin:8px 0 0;">${escapeHtml(comm.description)}</p>` : ""}
          <div class="rm-quick-tiles">
            <button type="button" class="rm-tile-btn" data-toggle-pin="${escapeHtml(curKey)}"><span>📌</span><span>${isPinned ? "Pinned" : "Pin"}</span></button>
            ${isUserMod ? `<button type="button" class="rm-tile-btn" data-clear-chat="1"><span>🧹</span><span>Clear</span></button>` : ""}
          </div>
        </div>
        <div class="rm-drawer-section" style="border-bottom:none;">
          <h4>Community Participants (${commPks.length})</h4>
          <div>${memberRows}</div>
        </div>
      `;
    }
  }

  function openSafetyModal() {
    const identity = deps.getIdentity();
    const target = safetyTarget();
    if (!identity || !target) return;

    const blocks = computeSafetyBlocks(identity.pubkey, target.material);
    safetyMeNameEl.textContent = deps.getAuthorDisplayName(identity.pubkey);
    safetyPeerNameEl.textContent = target.label;
    safetyGridEl.innerHTML = blocks.map((b) => `<span>${escapeHtml(b)}</span>`).join("");

    const isVer = verifiedSet().has(target.id);
    markVerifiedBtnEl.textContent = isVer ? "Unmark Verified" : "✓ Mark Verified";
    safetyModalEl.classList.add("open");
  }

  function renderContactPickerList() {
    const identity = deps.getIdentity();
    if (!identity) return;
    const me = identity.pubkey;
    const q = newChatInputEl.value.trim().toLowerCase();

    const candidates = Array.from(
      new Set([
        ...deps.getFollowingKeys(),
        ...freenet.getChatPeers(me),
        ...freenet.getDiscoveredPeers(me).map((p) => p.pubkey),
      ])
    ).filter((pk) => pk && pk !== me && pk !== "system");

    const filtered = candidates.filter((pk) => {
      if (!q) return true;
      const name = deps.getAuthorDisplayName(pk).toLowerCase();
      return name.includes(q) || pk.toLowerCase().includes(q) || personaName(pk).toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      contactPickerListEl.innerHTML = `
        <div style="padding: 16px; text-align: center; font-size: 0.8rem; color: var(--rm-text-muted);">
          ${/^[0-9a-f]{64}$/i.test(q)
            ? `Valid key detected! Click <b>Open DM</b> to start.`
            : `No matching contacts. You can paste any 64-character hex public key above.`}
        </div>
      `;
      return;
    }

    contactPickerListEl.innerHTML = filtered
      .slice(0, 60)
      .map((pk) => {
        const name = deps.getAuthorDisplayName(pk);
        const avatar = deps.getAuthorAvatarUrl(pk);
        const fallback = generateDefaultAvatar(pk);
        const isFollowed = deps.getFollowingKeys().includes(pk);
        const isRiver = freenet.riverOnly.has(pk);
        return `
          <button type="button" class="rm-contact-pick-row" data-pick-peer="${escapeHtml(pk)}">
            <img src="${safeUrl(avatar) || fallback}" alt="${escapeHtml(name)}" onerror="this.onerror=null;this.src='${fallback}'" />
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.86rem;font-weight:650;display:flex;align-items:center;gap:6px;">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(name)}</span>
                ${isFollowed ? `<span class="rm-origin-pill">Following</span>` : ""}
                ${isRiver ? `<span class="rm-origin-pill">River</span>` : ""}
              </div>
              <div style="font-family:var(--rm-font-mono);font-size:0.71rem;color:var(--rm-text-muted);">@${escapeHtml(shortenKey(personaName(pk)))}</div>
            </div>
          </button>
        `;
      })
      .join("");
  }

  function openNewChatModal() {
    newChatInputEl.value = "";
    renderContactPickerList();
    newChatModalEl.classList.add("open");
    setTimeout(() => newChatInputEl.focus(), 30);
  }

  // ---- Wire Interactive Listeners ----

  // Palette switcher (Radici Warm vs Signal Crisp)
  rootEl.querySelector("#rm-btn-palette")?.addEventListener("click", () => {
    const next = rootEl.getAttribute("data-palette") === "signal" ? "radici" : "signal";
    rootEl.setAttribute("data-palette", next);
    safeStorage.setItem(PALETTE_KEY, next);
    deps.showToast(next === "signal" ? "Signal Crisp palette enabled" : "Radici Warm palette enabled", "info");
  });

  // Mode Switcher inside Messenger header
  rootEl.querySelectorAll<HTMLButtonElement>("[data-layout-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.layoutMode as ChatLayoutMode;
      deps.onSwitchLayout(mode);
    });
  });

  // Inbox Search & Filter Chips
  inboxSearchEl.addEventListener("input", () => {
    inboxQuery = inboxSearchEl.value;
    inboxSearchClearEl.classList.toggle("visible", inboxQuery.length > 0);
    void refreshInbox();
  });

  inboxSearchClearEl.addEventListener("click", () => {
    inboxSearchEl.value = "";
    inboxQuery = "";
    inboxSearchClearEl.classList.remove("visible");
    void refreshInbox();
    inboxSearchEl.focus();
  });

  filterBarEl.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>(".rm-filter-chip");
    if (!chip) return;
    activeFilter = (chip.dataset.filter as typeof activeFilter) || "all";
    filterBarEl.querySelectorAll(".rm-filter-chip").forEach((c) => c.classList.toggle("active", c === chip));
    void refreshInbox();
  });

  // Conversation click in unified inbox
  convListEl.addEventListener("click", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-conv-key]");
    if (!row) return;
    const key = row.dataset.convKey!;
    mobileShowThread = true;
    workspaceEl.classList.add("mobile-thread-open");

    if (key.startsWith("dm:")) {
      void deps.onSelectPeer(key.slice(3));
    } else if (key.startsWith("priv:")) {
      const rId = key.slice(5);
      const found = deps.getAllPrivateRooms().find((r) => r.id === rId);
      if (found) void deps.onSelectPrivateRoom(found);
    } else if (key.startsWith("comm:")) {
      const cId = key.slice(5);
      const found = deps.getAllCommunities().find((c) => c.id === cId);
      if (found) void deps.onSelectCommunity(found);
    }
  });

  // Mobile back button (returns to unified inbox on phones)
  rootEl.querySelector("#rm-btn-mobile-back")?.addEventListener("click", () => {
    mobileShowThread = false;
    workspaceEl.classList.remove("mobile-thread-open");
  });

  // Header & Footer buttons
  rootEl.querySelector("#rm-btn-new-chat")?.addEventListener("click", () => openNewChatModal());
  rootEl.querySelector("#rm-btn-create-room")?.addEventListener("click", () => deps.onOpenCreateRoomModal());
  rootEl.querySelector("#rm-btn-invite-code")?.addEventListener("click", () => deps.onOpenJoinRoomModal());
  inviteTopBtn.addEventListener("click", () => deps.onOpenInviteRoomModal());
  safetyTopBtn.addEventListener("click", () => openSafetyModal());
  rootEl.querySelector("#rm-btn-fullscreen")?.addEventListener("click", () => deps.onToggleFullscreen());
  rootEl.querySelector("#rm-btn-close")?.addEventListener("click", () => deps.onCloseChat());
  rootEl.querySelector("#rm-btn-inbox-close")?.addEventListener("click", () => deps.onCloseChat());

  // Drawer toggle
  const setDrawer = (open: boolean) => {
    drawerOpen = open;
    drawerEl.classList.toggle("open", open);
    drawerToggleBtn.classList.toggle("active", open);
    if (open) refreshDrawer();
  };
  drawerToggleBtn.addEventListener("click", () => setDrawer(!drawerOpen));
  rootEl.querySelector("#rm-header-peer-trigger")?.addEventListener("click", () => {
    if (activeConvKey()) setDrawer(!drawerOpen);
  });
  rootEl.querySelector("#rm-btn-drawer-close")?.addEventListener("click", () => setDrawer(false));

  // In-thread Search
  rootEl.querySelector("#rm-btn-thread-search")?.addEventListener("click", () => {
    const open = threadSearchBarEl.classList.toggle("open");
    if (open) threadSearchInputEl.focus();
    else {
      threadQuery = "";
      threadSearchInputEl.value = "";
      renderThread();
    }
  });
  threadSearchInputEl.addEventListener("input", () => {
    threadQuery = threadSearchInputEl.value;
    renderThread();
  });
  rootEl.querySelector("#rm-thread-search-close")?.addEventListener("click", () => {
    threadQuery = "";
    threadSearchInputEl.value = "";
    threadSearchBarEl.classList.remove("open");
    renderThread();
  });

  // Delegated interactions inside messages stream
  messagesTrackEl.addEventListener("click", async (e) => {
    const t = e.target as HTMLElement;

    const postLink = t.closest<HTMLAnchorElement>(".post-link");
    if (postLink) {
      deps.onOpenPostLink(e, postLink);
      return;
    }

    const mentionEl = t.closest<HTMLElement>(".mention[data-author]");
    if (mentionEl?.dataset.author) {
      deps.onOpenUserProfile(mentionEl.dataset.author);
      return;
    }

    const profileBtn = t.closest<HTMLElement>("[data-open-profile]");
    if (profileBtn?.dataset.openProfile) {
      deps.onOpenUserProfile(profileBtn.dataset.openProfile);
      return;
    }

    const helloBtn = t.closest<HTMLElement>("[data-prefill-hello]");
    if (helloBtn) {
      const name = helloBtn.dataset.prefillHello!;
      composerInputEl.value = `Hi ${name}! 🌱`;
      fitInput();
      composerInputEl.focus();
      return;
    }

    if (t.closest("#rm-inline-verify-btn")) {
      openSafetyModal();
      return;
    }

    if (t.closest("#rm-empty-invite-btn")) {
      deps.onOpenInviteRoomModal();
      return;
    }

    const reactBtn = t.closest<HTMLElement>("[data-react-emoji]");
    if (reactBtn) {
      messagesTrackEl.querySelectorAll(".rm-msg-row.actions-open").forEach((el) => el.classList.remove("actions-open"));
      const st = deps.getActiveState();
      const peer = st.community || st.privateRoom ? undefined : st.peer ?? undefined;
      await deps.onReactMessage(reactBtn.dataset.roomId!, reactBtn.dataset.msgId!, reactBtn.dataset.reactEmoji!, peer);
      return;
    }

    const replyBtn = t.closest<HTMLElement>("[data-reply-msg]");
    if (replyBtn) {
      messagesTrackEl.querySelectorAll(".rm-msg-row.actions-open").forEach((el) => el.classList.remove("actions-open"));
      const msg = deps.getActiveState().shownMessages.find((m) => m.id === replyBtn.dataset.replyMsg) ?? null;
      deps.onSetReply(msg);
      composerInputEl.focus();
      return;
    }

    const delBtn = t.closest<HTMLElement>("[data-del-msg]");
    if (delBtn) {
      e.stopPropagation();
      messagesTrackEl.querySelectorAll(".rm-msg-row.actions-open").forEach((el) => el.classList.remove("actions-open"));
      await deps.onDeleteMessage(delBtn.dataset.roomId!, delBtn.dataset.delMsg!);
      return;
    }

    const jumpEl = t.closest<HTMLElement>("[data-jump-msg]");
    if (jumpEl?.dataset.jumpMsg) {
      const row = messagesTrackEl.querySelector<HTMLElement>(`[data-msg-id="${CSS.escape(jumpEl.dataset.jumpMsg)}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.add("flash-highlight");
        setTimeout(() => row.classList.remove("flash-highlight"), 1500);
      }
      return;
    }

    // Mobile tap on bubble toggles floating quick-action bar cleanly
    const tappedBubble = t.closest<HTMLElement>(".rm-bubble");
    if (tappedBubble && !t.closest(".fp-card, .ft-card, a, button") && !window.getSelection()?.toString()) {
      const row = tappedBubble.closest<HTMLElement>(".rm-msg-row");
      const wasOpen = row?.classList.contains("actions-open");
      messagesTrackEl.querySelectorAll(".rm-msg-row.actions-open").forEach((el) => el.classList.remove("actions-open"));
      if (row && !wasOpen) row.classList.add("actions-open");
    } else {
      messagesTrackEl.querySelectorAll(".rm-msg-row.actions-open").forEach((el) => el.classList.remove("actions-open"));
    }
  });

  // Delegated interactions inside Info Drawer
  drawerContentEl.addEventListener("click", async (e) => {
    const t = e.target as HTMLElement;
    const identity = deps.getIdentity();
    const st = deps.getActiveState();
    if (!identity) return;

    if (t.closest("#rm-drawer-verify-btn")) {
      openSafetyModal();
      return;
    }

    const prof = t.closest<HTMLElement>("[data-open-profile]");
    if (prof?.dataset.openProfile) {
      deps.onOpenUserProfile(prof.dataset.openProfile);
      return;
    }

    const pinBtn = t.closest<HTMLElement>("[data-toggle-pin]");
    if (pinBtn?.dataset.togglePin) {
      const on = togglePinned(pinBtn.dataset.togglePin);
      deps.showToast(on ? "Conversation pinned 📌" : "Conversation unpinned", "info");
      refreshDrawer();
      void refreshInbox();
      return;
    }

    if (t.closest("[data-clear-chat]")) {
      await deps.onClearActiveChat();
      return;
    }

    if (t.closest("[data-invite-room]")) {
      deps.onOpenInviteRoomModal();
      return;
    }

    if (t.closest("[data-copy-room-link]") && st.privateRoom) {
      const link = await deps.onGetInviteLink(st.privateRoom);
      if (link) {
        await navigator.clipboard.writeText(link);
        deps.showToast("Zero-knowledge invite link copied to clipboard!", "info");
      }
      return;
    }

    if (t.closest("[data-export-river-id]") && st.privateRoom) {
      try {
        const token = await freenet.exportRiverIdentity(identity, st.privateRoom);
        await navigator.clipboard.writeText(token);
        alert(
          "Your River identity for this room is copied to the clipboard.\n\nImport it in River (Import ID) or riverctl to be the same member there.\n\nIt holds your private key in this room: treat it like a password, do not share it."
        );
      } catch (err: any) {
        deps.showToast(`Could not export: ${err.message || err}`, "error");
      }
      return;
    }

    if (t.closest("[data-leave-room]") && st.privateRoom) {
      await deps.onLeavePrivateRoom(st.privateRoom);
      if (!deps.getActiveState().privateRoom) setDrawer(false);
      return;
    }

    const rmPeer = t.closest<HTMLElement>("[data-remove-peer]");
    if (rmPeer?.dataset.removePeer) {
      deps.onRemovePeer(rmPeer.dataset.removePeer);
      if (!deps.getActiveState().peer) setDrawer(false);
      return;
    }

    const dmBtn = t.closest<HTMLElement>("[data-dm-pk]");
    if (dmBtn?.dataset.dmPk) {
      await deps.onSelectPeer(dmBtn.dataset.dmPk);
      return;
    }

    const copyBtn = t.closest<HTMLElement>("[data-copy-pk]");
    if (copyBtn?.dataset.copyPk) {
      await navigator.clipboard.writeText(copyBtn.dataset.copyPk);
      deps.showToast("Public key copied to clipboard!", "info");
      return;
    }

    const modBtn = t.closest<HTMLElement>("[data-room-mod]");
    if (modBtn?.dataset.roomMod && st.privateRoom) {
      try {
        const updated = await freenet.setPrivateRoomModerator(
          identity,
          st.privateRoom.id,
          modBtn.dataset.roomMod,
          modBtn.dataset.modOn === "1"
        );
        await deps.onSelectPrivateRoom(updated);
      } catch (err: any) {
        alert(`Could not update moderator: ${err.message || err}`);
      }
      return;
    }

    const kickBtn = t.closest<HTMLElement>("[data-room-kick]");
    if (kickBtn?.dataset.roomKick && st.privateRoom) {
      const pk = kickBtn.dataset.roomKick;
      const name = deps.getAuthorDisplayName(pk);
      if (!confirm(`Kick ${name} from this private room?\n\nA new encryption key will be rotated for remaining members.`)) return;
      try {
        const updated = await freenet.kickMemberFromPrivateRoom(identity, st.privateRoom.id, pk);
        await deps.onSelectPrivateRoom(updated);
        deps.showToast(`${name} removed from room.`, "info");
      } catch (err: any) {
        alert(`Could not kick member: ${err.message || err}`);
      }
      return;
    }

    const banBtn = t.closest<HTMLElement>("[data-comm-ban]");
    if (banBtn?.dataset.commBan && st.community) {
      const pk = banBtn.dataset.commBan;
      const name = deps.getAuthorDisplayName(pk);
      if (!confirm(`Ban ${name} from r/${st.community.slug}?`)) return;
      try {
        const res = await freenet.banMemberFromCommunity(identity, st.community.id, pk);
        if (res.success && res.community) await deps.onSelectCommunity(res.community);
        else alert(res.msg);
      } catch (err: any) {
        alert(`Could not ban member: ${err.message || err}`);
      }
      return;
    }

    const unbanBtn = t.closest<HTMLElement>("[data-comm-unban]");
    if (unbanBtn?.dataset.commUnban && st.community) {
      try {
        const res = await freenet.unbanMemberFromCommunity(identity, st.community.id, unbanBtn.dataset.commUnban);
        if (res.success && res.community) await deps.onSelectCommunity(res.community);
        else alert(res.msg);
      } catch (err: any) {
        alert(`Could not unban member: ${err.message || err}`);
      }
    }
  });

  // Reply banner cancel
  rootEl.querySelector("#rm-reply-banner-cancel")?.addEventListener("click", () => {
    deps.onSetReply(null);
  });

  // Composer input & submit
  composerInputEl.addEventListener("input", fitInput);
  composerInputEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    composerFormEl.requestSubmit();
  });

  rootEl.querySelector("#rm-btn-quick-emoji")?.addEventListener("click", () => {
    if (composerInputEl.disabled) return;
    composerInputEl.value += (composerInputEl.value ? " " : "") + "🌱";
    fitInput();
    composerInputEl.focus();
  });

  composerFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = composerInputEl.value.trim();
    if (!raw) return;
    const sent = await deps.onSendMessage(raw, composerInputEl);
    if (sent) {
      composerInputEl.value = "";
      fitInput();
    }
  });

  // Attachment Popover Menu (100% real Freenet actions)
  rootEl.querySelector("#rm-btn-attach")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const roomLinkBtn = rootEl.querySelector("#rm-attach-room-link") as HTMLElement | null;
    if (roomLinkBtn) {
      roomLinkBtn.style.display = deps.getAllPrivateRooms().length > 0 ? "flex" : "none";
    }
    attachMenuEl.classList.toggle("open");
  });

  document.addEventListener("click", () => attachMenuEl.classList.remove("open"));

  attachMenuEl.addEventListener("click", async (e) => {
    e.stopPropagation();
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-attach]");
    if (!btn) return;
    attachMenuEl.classList.remove("open");
    const kind = btn.dataset.attach;
    const identity = deps.getIdentity();
    if (!identity) return;

    if (kind === "mention") {
      composerInputEl.value += (composerInputEl.value && !composerInputEl.value.endsWith(" ") ? " " : "") + "@";
      composerInputEl.focus();
      composerInputEl.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (kind === "my-key") {
      composerInputEl.value += (composerInputEl.value ? "\n" : "") + identity.pubkey;
      fitInput();
      composerInputEl.focus();
    } else if (kind === "room-link") {
      const st = deps.getActiveState();
      const targetRoom = st.privateRoom ?? deps.getAllPrivateRooms()[0];
      if (!targetRoom) {
        deps.showToast("You don't have any private rooms to share yet.", "warning");
        return;
      }
      const link = await deps.onGetInviteLink(targetRoom);
      if (link) {
        const rName = roomNameCache.get(targetRoom.id) || "Private Room";
        composerInputEl.value += (composerInputEl.value ? "\n" : "") + `Invite to "${rName}": ${link}`;
        fitInput();
        composerInputEl.focus();
      }
    } else if (kind === "poll") {
      if (!activeConvKey()) {
        deps.showToast("Select a conversation first.", "warning");
        return;
      }
      pollQuestionEl.value = "";
      pollOptionsEl.value = "";
      pollMultiEl.checked = false;
      pollModalEl.classList.add("open");
      setTimeout(() => pollQuestionEl.focus(), 30);
    }
  });

  // Safety Modal listeners
  rootEl.querySelector("#rm-safety-modal-close")?.addEventListener("click", () => safetyModalEl.classList.remove("open"));
  safetyModalEl.addEventListener("click", (e) => {
    if (e.target === safetyModalEl) safetyModalEl.classList.remove("open");
  });
  rootEl.querySelector("#rm-btn-copy-safety")?.addEventListener("click", async () => {
    const identity = deps.getIdentity();
    const target = safetyTarget();
    if (!identity || !target) return;
    const blocks = computeSafetyBlocks(identity.pubkey, target.material).join(" ");
    await navigator.clipboard.writeText(blocks);
    deps.showToast("Safety number copied to clipboard!", "info");
  });
  markVerifiedBtnEl.addEventListener("click", () => {
    const target = safetyTarget();
    if (!target) return;
    const on = toggleVerified(target.id);
    safetyModalEl.classList.remove("open");
    renderHeader();
    if (drawerOpen) refreshDrawer();
    deps.showToast(on ? `${target.label} marked as verified ✓` : "Verification removed", "info");
  });

  // New Chat Modal listeners
  rootEl.querySelector("#rm-new-chat-close")?.addEventListener("click", () => newChatModalEl.classList.remove("open"));
  newChatModalEl.addEventListener("click", (e) => {
    if (e.target === newChatModalEl) newChatModalEl.classList.remove("open");
  });
  rootEl.querySelector("#rm-modal-create-room")?.addEventListener("click", () => {
    newChatModalEl.classList.remove("open");
    deps.onOpenCreateRoomModal();
  });
  rootEl.querySelector("#rm-modal-join-room")?.addEventListener("click", () => {
    newChatModalEl.classList.remove("open");
    deps.onOpenJoinRoomModal();
  });
  newChatInputEl.addEventListener("input", () => renderContactPickerList());
  const startDmFromInput = () => {
    const raw = newChatInputEl.value.trim().toLowerCase();
    const identity = deps.getIdentity();
    if (!identity) return;
    if (/^[0-9a-f]{64}$/.test(raw)) {
      if (raw === identity.pubkey) {
        deps.showToast("You cannot start a chat with your own public key.", "warning");
        return;
      }
      newChatModalEl.classList.remove("open");
      mobileShowThread = true;
      workspaceEl.classList.add("mobile-thread-open");
      void deps.onSelectPeer(raw);
      return;
    }
    const firstBtn = contactPickerListEl.querySelector<HTMLElement>("[data-pick-peer]");
    if (firstBtn?.dataset.pickPeer) {
      newChatModalEl.classList.remove("open");
      mobileShowThread = true;
      workspaceEl.classList.add("mobile-thread-open");
      void deps.onSelectPeer(firstBtn.dataset.pickPeer);
    } else {
      deps.showToast("Enter a valid 64-character hex public key or pick a contact.", "warning");
    }
  };
  rootEl.querySelector("#rm-new-chat-go")?.addEventListener("click", startDmFromInput);
  newChatInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      startDmFromInput();
    }
  });
  contactPickerListEl.addEventListener("click", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-pick-peer]");
    if (!row?.dataset.pickPeer) return;
    newChatModalEl.classList.remove("open");
    mobileShowThread = true;
    workspaceEl.classList.add("mobile-thread-open");
    void deps.onSelectPeer(row.dataset.pickPeer);
  });

  // FreePolls Creator Modal listeners
  const closePollModal = () => pollModalEl.classList.remove("open");
  rootEl.querySelector("#rm-poll-close")?.addEventListener("click", closePollModal);
  rootEl.querySelector("#rm-poll-cancel")?.addEventListener("click", closePollModal);
  pollModalEl.addEventListener("click", (e) => {
    if (e.target === pollModalEl) closePollModal();
  });
  pollSubmitBtnEl.addEventListener("click", async () => {
    const question = pollQuestionEl.value.trim();
    const options = [...new Set(pollOptionsEl.value.split("\n").map((o) => o.trim()).filter(Boolean))].slice(0, 20);
    if (!question || options.length < 2) {
      deps.showToast("Enter a question and at least two options (one per line).", "warning");
      return;
    }
    pollSubmitBtnEl.disabled = true;
    pollSubmitBtnEl.textContent = "Publishing to node…";
    try {
      const link = await deps.onCreatePollLink(question, options, pollMultiEl.checked);
      closePollModal();
      await deps.onSendMessage(`📊 ${question}\n${link}`);
    } catch (err: any) {
      deps.showToast(`Could not create poll: ${err.message || err}`, "error");
    } finally {
      pollSubmitBtnEl.disabled = false;
      pollSubmitBtnEl.textContent = "Publish & Send";
    }
  });

  return {
    composerInputEl,
    refreshInbox,
    renderThread,
    refreshDrawer: () => {
      if (drawerOpen) refreshDrawer();
    },
    renderReplyBanner,
    updateStatusBanner,
    showInboxOnMobileIfEmpty: () => {
      if (!activeConvKey()) {
        mobileShowThread = false;
        workspaceEl.classList.remove("mobile-thread-open");
      } else {
        workspaceEl.classList.toggle("mobile-thread-open", mobileShowThread);
      }
    },
    openThreadOnMobile: () => {
      mobileShowThread = true;
      workspaceEl.classList.add("mobile-thread-open");
    },
  };
}
