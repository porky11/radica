import { getOrCreateIdentity, personaName } from "./crypto";
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
import type {
  Post,
  PostCategory,
  UserIdentity,
  ProfileInfo,
  ChatMessage,
  NotificationItem,
  Community,
} from "./types";

let currentIdentity: UserIdentity | null = null;
let currentProfile: ProfileInfo | null = null;
let currentCategory: "all" | PostCategory = "all";
let activeComposerType: PostCategory = "thought";
let timelinePosts: Post[] = [];
let followingKeys: string[] = [];
let activeChatPeer: string | null = null;
let activeChatCommunity: Community | null = null;
let allCommunities: Community[] = [];
let activeCommunity: Community | null = null;
let activeTagFilter: string | null = null;
let searchQuery: string = "";
let currentFeedScope: "explore" | "following" = "explore";
let currentMediaNsfw = false;
let currentMediaNsfwScore = 0;

// Theme Elements
const themeToggleBtn = document.getElementById("theme-toggle-btn") as HTMLButtonElement | null;
const themeIcon = document.getElementById("theme-icon") as HTMLElement | null;

// Identity & Key Management Elements
const openIdentityBtn = document.getElementById("open-identity-btn") as HTMLButtonElement | null;
const manageIdentityBtn = document.getElementById("manage-identity-btn") as HTMLButtonElement | null;
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
const sidebarKey = document.getElementById("sidebar-key") as HTMLElement;
const sidebarAvatar = document.getElementById("sidebar-avatar") as HTMLImageElement;
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
const uviewPostsGallery = document.getElementById("uview-posts-gallery") as HTMLElement;
const uviewCloseBtn = document.getElementById("uview-close-btn") as HTMLButtonElement;

// Chat Modal Elements
const chatModal = document.getElementById("chat-modal") as HTMLElement;
const chatPeerInfo = document.getElementById("chat-peer-info") as HTMLElement;
const chatCommunitiesList = document.getElementById("chat-communities-list") as HTMLElement;
const chatPeersList = document.getElementById("chat-peers-list") as HTMLElement;
const chatMessagesList = document.getElementById("chat-messages-list") as HTMLElement;
const chatSendForm = document.getElementById("chat-send-form") as HTMLFormElement;
const chatMessageInput = document.getElementById("chat-message-input") as HTMLInputElement;
const chatCloseBtn = document.getElementById("chat-close-btn") as HTMLButtonElement;
const chatClearBtn = document.getElementById("chat-clear-btn") as HTMLButtonElement;

// Notifications Modal Elements
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
      <div class="following-info author-clickable" data-author="${pk}" style="cursor: pointer;" title="View Profile">
        <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${pk}" class="following-img" />
        <span class="following-name">@${shortenKey(pk)}</span>
      </div>
      <div style="display: flex; gap: 4px; align-items: center;">
        <button class="action-btn talk-btn" data-author="${pk}" title="Direct Message" style="font-size: 0.75rem; padding: 2px;">💬</button>
        <button class="unfollow-btn" data-pubkey="${pk}" title="Unfollow">✕</button>
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
  const peers = freenet.getDiscoveredPeers(currentIdentity.pubkey);
  if (peers.length === 0) {
    discoveredPeersList.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted);">No other peers detected yet. Open another tab to connect!</div>`;
    return;
  }

  discoveredPeersList.innerHTML = peers
    .map((p) => {
      const isFollowing = followingKeys.includes(p.pubkey);
      return `
      <div class="discovered-item">
        <div class="discovered-info author-clickable" data-author="${p.pubkey}" style="cursor: pointer;" title="View Profile">
          <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${p.pubkey}" style="width: 24px; height: 24px; border-radius: 50%;" />
          <span style="font-weight: 600;">@${shortenKey(p.pubkey)}</span>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button class="talk-btn action-btn" data-author="${p.pubkey}" title="Send Message" style="font-size: 0.75rem; padding: 2px 4px;">💬</button>
          <button class="action-btn toggle-follow-peer-btn ${isFollowing ? "btn-secondary" : "btn-primary"}" data-pubkey="${p.pubkey}" style="font-size: 0.75rem; padding: 2px 8px;">
            ${isFollowing ? "✓ Following" : "➕ Follow"}
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

async function reloadPosts() {
  if (!currentIdentity) return;
  if (currentFeedScope === "explore") {
    timelinePosts = await freenet.getExploreTimeline(currentIdentity);
  } else {
    timelinePosts = await freenet.getTimeline(currentIdentity);
  }
  renderTimeline();
}

function renderCaption(caption: string): string {
  const escaped = escapeHtml(caption);
  return escaped.replace(
    /#([a-zA-Z0-9_\u00C0-\u017F]+)/g,
    '<span class="hashtag clickable-hashtag" data-tag="$1" title="Filter by #$1">#$1</span>'
  );
}

function renderTimeline() {
  if (!currentIdentity) return;

  // Filter pipeline
  let filtered = timelinePosts;

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
    postsContainer.innerHTML = `
      <div class="empty-state">
        <p>No posts match the current filter. Be the first to publish on Freenet!</p>
      </div>
    `;
    return;
  }

  postsContainer.innerHTML = filtered
    .map((post) => {
      const isLiked = post.likes.includes(currentIdentity!.pubkey);
      const isMyPost = post.author === currentIdentity!.pubkey;
      const isModOrOwner =
        activeCommunity &&
        (activeCommunity.creator === currentIdentity!.pubkey ||
          activeCommunity.moderators.includes(currentIdentity!.pubkey));
      const commentsArray = Object.values(post.comments);

      return `
      <article class="gram-card" id="card-${post.id}">
        <div class="gram-card-header">
          <div class="gram-author-info">
            <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${post.author}" class="gram-author-img author-clickable" data-author="${post.author}" style="cursor: pointer;" />
            <div>
              <span class="gram-author-name author-clickable" data-author="${post.author}" style="cursor: pointer;" title="View Profile">@${shortenKey(post.author)}</span>
              <span class="gram-category-tag ${post.category}">${post.category}</span>
              ${
                post.is_nsfw
                  ? `<span class="gram-category-tag nsfw" title="18+ Adult Content (Moderated On-Device)">🔞 NSFW</span>`
                  : ""
              }
              ${
                post.community_id
                  ? `<span class="comm-badge community-link" data-community="${post.community_id}" title="View Community">r/${post.community_id.replace(/^c_/, "")}</span>`
                  : ""
              }
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="gram-time">${formatTimeAgo(post.timestamp)}</span>
            ${
              isModOrOwner && !isMyPost
                ? `<button class="mod-delete-btn" data-post-id="${post.id}" data-author="${post.author}" title="Moderator: Delete post from community">🛡️ Mod Delete</button>`
                : ""
            }
            ${
              isMyPost
                ? `<button class="delete-post-btn" data-post-id="${post.id}" title="Delete this post">🗑️</button>`
                : ""
            }
          </div>
        </div>

        ${
          post.media_uri
            ? `
          <div class="gram-media ${post.is_nsfw ? "nsfw-shielded" : ""}" id="media-${post.id}">
            <img src="${post.media_uri}" alt="Post media" onerror="this.style.display='none'" />
            ${
              post.is_nsfw
                ? `
              <div class="nsfw-overlay" data-media-id="media-${post.id}">
                <div class="nsfw-overlay-card">
                  <div style="font-size: 1.5rem; margin-bottom: 4px;">🔞</div>
                  <div style="font-weight: 700; font-size: 0.9rem;">Sensitive / Adult Media</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 10px;">Scanned on-device by Desert Ant</div>
                  <button type="button" class="btn-reveal-nsfw" data-media-id="media-${post.id}">👁️ Click to View</button>
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
              ${post.event_date ? `<div>📅 Date: ${post.event_date}</div>` : ""}
              ${post.location ? `<div>📍 Location: ${escapeHtml(post.location)}</div>` : ""}
            </div>
          `
              : ""
          }
        </div>

        <div class="gram-actions">
          <button class="action-btn like-btn ${isLiked ? "liked" : ""}" data-post-id="${post.id}" data-author="${post.author}">
            <span>${isLiked ? "❤️" : "🤍"}</span>
            <span>${post.likes.length} Likes</span>
          </button>
          <button class="action-btn" onclick="document.getElementById('comment-input-${post.id}')?.focus()">
            <span>💬</span>
            <span>${commentsArray.length} Comments</span>
          </button>
          ${
            !isMyPost
              ? `<button class="action-btn talk-btn" data-author="${post.author}" style="margin-left: auto;">
                   <span>💬 Talk</span>
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
                <span class="comment-author author-clickable" data-author="${c.author}" style="cursor: pointer;">@${shortenKey(c.author)}:</span>
                <span>${escapeHtml(c.text)}</span>
              </div>
            `
              )
              .join("")}
          </div>

          <form class="comment-form" data-post-id="${post.id}" data-author="${post.author}">
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

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function attachCardListeners() {
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
        if (liked) {
          post.likes.push(currentIdentity.pubkey);
        } else {
          post.likes = post.likes.filter((k) => k !== currentIdentity!.pubkey);
        }
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
  publishBtn.textContent = "🚫 Publishing Prohibited";

  if (moderationStatus && moderationBadgeText) {
    moderationStatus.style.display = "flex";
    moderationStatus.style.background = "#fef2f2";
    moderationStatus.style.border = "1px solid #f87171";
    moderationBadgeText.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="color: #b91c1c; font-weight: 700; font-size: 0.85rem;">⛔ Adult Content Detected (${escapeHtml(label)}, confidence: ${(score * 100).toFixed(0)}%)</span>
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
  publishBtn.textContent = "⏳ Moderation scan in progress...";

  if (moderationStatus && moderationBadgeText) {
    moderationStatus.style.display = "flex";
    moderationStatus.style.background = "#eff6ff";
    moderationStatus.style.border = "1px solid #bfdbfe";
    moderationBadgeText.innerHTML = `<span style="color: #1d4ed8; font-weight: 600;">⏳ Scanning on-device with Desert Ant Moderator...</span>`;
  }
}

function setMediaVerifiedSafe(score: number) {
  currentMediaNsfw = false;
  resetPublishBtnState();

  if (moderationStatus && moderationBadgeText) {
    moderationStatus.style.display = "flex";
    moderationStatus.style.background = "#f0fdf4";
    moderationStatus.style.border = "1px solid #86efac";
    moderationBadgeText.innerHTML = `<span style="color: #15803d; font-weight: 600;">🛡️ Desert Ant Verified Safe (score: ${score})</span>`;
  }
}

// File Picker for Moments with Desert Ant On-Device Scan
postFilePicker.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;
    postMediaUrl.value = dataUrl;
    imagePreview.src = dataUrl;
    imagePreviewContainer.style.display = "flex";
  };
  reader.readAsDataURL(file);

  setPublishBtnScanning();

  const modRes = await analyzeImageFile(file);
  currentMediaNsfwScore = modRes.score;

  if (modRes.isNSFW) {
    blockPublishBtnForNsfw(modRes.label, modRes.score);
  } else {
    setMediaVerifiedSafe(modRes.score);
  }
});

// URL or Base64 pasted directly into Moment media field
postMediaUrl.addEventListener("change", async () => {
  const val = postMediaUrl.value.trim();
  if (!val) {
    clearImageBtn.click();
    return;
  }
  imagePreview.src = val;
  imagePreviewContainer.style.display = "flex";

  setPublishBtnScanning();

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = async () => {
    const modRes = await analyzeImageFile(img);
    currentMediaNsfwScore = modRes.score;
    if (modRes.isNSFW) {
      blockPublishBtnForNsfw(modRes.label, modRes.score);
    } else {
      setMediaVerifiedSafe(modRes.score);
    }
  };
  img.onerror = () => {
    resetPublishBtnState();
  };
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
    alert("🚫 Publishing Prohibited: Desert Ant Moderator detected that this image contains explicit or adult media. Publishing this content is not permitted.");
    return;
  }

  // 2. Anti-flood cooldown check (15 seconds between posts)
  const now = Date.now();
  const timeSinceLast = now - lastPostTime;
  if (lastPostTime > 0 && timeSinceLast < POST_COOLDOWN_MS) {
    const waitSec = Math.ceil((POST_COOLDOWN_MS - timeSinceLast) / 1000);
    alert(`⏳ Anti-Flood Cooldown: Please wait ${waitSec} second${waitSec > 1 ? "s" : ""} before publishing another post.`);
    return;
  }

  // 3. Sliding window rate limit check (max 3 posts per 60 seconds)
  recentPostTimestamps = recentPostTimestamps.filter((t) => now - t < 60000);
  if (recentPostTimestamps.length >= MAX_POSTS_PER_MINUTE) {
    alert("⏳ Rate Limit Exceeded: You can publish a maximum of 3 posts per minute to protect the network from flooding. Please wait a moment.");
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
    alert("⚠️ Duplicate Post Detected: You recently published this exact message. Duplicate posting is prohibited to prevent timeline spam.");
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

// Pubkey badge copy
myPubkeyBadge.addEventListener("click", () => {
  if (currentIdentity) {
    navigator.clipboard.writeText(currentIdentity.pubkey);
    const originalText = myPubkeyBadge.textContent;
    myPubkeyBadge.textContent = "Copied!";
    setTimeout(() => {
      myPubkeyBadge.textContent = originalText;
    }, 1500);
  }
});

// Profile Modal Interactions
editProfileBtn.addEventListener("click", () => {
  modalNameInput.value = currentProfile?.display_name || "";
  modalBioInput.value = currentProfile?.bio || "";
  modalAvatarInput.value = currentProfile?.avatar_url || "";
  profileModal.style.display = "flex";
});

modalCancelBtn.addEventListener("click", () => {
  profileModal.style.display = "none";
});

modalSaveBtn.addEventListener("click", async () => {
  if (!currentIdentity) return;
  const name = modalNameInput.value.trim() || `Persona @${shortenKey(currentIdentity.pubkey)}`;
  const bio = modalBioInput.value.trim();
  const avatar = modalAvatarInput.value.trim();

  modalSaveBtn.disabled = true;
  modalSaveBtn.textContent = "Signing & Saving...";

  try {
    const updated = await freenet.updateProfile(currentIdentity, name, bio, avatar);
    currentProfile = updated;
    sidebarName.textContent = updated.display_name;
    sidebarBio.textContent = updated.bio || "No bio yet.";
    if (updated.avatar_url) {
      sidebarAvatar.src = updated.avatar_url;
    }
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
  const feed = await freenet.getFeed(pubkey);
  const name = feed.profile?.display_name || `Persona @${shortenKey(pubkey)}`;
  const bio = feed.profile?.bio || "No bio available.";
  const avatar = feed.profile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${pubkey}`;

  uviewAvatar.src = avatar;
  uviewName.textContent = name;
  uviewKey.textContent = pubkey;
  uviewBio.textContent = bio;

  const isFollowing = followingKeys.includes(pubkey);
  uviewFollowBtn.textContent = isFollowing ? "✓ Following" : "➕ Follow";
  uviewFollowBtn.onclick = async () => {
    if (!currentIdentity) return;
    const nowFollowing = await freenet.toggleFollow(currentIdentity, pubkey);
    if (nowFollowing) {
      followingKeys.push(pubkey);
      uviewFollowBtn.textContent = "✓ Following";
    } else {
      followingKeys = followingKeys.filter((k) => k !== pubkey);
      uviewFollowBtn.textContent = "➕ Follow";
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
          ? `<div class="uview-post-thumb"><img src="${p.media_uri}" alt="Post" /></div>`
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

if (commChatBtn) {
  commChatBtn.addEventListener("click", () => {
    if (activeCommunity) {
      openCommunityChat(activeCommunity);
    }
  });
}

chatClearBtn.addEventListener("click", async () => {
  if (!currentIdentity) return;
  if (activeChatCommunity) {
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
        if (activeChatCommunity) {
          await selectCommunityRoom(activeChatCommunity);
        } else if (activeChatPeer) {
          await selectChatPeer(activeChatPeer);
        }
      }
    });
  });
}

function renderChatSidebar() {
  if (!currentIdentity) return;

  // 1. Render Communities Chatrooms
  if (chatCommunitiesList) {
    if (allCommunities.length === 0) {
      chatCommunitiesList.innerHTML = `<div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px;">No communities yet.</div>`;
    } else {
      chatCommunitiesList.innerHTML = allCommunities
        .map((c) => {
          const isActive = activeChatCommunity?.id === c.id;
          return `
            <div class="chat-comm-item ${isActive ? "active" : ""}" data-comm-id="${c.id}" title="Enter r/${escapeHtml(c.slug)} chatroom">
              <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
                <span>💬</span>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">r/${escapeHtml(c.slug)}</span>
              </div>
              <span class="chat-comm-badge">${c.members.length}</span>
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
  const discovered = freenet.getDiscoveredPeers(currentIdentity.pubkey).map((p) => p.pubkey);
  const rawPeers = Array.from(
    new Set([
      ...freenet.getChatPeers(currentIdentity.pubkey),
      ...followingKeys,
      ...discovered,
      ...(activeChatPeer ? [activeChatPeer] : []),
    ])
  );
  const knownPeers = rawPeers.filter((pk) => pk && pk !== currentIdentity!.pubkey);

  if (knownPeers.length === 0) {
    chatPeersList.innerHTML = `<div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px;">No direct messages yet.</div>`;
    return;
  }

  chatPeersList.innerHTML = knownPeers
    .map((pk) => {
      const peerProfile = freenet.knownPeers[pk];
      const displayName = peerProfile?.display_name || `@${shortenKey(pk)}`;
      const isActive = activeChatPeer === pk && !activeChatCommunity;
      return `
    <div class="chat-peer-item ${isActive ? "active" : ""}" data-peer="${pk}">
      <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; flex: 1;">
        <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${pk}" style="width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;" />
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(displayName)}</span>
      </div>
      <button class="remove-peer-btn" data-peer="${pk}" title="Remove conversation from list">✕</button>
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

async function selectCommunityRoom(comm: Community) {
  if (!currentIdentity) return;
  activeChatCommunity = comm;
  activeChatPeer = null;

  chatPeerInfo.innerHTML = `<strong>#r/${escapeHtml(comm.slug)}</strong> (${comm.members.length} members) — ${escapeHtml(comm.name)} <span class="chat-security-badge public" title="Public Community Chatroom - Authenticated by Ed25519">🌐 Public Room</span>`;
  const isMod =
    comm.creator === currentIdentity.pubkey || comm.moderators.includes(currentIdentity.pubkey);
  chatClearBtn.style.display = isMod ? "inline-block" : "none";
  chatClearBtn.title = "Moderator: Clear community chatroom";

  renderChatSidebar();

  const messages = await freenet.getCommunityChatMessages(comm.id);
  const roomId = `comm_${comm.id}`;

  if (messages.length === 0) {
    chatMessagesList.innerHTML = `<div class="empty-state" style="padding: 20px;">Welcome to #r/${escapeHtml(comm.slug)} community chat! Say hello to fellow members.</div>`;
  } else {
    chatMessagesList.innerHTML = messages
      .map((msg) => {
        const isMine = msg.sender === currentIdentity!.pubkey;
        const msgIsMod = comm.creator === msg.sender || comm.moderators.includes(msg.sender);
        const senderProfile = freenet.knownPeers[msg.sender];
        const senderName = senderProfile?.display_name || `@${shortenKey(msg.sender)}`;
        const canDelete = isMine || isMod;

        return `
        <div class="chat-bubble ${isMine ? "mine" : "theirs"}" data-msg-id="${msg.id}">
          ${canDelete ? `<button class="chat-bubble-del" data-room-id="${roomId}" data-msg-id="${msg.id}" title="Delete message">🗑️</button>` : ""}
          <div class="chat-sender-info">
            <span>${escapeHtml(senderName)}</span>
            ${msgIsMod ? `<span class="chat-mod-badge">🛡️ Mod</span>` : ""}
          </div>
          <div>${escapeHtml(msg.text)}</div>
          <div class="chat-bubble-time">${formatTimeAgo(msg.timestamp)}</div>
        </div>
      `;
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

  const peerProfile = freenet.knownPeers[peerPubkey];
  const name = peerProfile?.display_name || `@${shortenKey(peerPubkey)}`;
  chatPeerInfo.innerHTML = `<strong>${escapeHtml(name)}</strong> <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">(@${shortenKey(peerPubkey)})</span> <span class="chat-security-badge e2ee" title="End-to-End Encrypted via X25519 ECDH + AES-256-GCM">🔒 E2EE Private</span>`;
  chatClearBtn.style.display = "inline-block";
  chatClearBtn.title = "Delete entire conversation history";

  renderChatSidebar();

  const messages = await freenet.getChatMessages(currentIdentity, peerPubkey);
  const roomId = freenet.getRoomId(currentIdentity.pubkey, peerPubkey);

  if (messages.length === 0) {
    chatMessagesList.innerHTML = `<div class="empty-state" style="padding: 20px;">No messages yet. Direct messages are End-to-End Encrypted (E2EE) 🔒</div>`;
  } else {
    chatMessagesList.innerHTML = messages
      .map((msg) => {
        const isMine = msg.sender === currentIdentity!.pubkey;
        return `
        <div class="chat-bubble ${isMine ? "mine" : "theirs"}" data-msg-id="${msg.id}">
          <button class="chat-bubble-del" data-room-id="${roomId}" data-msg-id="${msg.id}" title="Delete message">🗑️</button>
          <div>${escapeHtml(msg.text)}</div>
          <div class="chat-bubble-time">${formatTimeAgo(msg.timestamp)}</div>
        </div>
      `;
      })
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
    alert(`⏳ Slow down: Please wait ${waitSec}s before sending another chat message.`);
    return;
  }
  lastChatMessageTime = now;

  chatMessageInput.value = "";
  const censorship = censorTextAndPII(text);
  if (censorship.hasCensoredPII || censorship.hasCensoredProfanity) {
    alert(
      `ℹ️ Automatic Censorship Notice:\n\nSensitive information or inappropriate words were detected and masked in your message:\n• ${censorship.details.join("\n• ")}\n\nThe message has been sent with the content redacted.`
    );
  }
  const finalText = censorship.censoredText;

  if (activeChatCommunity) {
    await freenet.sendCommunityChatMessage(currentIdentity, activeChatCommunity.id, finalText);
    await selectCommunityRoom(activeChatCommunity);
  } else if (activeChatPeer) {
    await freenet.sendChatMessage(currentIdentity, activeChatPeer, finalText);
    await selectChatPeer(activeChatPeer);
  }
});

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

    commJoinBtn.textContent = isMember ? "Joined ✓" : "Join Community";
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
    <div class="comm-item ${activeCommunity?.id === c.id ? "active" : ""}" data-id="${c.id}">
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
    <option value="">🌐 Global Timeline</option>
    ${allCommunities
      .map(
        (c) => `
      <option value="${c.id}" ${activeCommunity?.id === c.id ? "selected" : ""}>
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
            ? `<button class="remove-mod-btn btn-secondary btn-sm" data-mod="${modPk}" style="color: var(--danger); font-size: 0.75rem; padding: 2px 6px;">Remove</button>`
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
      <div style="padding: 4px 0; border-bottom: 1px solid var(--border); font-family: monospace;">
        ❌ Post ID: ${pid}
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
scopeExploreBtn.addEventListener("click", async () => {
  currentFeedScope = "explore";
  scopeExploreBtn.classList.add("active");
  scopeFollowingBtn.classList.remove("active");
  await reloadPosts();
});

scopeFollowingBtn.addEventListener("click", async () => {
  currentFeedScope = "following";
  scopeFollowingBtn.classList.add("active");
  scopeExploreBtn.classList.remove("active");
  await reloadPosts();
});

// ---- Theme Management (Dark / Light Mode) ----

function initTheme() {
  const saved = localStorage.getItem("spruce_theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}

function applyTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("spruce_theme", theme);
  if (themeIcon) {
    themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
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
  if (!currentIdentity) return;
  const persona = currentIdentity.personaName || personaName(currentIdentity.pubkey);
  identityPersonaName.textContent = persona;
  identityPubkeyVal.textContent = currentIdentity.pubkey;

  if (currentIdentity.type === "viso") {
    identityTypeBadge.className = "identity-badge viso";
    identityTypeBadge.textContent = "● Viso Persona";
    identityBackupActions.style.display = "none";
    identityVisoActions.style.display = "flex";
  } else {
    identityTypeBadge.className = "identity-badge local";
    identityTypeBadge.textContent = "● Local Keypair";
    identityBackupActions.style.display = "flex";
    identityVisoActions.style.display = "none";
    idSecretKeyDisplay.style.display = "none";
    idSecretKeyDisplay.textContent = localIdentityKey() || "";
    idShowKeyBtn.textContent = "👁️ Show Secret Key";
  }

  visoUrlInput.value = localStorage.getItem("spruce_viso_url") || officialViso();
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
if (manageIdentityBtn) {
  manageIdentityBtn.addEventListener("click", openIdentityModal);
}
myPubkeyBadge.addEventListener("click", openIdentityModal);

identityCloseBtn.addEventListener("click", () => {
  identityModal.style.display = "none";
});

idShowKeyBtn.addEventListener("click", () => {
  if (idSecretKeyDisplay.style.display === "none") {
    idSecretKeyDisplay.style.display = "block";
    idShowKeyBtn.textContent = "🙈 Hide Secret Key";
  } else {
    idSecretKeyDisplay.style.display = "none";
    idShowKeyBtn.textContent = "👁️ Show Secret Key";
  }
});

idDownloadKeyBtn.addEventListener("click", () => {
  const sk = localIdentityKey();
  if (!sk || !currentIdentity) return;
  const shortName = (currentIdentity.personaName || currentIdentity.pubkey).slice(0, 8);
  const blob = new Blob(
    [`Spruce Decentralized Identity Private Key (keep it secret):\n${sk}\n`],
    { type: "text/plain" }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `identity-${shortName}.txt`;
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
      const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
      window.history.replaceState(null, "", cleanUrl);
      alert(`Successfully signed in with Viso persona: ${personaName(persona)}!`);
    } catch (err) {
      console.error("Viso sign-in verification error:", err);
      alert("Viso sign-in failed: " + ((err as Error).message || err));
      const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
      window.history.replaceState(null, "", cleanUrl);
    }
  }

  currentIdentity = await getOrCreateIdentity();

  // Load Feed to check profile and following
  const myFeed = await freenet.getFeed(currentIdentity.pubkey);
  currentProfile = myFeed.profile || null;
  followingKeys = myFeed.following || [];

  // Populate UI with identity (Base58 Persona name + shortened pubkey)
  const personaBase58 = currentIdentity.personaName || personaName(currentIdentity.pubkey);
  const shortPersona = personaBase58.length > 10 ? `${personaBase58.slice(0, 10)}...` : personaBase58;
  myPubkeyBadge.textContent = `@${shortPersona}`;
  myPubkeyBadge.title = `Persona: ${personaBase58}\nPubkey: ${currentIdentity.pubkey}\nClick to manage identity`;
  sidebarName.textContent = currentProfile?.display_name || `Persona @${shortPersona}`;
  sidebarBio.textContent = currentProfile?.bio || "No bio yet.";
  sidebarKey.textContent = currentIdentity.pubkey;
  sidebarKey.title = `Base58 Persona: ${personaBase58}`;
  sidebarAvatar.src = currentProfile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${currentIdentity.pubkey}`;

  renderIdentityModal();
  renderFollowingList();
  renderDiscoveredPeers();
  updateNotificationsBadge();

  // Announce persona to peer network and subscribe to real-time events
  freenet.announceIdentity(currentIdentity, currentProfile);
  freenet.onSyncUpdate(async () => {
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
      if (activeChatCommunity) {
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
    freenetDot.classList.add("online");
    freenetStatusLabel.textContent = "Freenet Node Online";
  } else {
    freenetDot.classList.remove("online");
    freenetStatusLabel.textContent = "Local-First Storage";
  }

  // Load Timeline (Explore by default so all posts on network are immediately visible)
  await reloadPosts();

  // If completely new persona and no posts found anywhere, insert demo welcome post
  if (timelinePosts.length === 0) {
    const welcome = await freenet.publishPost(
      currentIdentity,
      "thought",
      "Welcome to Spruce on Freenet! #decentralized #p2p #web3 This social network runs 100% decentralized with Reddit-style Communities and interactive hashtags."
    );
    timelinePosts.unshift(welcome);
    renderTimeline();
  }
}

init();
