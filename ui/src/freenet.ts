import type {
  FeedState,
  Post,
  Comment,
  UserIdentity,
  PostCategory,
  ProfileInfo,
  ChatMessage,
  NotificationItem,
  Community,
  PrivateRoom,
} from "./types.ts";
import {
  formatPostSignatureMessage,
  formatCommentSignatureMessage,
  formatProfileSignatureMessage,
  formatLikeSignatureMessage,
  formatFollowingSignatureMessage,
  formatDeleteSignatureMessage,
  formatChatMessageSignatureMessage,
  formatCommunitySignatureMessage,
  formatModActionSignatureMessage,
  formatPrivateRoomSignatureMessage,
  encryptDirectMessage,
  decryptDirectMessage,
  generateRoomKey,
  encryptWithSymmetricKey,
  decryptWithSymmetricKey,
  encryptRoomKeyForPeer,
  decryptRoomKeyFromPeer,
  bytesToHex,
  hexToBytes,
} from "./crypto.ts";
import { safeStorage } from "./storage.ts";

const localStorage = safeStorage;

const DEFAULT_WS_URL = "ws://127.0.0.1:7509/v1/contract/command";

export class FreenetClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private bc: BroadcastChannel | null = null;
  private listeners: (() => void)[] = [];
  public peerCache: Record<string, Post> = {};
  public knownPeers: Record<string, { display_name: string; avatar_url?: string }> = {};
  private privateRoomKeyCache: Map<string, Uint8Array> = new Map();

  constructor(private url: string = DEFAULT_WS_URL) {
    if (typeof BroadcastChannel !== "undefined") {
      this.bc = new BroadcastChannel("radica_peer_sync");
      this.bc.onmessage = (ev) => {
        this.handlePeerEvent(ev.data);
      };
    }

    if (import.meta.hot) {
      import.meta.hot.on("radica:peer-event", (data: any) => {
        this.handlePeerEvent(data);
      });
      import.meta.hot.on("spruce:peer-event", (data: any) => {
        this.handlePeerEvent(data);
      });
      const handleSyncState = (state: any) => {
        if (state.posts && Array.isArray(state.posts)) {
          for (const p of state.posts) {
            this.peerCache[p.id] = p;
          }
        }
        if (state.peers) {
          Object.assign(this.knownPeers, state.peers);
        }
        if (state.communities) {
          const list = Object.values(state.communities) as Community[];
          this.mergeRemoteCommunities(list);
        }
        if (state.chatMessages) {
          for (const [roomId, msgs] of Object.entries(state.chatMessages)) {
            const roomKey = `freenet_chat_${roomId}`;
            const raw = localStorage.getItem(roomKey);
            const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
            for (const m of msgs as ChatMessage[]) {
              if (!list.some((existing) => existing.id === m.id)) {
                list.push(m);
              }
              if (m.recipient && m.recipient !== "community") {
                this.addChatPeer(m.sender, m.recipient);
                this.addChatPeer(m.recipient, m.sender);
              }
            }
            localStorage.setItem(roomKey, JSON.stringify(list));
          }
        }
        this.notifyListeners();
      };
      import.meta.hot.on("radica:sync-state", handleSyncState);
      import.meta.hot.on("spruce:sync-state", handleSyncState);
    }
  }

  public async announceIdentity(identity: UserIdentity, profile?: ProfileInfo | null) {
    const data = {
      type: "hello",
      pubkey: identity.pubkey,
      profile: profile ? { display_name: profile.display_name } : { display_name: `Persona @${identity.pubkey.substring(0, 6)}` },
    };
    this.knownPeers[identity.pubkey] = data.profile;
    this.broadcast(data);

    try {
      const comms = await this.getCommunities();
      for (const c of comms) {
        if (c.creator !== "system") {
          this.broadcast({ type: "community", community: c });
        }
      }
    } catch (e) {
      console.warn("[Freenet] Error announcing communities:", e);
    }
  }

  public broadcast(data: any) {
    try {
      this.bc?.postMessage(data);
    } catch {}
    if (import.meta.hot) {
      import.meta.hot.send("radica:peer-event", data);
    }
  }

  public mergeRemoteCommunities(incoming: Community[]) {
    if (!incoming || incoming.length === 0) return;
    const raw = localStorage.getItem("freenet_communities");
    let list: Community[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }
    list = list.map((c) => {
      if (c.id === "c_spruce") {
        return { ...c, id: "c_radica", name: "Radica Hub", slug: "radica" };
      }
      return c;
    });
    if (list.length === 0) {
      list = [
        {
          id: "c_radica",
          name: "Radica Hub",
          slug: "radica",
          description: "Decentralized social commons, Freenet dApps, and network updates.",
          created_at: 1710000000000,
          creator: "system",
          moderators: ["system"],
          members: ["system"],
          deleted_post_ids: [],
          sig: "genesis",
        },
        {
          id: "c_tech",
          name: "Tech & P2P",
          slug: "tech",
          description: "Peer-to-peer protocols, cryptography, and Web3 decentralization.",
          created_at: 1710000000000,
          creator: "system",
          moderators: ["system"],
          members: ["system"],
          deleted_post_ids: [],
          sig: "genesis",
        },
      ];
    }
    let changed = false;
    for (const comm of incoming) {
      if (!comm || !comm.id) continue;
      const idx = list.findIndex(
        (c) => c.id === comm.id || (c.slug && c.slug.toLowerCase() === comm.slug?.toLowerCase())
      );
      if (idx >= 0) {
        const existing = list[idx];
        const members = Array.from(new Set([...(existing.members || []), ...(comm.members || [])]));
        const moderators = Array.from(new Set([...(existing.moderators || []), ...(comm.moderators || [])]));
        const deleted_post_ids = Array.from(new Set([...(existing.deleted_post_ids || []), ...(comm.deleted_post_ids || [])]));
        list[idx] = {
          ...existing,
          ...comm,
          members,
          moderators,
          deleted_post_ids,
        };
        changed = true;
      } else {
        list.push(comm);
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem("freenet_communities", JSON.stringify(list));
    }
  }

  private handlePeerEvent(data: any) {
    if (!data) return;
    if (data.type === "post" && data.post) {
      const p = data.post as Post;
      this.peerCache[p.id] = p;
      if (p.author) {
        if (!this.knownPeers[p.author]) {
          this.knownPeers[p.author] = { display_name: `Persona @${p.author.substring(0, 6)}` };
        }
      }
      this.notifyListeners();
    } else if (data.type === "hello" && data.pubkey) {
      this.knownPeers[data.pubkey] = data.profile || { display_name: `Persona @${data.pubkey.substring(0, 6)}` };
      this.notifyListeners();
    } else if (data.type === "community" && data.community) {
      this.mergeRemoteCommunities([data.community]);
      this.notifyListeners();
    } else if (data.type === "chat" && data.message) {
      const msg = data.message as ChatMessage;
      const roomKey = `freenet_chat_${msg.room_id}`;
      const raw = localStorage.getItem(roomKey);
      const messages: ChatMessage[] = raw ? JSON.parse(raw) : [];
      if (!messages.some((m) => m.id === msg.id)) {
        messages.push(msg);
        localStorage.setItem(roomKey, JSON.stringify(messages));
      }
      if (msg.recipient && msg.recipient !== "community") {
        this.addChatPeer(msg.sender, msg.recipient);
        this.addChatPeer(msg.recipient, msg.sender);
        const notifText = msg.text.startsWith("e2e:")
          ? "sent you an encrypted direct message 🔒"
          : `sent you a message: "${msg.text.length > 30 ? msg.text.substring(0, 30) + '...' : msg.text}"`;
        this.addNotification(msg.recipient, {
          type: "chat",
          from: msg.sender,
          text: notifText,
        });
      }
      this.notifyListeners();
    } else if (data.type === "chat_delete" && data.roomId && data.messageId) {
      const roomKey = `freenet_chat_${data.roomId}`;
      const raw = localStorage.getItem(roomKey);
      if (raw) {
        const messages: ChatMessage[] = JSON.parse(raw);
        const filtered = messages.filter((m) => m.id !== data.messageId);
        localStorage.setItem(roomKey, JSON.stringify(filtered));
      }
      this.notifyListeners();
    } else if (data.type === "chat_clear" && data.roomId) {
      const roomKey = `freenet_chat_${data.roomId}`;
      localStorage.setItem(roomKey, JSON.stringify([]));
      this.notifyListeners();
    } else if (data.type === "private_room" && data.room) {
      this.mergeRemotePrivateRooms([data.room]);
      this.notifyListeners();
    } else if (data.type === "private_room_kick" && data.room) {
      this.mergeRemotePrivateRooms([data.room]);
      this.notifyListeners();
    } else if ((data.type === "community_ban" || data.type === "community_unban") && data.community) {
      this.mergeRemoteCommunities([data.community]);
      this.notifyListeners();
    }
  }

  public onSyncUpdate(fn: () => void) {
    this.listeners.push(fn);
  }

  private notifyListeners() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    }
  }

  public async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
          this.isConnected = true;
          console.log("[Freenet] Connected to local node at", this.url);
          resolve(true);
        };
        this.ws.onerror = () => {
          console.warn("[Freenet] Could not connect to Freenet node, using local-first storage mode.");
          this.isConnected = false;
          resolve(false);
        };
        this.ws.onclose = () => {
          this.isConnected = false;
        };
      } catch (err) {
        console.warn("[Freenet] WebSocket init error, falling back to local mode:", err);
        resolve(false);
      }
    });
  }

  public get isNodeOnline(): boolean {
    return this.isConnected;
  }

  // Load feed for a given owner pubkey
  public async getFeed(ownerPubkey: string): Promise<FeedState> {
    const key = `freenet_feed_${ownerPubkey}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed.profile) {
          const profRaw = localStorage.getItem(`radica_profile_${ownerPubkey}`);
          if (profRaw) {
            try {
              parsed.profile = JSON.parse(profRaw);
            } catch {}
          }
        }
        return parsed;
      } catch {
        // pass
      }
    }
    return {
      owner: ownerPubkey,
      posts: {},
      following: [],
    };
  }

  // Save feed locally and send Delta to Freenet node
  public async saveFeed(feed: FeedState): Promise<void> {
    const key = `freenet_feed_${feed.owner}`;
    localStorage.setItem(key, JSON.stringify(feed));

    if (this.isConnected && this.ws) {
      try {
        const updateMsg = {
          type: "update",
          contract: feed.owner,
          delta: JSON.stringify(feed),
        };
        this.ws.send(JSON.stringify(updateMsg));
      } catch (e) {
        console.error("[Freenet] Error sending delta:", e);
      }
    }
  }

  // Update user profile info
  public async updateProfile(
    identity: UserIdentity,
    displayName: string,
    bio: string,
    avatarUrl: string
  ): Promise<ProfileInfo> {
    const updatedAt = Date.now();
    const sigMsg = formatProfileSignatureMessage(identity.pubkey, displayName, bio, avatarUrl, updatedAt);
    const sig = await identity.sign(sigMsg);

    const profile: ProfileInfo = {
      display_name: displayName,
      bio,
      avatar_url: avatarUrl,
      updated_at: updatedAt,
      sig,
    };

    const feed = await this.getFeed(identity.pubkey);
    feed.profile = profile;
    await this.saveFeed(feed);
    return profile;
  }

  public async publishPost(
    identity: UserIdentity,
    category: PostCategory,
    caption: string,
    mediaUri?: string,
    location?: string,
    eventDate?: string,
    communityId?: string,
    isNsfw?: boolean,
    nsfwScore?: number
  ): Promise<Post> {
    const id = `post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = Date.now();
    const post: Post = {
      id,
      author: identity.pubkey,
      category,
      caption,
      community_id: communityId,
      media_uri: mediaUri,
      location,
      event_date: eventDate,
      is_nsfw: !!isNsfw,
      timestamp,
      sig: "",
      likes: {},
      comments: {},
      nsfw_score: nsfwScore,
    };
    post.sig = await identity.sign(formatPostSignatureMessage(post));

    const feed = await this.getFeed(identity.pubkey);
    feed.posts[id] = post;
    await this.saveFeed(feed);
    this.peerCache[id] = post;
    this.broadcast({ type: "post", post });
    return post;
  }

  // Delete a post
  public async deletePost(identity: UserIdentity, postId: string): Promise<boolean> {
    const feed = await this.getFeed(identity.pubkey);
    if (!feed.posts[postId]) return false;

    delete feed.posts[postId];
    feed.deleted = { ...feed.deleted, [postId]: await identity.sign(formatDeleteSignatureMessage(identity.pubkey, postId)) };
    await this.saveFeed(feed);
    return true;
  }

  // Add comment to a post
  public async addComment(
    identity: UserIdentity,
    postAuthorPubkey: string,
    postId: string,
    text: string
  ): Promise<Comment> {
    const commentId = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = Date.now();
    const sigMsg = formatCommentSignatureMessage(commentId, postId, identity.pubkey, text, timestamp);
    const sig = await identity.sign(sigMsg);

    const comment: Comment = {
      id: commentId,
      post_id: postId,
      author: identity.pubkey,
      text,
      timestamp,
      sig,
    };

    const feed = await this.getFeed(postAuthorPubkey);
    if (feed.posts[postId]) {
      feed.posts[postId].comments[`${identity.pubkey}:${commentId}`] = comment;
      await this.saveFeed(feed);

      // Trigger notification if commenting on someone else's post
      if (identity.pubkey !== postAuthorPubkey) {
        await this.addNotification(postAuthorPubkey, {
          type: "comment",
          from: identity.pubkey,
          text: `commented: "${text.substring(0, 35)}..."`,
          linkPostId: postId,
        });
      }
    }
    return comment;
  }

  // Like or unlike a post
  public async toggleLike(identity: UserIdentity, postAuthorPubkey: string, postId: string): Promise<boolean> {
    const feed = await this.getFeed(postAuthorPubkey);
    if (!feed.posts[postId]) return false;

    const post = feed.posts[postId];
    const liked = !post.likes?.[identity.pubkey]?.liked;
    const ts = Date.now();
    const sig = await identity.sign(formatLikeSignatureMessage(postAuthorPubkey, postId, identity.pubkey, liked, ts));
    post.likes = { ...post.likes, [identity.pubkey]: { liked, ts, sig } };
    if (liked && identity.pubkey !== postAuthorPubkey) {
      // Trigger notification if liking someone else's post
      await this.addNotification(postAuthorPubkey, {
        type: "like",
        from: identity.pubkey,
        text: "liked your post.",
        linkPostId: postId,
      });
    }
    await this.saveFeed(feed);
    return liked;
  }

  // Follow or unfollow a user
  public async toggleFollow(identity: UserIdentity, targetPubkey: string): Promise<boolean> {
    const feed = await this.getFeed(identity.pubkey);
    const index = feed.following.indexOf(targetPubkey);
    let following = false;
    if (index >= 0) {
      feed.following.splice(index, 1);
      following = false;
    } else {
      feed.following.push(targetPubkey);
      following = true;

      // Trigger notification
      await this.addNotification(targetPubkey, {
        type: "follow",
        from: identity.pubkey,
        text: "started following your persona.",
      });
    }
    feed.following_updated_at = Date.now();
    feed.following_sig = await identity.sign(
      formatFollowingSignatureMessage(identity.pubkey, feed.following_updated_at, feed.following)
    );
    await this.saveFeed(feed);
    return following;
  }

  // Aggregate timeline: own posts + followed users' posts sorted by timestamp
  public async getTimeline(identity: UserIdentity): Promise<Post[]> {
    const myFeed = await this.getFeed(identity.pubkey);
    const postMap: Record<string, Post> = { ...myFeed.posts };

    for (const followedPubkey of myFeed.following) {
      const peerFeed = await this.getFeed(followedPubkey);
      Object.assign(postMap, peerFeed.posts);
      for (const p of Object.values(this.peerCache)) {
        if (p.author === followedPubkey) {
          postMap[p.id] = p;
        }
      }
    }

    return Object.values(postMap).sort((a, b) => b.timestamp - a.timestamp);
  }

  // Global Explore feed: all posts published by any persona on the network
  public async getExploreTimeline(identity: UserIdentity): Promise<Post[]> {
    const myFeed = await this.getFeed(identity.pubkey);
    const postMap: Record<string, Post> = { ...myFeed.posts, ...this.peerCache };

    for (const followedPubkey of myFeed.following) {
      const peerFeed = await this.getFeed(followedPubkey);
      Object.assign(postMap, peerFeed.posts);
    }

    return Object.values(postMap).sort((a, b) => b.timestamp - a.timestamp);
  }

  public getDiscoveredPeers(myPubkey: string): { pubkey: string; name: string }[] {
    const list: { pubkey: string; name: string }[] = [];
    for (const [pk, prof] of Object.entries(this.knownPeers)) {
      if (pk !== myPubkey) {
        list.push({ pubkey: pk, name: prof.display_name || `Persona @${pk.substring(0, 6)}` });
      }
    }
    return list;
  }

  // ---- 1-on-1 P2P Chat ----

  public getRoomId(pkA: string, pkB: string): string {
    return pkA < pkB ? `${pkA}:${pkB}` : `${pkB}:${pkA}`;
  }

  public async sendChatMessage(
    identity: UserIdentity,
    recipientPubkey: string,
    text: string
  ): Promise<ChatMessage> {
    const roomId = this.getRoomId(identity.pubkey, recipientPubkey);
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = Date.now();

    // 1-on-1 direct messages are end-to-end encrypted with X25519 ECDH + AES-256-GCM
    const encryptedText = await encryptDirectMessage(identity.secretKey, recipientPubkey, text);

    const sigMsg = formatChatMessageSignatureMessage(id, roomId, identity.pubkey, recipientPubkey, encryptedText, timestamp);
    const sig = await identity.sign(sigMsg);

    const message: ChatMessage = {
      id,
      room_id: roomId,
      sender: identity.pubkey,
      recipient: recipientPubkey,
      text: encryptedText,
      timestamp,
      sig,
    };

    // Store in room messages (ciphertext stored at rest)
    const roomKey = `freenet_chat_${roomId}`;
    const raw = localStorage.getItem(roomKey);
    const messages: ChatMessage[] = raw ? JSON.parse(raw) : [];
    messages.push(message);
    localStorage.setItem(roomKey, JSON.stringify(messages));

    // Track active chat peers for both sender and recipient
    this.addChatPeer(identity.pubkey, recipientPubkey);
    this.addChatPeer(recipientPubkey, identity.pubkey);
    this.broadcast({ type: "chat", message });

    // Return message with decrypted plaintext for the local caller
    return {
      ...message,
      text,
    };
  }

  public async getChatMessages(identity: UserIdentity, peerPubkey: string): Promise<ChatMessage[]> {
    const roomId = this.getRoomId(identity.pubkey, peerPubkey);
    const roomKey = `freenet_chat_${roomId}`;
    const raw = localStorage.getItem(roomKey);
    const messages: ChatMessage[] = raw ? JSON.parse(raw) : [];

    // Decrypt messages asynchronously using peer's pubkey
    const decryptedList = await Promise.all(
      messages.map(async (msg) => {
        if (msg.text && msg.text.startsWith("e2e:")) {
          const plain = await decryptDirectMessage(identity.secretKey, peerPubkey, msg.text);
          return { ...msg, text: plain };
        }
        return msg;
      })
    );
    return decryptedList;
  }

  public getChatPeers(myPubkey: string): string[] {
    const key = `freenet_chat_peers_${myPubkey}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  public async sendCommunityChatMessage(
    identity: UserIdentity,
    communityId: string,
    text: string
  ): Promise<ChatMessage> {
    const comm = await this.getCommunity(communityId);
    if (comm && comm.banned_members && comm.banned_members.includes(identity.pubkey)) {
      throw new Error("You are banned from sending messages in this community.");
    }

    const roomId = `comm_${communityId}`;
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = Date.now();
    const sigMsg = formatChatMessageSignatureMessage(id, roomId, identity.pubkey, "community", text, timestamp);
    const sig = await identity.sign(sigMsg);

    const message: ChatMessage = {
      id,
      room_id: roomId,
      sender: identity.pubkey,
      community_id: communityId,
      text,
      timestamp,
      sig,
    };

    const roomKey = `freenet_chat_${roomId}`;
    const raw = localStorage.getItem(roomKey);
    const messages: ChatMessage[] = raw ? JSON.parse(raw) : [];
    messages.push(message);
    localStorage.setItem(roomKey, JSON.stringify(messages));

    this.broadcast({ type: "chat", message });
    return message;
  }

  public async getCommunityChatMessages(communityId: string): Promise<ChatMessage[]> {
    const roomId = `comm_${communityId}`;
    const roomKey = `freenet_chat_${roomId}`;
    const raw = localStorage.getItem(roomKey);
    return raw ? JSON.parse(raw) : [];
  }

  public async deleteChatMessage(roomId: string, messageId: string): Promise<void> {
    const roomKey = `freenet_chat_${roomId}`;
    const raw = localStorage.getItem(roomKey);
    if (raw) {
      const messages: ChatMessage[] = JSON.parse(raw);
      const filtered = messages.filter((m) => m.id !== messageId);
      localStorage.setItem(roomKey, JSON.stringify(filtered));
    }
    this.broadcast({ type: "chat_delete", roomId, messageId });
    this.notifyListeners();
  }

  public async clearChatRoom(roomId: string): Promise<void> {
    const roomKey = `freenet_chat_${roomId}`;
    localStorage.setItem(roomKey, JSON.stringify([]));
    this.broadcast({ type: "chat_clear", roomId });
    this.notifyListeners();
  }

  public removeChatPeer(myPubkey: string, peerPubkey: string): void {
    const key = `freenet_chat_peers_${myPubkey}`;
    const raw = localStorage.getItem(key);
    let list: string[] = raw ? JSON.parse(raw) : [];
    list = list.filter((p) => p !== peerPubkey);
    localStorage.setItem(key, JSON.stringify(list));
    this.notifyListeners();
  }

  private addChatPeer(ownerPubkey: string, peerPubkey: string): void {
    if (!ownerPubkey || !peerPubkey || peerPubkey === "community") return;
    const key = `freenet_chat_peers_${ownerPubkey}`;
    const raw = localStorage.getItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(peerPubkey)) {
      list.push(peerPubkey);
      localStorage.setItem(key, JSON.stringify(list));
    }
  }

  // ---- Notifications / Activity Feed ----

  public async getNotifications(identity: UserIdentity): Promise<NotificationItem[]> {
    const key = `freenet_notifs_${identity.pubkey}`;
    const raw = localStorage.getItem(key);
    const list: NotificationItem[] = raw ? JSON.parse(raw) : [];
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  public async addNotification(
    recipientPubkey: string,
    notif: Omit<NotificationItem, "id" | "timestamp" | "read">
  ): Promise<void> {
    const key = `freenet_notifs_${recipientPubkey}`;
    const raw = localStorage.getItem(key);
    const list: NotificationItem[] = raw ? JSON.parse(raw) : [];
    list.unshift({
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
      read: false,
    });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50))); // Keep latest 50
  }

  public async markNotificationsAsRead(identity: UserIdentity): Promise<void> {
    const key = `freenet_notifs_${identity.pubkey}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const list: NotificationItem[] = JSON.parse(raw);
    for (const item of list) {
      item.read = true;
    }
    localStorage.setItem(key, JSON.stringify(list));
  }

  // ---- Decentralized Communities & Moderation ----

  public async getCommunities(): Promise<Community[]> {
    const raw = localStorage.getItem("freenet_communities");
    let list: Community[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }
    list = list.map((c) => {
      if (c.id === "c_spruce") {
        return { ...c, id: "c_radica", name: "Radica Hub", slug: "radica" };
      }
      return c;
    });
    if (list.length === 0) {
      list = [
        {
          id: "c_radica",
          name: "Radica Hub",
          slug: "radica",
          description: "Decentralized social commons, Freenet dApps, and network updates.",
          created_at: 1710000000000,
          creator: "system",
          moderators: ["system"],
          members: ["system"],
          deleted_post_ids: [],
          sig: "genesis",
        },
        {
          id: "c_tech",
          name: "Tech & P2P",
          slug: "tech",
          description: "Peer-to-peer protocols, cryptography, and Web3 decentralization.",
          created_at: 1710000000000,
          creator: "system",
          moderators: ["system"],
          members: ["system"],
          deleted_post_ids: [],
          sig: "genesis",
        },
      ];
      localStorage.setItem("freenet_communities", JSON.stringify(list));
    }
    return list;
  }

  public async getCommunity(idOrSlug: string): Promise<Community | null> {
    const communities = await this.getCommunities();
    const query = idOrSlug.toLowerCase().replace(/^r\//, "");
    return (
      communities.find((c) => c.id.toLowerCase() === query || c.slug.toLowerCase() === query) || null
    );
  }

  public async saveCommunity(comm: Community): Promise<void> {
    const list = await this.getCommunities();
    const index = list.findIndex((c) => c.id === comm.id);
    if (index >= 0) {
      list[index] = comm;
    } else {
      list.push(comm);
    }
    localStorage.setItem("freenet_communities", JSON.stringify(list));

    // Broadcast community to peer tabs and dev server
    this.broadcast({ type: "community", community: comm });

    if (this.isConnected && this.ws) {
      try {
        this.ws.send(
          JSON.stringify({
            type: "update",
            contract: comm.id,
            delta: JSON.stringify(comm),
          })
        );
      } catch (e) {
        console.error("[Freenet] Error broadcasting community state:", e);
      }
    }
  }

  public async createCommunity(
    identity: UserIdentity,
    name: string,
    rawSlug: string,
    description: string,
    avatarUrl?: string
  ): Promise<Community> {
    const slug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const id = `c_${slug}`;
    const createdAt = Date.now();
    const sigMsg = formatCommunitySignatureMessage(id, slug, name, identity.pubkey, createdAt);
    const sig = await identity.sign(sigMsg);

    const comm: Community = {
      id,
      name: name.trim(),
      slug,
      description: description.trim(),
      avatar_url: avatarUrl,
      created_at: createdAt,
      creator: identity.pubkey,
      moderators: [identity.pubkey], // Creator is the first moderator
      members: [identity.pubkey],
      deleted_post_ids: [],
      sig,
    };

    await this.saveCommunity(comm);
    return comm;
  }

  public async toggleJoinCommunity(identity: UserIdentity, communityId: string): Promise<boolean> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return false;

    const idx = comm.members.indexOf(identity.pubkey);
    let joined = false;
    if (idx >= 0) {
      comm.members.splice(idx, 1);
      joined = false;
    } else {
      comm.members.push(identity.pubkey);
      joined = true;
    }
    await this.saveCommunity(comm);
    return joined;
  }

  public async addCommunityModerator(
    identity: UserIdentity,
    communityId: string,
    modPubkey: string
  ): Promise<{ success: boolean; msg: string }> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return { success: false, msg: "Community not found" };

    const isAuthorized =
      identity.pubkey === comm.creator || comm.moderators.includes(identity.pubkey);
    if (!isAuthorized) {
      return { success: false, msg: "Only moderators or owner can promote users." };
    }

    if (!comm.moderators.includes(modPubkey)) {
      comm.moderators.push(modPubkey);
      await this.saveCommunity(comm);
      return { success: true, msg: "User promoted to moderator." };
    }
    return { success: false, msg: "User is already a moderator." };
  }

  public async removeCommunityModerator(
    identity: UserIdentity,
    communityId: string,
    modPubkey: string
  ): Promise<{ success: boolean; msg: string }> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return { success: false, msg: "Community not found" };

    if (modPubkey === comm.creator) {
      return { success: false, msg: "The community creator/owner cannot be demoted!" };
    }

    const isOwner = identity.pubkey === comm.creator;
    const isSelf = identity.pubkey === modPubkey;
    if (!isOwner && !isSelf) {
      return { success: false, msg: "Only the community creator can demote moderators." };
    }

    comm.moderators = comm.moderators.filter((m) => m !== modPubkey);
    await this.saveCommunity(comm);
    return { success: true, msg: "Moderator removed." };
  }

  public async banMemberFromCommunity(
    identity: UserIdentity,
    communityId: string,
    targetPubkey: string
  ): Promise<{ success: boolean; msg: string; community?: Community }> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return { success: false, msg: "Community not found" };

    const isAuthorized =
      identity.pubkey === comm.creator || comm.moderators.includes(identity.pubkey);
    if (!isAuthorized) {
      return { success: false, msg: "Only moderators or owner can ban members." };
    }

    if (targetPubkey === comm.creator) {
      return { success: false, msg: "The community creator/owner cannot be banned!" };
    }

    if (!comm.banned_members) {
      comm.banned_members = [];
    }

    if (!comm.banned_members.includes(targetPubkey)) {
      comm.banned_members.push(targetPubkey);
    }

    comm.members = comm.members.filter((m) => m !== targetPubkey);
    comm.moderators = comm.moderators.filter((m) => m !== targetPubkey);

    await this.saveCommunity(comm);
    this.broadcast({ type: "community_ban", communityId, banned: targetPubkey, community: comm });
    this.notifyListeners();
    return { success: true, msg: "User banned from community.", community: comm };
  }

  public async unbanMemberFromCommunity(
    identity: UserIdentity,
    communityId: string,
    targetPubkey: string
  ): Promise<{ success: boolean; msg: string; community?: Community }> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return { success: false, msg: "Community not found" };

    const isAuthorized =
      identity.pubkey === comm.creator || comm.moderators.includes(identity.pubkey);
    if (!isAuthorized) {
      return { success: false, msg: "Only moderators or owner can unban members." };
    }

    if (comm.banned_members) {
      comm.banned_members = comm.banned_members.filter((m) => m !== targetPubkey);
    }

    if (!comm.members.includes(targetPubkey)) {
      comm.members.push(targetPubkey);
    }

    await this.saveCommunity(comm);
    this.broadcast({ type: "community_unban", communityId, unbanned: targetPubkey, community: comm });
    this.notifyListeners();
    return { success: true, msg: "User unbanned.", community: comm };
  }

  public async modDeletePost(
    identity: UserIdentity,
    communityId: string,
    postId: string,
    postAuthor: string
  ): Promise<{ success: boolean; msg: string }> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return { success: false, msg: "Community not found" };

    const isModerator =
      identity.pubkey === comm.creator || comm.moderators.includes(identity.pubkey);
    if (!isModerator && identity.pubkey !== postAuthor) {
      return { success: false, msg: "You do not have moderation rights in this community." };
    }

    if (!comm.deleted_post_ids.includes(postId)) {
      comm.deleted_post_ids.push(postId);
      await this.saveCommunity(comm);
    }

    // Also remove from author local feed if local user
    if (identity.pubkey === postAuthor) {
      await this.deletePost(identity, postId);
    }

    return { success: true, msg: "Post removed from community by moderator." };
  }

  public async getCommunityFeed(communityId: string, identity: UserIdentity): Promise<Post[]> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return [];

    const timeline = await this.getTimeline(identity);
    return timeline.filter(
      (p) =>
        (p.community_id === comm.id || p.community_id === comm.slug) &&
        !comm.deleted_post_ids.includes(p.id)
    );
  }

  // -------------------------------------------------------------
  // E2EE Private Rooms
  // -------------------------------------------------------------

  public mergeRemotePrivateRooms(incoming: PrivateRoom[]): void {
    const raw = localStorage.getItem("freenet_private_rooms");
    const list: PrivateRoom[] = raw ? JSON.parse(raw) : [];
    let changed = false;
    for (const room of incoming) {
      if (!room || !room.id) continue;
      const idx = list.findIndex((r) => r.id === room.id);
      if (idx >= 0) {
        const existing = list[idx];
        const mergedMembers = Array.from(new Set([...(existing.members || []), ...(room.members || [])]));
        const mergedKeys = { ...(existing.encrypted_keys || {}), ...(room.encrypted_keys || {}) };
        list[idx] = {
          ...existing,
          ...room,
          members: mergedMembers,
          encrypted_keys: mergedKeys,
        };
        changed = true;
      } else {
        list.push(room);
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem("freenet_private_rooms", JSON.stringify(list));
    }
  }

  public async createPrivateRoom(
    identity: UserIdentity,
    name: string,
    memberPubkeys: string[]
  ): Promise<PrivateRoom> {
    const roomId = `privroom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = Date.now();
    const roomKey = generateRoomKey();

    // 1. Encrypt room name with the symmetric room key
    const name_encrypted = await encryptWithSymmetricKey(roomKey, name);

    // 2. Ensure creator is in members list
    const allMembers = Array.from(new Set([identity.pubkey, ...memberPubkeys.filter(Boolean)]));

    // 3. Encrypt room key for each member using X25519 ECDH
    const encrypted_keys: Record<string, string> = {};
    for (const member of allMembers) {
      try {
        const encKey = await encryptRoomKeyForPeer(identity.secretKey, member, roomKey);
        encrypted_keys[member] = encKey;
      } catch (err) {
        console.warn(`Could not encrypt room key for member ${member}:`, err);
      }
    }

    // 4. Sign the private room descriptor
    const sigMsg = formatPrivateRoomSignatureMessage(roomId, identity.pubkey, createdAt);
    const sig = await identity.sign(sigMsg);

    const room: PrivateRoom = {
      id: roomId,
      creator: identity.pubkey,
      name_encrypted,
      members: allMembers,
      encrypted_keys,
      created_at: createdAt,
      sig,
    };

    // Cache the decrypted room key locally
    this.privateRoomKeyCache.set(roomId, roomKey);

    // Persist room locally
    this.mergeRemotePrivateRooms([room]);

    // Broadcast room descriptor over P2P sync
    this.broadcast({ type: "private_room", room });

    // Send notifications to invited members
    for (const member of allMembers) {
      if (member !== identity.pubkey) {
        this.addNotification(member, {
          type: "chat",
          from: identity.pubkey,
          text: `invited you to an encrypted Private Room 🔒`,
        });
      }
    }

    this.notifyListeners();
    return room;
  }

  public async getPrivateRooms(identity: UserIdentity): Promise<PrivateRoom[]> {
    const raw = localStorage.getItem("freenet_private_rooms");
    const list: PrivateRoom[] = raw ? JSON.parse(raw) : [];
    // Only return rooms where current identity is an authorized member
    return list.filter((r) => r.members && r.members.includes(identity.pubkey));
  }

  public async getPrivateRoomKey(
    identity: UserIdentity,
    room: PrivateRoom
  ): Promise<Uint8Array | null> {
    const cached = this.privateRoomKeyCache.get(room.id);
    if (cached) return cached;

    const myEncryptedKey = room.encrypted_keys ? room.encrypted_keys[identity.pubkey] : undefined;
    if (!myEncryptedKey) return null;

    // Decrypt key from creator
    const key = await decryptRoomKeyFromPeer(identity.secretKey, room.creator, myEncryptedKey);
    if (key) {
      this.privateRoomKeyCache.set(room.id, key);
      return key;
    }
    return null;
  }

  public async getPrivateRoomDecryptedName(
    identity: UserIdentity,
    room: PrivateRoom
  ): Promise<string> {
    try {
      const key = await this.getPrivateRoomKey(identity, room);
      if (key && room.name_encrypted) {
        const decrypted = await decryptWithSymmetricKey(key, room.name_encrypted);
        if (!decrypted.startsWith("[Encrypted")) {
          return decrypted;
        }
      }
    } catch (e) {
      console.warn("Failed to decrypt private room name:", e);
    }
    return `Private Room (${room.id.slice(9, 15)})`;
  }

  public async inviteMemberToPrivateRoom(
    identity: UserIdentity,
    roomId: string,
    newMemberPubkey: string
  ): Promise<PrivateRoom> {
    const rooms = await this.getPrivateRooms(identity);
    const room = rooms.find((r) => r.id === roomId);
    if (!room) throw new Error("Private room not found or unauthorized");

    const roomKey = await this.getPrivateRoomKey(identity, room);
    if (!roomKey) throw new Error("Cannot decrypt room key to invite peer");

    const encKey = await encryptRoomKeyForPeer(identity.secretKey, newMemberPubkey, roomKey);
    room.encrypted_keys[newMemberPubkey] = encKey;
    if (!room.members.includes(newMemberPubkey)) {
      room.members.push(newMemberPubkey);
    }

    this.mergeRemotePrivateRooms([room]);
    this.broadcast({ type: "private_room", room });

    this.addNotification(newMemberPubkey, {
      type: "chat",
      from: identity.pubkey,
      text: `invited you to an encrypted Private Room 🔒`,
    });

    this.notifyListeners();
    return room;
  }

  public async kickMemberFromPrivateRoom(
    identity: UserIdentity,
    roomId: string,
    targetPubkey: string
  ): Promise<PrivateRoom> {
    const rooms = await this.getPrivateRooms(identity);
    const room = rooms.find((r) => r.id === roomId);
    if (!room) throw new Error("Private room not found or unauthorized");

    if (room.creator !== identity.pubkey) {
      throw new Error("Only the room creator can kick members");
    }

    if (targetPubkey === room.creator) {
      throw new Error("The room creator cannot be kicked");
    }

    // 1. Remove from members list
    room.members = room.members.filter((m) => m !== targetPubkey);

    // 2. Remove encrypted key for target
    if (room.encrypted_keys) {
      delete room.encrypted_keys[targetPubkey];
    }

    // 3. Key rotation for forward secrecy: generate a new symmetric key for the room
    try {
      const newRoomKey = generateRoomKey();
      const currentName = await this.getPrivateRoomDecryptedName(identity, room);
      room.name_encrypted = await encryptWithSymmetricKey(newRoomKey, currentName);
      this.privateRoomKeyCache.set(room.id, newRoomKey);

      // Re-encrypt new key for all remaining members
      const updatedKeys: Record<string, string> = {};
      for (const m of room.members) {
        try {
          const encKey = await encryptRoomKeyForPeer(identity.secretKey, m, newRoomKey);
          updatedKeys[m] = encKey;
        } catch (e) {
          console.warn(`Could not re-encrypt key for member ${m}:`, e);
        }
      }
      room.encrypted_keys = updatedKeys;
    } catch (err) {
      console.warn("Key rotation warning upon kick:", err);
    }

    this.mergeRemotePrivateRooms([room]);
    this.broadcast({ type: "private_room_kick", roomId, kicked: targetPubkey, room });
    this.notifyListeners();
    return room;
  }

  public getPrivateRoomInviteLink(room: PrivateRoom, roomKey: Uint8Array, roomName: string): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
    const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
    const keyHex = bytesToHex(roomKey);
    const params = new URLSearchParams({
      join_room: room.id,
      name: roomName,
      key: keyHex,
      creator: room.creator,
    });
    return `${origin}${pathname}#${params.toString()}`;
  }

  public async joinPrivateRoomFromInvite(
    identity: UserIdentity,
    inviteData: { roomId: string; name: string; keyHex: string; creator: string }
  ): Promise<PrivateRoom> {
    const { roomId, name, keyHex, creator } = inviteData;
    const roomKey = hexToBytes(keyHex);
    if (roomKey.length !== 32) {
      throw new Error("Invalid room key in invite link");
    }

    // Cache the decrypted room key locally
    this.privateRoomKeyCache.set(roomId, roomKey);

    // Encrypt room key for self so it persists across sessions
    const encKeyForSelf = await encryptRoomKeyForPeer(identity.secretKey, identity.pubkey, roomKey);

    const existingRooms = await this.getPrivateRooms(identity);
    let room = existingRooms.find((r) => r.id === roomId);

    if (room) {
      if (!room.members.includes(identity.pubkey)) {
        room.members.push(identity.pubkey);
      }
      if (!room.encrypted_keys) room.encrypted_keys = {};
      room.encrypted_keys[identity.pubkey] = encKeyForSelf;
    } else {
      const name_encrypted = await encryptWithSymmetricKey(roomKey, name);
      room = {
        id: roomId,
        creator: creator || identity.pubkey,
        name_encrypted,
        members: creator && creator !== identity.pubkey ? [creator, identity.pubkey] : [identity.pubkey],
        encrypted_keys: {
          [identity.pubkey]: encKeyForSelf,
        },
        created_at: Date.now(),
        sig: "invite_join",
      };
    }

    this.mergeRemotePrivateRooms([room]);
    this.broadcast({ type: "private_room", room });
    this.notifyListeners();
    return room;
  }

  public async sendPrivateRoomChatMessage(
    identity: UserIdentity,
    room: PrivateRoom,
    text: string
  ): Promise<ChatMessage> {
    const roomKey = await this.getPrivateRoomKey(identity, room);
    if (!roomKey) throw new Error("Unauthorized: no room key found to encrypt message");

    const encryptedText = await encryptWithSymmetricKey(roomKey, text);
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = Date.now();
    const sigMsg = formatChatMessageSignatureMessage(id, room.id, identity.pubkey, "privateroom", text, timestamp);
    const sig = await identity.sign(sigMsg);

    const message: ChatMessage = {
      id,
      room_id: room.id,
      private_room_id: room.id,
      sender: identity.pubkey,
      text: encryptedText,
      timestamp,
      sig,
    };

    const storageKey = `freenet_chat_${room.id}`;
    const raw = localStorage.getItem(storageKey);
    const messages: ChatMessage[] = raw ? JSON.parse(raw) : [];
    messages.push(message);
    localStorage.setItem(storageKey, JSON.stringify(messages));

    this.broadcast({ type: "chat", message });

    // Send notifications to all other room members
    for (const member of room.members) {
      if (member !== identity.pubkey) {
        this.addNotification(member, {
          type: "chat",
          from: identity.pubkey,
          text: "sent a message in an encrypted Private Room 🔒",
        });
      }
    }

    return {
      ...message,
      text, // Return decrypted for caller
    };
  }

  public async getPrivateRoomChatMessages(
    identity: UserIdentity,
    room: PrivateRoom
  ): Promise<ChatMessage[]> {
    const storageKey = `freenet_chat_${room.id}`;
    const raw = localStorage.getItem(storageKey);
    const messages: ChatMessage[] = raw ? JSON.parse(raw) : [];

    const roomKey = await this.getPrivateRoomKey(identity, room);
    if (!roomKey) return messages;

    const decryptedList = await Promise.all(
      messages.map(async (msg) => {
        if (msg.text && msg.text.startsWith("sym:")) {
          const plain = await decryptWithSymmetricKey(roomKey, msg.text);
          return { ...msg, text: plain };
        }
        return msg;
      })
    );
    return decryptedList;
  }
}

export const freenet = new FreenetClient();
