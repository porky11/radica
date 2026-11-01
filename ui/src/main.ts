import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import { UPDATES } from "./updates";
import { ecosystemFooter, ecosystemCard } from "./ecosystem";
import { installModalDismiss } from "./modals";
import { findCommunities, type CommunitySort } from "./communityFinder";
import { getIdentity, personaName } from "./crypto";
import { linkify, renderCaption, renderPost, renderComment, mentionsIn, nodeOrigin } from "./caption.ts";
import { deltaPrefixOf, pageHref } from "./delta.ts";
import { nameHref } from "./freenames.ts";
import { attachMentionPicker, withMentionKeys } from "./mentionPicker.ts";
import { rootsSvg } from "./roots.ts";
import "./chat.css";
import "./messengerChat.css";
import { createMessengerChat, type ChatLayoutMode } from "./messengerChat.ts";
import {
  finishSignIn,
  startSignIn,
  officialViso,
  createLocalIdentity,
  localIdentityKey,
  signOut,
  goTo,
  certShowsHost,
  restart,
} from "./whoiam";
import { freenet } from "./freenet";
import { CHAT_REACTIONS } from "./logfold";
import { analyzeImageFile, analyzeTextContent, censorTextAndPII, type ImageModerationResult } from "./moderation";
import { renderIcon } from "./icons";
import { safeStorage } from "./storage";
import { FEED_BUDGET, FEED_TARGET, feedBytes, formatBytes, oldestToFree } from "./feedsize";
import { generateDefaultAvatar, compressAvatarFile, compressPostImageFile } from "./avatar";
import type {
  Post,
  Comment,
  PostCategory,
  UserIdentity,
  ProfileInfo,
  ChatMessage,
  NotificationItem,
  Community,
  PrivateRoom,
} from "./types.ts";
import { likers } from "./types.ts";
import { METRIC_LABELS, countsOf, nextUp, reached, type Counts } from "./milestones.ts";
import { growRoots } from "./rootsfx.ts";
import { fillFreetunes, freetunesCard } from "./freetunes.ts";
import { createPoll, fillFreepolls, freepollsCard, type PollNet } from "./freepolls.ts";
import { mediaRef, mediaUrl } from "./media.ts";
import { yieldToMain } from "./limit.ts";

let currentIdentity: UserIdentity | null = null;
let currentProfile: ProfileInfo | null = null;
let currentCategory: "all" | PostCategory = "all";
let activeComposerType: PostCategory = "thought";
let timelinePosts: Post[] = [];
let followingKeys: string[] = [];
let activeChatPeer: string | null = null;
let activeChatCommunity: Community | null = null;
let activeChatPrivateRoom: PrivateRoom | null = null;
let allCommunities: Community[] = [];
let allPrivateRooms: PrivateRoom[] = [];
let activeCommunity: Community | null = null;

const POSTS_PER_PAGE = 20;
let visiblePosts = POSTS_PER_PAGE;
let lastPageKey = "";
let activeTagFilter: string | null = null;
let searchQuery: string = "";
let currentFeedScope: "explore" | "following" | "myposts" = "explore";
let feedAuthor: string | null = null; // "myposts" showing someone else's posts (opened from their profile)
let currentMediaNsfw = false;
// the scanner misreads pale animals and faces (seal 70%, ferret 71%, a clothed face 53%): 50-80% posts blurred, 80%+ is refused
const NSFW_SENSITIVE = 0.5;
const NSFW_BLOCK = 0.8;
let currentMediaNsfwScore = 0;

// Non-blocking toast notification helper
function showToast(message: string, type: "info" | "warning" | "error" = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// Theme Elements
const themeToggleBtn = document.getElementById("theme-toggle-btn") as HTMLButtonElement | null;
const themeIcon = document.getElementById("theme-icon") as HTMLElement | null;

// Identity & Key Management Elements
const openIdentityBtn = document.getElementById("open-identity-btn") as HTMLButtonElement | null;
const identityModal = document.getElementById("identity-modal") as HTMLElement;
const identityCloseBtn = document.getElementById("identity-close-btn") as HTMLButtonElement;
const identityTypeBadge = document.getElementById("identity-type-badge") as HTMLElement;
const identityPersonaName = document.getElementById("identity-persona-name") as HTMLElement;
const identityPubkeyVal = document.getElementById("identity-pubkey-val") as HTMLElement;
const identityBackupActions = document.getElementById("identity-backup-actions") as HTMLElement;
const identityVisoActions = document.getElementById("identity-viso-actions") as HTMLElement;
const idShowKeyBtn = document.getElementById("id-show-key-btn") as HTMLButtonElement;
const idDownloadKeyBtn = document.getElementById("id-download-key-btn") as HTMLButtonElement;
const idSecretKeyDisplay = document.getElementById("id-secret-key-display") as HTMLElement;
const idSignoutBtn = document.getElementById("id-signout-btn") as HTMLButtonElement;
const idVisoSignoutBtn = document.getElementById("id-viso-signout-btn") as HTMLButtonElement;
const visoUrlInput = document.getElementById("viso-url-input") as HTMLInputElement;
const visoSigninBtn = document.getElementById("viso-signin-btn") as HTMLButtonElement;
const visoUseOfficialBtn = document.getElementById("viso-use-official-btn") as HTMLButtonElement;
const visoStatusMsg = document.getElementById("viso-status-msg") as HTMLElement;
const createNewKeyBtn = document.getElementById("create-new-key-btn") as HTMLButtonElement;
const localCreateMsg = document.getElementById("local-create-msg") as HTMLElement;
const importKeyInput = document.getElementById("import-key-input") as HTMLInputElement;
const importKeyBtn = document.getElementById("import-key-btn") as HTMLButtonElement;
const localImportMsg = document.getElementById("local-import-msg") as HTMLElement;

// Navbar Elements
const freenetDot = document.getElementById("freenet-dot") as HTMLElement;
const freenetStatusLabel = document.getElementById("freenet-status-label") as HTMLElement;
const myPubkeyBadge = document.getElementById("my-pubkey-badge") as HTMLElement;
const openChatBtn = document.getElementById("open-chat-btn") as HTMLButtonElement;
const openNotifsBtn = document.getElementById("open-notifs-btn") as HTMLButtonElement;
const notifBadge = document.getElementById("notif-badge") as HTMLElement;
const feedSearchInput = document.getElementById("feed-search-input") as HTMLInputElement;

// Sidebar Elements
const sidebarName = document.getElementById("sidebar-name") as HTMLElement;
const sidebarBio = document.getElementById("sidebar-bio") as HTMLElement;
const sidebarHandle = document.getElementById("sidebar-handle") as HTMLElement | null;
const sidebarAvatar = document.getElementById("sidebar-avatar") as HTMLImageElement;
const sidebarStatMyPosts = document.getElementById("sidebar-stat-myposts") as HTMLButtonElement | null;
const sidebarMyPostsCount = document.getElementById("sidebar-my-posts-count") as HTMLElement | null;
const sidebarMyFollowingCount = document.getElementById("sidebar-my-following-count") as HTMLElement | null;
const postsContainer = document.getElementById("posts-container") as HTMLElement;
const editProfileBtn = document.getElementById("edit-profile-btn") as HTMLButtonElement;
const followingCount = document.getElementById("following-count") as HTMLElement;
const followForm = document.getElementById("follow-form") as HTMLFormElement;
const followPubkeyInput = document.getElementById("follow-pubkey-input") as HTMLInputElement;
const followingList = document.getElementById("following-list") as HTMLElement;
const discoveredPeersList = document.getElementById("discovered-peers-list") as HTMLElement;
const followersList = document.getElementById("followers-list") as HTMLElement;
followersList?.addEventListener("click", (e) => {
  const pk = (e.target as HTMLElement).closest<HTMLElement>(".author-clickable")?.dataset.author;
  if (pk) openUserProfile(pk);
});
const communitiesList = document.getElementById("communities-list") as HTMLElement;
const findCommInput = document.getElementById("find-comm-input") as HTMLInputElement;
const commSortSelect = document.getElementById("comm-sort-select") as HTMLSelectElement;
const openCreateCommBtn = document.getElementById("open-create-comm-btn") as HTMLButtonElement;

// Main Feed & Filter Banners
const scopeExploreBtn = document.getElementById("scope-explore-btn") as HTMLButtonElement;
const scopeFollowingBtn = document.getElementById("scope-following-btn") as HTMLButtonElement;
const scopeFollowingCount = document.getElementById("scope-following-count") as HTMLElement;
const scopeMyPostsBtn = document.getElementById("scope-myposts-btn") as HTMLButtonElement;
const scopeMyPostsCount = document.getElementById("scope-myposts-count") as HTMLElement;

const activeFilterBanner = document.getElementById("active-filter-banner") as HTMLElement;
const activeFilterTag = document.getElementById("active-filter-tag") as HTMLElement;
const clearFilterBtn = document.getElementById("clear-filter-btn") as HTMLButtonElement;

const communityHeaderBanner = document.getElementById("community-header-banner") as HTMLElement;
const commBannerSlug = document.getElementById("comm-banner-slug") as HTMLElement;
const commBannerDesc = document.getElementById("comm-banner-desc") as HTMLElement;
const commRoleBadge = document.getElementById("comm-role-badge") as HTMLElement;
const commMembersCount = document.getElementById("comm-members-count") as HTMLElement;
const commModsCount = document.getElementById("comm-mods-count") as HTMLElement;
const commJoinBtn = document.getElementById("comm-join-btn") as HTMLButtonElement;
const commChatBtn = document.getElementById("comm-chat-btn") as HTMLButtonElement | null;
const commModBtn = document.getElementById("comm-mod-btn") as HTMLButtonElement;
const commEditBtn = document.getElementById("comm-edit-btn") as HTMLButtonElement;
const commBannerName = document.getElementById("comm-banner-name") as HTMLElement;
const commExitBtn = document.getElementById("comm-exit-btn") as HTMLButtonElement;

// Composer Elements
const composerCommunitySelect = document.getElementById("composer-community-select") as HTMLSelectElement;
const postCaption = document.getElementById("post-caption") as HTMLTextAreaElement;
const momentFields = document.getElementById("moment-fields") as HTMLElement;
const eventFields = document.getElementById("event-fields") as HTMLElement;
const postFilePicker = document.getElementById("post-file-picker") as HTMLInputElement;
const postMediaUrl = document.getElementById("post-media-url") as HTMLInputElement;
const imagePreviewContainer = document.getElementById("image-preview-container") as HTMLElement;
const imagePreview = document.getElementById("image-preview") as HTMLImageElement;
const clearImageBtn = document.getElementById("clear-image-btn") as HTMLButtonElement;
const moderationStatus = document.getElementById("moderation-status") as HTMLElement;
const moderationBadgeText = document.getElementById("moderation-badge-text") as HTMLElement;
const nsfwManualToggle = document.getElementById("nsfw-manual-toggle") as HTMLInputElement | null;
const postLocation = document.getElementById("post-location") as HTMLInputElement;
const postEventDate = document.getElementById("post-event-date") as HTMLInputElement;
const publishBtn = document.getElementById("publish-btn") as HTMLButtonElement;

// Category counter badges
const countAll = document.getElementById("count-all") as HTMLElement;
const countThought = document.getElementById("count-thought") as HTMLElement;
const countMoment = document.getElementById("count-moment") as HTMLElement;
const countEvent = document.getElementById("count-event") as HTMLElement;

// Edit Profile Modal
const profileModal = document.getElementById("profile-modal") as HTMLElement;
const modalAvatarPreview = document.getElementById("modal-avatar-preview") as HTMLImageElement;
const modalAvatarFileInput = document.getElementById("modal-avatar-file-input") as HTMLInputElement;
const modalAvatarResetBtn = document.getElementById("modal-avatar-reset-btn") as HTMLButtonElement;
const modalNameInput = document.getElementById("modal-name-input") as HTMLInputElement;
const modalBioInput = document.getElementById("modal-bio-input") as HTMLTextAreaElement;
const modalDeltaInput = document.getElementById("modal-delta-input") as HTMLInputElement;
const modalAvatarInput = document.getElementById("modal-avatar-input") as HTMLInputElement;
const modalCancelBtn = document.getElementById("modal-cancel-btn") as HTMLButtonElement;
const modalSaveBtn = document.getElementById("modal-save-btn") as HTMLButtonElement;

// User Profile View Modal
const userProfileModal = document.getElementById("user-profile-modal") as HTMLElement;
const uviewAvatar = document.getElementById("uview-avatar") as HTMLImageElement;
const uviewName = document.getElementById("uview-name") as HTMLElement;
const uviewKey = document.getElementById("uview-key") as HTMLElement;
const uviewBio = document.getElementById("uview-bio") as HTMLElement;
const uviewFollowBtn = document.getElementById("uview-follow-btn") as HTMLButtonElement;
const uviewTalkBtn = document.getElementById("uview-talk-btn") as HTMLButtonElement;
const uviewHideBtn = document.getElementById("uview-hide-btn") as HTMLButtonElement;

// Authors I hid: only on this device, their posts vanish from every feed here.
const HIDDEN_KEY = "radica_hidden_users";
function hiddenUsers(): string[] {
  try {
    const list = JSON.parse(safeStorage.getItem(HIDDEN_KEY) || "[]");
    return Array.isArray(list) ? list.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}
function setUserHidden(pubkey: string, hide: boolean): void {
  const rest = hiddenUsers().filter((k) => k !== pubkey);
  saveList(HIDDEN_KEY, hide ? [...rest, pubkey] : rest);
}
// the sandboxed page storage does not outlive a session in Freenet: these lists are kept on the node too
function saveList(key: string, list: string[]): void {
  const json = JSON.stringify(list);
  safeStorage.setItem(key, json);
  void import("./delegate.ts").then((m) => m.nodePut(key, json), () => {});
}
const listsFromNode = Promise.all(
  [HIDDEN_KEY, "radica_trusted_blocklists"].map(async (key) => {
    if (safeStorage.getItem(key)) return;
    const saved = await import("./delegate.ts").then((m) => m.nodeGet(key), () => null);
    if (saved) safeStorage.setItem(key, saved);
  }),
);
// Curators whose public blocklist I follow: whoever they block, and the posts they report, are hidden for me too.
const TRUSTED_KEY = "radica_trusted_blocklists";
/** Radica's maintainer: trusted until the user stops trusting them in Blocklists. */
const DEFAULT_CURATOR = "464b576da4cc5bcf31febd41a863ac251d04024c19f1786b24ca6620a0cce53b";
function trustedCurators(): string[] {
  try {
    const list = JSON.parse(safeStorage.getItem(TRUSTED_KEY) ?? JSON.stringify([DEFAULT_CURATOR]));
    return Array.isArray(list) ? list.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}
function setCuratorTrusted(pubkey: string, trust: boolean): void {
  const rest = trustedCurators().filter((k) => k !== pubkey);
  saveList(TRUSTED_KEY, trust ? [...rest, pubkey] : rest);
}
function isHiddenAuthor(pubkey: string): boolean {
  return hiddenUsers().includes(pubkey) || trustedCurators().some((c) => freenet.blockedBy(c).has(pubkey));
}
function refreshTrustedBlocklists(): void {
  const me = currentIdentity?.pubkey;
  // my own list too: a new session starts with no copy of it
  for (const c of new Set([...trustedCurators(), ...(me ? [me] : [])])) void freenet.refreshLog(`blocklist/${c}`).then(() => {
      renderTimeline();
      if (blocklistsModal.style.display === "flex") renderBlocklists();
    });
}
function hideButtonHtml(hidden: boolean): string {
  return `<span class="btn-icon-text">${renderIcon(hidden ? "eye" : "ban", { className: "icon-xs" })} <span>${hidden ? "Unhide" : "Hide user"}</span></span>`;
}
const uviewBlockBtn = document.getElementById("uview-block-btn") as HTMLButtonElement;
const uviewTrustBtn = document.getElementById("uview-trust-btn") as HTMLButtonElement;
const uviewPostsGallery = document.getElementById("uview-posts-gallery") as HTMLElement;
const uviewCloseBtn = document.getElementById("uview-close-btn") as HTMLButtonElement;

// Chat Modal Elements
const chatModal = document.getElementById("chat-modal") as HTMLElement;
const chatBody = document.getElementById("chat-body") as HTMLElement | null;
const chatPeerInfo = document.getElementById("chat-peer-info") as HTMLElement;
const chatCommunitiesList = document.getElementById("chat-communities-list") as HTMLElement;
const chatPeersList = document.getElementById("chat-peers-list") as HTMLElement;
const chatMessagesList = document.getElementById("chat-messages-list") as HTMLElement;
const chatSendForm = document.getElementById("chat-send-form") as HTMLFormElement;
const chatMessageInput = document.getElementById("chat-message-input") as HTMLTextAreaElement;
// the message box grows with what is written (CSS caps it, then it scrolls); Enter sends, Shift+Enter starts a new line
const fitChatInput = () => {
  chatMessageInput.style.height = "auto";
  chatMessageInput.style.height = `${chatMessageInput.scrollHeight}px`;
};
chatMessageInput.addEventListener("input", fitChatInput);
chatMessageInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  chatSendForm.requestSubmit();
});
const chatReplyBar = document.getElementById("chat-reply-bar") as HTMLElement;
const chatReplyText = document.getElementById("chat-reply-text") as HTMLElement;
const chatReplyCancel = document.getElementById("chat-reply-cancel") as HTMLButtonElement;
const chatCloseBtn = document.getElementById("chat-close-btn") as HTMLButtonElement;
const chatClearBtn = document.getElementById("chat-clear-btn") as HTMLButtonElement;
const chatInviteBtn = document.getElementById("chat-invite-btn") as HTMLButtonElement | null;
const chatParticipantsToggleBtn = document.getElementById("chat-participants-toggle-btn") as HTMLButtonElement | null;
const chatParticipantsHeaderCount = document.getElementById("chat-participants-header-count") as HTMLElement | null;
const chatParticipantsSidebar = document.getElementById("chat-participants-sidebar") as HTMLElement | null;
const chatParticipantsTitle = document.getElementById("chat-participants-title") as HTMLElement | null;
const chatParticipantsCount = document.getElementById("chat-participants-count") as HTMLElement | null;
const chatParticipantsList = document.getElementById("chat-participants-list") as HTMLElement | null;
const chatPrivateRoomsList = document.getElementById("chat-private-rooms-list") as HTMLElement | null;
const newPrivateRoomBtn = document.getElementById("new-private-room-btn") as HTMLButtonElement | null;

// Create Private Room Modal Elements
const createPrivateRoomModal = document.getElementById("create-private-room-modal") as HTMLElement | null;
const createPrivroomCloseBtn = document.getElementById("create-privroom-close-btn") as HTMLButtonElement | null;
const createPrivroomCancelBtn = document.getElementById("create-privroom-cancel-btn") as HTMLButtonElement | null;
const createPrivroomSubmitBtn = document.getElementById("create-privroom-submit-btn") as HTMLButtonElement | null;
const privroomNameInput = document.getElementById("privroom-name-input") as HTMLInputElement | null;
const privroomMembersInput = document.getElementById("privroom-members-input") as HTMLTextAreaElement | null;
const privroomQuickPick = document.getElementById("privroom-quick-pick") as HTMLElement | null;

// Invite Private Room Modal Elements
const invitePrivroomModal = document.getElementById("invite-privroom-modal") as HTMLElement | null;
const invitePrivroomCloseBtn = document.getElementById("invite-privroom-close-btn") as HTMLButtonElement | null;
const invitePrivroomCancelBtn = document.getElementById("invite-privroom-cancel-btn") as HTMLButtonElement | null;
const invitePrivroomSubmitBtn = document.getElementById("invite-privroom-submit-btn") as HTMLButtonElement | null;
const invitePrivroomKeyInput = document.getElementById("invite-privroom-key-input") as HTMLInputElement | null;
const invitePrivroomLinkInput = document.getElementById("invite-privroom-link-input") as HTMLInputElement | null;
const copyPrivroomLinkBtn = document.getElementById("copy-privroom-link-btn") as HTMLButtonElement | null;
const sharePrivroomLinkBtn = document.getElementById("share-privroom-link-btn") as HTMLButtonElement | null;
const copyLinkFeedback = document.getElementById("copy-link-feedback") as HTMLElement | null;

// Join Private Room Modal Elements
const joinPrivateRoomBtn = document.getElementById("join-private-room-btn") as HTMLButtonElement | null;
const joinPrivroomModal = document.getElementById("join-privroom-modal") as HTMLElement | null;
const joinPrivroomCloseBtn = document.getElementById("join-privroom-close-btn") as HTMLButtonElement | null;
const joinPrivroomCancelBtn = document.getElementById("join-privroom-cancel-btn") as HTMLButtonElement | null;
const joinPrivroomSubmitBtn = document.getElementById("join-privroom-submit-btn") as HTMLButtonElement | null;
const joinPrivroomInput = document.getElementById("join-privroom-input") as HTMLTextAreaElement | null;

installModalDismiss(); // Escape or a click outside closes the top popup

// "@" in the post box, comment box, or chat composer lists people I know of: those I follow first
attachMentionPicker("#post-caption, .comment-input, #chat-message-input, #rm-composer-input", (q) => {
  const me = currentIdentity?.pubkey;
  const query = q.toLowerCase();
  return Object.entries(freenet.knownPeers)
    .filter(([pk, p]) => pk !== me && p.display_name && !p.display_name.startsWith("Persona @") && p.display_name.toLowerCase().includes(query))
    .sort(([a], [b]) => Number(followingKeys.includes(b)) - Number(followingKeys.includes(a)))
    .map(([pubkey, p]) => ({ pubkey, name: p.display_name }));
});

// Notifications Modal Elements
const updatesModal = document.getElementById("updates-modal") as HTMLElement;
document.getElementById("updates-open-btn")!.addEventListener("click", () => {
  document.getElementById("updates-list")!.innerHTML = UPDATES.map(
    (u) => `<div><strong>${escapeHtml(u.date)}</strong><div>${escapeHtml(u.text)}</div></div>`
  ).join("");
  const ecoCard = document.getElementById("updates-ecosystem-card");
  if (ecoCard) ecoCard.innerHTML = ecosystemCard(nodeOrigin());
  updatesModal.style.display = "flex";
});
document.getElementById("updates-close-btn")!.addEventListener("click", () => (updatesModal.style.display = "none"));

// ---- Milestones (easter egg): five quick clicks on the "Radica" title ----
const milestonesModal = document.getElementById("milestones-modal") as HTMLElement;
const MS_SEEN = "radica_milestones_seen";
const networkCounts = (posts: Post[]): Counts =>
  countsOf(posts, allCommunities.length, Object.keys(freenet.knownPeers).length, freenet.knownPostCount(), freenet.hostedFeeds());
function renderMilestones(c: Counts) {
  const done = reached(c);
  const next = nextUp(c);
  document.getElementById("milestones-list")!.innerHTML =
    done.map((m) => `<li class="ms done"><span aria-hidden="true">🌱</span><span>${escapeHtml(m.text)}</span></li>`).join("") +
    next
      .map((m) => {
        const pct = Math.min(100, Math.round((c[m.metric] / m.at) * 100));
        return `<li class="ms next"><span>${c[m.metric].toLocaleString()} / ${m.at.toLocaleString()} ${METRIC_LABELS[m.metric]}</span><span class="ms-bar"><span style="width: ${pct}%"></span></span></li>`;
      })
      .join("") +
    `<li class="ms hidden">??? <span>more roots to grow</span></li>`;
  document.querySelectorAll<HTMLElement>("#milestones-list .ms").forEach((li, i) => li.style.setProperty("--i", String(i)));
}
let titleClicks: number[] = [];
document.querySelector(".feed-title")?.addEventListener("click", async () => {
  const now = Date.now();
  titleClicks = [...titleClicks.filter((t) => now - t < 2000), now];
  if (titleClicks.length < 5 || !currentIdentity) return;
  titleClicks = [];
  renderMilestones(networkCounts(await freenet.getExploreTimeline(currentIdentity)));
  milestonesModal.style.display = "flex";
  growRoots();
});
document.getElementById("milestones-close-btn")!.addEventListener("click", () => (milestonesModal.style.display = "none"));
// the milestones already announced, kept on the node too (page storage does not outlive a session in Freenet)
const msSeenOnNode = import("./delegate.ts").then((m) => m.nodeGet("milestones"), () => null).catch(() => null);
/** A cryptic hint when a milestone is reached; the very first count only takes note. */
async function checkMilestones(posts: Post[]) {
  const ids = reached(networkCounts(posts)).map((m) => m.id);
  let seen: string[] | null = null;
  try {
    seen = JSON.parse(safeStorage.getItem(MS_SEEN) ?? (await msSeenOnNode) ?? "null");
  } catch {}
  const fresh = ids.filter((id) => !seen?.includes(id));
  if (seen && fresh.length) {
    showToast("Something grew in the roots… 🌱", "info", 5000);
    growRoots();
  }
  if (!seen || fresh.length) {
    const all = JSON.stringify([...(seen ?? []), ...fresh]);
    safeStorage.setItem(MS_SEEN, all);
    void import("./delegate.ts").then((m) => m.nodePut("milestones", all), () => {});
  }
}
// Click a post picture to see it at full size.
document.addEventListener("click", (e) => {
  const img = (e.target as HTMLElement).closest(".gram-media img, .uview-post-thumb img") as HTMLImageElement | null;
  if (!img || img.closest(".nsfw-shielded:not(.revealed)")) return;
  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `<img src="${safeUrl(img.src)}" alt="Post media" />`;
  const close = () => {
    box.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && close();
  box.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(box);
});
const blocklistsModal = document.getElementById("blocklists-modal") as HTMLElement;
function renderBlocklists() {
  const me = currentIdentity!.pubkey;
  const row = (pk: string, note: string, action: string) =>
    `<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;"><span>${escapeHtml(getAuthorDisplayName(pk))} <small>${escapeHtml(note)}</small></span><button class="btn-secondary btn-sm" data-act="${action}" data-pk="${escapeHtml(pk)}">${action === "untrust" ? "Stop" : "Remove"}</button></div>`;
  const trusted = trustedCurators();
  document.getElementById("blocklists-trusted")!.innerHTML =
    trusted.map((c) => row(c, `blocks ${freenet.blockedBy(c).size}, reports ${freenet.reportedBy(c).size}${c === DEFAULT_CURATOR ? " (Radica's default)" : ""}`, "untrust")).join("") || "<small>None yet.</small>";
  document.getElementById("blocklists-mine")!.innerHTML =
    [...freenet.blockedBy(me)].map((t) => row(t, "", "unblock")).join("") || "<small>Empty.</small>";

  const reportsEl = document.getElementById("blocklists-reports");
  if (reportsEl) {
    const myReports = [...freenet.reportedBy(me).entries()];
    reportsEl.innerHTML = myReports.map(([target, reason]) => {
      const colon = target.indexOf(":");
      const author = colon > 0 ? target.slice(0, colon) : target;
      const postId = colon > 0 ? target.slice(colon + 1) : "";
      const authorName = getAuthorDisplayName(author);
      const reasonNote = reason ? `: "${reason.slice(0, 40)}"` : "";
      return `<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Post by <b>${escapeHtml(authorName)}</b> <small style="color: var(--text-muted);">${escapeHtml(reasonNote)}</small></span>
        <button class="btn-secondary btn-sm" data-act="unreport" data-author="${escapeHtml(author)}" data-post-id="${escapeHtml(postId)}">Unreport</button>
      </div>`;
    }).join("") || "<small>None yet.</small>";
  }
}
document.getElementById("blocklists-open-btn")!.addEventListener("click", () => {
  if (!currentIdentity) return;
  renderBlocklists();
  blocklistsModal.style.display = "flex";
  refreshTrustedBlocklists();
});
document.getElementById("blocklists-close-btn")!.addEventListener("click", () => (blocklistsModal.style.display = "none"));
blocklistsModal.addEventListener("click", async (e) => {
  const btn = (e.target as HTMLElement).closest("button[data-act]") as HTMLElement | null;
  if (!btn) return;
  if (btn.dataset.act === "untrust") setCuratorTrusted(btn.dataset.pk!, false);
  else if (btn.dataset.act === "unreport") await freenet.unreportPost(btn.dataset.author!, btn.dataset.postId!);
  else await freenet.setBlocked(btn.dataset.pk!, false);
  renderBlocklists();
  renderTimeline();
});
document.getElementById("blocklists-add-form")!.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("blocklists-add-input") as HTMLInputElement;
  const pk = input.value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(pk)) return alert("That is not a persona public key.");
  setCuratorTrusted(pk, true);
  input.value = "";
  renderBlocklists();
  refreshTrustedBlocklists();
});
const notifsModal = document.getElementById("notifs-modal") as HTMLElement;
const notifsList = document.getElementById("notifs-list") as HTMLElement;
const notifsCloseBtn = document.getElementById("notifs-close-btn") as HTMLButtonElement;
const notifsMarkReadBtn = document.getElementById("notifs-mark-read-btn") as HTMLButtonElement;

// Create Community Modal Elements
const createCommModal = document.getElementById("create-comm-modal") as HTMLElement;
const commNameInput = document.getElementById("comm-name-input") as HTMLInputElement;
const commSlugInput = document.getElementById("comm-slug-input") as HTMLInputElement;
const commDescInput = document.getElementById("comm-desc-input") as HTMLTextAreaElement;
const createCommCancelBtn = document.getElementById("create-comm-cancel-btn") as HTMLButtonElement;
const createCommSaveBtn = document.getElementById("create-comm-save-btn") as HTMLButtonElement;

// Community Moderation Modal Elements
const commModModal = document.getElementById("comm-mod-modal") as HTMLElement;
const modModalCommTitle = document.getElementById("mod-modal-comm-title") as HTMLElement;
const commModsList = document.getElementById("comm-mods-list") as HTMLElement;
const addModForm = document.getElementById("add-mod-form") as HTMLFormElement;
const addModPubkeyInput = document.getElementById("add-mod-pubkey-input") as HTMLInputElement;
const modDeletedCount = document.getElementById("mod-deleted-count") as HTMLElement;
const commDeletedPostsList = document.getElementById("comm-deleted-posts-list") as HTMLElement;
const commModCloseBtn = document.getElementById("comm-mod-close-btn") as HTMLButtonElement;

function shortenKey(k: string): string {
  if (k.length <= 12) return k;
  return `${k.substring(0, 6)}...${k.substring(k.length - 6)}`;
}

function getAuthorDisplayName(pubkey: string): string {
  if (currentIdentity && pubkey === currentIdentity.pubkey && currentProfile?.display_name) {
    return currentProfile.display_name;
  }
  const peer = freenet.knownPeers[pubkey];
  if (peer?.display_name) {
    return peer.display_name;
  }
  return `@${shortenKey(personaName(pubkey))}`;
}

function getAuthorAvatarUrl(pubkey: string): string {
  if (currentIdentity && pubkey === currentIdentity.pubkey && currentProfile?.avatar_url) {
    return currentProfile.avatar_url;
  }
  const peer = freenet.knownPeers[pubkey];
  if (peer?.avatar_url) {
    return peer.avatar_url;
  }
  return generateDefaultAvatar(pubkey);
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const rootsGraph = document.getElementById("roots-graph") as HTMLElement;
const rootsGraphBig = document.getElementById("roots-graph-big") as HTMLElement;
const composerAvatar = document.getElementById("composer-avatar") as HTMLImageElement;
composerAvatar.src = sidebarAvatar.src; // the default face until my profile loads
const ROOT_FRESH_MS = 24 * 60 * 60 * 1000;

/** The people I follow around me; those who posted in the last day pulse. */
function renderRoots() {
  if (!rootsGraph) return;
  const now = Date.now();
  // ponytail: single pass over timelinePosts for fresh authors + setHtmlIfChanged to avoid redundant SVG DOM rebuilds
  const freshAuthors = new Set<string>();
  for (const p of timelinePosts) if (now - p.timestamp < ROOT_FRESH_MS) freshAuthors.add(p.author);
  const roots = followingKeys.map((pk) => ({
    pk,
    name: getAuthorDisplayName(pk),
    fresh: freshAuthors.has(pk),
  }));
  roots.sort((a, b) => Number(b.fresh) - Number(a.fresh)); // the lively ones first, at the top
  const more = roots.length > 12 ? `<div class="roots-more">+${roots.length - 12} more</div>` : "";
  const html = roots.length ? rootsSvg(roots) + more : `<div class="roots-empty">Follow someone and your first root grows here.</div>`;
  setHtmlIfChanged(rootsGraph, html);
  if (rootsGraphBig) setHtmlIfChanged(rootsGraphBig, roots.length ? rootsSvg(roots, 24) : html);
  for (const id of ["roots-count", "pp-roots-count"]) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(roots.length);
  }
}

for (const graph of [rootsGraph, rootsGraphBig]) {
  graph?.addEventListener("click", (e) => {
    const node = (e.target as Element).closest<SVGGElement>(".root-node");
    if (node?.dataset.author) openUserProfile(node.dataset.author);
  });
  graph?.addEventListener("keydown", (e) => {
    const node = (e.target as Element).closest<SVGGElement>(".root-node");
    if (node?.dataset.author && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openUserProfile(node.dataset.author);
    }
  });
}

function updateCategoryCounts() {
  renderRoots();
  let thought = 0, moment = 0, event = 0;
  for (const p of timelinePosts) {
    if (p.category === "thought") thought++;
    else if (p.category === "moment") moment++;
    else if (p.category === "event") event++;
  }
  countAll.textContent = timelinePosts.length.toString();
  countThought.textContent = thought.toString();
  countMoment.textContent = moment.toString();
  countEvent.textContent = event.toString();
}

function renderFollowingList() {
  renderFollowers();
  freenet.warmPeers(followingKeys);
  followingCount.textContent = followingKeys.length.toString();
  if (scopeFollowingCount) {
    scopeFollowingCount.textContent = followingKeys.length.toString();
  }
  if (followingKeys.length === 0) {
    setHtmlIfChanged(followingList, `<div style="font-size: 0.8rem; color: var(--text-muted);">Not following anyone yet.</div>`);
    renderRoots();
    return;
  }

  const painted = setHtmlIfChanged(followingList, followingKeys
    .map(
      (pk) => `
    <div class="following-item">
      <div class="following-info author-clickable" data-author="${escapeHtml(pk)}" style="cursor: pointer;" title="View Profile">
        <img src="${safeUrl(getAuthorAvatarUrl(pk))}" class="following-img" onerror="this.onerror=null; this.src='${generateDefaultAvatar(pk)}'" />
        <span class="following-name">${escapeHtml(getAuthorDisplayName(pk))}</span>
      </div>
      <div style="display: flex; gap: 4px; align-items: center;">
        <button class="action-btn talk-btn" data-author="${escapeHtml(pk)}" title="Direct Message" style="font-size: 0.75rem; padding: 2px 4px;">${renderIcon("chat", { className: "icon-xs" })}</button>
        <button class="unfollow-btn" data-pubkey="${escapeHtml(pk)}" title="Unfollow">${renderIcon("x", { className: "icon-xs" })}</button>
      </div>
    </div>
  `
    )
    .join(""));

  // Following list click handlers
  if (painted) followingList.querySelectorAll(".unfollow-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const pk = (e.currentTarget as HTMLElement).dataset.pubkey!;
      if (!currentIdentity) return;
      await freenet.toggleFollow(currentIdentity, pk);
      followingKeys = followingKeys.filter((k) => k !== pk);
      renderFollowingList();
      renderDiscoveredPeers();
      await reloadPosts();
    });
  });

  if (painted) followingList.querySelectorAll(".author-clickable").forEach((el) => {
    el.addEventListener("click", (e) => {
      const pk = (e.currentTarget as HTMLElement).dataset.author!;
      openUserProfile(pk);
    });
  });

  if (painted) followingList.querySelectorAll(".talk-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const pk = (e.currentTarget as HTMLElement).dataset.author!;
      openChatWithPeer(pk);
    });
  });
  renderRoots();
}

/** People seen following me; shown only to me, without a number (it is never the whole count). */
function renderFollowers() {
  if (!followersList || !currentIdentity) return;
  const keys = freenet.followersOf(currentIdentity.pubkey);
  setHtmlIfChanged(
    followersList,
    keys
      .map((pk) => `<div class="following-item"><div class="following-info author-clickable" data-author="${escapeHtml(pk)}" style="cursor: pointer;" title="View Profile"><img src="${safeUrl(getAuthorAvatarUrl(pk))}" class="following-img" onerror="this.onerror=null; this.src='${generateDefaultAvatar(pk)}'" /><span class="following-name">${escapeHtml(getAuthorDisplayName(pk))}</span></div></div>`)
      .join("") || `<div style="font-size: 0.8rem; color: var(--text-muted);">Nobody seen yet: only people whose feed your node has read show here.</div>`,
  );
}

function renderDiscoveredPeers() {
  if (!discoveredPeersList || !currentIdentity) return;
  // only people who chose a name: default "Persona @…" accounts are noise
  const discoveredAll = freenet.getDiscoveredPeers(currentIdentity.pubkey);
  freenet.warmPeers(discoveredAll.map((p) => p.pubkey));
  // Exclude contacts that are only River room members and not native Radica personas with their own feed
  const peers = discoveredAll.filter(
    (p) =>
      !freenet.riverOnly.has(p.pubkey) &&
      freenet.knownPeers[p.pubkey]?.display_name &&
      !freenet.knownPeers[p.pubkey].display_name.startsWith("Persona @")
  );
  if (peers.length === 0) {
    setHtmlIfChanged(discoveredPeersList, `<div style="font-size: 0.8rem; color: var(--text-muted);">No other peers detected yet. Open another tab to connect!</div>`);
    return;
  }

  const painted = setHtmlIfChanged(discoveredPeersList, peers
    .map((p) => {
      const isFollowing = followingKeys.includes(p.pubkey);
      return `
      <div class="discovered-item">
        <div class="discovered-info author-clickable" data-author="${escapeHtml(p.pubkey)}" style="cursor: pointer;" title="View Profile">
          <img src="${safeUrl(getAuthorAvatarUrl(p.pubkey))}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" onerror="this.onerror=null; this.src='${generateDefaultAvatar(p.pubkey)}'" />
          <span style="font-weight: 600;">${escapeHtml(getAuthorDisplayName(p.pubkey))}</span>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button class="talk-btn action-btn" data-author="${escapeHtml(p.pubkey)}" title="Send Message" style="font-size: 0.75rem; padding: 2px 4px;">${renderIcon("chat", { className: "icon-xs" })}</button>
          <button class="action-btn toggle-follow-peer-btn ${isFollowing ? "btn-secondary" : "btn-primary"} btn-icon-text" data-pubkey="${escapeHtml(p.pubkey)}" style="font-size: 0.75rem; padding: 2px 8px;">
            ${isFollowing ? `${renderIcon("userCheck", { className: "icon-xs" })} <span>Following</span>` : `${renderIcon("userPlus", { className: "icon-xs" })} <span>Follow</span>`}
          </button>
        </div>
      </div>
    `;
    })
    .join(""));

  if (painted) discoveredPeersList.querySelectorAll(".toggle-follow-peer-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const targetPk = (e.currentTarget as HTMLElement).dataset.pubkey!;
      if (!currentIdentity) return;
      const isNowFollowing = await freenet.toggleFollow(currentIdentity, targetPk);
      if (isNowFollowing) {
        if (!followingKeys.includes(targetPk)) followingKeys.push(targetPk);
      } else {
        followingKeys = followingKeys.filter((k) => k !== targetPk);
      }
      renderFollowingList();
      renderDiscoveredPeers();
      await reloadPosts();
    });
  });

  if (painted) discoveredPeersList.querySelectorAll(".author-clickable").forEach((el) => {
    el.addEventListener("click", (e) => {
      const pk = (e.currentTarget as HTMLElement).dataset.author!;
      openUserProfile(pk);
    });
  });

  if (painted) discoveredPeersList.querySelectorAll(".talk-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const pk = (e.currentTarget as HTMLElement).dataset.author!;
      openChatWithPeer(pk);
    });
  });
}

// How much my published posts weigh against the app's soft budget; over it, "Free space" deletes the oldest ones.
function renderFeedSize(posts: Post[]) {
  const label = document.getElementById("feed-size");
  const btn = document.getElementById("feed-free-btn") as HTMLButtonElement | null;
  if (!label || !btn) return;
  const used = feedBytes(posts);
  label.textContent = `${formatBytes(used)} of ${formatBytes(FEED_BUDGET)}`;
  label.style.color = used > FEED_BUDGET ? "#ef4444" : used > FEED_BUDGET * 0.8 ? "#f59e0b" : "";
  const bar = document.getElementById("feed-size-bar");
  if (bar) {
    bar.style.width = `${Math.min(100, Math.max(1, (used / FEED_BUDGET) * 100))}%`;
    bar.style.background = label.style.color;
  }
  btn.style.display = used > FEED_BUDGET ? "" : "none";
  btn.onclick = async () => {
    if (!currentIdentity) return;
    const ids = oldestToFree(posts, FEED_TARGET);
    if (!ids.length) return;
    if (!confirm(`Delete your ${ids.length} oldest post(s) to bring the feed down to about ${formatBytes(FEED_TARGET)}?\n\nThis cannot be undone.`)) return;
    for (const id of ids) await freenet.deletePost(currentIdentity, id);
    await reloadPosts();
    await updateMyPostsAndScopeCounts();
  };
}

let sizedPosts: object | undefined;
async function updateMyPostsAndScopeCounts() {
  if (!currentIdentity) return;
  try {
    const myFeed = await freenet.getFeed(currentIdentity.pubkey);
    const myCount = Object.keys(myFeed.posts || {}).length;
    if (scopeMyPostsCount) scopeMyPostsCount.textContent = myCount.toString();
    if (sidebarMyPostsCount) sidebarMyPostsCount.textContent = myCount.toString();
    document.getElementById("pp-posts-count")!.textContent = myCount.toString();
    // measuring re-serializes every post (up to 16 MB) and this runs on each sync pass: getFeed hands back the same object while the stored feed is unchanged
    if (myFeed.posts !== sizedPosts) {
      sizedPosts = myFeed.posts;
      renderFeedSize(Object.values(myFeed.posts || {}));
    }
    if (scopeFollowingCount) scopeFollowingCount.textContent = followingKeys.length.toString();
    if (sidebarMyFollowingCount) sidebarMyFollowingCount.textContent = followingKeys.length.toString();
    if (followingCount) followingCount.textContent = followingKeys.length.toString();
  } catch (err) {
    console.warn("Could not update scope counts:", err);
  }
}

async function reloadPosts() {
  if (!currentIdentity) return;
  refreshTrustedBlocklists();
  if (currentFeedScope === "explore") {
    timelinePosts = await freenet.getExploreTimeline(currentIdentity);
    void checkMilestones(timelinePosts);
  } else if (currentFeedScope === "following") {
    timelinePosts = await freenet.getTimeline(currentIdentity);
  } else if (currentFeedScope === "myposts") {
    const myFeed = await freenet.getFeed(feedAuthor ?? currentIdentity.pubkey);
    timelinePosts = Object.values(myFeed.posts || {}).sort((a, b) => b.timestamp - a.timestamp);
  }
  await yieldToMain(); // gathering the posts and drawing them are separate tasks
  renderTimeline();
  updateMyPostsAndScopeCounts();
}

/** The community a post was published in (posts name it by id or slug). */
const communityOf = (p: Post): Community | undefined =>
  p.community_id ? allCommunities.find((c) => c.id === p.community_id || c.slug === p.community_id) : undefined;

/** Joined communities only: the sidebar, composer and feed show these, the rest are found by name. */
const isJoined = (c: Community) => c.members.includes(currentIdentity?.pubkey ?? "");

function renderTimeline() {
  if (!currentIdentity) return;

  // ponytail: build hidden author set and community map once per render instead of per-post JSON.parse + linear scans
  const hidden = new Set(hiddenUsers());
  for (const c of trustedCurators()) for (const pk of freenet.blockedBy(c)) hidden.add(pk);
  const commByRef = new Map<string, Community>();
  for (const c of allCommunities) {
    commByRef.set(c.id, c);
    commByRef.set(c.slug, c);
  }
  const commOf = (p: Post) => (p.community_id ? commByRef.get(p.community_id) : undefined);

  const me = currentIdentity.pubkey;
  const reported = new Set<string>();
  for (const c of new Set([...trustedCurators(), me])) for (const k of freenet.reportedBy(c).keys()) reported.add(k);

  // Filter pipeline
  let filtered = timelinePosts.filter((p) => !hidden.has(p.author) && (p.author === me || !reported.has(`${p.author}:${p.id}`)));
  // the global feed carries posts of communities I joined (and mine); an unjoined one is opened by finding it
  if (!activeCommunity && currentFeedScope !== "myposts") {
    filtered = filtered.filter((p) => {
      const c = commOf(p);
      return !c || isJoined(c) || p.author === currentIdentity!.pubkey;
    });
  }
  // a post a moderator removed from its community leaves every feed, not only the community's (my own posts keep it)
  if (currentFeedScope !== "myposts") filtered = filtered.filter((p) => !commOf(p)?.deleted_post_ids.includes(p.id));

  // 1. Community filter
  if (activeCommunity) {
    filtered = filtered.filter(
      (p) =>
        (p.community_id === activeCommunity!.id || p.community_id === activeCommunity!.slug) &&
        !activeCommunity!.deleted_post_ids.includes(p.id)
    );
  }

  // 2. Category filter
  if (currentCategory !== "all") {
    filtered = filtered.filter((p) => p.category === currentCategory);
  }

  // 3. Hashtag filter
  if (activeTagFilter) {
    filtered = filtered.filter((p) =>
      p.caption.toLowerCase().includes("#" + activeTagFilter!.toLowerCase())
    );
  }

  // 4. Search query filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.caption.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        (p.location && p.location.toLowerCase().includes(q))
    );
  }

  updateCategoryCounts();

  if (filtered.length === 0) {
    if (currentFeedScope === "myposts" && !feedAuthor) {
      postsContainer.innerHTML = `
        <div class="empty-state">
          <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">You haven't published any posts yet.</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Share your first thought, moment, or event using the composer above!</p>
        </div>
      `;
    } else {
      postsContainer.innerHTML = `
        <div class="empty-state">
          <p>No posts match the current filter. Be the first to publish on Freenet!</p>
        </div>
      `;
    }
    return;
  }

  // Page the feed: a long feed is drawn 20 posts at a time. Any change of filter starts again from the first page.
  const pageKey = [currentFeedScope, activeCommunity?.id, currentCategory, activeTagFilter, searchQuery].join("|");
  if (pageKey !== lastPageKey) {
    lastPageKey = pageKey;
    visiblePosts = POSTS_PER_PAGE;
  }
  const moreHtml =
    filtered.length > visiblePosts
      ? `<div class="load-more"><button type="button" class="btn-secondary" id="load-more-btn">Show more (${filtered.length - visiblePosts} left)</button></div>`
      : "";

  const items = filtered
    .slice(0, visiblePosts)
    .filter((post) => SAFE_ID.test(post.id) && HEX64.test(post.author))
    .map((post) => {
      const isLiked = !!post.likes?.[currentIdentity!.pubkey]?.liked;
      const isMyPost = post.author === currentIdentity!.pubkey;
      const isModOrOwner =
        activeCommunity &&
        (activeCommunity.creator === currentIdentity!.pubkey ||
          activeCommunity.moderators.includes(currentIdentity!.pubkey));
      // an empty comment is one its author took back (freenet.deleteComment)
      const commentsArray = Object.values(post.comments).filter((c) => c.text !== "").sort((a, b) => a.timestamp - b.timestamp);
      const authorDisplayName = getAuthorDisplayName(post.author);
      const authorAvatar = getAuthorAvatarUrl(post.author);
      const postComm = commOf(post);
      const authorIsMod = !!postComm && (postComm.creator === post.author || postComm.moderators.includes(post.author));
      // everything the card shows: unchanged since the last draw, its html (and its DOM node) are reused
      const sig = [post, post.likes, isLiked, isModOrOwner, authorIsMod, authorDisplayName, authorAvatar, formatTimeAgo(post.timestamp),
        commentsArray.map((c) => `${c.id}|${getAuthorDisplayName(c.author)}|${formatTimeAgo(c.timestamp)}`).join("\n"),
        mentionsIn(post.caption + commentsArray.map((c) => c.text).join(" ")).map(getAuthorDisplayName).join("|")]; // names arrive later
      const key = `card-${post.id}`;
      const hit = cardCache.get(post.id);
      if (hit && hit.sig.every((v, i) => v === sig[i])) return { key, html: hit.html };

      const html = `
      <article class="gram-card" id="card-${post.id}">
        <div class="gram-card-header">
          <div class="gram-author-info">
            <img src="${safeUrl(authorAvatar)}" class="gram-author-img author-clickable" data-author="${escapeHtml(post.author)}" onerror="this.onerror=null; this.src='${generateDefaultAvatar(post.author)}'" style="cursor: pointer;" />
            <div>
              <span class="gram-author-name author-clickable" data-author="${escapeHtml(post.author)}" style="cursor: pointer;" title="Persona: ${post.author}">${escapeHtml(authorDisplayName)}</span>
              <span class="gram-category-tag ${escapeHtml(post.category)}">${escapeHtml(post.category)}</span>
              ${authorIsMod ? `<span class="gram-category-tag mod" title="Moderator of r/${escapeHtml(postComm!.slug)}">mod</span>` : ""}
              ${
                post.is_nsfw
                  ? `<span class="gram-category-tag nsfw" title="18+ Adult Content (Moderated On-Device)">NSFW</span>`
                  : ""
              }
              ${
                post.community_id
                  ? `<span class="comm-badge community-link" data-community="${escapeHtml(post.community_id)}" title="View Community">r/${escapeHtml(post.community_id.replace(/^c_/, ""))}</span>`
                  : ""
              }
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="gram-time">${formatTimeAgo(post.timestamp)}</span>
            ${
              isModOrOwner && !isMyPost
                ? `<button class="mod-delete-btn btn-icon-text" data-post-id="${escapeHtml(post.id)}" data-author="${escapeHtml(post.author)}" title="Moderator: Delete post from community">${renderIcon("shield", { className: "icon-xs" })} <span>Mod Delete</span></button>`
                : ""
            }
            ${
              isMyPost
                ? `<button class="delete-post-btn" data-post-id="${escapeHtml(post.id)}" title="Delete this post">${renderIcon("trash2", { className: "icon-sm" })}</button>`
                : ""
            }
          </div>
        </div>

        ${
          post.media_uri
            ? `
          <div class="gram-media ${post.is_nsfw ? "nsfw-shielded" : ""}" id="media-${post.id}">
            <img ${mediaAttr(post.media_uri)} alt="Post media" loading="lazy" decoding="async" onerror="this.style.display='none'" />
            ${
              post.is_nsfw
                ? `
              <div class="nsfw-overlay" data-media-id="media-${post.id}">
                <div class="nsfw-overlay-card">
                  <div style="font-size: 1.2rem; margin-bottom: 6px; color: #ef4444; display: flex; align-items: center; justify-content: center;">${renderIcon("ban", { className: "icon-lg" })}</div>
                  <div style="font-weight: 700; font-size: 0.9rem;">Sensitive / Adult Media</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 10px;">Scanned on-device by Desert Ant</div>
                  <button type="button" class="btn-reveal-nsfw btn-icon-text" data-media-id="media-${post.id}">${renderIcon("eye", { className: "icon-xs" })} <span>Click to View</span></button>
                </div>
              </div>
            `
                : ""
            }
          </div>
        `
            : ""
        }

        <div class="gram-content">
          ${(() => {
            const { html, card } = renderPost(post.caption, getAuthorDisplayName);
            return (html ? `<p class="gram-caption">${html}</p>` : "") + card + freetunesCard(post.caption) + freepollsCard(post.caption);
          })()}

          ${
            post.category === "event" && (post.location || post.event_date)
              ? `
            <div class="gram-event-details">
              ${post.event_date ? `<div class="btn-icon-text">${renderIcon("calendar", { className: "icon-xs" })} <span>Date: ${escapeHtml(post.event_date)}</span></div>` : ""}
              ${post.location ? `<div class="btn-icon-text">${renderIcon("mapPin", { className: "icon-xs" })} <span>Location: ${escapeHtml(post.location)}</span></div>` : ""}
            </div>
          `
              : ""
          }
        </div>

        <div class="gram-actions">
          <button class="action-btn like-btn ${isLiked ? "liked" : ""}" data-post-id="${escapeHtml(post.id)}" data-author="${escapeHtml(post.author)}">
            <span>${isLiked ? renderIcon("heartFilled", { className: "icon-sm", ariaLabel: "Liked" }) : renderIcon("heart", { className: "icon-sm", ariaLabel: "Like" })}</span>
            <span>${likers(post).length} Likes</span>
          </button>
          <button class="action-btn" onclick="document.getElementById('comment-input-${post.id}')?.focus()">
            <span>${renderIcon("messageSquare", { className: "icon-sm" })}</span>
            <span>${commentsArray.length} Comments</span>
          </button>
          ${
            !isMyPost
              ? `<button class="action-btn talk-btn btn-icon-text" data-author="${escapeHtml(post.author)}" style="margin-left: auto;">
                   ${renderIcon("chat", { className: "icon-sm" })}
                   <span>Talk</span>
                 </button>
                 <button class="action-btn hide-user-btn btn-icon-text" data-author="${escapeHtml(post.author)}" title="Hide all posts from this user on this device">
                   ${renderIcon("ban", { className: "icon-sm" })}
                   <span>Hide</span>
                 </button>
                 <button class="action-btn report-post-btn btn-icon-text" data-author="${escapeHtml(post.author)}" data-post-id="${escapeHtml(post.id)}" title="Report this post">
                   ${renderIcon("alertTriangle", { className: "icon-sm" })}
                   <span>Report</span>
                 </button>`
              : ""
          }
        </div>
        <div class="liked-by" id="liked-by-${post.id}">${likedByHtml(post)}</div>

        <div class="gram-comments">
          <div class="comments-list" id="comments-${post.id}">
            ${commentsArray
              .map(
                (c) => `
              <div class="comment-item">
                <span class="comment-author author-clickable" data-author="${escapeHtml(c.author)}" style="cursor: pointer;" title="Persona: ${c.author}">${escapeHtml(getAuthorDisplayName(c.author))}:</span>
                <span>${renderComment(c.text, getAuthorDisplayName)}</span>
                <span class="comment-time" title="${escapeHtml(new Date(c.timestamp).toLocaleString())}">${formatTimeAgo(c.timestamp)}</span>
                ${c.author === currentIdentity!.pubkey ? `<button type="button" class="comment-del-btn" data-post-id="${escapeHtml(post.id)}" data-author="${escapeHtml(post.author)}" data-key="${escapeHtml(`${c.author}:${c.id}`)}" title="Delete my comment" aria-label="Delete my comment">✕</button>` : ""}
              </div>
            `
              )
              .join("")}
          </div>

          <form class="comment-form" data-post-id="${escapeHtml(post.id)}" data-author="${escapeHtml(post.author)}">
            <input type="text" id="comment-input-${post.id}" class="comment-input" placeholder="Write a comment..." required />
            <button type="submit" class="btn-primary" style="padding: 4px 12px; font-size: 0.8rem;">Send</button>
          </form>
        </div>
      </article>
    `;
      cardCache.set(post.id, { sig, html });
      return { key, html };
    });
  if (moreHtml) items.push({ key: "load-more", html: moreHtml });
  // a changed card is rebuilt (a new comment, "12m ago" turning "13m ago"): what is being typed in its comment box stays
  const typing = Array.from(postsContainer.querySelectorAll<HTMLInputElement>(".comment-input")).filter((i) => i.value);
  const focused = document.activeElement instanceof HTMLInputElement && document.activeElement.classList.contains("comment-input") ? document.activeElement : null;
  const caret = focused?.selectionStart ?? null;
  // sync passes redraw the feed every few seconds: only new or changed cards are built and touch the DOM
  reconcileItems(postsContainer, items, (el) => el.id || (el.classList.contains("load-more") ? "load-more" : undefined));
  // the box itself moves into the new card: its text and the @mentions picked in it go along
  for (const old of new Set([...typing, ...(focused ? [focused] : [])])) {
    const now = old.isConnected ? null : document.getElementById(old.id);
    if (now) now.replaceWith(old);
  }
  if (focused && document.activeElement !== focused && focused.isConnected) {
    focused.focus();
    if (caret !== null) focused.setSelectionRange(caret, caret);
  }
  showMedia(postsContainer);
  fillFreetunes(postsContainer, (id) => freenet.appContract(id));
  fillFreepolls(postsContainer, pollNet);

  moreObserver?.disconnect();
  const moreBtn = document.getElementById("load-more-btn");
  if (moreBtn) {
    // reaching the button loads the next page by itself
    moreObserver = new IntersectionObserver((entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) {
        obs.disconnect();
        showMorePosts();
      }
    });
    moreObserver.observe(moreBtn);
  }
}

let moreObserver: IntersectionObserver | undefined;
const cardCache = new Map<string, { sig: unknown[]; html: string }>(); // shortcut: never pruned, a few KB per post seen this session

function showMorePosts() {
  visiblePosts += POSTS_PER_PAGE;
  renderTimeline();
}


/** Escapes text for both element content and quoted attribute values. */
function escapeHtml(text: unknown): string {
  return String(text ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const HEX64 = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[\w-]{1,100}$/;

/** Image URLs from other users: only images, https and blob URLs (no javascript: and the like). */
function safeUrl(u: string | undefined): string {
  return u && /^(data:image\/|https?:\/\/|blob:)/i.test(u) ? escapeHtml(u) : "";
}

/** The image attribute of a post's media: an image in its own contract is loaded when it nears the screen (showMedia). */
function mediaAttr(uri: string | undefined): string {
  const h = mediaRef(uri);
  return h ? `data-media="${h}"` : `src="${safeUrl(uri)}"`;
}

const mediaObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const img = e.target as HTMLImageElement;
      mediaObserver.unobserve(img);
      // not on the network yet: left empty, tried again on the next draw
      void mediaUrl(img.dataset.media!, (h) => freenet.getMedia(h)).then((u) => u && (img.src = u));
    }
  },
  { rootMargin: "600px" }
);
/** Start loading the not yet shown images under `root`. */
function showMedia(root: ParentNode) {
  root.querySelectorAll<HTMLImageElement>("img[data-media]:not([src])").forEach((img) => mediaObserver.observe(img));
}

function openPostLink(this: HTMLAnchorElement, e: Event) {
  e.stopPropagation();
  if (window.parent === window) return; // normal page: the browser follows the link
  e.preventDefault();
  const w = window.open(this.href, "_blank"); // not "noopener": that always returns null, and null is how we notice a blocked popup
  if (w) w.opener = null;
  else goTo(this.href);
}

// One pair of listeners on the feed, set up once: cards come and go as the feed is reconciled, so none sit on the cards.
function initCardListeners() {
  postsContainer.addEventListener("click", (e) => {
    const t = e.target as Element;
    const hit = <T extends HTMLElement = HTMLElement>(sel: string) => t.closest<T>(sel);
    let el: HTMLElement | null;
    if ((el = hit(".btn-reveal-nsfw, .nsfw-overlay"))) {
      e.stopPropagation();
      document.getElementById(el.dataset.mediaId!)?.classList.toggle("revealed"); // NSFW reveal toggle
    } else if ((el = hit(".clickable-hashtag"))) {
      e.stopPropagation();
      setTagFilter(el.dataset.tag!);
    } else if ((el = hit(".community-link"))) {
      e.stopPropagation();
      const cId = el.dataset.community!;
      const found = allCommunities.find((c) => c.id === cId || c.slug === cId);
      if (found) selectCommunity(found);
    } else if ((el = hit<HTMLAnchorElement>(".post-link"))) {
      // links in posts: open in a new tab; the sandboxed page may not be allowed to, so fall back to the shell
      openPostLink.call(el as HTMLAnchorElement, e);
    } else if ((el = hit(".talk-btn"))) {
      openChatWithPeer(el.dataset.author!);
    } else if ((el = hit(".hide-user-btn"))) {
      const author = el.dataset.author!;
      if (!confirm(`Hide all posts from ${getAuthorDisplayName(author)} on this device?\n\nYou can unhide them from their profile.`)) return;
      setUserHidden(author, true);
      renderTimeline();
    } else if ((el = hit(".report-post-btn"))) {
      void reportPostFromCard(el);
    } else if ((el = hit(".comment-del-btn"))) {
      void deleteCommentFromCard(el);
    } else if ((el = hit(".mod-delete-btn"))) {
      void modDeleteFromCard(el);
    } else if ((el = hit(".delete-post-btn"))) {
      void deletePostFromCard(el);
    } else if ((el = hit(".like-btn"))) {
      void toggleLikeFromCard(el);
    } else if ((el = hit(".load-more .btn-secondary, #load-more-btn"))) {
      showMorePosts();
    } else if ((el = hit(".author-clickable"))) {
      openUserProfile(el.dataset.author!);
    }
  });

  postsContainer.addEventListener("submit", (e) => {
    const form = (e.target as Element).closest<HTMLFormElement>(".comment-form");
    if (!form) return;
    e.preventDefault();
    void submitCommentFromCard(form);
  });
}

async function deleteCommentFromCard(btn: HTMLElement) {
  if (!currentIdentity || !confirm("Delete this comment?")) return;
  const { postId, author, key } = btn.dataset as { postId: string; author: string; key: string };
  const idx = timelinePosts.findIndex((p) => p.id === postId);
  const post = idx !== -1 ? timelinePosts[idx] : undefined;
  const old = post?.comments[key];
  if (post && old) {
    // ponytail: clone post in timelinePosts so freenet.feedCache is not mutated before freenet.deleteComment reads old.text
    timelinePosts[idx] = { ...post, comments: { ...post.comments, [key]: { ...old, text: "" } } };
    renderTimeline();
  }
  const ok = await freenet.deleteComment(currentIdentity, author, postId, key).catch(() => false);
  if (!ok) {
    showToast("Could not delete the comment.", "error");
    if (post && old && idx !== -1) {
      timelinePosts[idx] = post;
      renderTimeline();
    }
  }
}

async function modDeleteFromCard(btn: HTMLElement) {
  if (!currentIdentity || !activeCommunity) return;
  const postId = btn.dataset.postId!;
  const author = btn.dataset.author!;
  if (!confirm(`Moderator Action: Remove this post from r/${activeCommunity.slug}?`)) return;

  const res = await freenet.modDeletePost(currentIdentity, activeCommunity.id, postId, author);
  alert(res.msg);
  if (res.success) {
    if (!activeCommunity.deleted_post_ids.includes(postId)) {
      activeCommunity.deleted_post_ids.push(postId);
    }
    renderTimeline();
  }
}

async function deletePostFromCard(btn: HTMLElement) {
  const postId = btn.dataset.postId!;
  if (!confirm("Are you sure you want to delete this post from Freenet?")) return;
  if (!currentIdentity) return;

  const prev = [...timelinePosts];
  timelinePosts = timelinePosts.filter((p) => p.id !== postId);
  const card = document.getElementById(`card-${postId}`);
  if (card) {
    card.style.transition = "opacity 0.2s, transform 0.2s";
    card.style.opacity = "0";
    card.style.transform = "scale(0.98)";
    setTimeout(() => card.remove(), 200);
  } else {
    renderTimeline();
  }

  freenet.deletePost(currentIdentity, postId).catch((err) => {
    console.error("Failed to delete post:", err);
    showToast("Could not delete post from Freenet.", "error");
    timelinePosts = prev;
    renderTimeline();
  });
}

async function toggleLikeFromCard(target: HTMLElement) {
  const postId = target.dataset.postId!;
  const author = target.dataset.author!;
  const identity = currentIdentity;
  if (!identity) return;

  const idx = timelinePosts.findIndex((p) => p.id === postId);
  if (idx === -1) return;
  const post = timelinePosts[idx];

  const currentlyLiked = !!post.likes?.[identity.pubkey]?.liked;
  const newLiked = !currentlyLiked;
  // ponytail: clone post in timelinePosts so freenet.feedCache is not mutated before freenet.toggleLike reads current liked state
  const optimisticPost: Post = { ...post, likes: { ...post.likes, [identity.pubkey]: { liked: newLiked, ts: Date.now(), sig: "" } } };
  timelinePosts[idx] = optimisticPost;

  const card = document.getElementById(`card-${postId}`);
  const btnEl = card?.querySelector(`.like-btn[data-post-id="${postId}"]`) as HTMLButtonElement | null;
  if (btnEl) {
    btnEl.classList.toggle("liked", newLiked);
    btnEl.innerHTML = `<span>${newLiked ? renderIcon("heartFilled", { className: "icon-sm", ariaLabel: "Liked" }) : renderIcon("heart", { className: "icon-sm", ariaLabel: "Like" })}</span> <span>${likers(optimisticPost).length} Likes</span>`;
    paintLikedBy(optimisticPost);
  } else {
    renderTimeline();
  }
  updateNotificationsBadge();

  freenet.toggleLike(identity, author, postId).catch((err) => {
    console.error("Failed to toggle like:", err);
    const curIdx = timelinePosts.findIndex((p) => p.id === postId);
    if (curIdx !== -1) timelinePosts[curIdx] = post;
    const b = document.getElementById(`card-${postId}`)?.querySelector(`.like-btn[data-post-id="${postId}"]`) as HTMLButtonElement | null;
    if (b) {
      b.classList.toggle("liked", currentlyLiked);
      b.innerHTML = `<span>${currentlyLiked ? renderIcon("heartFilled", { className: "icon-sm", ariaLabel: "Liked" }) : renderIcon("heart", { className: "icon-sm", ariaLabel: "Like" })}</span> <span>${likers(post).length} Likes</span>`;
      paintLikedBy(post);
    }
    updateNotificationsBadge();
  });
}

/** Report a post: it goes on my public blocklist (hidden for me and whoever trusts my list) and, in a community, its
 *  owner and moderators get a notification that opens it. */
async function reportPostFromCard(el: HTMLElement) {
  const author = el.dataset.author!;
  const postId = el.dataset.postId!;
  const post = timelinePosts.find((p) => p.id === postId && p.author === author);
  const reason = prompt(`Report this post by ${getAuthorDisplayName(author)}?\n\nWhy (spam, abuse, illegal content…)? It is hidden for you and for whoever trusts your blocklist; in a community, its moderators are told.`);
  if (reason === null) return;
  try {
    await freenet.reportPost(author, postId, reason.trim());
    const comm = post?.community_id ? allCommunities.find((c) => c.id === post.community_id || c.slug === post.community_id) : undefined;
    if (comm) {
      const text = `reported a post in r/${comm.slug}${reason.trim() ? `: "${reason.trim().slice(0, 80)}"` : ""}`;
      for (const mod of new Set([comm.creator, ...comm.moderators]))
        void freenet.addNotification(mod, { type: "report", from: "", text, linkPostId: postId, linkPostOwner: author }).catch(() => {});
    }
    showToast("Post reported.");
  } catch (err: any) {
    alert(`Could not report the post: ${err?.message || err}`);
  }
  renderTimeline();
}

/** "Liked by A, B, C and N more": the names open the liker's profile. */
function likedByHtml(post: Post): string {
  const keys = likers(post);
  if (!keys.length) return "";
  const names = keys
    .slice(0, 3)
    .map((k) => `<span class="author-clickable" data-author="${escapeHtml(k)}">${escapeHtml(getAuthorDisplayName(k))}</span>`)
    .join(", ");
  return `Liked by ${names}${keys.length > 3 ? ` and ${keys.length - 3} more` : ""}`;
}
function paintLikedBy(post: Post): void {
  const el = document.getElementById(`liked-by-${post.id}`);
  if (el) el.innerHTML = likedByHtml(post);
}

async function submitCommentFromCard(target: HTMLFormElement) {
  const postId = target.dataset.postId!;
  const author = target.dataset.author!;
  const input = target.querySelector(".comment-input") as HTMLInputElement;
  const text = input.value.trim();
  const identity = currentIdentity;
  if (!text || !identity) return;

  const now = Date.now();
  if (now - lastCommentTime < COMMENT_COOLDOWN_MS) {
    return;
  }

  input.value = "";
  lastCommentTime = now;
  const censorship = censorTextAndPII(text);
  if (censorship.hasCensoredPII || censorship.hasCensoredProfanity) {
    showToast("Notice: Sensitive content in comment was automatically masked.", "info");
  }
  const finalText = withMentionKeys(input, censorship.censoredText); // after the checks: a key looks like a phone number to them

  const idx = timelinePosts.findIndex((p) => p.id === postId);
  const post = idx !== -1 ? timelinePosts[idx] : undefined;
  const tempCommentId = `c_temp_${ now }`;
  const tempKey = `${identity.pubkey}:${tempCommentId}`;
  const visibleCommentCount = (p: Post) => Object.values(p.comments).filter((c) => c.text !== "").length;
  let optimisticPost = post;
  if (post && idx !== -1) {
    const optimisticComment: Comment = {
      id: tempCommentId,
      post_id: postId,
      author: identity.pubkey,
      text: finalText,
      timestamp: now,
      sig: "",
    };
    // ponytail: use "${author}:${id}" key matching contract & clone post so feedCache is not polluted with unsigned temp comment
    optimisticPost = { ...post, comments: { ...(post.comments || {}), [tempKey]: optimisticComment } };
    timelinePosts[idx] = optimisticPost;

    const commentsContainer = document.getElementById(`comments-${postId}`);
    if (commentsContainer) {
      commentsContainer.insertAdjacentHTML(
        "beforeend",
        `<div class="comment-item" id="comment-${tempCommentId}">
          <span class="comment-author author-clickable" data-author="${escapeHtml(identity.pubkey)}" style="cursor: pointer;" title="Persona: ${identity.pubkey}">${escapeHtml(getAuthorDisplayName(identity.pubkey))}:</span>
          <span>${renderComment(finalText, getAuthorDisplayName)}</span>
          <span class="comment-time" title="${escapeHtml(new Date(now).toLocaleString())}">${formatTimeAgo(now)}</span>
        </div>`
      );
      const card = document.getElementById(`card-${postId}`);
      const countBtn = card?.querySelectorAll(".gram-actions .action-btn")[1];
      if (countBtn) {
        countBtn.innerHTML = `<span>${renderIcon("messageSquare", { className: "icon-sm" })}</span> <span>${visibleCommentCount(optimisticPost)} Comments</span>`;
      }
    } else {
      renderTimeline();
    }
    updateNotificationsBadge();
  }

  freenet.addComment(identity, author, postId, finalText).then((realComment) => {
    if (optimisticPost) {
      const realKey = `${realComment.author}:${realComment.id}`;
      delete optimisticPost.comments[tempKey];
      optimisticPost.comments[realKey] = realComment;
      const el = document.getElementById(`comment-${tempCommentId}`);
      if (el) {
        el.id = `comment-${realComment.id}`;
        el.insertAdjacentHTML(
          "beforeend",
          `<button type="button" class="comment-del-btn" data-post-id="${escapeHtml(postId)}" data-author="${escapeHtml(author)}" data-key="${escapeHtml(realKey)}" title="Delete my comment" aria-label="Delete my comment">✕</button>`
        );
      }
    }
  }).catch((err) => {
    console.error("Failed to add comment:", err);
    showToast("Could not post comment to Freenet.", "error");
    if (optimisticPost) {
      delete optimisticPost.comments[tempKey];
      document.getElementById(`comment-${tempCommentId}`)?.remove();
      const card = document.getElementById(`card-${postId}`);
      const countBtn = card?.querySelectorAll(".gram-actions .action-btn")[1];
      if (countBtn) {
        countBtn.innerHTML = `<span>${renderIcon("messageSquare", { className: "icon-sm" })}</span> <span>${visibleCommentCount(optimisticPost)} Comments</span>`;
      }
    }
  });
}

initCardListeners();

// Anti-Flood & Rate Limiting Controls
let lastPostTime = 0;
let recentPostTimestamps: number[] = [];
let recentPostContents: string[] = [];
const POST_COOLDOWN_MS = 2000; // 2s cooldown between consecutive posts
const MAX_POSTS_PER_MINUTE = 10; // Maximum 10 posts in 60s sliding window

let lastCommentTime = 0;
const COMMENT_COOLDOWN_MS = 1000; // 1s cooldown between comments

let lastChatMessageTime = 0;
const CHAT_COOLDOWN_MS = 300; // 300ms debounce between chat messages

let cooldownTimer: any = null;

function isPostInCooldown(): boolean {
  return cooldownTimer !== null || (Date.now() - lastPostTime < POST_COOLDOWN_MS && lastPostTime > 0);
}

function startPostCooldown(durationSeconds: number = 2) {
  let remaining = durationSeconds;
  publishBtn.disabled = true;
  publishBtn.style.opacity = "0.7";
  publishBtn.style.cursor = "not-allowed";
  publishBtn.style.backgroundColor = "";
  publishBtn.style.borderColor = "";
  publishBtn.title = "Please wait a moment.";
  publishBtn.textContent = `⏳ (${remaining}s)`;

  if (cooldownTimer) clearInterval(cooldownTimer);

  cooldownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      publishBtn.textContent = `⏳ (${remaining}s)`;
    } else {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      if (!currentMediaNsfw) {
        resetPublishBtnState();
      }
    }
  }, 1000);
}

function resetPublishBtnState() {
  if (isPostInCooldown()) return;
  publishBtn.disabled = false;
  publishBtn.style.opacity = "";
  publishBtn.style.cursor = "";
  publishBtn.style.backgroundColor = "";
  publishBtn.style.borderColor = "";
  publishBtn.title = "";
  publishBtn.textContent = "Plant post";
}

function blockPublishBtnForNsfw(label: string, score: number) {
  currentMediaNsfw = true;
  publishBtn.disabled = true;
  publishBtn.style.opacity = "0.6";
  publishBtn.style.cursor = "not-allowed";
  publishBtn.style.backgroundColor = "#dc2626";
  publishBtn.style.borderColor = "#b91c1c";
  publishBtn.title = "Publishing blocked: Adult / explicit content detected.";
  publishBtn.textContent = "Publishing Prohibited";

  if (moderationStatus && moderationBadgeText) {
    moderationStatus.style.display = "flex";
    moderationStatus.style.background = "#fef2f2";
    moderationStatus.style.border = "1px solid #f87171";
    moderationBadgeText.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="color: #b91c1c; font-weight: 700; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
            ${renderIcon("ban", { className: "icon-sm" })}
            <span>Adult Content Detected (${escapeHtml(label)}, confidence: ${(score * 100).toFixed(0)}%)</span>
          </span>
          <span style="background: #ef4444; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">BLOCKED</span>
        </div>
        <span style="color: #7f1d1d; font-size: 0.75rem; font-weight: normal;">Publishing adult or explicit content is strictly prohibited. Please remove the image to proceed.</span>
      </div>
    `;
  }
}

function setPublishBtnScanning() {
  publishBtn.disabled = true;
  publishBtn.style.opacity = "0.7";
  publishBtn.style.cursor = "not-allowed";
  publishBtn.textContent = "Moderation scan in progress...";

  if (moderationStatus && moderationBadgeText) {
    moderationStatus.style.display = "flex";
    moderationStatus.style.background = "var(--primary-soft)";
    moderationStatus.style.border = "1px solid var(--border)";
    moderationBadgeText.innerHTML = `<span style="color: var(--primary); font-weight: 600;">Scanning on-device with Desert Ant Moderator...</span>`;
  }
}

// Fail closed: if the on-device scan could not run, do not let the image through unchecked.
function blockPublishBtnForUnverified() {
  currentMediaNsfw = true;
  publishBtn.disabled = true;
  publishBtn.style.opacity = "0.6";
  publishBtn.style.cursor = "not-allowed";
  publishBtn.title = "Publishing blocked: the image could not be scanned.";

  if (moderationStatus && moderationBadgeText) {
    moderationStatus.style.display = "flex";
    moderationStatus.style.background = "#fffbeb";
    moderationStatus.style.border = "1px solid #fbbf24";
    moderationBadgeText.innerHTML = `<span style="color: #92400e; font-weight: 600; font-size: 0.8rem;">The on-device scanner is unavailable, so this image cannot be verified. Remove it or reload the app and try again.</span>`;
  }
}

function setMediaVerifiedSafe(score: number) {
  currentMediaNsfw = false;
  resetPublishBtnState();

  if (moderationStatus && moderationBadgeText) {
    moderationStatus.style.display = "flex";
    moderationStatus.style.background = "#f0fdf4";
    moderationStatus.style.border = "1px solid #86efac";
    moderationBadgeText.innerHTML = `<span style="color: #15803d; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">${renderIcon("shield", { className: "icon-xs" })} <span>Desert Ant Verified Safe (score: ${score})</span></span>`;
  }
}

function showScanResult(modRes: ImageModerationResult) {
  currentMediaNsfwScore = modRes.score;
  if (modRes.unverified) blockPublishBtnForUnverified();
  else if (modRes.score >= NSFW_BLOCK) blockPublishBtnForNsfw(modRes.label, modRes.score);
  else if (modRes.score >= NSFW_SENSITIVE) setMediaSensitive(modRes.score);
  else setMediaVerifiedSafe(modRes.score);
}

/** Possibly sensitive: posted marked NSFW (blurred until clicked) unless the author unticks the box: the scanner also
 *  flags pale furry animals. */
function setMediaSensitive(score: number) {
  currentMediaNsfw = false;
  resetPublishBtnState();
  if (moderationStatus && moderationBadgeText) {
    moderationStatus.style.display = "flex";
    moderationStatus.style.background = "#fffbeb";
    moderationStatus.style.border = "1px solid #fbbf24";
    moderationBadgeText.innerHTML = `<label style="color: #92400e; font-weight: 600; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;"><input type="checkbox" id="nsfw-mark" checked /> <span>Mark as sensitive: the image is blurred until clicked. The scanner rated it ${(score * 100).toFixed(0)}%; untick if it is not.</span></label>`;
  }
}

// File Picker for Moments with Desert Ant On-Device Scan
postFilePicker.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  setPublishBtnScanning();

  try {
    // Compress and downscale Moment image to lightweight web format (~2-4 KB)
    const compressed = await compressPostImageFile(file);
    postMediaUrl.value = compressed;
    imagePreview.src = compressed;
    imagePreviewContainer.style.display = "flex";

    showScanResult(await analyzeImageFile(file));
  } catch (err) {
    console.error("Failed to process image for Moment:", err);
    resetPublishBtnState();
  }
});

// URL or Base64 pasted directly into Moment media field
postMediaUrl.addEventListener("change", async () => {
  const val = postMediaUrl.value.trim();
  if (!val) {
    clearImageBtn.click();
    return;
  }
  setPublishBtnScanning();

  try {
    const compressed = await compressPostImageFile(val);
    postMediaUrl.value = compressed;
    imagePreview.src = compressed;
    imagePreviewContainer.style.display = "flex";

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      showScanResult(await analyzeImageFile(img));
    };
    img.onerror = () => {
      resetPublishBtnState();
    };
    img.src = compressed;
  } catch {
    resetPublishBtnState();
  }
});

clearImageBtn.addEventListener("click", () => {
  postFilePicker.value = "";
  postMediaUrl.value = "";
  imagePreview.src = "";
  imagePreviewContainer.style.display = "none";
  if (moderationStatus) moderationStatus.style.display = "none";
  currentMediaNsfw = false;
  currentMediaNsfwScore = 0;
  if (nsfwManualToggle) nsfwManualToggle.checked = false;
  resetPublishBtnState();
});

const pollNet: PollNet = {
  get: (id) => freenet.appContract(id),
  put: (k, code, params, state) => freenet.putAppContract(k, code, params, state),
  update: (k, delta) => freenet.updateAppContract(k, delta),
};
const pollFields = document.getElementById("poll-fields") as HTMLElement;
const pollOptions = document.getElementById("poll-options") as HTMLTextAreaElement;
const pollMulti = document.getElementById("poll-multi") as HTMLInputElement;
document.getElementById("poll-toggle-btn")!.addEventListener("click", (e) => {
  const on = pollFields.hidden;
  pollFields.hidden = !on;
  (e.currentTarget as HTMLElement).classList.toggle("active", on);
  if (on) pollOptions.focus();
});

// Composer Tab switching
document.querySelectorAll(".composer-tab").forEach((tab) => {
  tab.addEventListener("click", (e) => {
    document.querySelectorAll(".composer-tab").forEach((t) => t.classList.remove("active"));
    const btn = e.currentTarget as HTMLElement;
    btn.classList.add("active");
    activeComposerType = btn.dataset.type as PostCategory;

    momentFields.style.display = activeComposerType === "moment" ? "flex" : "none";
    eventFields.style.display = activeComposerType === "event" ? "flex" : "none";
  });
});

// Category filtering in Sidebar
function setCategory(cat: "all" | PostCategory) {
  currentCategory = cat;
  document.querySelectorAll(".cat-btn").forEach((b) => {
    const btn = b as HTMLElement;
    if (btn.dataset.cat === cat) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Feeds & Categories are top-level views: clear community mode so posts are shown
  if (activeCommunity) {
    activeCommunity = null;
    communityHeaderBanner.style.display = "none";
    composerCommunitySelect.value = "";
    document.querySelectorAll(".comm-item").forEach((el) => el.classList.remove("active"));
  }

  // If clicking "All Posts", also clear any active hashtag filter and search query
  if (cat === "all") {
    if (activeTagFilter) {
      activeTagFilter = null;
      activeFilterBanner.style.display = "none";
    }
    if (searchQuery) {
      searchQuery = "";
      feedSearchInput.value = "";
    }
  }

  renderTimeline();
}

document.querySelectorAll(".cat-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const target = e.currentTarget as HTMLElement;
    const cat = target.dataset.cat as "all" | PostCategory;
    setCategory(cat);
  });
});

// Clicking brand logo resets all filters to default All Posts timeline
const brandLogo = document.querySelector(".brand") as HTMLElement | null;
if (brandLogo) {
  brandLogo.style.cursor = "pointer";
  brandLogo.addEventListener("click", () => {
    setCategory("all");
  });
}

// Publish Post (optimistic)
publishBtn.addEventListener("click", async () => {
  if (!currentIdentity) return;

  // A poll: the caption is its question; publish the poll first, then the post carries its link
  if (!pollFields.hidden) {
    const question = postCaption.value.trim();
    const options = [...new Set(pollOptions.value.split("\n").map((o) => o.trim()).filter(Boolean))].slice(0, 20);
    if (!question || options.length < 2) return void showToast("A poll needs a question (the post text) and at least two options, one per line.", "warning");
    publishBtn.disabled = true;
    try {
      const link = await createPoll({ question: question.slice(0, 300), options: options.map((o) => o.slice(0, 200)), multi: pollMulti.checked }, pollNet, nodeOrigin());
      postCaption.value = `${question}\n\n${link}`;
      pollOptions.value = "";
      pollMulti.checked = false;
      pollFields.hidden = true;
      document.getElementById("poll-toggle-btn")!.classList.remove("active");
    } catch (e) {
      return void showToast(`Could not create the poll: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      publishBtn.disabled = false;
    }
  }

  // 1. Strict zero-tolerance guard: do not allow publishing NSFW content
  if (currentMediaNsfw || currentMediaNsfwScore >= NSFW_BLOCK) {
    showToast("Publishing Prohibited: Media contains explicit or adult content.", "error");
    return;
  }

  // 2. Anti-flood cooldown check
  const now = Date.now();
  const timeSinceLast = now - lastPostTime;
  if (lastPostTime > 0 && timeSinceLast < POST_COOLDOWN_MS) {
    const waitSec = Math.ceil((POST_COOLDOWN_MS - timeSinceLast) / 1000);
    showToast(`Please wait ${waitSec}s before publishing another post.`, "warning");
    return;
  }

  // 3. Sliding window rate limit check (max 10 posts per 60 seconds)
  recentPostTimestamps = recentPostTimestamps.filter((t) => now - t < 60000);
  if (recentPostTimestamps.length >= MAX_POSTS_PER_MINUTE) {
    showToast("Rate Limit Exceeded: Maximum 10 posts per minute to protect the network.", "warning");
    return;
  }

  const caption = postCaption.value.trim();
  if (!caption) {
    showToast("Please write something before publishing.", "warning");
    return;
  }

  // 4. Duplicate content check (prevent spamming identical text)
  const normalizedCaption = caption.toLowerCase().replace(/\s+/g, " ");
  if (recentPostContents.includes(normalizedCaption)) {
    showToast("Duplicate Post Detected: You recently published this exact message.", "warning");
    return;
  }

  // 5. Auto-censor sensitive data (PII) and bad words / profanity
  const censorship = censorTextAndPII(caption);
  const finalCaption = withMentionKeys(postCaption, censorship.censoredText); // after the checks: a key looks like a phone number to them

  if (censorship.hasCensoredPII || censorship.hasCensoredProfanity) {
    showToast("Notice: Sensitive information or language was automatically masked.", "info");
    postCaption.value = censorship.censoredText;
  }

  const mediaUri = activeComposerType === "moment" ? postMediaUrl.value.trim() : undefined;
  const location = activeComposerType === "event" ? postLocation.value.trim() : undefined;
  const eventDate = activeComposerType === "event" ? postEventDate.value : undefined;
  const commId = composerCommunitySelect.value || (activeCommunity ? activeCommunity.id : undefined);

  const markSensitive = currentMediaNsfwScore >= NSFW_SENSITIVE && (document.getElementById("nsfw-mark") as HTMLInputElement | null)?.checked !== false;
  // Optimistic post insertion
  const tempId = `post_${now}_${Math.random().toString(36).substring(2, 8)}`;
  const optimisticPost: Post = {
    id: tempId,
    author: currentIdentity.pubkey,
    category: activeComposerType,
    caption: finalCaption,
    community_id: commId,
    media_uri: mediaUri || undefined,
    location: location || undefined,
    event_date: eventDate || undefined,
    is_nsfw: markSensitive,
    timestamp: now,
    sig: "",
    likes: {},
    comments: {},
    nsfw_score: currentMediaNsfwScore,
    cert: currentIdentity.cert,
  };

  // Record anti-flood timestamps & content
  lastPostTime = now;
  recentPostTimestamps.push(lastPostTime);
  recentPostContents.push(normalizedCaption);
  if (recentPostContents.length > 5) recentPostContents.shift();

  const mediaNsfwScore = currentMediaNsfwScore;
  timelinePosts.unshift(optimisticPost);
  postCaption.value = "";
  postMediaUrl.value = "";
  postLocation.value = "";
  imagePreview.src = "";
  imagePreviewContainer.style.display = "none";
  if (moderationStatus) moderationStatus.style.display = "none";
  currentMediaNsfw = false;
  currentMediaNsfwScore = 0;
  if (nsfwManualToggle) nsfwManualToggle.checked = false;
  renderTimeline();

  // Short non-blocking cooldown (2s)
  startPostCooldown(2);

  // Background publish to Freenet network
  freenet.publishPost(
    currentIdentity,
    activeComposerType,
    finalCaption,
    mediaUri || undefined,
    location || undefined,
    eventDate || undefined,
    commId || undefined,
    markSensitive,
    mediaNsfwScore
  ).then((realPost) => {
    const idx = timelinePosts.findIndex((p) => p.id === tempId);
    if (idx !== -1) {
      timelinePosts[idx] = realPost;
      renderTimeline(); // the card carries the real id: like and comment on it find their post
    }
  }).catch((err) => {
    console.error("Error publishing post in background:", err);
    showToast("Could not publish post to Freenet.", "error");
    timelinePosts = timelinePosts.filter((p) => p.id !== tempId);
    renderTimeline();
    if (!currentMediaNsfw) {
      resetPublishBtnState();
    }
  });
});

// Profile Modal Interactions
editProfileBtn.addEventListener("click", () => {
  modalNameInput.value = currentProfile?.display_name || "";
  modalBioInput.value = currentProfile?.bio || "";
  const me = currentIdentity?.pubkey;
  modalDeltaInput.value = (me && freenet.deltaSiteOf(me)) || "";
  if (me) void freenet.refreshLog(`delta/${me}`).then(() => (modalDeltaInput.value ||= freenet.deltaSiteOf(me) ?? ""));
  modalAvatarInput.value = currentProfile?.avatar_url || "";
  const currentAvatar = currentProfile?.avatar_url || generateDefaultAvatar(currentIdentity?.pubkey || "radica");
  modalAvatarPreview.src = currentAvatar;
  profileModal.style.display = "flex";
});

modalAvatarFileInput.addEventListener("change", async () => {
  const file = modalAvatarFileInput.files?.[0];
  if (!file) return;
  try {
    const compressed = await compressAvatarFile(file);
    modalAvatarInput.value = compressed;
    modalAvatarPreview.src = compressed;
  } catch (err) {
    console.error("Failed to compress avatar file:", err);
    alert("Could not process avatar image.");
  }
});

modalAvatarResetBtn.addEventListener("click", () => {
  modalAvatarInput.value = "";
  modalAvatarFileInput.value = "";
  modalAvatarPreview.src = generateDefaultAvatar(currentIdentity?.pubkey || "radica");
});

modalAvatarInput.addEventListener("input", () => {
  const val = modalAvatarInput.value.trim();
  modalAvatarPreview.src = val || generateDefaultAvatar(currentIdentity?.pubkey || "radica");
});

modalAvatarPreview.onerror = () => {
  modalAvatarPreview.src = generateDefaultAvatar(currentIdentity?.pubkey || "radica");
};

modalCancelBtn.addEventListener("click", () => {
  profileModal.style.display = "none";
});

modalSaveBtn.addEventListener("click", async () => {
  if (!currentIdentity) return;
  const name = modalNameInput.value.trim() || `Persona @${shortenKey(personaName(currentIdentity.pubkey))}`;
  const bio = modalBioInput.value.trim();
  const avatar = modalAvatarInput.value.trim();
  const deltaRaw = modalDeltaInput.value.trim();
  const delta = deltaRaw ? deltaPrefixOf(deltaRaw) : null;
  if (deltaRaw && !delta) return alert("That is not a Delta site address: paste the address of your site in Delta.");

  modalSaveBtn.disabled = true;
  modalSaveBtn.textContent = "Signing & Saving...";

  try {
    const updated = await freenet.updateProfile(currentIdentity, name, bio, avatar);
    if (delta !== freenet.deltaSiteOf(currentIdentity.pubkey)) await freenet.setDeltaSite(delta);
    currentProfile = updated;
    sidebarName.textContent = updated.display_name;
    sidebarBio.textContent = updated.bio || "No bio yet.";
    sidebarAvatar.src = composerAvatar.src = updated.avatar_url || generateDefaultAvatar(currentIdentity.pubkey);
    safeStorage.setItem(`radica_profile_${currentIdentity.pubkey}`, JSON.stringify(updated));
    freenet.knownPeers[currentIdentity.pubkey] = {
      display_name: updated.display_name,
      avatar_url: updated.avatar_url,
    };
    freenet.announceIdentity(currentIdentity, updated);
    renderTimeline();
    renderDiscoveredPeers();
    profileModal.style.display = "none";
  } catch (err) {
    console.error("Error updating profile:", err);
    alert("Could not save profile.");
  } finally {
    modalSaveBtn.disabled = false;
    modalSaveBtn.textContent = "Save Profile";
  }
});

// Follow Persona Form
followForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentIdentity) return;
  const targetKey = followPubkeyInput.value.trim();
  if (!targetKey) return;

  if (targetKey === currentIdentity.pubkey) {
    alert("You cannot follow yourself.");
    return;
  }

  if (followingKeys.includes(targetKey)) {
    alert("You are already following this persona.");
    return;
  }

  await freenet.toggleFollow(currentIdentity, targetKey);
  followingKeys.push(targetKey);
  followPubkeyInput.value = "";
  renderFollowingList();

  timelinePosts = await freenet.getTimeline(currentIdentity);
  renderTimeline();
});

// ---- Dedicated User Profile View ----

const uviewBlog = document.getElementById("uview-blog") as HTMLElement;
const uviewNames = document.getElementById("uview-names") as HTMLElement;
const uviewSites = document.getElementById("uview-sites") as HTMLElement;

/** The FreeNames names a persona owns, as links to FreeNames' lookup. */
async function renderNames(pubkey: string) {
  uviewNames.innerHTML = uviewSites.innerHTML = "";
  const [names, sites] = await Promise.all([freenet.freenamesOf(pubkey), freenet.freenameSites(pubkey)]);
  if (uviewKey.textContent !== pubkey) return;
  const origin = nodeOrigin();
  // shown as name/sub when the persona has a registry name, else as the sub-name alone
  const label = (n: string) => (names[0] ? (n === "@" ? names[0] : `${names[0]}/${n}`) : n === "@" ? "home" : n);
  uviewSites.innerHTML = sites.length
    ? `<h4>Sites on Freenet</h4><div class="fn-sites">${sites
        .map((s) => `<a class="fn-site" href="${escapeHtml(`${origin}/v1/contract/web/${s.target}/`)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(s.target)}">${escapeHtml(label(s.name))}</a>`)
        .join("")}</div>`
    : "";
  uviewNames.innerHTML = names
    .map((n) => `<a class="fn-name" href="${escapeHtml(nameHref(origin, n))}" target="_blank" rel="noopener noreferrer" title="Name on FreeNames">fn:${escapeHtml(n)}</a>`)
    .join("");
}

/** The Delta blog a persona named (set in Edit Profile): a card with its name and all its pages, opening in Delta. */
async function renderBlog(pubkey: string) {
  const stillHere = () => uviewKey.textContent === pubkey;
  const draw = async () => {
    const prefix = freenet.deltaSiteOf(pubkey);
    if (!prefix) return void (uviewBlog.innerHTML = "");
    const origin = nodeOrigin();
    const head = (name: string, sub: string) =>
      `<a class="blog-card-head" href="${escapeHtml(pageHref(origin, prefix))}" target="_blank" rel="noopener noreferrer">` +
      `<span class="link-card-icon" aria-hidden="true">${renderIcon("layers", { className: "icon-sm" })}</span>` +
      `<span class="link-card-text"><span class="link-card-host">Blog on Delta</span><span class="link-card-title">${escapeHtml(name)}</span>` +
      (sub ? `<span class="blog-card-desc">${escapeHtml(sub)}</span>` : "") +
      `</span><span class="blog-card-open" aria-hidden="true">\u2197</span></a>`;
    if (!uviewBlog.innerHTML) uviewBlog.innerHTML = `<div class="blog-card">${head(prefix, "Loading…")}</div>`;
    const site = await freenet.deltaSite(prefix);
    if (!stillHere()) return;
    const pages = (site?.pages ?? [])
      .map((p) => `<a href="${escapeHtml(pageHref(origin, prefix, p.id))}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.title || "Untitled")}</a>`)
      .join("");
    uviewBlog.innerHTML =
      `<div class="blog-card">${head(site?.name ?? prefix, site ? site.description : "Not found on the network right now.")}` +
      (pages ? `<div class="blog-card-pages">${pages}</div>` : "") +
      `</div>`;
  };
  await draw();
  await freenet.refreshLog(`delta/${pubkey}`);
  if (stillHere()) await draw();
}

async function openUserProfile(pubkey: string) {
  const isSelf = pubkey === currentIdentity?.pubkey;
  // open at once with what is known; the feed (bio, posts) may take a few seconds to come from the network
  uviewName.textContent = getAuthorDisplayName(pubkey);
  uviewKey.textContent = pubkey;
  uviewAvatar.src = getAuthorAvatarUrl(pubkey);
  uviewBio.textContent = "";
  uviewPostsGallery.innerHTML = `<div style="grid-column: 1 / -1; font-size: 0.85rem; color: var(--text-muted);">Loading…</div>`;
  uviewBlog.innerHTML = "";
  void renderBlog(pubkey);
  void renderNames(pubkey);
  userProfileModal.style.display = "flex";
  uviewFollowBtn.style.display = uviewTalkBtn.style.display = uviewHideBtn.style.display = isSelf ? "none" : "";
  uviewBlockBtn.style.display = uviewTrustBtn.style.display = isSelf ? "none" : "";
  const iBlock = () => freenet.blockedBy(currentIdentity!.pubkey).has(pubkey);
  const paintListBtns = () => {
    uviewBlockBtn.textContent = iBlock() ? "Remove from my blocklist" : "Add to my blocklist";
    uviewTrustBtn.textContent = trustedCurators().includes(pubkey) ? "Stop trusting their blocklist" : "Trust their blocklist";
  };
  paintListBtns();
  uviewBlockBtn.onclick = async () => {
    await freenet.setBlocked(pubkey, !iBlock());
    paintListBtns();
  };
  uviewTrustBtn.onclick = () => {
    setCuratorTrusted(pubkey, !trustedCurators().includes(pubkey));
    paintListBtns();
    refreshTrustedBlocklists();
    renderTimeline();
  };
  uviewHideBtn.innerHTML = hideButtonHtml(hiddenUsers().includes(pubkey));
  uviewHideBtn.onclick = () => {
    const hide = !hiddenUsers().includes(pubkey);
    setUserHidden(pubkey, hide);
    uviewHideBtn.innerHTML = hideButtonHtml(hide);
    renderTimeline();
  };
  // wait for the network only when there is no local copy to show; otherwise show it now and update in the background
  if (!isSelf) {
    const fetched = freenet.refresh(pubkey, true);
    if (!safeStorage.getItem(`freenet_feed_${pubkey}`)) await Promise.race([fetched, new Promise((r) => setTimeout(r, 4000))]);
  }
  const feed = await freenet.getFeed(pubkey);
  const name = feed.profile?.display_name || getAuthorDisplayName(pubkey);
  const bio = feed.profile?.bio || "No bio available.";
  const avatar = feed.profile?.avatar_url || generateDefaultAvatar(pubkey);

  uviewAvatar.src = avatar;
  uviewAvatar.onerror = () => {
    uviewAvatar.src = generateDefaultAvatar(pubkey);
  };
  uviewName.textContent = name;
  uviewKey.textContent = pubkey;
  uviewBio.textContent = bio;

  const isFollowing = followingKeys.includes(pubkey);
  uviewFollowBtn.innerHTML = isFollowing
    ? `<span class="btn-icon-text">${renderIcon("userCheck", { className: "icon-xs" })} <span>Following</span></span>`
    : `<span class="btn-icon-text">${renderIcon("userPlus", { className: "icon-xs" })} <span>Follow</span></span>`;
  uviewFollowBtn.onclick = async () => {
    if (!currentIdentity) return;
    const nowFollowing = await freenet.toggleFollow(currentIdentity, pubkey);
    if (nowFollowing) {
      followingKeys.push(pubkey);
      uviewFollowBtn.innerHTML = `<span class="btn-icon-text">${renderIcon("userCheck", { className: "icon-xs" })} <span>Following</span></span>`;
    } else {
      followingKeys = followingKeys.filter((k) => k !== pubkey);
      uviewFollowBtn.innerHTML = `<span class="btn-icon-text">${renderIcon("userPlus", { className: "icon-xs" })} <span>Follow</span></span>`;
    }
    renderFollowingList();
    timelinePosts = await freenet.getTimeline(currentIdentity);
    renderTimeline();
  };

  uviewTalkBtn.onclick = () => {
    userProfileModal.style.display = "none";
    openChatWithPeer(pubkey);
  };

  // their posts, newest first: the text, the picture, likes and comments; a click opens the post in the feed
  const authorPosts = Object.values(feed.posts).sort((a, b) => b.timestamp - a.timestamp);
  if (authorPosts.length === 0) {
    uviewPostsGallery.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">No posts yet.</div>`;
  } else {
    uviewPostsGallery.innerHTML = authorPosts
      .map((p) => {
        const likes = Object.values(p.likes ?? {}).filter((l) => l.liked).length;
        const comments = Object.values(p.comments ?? {}).filter((c) => c.text !== "").length;
        const comm = p.community_id ? ` · r/${escapeHtml(p.community_id.replace(/^c_/, ""))}` : "";
        return `<div class="uview-post" data-post-id="${escapeHtml(p.id)}" data-author="${escapeHtml(pubkey)}" role="button" tabindex="0" title="Open this post">
          ${p.media_uri ? `<div class="uview-post-thumb"><img ${mediaAttr(p.media_uri)} alt="Post" /></div>` : ""}
          <div class="uview-post-body">
            ${p.caption ? `<div class="uview-post-text">${renderCaption(p.caption, getAuthorDisplayName)}</div>` : ""}
            <div class="uview-post-meta">${formatTimeAgo(p.timestamp)} · ♥ ${likes} · 💬 ${comments}${comm}</div>
          </div>
        </div>`;
      })
      .join("");
    showMedia(uviewPostsGallery);
  }

  userProfileModal.style.display = "flex";
}

uviewCloseBtn.addEventListener("click", () => {
  userProfileModal.style.display = "none";
});
// a post in the profile opens in the feed; its links, mentions and picture keep their own click
const openProfilePost = (e: Event) => {
  const t = e.target as HTMLElement;
  const row = t.closest<HTMLElement>(".uview-post");
  if (!row) return;
  if (t.closest("a.post-link")) return openPostLink.call(t.closest("a.post-link") as HTMLAnchorElement, e);
  if (t.closest(".mention")) return void openUserProfile(t.closest<HTMLElement>(".mention")!.dataset.author!);
  if (t.closest(".uview-post-thumb img")) return; // the picture opens full size
  userProfileModal.style.display = "none";
  void showMyPost(row.dataset.postId!, row.dataset.author!);
};
uviewPostsGallery.addEventListener("click", openProfilePost);
uviewPostsGallery.addEventListener("keydown", (e) => {
  if ((e as KeyboardEvent).key === "Enter") openProfilePost(e);
});

// ---- P2P Chat & Community Chatrooms ----

const CHAT_LAYOUT_KEY = "radica_chat_layout";
let chatOnlineState = false;

function currentChatLayout(): ChatLayoutMode {
  return safeStorage.getItem(CHAT_LAYOUT_KEY) === "classic" ? "classic" : "messenger";
}

function applyChatLayoutAttr(mode: ChatLayoutMode) {
  chatModal.dataset.chatLayout = mode;
  chatModal.querySelectorAll<HTMLButtonElement>("[data-layout-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.layoutMode === mode);
  });
}

/** Open the chat at once with a loading bar, draw the conversation after the open chat is painted, then drop the bar. */
async function showChat(load: () => Promise<unknown>) {
  applyChatLayoutAttr(currentChatLayout());
  chatModal.classList.add("chat-loading");
  chatModal.style.display = "flex";
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); // after the next paint
  try {
    await load();
    messengerChat.showInboxOnMobileIfEmpty();
  } finally {
    chatModal.classList.remove("chat-loading");
  }
}

function openCommunityChat(comm: Community) {
  activeChatCommunity = comm;
  activeChatPeer = null;
  activeChatPrivateRoom = null;
  messengerChat.openThreadOnMobile();
  void showChat(async () => {
    await renderChatSidebar();
    await selectCommunityRoom(comm);
  });
}

/** Chat lists the rooms I joined (plus the one on screen), not every community on the network. */
function joinedCommunities(): Community[] {
  return allCommunities.filter((c) => c.members.includes(currentIdentity?.pubkey ?? "") || c.id === activeChatCommunity?.id);
}

function openChatWithPeer(peerPubkey?: string, focusThread = true) {
  activeChatCommunity = null;
  if (peerPubkey) {
    activeChatPeer = peerPubkey;
    activeChatPrivateRoom = null;
  }
  if (focusThread && peerPubkey) messengerChat.openThreadOnMobile();
  void showChat(async () => {
    await renderChatSidebar();
    if (activeChatPrivateRoom) await selectPrivateRoom(activeChatPrivateRoom);
    else if (activeChatPeer) await selectChatPeer(activeChatPeer);
    else if (allPrivateRooms.length > 0) await selectPrivateRoom(allPrivateRooms[0]);
    else if (joinedCommunities().length > 0) await selectCommunityRoom(joinedCommunities()[0]);
    else messengerChat.renderThread();
  });
}

openChatBtn.addEventListener("click", () => {
  if (activeCommunity) {
    openCommunityChat(activeCommunity);
  } else if (activeChatPrivateRoom) {
    void showChat(async () => {
      await renderChatSidebar();
      await selectPrivateRoom(activeChatPrivateRoom!);
    });
  } else {
    const chatPeers = currentIdentity
      ? freenet
          .getChatPeers(currentIdentity.pubkey)
          .filter((pk) => pk !== currentIdentity?.pubkey && !freenet.isChatPeerRemoved(currentIdentity!.pubkey, pk))
      : [];
    const discovered = currentIdentity ? freenet.getDiscoveredPeers(currentIdentity.pubkey).map((p) => p.pubkey) : [];
    const validDiscovered = discovered.filter(
      (pk) => pk !== currentIdentity?.pubkey && !freenet.isChatPeerRemoved(currentIdentity!.pubkey, pk)
    );
    const validFollowed = followingKeys.filter(
      (pk) => pk !== currentIdentity?.pubkey && !freenet.isChatPeerRemoved(currentIdentity!.pubkey, pk)
    );
    openChatWithPeer(activeChatPeer || chatPeers[0] || validFollowed[0] || validDiscovered[0] || undefined, false);
  }
});

// The chat is a page of the main column: open, it takes the place of the feed (and of the right panel on desktop).
// While it is open the feeds are not fetched or redrawn; closing it catches up in one pass.
new MutationObserver(() => {
  const open = chatModal.style.display !== "none";
  if (open === freenet.feedsPaused) return;
  freenet.feedsPaused = open;
  if (!open && currentIdentity) {
    renderFollowingList();
    renderCommunities();
    renderDiscoveredPeers();
    void reloadPosts();
  }
}).observe(chatModal, { attributes: true, attributeFilter: ["style"] });

// full screen: the chat covers the rail and the page, and the conversations list opens with the Chats button
document.getElementById("chat-fullscreen-btn")!.addEventListener("click", (e) => {
  const on = chatModal.classList.toggle("fullscreen");
  (e.currentTarget as HTMLElement).setAttribute("aria-pressed", String(on));
  chatBody?.classList.remove("show-rooms");
});

chatCloseBtn.addEventListener("click", () => {
  chatModal.style.display = "none";
});

// The rail's places are pages of the main column, one at a time: opening one closes the others, and with none open the
// feed (or the profile page) shows again.
const railPages: [HTMLElement, string][] = [
  [chatModal, "open-chat-btn"],
  [notifsModal, "open-notifs-btn"],
  [identityModal, "open-identity-btn"],
  [updatesModal, "updates-open-btn"],
  [blocklistsModal, "blocklists-open-btn"],
  [userProfileModal, ""], // someone's profile: no rail button
];
const isOpen = (el: HTMLElement) => el.style.display !== "none" && el.style.display !== "";
function closeRailPages(except?: HTMLElement) {
  for (const [el] of railPages) if (el !== except && isOpen(el)) el.style.display = "none";
}
let feedScrollY = 0; // where the feed was when a page covered it: closing the page returns there
for (const [page, btnId] of railPages) {
  new MutationObserver(() => {
    const wasOpen = document.body.classList.contains("page-open");
    if (isOpen(page)) {
      if (!wasOpen) feedScrollY = window.scrollY;
      closeRailPages(page);
      window.scrollTo({ top: 0 });
    }
    const open = railPages.some(([el]) => isOpen(el));
    document.body.classList.toggle("page-open", open);
    if (wasOpen && !open) requestAnimationFrame(() => window.scrollTo({ top: feedScrollY }));
    document.getElementById(btnId)?.classList.toggle("active", isOpen(page));
  }).observe(page, { attributes: true, attributeFilter: ["style"] });
}

// phones: the conversations list is an overlay; picking a conversation closes it
document.getElementById("chat-rooms-btn")?.addEventListener("click", () => chatBody?.classList.toggle("show-rooms"));
document.querySelector(".chat-peers-sidebar")?.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (!t.closest(".remove-peer-btn") && t.closest("[data-peer], [data-comm-id], [data-privroom-id]")) chatBody?.classList.remove("show-rooms");
});

if (chatParticipantsToggleBtn && chatBody) {
  chatParticipantsToggleBtn.addEventListener("click", () => {
    // on phones the members panel opens over the conversation, so it starts closed there
    chatBody.classList.toggle(matchMedia("(max-width: 768px)").matches ? "show-members" : "hide-participants");
  });
}

if (commChatBtn) {
  commChatBtn.addEventListener("click", () => {
    if (activeCommunity) {
      openCommunityChat(activeCommunity);
    }
  });
}

async function clearActiveChat() {
  if (!currentIdentity) return;
  if (activeChatPrivateRoom) {
    if (!confirm("Clear all messages in this private encrypted room?")) return;
    await freenet.clearChatRoom(activeChatPrivateRoom.id);
    await selectPrivateRoom(activeChatPrivateRoom);
  } else if (activeChatCommunity) {
    const isMod =
      activeChatCommunity.creator === currentIdentity.pubkey ||
      activeChatCommunity.moderators.includes(currentIdentity.pubkey);
    if (!isMod) {
      alert("Only community moderators can clear the community chatroom.");
      return;
    }
    if (!confirm(`Clear all messages in the r/${activeChatCommunity.slug} community chat?`)) return;
    await freenet.clearChatRoom(`comm_${activeChatCommunity.id}`);
    await selectCommunityRoom(activeChatCommunity);
  } else if (activeChatPeer) {
    if (!confirm("Clear this conversation history?")) return;
    const roomId = freenet.getRoomId(currentIdentity.pubkey, activeChatPeer);
    await freenet.clearChatRoom(roomId);
    await selectChatPeer(activeChatPeer);
  }
}

chatClearBtn.addEventListener("click", () => void clearActiveChat());

// The message I am answering, and the messages on screen (to find it again by id).
let replyingTo: ChatMessage | null = null;
let shownMessages: ChatMessage[] = [];

function setReply(m: ChatMessage | null) {
  replyingTo = m;
  chatReplyBar.style.display = m ? "flex" : "none";
  if (m) chatReplyText.textContent = `Replying to ${m.sender === currentIdentity?.pubkey ? "yourself" : getAuthorDisplayName(m.sender)}: ${chatExcerpt(m.text)}`;
  messengerChat.renderReplyBanner();
}

// Redraws by key: only new, changed or removed children touch the DOM, the rest keep their images, input text and scroll.
// Children listen through delegation on the container. `nodeSrc` keeps the html a child was built from: its live
// outerHTML differs (onerror rewrites src).
const nodeSrc = new WeakMap<Element, string>();
function reconcile(container: HTMLElement, html: string, keyOf: (el: HTMLElement) => string | undefined) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const next = Array.from(tpl.content.children) as HTMLElement[];
  const cur = Array.from(container.children) as HTMLElement[];
  const keyed = (l: HTMLElement[]) => l.length > 0 && l.every((n) => keyOf(n));
  if (!keyed(next) || !keyed(cur)) {
    // empty states and the like: plain redraw
    container.replaceChildren(...Array.from(tpl.content.childNodes));
    for (const n of Array.from(container.children)) nodeSrc.set(n, n.outerHTML);
    return;
  }
  const old = new Map(cur.map((n) => [keyOf(n)!, n]));
  const keep = new Set<Element>();
  let cursor: Element | null = container.firstElementChild;
  for (const n of next) {
    const src = n.outerHTML;
    const ex = old.get(keyOf(n)!);
    const el = ex && nodeSrc.get(ex) === src ? ex : n;
    nodeSrc.set(el, src);
    keep.add(el);
    if (el === cursor) cursor = cursor.nextElementSibling;
    else container.insertBefore(el, cursor);
  }
  for (const n of cur) if (!keep.has(n)) n.remove();
}

/** Same as `reconcile`, from html already split per child: an unchanged child is neither parsed nor serialized again. */
function reconcileItems(container: HTMLElement, items: { key: string; html: string }[], keyOf: (el: HTMLElement) => string | undefined) {
  const old = new Map<string, Element>();
  for (const n of Array.from(container.children) as HTMLElement[]) {
    const k = keyOf(n);
    if (k) old.set(k, n);
    else n.remove(); // an empty state drawn before
  }
  const keep = new Set<Element>();
  let cursor: Element | null = container.firstElementChild;
  for (const { key, html } of items) {
    let el = old.get(key);
    if (!el || nodeSrc.get(el) !== html) {
      const tpl = document.createElement("template");
      tpl.innerHTML = html;
      el = tpl.content.firstElementChild!;
      nodeSrc.set(el, html);
    }
    keep.add(el);
    if (el === cursor) cursor = cursor.nextElementSibling;
    else container.insertBefore(el, cursor);
  }
  for (const n of old.values()) if (!keep.has(n)) n.remove();
}

// For small lists whose rows get listeners after each draw: an identical draw is skipped (the DOM and its listeners stay).
const lastHtml = new WeakMap<Element, string>();
function setHtmlIfChanged(el: Element, html: string): boolean {
  if (lastHtml.get(el) === html) return false;
  lastHtml.set(el, html);
  el.innerHTML = html;
  return true;
}

function paintChat(html: string | (() => string)) {
  if (currentChatLayout() !== "classic") return;
  reconcile(chatMessagesList, typeof html === "function" ? html() : html, (el) => el.dataset.msgId);
}

/** Draw the open conversation again, keeping the reader's place. */
async function rerenderChat() {
  const top = chatMessagesList.scrollTop;
  if (activeChatPrivateRoom) await selectPrivateRoom(activeChatPrivateRoom);
  else if (activeChatCommunity) await selectCommunityRoom(activeChatCommunity);
  else if (activeChatPeer) await selectChatPeer(activeChatPeer);
  chatMessagesList.scrollTop = top;
}

chatReplyCancel.addEventListener("click", () => setReply(null));

chatMessagesList.addEventListener("click", async (e) => {
  const t = e.target as HTMLElement;
  const react = t.closest<HTMLElement>("[data-react]");
  if (react) {
    try {
      await freenet.reactToChatMessage(react.dataset.roomId!, react.dataset.msgId!, react.dataset.react!, activeChatCommunity || activeChatPrivateRoom ? undefined : activeChatPeer ?? undefined);
    } catch (err: any) {
      alert(`Could not react: ${err.message || err}`);
    }
    await rerenderChat();
    return;
  }
  const delBtn = t.closest<HTMLElement>(".chat-bubble-del");
  if (delBtn) {
    e.stopPropagation();
    const roomId = delBtn.dataset.roomId!;
    const msgId = delBtn.dataset.msgId!;
    if (confirm("Delete this message?")) {
      shownMessages = shownMessages.filter((m) => m.id !== msgId);
      const bubble = chatMessagesList.querySelector(`[data-msg-id="${CSS.escape(msgId)}"]`);
      bubble?.remove();
      messengerChat.renderThread();
      void messengerChat.refreshInbox();
      freenet.deleteChatMessage(roomId, msgId).catch((err) => {
        showToast(`Could not delete: ${err.message || err}`, "error");
        void rerenderChat();
      });
    }
    return;
  }
  const reply = t.closest<HTMLElement>(".rv-reply-btn");
  if (reply) {
    setReply(shownMessages.find((m) => m.id === reply.dataset.msgId) ?? null);
    chatMessageInput.focus();
    return;
  }
  const jump = t.closest<HTMLElement>(".rv-quote");
  if (jump) chatMessagesList.querySelector(`[data-msg-id="${CSS.escape(jump.dataset.jump!)}"]`)?.scrollIntoView({ block: "center" });
});

function attachBubbleDeleteListeners() {
  // Delegated to chatMessagesList click listener for maximum performance
}

// When I last looked at each conversation (this device): newer messages from others show as a badge.
const CHAT_READ_KEY = "radica_chat_read";
function chatReadMap(): Record<string, number> {
  try {
    return JSON.parse(safeStorage.getItem(CHAT_READ_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function openRoomId(): string | null {
  if (!currentIdentity) return null;
  if (activeChatPrivateRoom) return activeChatPrivateRoom.id;
  if (activeChatCommunity) return `comm_${activeChatCommunity.id}`;
  return activeChatPeer ? freenet.getRoomId(currentIdentity.pubkey, activeChatPeer) : null;
}

function switchChatLayout(mode: ChatLayoutMode) {
  safeStorage.setItem(CHAT_LAYOUT_KEY, mode);
  applyChatLayoutAttr(mode);
  if (mode === "messenger") {
    void messengerChat.refreshInbox();
    messengerChat.renderThread();
    messengerChat.refreshDrawer();
    messengerChat.showInboxOnMobileIfEmpty();
  } else {
    void renderChatSidebar();
    renderChatParticipants();
    if (activeChatPrivateRoom || activeChatCommunity || activeChatPeer) {
      void rerenderChat();
    }
  }
}

const messengerChat = createMessengerChat({
  rootEl: document.getElementById("rm-messenger-card") as HTMLElement,
  pollNet,
  isVisible: () => chatModal.style.display !== "none" && currentChatLayout() === "messenger",
  getIdentity: () => currentIdentity,
  getAllPrivateRooms: () => allPrivateRooms,
  getJoinedCommunities: joinedCommunities,
  getAllCommunities: () => allCommunities,
  getFollowingKeys: () => followingKeys,
  getActiveState: () => ({
    peer: activeChatPeer,
    privateRoom: activeChatPrivateRoom,
    community: activeChatCommunity,
    shownMessages,
    replyingTo,
    online: chatOnlineState,
  }),
  getChatReadMap: chatReadMap,
  openRoomId,
  getAuthorDisplayName,
  getAuthorAvatarUrl,
  shortenKey,
  escapeHtml,
  safeUrl,
  onSelectPeer: selectChatPeer,
  onSelectPrivateRoom: selectPrivateRoom,
  onSelectCommunity: selectCommunityRoom,
  onSendMessage: sendActiveChatText,
  onSetReply: setReply,
  onReactMessage: async (roomId, msgId, emoji, peer) => {
    try {
      await freenet.reactToChatMessage(roomId, msgId, emoji, peer);
    } catch (err: any) {
      showToast(`Could not react: ${err.message || err}`, "error");
    }
    await rerenderChat();
  },
  onDeleteMessage: async (roomId, msgId) => {
    if (!confirm("Delete this message?")) return;
    shownMessages = shownMessages.filter((m) => m.id !== msgId);
    chatMessagesList.querySelector(`[data-msg-id="${CSS.escape(msgId)}"]`)?.remove();
    messengerChat.renderThread();
    void messengerChat.refreshInbox();
    freenet.deleteChatMessage(roomId, msgId).catch((err) => {
      showToast(`Could not delete: ${err.message || err}`, "error");
      void rerenderChat();
    });
  },
  onClearActiveChat: clearActiveChat,
  onRemovePeer: removePeerFromRecent,
  onLeavePrivateRoom: leaveActivePrivateRoom,
  onOpenCreateRoomModal: () => newPrivateRoomBtn?.click(),
  onOpenJoinRoomModal: () => joinPrivateRoomBtn?.click(),
  onOpenInviteRoomModal: () => chatInviteBtn?.click(),
  onGetInviteLink: inviteLinkOf,
  onOpenUserProfile: (pk) => void openUserProfile(pk),
  onOpenPostLink: (e, anchor) => openPostLink.call(anchor, e),
  onCreatePollLink: (question, options, multi) =>
    createPoll(
      { question: question.slice(0, 300), options: options.map((o) => o.slice(0, 200)), multi },
      pollNet,
      nodeOrigin()
    ),
  onSwitchLayout: switchChatLayout,
  onToggleFullscreen: () => document.getElementById("chat-fullscreen-btn")?.click(),
  onCloseChat: () => {
    chatModal.style.display = "none";
  },
  showToast: (msg, type = "info") => showToast(msg, type),
});

applyChatLayoutAttr(currentChatLayout());
document.querySelector(".chat-header")?.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-layout-mode]");
  if (!btn?.dataset.layoutMode) return;
  switchChatLayout(btn.dataset.layoutMode as ChatLayoutMode);
});
function unreadBadge(roomId: string, read: Record<string, number>): string {
  if (read[roomId] === undefined) {
    read[roomId] = Date.now(); // never seen before: start counting from now, and remember it
    safeStorage.setItem(CHAT_READ_KEY, JSON.stringify(read));
  }
  const n = freenet.unreadCount(roomId, currentIdentity!.pubkey, read[roomId]);
  return n ? `<span class="chat-unread-badge" title="${n} unread">${n > 99 ? "99+" : n}</span>` : "";
}

async function renderChatSidebar() {
  if (!currentIdentity) return;

  // the conversation on screen is read as of now
  const read = chatReadMap();
  for (const [room, t] of Object.entries(freenet.readMarks())) read[room] = Math.max(read[room] ?? 0, t);
  const open = openRoomId();
  if (open) {
    const hadUnread = freenet.unreadCount(open, currentIdentity.pubkey, read[open] ?? Date.now()) > 0;
    read[open] = Date.now();
    safeStorage.setItem(CHAT_READ_KEY, JSON.stringify(read));
    if (hadUnread) void freenet.markRoomRead(open, read[open]); // only when something was unread: one entry per reading
    updateChatBadge();
  }

  // 0. Render Private Rooms
  allPrivateRooms = await freenet.getPrivateRooms(currentIdentity);
  if (currentChatLayout() === "messenger") {
    void messengerChat.refreshInbox();
    return;
  }
  if (chatPrivateRoomsList) {
    // allPrivateRooms already loaded above
    if (allPrivateRooms.length === 0) {
      setHtmlIfChanged(chatPrivateRoomsList, `<div style="font-size: 0.72rem; color: var(--text-muted); padding: 4px;">No private rooms yet.<br/>Click <strong>+ New</strong> to start an E2EE room.</div>`);
    } else {
      const roomItems = await Promise.all(
        allPrivateRooms.map(async (r) => {
          const isActive = activeChatPrivateRoom?.id === r.id;
          // one room that cannot be read must not leave the whole list (and the ones below it) empty
          const name = await freenet.getPrivateRoomDecryptedName(currentIdentity!, r).catch(() => `Private Room (${r.id.slice(9, 15)})`);
          return `
            <div class="chat-privroom-item ${isActive ? "active" : ""}" data-privroom-id="${escapeHtml(r.id)}" title="Enter ${escapeHtml(name)}">
              <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
                <span>${renderIcon("lock", { className: "icon-xs" })}</span>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(name)}</span>
              </div>
              <span>${unreadBadge(r.id, read)}<span class="chat-privroom-badge">${r.members.length}</span></span>
            </div>
          `;
        })
      );
      const paintedRooms = setHtmlIfChanged(chatPrivateRoomsList, roomItems.join(""));

      if (paintedRooms) chatPrivateRoomsList.querySelectorAll(".chat-privroom-item").forEach((el) => {
        el.addEventListener("click", () => {
          const rId = (el as HTMLElement).dataset.privroomId!;
          const found = allPrivateRooms.find((r) => r.id === rId);
          if (found) selectPrivateRoom(found);
        });
      });
    }
  }

  // 1. Render Communities Chatrooms
  if (chatCommunitiesList) {
    const joined = joinedCommunities();
    if (joined.length === 0) {
      setHtmlIfChanged(chatCommunitiesList, `<div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px;">No joined communities yet. Join one from the sidebar to chat here.</div>`);
    } else {
      const paintedComms = setHtmlIfChanged(chatCommunitiesList, joined
        .map((c) => {
          const isActive = activeChatCommunity?.id === c.id;
          return `
            <div class="chat-comm-item ${isActive ? "active" : ""}" data-comm-id="${escapeHtml(c.id)}" title="Enter r/${escapeHtml(c.slug)} chatroom">
              <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
                <span>${renderIcon("hash", { className: "icon-xs" })}</span>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">r/${escapeHtml(c.slug)}</span>
              </div>
              <span>${unreadBadge(`comm_${c.id}`, read)}<span class="chat-comm-badge">${c.members.length}</span></span>
            </div>
          `;
        })
        .join(""));

      if (paintedComms) chatCommunitiesList.querySelectorAll(".chat-comm-item").forEach((el) => {
        el.addEventListener("click", () => {
          const cId = (el as HTMLElement).dataset.commId!;
          const found = allCommunities.find((c) => c.id === cId);
          if (found) selectCommunityRoom(found);
        });
      });
    }
  }

  // 2. Render Direct Message contacts (excluding self!)
  const rawPeers = Array.from(
    new Set([
      ...freenet.getChatPeers(currentIdentity.pubkey),
      ...followingKeys,
      ...(activeChatPeer ? [activeChatPeer] : []),
    ])
  );
  // a conversation I removed stays out of the list (followed or discovered people too) until I open it again
  freenet.warmPeers(rawPeers);
  const knownPeers = rawPeers.filter(
    (pk) => pk && pk !== currentIdentity!.pubkey && (pk === activeChatPeer || !freenet.isChatPeerRemoved(currentIdentity!.pubkey, pk))
  );

  if (knownPeers.length === 0) {
    setHtmlIfChanged(chatPeersList, `<div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px;">No direct messages yet.</div>`);
    void messengerChat.refreshInbox();
    return;
  }

  // two contacts can share a name (a Radica one, a River one): tell them apart by key
  const nameCount = new Map<string, number>();
  for (const pk of knownPeers) nameCount.set(getAuthorDisplayName(pk), (nameCount.get(getAuthorDisplayName(pk)) ?? 0) + 1);

  setHtmlIfChanged(chatPeersList, knownPeers
    .map((pk) => {
      const displayName = getAuthorDisplayName(pk);
      const riverRooms = Object.values(freenet.riverOnly.get(pk) ?? {});
      const fromRiver = freenet.riverOnly.has(pk);
      const inRooms = riverRooms.length ? `<span class="peer-from" title="${escapeHtml(riverRooms.join(", "))}">in ${escapeHtml(riverRooms.join(", "))}</span>` : "";
      const dup = (nameCount.get(displayName) ?? 0) > 1 ? ` <span class="peer-key">${escapeHtml(pk.slice(0, 4))}</span>` : "";
      const riverTag = fromRiver ? ` <span class="peer-origin" title="Contact from River">River</span>` : "";
      const isActive = activeChatPeer === pk && !activeChatCommunity && !activeChatPrivateRoom;
      return `
    <div class="chat-peer-item ${isActive ? "active" : ""}" data-peer="${escapeHtml(pk)}" title="${escapeHtml(pk)}">
      <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; flex: 1;">
        <img src="${safeUrl(getAuthorAvatarUrl(pk))}" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" onerror="this.onerror=null; this.src='${generateDefaultAvatar(pk)}'" />
        <span style="overflow: hidden; min-width: 0;">
          <span style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(displayName)}${dup}${riverTag}</span>${inRooms}
        </span>
      </div>
      ${unreadBadge(freenet.getRoomId(currentIdentity!.pubkey, pk), read)}
      <button class="remove-peer-btn" data-peer="${escapeHtml(pk)}" title="Remove conversation from list">${renderIcon("x", { className: "icon-xs" })}</button>
    </div>
  `;
    })
    .join(""));

  // one delegated listener, bound once, instead of two per row on every render
  if (!chatPeersList.dataset.bound) {
    chatPeersList.dataset.bound = "1";
    chatPeersList.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const rm = target.closest<HTMLElement>(".remove-peer-btn");
      const peer = (rm ?? target.closest<HTMLElement>(".chat-peer-item"))?.dataset.peer;
      if (!peer) return;
      if (!rm) return void selectChatPeer(peer);
      e.stopPropagation();
      removePeerFromRecent(peer);
    });
  }

  void messengerChat.refreshInbox();
}

function removePeerFromRecent(peer: string) {
  if (!currentIdentity || !confirm(`Remove @${shortenKey(peer)} from recent chats list?`)) return;
  freenet.removeChatPeer(currentIdentity.pubkey, peer);
  if (activeChatPeer === peer) {
    activeChatPeer = null;
    shownMessages = [];
    setReply(null);
    chatPeerInfo.textContent = "Select conversation";
    chatClearBtn.style.display = "none";
    paintChat(`<div class="empty-state" style="padding: 20px;">Conversation removed. Select another room or peer.</div>`);
    messengerChat.renderThread();
    messengerChat.refreshDrawer();
  }
  void renderChatSidebar();
}

function renderChatParticipants() {
  if (!chatParticipantsList || !chatParticipantsTitle || !chatParticipantsCount || !currentIdentity) return;
  if (currentChatLayout() === "messenger") {
    messengerChat.refreshDrawer();
    return;
  }
  messengerChat.refreshDrawer();

  if (activeChatPrivateRoom) {
    const room = activeChatPrivateRoom;
    // a River room's members are the contract's (who joined from River too), once the room has been read
    const roster = room.river ? freenet.riverRoster(room.id) : undefined;
    const members = roster?.members ?? room.members;
    const creator = roster?.creator ?? room.creator;
    chatParticipantsTitle.innerHTML = `<span class="btn-icon-text">${renderIcon("lock", { className: "icon-sm" })} <span>Room Members</span></span>`;
    chatParticipantsCount.textContent = members.length.toString();
    if (chatParticipantsHeaderCount) {
      chatParticipantsHeaderCount.textContent = members.length.toString();
    }

    const isRoomCreator = currentIdentity.pubkey === creator;
    const roomMods = roster?.moderators ?? room.moderators ?? [];
    const iAmRoomMod = roomMods.includes(currentIdentity.pubkey);

    // River's deputies: say who named them (the owner, you, or someone above you in the invite chain)
    const modTitle = (pk: string) => {
      const by = roster?.deputyOf[pk];
      if (!by?.length) return "Moderator of this room";
      const who = by.map((a) => (a === creator ? "the room owner" : a === currentIdentity!.pubkey ? "you" : freenet.knownPeers[a]?.display_name || personaName(a)));
      return `Can remove members, named by ${who.join(", ")}`;
    };
    const items = members.map((memberPk) => {
      const isCreator = memberPk === creator;
      const isYou = memberPk === currentIdentity!.pubkey;
      const isRoomMod = roomMods.includes(memberPk);
      const canKick = !isYou && !isCreator && (isRoomCreator || (iAmRoomMod && !isRoomMod));
      const peerProfile = freenet.knownPeers[memberPk];
      const displayName = peerProfile?.display_name || personaName(memberPk);
      const shortPk = shortenKey(memberPk);
      const avatarUrl =
        peerProfile?.avatar_url || generateDefaultAvatar(memberPk);

      return `
        <div class="chat-participant-item" data-pubkey="${escapeHtml(memberPk)}" title="Public Key: ${escapeHtml(memberPk)}">
          <img src="${safeUrl(avatarUrl)}" class="chat-participant-avatar" onerror="this.onerror=null; this.src='${generateDefaultAvatar(memberPk)}'" />
          <div class="chat-participant-details">
            <div class="chat-participant-name">
              <span>${escapeHtml(displayName)}</span>
              ${isCreator ? `<span class="chat-participant-tag creator btn-icon-text">${renderIcon("crown", { className: "icon-xs" })} <span>Creator</span></span>` : ""}
              ${isRoomMod ? `<span class="chat-participant-tag mod btn-icon-text" title="${escapeHtml(modTitle(memberPk))}"><span>🛡 Moderator</span></span>` : ""}
              ${isYou ? `<span class="chat-participant-tag you">You</span>` : ""}
            </div>
            <div class="chat-participant-key">@${shortPk}</div>
          </div>
          <div class="chat-participant-actions">
            ${!isYou ? `<button type="button" class="btn-secondary btn-sm chat-part-dm-btn" data-pubkey="${escapeHtml(memberPk)}" title="Send Direct Message" style="padding: 2px 6px; font-size: 0.7rem;">${renderIcon("chat", { className: "icon-xs" })}</button>` : ""}
            <button type="button" class="btn-secondary btn-sm chat-part-copy-btn" data-pubkey="${escapeHtml(memberPk)}" title="Copy Public Key" style="padding: 2px 6px; font-size: 0.7rem;">${renderIcon("copy", { className: "icon-xs" })}</button>
            ${isRoomCreator && !isYou && !isCreator ? `<button type="button" class="btn-secondary btn-sm chat-part-mod-btn" data-pubkey="${escapeHtml(memberPk)}" data-on="${isRoomMod ? "0" : "1"}" title="${isRoomMod ? "Remove moderator" : "Let this member kick others"}" style="padding: 2px 6px; font-size: 0.7rem;">${isRoomMod ? "Unmod" : "Make mod"}</button>` : ""}
            ${canKick ? `<button type="button" class="btn-secondary btn-sm chat-part-kick-btn btn-icon-text" data-pubkey="${escapeHtml(memberPk)}" title="Kick member from private room" style="padding: 2px 6px; font-size: 0.7rem; color: var(--danger);">${renderIcon("userX", { className: "icon-xs" })} <span>Kick</span></button>` : ""}
          </div>
        </div>
      `;
    });

    const bottomActions = `
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px;">
        <button type="button" class="btn-primary btn-sm btn-icon-text" id="part-invite-btn" style="width: 100%; font-size: 0.75rem; justify-content: center;">
          ${renderIcon("plus", { className: "icon-xs" })}
          <span>Invite to Room</span>
        </button>
        <button type="button" class="btn-secondary btn-sm btn-icon-text" id="part-copy-link-btn" style="width: 100%; font-size: 0.75rem; justify-content: center;">
          ${renderIcon("share2", { className: "icon-xs" })}
          <span>Share Invite Link</span>
        </button>
        ${room.river ? `<button type="button" class="btn-secondary btn-sm btn-icon-text" id="part-export-id-btn" title="Your identity in this room, for River's UI or riverctl: the same member there" style="width: 100%; font-size: 0.75rem; justify-content: center;">${renderIcon("copy", { className: "icon-xs" })}<span>Export ID</span></button>` : ""}
        <button type="button" class="btn-secondary btn-sm btn-icon-text" id="part-leave-btn" style="width: 100%; font-size: 0.75rem; justify-content: center; color: var(--danger);">${renderIcon("userX", { className: "icon-xs" })}<span>${isRoomCreator ? "Remove Room" : "Leave Room"}</span></button>
      </div>
    `;

    if (!setHtmlIfChanged(chatParticipantsList, items.join("") + bottomActions)) return; // nothing changed: the rows and their listeners stay

    // Attach listeners for member actions
    chatParticipantsList.querySelectorAll(".chat-part-dm-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pk = (btn as HTMLElement).dataset.pubkey;
        if (pk) selectChatPeer(pk);
      });
    });

    chatParticipantsList.querySelectorAll(".chat-part-copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pk = (btn as HTMLElement).dataset.pubkey;
        if (pk) {
          navigator.clipboard.writeText(pk);
          alert(`Public key for member copied to clipboard:\n${pk}`);
        }
      });
    });

    chatParticipantsList.querySelectorAll(".chat-part-mod-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const el = btn as HTMLElement;
        const pk = el.dataset.pubkey;
        if (!pk || !currentIdentity || !activeChatPrivateRoom) return;
        try {
          const updated = await freenet.setPrivateRoomModerator(currentIdentity, activeChatPrivateRoom.id, pk, el.dataset.on === "1");
          await selectPrivateRoom(updated);
        } catch (err: any) {
          alert(`Could not change moderators: ${err.message || err}`);
        }
      });
    });

    chatParticipantsList.querySelectorAll(".chat-part-kick-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const pk = (btn as HTMLElement).dataset.pubkey;
        if (!pk || !currentIdentity || !activeChatPrivateRoom) return;
        const p = freenet.knownPeers[pk];
        const name = p?.display_name || `@${shortenKey(pk)}`;
        if (
          !confirm(
            `Are you sure you want to kick ${name} from this private room?\n\nThey will be removed, the room encryption key will be rotated for remaining members, and they will lose access.`
          )
        ) {
          return;
        }
        try {
          const updated = await freenet.kickMemberFromPrivateRoom(
            currentIdentity,
            activeChatPrivateRoom.id,
            pk
          );
          await selectPrivateRoom(updated);
          alert(`User ${name} was kicked from the private room.`);
        } catch (err: any) {
          alert(`Could not kick member: ${err.message || err}`);
        }
      });
    });

    const partInviteBtn = chatParticipantsList.querySelector("#part-invite-btn");
    if (partInviteBtn && chatInviteBtn) {
      partInviteBtn.addEventListener("click", () => {
        chatInviteBtn.click();
      });
    }

    chatParticipantsList.querySelector("#part-leave-btn")?.addEventListener("click", () => {
      if (activeChatPrivateRoom) void leaveActivePrivateRoom(activeChatPrivateRoom);
    });

    chatParticipantsList.querySelector("#part-export-id-btn")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(await freenet.exportRiverIdentity(currentIdentity!, room));
        alert("Your River identity for this room is copied.\n\nImport it in River (Import ID) or riverctl to be the same member there.\n\nIt holds your private key in this room: treat it like a password, do not share it.");
      } catch (e: any) {
        alert(`Could not export: ${e.message || e}`);
      }
    });

    const partCopyLinkBtn = chatParticipantsList.querySelector("#part-copy-link-btn");
    if (partCopyLinkBtn) {
      partCopyLinkBtn.addEventListener("click", async () => {
        const roomName = await freenet.getPrivateRoomDecryptedName(currentIdentity!, room);
        const link = await inviteLinkOf(room);
        if (link) {
          await navigator.clipboard.writeText(link);
          alert(`Zero-knowledge invite link copied to clipboard!\n\nAnyone opening this link can decrypt and join "${roomName}".`);
        }
      });
    }
  } else if (activeChatCommunity) {
    const comm = activeChatCommunity;
    const isUserMod =
      currentIdentity.pubkey === comm.creator || comm.moderators.includes(currentIdentity.pubkey);

    chatParticipantsTitle.innerHTML = `<span class="btn-icon-text">${renderIcon("users", { className: "icon-sm" })} <span>Community Members</span></span>`;
    const commPks = freenet.getCommunityParticipants(comm);
    chatParticipantsCount.textContent = commPks.length.toString();
    if (chatParticipantsHeaderCount) {
      chatParticipantsHeaderCount.textContent = commPks.length.toString();
    }

    const allDisplayPks = Array.from(new Set([...commPks, ...(isUserMod ? comm.banned_members || [] : [])]));

    const items = allDisplayPks.map((memberPk) => {
      const isCreator = memberPk === comm.creator;
      const isMod = comm.moderators.includes(memberPk);
      const isYou = memberPk === currentIdentity!.pubkey;
      const isBanned = !!(comm.banned_members && comm.banned_members.includes(memberPk));
      const peerProfile = freenet.knownPeers[memberPk];
      const displayName = peerProfile?.display_name || (memberPk === "system" ? "Radica Genesis" : personaName(memberPk));
      const shortPk = shortenKey(memberPk);
      const avatarUrl =
        peerProfile?.avatar_url || generateDefaultAvatar(memberPk);

      return `
        <div class="chat-participant-item ${isBanned ? "banned" : ""}" data-pubkey="${escapeHtml(memberPk)}" title="Public Key: ${escapeHtml(memberPk)}">
          <img src="${safeUrl(avatarUrl)}" class="chat-participant-avatar" onerror="this.onerror=null; this.src='${generateDefaultAvatar(memberPk)}'" />
          <div class="chat-participant-details">
            <div class="chat-participant-name">
              <span>${escapeHtml(displayName)}</span>
              ${isCreator ? `<span class="chat-participant-tag creator btn-icon-text">${renderIcon("crown", { className: "icon-xs" })} <span>Founder</span></span>` : ""}
              ${!isCreator && isMod ? `<span class="chat-participant-tag mod btn-icon-text">${renderIcon("shield", { className: "icon-xs" })} <span>Mod</span></span>` : ""}
              ${isBanned ? `<span class="chat-participant-tag btn-icon-text" style="background:#fee2e2; color:#b91c1c;">${renderIcon("ban", { className: "icon-xs" })} <span>Banned</span></span>` : ""}
              ${isYou ? `<span class="chat-participant-tag you">You</span>` : ""}
            </div>
            <div class="chat-participant-key">@${shortPk}</div>
          </div>
          <div class="chat-participant-actions">
            ${!isYou && memberPk !== "system" && !isBanned ? `<button type="button" class="btn-secondary btn-sm chat-part-dm-btn" data-pubkey="${escapeHtml(memberPk)}" title="Send Direct Message" style="padding: 2px 6px; font-size: 0.7rem;">${renderIcon("chat", { className: "icon-xs" })}</button>` : ""}
            ${memberPk !== "system" ? `<button type="button" class="btn-secondary btn-sm chat-part-copy-btn" data-pubkey="${escapeHtml(memberPk)}" title="Copy Public Key" style="padding: 2px 6px; font-size: 0.7rem;">${renderIcon("copy", { className: "icon-xs" })}</button>` : ""}
            ${isUserMod && !isYou && !isCreator && memberPk !== "system" ? (
              isBanned
                ? `<button type="button" class="btn-secondary btn-sm chat-part-unban-btn" data-pubkey="${escapeHtml(memberPk)}" title="Unban member" style="padding: 2px 6px; font-size: 0.7rem; color: #10b981;">Unban</button>`
                : `<button type="button" class="btn-secondary btn-sm chat-part-ban-btn btn-icon-text" data-pubkey="${escapeHtml(memberPk)}" title="Ban member from community" style="padding: 2px 6px; font-size: 0.7rem; color: var(--danger);">${renderIcon("ban", { className: "icon-xs" })} <span>Ban</span></button>`
            ) : ""}
          </div>
        </div>
      `;
    });

    if (!setHtmlIfChanged(chatParticipantsList, items.join(""))) return; // nothing changed: the rows and their listeners stay

    chatParticipantsList.querySelectorAll(".chat-part-dm-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pk = (btn as HTMLElement).dataset.pubkey;
        if (pk) selectChatPeer(pk);
      });
    });

    chatParticipantsList.querySelectorAll(".chat-part-copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pk = (btn as HTMLElement).dataset.pubkey;
        if (pk) {
          navigator.clipboard.writeText(pk);
          alert(`Public key copied to clipboard:\n${pk}`);
        }
      });
    });

    chatParticipantsList.querySelectorAll(".chat-part-ban-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const pk = (btn as HTMLElement).dataset.pubkey;
        if (!pk || !currentIdentity || !activeChatCommunity) return;
        const p = freenet.knownPeers[pk];
        const name = p?.display_name || `@${shortenKey(pk)}`;
        if (
          !confirm(
            `Are you sure you want to ban ${name} from r/${activeChatCommunity.slug}?\n\nThey will be removed from members and barred from sending messages in this community.`
          )
        ) {
          return;
        }
        try {
          const res = await freenet.banMemberFromCommunity(
            currentIdentity,
            activeChatCommunity.id,
            pk
          );
          if (res.success && res.community) {
            await selectCommunityRoom(res.community);
            alert(`User ${name} has been banned from the community.`);
          } else {
            alert(res.msg);
          }
        } catch (err: any) {
          alert(`Could not ban member: ${err.message || err}`);
        }
      });
    });

    chatParticipantsList.querySelectorAll(".chat-part-unban-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const pk = (btn as HTMLElement).dataset.pubkey;
        if (!pk || !currentIdentity || !activeChatCommunity) return;
        try {
          const res = await freenet.unbanMemberFromCommunity(
            currentIdentity,
            activeChatCommunity.id,
            pk
          );
          if (res.success && res.community) {
            await selectCommunityRoom(res.community);
            alert(`User unbanned.`);
          }
        } catch (err: any) {
          alert(`Could not unban member: ${err.message || err}`);
        }
      });
    });
  } else if (activeChatPeer) {
    const peerPk = activeChatPeer;
    chatParticipantsTitle.innerHTML = `<span class="btn-icon-text">${renderIcon("lock", { className: "icon-sm" })} <span>Direct Chat</span></span>`;
    chatParticipantsCount.textContent = "2";
    if (chatParticipantsHeaderCount) {
      chatParticipantsHeaderCount.textContent = "2";
    }

    const participants = [currentIdentity.pubkey, peerPk];
    const items = participants.map((pk) => {
      const isYou = pk === currentIdentity!.pubkey;
      const peerProfile = freenet.knownPeers[pk];
      const displayName = peerProfile?.display_name || personaName(pk);
      const shortPk = shortenKey(pk);
      const avatarUrl =
        peerProfile?.avatar_url || generateDefaultAvatar(pk);

      return `
        <div class="chat-participant-item" data-pubkey="${escapeHtml(pk)}" title="Public Key: ${escapeHtml(pk)}">
          <img src="${safeUrl(avatarUrl)}" class="chat-participant-avatar" onerror="this.onerror=null; this.src='${generateDefaultAvatar(pk)}'" />
          <div class="chat-participant-details">
            <div class="chat-participant-name">
              <span>${escapeHtml(displayName)}</span>
              ${isYou ? `<span class="chat-participant-tag you">You</span>` : ""}
            </div>
            <div class="chat-participant-key">@${shortPk}</div>
          </div>
          <div class="chat-participant-actions">
            <button type="button" class="btn-secondary btn-sm chat-part-copy-btn" data-pubkey="${escapeHtml(pk)}" title="Copy Public Key" style="padding: 2px 6px; font-size: 0.7rem;">${renderIcon("copy", { className: "icon-xs" })}</button>
          </div>
        </div>
      `;
    });

    if (!setHtmlIfChanged(chatParticipantsList, items.join(""))) return; // nothing changed: the rows and their listeners stay

    chatParticipantsList.querySelectorAll(".chat-part-copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pk = (btn as HTMLElement).dataset.pubkey;
        if (pk) {
          navigator.clipboard.writeText(pk);
          alert(`Public key copied to clipboard:\n${pk}`);
        }
      });
    });
  } else {
    chatParticipantsTitle.innerHTML = `<span class="btn-icon-text">${renderIcon("users", { className: "icon-sm" })} <span>Participants</span></span>`;
    chatParticipantsCount.textContent = "0";
    if (chatParticipantsHeaderCount) {
      chatParticipantsHeaderCount.textContent = "0";
    }
    setHtmlIfChanged(chatParticipantsList, `<div style="font-size: 0.75rem; color: var(--text-muted); padding: 8px;">Select a conversation to view members.</div>`);
  }
}

async function leaveActivePrivateRoom(room: PrivateRoom) {
  if (!currentIdentity) return;
  const roomName = await freenet.getPrivateRoomDecryptedName(currentIdentity, room);
  const mine = room.creator === currentIdentity.pubkey;
  const text = mine
    ? `Remove "${roomName}" from your list?\n\nYou made it, so it cannot be deleted from the network: its members keep it and can still chat, but nobody can invite new people. It disappears from your list on all your devices. An invite link brings it back.`
    : `Leave "${roomName}"?\n\nIt disappears from your list. You can join again with an invite link. Messages you already read stay readable on this device.`;
  if (!confirm(text)) return;
  try {
    await freenet.leavePrivateRoom(currentIdentity, room.id);
  } catch (err: any) {
    alert(`Could not leave the room: ${err.message || err}`);
    return;
  }
  activeChatPrivateRoom = null;
  shownMessages = [];
  setReply(null);
  chatPeerInfo.textContent = "Select conversation";
  chatClearBtn.style.display = "none";
  if (chatInviteBtn) chatInviteBtn.style.display = "none";
  paintChat(`<div class="empty-state" style="padding: 20px;">The room is gone from your list. Select another room or peer.</div>`);
  if (chatParticipantsList) setHtmlIfChanged(chatParticipantsList, "");
  messengerChat.renderThread();
  messengerChat.refreshDrawer();
  void renderChatSidebar();
}

async function selectPrivateRoom(room: PrivateRoom) {
  if (!currentIdentity) return;
  activeChatPrivateRoom = room;
  activeChatCommunity = null;
  activeChatPeer = null;

  const decryptedName = await freenet.getPrivateRoomDecryptedName(currentIdentity, room);
  const memberCount = () => (room.river ? freenet.riverRoster(room.id)?.members.length : undefined) ?? room.members.length;
  chatPeerInfo.innerHTML = `<strong>${escapeHtml(decryptedName)}</strong> (${memberCount()} members) <span class="chat-security-badge e2ee btn-icon-text" title="On-device AES-256-GCM + X25519 ECIES">${renderIcon("lock", { className: "icon-xs" })} <span>E2EE Group</span></span>`;
  
  if (chatInviteBtn) {
    chatInviteBtn.style.display = "inline-block";
  }
  chatClearBtn.style.display = "inline-block";
  chatClearBtn.title = "Delete entire room conversation history";

  renderChatSidebar();
  renderChatParticipants();

  const messages = await freenet.getPrivateRoomChatMessages(currentIdentity, room);
  const roomId = room.id;
  if (room.river) {
    // reading the room told us who is in it
    renderChatParticipants();
    const count = chatPeerInfo.querySelector("strong")?.nextSibling;
    if (count) count.textContent = ` (${memberCount()} members) `;
  }

  if (messages.length === 0) {
    paintChat(`<div class="empty-state" style="padding: 20px;">Welcome to <strong>${escapeHtml(decryptedName)}</strong>!<br/>This room is end-to-end encrypted with an on-device symmetric AES key. Only authorized members can decrypt messages.</div>`);
  } else {
    paintChat(() => messages
      .map((msg, i) =>
        renderChatMessage({
          msg,
          prev: messages[i - 1],
          all: messages,
          roomId,
          isMine: msg.sender === currentIdentity!.pubkey,
          senderName: getAuthorDisplayName(msg.sender),
          badge: msg.sender === (freenet.riverRoster(room.id)?.creator ?? room.creator) ? `<span class="rv-badge">${renderIcon("crown", { className: "icon-xs" })}</span>` : "",
          canDelete: !room.river || msg.sender === currentIdentity!.pubkey, // River deletes only one's own messages, for everyone
        })
      )
      .join(""));
  }

  shownMessages = messages;
  freenet.warmPeers([...new Set(messages.map((x) => x.sender))]); // their profile (avatar, name) loads, then the chat redraws
  if (replyingTo && replyingTo.room_id !== roomId) setReply(null); // another conversation
  attachBubbleDeleteListeners();
  chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
  messengerChat.renderThread();
  messengerChat.refreshDrawer();
  void messengerChat.refreshInbox();
}

function setChatStatus(online: boolean) {
  chatOnlineState = online;
  document.getElementById("chat-status-pill")?.classList.toggle("online", online);
  const t = document.getElementById("chat-status-text");
  if (t) t.textContent = online ? "Connected" : "Offline";
  messengerChat.updateStatusBanner();
}

chatMessagesList.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(".post-link");
  if (a) openPostLink.call(a, e);
});

document.getElementById("chat-join-code-btn")?.addEventListener("click", () => document.getElementById("join-private-room-btn")?.click());

/** Time of a chat message the way River shows it: the clock for today, the date for older ones. */
function chatTime(ts: number): string {
  const d = new Date(ts);
  const clock = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? clock : `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${clock}`;
}

const chatExcerpt = (t: string) => (t.length > 80 ? t.slice(0, 80) + "\u2026" : t).replace(/\s+/g, " ");

/** One chat message: author and time above a rounded bubble; the author is left out when the previous message is theirs and close in time.
 * `all` (the room's messages) lets a reply show what it answers; reactions show as chips under the bubble. */
function renderChatMessage(opts: { msg: ChatMessage; prev?: ChatMessage; all?: ChatMessage[]; roomId: string; isMine: boolean; badge?: string; canDelete: boolean; senderName: string }): string {
  const { msg, prev, all, roomId, isMine, badge, canDelete, senderName } = opts;
  const me = currentIdentity?.pubkey ?? "";
  const grouped = !!prev && prev.sender === msg.sender && msg.timestamp - prev.timestamp < 5 * 60 * 1000;
  const head = grouped
    ? ""
    : `<div class="rv-msg-head"><span class="rv-author">${escapeHtml(isMine ? "You" : senderName)}</span>${badge ?? ""}<span class="rv-time">${chatTime(msg.timestamp)}</span></div>`;
  const del = canDelete
    ? `<button class="chat-bubble-del" data-room-id="${escapeHtml(roomId)}" data-msg-id="${escapeHtml(msg.id)}" title="Delete message">${renderIcon("trash2", { className: "icon-xs" })}</button>`
    : "";
  const ids = `data-room-id="${escapeHtml(roomId)}" data-msg-id="${escapeHtml(msg.id)}"`;
  const actions = `<div class="rv-actions"><button type="button" class="rv-reply-btn" ${ids} title="Reply">\u21A9</button>${CHAT_REACTIONS.map((e) => `<button type="button" class="rv-react-btn" data-react="${e}" ${ids} title="React ${e}">${e}</button>`).join("")}</div>`;
  const original = msg.reply_to ? all?.find((m) => m.id === msg.reply_to) : undefined;
  const quote = msg.reply_to
    ? `<div class="rv-quote" data-jump="${escapeHtml(msg.reply_to)}"><b>${original ? escapeHtml(original.sender === me ? "You" : getAuthorDisplayName(original.sender)) : "Message"}</b> ${original ? escapeHtml(chatExcerpt(original.text)) : "not available"}</div>`
    : "";
  const chips = Object.entries(msg.reactions ?? {})
    .filter(([e, who]) => CHAT_REACTIONS.includes(e) && who.length)
    .map(([e, who]) => `<button type="button" class="rv-chip${who.includes(me) ? " mine" : ""}" data-react="${e}" ${ids} title="${escapeHtml(who.map((w) => (w === me ? "You" : getAuthorDisplayName(w))).join(", "))}">${e} ${who.length}</button>`)
    .join("");
  const face = isMine || grouped ? "" : `<img class="rv-avatar" alt="" src="${safeUrl(getAuthorAvatarUrl(msg.sender))}" onerror="this.onerror=null; this.src='${generateDefaultAvatar(msg.sender)}'" />`;
  return `<div class="chat-bubble ${isMine ? "mine" : "theirs"}${grouped ? " grouped" : ""}" data-msg-id="${escapeHtml(msg.id)}">${face}${head}<div class="rv-bubble">${del}${actions}${quote}${linkify(msg.text)}</div>${chips ? `<div class="rv-chips">${chips}</div>` : ""}</div>`;
}

/** Append a single message bubble to the chat view without rebuilding the whole message list. */
function appendChatMessageToView(opts: {
  msg: ChatMessage;
  prev?: ChatMessage;
  all?: ChatMessage[];
  roomId: string;
  isMine: boolean;
  badge?: string;
  canDelete: boolean;
  senderName: string;
}) {
  if (currentChatLayout() === "classic") {
    chatMessagesList.querySelector(".empty-state")?.remove();
    chatMessagesList.insertAdjacentHTML("beforeend", renderChatMessage(opts));
  }




  shownMessages.push(opts.msg);
  chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
  messengerChat.renderThread(true);
  void messengerChat.refreshInbox();
}

async function selectCommunityRoom(comm: Community) {
  if (!currentIdentity) return;
  activeChatCommunity = comm;
  activeChatPeer = null;
  activeChatPrivateRoom = null;
  if (chatInviteBtn) chatInviteBtn.style.display = "none";

  chatPeerInfo.innerHTML = `<strong>#r/${escapeHtml(comm.slug)}</strong> (${freenet.getCommunityParticipants(comm).length} members) — ${escapeHtml(comm.name)} <span class="chat-security-badge public btn-icon-text" title="Public Community Chatroom - Authenticated by Ed25519">${renderIcon("globe", { className: "icon-xs" })} <span>Public Room</span></span>`;
  const isMod =
    comm.creator === currentIdentity.pubkey || comm.moderators.includes(currentIdentity.pubkey);
  chatClearBtn.style.display = isMod ? "inline-block" : "none";
  chatClearBtn.title = "Moderator: Clear community chatroom";

  renderChatSidebar();
  renderChatParticipants();

  const messages = await freenet.getCommunityChatMessages(comm.id);
  const roomId = `comm_${comm.id}`;

  if (messages.length === 0) {
    paintChat(`<div class="empty-state" style="padding: 20px;">Welcome to #r/${escapeHtml(comm.slug)} community chat! Say hello to fellow members.</div>`);
  } else {
    paintChat(() => messages
      .map((msg, i) => {
        const isMine = msg.sender === currentIdentity!.pubkey;
        const msgIsMod = comm.creator === msg.sender || comm.moderators.includes(msg.sender);
        return renderChatMessage({
          msg,
          prev: messages[i - 1],
          all: messages,
          roomId,
          isMine,
          senderName: getAuthorDisplayName(msg.sender),
          badge: msgIsMod ? `<span class="rv-badge">${renderIcon("shield", { className: "icon-xs" })}</span>` : "",
          canDelete: isMine || isMod,
        });
      })
      .join(""));
  }

  shownMessages = messages;
  freenet.warmPeers([...new Set(messages.map((x) => x.sender))]); // their profile (avatar, name) loads, then the chat redraws
  if (replyingTo && replyingTo.room_id !== roomId) setReply(null); // another conversation
  attachBubbleDeleteListeners();
  chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
  messengerChat.renderThread();
  messengerChat.refreshDrawer();
  void messengerChat.refreshInbox();
}

async function selectChatPeer(peerPubkey: string) {
  if (!currentIdentity) return;
  activeChatPeer = peerPubkey;
  activeChatCommunity = null;
  activeChatPrivateRoom = null;
  if (chatInviteBtn) chatInviteBtn.style.display = "none";

  const name = getAuthorDisplayName(peerPubkey);
  chatPeerInfo.innerHTML = `<strong>${escapeHtml(name)}</strong> <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">(@${shortenKey(personaName(peerPubkey))})</span> <span class="chat-security-badge e2ee btn-icon-text" title="End-to-End Encrypted via X25519 ECDH + AES-256-GCM">${renderIcon("lock", { className: "icon-xs" })} <span>E2EE Private</span></span>`;
  chatClearBtn.style.display = "inline-block";
  chatClearBtn.title = "Delete entire conversation history";

  renderChatSidebar();
  renderChatParticipants();

  const messages = await freenet.getChatMessages(currentIdentity, peerPubkey);
  const roomId = freenet.getRoomId(currentIdentity.pubkey, peerPubkey);

  if (messages.length === 0) {
    paintChat(`<div class="empty-state" style="padding: 20px;">No messages yet. Direct messages are End-to-End Encrypted (E2EE).</div>`);
  } else {
    paintChat(() => messages
      .map((msg, i) =>
        renderChatMessage({
          msg,
          prev: messages[i - 1],
          all: messages,
          roomId,
          isMine: msg.sender === currentIdentity!.pubkey,
          senderName: getAuthorDisplayName(msg.sender),
          canDelete: true,
        })
      )
      .join(""));
  }

  shownMessages = messages;
  freenet.warmPeers([...new Set(messages.map((x) => x.sender))]); // their profile (avatar, name) loads, then the chat redraws
  if (replyingTo && replyingTo.room_id !== roomId) setReply(null); // another conversation
  attachBubbleDeleteListeners();
  chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
  messengerChat.renderThread();
  messengerChat.refreshDrawer();
  void messengerChat.refreshInbox();
}

async function sendActiveChatText(rawText: string, sourceBox?: HTMLElement): Promise<boolean> {
  if (!currentIdentity) return false;
  const text = rawText.trim();
  if (!text) return false;
  if (!activeChatPrivateRoom && !activeChatCommunity && !activeChatPeer) return false;

  const now = Date.now();
  if (now - lastChatMessageTime < CHAT_COOLDOWN_MS) {
    return false;
  }
  lastChatMessageTime = now;

  // Protect 64-hex persona keys before PII checks so digit runs inside keys aren't redacted as phone numbers
  const hexKeys: string[] = [];
  const maskedHex = text.replace(/\b@?[0-9a-f]{64}\b/gi, (k) => `\uE010${hexKeys.push(k) - 1}\uE011`);
  const censorship = censorTextAndPII(maskedHex);
  if (censorship.hasCensoredPII || censorship.hasCensoredProfanity) {
    showToast("Notice: Sensitive content in message was automatically masked.", "info");
  }
  const restored = hexKeys.length
    ? censorship.censoredText.replace(/\uE010(\d+)\uE011/g, (_, i) => hexKeys[Number(i)])
    : censorship.censoredText;
  const finalText = sourceBox ? withMentionKeys(sourceBox, restored) : restored;

  const replyTo = replyingTo && replyingTo.room_id === openRoomId() ? replyingTo.id : undefined;
  setReply(null);

  const resolveOptimistic = (optId: string, sentMsg: ChatMessage, roomKey?: string) => {
    if (roomKey) {
      const current: ChatMessage[] = JSON.parse(safeStorage.getItem(roomKey) || "[]");
      safeStorage.setItem(roomKey, JSON.stringify(current.filter((m) => m.id !== optId)));
    }
    const bubble = chatMessagesList.querySelector(`[data-msg-id="${optId}"]`);
    if (bubble) bubble.setAttribute("data-msg-id", sentMsg.id);
    shownMessages = shownMessages.map((m) => (m.id === optId ? { ...sentMsg, text: finalText } : m));
    messengerChat.renderThread();
    void messengerChat.refreshInbox();
  };

  const rejectOptimistic = (optId: string, roomKey?: string) => {
    if (roomKey) {
      const current = JSON.parse(safeStorage.getItem(roomKey) || "[]").filter((m: ChatMessage) => m.id !== optId);
      safeStorage.setItem(roomKey, JSON.stringify(current));
    }
    chatMessagesList.querySelector(`[data-msg-id="${optId}"]`)?.remove();
    shownMessages = shownMessages.filter((m) => m.id !== optId);
    messengerChat.renderThread();
    void messengerChat.refreshInbox();
  };

  if (activeChatPrivateRoom) {
    const room = activeChatPrivateRoom;
    const roomId = room.id;
    const roomKey = `freenet_chat_${roomId}`;
    const optId = `msg_opt_${Date.now()}`;
    const optMsg: ChatMessage = {
      id: optId,
      room_id: roomId,
      private_room_id: roomId,
      sender: currentIdentity.pubkey,
      text: finalText,
      timestamp: Date.now(),
      sig: "",
      ...(replyTo ? { reply_to: replyTo } : {}),
    };
    if (!room.river) {
      const raw = safeStorage.getItem(roomKey);
      const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
      list.push(optMsg);
      safeStorage.setItem(roomKey, JSON.stringify(list));
    }
    appendChatMessageToView({
      msg: optMsg,
      prev: shownMessages[shownMessages.length - 1],
      all: shownMessages,
      roomId,
      isMine: true,
      canDelete: true,
      senderName: "You",
    });
    freenet.sendPrivateRoomChatMessage(currentIdentity, room, finalText, replyTo).then((sentMsg) => {
      if (room.river) {
        if (activeChatPrivateRoom?.id === room.id) void selectPrivateRoom(room);
        else void messengerChat.refreshInbox();
      }
      else resolveOptimistic(optId, sentMsg, roomKey);
    }).catch((err) => {
      console.error("Private room chat error:", err);
      showToast(`Chat error: ${err.message || err}`, "error");
      rejectOptimistic(optId, room.river ? undefined : roomKey);
    });
    return true;
  }

  if (activeChatCommunity) {
    const comm = activeChatCommunity;
    const roomId = `comm_${comm.id}`;
    const roomKey = `freenet_chat_${roomId}`;
    const raw = safeStorage.getItem(roomKey);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
    const optId = `msg_opt_${Date.now()}`;
    const optMsg: ChatMessage = {
      id: optId,
      room_id: roomId,
      sender: currentIdentity.pubkey,
      community_id: comm.id,
      text: finalText,
      timestamp: Date.now(),
      sig: "",
      ...(replyTo ? { reply_to: replyTo } : {}),
    };
    list.push(optMsg);
    safeStorage.setItem(roomKey, JSON.stringify(list));
    appendChatMessageToView({
      msg: optMsg,
      prev: shownMessages[shownMessages.length - 1],
      all: shownMessages,
      roomId,
      isMine: true,
      canDelete: true,
      senderName: "You",
    });

    freenet.sendCommunityChatMessage(currentIdentity, comm.id, finalText, replyTo).then((sentMsg) => {
      resolveOptimistic(optId, sentMsg, roomKey);
    }).catch((err) => {
      console.error("Community chat error:", err);
      showToast(`Chat error: ${err.message || err}`, "error");
      rejectOptimistic(optId, roomKey);
    });
    return true;
  }

  if (activeChatPeer) {
    const peer = activeChatPeer;
    const roomId = freenet.getRoomId(currentIdentity.pubkey, peer);
    const roomKey = `freenet_chat_${roomId}`;
    const raw = safeStorage.getItem(roomKey);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
    const optId = `msg_opt_${Date.now()}`;
    const optMsg: ChatMessage = {
      id: optId,
      room_id: roomId,
      sender: currentIdentity.pubkey,
      recipient: peer,
      text: finalText,
      timestamp: Date.now(),
      sig: "",
      enc_pub: currentIdentity.encPub,
      ...(replyTo ? { reply_to: replyTo } : {}),
    };
    list.push(optMsg);
    safeStorage.setItem(roomKey, JSON.stringify(list));
    appendChatMessageToView({
      msg: optMsg,
      prev: shownMessages[shownMessages.length - 1],
      all: shownMessages,
      roomId,
      isMine: true,
      canDelete: true,
      senderName: "You",
    });

    freenet.sendChatMessage(currentIdentity, peer, finalText, replyTo).then((sentMsg) => {
      resolveOptimistic(optId, sentMsg, roomKey);
    }).catch((err) => {
      console.error("Direct chat error:", err);
      showToast(`Could not send message: ${err.message || err}`, "error");
      rejectOptimistic(optId, roomKey);
    });
    return true;
  }

  return false;
}

chatSendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const sent = await sendActiveChatText(chatMessageInput.value, chatMessageInput);
  if (sent) {
    chatMessageInput.value = "";
    fitChatInput();
  }
});

// Event listeners for Private Rooms
if (newPrivateRoomBtn && createPrivateRoomModal) {
  newPrivateRoomBtn.addEventListener("click", () => {
    if (!currentIdentity) {
      alert("Please sign in or create an identity first.");
      return;
    }
    if (privroomNameInput) privroomNameInput.value = "";
    if (privroomMembersInput) privroomMembersInput.value = "";

    // Quick-pick peers from following and known peers
    if (privroomQuickPick) {
      const candidates = Array.from(
        new Set([...followingKeys, ...freenet.getChatPeers(currentIdentity.pubkey)])
      ).filter((pk) => pk && pk !== currentIdentity!.pubkey);

      if (candidates.length === 0) {
        privroomQuickPick.innerHTML = `<span style="font-size: 0.75rem; color: var(--text-muted);">No contacts yet. You can paste 64-hex public keys directly.</span>`;
      } else {
        privroomQuickPick.innerHTML = candidates
          .map((pk) => {
            const p = freenet.knownPeers[pk];
            const name = p?.display_name || `@${shortenKey(pk)}`;
            return `<button type="button" class="btn-secondary btn-sm quick-pick-btn" data-key="${escapeHtml(pk)}" style="font-size: 0.7rem; padding: 2px 6px;">+ ${escapeHtml(name)}</button>`;
          })
          .join("");

        privroomQuickPick.querySelectorAll(".quick-pick-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const key = (btn as HTMLElement).dataset.key!;
            const cur = privroomMembersInput ? privroomMembersInput.value.trim() : "";
            if (privroomMembersInput) {
              if (cur.includes(key)) return;
              privroomMembersInput.value = cur ? `${cur}\n${key}` : key;
            }
          });
        });
      }
    }

    createPrivateRoomModal.style.display = "flex";
  });
}

if (createPrivroomCloseBtn && createPrivateRoomModal) {
  createPrivroomCloseBtn.addEventListener("click", () => {
    createPrivateRoomModal.style.display = "none";
  });
}

if (createPrivroomCancelBtn && createPrivateRoomModal) {
  createPrivroomCancelBtn.addEventListener("click", () => {
    createPrivateRoomModal.style.display = "none";
  });
}

if (createPrivroomSubmitBtn && createPrivateRoomModal) {
  createPrivroomSubmitBtn.addEventListener("click", async () => {
    if (!currentIdentity) return;
    const name = privroomNameInput ? privroomNameInput.value.trim() : "";
    if (!name) {
      alert("Please enter a room name.");
      return;
    }

    const rawMembers = privroomMembersInput ? privroomMembersInput.value : "";
    const memberKeys = rawMembers
      .split(/[\n,; ]+/)
      .map((k) => k.trim())
      .filter((k) => k.length === 64);

    try {
      const room = await freenet.createPrivateRoom(currentIdentity, name, memberKeys);
      createPrivateRoomModal.style.display = "none";
      await selectPrivateRoom(room);
      alert(`Private Room "${name}" created with ${room.members.length} member(s)!`);
    } catch (err: any) {
      alert(`Could not create private room: ${err.message || err}`);
    }
  });
}

if (chatInviteBtn && invitePrivroomModal) {
  chatInviteBtn.addEventListener("click", async () => {
    if (!activeChatPrivateRoom || !currentIdentity) return;
    if (invitePrivroomKeyInput) invitePrivroomKeyInput.value = "";
    if (copyLinkFeedback) copyLinkFeedback.style.display = "none";

    // Generate zero-knowledge invite link with room encryption key in URL fragment
    const link = await inviteLinkOf(activeChatPrivateRoom);
    if (link && invitePrivroomLinkInput) invitePrivroomLinkInput.value = link;

    if (sharePrivroomLinkBtn) {
      sharePrivroomLinkBtn.style.display = typeof navigator !== "undefined" && !!navigator.share ? "inline-block" : "none";
    }

    invitePrivroomModal.style.display = "flex";
  });
}

if (copyPrivroomLinkBtn && invitePrivroomLinkInput) {
  copyPrivroomLinkBtn.addEventListener("click", async () => {
    const link = invitePrivroomLinkInput.value.trim();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      invitePrivroomLinkInput.select();
      document.execCommand("copy");
    }
    if (copyLinkFeedback) {
      copyLinkFeedback.style.display = "block";
      setTimeout(() => {
        if (copyLinkFeedback) copyLinkFeedback.style.display = "none";
      }, 3000);
    }
  });
}

if (sharePrivroomLinkBtn && invitePrivroomLinkInput) {
  sharePrivroomLinkBtn.addEventListener("click", async () => {
    const link = invitePrivroomLinkInput.value.trim();
    if (!link) return;
    const roomName =
      activeChatPrivateRoom && currentIdentity
        ? await freenet.getPrivateRoomDecryptedName(currentIdentity, activeChatPrivateRoom)
        : "Private Room";
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${roomName} on Radica`,
          text: `Join encrypted private room "${roomName}" on Radica:`,
          url: link,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Error sharing invite link:", err);
        }
      }
    }
  });
}

if (joinPrivateRoomBtn && joinPrivroomModal) {
  joinPrivateRoomBtn.addEventListener("click", () => {
    if (!currentIdentity) {
      alert("Please sign in or create an identity first.");
      return;
    }
    if (joinPrivroomInput) joinPrivroomInput.value = "";
    joinPrivroomModal.style.display = "flex";
  });
}

if (joinPrivroomCloseBtn && joinPrivroomModal) {
  joinPrivroomCloseBtn.addEventListener("click", () => {
    joinPrivroomModal.style.display = "none";
  });
}

if (joinPrivroomCancelBtn && joinPrivroomModal) {
  joinPrivroomCancelBtn.addEventListener("click", () => {
    joinPrivroomModal.style.display = "none";
  });
}

if (joinPrivroomSubmitBtn && joinPrivroomModal) {
  joinPrivroomSubmitBtn.addEventListener("click", async () => {
    if (!currentIdentity) return;
    const raw = joinPrivroomInput ? joinPrivroomInput.value.trim() : "";
    if (!raw) {
      alert("Please paste a private room invite link or fragment.");
      return;
    }

    try {
      if (raw.includes("BEGIN RIVER IDENTITY")) {
        // River's "Export ID": be the same member here as in River, not a second one
        const room = await freenet.importRiverIdentity(currentIdentity, raw);
        joinPrivroomModal.style.display = "none";
        await selectPrivateRoom(room);
        alert(`You are now the same member in "${await freenet.getPrivateRoomDecryptedName(currentIdentity, room)}" as in River.`);
        return;
      }
      const code = riverCodeIn(raw); // a River invitation, from Radica, River's UI or riverctl
      if (code) {
        const room = await freenet.joinRiverInvitation(currentIdentity, code);
        joinPrivroomModal.style.display = "none";
        await selectPrivateRoom(room);
        alert(`Joined "${await freenet.getPrivateRoomDecryptedName(currentIdentity, room)}"!`);
        return;
      }
      let fragment = raw;
      if (raw.includes("#")) {
        fragment = raw.split("#")[1];
      } else if (raw.includes("?")) {
        fragment = raw.split("?")[1];
      }

      const invite = inviteFromParams(new URLSearchParams(fragment));
      if (!invite) {
        alert("Invalid invite link format. Missing join_room or valid 64-hex encryption key.");
        return;
      }
      const { name } = invite;
      const room = await freenet.joinPrivateRoomFromInvite(currentIdentity, invite);

      joinPrivroomModal.style.display = "none";
      await selectPrivateRoom(room);
      alert(`Successfully joined private room "${name}"!`);
    } catch (err: any) {
      alert(`Could not join private room: ${err.message || err}`);
    }
  });
}

if (invitePrivroomCloseBtn && invitePrivroomModal) {
  invitePrivroomCloseBtn.addEventListener("click", () => {
    invitePrivroomModal.style.display = "none";
  });
}

if (invitePrivroomCancelBtn && invitePrivroomModal) {
  invitePrivroomCancelBtn.addEventListener("click", () => {
    invitePrivroomModal.style.display = "none";
  });
}

if (invitePrivroomSubmitBtn && invitePrivroomModal) {
  invitePrivroomSubmitBtn.addEventListener("click", async () => {
    if (!currentIdentity || !activeChatPrivateRoom) return;
    const key = invitePrivroomKeyInput ? invitePrivroomKeyInput.value.trim() : "";
    if (!key || key.length !== 64) {
      alert("Please enter a valid 64-character hex public key.");
      return;
    }

    try {
      const updated = await freenet.inviteMemberToPrivateRoom(
        currentIdentity,
        activeChatPrivateRoom.id,
        key
      );
      invitePrivroomModal.style.display = "none";
      await selectPrivateRoom(updated);
      alert(`Peer invited! The room key has been encrypted and shared with @${shortenKey(key)}.`);
    } catch (err: any) {
      alert(`Could not invite member: ${err.message || err}`);
    }
  });
}

// ---- Activity / Notifications Modal ----

const NOTIFS_SHOWN = 15;
let shownNotifs: NotificationItem[] = [];

openNotifsBtn.addEventListener("click", async () => {
  if (!currentIdentity) return;
  // a click is the gesture the browser wants before it asks for permission to notify
  if (!toShell({ type: "notification_enable_prompt" })) {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
    } catch {}
  }
  notifsModal.style.display = "flex"; // open at once on what was drawn last, then draw the current list
  // storage keeps 50; the panel shows the newest few
  const notifs = (await freenet.getNotifications(currentIdentity)).slice(0, NOTIFS_SHOWN);
  await renderNotifs(notifs);
  // only senders with no known name or avatar are fetched (at most every 10 min, parsed in a worker); redraw once they are
  void freenet.warmPeers(notifs.map((n) => n.from)).then(() => { if (notifsModal.style.display !== "none") void renderNotifs(notifs); });
});

async function renderNotifs(notifs: NotificationItem[]) {
  shownNotifs = notifs;
  const myPosts = (await freenet.getFeed(currentIdentity!.pubkey)).posts;
  // which of my posts a like or comment is about: its first words, or "photo" for a post with only a picture
  const aboutPost = (id?: string): string => {
    const p = id ? (myPosts[id] || freenet.peerCache[id] || timelinePosts.find((x) => x.id === id)) : undefined;
    if (!p) return "";
    const words = p.caption.trim().replace(/\s+/g, " ");
    const label = words ? `\u201c${words.length > 60 ? words.slice(0, 60) + "\u2026" : words}\u201d` : p.media_uri ? "your photo" : "";
    return label ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">on ${escapeHtml(label)}</div>` : "";
  };

  if (notifs.length === 0) {
    notifsList.innerHTML = `<div class="empty-state">No notifications yet.</div>`;
  } else {
    notifsList.innerHTML = notifs
      .map(
        (n) => `
      <div class="notif-item ${n.read ? "" : "unread"}" data-notif-id="${escapeHtml(n.id)}" role="button" tabindex="0" title="Open and remove">
        <div>
          <span style="font-weight: 700;" title="${escapeHtml(n.from)}">${escapeHtml(getAuthorDisplayName(n.from))}</span>
          <span>${escapeHtml(n.text)}</span>
          ${aboutPost(n.linkPostId)}
        </div>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${formatTimeAgo(n.timestamp)}</span>
      </div>
    `
      )
      .join("");
  }
}

/** Show a post in the feed: its author's posts (mine by default), no filter, the page that holds it, scrolled to and flashed. */
async function showMyPost(postId: string, author = currentIdentity?.pubkey) {
  showProfilePage(false);
  currentFeedScope = "myposts";
  updateScopeBtnActive(scopeMyPostsBtn);
  feedAuthor = author === currentIdentity?.pubkey ? null : author ?? null;
  if (feedAuthor) scopeMyPostsBtn.classList.remove("active"); // someone else's posts: not "my posts"
  activeCommunity = null;
  communityHeaderBanner.style.display = "none";
  activeTagFilter = null;
  activeFilterBanner.style.display = "none";
  searchQuery = "";
  feedSearchInput.value = "";
  currentCategory = "all";
  document.querySelectorAll(".cat-btn").forEach((b) => b.classList.toggle("active", (b as HTMLElement).dataset.cat === "all"));
  await reloadPosts();
  const index = timelinePosts.findIndex((p) => p.id === postId);
  if (index >= visiblePosts) {
    visiblePosts = index + 1; // the post is on a later page
    renderTimeline();
  }
  const card = document.getElementById(`card-${postId}`);
  if (!card) return showToast("That post is no longer there.", "info");
  card.scrollIntoView({ block: "center", behavior: "smooth" });
  card.classList.add("notif-flash");
  setTimeout(() => card.classList.remove("notif-flash"), 2500);
}

/** Open what a notification is about and delete the notification. */
async function openNotification(n: NotificationItem) {
  if (!currentIdentity) return;
  freenet.dismissNotification(currentIdentity, n.id);
  notifsModal.style.display = "none";
  void updateNotificationsBadge();
  if (n.linkPostId) {
    await showMyPost(n.linkPostId, n.linkPostOwner);
  } else if (n.type === "follow") {
    await openUserProfile(n.from);
  } else if (n.linkRoomId) {
    activeChatCommunity = null;
    activeChatPeer = null;
    void showChat(async () => {
      allPrivateRooms = await freenet.getPrivateRooms(currentIdentity!);
      const room = allPrivateRooms.find((r) => r.id === n.linkRoomId);
      if (room) await selectPrivateRoom(room);
      else openChatWithPeer(n.from);
    });
  } else if (n.type === "chat") {
    openChatWithPeer(n.from);
  }
}

notifsList.addEventListener("click", (e) => {
  const item = (e.target as HTMLElement).closest<HTMLElement>("[data-notif-id]");
  const n = item && shownNotifs.find((x) => x.id === item.dataset.notifId);
  if (n) void openNotification(n);
});
notifsList.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const item = (e.target as HTMLElement).closest<HTMLElement>("[data-notif-id]");
  const n = item && shownNotifs.find((x) => x.id === item.dataset.notifId);
  if (n) {
    e.preventDefault();
    void openNotification(n);
  }
});

notifsCloseBtn.addEventListener("click", () => {
  notifsModal.style.display = "none";
});

notifsMarkReadBtn.addEventListener("click", async () => {
  if (!currentIdentity) return;
  notifsModal.style.display = "none"; // close first: the log write below goes over the network
  await freenet.markNotificationsAsRead(currentIdentity);
  updateNotificationsBadge();
});

const BASE_TITLE = document.title;
const startedAt = Date.now(); // only what arrives after the page opened is worth an alert
const alerted = new Set<string>();

/** Ask Freenet's shell page to do something for the sandboxed app (it is the one allowed to notify and to set the tab title). */
function toShell(msg: Record<string, unknown>): boolean {
  if (window.parent === window) return false; // not in the gateway's shell (Electron, dev server)
  window.parent.postMessage({ __freenet_shell__: true, ...msg }, "*");
  return true;
}

// the gateway's shell shows Freenet's rabbit in the tab: hand it Radica's own icon (it takes https: and data: URLs)
const ownIcon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute("href");
if (ownIcon) toShell({ type: "favicon", href: ownIcon });

/** Unread count in the tab title (the shell mirrors document.title) and, while the tab is hidden, a system
 *  notification per new item. The shell gates it on the browser permission and the user's consent for this app. */
function alertUnread(notifs: NotificationItem[], unreadCount: number) {
  document.title = unreadCount ? `(${unreadCount}) ${BASE_TITLE}` : BASE_TITLE;
  if (!document.hidden) return;
  for (const n of notifs) {
    if (n.read || n.timestamp < startedAt || alerted.has(n.id)) continue;
    alerted.add(n.id);
    const [title, body] = [getAuthorDisplayName(n.from), n.text];
    if (toShell({ type: "notification", title, body, tag: n.id })) continue;
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body, tag: n.id });
    } catch {}
  }
}

const chatBadge = document.getElementById("chat-badge") as HTMLElement;
/** Unread messages on the Chat button: every DM conversation (one never opened counts from its start) and the rooms
 *  already opened once (a room I never read would count its whole history). */
function updateChatBadge() {
  if (!currentIdentity) return;
  const me = currentIdentity.pubkey;
  const read = chatReadMap();
  for (const [room, t] of Object.entries(freenet.readMarks())) read[room] = Math.max(read[room] ?? 0, t);
  let n = 0;
  for (const peer of freenet.getChatPeers(me)) if (peer !== me) n += freenet.unreadCount(freenet.getRoomId(me, peer), me, read[freenet.getRoomId(me, peer)] ?? 0);
  for (const r of allPrivateRooms) if (read[r.id] !== undefined) n += freenet.unreadCount(r.id, me, read[r.id]);
  chatBadge.textContent = n > 99 ? "99+" : String(n);
  chatBadge.style.display = n ? "inline-block" : "none";
}

async function updateNotificationsBadge() {
  updateChatBadge();
  if (!currentIdentity) return;
  const notifs = await freenet.getNotifications(currentIdentity);
  const unreadCount = notifs.filter((n) => !n.read).length;
  alertUnread(notifs, unreadCount);

  if (unreadCount > 0) {
    notifBadge.textContent = unreadCount.toString();
    notifBadge.style.display = "inline-block";
  } else {
    notifBadge.style.display = "none";
  }
}

// ---- Hashtags & Search ----

function setTagFilter(tag: string | null) {
  activeTagFilter = tag;
  if (activeTagFilter) {
    activeFilterTag.textContent = `#${activeTagFilter}`;
    activeFilterBanner.style.display = "flex";
  } else {
    activeFilterBanner.style.display = "none";
  }
  renderTimeline();
}

clearFilterBtn.addEventListener("click", () => {
  setTagFilter(null);
});

feedSearchInput.addEventListener("input", () => {
  searchQuery = feedSearchInput.value.trim();
  renderTimeline();
});

// ---- Communities Logic & Moderation ----

function selectCommunity(comm: Community | null) {
  document.body.classList.remove("panel-open"); // phones: back from the panel to the community's feed
  activeCommunity = comm;
  if (activeCommunity) {
    communityHeaderBanner.style.display = "block";
    commBannerSlug.textContent = `r/${activeCommunity.slug}`;
    commBannerDesc.textContent = activeCommunity.description || "No description provided.";
    commBannerName.textContent = activeCommunity.name;
    commBannerName.style.display = activeCommunity.name ? "block" : "none";
    commMembersCount.textContent = activeCommunity.members.length.toString();
    commModsCount.textContent = activeCommunity.moderators.length.toString();

    const isOwner = currentIdentity && activeCommunity.creator === currentIdentity.pubkey;
    const isMod = currentIdentity && activeCommunity.moderators.includes(currentIdentity.pubkey);
    const isMember = currentIdentity && activeCommunity.members.includes(currentIdentity.pubkey);

    if (isOwner) {
      commRoleBadge.textContent = "Founder / Owner";
      commRoleBadge.style.display = "inline-block";
      commModBtn.style.display = "inline-block";
    } else if (isMod) {
      commRoleBadge.textContent = "Moderator";
      commRoleBadge.style.display = "inline-block";
      commModBtn.style.display = "inline-block";
    } else {
      commRoleBadge.style.display = "none";
      commModBtn.style.display = "none";
    }

    commEditBtn.style.display = isOwner ? "inline-block" : "none"; // only the creator's edits count (see foldCommunities)
    commJoinBtn.textContent = isMember ? "Joined" : "Join Community";
    commJoinBtn.className = isMember ? "btn-secondary btn-sm" : "btn-primary btn-sm";

    composerCommunitySelect.value = activeCommunity.id;
  } else {
    communityHeaderBanner.style.display = "none";
    composerCommunitySelect.value = "";
  }

  // Update active styling in sidebar
  document.querySelectorAll(".comm-item").forEach((el) => {
    const item = el as HTMLElement;
    if (activeCommunity && item.dataset.id === activeCommunity.id) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Reset category filter and ensure All Posts button is active
  currentCategory = "all";
  document.querySelectorAll(".cat-btn").forEach((b) => {
    const btn = b as HTMLElement;
    if (btn.dataset.cat === "all") {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  renderTimeline();
}

/** Tiles drawn at once; "Show more" adds this many. Typing narrows the list long before a few hundred communities matter. */
const COMMUNITIES_PER_PAGE = 8;
let communityTiles = COMMUNITIES_PER_PAGE;

/** When the communities list was last fetched from the network on purpose (a name nobody seems to have was typed). */
let commsCheckedAt = 0;
let commsChecking: Promise<void> | null = null;
function checkCommunitiesOnNetwork(): Promise<void> {
  return (commsChecking ??= freenet.refreshLog("communities", true).then(async () => {
    allCommunities = await freenet.getCommunities();
  }).finally(() => {
    commsCheckedAt = Date.now();
    commsChecking = null;
    renderCommunities();
  }));
}

function renderCommunities() {
  if (!communitiesList) return;

  // joined ones (and the one on screen) first, then the rest; both in the chosen order
  const postsIn = new Map<string, number>();
  for (const p of timelinePosts) if (p.community_id) postsIn.set(p.community_id, (postsIn.get(p.community_id) ?? 0) + 1);
  const found = findCommunities({
    communities: allCommunities,
    query: findCommInput.value,
    sort: commSortSelect.value as CommunitySort,
    pinned: (c) => isJoined(c) || c.id === activeCommunity?.id,
    postsIn,
    limit: communityTiles,
  });
  const item = (c: Community) => `
    <div class="comm-item ${activeCommunity?.id === c.id ? "active" : ""}" data-id="${escapeHtml(c.id)}" title="${escapeHtml(c.name)}">
      <span class="comm-item-title">r/${escapeHtml(c.slug)}</span>
      <span class="comm-item-badge" title="Members">${c.members.length}</span>
    </div>`;
  const joined = found.shown.slice(0, found.pinnedCount);
  const others = found.shown.slice(found.pinnedCount);
  // before offering to create a name, ask the network for the list: on a device that just opened Radica it may not be in yet
  const checking = !!found.create && Date.now() - commsCheckedAt > 60_000;
  if (checking) void checkCommunitiesOnNetwork();
  const createTile = checking
    ? `<div class="comm-section">Looking for r/${escapeHtml(found.create!)} on the network…</div>`
    : found.create
    ? `<button type="button" class="comm-item comm-item-new" data-create="${escapeHtml(found.create)}">
         <span class="comm-item-title">+ r/${escapeHtml(found.create)}</span><span class="comm-item-badge">new</span>
       </button>`
    : "";
  const painted = setHtmlIfChanged(communitiesList,
    (joined.length ? `<div class="comm-section">Joined</div>${joined.map(item).join("")}` : "") +
    (others.length ? `<div class="comm-section">${findCommInput.value.trim() ? "Found" : "More"}</div>${others.map(item).join("")}` : "") +
    (found.more > 0 ? `<button type="button" class="comm-more" id="comm-more-btn">Show more (${found.more})</button>` : "") +
    (!found.shown.length && !createTile ? `<div class="comm-section">No communities yet</div>` : "") +
    createTile);

  if (painted) {
    communitiesList.querySelectorAll<HTMLElement>(".comm-item[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        selectCommunity(allCommunities.find((c) => c.id === el.dataset.id) || null);
      });
    });
    communitiesList.querySelector("#comm-more-btn")?.addEventListener("click", () => {
      communityTiles += COMMUNITIES_PER_PAGE;
      renderCommunities();
    });
    // a name nobody has: the create dialog opens with it filled in
    communitiesList.querySelector<HTMLElement>("[data-create]")?.addEventListener("click", (e) => {
      const slug = (e.currentTarget as HTMLElement).dataset.create!;
      openCreateCommunityDialog(findCommInput.value.trim().replace(/^r\//i, "") || slug, slug);
    });
  }

  const shown = allCommunities.filter((c) => isJoined(c) || c.id === activeCommunity?.id);

  setHtmlIfChanged(composerCommunitySelect, `
    <option value="">Global Timeline</option>
    ${shown
      .map(
        (c) => `
      <option value="${escapeHtml(c.id)}" ${activeCommunity?.id === c.id ? "selected" : ""}>
        r/${escapeHtml(c.slug)} - ${escapeHtml(c.name)}
      </option>
    `
      )
      .join("")}
  `);
}

function openModerationPanel(comm: Community) {
  if (!currentIdentity) return;
  modModalCommTitle.textContent = `r/${comm.slug} - ${comm.name}`;
  modDeletedCount.textContent = comm.deleted_post_ids.length.toString();

  commModsList.innerHTML = comm.moderators
    .map((modPk) => {
      const isOwner = modPk === comm.creator;
      const canRemove = currentIdentity!.pubkey === comm.creator && !isOwner;
      return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem;">
        <div>
          <span style="font-family: monospace; font-weight: 600;">@${shortenKey(modPk)}</span>
          ${isOwner ? '<span style="color: var(--primary); font-weight: 700; margin-left: 6px;">(Founder / Root)</span>' : '<span style="color: var(--text-muted); margin-left: 6px;">(Moderator)</span>'}
        </div>
        ${
          canRemove
            ? `<button class="remove-mod-btn btn-secondary btn-sm" data-mod="${escapeHtml(modPk)}" style="color: var(--danger); font-size: 0.75rem; padding: 2px 6px;">Remove</button>`
            : ""
        }
      </div>
    `;
    })
    .join("");

  commModsList.querySelectorAll(".remove-mod-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const modPk = (e.currentTarget as HTMLElement).dataset.mod!;
      if (!confirm(`Remove @${shortenKey(modPk)} from moderators?`)) return;
      const res = await freenet.removeCommunityModerator(currentIdentity!, comm.id, modPk);
      alert(res.msg);
      if (res.success) {
        allCommunities = await freenet.getCommunities();
        const updated = allCommunities.find((c) => c.id === comm.id)!;
        activeCommunity = updated;
        openModerationPanel(updated);
        renderCommunities();
      }
    });
  });

  if (comm.deleted_post_ids.length === 0) {
    commDeletedPostsList.innerHTML = "No posts removed by moderation yet.";
  } else {
    commDeletedPostsList.innerHTML = comm.deleted_post_ids
      .map(
        (pid) => `
      <div style="padding: 4px 0; border-bottom: 1px solid var(--border); font-family: monospace; display: flex; align-items: center; gap: 6px;">
        ${renderIcon("trash2", { className: "icon-xs" })}
        <span>Post ID: ${escapeHtml(pid)}</span>
      </div>
    `
      )
      .join("");
  }

  commModModal.style.display = "flex";
}

// Search as you type: matching communities are tiles, a name nobody has becomes a "create" tile
findCommInput.addEventListener("input", () => {
  communityTiles = COMMUNITIES_PER_PAGE;
  renderCommunities();
});
findCommInput.addEventListener("keydown", (e) => {
  const q = findCommInput.value.trim().toLowerCase().replace(/^r\//, "");
  if (e.key !== "Enter" || !q) return;
  // the exact name wins over the sort order ("art" opens r/art, not a busier r/party)
  const exact = allCommunities.find((c) => c.slug.toLowerCase() === q || c.id.toLowerCase() === q || c.name.toLowerCase() === q);
  if (exact) return selectCommunity(exact);
  communitiesList.querySelector<HTMLElement>(".comm-item[data-id], [data-create]")?.click(); // else the first tile, or the new name
});
commSortSelect.value = safeStorage.getItem("radica_comm_sort") || "popular";
commSortSelect.addEventListener("change", () => {
  safeStorage.setItem("radica_comm_sort", commSortSelect.value);
  communityTiles = COMMUNITIES_PER_PAGE;
  renderCommunities();
});

// Exit community banner
commExitBtn.addEventListener("click", () => {
  selectCommunity(null);
});

// Join community button
commJoinBtn.addEventListener("click", async () => {
  if (!currentIdentity || !activeCommunity) return;
  await freenet.toggleJoinCommunity(currentIdentity, activeCommunity.id);
  allCommunities = await freenet.getCommunities();
  activeCommunity = allCommunities.find((c) => c.id === activeCommunity!.id) || null;
  selectCommunity(activeCommunity);
  renderCommunities();
});

// Open moderation modal button
commModBtn.addEventListener("click", () => {
  if (activeCommunity) {
    openModerationPanel(activeCommunity);
  }
});

commModCloseBtn.addEventListener("click", () => {
  commModModal.style.display = "none";
});

// Add moderator form
addModForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentIdentity || !activeCommunity) return;
  const modPk = addModPubkeyInput.value.trim();
  if (!modPk) return;

  const res = await freenet.addCommunityModerator(currentIdentity, activeCommunity.id, modPk);
  alert(res.msg);
  if (res.success) {
    addModPubkeyInput.value = "";
    allCommunities = await freenet.getCommunities();
    const updated = allCommunities.find((c) => c.id === activeCommunity!.id)!;
    activeCommunity = updated;
    openModerationPanel(updated);
    renderCommunities();
  }
});

// Create Community Modal triggers; the same dialog edits a community (editingCommunityId set): its slug stays.
let editingCommunityId: string | null = null;
function openCreateCommunityDialog(name = "", slug = "", edit?: Community) {
  editingCommunityId = edit?.id ?? null;
  commNameInput.value = edit ? edit.name : name;
  commSlugInput.value = edit ? edit.slug : slug;
  commSlugInput.disabled = !!edit;
  commDescInput.value = edit ? edit.description : "";
  document.getElementById("create-comm-title")!.textContent = edit ? `Edit r/${edit.slug}` : "Create a Decentralized Community";
  document.getElementById("create-comm-intro")!.textContent = edit
    ? "Only you, the founder, can change the name and description."
    : "As the creator, you become the founder and primary moderator with powers to manage mods and remove posts.";
  createCommSaveBtn.textContent = edit ? "Save" : "Create Community";
  createCommModal.style.display = "flex";
}
openCreateCommBtn.addEventListener("click", () => openCreateCommunityDialog());
commEditBtn.addEventListener("click", () => {
  if (activeCommunity) openCreateCommunityDialog("", "", activeCommunity);
});

createCommCancelBtn.addEventListener("click", () => {
  createCommModal.style.display = "none";
});

createCommSaveBtn.addEventListener("click", async () => {
  if (!currentIdentity) return;
  const name = commNameInput.value.trim();
  const slug = commSlugInput.value.trim();
  const desc = commDescInput.value.trim();

  if (!name || !slug) {
    alert("Please provide both name and short slug.");
    return;
  }

  const editing = editingCommunityId;
  const idle = editing ? "Save" : "Create Community";
  createCommSaveBtn.disabled = true;
  createCommSaveBtn.textContent = editing ? "Saving..." : "Creating...";

  try {
    const comm = editing
      ? await freenet.updateCommunity(currentIdentity, editing, name, desc)
      : await freenet.createCommunity(currentIdentity, name, slug, desc);
    allCommunities = await freenet.getCommunities();
    createCommModal.style.display = "none";
    renderCommunities();
    selectCommunity(allCommunities.find((c) => c.id === comm.id) ?? comm);
  } catch (err) {
    console.error("Error saving community:", err);
    alert(editing ? "Could not save the community." : "Could not create community on Freenet.");
  } finally {
    createCommSaveBtn.disabled = false;
    createCommSaveBtn.textContent = idle;
  }
});

// Scope Switcher buttons
function updateScopeBtnActive(activeBtn: HTMLButtonElement) {
  feedAuthor = null; // a scope button shows my own posts again; showMyPost sets it back after this when needed
  scopeExploreBtn.classList.remove("active");
  scopeFollowingBtn.classList.remove("active");
  scopeMyPostsBtn.classList.remove("active");
  activeBtn.classList.add("active");
}

// The rail opens pages of the main column. The profile page opens from my picture, the logo (or the back button) returns to the feed.
const feedView = document.getElementById("feed-view") as HTMLElement;
const profilePage = document.getElementById("profile-page") as HTMLElement;
const headAvatar = document.getElementById("head-avatar") as HTMLImageElement;
// the pictures in the feed header and the post box follow the one in the sidebar (set from several places)
const syncHeadAvatar = () => (headAvatar.src = composerAvatar.src = sidebarAvatar.src);
new MutationObserver(syncHeadAvatar).observe(sidebarAvatar, { attributes: true, attributeFilter: ["src"] });
syncHeadAvatar();
function showProfilePage(show: boolean) {
  closeRailPages(); // the feed and the profile page replace the chat and the other rail pages
  feedView.hidden = show;
  profilePage.hidden = !show;
  if (show) {
    (document.getElementById("pp-avatar") as HTMLImageElement).src = sidebarAvatar.src;
    document.getElementById("pp-name")!.textContent = sidebarName.textContent;
    document.getElementById("pp-meta")!.textContent = `${sidebarHandle?.textContent ?? ""} · ${sidebarBio.textContent}`;
    renderRoots();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showFeed() {
  document.body.classList.remove("panel-open");
  showProfilePage(false);
  scopeExploreBtn.click();
}
document.getElementById("rail-home-btn")!.addEventListener("click", showFeed);
// phones: the right panel in place of the feed; picking a community or a person in it goes back to the feed
const showPanel = (open: boolean) => {
  if (open) feedScrollY = window.scrollY;
  document.body.classList.toggle("panel-open", open);
  window.scrollTo({ top: open ? 0 : feedScrollY });
};
document.getElementById("head-panel-btn")!.addEventListener("click", () => showPanel(true));
document.getElementById("panel-back-btn")!.addEventListener("click", () => showPanel(false));
document.getElementById("pp-back-btn")!.addEventListener("click", () => showProfilePage(false));
document.getElementById("head-profile-btn")!.addEventListener("click", () => showProfilePage(true));
document.getElementById("pp-edit-btn")!.addEventListener("click", () => document.getElementById("edit-profile-btn")?.click());
document.getElementById("pp-backup-btn")!.addEventListener("click", () => document.getElementById("open-identity-btn")?.click());
// anything picked in the right panel (a community, my posts) shows up in the feed; my picture, name and handle open the profile
document.querySelector(".sidebar")?.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("#sidebar-avatar, #sidebar-name, #sidebar-handle")) return;
  if (feedView.hidden) showProfilePage(false);
}, true);

scopeExploreBtn.addEventListener("click", async () => {
  currentFeedScope = "explore";
  updateScopeBtnActive(scopeExploreBtn);
  await reloadPosts();
});

scopeFollowingBtn.addEventListener("click", async () => {
  currentFeedScope = "following";
  updateScopeBtnActive(scopeFollowingBtn);
  await reloadPosts();
});

function switchToMyPostsScope() {
  currentFeedScope = "myposts";
  updateScopeBtnActive(scopeMyPostsBtn);
  activeCommunity = null;
  if (communityHeaderBanner) communityHeaderBanner.style.display = "none";
  activeTagFilter = null;
  if (activeFilterBanner) activeFilterBanner.style.display = "none";
  reloadPosts();
}

scopeMyPostsBtn.addEventListener("click", switchToMyPostsScope);

// Clicking a stat or the badge filters to My Posts; my picture, name and handle (sidebar) open the profile page
myPubkeyBadge.addEventListener("click", switchToMyPostsScope);
for (const el of [sidebarAvatar, sidebarName, sidebarHandle]) el?.addEventListener("click", () => showProfilePage(true));
if (sidebarStatMyPosts) sidebarStatMyPosts.addEventListener("click", switchToMyPostsScope);

// ---- Theme Management (Dark / Light Mode) ----

function initTheme() {
  const saved = safeStorage.getItem("radica_theme") || safeStorage.getItem("spruce_theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
  // the sandboxed page storage does not outlive a session: the choice is kept on the node too
  if (!saved)
    void import("./delegate.ts")
      .then((m) => m.nodeGet("theme"))
      .then((t) => (t === "dark" || t === "light") && applyTheme(t), () => {});
}

function applyTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", theme);
  if (themeIcon) {
    themeIcon.innerHTML = theme === "dark"
      ? renderIcon("sun", { className: "icon-md" })
      : renderIcon("moon", { className: "icon-md" });
  }
  if (themeToggleBtn) {
    themeToggleBtn.title = theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
  }
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    safeStorage.setItem("radica_theme", next); // only a choice is kept: the system default is not
    void import("./delegate.ts").then((m) => m.nodePut("theme", next), () => {});
  });
}

// ---- Identity & Key Management Modal ----

function renderIdentityModal() {
  identityCloseBtn.style.display = currentIdentity ? "" : "none"; // nothing to go back to before signing in
  if (!currentIdentity) {
    identityPersonaName.textContent = "Not signed in";
    identityPubkeyVal.textContent = "Choose how to sign in below.";
    identityTypeBadge.className = "identity-badge";
    identityTypeBadge.textContent = "● No identity";
    identityBackupActions.style.display = "none";
    identityVisoActions.style.display = "none";
  } else if (currentIdentity.type === "viso") {
    identityPersonaName.textContent = currentIdentity.personaName || personaName(currentIdentity.pubkey);
    identityPubkeyVal.textContent = currentIdentity.pubkey;
    identityTypeBadge.className = "identity-badge viso";
    identityTypeBadge.textContent = "● Viso Persona";
    identityBackupActions.style.display = "none";
    identityVisoActions.style.display = "flex";
  } else {
    identityPersonaName.textContent = currentIdentity.personaName || personaName(currentIdentity.pubkey);
    identityPubkeyVal.textContent = currentIdentity.pubkey;
    identityTypeBadge.className = "identity-badge local";
    identityTypeBadge.textContent = "● Local Keypair";
    identityBackupActions.style.display = "flex";
    identityVisoActions.style.display = "none";
    idSecretKeyDisplay.style.display = "none";
    idSecretKeyDisplay.textContent = localIdentityKey() || "";
    idShowKeyBtn.innerHTML = `<span class="btn-icon-text">${renderIcon("eye", { className: "icon-sm" })} <span>Show Secret Key</span></span>`;
  }

  visoUrlInput.value = safeStorage.getItem("radica_viso_url") || safeStorage.getItem("spruce_viso_url") || officialViso();
  visoStatusMsg.textContent = "";
  localCreateMsg.textContent = "";
  localImportMsg.textContent = "";
}

function openIdentityModal() {
  renderIdentityModal();
  identityModal.style.display = "flex";
}

if (openIdentityBtn) {
  openIdentityBtn.addEventListener("click", openIdentityModal);
}

identityCloseBtn.addEventListener("click", () => {
  identityModal.style.display = "none";
});

idShowKeyBtn.addEventListener("click", () => {
  if (idSecretKeyDisplay.style.display === "none") {
    idSecretKeyDisplay.style.display = "block";
    idShowKeyBtn.innerHTML = `<span class="btn-icon-text">${renderIcon("eye", { className: "icon-sm" })} <span>Hide Secret Key</span></span>`;
  } else {
    idSecretKeyDisplay.style.display = "none";
    idShowKeyBtn.innerHTML = `<span class="btn-icon-text">${renderIcon("eye", { className: "icon-sm" })} <span>Show Secret Key</span></span>`;
  }
});

idDownloadKeyBtn.addEventListener("click", () => {
  const sk = localIdentityKey();
  if (!sk || !currentIdentity) return;
  const shortName = (currentIdentity.personaName || currentIdentity.pubkey).slice(0, 8);
  const blob = new Blob(
    [`Radica Decentralized Identity Private Key (keep it secret):\n${sk}\n`],
    { type: "text/plain" }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `radica-identity-${shortName}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
});

const handleSignOut = async () => {
  const isLocal = currentIdentity?.type === "local";
  if (
    isLocal &&
    !confirm(
      "Signing out deletes this key from this browser. Without your backup file or key, this identity cannot be recovered. Are you sure you want to sign out?"
    )
  ) {
    return;
  }
  await signOut();
  restart();
};

idSignoutBtn.addEventListener("click", handleSignOut);
idVisoSignoutBtn.addEventListener("click", handleSignOut);

visoUseOfficialBtn.addEventListener("click", () => {
  visoUrlInput.value = officialViso();
});

visoSigninBtn.addEventListener("click", async () => {
  try {
    visoStatusMsg.textContent = "Opening Viso...";
    const targetUrl = visoUrlInput.value.trim() || officialViso();
    const connectUrl = await startSignIn(targetUrl);
    goTo(connectUrl);
  } catch (err) {
    console.error("Viso sign-in start failed:", err);
    visoStatusMsg.textContent = (err as Error).message || "Failed to start Viso sign-in.";
  }
});

createNewKeyBtn.addEventListener("click", async () => {
  try {
    if (
      currentIdentity?.type === "local" &&
      !confirm("Generate a new identity keypair? Make sure your current key is backed up first.")
    ) {
      return;
    }
    localCreateMsg.textContent = "Generating...";
    await createLocalIdentity();
    restart();
  } catch (err) {
    localCreateMsg.textContent = (err as Error).message || "Error generating identity.";
  }
});

importKeyBtn.addEventListener("click", async () => {
  try {
    const rawKey = importKeyInput.value.trim();
    if (!rawKey) {
      localImportMsg.textContent = "Please enter 64 hex characters.";
      return;
    }
    localImportMsg.textContent = "Importing...";
    await createLocalIdentity(rawKey);
    restart();
  } catch (err) {
    localImportMsg.textContent = (err as Error).message || "Invalid key format.";
  }
});

// Copy public key to clipboard when clicking on identity pubkey box
identityPubkeyVal.addEventListener("click", () => {
  if (currentIdentity) {
    navigator.clipboard.writeText(currentIdentity.pubkey);
    alert("Public key copied to clipboard!");
  }
});

/** The invite link to a private room: a River room mints one (its owner only), an older room carries its key. */
async function inviteLinkOf(room: PrivateRoom): Promise<string | null> {
  const name = await freenet.getPrivateRoomDecryptedName(currentIdentity!, room);
  if (room.river) return freenet.getRiverInviteLink(currentIdentity!, room).catch((e) => (alert(e.message || e), null));
  const key = await freenet.getPrivateRoomKey(currentIdentity!, room);
  return key ? freenet.getPrivateRoomInviteLink(room, key, name) : null;
}

/** A River invitation code in what was pasted: a bare code, River's `?invitation=` link, or Radica's `#river_invite=`. */
function riverCodeIn(raw: string): string | null {
  const m = /(?:[?#&]invitation=|[#&]river_invite=)([1-9A-HJ-NP-Za-km-z]+)/.exec(raw) ?? /^\s*([1-9A-HJ-NP-Za-km-z]{60,})\s*$/.exec(raw);
  return m ? m[1] : null;
}

/** What an invite link (its fragment) asks to join, or null if it is not one. */
function inviteFromParams(params: URLSearchParams) {
  const roomId = params.get("join_room");
  const name = params.get("name") || "Private Room";
  const creator = params.get("creator") || "";
  const owner = params.get("river_owner");
  if (roomId && owner)
    return { roomId, name, creator, keyHex: "", river: { owner, k: params.get("k") ?? "", member: params.get("m") ?? "", secret: params.get("s") || undefined } };
  const keyHex = params.get("key");
  return roomId && keyHex && keyHex.length === 64 ? { roomId, name, keyHex, creator } : null;
}
const INVITE_PARAMS = ["join_room", "key", "name", "creator", "river_owner", "k", "m", "s", "river_invite"];

// Check URL fragment for private room invite link
async function checkUrlInviteHash() {
  if (!currentIdentity) return;
  const hash = window.location.hash ? window.location.hash.substring(1) : "";
  if (!hash || !(hash.includes("join_room=") || hash.includes("river_invite="))) return;

  const code = riverCodeIn("#" + hash);
  const invite = code ? null : inviteFromParams(new URLSearchParams(hash));
  if (code || invite) {
    try {
      const room = code ? await freenet.joinRiverInvitation(currentIdentity, code) : await freenet.joinPrivateRoomFromInvite(currentIdentity, invite!);
      const name = invite?.name ?? (await freenet.getPrivateRoomDecryptedName(currentIdentity, room));

      // Clear the invite fragment parameters from the URL while preserving auth_state if present
      const currentHash = window.location.hash ? window.location.hash.substring(1) : "";
      const remainingParts = currentHash
        .split("&")
        .filter((p) => p && !INVITE_PARAMS.includes(p.split("=")[0]));
      const cleanHash = remainingParts.length > 0 ? "#" + remainingParts.join("&") : "";
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ __freenet_shell__: true, type: "hash", hash: cleanHash || "#" }, "*");
        }
      } catch {}
      try {
        window.history.replaceState(null, "", window.location.pathname + window.location.search + cleanHash);
      } catch {}

      // Open the chat dialog and select the newly joined room
      chatModal.style.display = "flex";
      await selectPrivateRoom(room);
      alert(`Successfully joined private room "${name}"!`);
    } catch (err) {
      console.error("Failed to auto-join private room from URL hash:", err);
    }
  }
}

// ---- Initialize App ----

// Startup screen: the page answers slowly while the first feeds arrive, so it stays up until they settle (at most BOOT_MAX_MS)
const BOOT_MAX_MS = 12000;
const BOOT_QUIET_MS = 2500; // sync passes run at most every 2 s: a longer gap means the startup burst is over
const bootStep = (msg: string) => {
  const p = document.getElementById("boot-msg");
  if (p) p.textContent = msg;
};
function hideBoot() {
  const el = document.getElementById("boot-screen");
  if (!el || el.classList.contains("done")) return;
  el.classList.add("done");
  setTimeout(() => el.remove(), 400);
}
setTimeout(hideBoot, BOOT_MAX_MS); // never stuck behind it, whatever init does

/** Wait until no sync pass ran for BOOT_QUIET_MS, then for an idle moment. */
async function bootSettled() {
  let last = Date.now();
  freenet.onSyncUpdate(() => (last = Date.now()));
  while (Date.now() - last < BOOT_QUIET_MS) await new Promise((r) => setTimeout(r, 250));
  await new Promise((r) => ("requestIdleCallback" in window ? requestIdleCallback(r, { timeout: 2000 }) : setTimeout(r, 0)));
}

async function init() {
  initTheme();

  // Check Viso callback in URL query parameters
  const queryParams = new URLSearchParams(window.location.search);
  if (
    queryParams.has("viso") ||
    queryParams.has("whoiam") ||
    (queryParams.has("pk") && queryParams.has("sig"))
  ) {
    try {
      const { persona, replayed } = await finishSignIn(queryParams);
      try {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState(null, "", cleanUrl);
      } catch {}
      if (!replayed) alert(`Successfully signed in with Viso persona: ${personaName(persona)}!`);
    } catch (err) {
      console.error("Viso sign-in verification error:", err);
      alert("Viso sign-in failed: " + ((err as Error).message || err));
      try {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState(null, "", cleanUrl);
      } catch {}
    }
  }

  let identity = await getIdentity();
  if (!identity) {
    // page storage was lost (new tab, cleared data): take the key the node kept for a local identity, or the Viso sign-in
    const { nodeGet } = await import("./delegate.ts");
    // the Viso sign-in first: making a local identity clears it, while a local seed stays after signing in with Viso
    const viso = await nodeGet("viso-session");
    const seed = viso ? null : await nodeGet("local-seed");
    if (viso) {
      safeStorage.setItem("radica_session", viso);
      identity = await getIdentity(); // checks the sign-in still names this device's app key
    } else if (seed) {
      try {
        await createLocalIdentity(seed);
        identity = await getIdentity();
      } catch {}
    }
  }
  if (!identity) {
    // first visit: let the visitor choose (Viso, new key, imported key) instead of making an identity for them
    hideBoot();
    openIdentityModal();
    return;
  }
  currentIdentity = identity;
  freenet.setIdentity(currentIdentity);
  void listsFromNode.then(() => {
    refreshTrustedBlocklists();
    renderTimeline();
  });
  if (certShowsHost(identity.cert))
    showToast("Your Viso sign-in carries your node's address, and it is published with what you post. Sign out and sign in with Viso again to replace it with a generic one.", "warning", 15000);

  // Check if user followed an invite link hash to join an encrypted private room
  await checkUrlInviteHash();
  window.addEventListener("hashchange", () => checkUrlInviteHash());

  // Load Feed to check profile and following
  const myFeed = await freenet.getFeed(currentIdentity.pubkey);
  let savedProfile = myFeed.profile || null;
  if (!savedProfile) {
    const rawSaved = safeStorage.getItem(`radica_profile_${currentIdentity.pubkey}`);
    if (rawSaved) {
      try {
        savedProfile = JSON.parse(rawSaved);
      } catch {}
    }
  }
  currentProfile = savedProfile;
  if (currentProfile) {
    freenet.knownPeers[currentIdentity.pubkey] = {
      display_name: currentProfile.display_name,
      avatar_url: currentProfile.avatar_url,
    };
  }
  followingKeys = myFeed.following || [];

  // Populate UI with identity (Base58 Persona name + shortened pubkey)
  const personaBase58 = currentIdentity.personaName || personaName(currentIdentity.pubkey);
  const shortPersona = personaBase58.length > 10 ? `${personaBase58.slice(0, 10)}...` : personaBase58;
  myPubkeyBadge.textContent = `@${shortPersona}`;
  myPubkeyBadge.title = `Persona: ${personaBase58}\nPubkey: ${currentIdentity.pubkey}\nClick to manage identity`;
  sidebarName.textContent = currentProfile?.display_name || `Persona @${shortPersona}`;
  sidebarBio.textContent = currentProfile?.bio || "No bio yet.";
  if (sidebarHandle) {
    sidebarHandle.textContent = `@${shortPersona}`;
    sidebarHandle.title = `Persona: ${personaBase58}\nClick to open my profile`;
  }
  sidebarAvatar.src = composerAvatar.src = currentProfile?.avatar_url || generateDefaultAvatar(currentIdentity.pubkey);
  sidebarAvatar.onerror = composerAvatar.onerror = function (this: HTMLImageElement) {
    this.src = generateDefaultAvatar(currentIdentity?.pubkey || "radica");
  };

  await updateMyPostsAndScopeCounts();
  renderIdentityModal();
  renderFollowingList();
  renderDiscoveredPeers();
  updateNotificationsBadge();

  // Announce persona to peer network and subscribe to real-time events
  freenet.announceIdentity(currentIdentity, currentProfile);
  let syncBusy = false, syncAgain = false; // passes never overlap: a slow one (decrypt + redraw) queues one rerun instead of piling up
  freenet.onSyncUpdate(async function syncPass() {
    if (syncBusy) { syncAgain = true; return; }
    syncBusy = true;
    try { await syncBody(); } finally { syncBusy = false; if (syncAgain) { syncAgain = false; void syncPass(); } }
  });
  async function syncBody() {
    // my feed can arrive from the network after startup (fresh sandbox, empty local cache): take profile and follows from it
    const mine = await freenet.getFeed(currentIdentity!.pubkey);
    if (mine.profile && (mine.profile.updated_at ?? 0) > (currentProfile?.updated_at ?? 0)) {
      currentProfile = mine.profile;
      sidebarName.textContent = mine.profile.display_name;
      sidebarBio.textContent = mine.profile.bio || "No bio yet.";
      if (mine.profile.avatar_url) sidebarAvatar.src = mine.profile.avatar_url;
      freenet.knownPeers[currentIdentity!.pubkey] = { display_name: mine.profile.display_name, avatar_url: mine.profile.avatar_url };
      void freenet.announceIdentity(currentIdentity!, mine.profile);
    }
    if (mine.following?.length && mine.following.length !== followingKeys.length) {
      followingKeys = [...new Set([...followingKeys, ...mine.following])];
    }
    const chatOpen = chatModal.style.display !== "none"; // feed, lists and posts sit behind the chat: redrawn when it closes
    if (!chatOpen) renderFollowingList(); // names and avatars of the people I follow arrive with their feeds
    await yieldToMain(); // a sync pass is many draws: let a click in between be handled and painted first
    allCommunities = await freenet.getCommunities();
    allPrivateRooms = await freenet.getPrivateRooms(currentIdentity!);
    if (activeCommunity) {
      const refreshed = allCommunities.find((c) => c.id === activeCommunity!.id);
      if (refreshed) {
        activeCommunity = refreshed;
        selectCommunity(activeCommunity);
      }
    }
    if (!chatOpen) {
      renderCommunities();
      renderDiscoveredPeers();
    }
    await yieldToMain();
    await freenet.syncCommentedPosts(currentIdentity!);
    const activeRoom = chatModal.style.display !== "none" ? openRoomId() : null;
    const roomsFresh = await freenet.syncRiverRooms(currentIdentity!, activeRoom);
    const dmsFresh = await freenet.syncRiverDms(currentIdentity!);
    const riverFresh = roomsFresh || dmsFresh;
    await updateNotificationsBadge();
    await yieldToMain();

    // Live update open chat dialog
    if (chatModal.style.display !== "none") {
      if (currentChatLayout() === "messenger") {
        void messengerChat.refreshInbox();
      }
      if (!activeChatPrivateRoom && !activeChatCommunity && !activeChatPeer) renderChatSidebar(); // the select* below draws it itself
      if (activeChatPrivateRoom) {
        await selectPrivateRoom(activeChatPrivateRoom);
      } else if (activeChatCommunity) {
        await selectCommunityRoom(activeChatCommunity);
      } else if (activeChatPeer && currentIdentity) {
        await selectChatPeer(activeChatPeer);
      }
    }

    if (!chatOpen) await reloadPosts();
  }

  // Load Communities & Private Rooms
  allCommunities = await freenet.getCommunities();
  renderCommunities();
  if (currentIdentity) {
    allPrivateRooms = await freenet.getPrivateRooms(currentIdentity);
    updateChatBadge();
  }
  const ecoFooter = document.getElementById("sidebar-ecosystem-footer");
  if (ecoFooter) ecoFooter.innerHTML = ecosystemFooter(nodeOrigin());

  // Connect to Freenet Node
  bootStep("Connecting to your Freenet node…");
  const connected = await freenet.connect();
  if (connected) {
    void freenet.syncOwnFeed(currentIdentity!); // in background: publish my feed, pick up what my other devices wrote
    freenetDot.classList.add("online");
    freenetStatusLabel.textContent = "Your node is online";
    setChatStatus(true);
  } else {
    freenetDot.classList.remove("online");
    setChatStatus(false);
    freenetStatusLabel.textContent = "Local-First Storage";
    freenetStatusLabel.title = `Freenet node unreachable: ${freenet.connectError}`;
  }

  // Load Timeline (Explore by default so all posts on network are immediately visible)
  bootStep("Loading posts…");
  await reloadPosts();
  bootStep("Fetching new posts from the network…");
  await bootSettled();
  hideBoot();

  if (sessionStorage.getItem("radica_open_chat_on_boot") === "1" || queryParams.get("chat") === "messenger") {
    sessionStorage.removeItem("radica_open_chat_on_boot");
    safeStorage.setItem(CHAT_LAYOUT_KEY, "messenger");
    openChatBtn.click();
  }
}

init();

