import { UPDATES } from "./updates";
import { getIdentity, personaName } from "./crypto";
import { linkify, renderCaption } from "./caption.ts";
import "./chat.css";
import {
  finishSignIn,
  startSignIn,
  officialViso,
  createLocalIdentity,
  localIdentityKey,
  signOut,
  goTo,
} from "./whoiam";
import { freenet } from "./freenet";
import { analyzeImageFile, analyzeTextContent, censorTextAndPII } from "./moderation";
import { renderIcon } from "./icons";
import { safeStorage } from "./storage";
import { generateDefaultAvatar, compressAvatarFile, compressPostImageFile } from "./avatar";
import type {
  Post,
  PostCategory,
  UserIdentity,
  ProfileInfo,
  ChatMessage,
  NotificationItem,
  Community,
  PrivateRoom,
} from "./types.ts";
import { likers } from "./types.ts";

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
let activeTagFilter: string | null = null;
let searchQuery: string = "";
let currentFeedScope: "explore" | "following" | "myposts" = "explore";
let currentMediaNsfw = false;
let currentMediaNsfwScore = 0;

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
const communitiesList = document.getElementById("communities-list") as HTMLElement;
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
  safeStorage.setItem(HIDDEN_KEY, JSON.stringify(hide ? [...rest, pubkey] : rest));
}
// Curators whose public blocklist I follow: whoever they block is hidden for me too.
const TRUSTED_KEY = "radica_trusted_blocklists";
function trustedCurators(): string[] {
  try {
    const list = JSON.parse(safeStorage.getItem(TRUSTED_KEY) || "[]");
    return Array.isArray(list) ? list.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}
function setCuratorTrusted(pubkey: string, trust: boolean): void {
  const rest = trustedCurators().filter((k) => k !== pubkey);
  safeStorage.setItem(TRUSTED_KEY, JSON.stringify(trust ? [...rest, pubkey] : rest));
}
function isHiddenAuthor(pubkey: string): boolean {
  return hiddenUsers().includes(pubkey) || trustedCurators().some((c) => freenet.blockedBy(c).has(pubkey));
}
function refreshTrustedBlocklists(): void {
  for (const c of trustedCurators()) void freenet.refreshLog(`blocklist/${c}`).then(() => {
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
const chatModalCard = document.querySelector(".chat-modal-card") as HTMLElement | null;
const chatBody = document.getElementById("chat-body") as HTMLElement | null;
const chatPeerInfo = document.getElementById("chat-peer-info") as HTMLElement;
const chatCommunitiesList = document.getElementById("chat-communities-list") as HTMLElement;
const chatPeersList = document.getElementById("chat-peers-list") as HTMLElement;
const chatMessagesList = document.getElementById("chat-messages-list") as HTMLElement;
const chatSendForm = document.getElementById("chat-send-form") as HTMLFormElement;
const chatMessageInput = document.getElementById("chat-message-input") as HTMLInputElement;
const chatCloseBtn = document.getElementById("chat-close-btn") as HTMLButtonElement;
const chatClearBtn = document.getElementById("chat-clear-btn") as HTMLButtonElement;
const chatInviteBtn = document.getElementById("chat-invite-btn") as HTMLButtonElement | null;
const chatFullscreenToggleBtn = document.getElementById("chat-fullscreen-toggle-btn") as HTMLButtonElement | null;
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

// Notifications Modal Elements
const updatesModal = document.getElementById("updates-modal") as HTMLElement;
document.getElementById("updates-open-btn")!.addEventListener("click", () => {
  document.getElementById("updates-list")!.innerHTML = UPDATES.map(
    (u) => `<div><strong>${escapeHtml(u.date)}</strong><div>${escapeHtml(u.text)}</div></div>`
  ).join("");
  updatesModal.style.display = "flex";
});
document.getElementById("updates-close-btn")!.addEventListener("click", () => (updatesModal.style.display = "none"));
const blocklistsModal = document.getElementById("blocklists-modal") as HTMLElement;
function renderBlocklists() {
  const me = currentIdentity!.pubkey;
  const row = (pk: string, note: string, action: string) =>
    `<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;"><span>${escapeHtml(getAuthorDisplayName(pk))} <small>${escapeHtml(note)}</small></span><button class="btn-secondary btn-sm" data-act="${action}" data-pk="${escapeHtml(pk)}">${action === "untrust" ? "Stop" : "Remove"}</button></div>`;
  const trusted = trustedCurators();
  document.getElementById("blocklists-trusted")!.innerHTML =
    trusted.map((c) => row(c, `blocks ${freenet.blockedBy(c).size}`, "untrust")).join("") || "<small>None yet.</small>";
  document.getElementById("blocklists-mine")!.innerHTML =
    [...freenet.blockedBy(me)].map((t) => row(t, "", "unblock")).join("") || "<small>Empty.</small>";
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

function updateCategoryCounts() {
  countAll.textContent = timelinePosts.length.toString();
  countThought.textContent = timelinePosts.filter((p) => p.category === "thought").length.toString();
  countMoment.textContent = timelinePosts.filter((p) => p.category === "moment").length.toString();
  countEvent.textContent = timelinePosts.filter((p) => p.category === "event").length.toString();
}

function renderFollowingList() {
  freenet.warmPeers(followingKeys);
  followingCount.textContent = followingKeys.length.toString();
  if (scopeFollowingCount) {
    scopeFollowingCount.textContent = followingKeys.length.toString();
  }
  if (followingKeys.length === 0) {
    followingList.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted);">Not following anyone yet.</div>`;
    return;
  }

  followingList.innerHTML = followingKeys
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
    .join("");

  // Following list click handlers
  followingList.querySelectorAll(".unfollow-btn").forEach((btn) => {
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

  followingList.querySelectorAll(".author-clickable").forEach((el) => {
    el.addEventListener("click", (e) => {
      const pk = (e.currentTarget as HTMLElement).dataset.author!;
      openUserProfile(pk);
    });
  });

  followingList.querySelectorAll(".talk-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const pk = (e.currentTarget as HTMLElement).dataset.author!;
      openChatWithPeer(pk);
    });
  });
}

function renderDiscoveredPeers() {
  if (!discoveredPeersList || !currentIdentity) return;
  // only people who chose a name: default "Persona @…" accounts are noise
  const discoveredAll = freenet.getDiscoveredPeers(currentIdentity.pubkey);
  freenet.warmPeers(discoveredAll.map((p) => p.pubkey));
  const peers = discoveredAll.filter((p) => freenet.knownPeers[p.pubkey]?.display_name && !freenet.knownPeers[p.pubkey].display_name.startsWith("Persona @"));
  if (peers.length === 0) {
    discoveredPeersList.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted);">No other peers detected yet. Open another tab to connect!</div>`;
    return;
  }

  discoveredPeersList.innerHTML = peers
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
    .join("");

  discoveredPeersList.querySelectorAll(".toggle-follow-peer-btn").forEach((btn) => {
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

  discoveredPeersList.querySelectorAll(".author-clickable").forEach((el) => {
    el.addEventListener("click", (e) => {
      const pk = (e.currentTarget as HTMLElement).dataset.author!;
      openUserProfile(pk);
    });
  });

  discoveredPeersList.querySelectorAll(".talk-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const pk = (e.currentTarget as HTMLElement).dataset.author!;
      openChatWithPeer(pk);
    });
  });
}

async function updateMyPostsAndScopeCounts() {
  if (!currentIdentity) return;
  try {
    const myFeed = await freenet.getFeed(currentIdentity.pubkey);
    const myCount = Object.keys(myFeed.posts || {}).length;
    if (scopeMyPostsCount) scopeMyPostsCount.textContent = myCount.toString();
    if (sidebarMyPostsCount) sidebarMyPostsCount.textContent = myCount.toString();
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
  } else if (currentFeedScope === "following") {
    timelinePosts = await freenet.getTimeline(currentIdentity);
  } else if (currentFeedScope === "myposts") {
    const myFeed = await freenet.getFeed(currentIdentity.pubkey);
    timelinePosts = Object.values(myFeed.posts || {}).sort((a, b) => b.timestamp - a.timestamp);
  }
  renderTimeline();
  updateMyPostsAndScopeCounts();
}

function renderTimeline() {
  if (!currentIdentity) return;

  // Filter pipeline
  let filtered = timelinePosts.filter((p) => !isHiddenAuthor(p.author));

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
    if (currentFeedScope === "myposts") {
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

  postsContainer.innerHTML = filtered
    .filter((post) => SAFE_ID.test(post.id) && HEX64.test(post.author))
    .map((post) => {
      const isLiked = !!post.likes?.[currentIdentity!.pubkey]?.liked;
      const isMyPost = post.author === currentIdentity!.pubkey;
      const isModOrOwner =
        activeCommunity &&
        (activeCommunity.creator === currentIdentity!.pubkey ||
          activeCommunity.moderators.includes(currentIdentity!.pubkey));
      const commentsArray = Object.values(post.comments).sort((a, b) => a.timestamp - b.timestamp);
      const authorDisplayName = getAuthorDisplayName(post.author);
      const authorAvatar = getAuthorAvatarUrl(post.author);

      return `
      <article class="gram-card" id="card-${post.id}">
        <div class="gram-card-header">
          <div class="gram-author-info">
            <img src="${safeUrl(authorAvatar)}" class="gram-author-img author-clickable" data-author="${escapeHtml(post.author)}" onerror="this.onerror=null; this.src='${generateDefaultAvatar(post.author)}'" style="cursor: pointer;" />
            <div>
              <span class="gram-author-name author-clickable" data-author="${escapeHtml(post.author)}" style="cursor: pointer;" title="Persona: ${post.author}">${escapeHtml(authorDisplayName)}</span>
              <span class="gram-category-tag ${escapeHtml(post.category)}">${escapeHtml(post.category)}</span>
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
            <img src="${safeUrl(post.media_uri)}" alt="Post media" onerror="this.style.display='none'" />
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
          <p class="gram-caption">${renderCaption(post.caption)}</p>

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
                 </button>`
              : ""
          }
        </div>

        <div class="gram-comments">
          <div class="comments-list" id="comments-${post.id}">
            ${commentsArray
              .map(
                (c) => `
              <div class="comment-item">
                <span class="comment-author author-clickable" data-author="${escapeHtml(c.author)}" style="cursor: pointer;" title="Persona: ${c.author}">${escapeHtml(getAuthorDisplayName(c.author))}:</span>
                <span>${escapeHtml(c.text)}</span>
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
    })
    .join("");

  attachCardListeners();
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

function openPostLink(this: HTMLAnchorElement, e: Event) {
  e.stopPropagation();
  if (window.parent === window) return; // normal page: the browser follows the link
  e.preventDefault();
  const w = window.open(this.href, "_blank"); // not "noopener": that always returns null, and null is how we notice a blocked popup
  if (w) w.opener = null;
  else goTo(this.href);
}

function attachCardListeners() {
  // Links in posts: open in a new tab; the sandboxed page may not be allowed to, so fall back to the shell
  document.querySelectorAll<HTMLAnchorElement>(".post-link").forEach((a) => a.addEventListener("click", openPostLink));
  // Hashtag click filter
  document.querySelectorAll(".clickable-hashtag").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const tag = (e.currentTarget as HTMLElement).dataset.tag!;
      setTagFilter(tag);
    });
  });

  // Community link click
  document.querySelectorAll(".community-link").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const cId = (e.currentTarget as HTMLElement).dataset.community!;
      const found = allCommunities.find((c) => c.id === cId || c.slug === cId);
      if (found) selectCommunity(found);
    });
  });

  // Author Profile view trigger
  document.querySelectorAll(".author-clickable").forEach((el) => {
    el.addEventListener("click", (e) => {
      const author = (e.currentTarget as HTMLElement).dataset.author!;
      openUserProfile(author);
    });
  });

  // Talk button trigger from cards
  document.querySelectorAll(".talk-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const author = (e.currentTarget as HTMLElement).dataset.author!;
      openChatWithPeer(author);
    });
  });

  // Hide user buttons from cards
  document.querySelectorAll(".hide-user-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const author = (e.currentTarget as HTMLElement).dataset.author!;
      if (!confirm(`Hide all posts from ${getAuthorDisplayName(author)} on this device?\n\nYou can unhide them from their profile.`)) return;
      setUserHidden(author, true);
      renderTimeline();
    });
  });

  // Moderator Delete post buttons
  document.querySelectorAll(".mod-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (!currentIdentity || !activeCommunity) return;
      const postId = (e.currentTarget as HTMLElement).dataset.postId!;
      const author = (e.currentTarget as HTMLElement).dataset.author!;
      if (!confirm(`Moderator Action: Remove this post from r/${activeCommunity.slug}?`)) return;

      const res = await freenet.modDeletePost(currentIdentity, activeCommunity.id, postId, author);
      alert(res.msg);
      if (res.success) {
        if (!activeCommunity.deleted_post_ids.includes(postId)) {
          activeCommunity.deleted_post_ids.push(postId);
        }
        renderTimeline();
      }
    });
  });

  // Author Delete post buttons
  document.querySelectorAll(".delete-post-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const postId = (e.currentTarget as HTMLElement).dataset.postId!;
      if (!confirm("Are you sure you want to delete this post from Freenet?")) return;
      if (!currentIdentity) return;

      await freenet.deletePost(currentIdentity, postId);
      timelinePosts = timelinePosts.filter((p) => p.id !== postId);
      renderTimeline();
    });
  });

  // Like buttons
  document.querySelectorAll(".like-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const target = e.currentTarget as HTMLElement;
      const postId = target.dataset.postId!;
      const author = target.dataset.author!;
      if (!currentIdentity) return;

      const liked = await freenet.toggleLike(currentIdentity, author, postId);
      const post = timelinePosts.find((p) => p.id === postId);
      if (post) {
        post.likes = { ...post.likes, [currentIdentity.pubkey]: { liked, ts: Date.now(), sig: "" } }; // display copy only
      }
      renderTimeline();
      updateNotificationsBadge();
    });
  });

  // Comment forms
  document.querySelectorAll(".comment-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const target = e.currentTarget as HTMLFormElement;
      const postId = target.dataset.postId!;
      const author = target.dataset.author!;
      const input = target.querySelector(".comment-input") as HTMLInputElement;
      const text = input.value.trim();
      if (!text || !currentIdentity) return;

      const now = Date.now();
      if (now - lastCommentTime < COMMENT_COOLDOWN_MS) {
        const waitSec = Math.ceil((COMMENT_COOLDOWN_MS - (now - lastCommentTime)) / 1000);
        alert(`⏳ Anti-Flood: Please wait ${waitSec}s before posting another comment.`);
        return;
      }

      input.value = "";
      lastCommentTime = now;
      const censorship = censorTextAndPII(text);
      if (censorship.hasCensoredPII || censorship.hasCensoredProfanity) {
        alert(
          `ℹ️ Automatic Censorship Notice:\n\nSensitive information or inappropriate words were detected and automatically masked in your comment:\n• ${censorship.details.join("\n• ")}\n\nYour comment will be published with the redacted content.`
        );
      }
      const comment = await freenet.addComment(currentIdentity, author, postId, censorship.censoredText);
      const post = timelinePosts.find((p) => p.id === postId);
      if (post) {
        post.comments[comment.id] = comment;
      }
      renderTimeline();
      updateNotificationsBadge();
    });
  });

  // NSFW Reveal Toggle
  document.querySelectorAll(".btn-reveal-nsfw, .nsfw-overlay").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetId = (e.currentTarget as HTMLElement).dataset.mediaId!;
      const mediaEl = document.getElementById(targetId);
      if (mediaEl) {
        mediaEl.classList.toggle("revealed");
      }
    });
  });
}

// Anti-Flood & Rate Limiting Controls
let lastPostTime = 0;
let recentPostTimestamps: number[] = [];
let recentPostContents: string[] = [];
const POST_COOLDOWN_MS = 15000; // 15s cooldown between consecutive posts
const MAX_POSTS_PER_MINUTE = 3; // Maximum 3 posts in 60s sliding window

let lastCommentTime = 0;
const COMMENT_COOLDOWN_MS = 4000; // 4s cooldown between comments

let lastChatMessageTime = 0;
const CHAT_COOLDOWN_MS = 2000; // 2s cooldown between chat messages

let cooldownTimer: any = null;

function isPostInCooldown(): boolean {
  return cooldownTimer !== null || (Date.now() - lastPostTime < POST_COOLDOWN_MS && lastPostTime > 0);
}

function startPostCooldown(durationSeconds: number = 15) {
  let remaining = durationSeconds;
  publishBtn.disabled = true;
  publishBtn.style.opacity = "0.7";
  publishBtn.style.cursor = "not-allowed";
  publishBtn.style.backgroundColor = "";
  publishBtn.style.borderColor = "";
  publishBtn.title = "Anti-flood cooldown active. Please wait.";
  publishBtn.textContent = `⏳ Cooldown (${remaining}s)`;

  if (cooldownTimer) clearInterval(cooldownTimer);

  cooldownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      publishBtn.textContent = `⏳ Cooldown (${remaining}s)`;
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
  publishBtn.textContent = "Publish to Freenet";
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
    moderationStatus.style.background = "#eff6ff";
    moderationStatus.style.border = "1px solid #bfdbfe";
    moderationBadgeText.innerHTML = `<span style="color: #1d4ed8; font-weight: 600;">Scanning on-device with Desert Ant Moderator...</span>`;
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

    const modRes = await analyzeImageFile(file);
    currentMediaNsfwScore = modRes.score;

    if (modRes.unverified) {
      blockPublishBtnForUnverified();
    } else if (modRes.isNSFW) {
      blockPublishBtnForNsfw(modRes.label, modRes.score);
    } else {
      setMediaVerifiedSafe(modRes.score);
    }
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
      const modRes = await analyzeImageFile(img);
      currentMediaNsfwScore = modRes.score;
      if (modRes.unverified) {
        blockPublishBtnForUnverified();
      } else if (modRes.isNSFW) {
        blockPublishBtnForNsfw(modRes.label, modRes.score);
      } else {
        setMediaVerifiedSafe(modRes.score);
      }
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

// Publish Post
publishBtn.addEventListener("click", async () => {
  if (!currentIdentity) return;

  // 1. Strict zero-tolerance guard: do not allow publishing NSFW content
  if (currentMediaNsfw || currentMediaNsfwScore >= 0.5) {
    alert("Publishing Prohibited: Desert Ant Moderator detected that this image contains explicit or adult media. Publishing this content is not permitted.");
    return;
  }

  // 2. Anti-flood cooldown check (15 seconds between posts)
  const now = Date.now();
  const timeSinceLast = now - lastPostTime;
  if (lastPostTime > 0 && timeSinceLast < POST_COOLDOWN_MS) {
    const waitSec = Math.ceil((POST_COOLDOWN_MS - timeSinceLast) / 1000);
    alert(`Anti-Flood Cooldown: Please wait ${waitSec} second${waitSec > 1 ? "s" : ""} before publishing another post.`);
    return;
  }

  // 3. Sliding window rate limit check (max 3 posts per 60 seconds)
  recentPostTimestamps = recentPostTimestamps.filter((t) => now - t < 60000);
  if (recentPostTimestamps.length >= MAX_POSTS_PER_MINUTE) {
    alert("Rate Limit Exceeded: You can publish a maximum of 3 posts per minute to protect the network from flooding. Please wait a moment.");
    return;
  }

  const caption = postCaption.value.trim();
  if (!caption) {
    alert("Please write something before publishing.");
    return;
  }

  // 4. Duplicate content check (prevent spamming identical text)
  const normalizedCaption = caption.toLowerCase().replace(/\s+/g, " ");
  if (recentPostContents.includes(normalizedCaption)) {
    alert("Duplicate Post Detected: You recently published this exact message. Duplicate posting is prohibited to prevent timeline spam.");
    return;
  }

  // 5. Auto-censor sensitive data (PII) and bad words / profanity
  const censorship = censorTextAndPII(caption);
  const finalCaption = censorship.censoredText;

  if (censorship.hasCensoredPII || censorship.hasCensoredProfanity) {
    const issues = censorship.details.map((d) => `• ${d}`).join("\n");
    alert(
      `ℹ️ Automatic Censorship Notice:\n\nSensitive information or inappropriate language was detected in your post and automatically censored before publishing:\n${issues}\n\nThe post will be published with the content appropriately masked to protect user privacy and safety.`
    );
    postCaption.value = finalCaption;
  }

  publishBtn.disabled = true;
  publishBtn.textContent = "Publishing to Freenet...";

  try {
    const mediaUri = activeComposerType === "moment" ? postMediaUrl.value.trim() : undefined;
    const location = activeComposerType === "event" ? postLocation.value.trim() : undefined;
    const eventDate = activeComposerType === "event" ? postEventDate.value : undefined;
    const commId = composerCommunitySelect.value || (activeCommunity ? activeCommunity.id : undefined);

    const post = await freenet.publishPost(
      currentIdentity,
      activeComposerType,
      finalCaption,
      mediaUri || undefined,
      location || undefined,
      eventDate || undefined,
      commId || undefined,
      false,
      currentMediaNsfwScore
    );

    // Record anti-flood timestamps & content
    lastPostTime = Date.now();
    recentPostTimestamps.push(lastPostTime);
    recentPostContents.push(normalizedCaption);
    if (recentPostContents.length > 5) recentPostContents.shift();

    timelinePosts.unshift(post);
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

    // Start 15-second anti-flood cooldown timer on button
    startPostCooldown(15);
  } catch (err) {
    console.error("Error publishing post:", err);
    alert("Could not publish post to Freenet.");
    if (!currentMediaNsfw) {
      resetPublishBtnState();
    }
  }
});

// Profile Modal Interactions
editProfileBtn.addEventListener("click", () => {
  modalNameInput.value = currentProfile?.display_name || "";
  modalBioInput.value = currentProfile?.bio || "";
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

  modalSaveBtn.disabled = true;
  modalSaveBtn.textContent = "Signing & Saving...";

  try {
    const updated = await freenet.updateProfile(currentIdentity, name, bio, avatar);
    currentProfile = updated;
    sidebarName.textContent = updated.display_name;
    sidebarBio.textContent = updated.bio || "No bio yet.";
    sidebarAvatar.src = updated.avatar_url || generateDefaultAvatar(currentIdentity.pubkey);
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

async function openUserProfile(pubkey: string) {
  const isSelf = pubkey === currentIdentity?.pubkey;
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
  // fetch from the network first: the local copy of someone else's feed is empty until then
  if (!isSelf) await Promise.race([freenet.refresh(pubkey, true), new Promise((r) => setTimeout(r, 4000))]);
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

  // Render author's posts in gallery
  const authorPosts = Object.values(feed.posts).sort((a, b) => b.timestamp - a.timestamp);
  if (authorPosts.length === 0) {
    uviewPostsGallery.innerHTML = `<div style="grid-column: 1 / -1; font-size: 0.85rem; color: var(--text-muted);">No posts yet.</div>`;
  } else {
    uviewPostsGallery.innerHTML = authorPosts
      .map((p) =>
        p.media_uri
          ? `<div class="uview-post-thumb"><img src="${safeUrl(p.media_uri)}" alt="Post" /></div>`
          : `<div class="uview-post-thumb"><p>${escapeHtml(p.caption.substring(0, 45))}...</p></div>`
      )
      .join("");
  }

  userProfileModal.style.display = "flex";
}

uviewCloseBtn.addEventListener("click", () => {
  userProfileModal.style.display = "none";
});

// ---- P2P Chat & Community Chatrooms ----

function openCommunityChat(comm: Community) {
  activeChatCommunity = comm;
  activeChatPeer = null;
  renderChatSidebar();
  selectCommunityRoom(comm);
  chatModal.style.display = "flex";
}

function openChatWithPeer(peerPubkey?: string) {
  activeChatCommunity = null;
  if (peerPubkey) {
    activeChatPeer = peerPubkey;
  }
  renderChatSidebar();
  if (activeChatPeer) {
    selectChatPeer(activeChatPeer);
  } else if (allCommunities.length > 0) {
    selectCommunityRoom(allCommunities[0]);
  }
  chatModal.style.display = "flex";
}

openChatBtn.addEventListener("click", () => {
  if (activeCommunity) {
    openCommunityChat(activeCommunity);
  } else {
    const discovered = currentIdentity ? freenet.getDiscoveredPeers(currentIdentity.pubkey).map((p) => p.pubkey) : [];
    const validDiscovered = discovered.filter((pk) => pk !== currentIdentity?.pubkey);
    const validFollowed = followingKeys.filter((pk) => pk !== currentIdentity?.pubkey);
    openChatWithPeer(activeChatPeer || validFollowed[0] || validDiscovered[0] || undefined);
  }
});

chatCloseBtn.addEventListener("click", () => {
  chatModal.style.display = "none";
});

if (chatFullscreenToggleBtn && chatModalCard) {
  chatFullscreenToggleBtn.addEventListener("click", () => {
    chatModalCard.classList.toggle("windowed");
    const isWindowed = chatModalCard.classList.contains("windowed");
    chatFullscreenToggleBtn.innerHTML = `<span id="chat-fullscreen-icon">${isWindowed ? renderIcon("maximize2", { className: "icon-sm" }) : renderIcon("minimize2", { className: "icon-sm" })}</span>`;
    chatFullscreenToggleBtn.title = isWindowed ? "Expand to Fullscreen" : "Restore to Windowed";
  });
}

if (chatParticipantsToggleBtn && chatBody) {
  chatParticipantsToggleBtn.addEventListener("click", () => {
    chatBody.classList.toggle("hide-participants");
  });
}

if (commChatBtn) {
  commChatBtn.addEventListener("click", () => {
    if (activeCommunity) {
      openCommunityChat(activeCommunity);
    }
  });
}

chatClearBtn.addEventListener("click", async () => {
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
});

function attachBubbleDeleteListeners() {
  document.querySelectorAll(".chat-bubble-del").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const roomId = (btn as HTMLElement).dataset.roomId!;
      const msgId = (btn as HTMLElement).dataset.msgId!;
      if (confirm("Delete this message?")) {
        await freenet.deleteChatMessage(roomId, msgId);
        if (activeChatPrivateRoom) {
          await selectPrivateRoom(activeChatPrivateRoom);
        } else if (activeChatCommunity) {
          await selectCommunityRoom(activeChatCommunity);
        } else if (activeChatPeer) {
          await selectChatPeer(activeChatPeer);
        }
      }
    });
  });
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
  }

  // 0. Render Private Rooms
  if (chatPrivateRoomsList) {
    allPrivateRooms = await freenet.getPrivateRooms(currentIdentity);
    if (allPrivateRooms.length === 0) {
      chatPrivateRoomsList.innerHTML = `<div style="font-size: 0.72rem; color: var(--text-muted); padding: 4px;">No private rooms yet.<br/>Click <strong>+ New</strong> to start an E2EE room.</div>`;
    } else {
      const roomItems = await Promise.all(
        allPrivateRooms.map(async (r) => {
          const isActive = activeChatPrivateRoom?.id === r.id;
          const name = await freenet.getPrivateRoomDecryptedName(currentIdentity!, r);
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
      chatPrivateRoomsList.innerHTML = roomItems.join("");

      chatPrivateRoomsList.querySelectorAll(".chat-privroom-item").forEach((el) => {
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
    if (allCommunities.length === 0) {
      chatCommunitiesList.innerHTML = `<div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px;">No communities yet.</div>`;
    } else {
      chatCommunitiesList.innerHTML = allCommunities
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
        .join("");

      chatCommunitiesList.querySelectorAll(".chat-comm-item").forEach((el) => {
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
    chatPeersList.innerHTML = `<div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px;">No direct messages yet.</div>`;
    return;
  }

  chatPeersList.innerHTML = knownPeers
    .map((pk) => {
      const displayName = getAuthorDisplayName(pk);
      const isActive = activeChatPeer === pk && !activeChatCommunity && !activeChatPrivateRoom;
      return `
    <div class="chat-peer-item ${isActive ? "active" : ""}" data-peer="${escapeHtml(pk)}">
      <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; flex: 1;">
        <img src="${safeUrl(getAuthorAvatarUrl(pk))}" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" onerror="this.onerror=null; this.src='${generateDefaultAvatar(pk)}'" />
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(displayName)}</span>
      </div>
      ${unreadBadge(freenet.getRoomId(currentIdentity!.pubkey, pk), read)}
      <button class="remove-peer-btn" data-peer="${escapeHtml(pk)}" title="Remove conversation from list">${renderIcon("x", { className: "icon-xs" })}</button>
    </div>
  `;
    })
    .join("");

  chatPeersList.querySelectorAll(".chat-peer-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).classList.contains("remove-peer-btn")) return;
      const peer = (item as HTMLElement).dataset.peer!;
      selectChatPeer(peer);
    });
  });

  chatPeersList.querySelectorAll(".remove-peer-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const peer = (btn as HTMLElement).dataset.peer!;
      if (confirm(`Remove @${shortenKey(peer)} from recent chats list?`)) {
        freenet.removeChatPeer(currentIdentity!.pubkey, peer);
        if (activeChatPeer === peer) {
          activeChatPeer = null;
          chatPeerInfo.textContent = "Select conversation";
          chatClearBtn.style.display = "none";
          chatMessagesList.innerHTML = `<div class="empty-state" style="padding: 20px;">Conversation removed. Select another room or peer.</div>`;
        }
        renderChatSidebar();
      }
    });
  });
}

function renderChatParticipants() {
  if (!chatParticipantsList || !chatParticipantsTitle || !chatParticipantsCount || !currentIdentity) return;

  if (activeChatPrivateRoom) {
    const room = activeChatPrivateRoom;
    chatParticipantsTitle.innerHTML = `<span class="btn-icon-text">${renderIcon("lock", { className: "icon-sm" })} <span>Room Members</span></span>`;
    chatParticipantsCount.textContent = room.members.length.toString();
    if (chatParticipantsHeaderCount) {
      chatParticipantsHeaderCount.textContent = room.members.length.toString();
    }

    const isRoomCreator = currentIdentity.pubkey === room.creator;
    const roomMods = room.moderators ?? [];
    const iAmRoomMod = roomMods.includes(currentIdentity.pubkey);

    const items = room.members.map((memberPk) => {
      const isCreator = memberPk === room.creator;
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
              ${isRoomMod ? `<span class="chat-participant-tag mod btn-icon-text"><span>Moderator</span></span>` : ""}
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
        ${isRoomCreator ? "" : `<button type="button" class="btn-secondary btn-sm btn-icon-text" id="part-leave-btn" style="width: 100%; font-size: 0.75rem; justify-content: center; color: var(--danger);">${renderIcon("userX", { className: "icon-xs" })}<span>Leave Room</span></button>`}
      </div>
    `;

    chatParticipantsList.innerHTML = items.join("") + bottomActions;

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

    chatParticipantsList.querySelector("#part-leave-btn")?.addEventListener("click", async () => {
      if (!currentIdentity || !activeChatPrivateRoom) return;
      const roomName = await freenet.getPrivateRoomDecryptedName(currentIdentity, activeChatPrivateRoom);
      if (!confirm(`Leave "${roomName}"?\n\nIt disappears from your list. You can join again with an invite link. Messages you already read stay readable on this device.`)) return;
      try {
        await freenet.leavePrivateRoom(currentIdentity, activeChatPrivateRoom.id);
      } catch (err: any) {
        alert(`Could not leave the room: ${err.message || err}`);
        return;
      }
      activeChatPrivateRoom = null;
      chatPeerInfo.textContent = "Select conversation";
      chatClearBtn.style.display = "none";
      if (chatInviteBtn) chatInviteBtn.style.display = "none";
      chatMessagesList.innerHTML = `<div class="empty-state" style="padding: 20px;">You left the room. Select another room or peer.</div>`;
      chatParticipantsList.innerHTML = "";
      renderChatSidebar();
    });

    const partCopyLinkBtn = chatParticipantsList.querySelector("#part-copy-link-btn");
    if (partCopyLinkBtn) {
      partCopyLinkBtn.addEventListener("click", async () => {
        const roomKey = await freenet.getPrivateRoomKey(currentIdentity!, room);
        const roomName = await freenet.getPrivateRoomDecryptedName(currentIdentity!, room);
        if (roomKey) {
          const link = freenet.getPrivateRoomInviteLink(room, roomKey, roomName);
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

    chatParticipantsList.innerHTML = items.join("");

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

    chatParticipantsList.innerHTML = items.join("");

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
    chatParticipantsList.innerHTML = `<div style="font-size: 0.75rem; color: var(--text-muted); padding: 8px;">Select a conversation to view members.</div>`;
  }
}

async function selectPrivateRoom(room: PrivateRoom) {
  if (!currentIdentity) return;
  activeChatPrivateRoom = room;
  activeChatCommunity = null;
  activeChatPeer = null;

  const decryptedName = await freenet.getPrivateRoomDecryptedName(currentIdentity, room);
  chatPeerInfo.innerHTML = `<strong>${escapeHtml(decryptedName)}</strong> (${room.members.length} members) <span class="chat-security-badge e2ee btn-icon-text" title="On-device AES-256-GCM + X25519 ECIES">${renderIcon("lock", { className: "icon-xs" })} <span>E2EE Group</span></span>`;
  
  if (chatInviteBtn) {
    chatInviteBtn.style.display = "inline-block";
  }
  chatClearBtn.style.display = "inline-block";
  chatClearBtn.title = "Delete entire room conversation history";

  renderChatSidebar();
  renderChatParticipants();

  const messages = await freenet.getPrivateRoomChatMessages(currentIdentity, room);
  const roomId = room.id;

  if (messages.length === 0) {
    chatMessagesList.innerHTML = `<div class="empty-state" style="padding: 20px;">Welcome to <strong>${escapeHtml(decryptedName)}</strong>!<br/>This room is end-to-end encrypted with an on-device symmetric AES key. Only authorized members can decrypt messages.</div>`;
  } else {
    chatMessagesList.innerHTML = messages
      .map((msg, i) =>
        renderChatMessage({
          msg,
          prev: messages[i - 1],
          roomId,
          isMine: msg.sender === currentIdentity!.pubkey,
          senderName: getAuthorDisplayName(msg.sender),
          badge: msg.sender === room.creator ? `<span class="rv-badge">${renderIcon("crown", { className: "icon-xs" })}</span>` : "",
          canDelete: true,
        })
      )
      .join("");
  }

  attachBubbleDeleteListeners();
  chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
}

function setChatStatus(online: boolean) {
  document.getElementById("chat-status-pill")?.classList.toggle("online", online);
  const t = document.getElementById("chat-status-text");
  if (t) t.textContent = online ? "Connected" : "Offline";
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

/** One chat message: author and time above a rounded bubble; the author is left out when the previous message is theirs and close in time. */
function renderChatMessage(opts: { msg: ChatMessage; prev?: ChatMessage; roomId: string; isMine: boolean; badge?: string; canDelete: boolean; senderName: string }): string {
  const { msg, prev, roomId, isMine, badge, canDelete, senderName } = opts;
  const grouped = !!prev && prev.sender === msg.sender && msg.timestamp - prev.timestamp < 5 * 60 * 1000;
  const head = grouped
    ? ""
    : `<div class="rv-msg-head"><span class="rv-author">${escapeHtml(isMine ? "You" : senderName)}</span>${badge ?? ""}<span class="rv-time">${chatTime(msg.timestamp)}</span></div>`;
  const del = canDelete
    ? `<button class="chat-bubble-del" data-room-id="${escapeHtml(roomId)}" data-msg-id="${escapeHtml(msg.id)}" title="Delete message">${renderIcon("trash2", { className: "icon-xs" })}</button>`
    : "";
  return `<div class="chat-bubble ${isMine ? "mine" : "theirs"}${grouped ? " grouped" : ""}" data-msg-id="${escapeHtml(msg.id)}">${head}<div class="rv-bubble">${del}${linkify(msg.text)}</div></div>`;
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
    chatMessagesList.innerHTML = `<div class="empty-state" style="padding: 20px;">Welcome to #r/${escapeHtml(comm.slug)} community chat! Say hello to fellow members.</div>`;
  } else {
    chatMessagesList.innerHTML = messages
      .map((msg, i) => {
        const isMine = msg.sender === currentIdentity!.pubkey;
        const msgIsMod = comm.creator === msg.sender || comm.moderators.includes(msg.sender);
        return renderChatMessage({
          msg,
          prev: messages[i - 1],
          roomId,
          isMine,
          senderName: getAuthorDisplayName(msg.sender),
          badge: msgIsMod ? `<span class="rv-badge">${renderIcon("shield", { className: "icon-xs" })}</span>` : "",
          canDelete: isMine || isMod,
        });
      })
      .join("");
  }

  attachBubbleDeleteListeners();
  chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
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
    chatMessagesList.innerHTML = `<div class="empty-state" style="padding: 20px;">No messages yet. Direct messages are End-to-End Encrypted (E2EE).</div>`;
  } else {
    chatMessagesList.innerHTML = messages
      .map((msg, i) =>
        renderChatMessage({
          msg,
          prev: messages[i - 1],
          roomId,
          isMine: msg.sender === currentIdentity!.pubkey,
          senderName: getAuthorDisplayName(msg.sender),
          canDelete: true,
        })
      )
      .join("");
  }

  attachBubbleDeleteListeners();
  chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
}


chatSendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentIdentity) return;
  const text = chatMessageInput.value.trim();
  if (!text) return;

  const now = Date.now();
  if (now - lastChatMessageTime < CHAT_COOLDOWN_MS) {
    const waitSec = Math.ceil((CHAT_COOLDOWN_MS - (now - lastChatMessageTime)) / 1000);
    alert(`Slow down: Please wait ${waitSec}s before sending another chat message.`);
    return;
  }
  lastChatMessageTime = now;

  chatMessageInput.value = "";
  const censorship = censorTextAndPII(text);
  if (censorship.hasCensoredPII || censorship.hasCensoredProfanity) {
    alert(
      `Automatic Censorship Notice:\n\nSensitive information or inappropriate words were detected and masked in your message:\n• ${censorship.details.join("\n• ")}\n\nThe message has been sent with the content redacted.`
    );
  }
  const finalText = censorship.censoredText;

  if (activeChatPrivateRoom) {
    await freenet.sendPrivateRoomChatMessage(currentIdentity, activeChatPrivateRoom, finalText);
    await selectPrivateRoom(activeChatPrivateRoom);
  } else if (activeChatCommunity) {
    await freenet.sendCommunityChatMessage(currentIdentity, activeChatCommunity.id, finalText);
    await selectCommunityRoom(activeChatCommunity);
  } else if (activeChatPeer) {
    await freenet.sendChatMessage(currentIdentity, activeChatPeer, finalText);
    await selectChatPeer(activeChatPeer);
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
    const roomKey = await freenet.getPrivateRoomKey(currentIdentity, activeChatPrivateRoom);
    const roomName = await freenet.getPrivateRoomDecryptedName(currentIdentity, activeChatPrivateRoom);
    if (roomKey && invitePrivroomLinkInput) {
      invitePrivroomLinkInput.value = freenet.getPrivateRoomInviteLink(activeChatPrivateRoom, roomKey, roomName);
    }

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
      let fragment = raw;
      if (raw.includes("#")) {
        fragment = raw.split("#")[1];
      } else if (raw.includes("?")) {
        fragment = raw.split("?")[1];
      }

      const params = new URLSearchParams(fragment);
      const roomId = params.get("join_room");
      const keyHex = params.get("key");
      const name = params.get("name") || "Private Room";
      const creator = params.get("creator") || "";

      if (!roomId || !keyHex || keyHex.length !== 64) {
        alert("Invalid invite link format. Missing join_room or valid 64-hex encryption key.");
        return;
      }

      const room = await freenet.joinPrivateRoomFromInvite(currentIdentity, {
        roomId,
        name,
        keyHex,
        creator,
      });

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

openNotifsBtn.addEventListener("click", async () => {
  if (!currentIdentity) return;
  const notifs = await freenet.getNotifications(currentIdentity);

  if (notifs.length === 0) {
    notifsList.innerHTML = `<div class="empty-state">No notifications yet.</div>`;
  } else {
    notifsList.innerHTML = notifs
      .map(
        (n) => `
      <div class="notif-item ${n.read ? "" : "unread"}">
        <div>
          <span style="font-weight: 700; font-family: monospace;">@${shortenKey(n.from)}</span>
          <span>${escapeHtml(n.text)}</span>
        </div>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${formatTimeAgo(n.timestamp)}</span>
      </div>
    `
      )
      .join("");
  }

  notifsModal.style.display = "flex";
});

notifsCloseBtn.addEventListener("click", () => {
  notifsModal.style.display = "none";
});

notifsMarkReadBtn.addEventListener("click", async () => {
  if (!currentIdentity) return;
  await freenet.markNotificationsAsRead(currentIdentity);
  updateNotificationsBadge();
  notifsModal.style.display = "none";
});

async function updateNotificationsBadge() {
  if (!currentIdentity) return;
  const notifs = await freenet.getNotifications(currentIdentity);
  const unreadCount = notifs.filter((n) => !n.read).length;

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
  activeCommunity = comm;
  if (activeCommunity) {
    communityHeaderBanner.style.display = "block";
    commBannerSlug.textContent = `r/${activeCommunity.slug}`;
    commBannerDesc.textContent = activeCommunity.description || "No description provided.";
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

function renderCommunities() {
  if (!communitiesList) return;

  communitiesList.innerHTML = allCommunities
    .map(
      (c) => `
    <div class="comm-item ${activeCommunity?.id === c.id ? "active" : ""}" data-id="${escapeHtml(c.id)}">
      <span class="comm-item-title">r/${escapeHtml(c.slug)}</span>
      <span class="comm-item-badge">${c.members.length}</span>
    </div>
  `
    )
    .join("");

  communitiesList.querySelectorAll(".comm-item").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).dataset.id!;
      const comm = allCommunities.find((c) => c.id === id) || null;
      selectCommunity(comm);
    });
  });

  composerCommunitySelect.innerHTML = `
    <option value="">Global Timeline</option>
    ${allCommunities
      .map(
        (c) => `
      <option value="${escapeHtml(c.id)}" ${activeCommunity?.id === c.id ? "selected" : ""}>
        r/${escapeHtml(c.slug)} - ${escapeHtml(c.name)}
      </option>
    `
      )
      .join("")}
  `;
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

// Create Community Modal triggers
openCreateCommBtn.addEventListener("click", () => {
  commNameInput.value = "";
  commSlugInput.value = "";
  commDescInput.value = "";
  createCommModal.style.display = "flex";
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

  createCommSaveBtn.disabled = true;
  createCommSaveBtn.textContent = "Creating...";

  try {
    const newComm = await freenet.createCommunity(currentIdentity, name, slug, desc);
    allCommunities = await freenet.getCommunities();
    createCommModal.style.display = "none";
    renderCommunities();
    selectCommunity(newComm);
  } catch (err) {
    console.error("Error creating community:", err);
    alert("Could not create community on Freenet.");
  } finally {
    createCommSaveBtn.disabled = false;
    createCommSaveBtn.textContent = "Create Community";
  }
});

// Scope Switcher buttons
function updateScopeBtnActive(activeBtn: HTMLButtonElement) {
  scopeExploreBtn.classList.remove("active");
  scopeFollowingBtn.classList.remove("active");
  scopeMyPostsBtn.classList.remove("active");
  activeBtn.classList.add("active");
}

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

// Clicking on User Badge in navbar or Profile elements in sidebar filters directly to My Posts
myPubkeyBadge.addEventListener("click", switchToMyPostsScope);
sidebarAvatar.addEventListener("click", switchToMyPostsScope);
sidebarName.addEventListener("click", switchToMyPostsScope);
if (sidebarHandle) sidebarHandle.addEventListener("click", switchToMyPostsScope);
if (sidebarStatMyPosts) sidebarStatMyPosts.addEventListener("click", switchToMyPostsScope);

// ---- Theme Management (Dark / Light Mode) ----

function initTheme() {
  const saved = safeStorage.getItem("radica_theme") || safeStorage.getItem("spruce_theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}

function applyTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", theme);
  safeStorage.setItem("radica_theme", theme);
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
  signOut();
  window.location.reload();
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
    window.location.reload();
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
    window.location.reload();
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

// Check URL fragment for private room invite link
async function checkUrlInviteHash() {
  if (!currentIdentity) return;
  const hash = window.location.hash ? window.location.hash.substring(1) : "";
  if (!hash || !hash.includes("join_room=")) return;

  const params = new URLSearchParams(hash);
  const roomId = params.get("join_room");
  const keyHex = params.get("key");
  const name = params.get("name") || "Private Room";
  const creator = params.get("creator") || "";

  if (roomId && keyHex && keyHex.length === 64) {
    try {
      const room = await freenet.joinPrivateRoomFromInvite(currentIdentity, {
        roomId,
        name,
        keyHex,
        creator,
      });

      // Clear the invite fragment parameters from the URL while preserving auth_state if present
      const currentHash = window.location.hash ? window.location.hash.substring(1) : "";
      const remainingParts = currentHash
        .split("&")
        .filter((p) => p && !p.startsWith("join_room=") && !p.startsWith("key=") && !p.startsWith("name=") && !p.startsWith("creator="));
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
      const persona = await finishSignIn(queryParams);
      try {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState(null, "", cleanUrl);
      } catch {}
      alert(`Successfully signed in with Viso persona: ${personaName(persona)}!`);
    } catch (err) {
      console.error("Viso sign-in verification error:", err);
      alert("Viso sign-in failed: " + ((err as Error).message || err));
      try {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState(null, "", cleanUrl);
      } catch {}
    }
  }

  const identity = await getIdentity();
  if (!identity) {
    // first visit: let the visitor choose (Viso, new key, imported key) instead of making an identity for them
    openIdentityModal();
    return;
  }
  currentIdentity = identity;
  freenet.setIdentity(currentIdentity);

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
    sidebarHandle.title = `Persona: ${personaBase58}\nClick to view My Posts`;
  }
  sidebarAvatar.src = currentProfile?.avatar_url || generateDefaultAvatar(currentIdentity.pubkey);
  sidebarAvatar.onerror = () => {
    sidebarAvatar.src = generateDefaultAvatar(currentIdentity?.pubkey || "radica");
  };

  await updateMyPostsAndScopeCounts();
  renderIdentityModal();
  renderFollowingList();
  renderDiscoveredPeers();
  updateNotificationsBadge();

  // Announce persona to peer network and subscribe to real-time events
  freenet.announceIdentity(currentIdentity, currentProfile);
  freenet.onSyncUpdate(async () => {
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
    renderFollowingList(); // names and avatars of the people I follow arrive with their feeds
    allCommunities = await freenet.getCommunities();
    if (activeCommunity) {
      const refreshed = allCommunities.find((c) => c.id === activeCommunity!.id);
      if (refreshed) {
        activeCommunity = refreshed;
        selectCommunity(activeCommunity);
      }
    }
    renderCommunities();
    renderDiscoveredPeers();
    await updateNotificationsBadge();

    // Live update open chat dialog
    if (chatModal.style.display !== "none") {
      renderChatSidebar();
      if (activeChatPrivateRoom) {
        await selectPrivateRoom(activeChatPrivateRoom);
      } else if (activeChatCommunity) {
        await selectCommunityRoom(activeChatCommunity);
      } else if (activeChatPeer && currentIdentity) {
        await selectChatPeer(activeChatPeer);
      }
    }

    await reloadPosts();
  });

  // Load Communities
  allCommunities = await freenet.getCommunities();
  renderCommunities();

  // Connect to Freenet Node
  const connected = await freenet.connect();
  if (connected) {
    void freenet.syncOwnFeed(currentIdentity!); // in background: publish my feed, pick up what my other devices wrote
    freenetDot.classList.add("online");
    freenetStatusLabel.textContent = "Freenet Node Online";
    setChatStatus(true);
  } else {
    freenetDot.classList.remove("online");
    setChatStatus(false);
    freenetStatusLabel.textContent = "Local-First Storage";
    freenetStatusLabel.title = `Freenet node unreachable: ${freenet.connectError}`;
  }

  // Load Timeline (Explore by default so all posts on network are immediately visible)
  await reloadPosts();
}

init();

