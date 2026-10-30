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
  verifySignature,
  formatLogEntryMessage,
  formatChatMessageSignatureMessage,
  formatCommunitySignatureMessage,
  formatModActionSignatureMessage,
  formatPrivateRoomSignatureMessage,
  encryptDirectMessage,
  decryptDirectMessage,
  addReadKeys,
  readEncPubs,
  generateRoomKey,
  encryptWithSymmetricKey,
  decryptWithSymmetricKey,
  encryptRoomKeyForPeer,
  decryptRoomKeyFromPeer,
  bytesToHex,
  hexToBytes,
  personaName,
} from "./crypto.ts";
import { safeStorage } from "./storage.ts";
import { FreenetNetwork } from "./network.ts";
import { foldBlocklist, foldReports, foldChat, foldChatHides, foldChatRead, foldCommunities, foldRoom, hasLeftRoom, keepNewest, type LogEntry } from "./logfold.ts";
import { overlayFeed } from "./feedmerge.ts";
import { shouldFetch, LIVE_RECHECK_MS, REFRESH_EVERY_MS, type Change } from "./refresh.ts";
import { river } from "./river.ts";
import { lightFeedAsync, type LightFeed } from "./feedlight.ts";
import { parseSite, resolveSiteCode, siteKey, type DeltaSite } from "./delta.ts";
import { MEDIA_PREFIX, dataUrlBytes, keepMedia } from "./media.ts";
import { mentionsIn, plainMentions } from "./caption.ts";
import { yieldToMain } from "./limit.ts";
import { knownAnchor, resolveRoomContract } from "./riverPointer.ts";
import { RiverRooms, roomOwnerSk, vkOf, type RiverJoin } from "./riverRooms.ts";

const localStorage = safeStorage;


const GENESIS: Community[] = [
  {
    id: "c_radica",
    name: "Radica Hub",
    slug: "radica",
    description: "Decentralized social commons, Freenet dApps, and network updates.",
    created_at: 1710000000000,
    creator: "system",
    moderators: ["system"],
    members: [],
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
    members: [],
    deleted_post_ids: [],
    sig: "genesis",
  },
];

export class FreenetClient {
  private isConnected = false;
  public connectError = "";
  private net = new FreenetNetwork((id, change) =>
    void (id.startsWith("feed:") ? this.feedChanged(id.slice(5), change ?? {}) : id.startsWith("river:") ? this.rivers().then((r) => (r.changed(id.slice(6)), this.notifyListeners())) : this.logChanged(id.slice(4), change ?? {}))
  );
  private riverP?: Promise<RiverRooms>;
  /** Private rooms on River's contract, loaded on first use (river.wasm and River's pointer). */
  private rivers(): Promise<RiverRooms> {
    return (this.riverP ??= river().then((call) => {
      // never wait on the network for the pointer: start from what this install knows, and resolve it once per session behind
      let anchor = knownAnchor();
      void resolveRoomContract((k) => this.net.getRaw(k), call).then((a) => (anchor = a));
      const code = () => import("./river_room_contract.wasm?url").then(({ default: url }) => fetch(url)).then(async (r) => new Uint8Array(await r.arrayBuffer()));
      return new RiverRooms(call, this.net, async () => anchor, code);
    }));
  }
  private identity: UserIdentity | null = null;
  private lastRefresh = new Map<string, number>();
  private unsentLogs = new Set<string>(); // logs where a send failed: the next refresh sends the entries again
  private me = "";
  private pending = new Map<string, FeedState[]>(); // per feed: changes the network has not accepted yet
  private bc: BroadcastChannel | null = null;
  private listeners: (() => void)[] = [];
  public peerCache: Record<string, Post> = {};
  public knownPeers: Record<string, { display_name: string; avatar_url?: string }> = {};
  private privateRoomKeyCache: Map<string, Uint8Array> = new Map();

  constructor() {
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
      profile: profile ? { display_name: profile.display_name } : { display_name: `Persona @${personaName(identity.pubkey).substring(0, 6)}` },
    };
    this.knownPeers[identity.pubkey] = data.profile;
    this.broadcast(data);

    // the network-wide phone book: BroadcastChannel only reaches tabs of this browser
    const last = this.logEntries("directory").filter((e) => e.author === identity.pubkey).sort((a, b) => b.ts - a.ts)[0];
    let lastName = "";
    try {
      lastName = JSON.parse(last?.body ?? "{}").display_name;
    } catch {}
    // no profile yet (my feed may not have arrived): a default-name hello would overwrite my real name for everyone
    if (profile && (!last || lastName !== data.profile.display_name || Date.now() - last.ts > 7 * 864e5))
      await this.logAppend("directory", { type: "hello", display_name: data.profile.display_name }).catch((e) => console.warn("[Freenet] directory:", e));

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
          members: [],
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
          members: [],
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
          this.knownPeers[p.author] = { display_name: `Persona @${personaName(p.author).substring(0, 6)}` };
        }
      }
      this.notifyListeners();
    } else if (data.type === "hello" && data.pubkey) {
      this.knownPeers[data.pubkey] = data.profile ? { ...this.knownPeers[data.pubkey], ...data.profile } : { display_name: `Persona @${personaName(data.pubkey).substring(0, 6)}` };
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
        if (msg.recipient === this.me) // local tabs only: notifications to others travel through their inbox
          this.storeNotification(msg.recipient, {
            id: `n_${msg.id}`,
            type: "chat",
            from: msg.sender,
            text: notifText,
            timestamp: msg.timestamp,
            read: false,
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

  // coalesce bursts (every refresh fires one) into a single pass of the heavy UI listeners,
  // and keep passes 2 s apart while feeds trickle in: each one redraws the feed and the open chat
  private notifyTimer: ReturnType<typeof setTimeout> | undefined;
  private lastNotify = 0;
  private notifyListeners() {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = undefined;
      this.lastNotify = Date.now();
      for (const fn of this.listeners) {
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      }
    }, Math.max(150, 2000 - (Date.now() - this.lastNotify)));
  }

  public async connect(): Promise<boolean> {
    try {
      await this.net.connect();
      this.isConnected = true;
      void this.refreshLog("directory", true); // learn who else is on the network, and publish my own entry
    } catch (err) {
      console.warn("[Freenet] Could not connect to the Freenet node, using local storage only:", err);
      this.isConnected = false;
      this.connectError = String((err as Error)?.message ?? err);
    }
    return this.isConnected;
  }

  /** Fetch a feed from the network into the local cache (at most once a minute unless `force`). */
  /** True while the chat is on screen: feeds (posts, follows) are not fetched then; chat logs and the profiles chat shows still are. */
  public feedsPaused = false;

  public async refresh(owner: string, force = false, urgent = false): Promise<void> {
    if (!this.isConnected) return;
    if (this.feedsPaused && !force && !urgent) return;
    const last = this.lastRefresh.get(owner) ?? 0;
    const unsent = (this.pending.get(owner)?.length ?? 0) > 0;
    if (!shouldFetch({ force, sinceLast: Date.now() - last, liveAge: this.net.liveAge(`feed:${owner}`), unsent })) return;
    this.lastRefresh.set(owner, Date.now());
    try {
      await this.pushPending(owner);
      const text = await this.net.getText(`feed:${owner}`);
      if (text !== null) await this.takeFeed(owner, text);
    } catch (e) {
      console.warn("[Freenet] Could not fetch feed", owner, e);
    }
  }

  /** A followed feed changed on the network: take the state or the delta the node sent instead of fetching it again. */
  private async feedChanged(owner: string, c: Change): Promise<void> {
    // my own feed and one with unsent changes are fetched whole: unsent changes go on top of the full state, and a delta
    // carries no follow certificate
    if (owner !== this.me && !this.pending.get(owner)?.length) {
      try {
        const stored = localStorage.getItem(`freenet_feed_${owner}`);
        const light = c.state ? undefined : c.delta && stored ? await lightFeedAsync(stored, c.delta) : null;
        const text = c.state ?? light?.text;
        if (text !== undefined) {
          this.lastRefresh.set(owner, Date.now());
          return await this.takeFeed(owner, text, light ?? undefined);
        }
      } catch (e) {
        console.warn("[Freenet] Could not apply the change of feed", owner, e);
      }
    }
    return this.refresh(owner, true);
  }

  /** Store a feed's text and update names and listeners. `light`: the feed already parsed in the worker. */
  private async takeFeed(owner: string, text: string, light?: LightFeed): Promise<void> {
    await yieldToMain(); // each fetched feed is handled in its own task, so clicks are not queued behind a burst of them
    const pend = this.pending.get(owner) ?? [];
    let json = text;
    let profile: ProfileInfo | undefined;
    if (pend.length || owner === this.me) {
      // my own feed (or one with unsent changes): the page reads it whole, parse it here
      const feed: FeedState = JSON.parse(text);
      for (const d of pend) overlayFeed(feed, d); // keep what the network has not taken yet
      this.postTotals.set(owner, Object.keys(feed.posts ?? {}).length);
      json = JSON.stringify(feed);
      this.feedCache.set(`freenet_feed_${owner}`, { raw: json, feed });
      profile = feed.profile;
    } else {
      // another person's feed: stored as it came, parsed in the worker (that also readies it for the timeline)
      const l = light ?? (await lightFeedAsync(text));
      this.peerPostsCache.set(owner, { raw: text, posts: l.posts });
      this.peerFollowing.set(owner, l.following ?? []);
      this.postTotals.set(owner, l.total ?? l.posts.length);
      profile = l.profile;
    }
    const same = localStorage.getItem(`freenet_feed_${owner}`) === json;
    if (!same) localStorage.setItem(`freenet_feed_${owner}`, json);
    if (profile) this.knownPeers[owner] = { display_name: profile.display_name, avatar_url: profile.avatar_url }; // names and avatars of other people
    if (!same) this.notifyListeners(); // unchanged feed: no redraw of chat and posts
  }

  /** Publish my local feed (merged with what the network has), then take the merged result. */
  private readKeysReady: Promise<void> = Promise.resolve();

  /** The persona that signs log entries (messages, community actions). Call once at startup. */
  public setIdentity(identity: UserIdentity): void {
    this.identity = identity;
    this.me = identity.pubkey;
    // keys this device used before Viso's shared one: load first so DMs and room keys never decrypt before they arrive
    addReadKeys(JSON.parse(localStorage.getItem("radica_read_keys") || "[]"));
    this.readKeysReady = import("./delegate.ts").then(async (m) => {
      const fromNode: string[] = JSON.parse((await m.nodeGet("read-keys")) || "[]");
      if (!fromNode.length) return;
      addReadKeys(fromNode);
      const merged = [...new Set([...JSON.parse(localStorage.getItem("radica_read_keys") || "[]"), ...fromNode])];
      localStorage.setItem("radica_read_keys", JSON.stringify(merged));
      this.plainCache.clear();
      this.notifyListeners();
    }, () => {});
    void this.restoreRoomsFromNode();
    this.riverOnlyReady = this.restoreRiverOnly();
    this.joinedReady = this.restoreJoined();
    // communities I created before they lived on the network: publish them once
    const legacy: Community[] = JSON.parse(localStorage.getItem("freenet_communities") || "[]");
    const known = new Set(this.foldedCommunities().map((c) => c.id));
    for (const c of legacy) {
      if (c.creator === identity.pubkey && !known.has(c.id))
        void this.logAppend("communities", { type: "community_create", community: { id: c.id, name: c.name, description: c.description, avatar_url: c.avatar_url } });
    }
  }

  public async syncOwnFeed(identity: UserIdentity): Promise<void> {
    this.setIdentity(identity);
    void this.announceDevice(identity).catch((e) => console.warn("[Freenet] Could not publish this device's key:", e));
    await this.migrateOwnFeed(identity);
    const feed = await this.getFeed(identity.pubkey);
    // a new app key (Viso's shared one): the profile must name it, since that is the key people encrypt to
    if (feed.profile && feed.profile.enc_pub !== identity.encPub) {
      const pr = { ...feed.profile, enc_pub: identity.encPub, cert: identity.cert, updated_at: Date.now() };
      pr.sig = await identity.sign(formatProfileSignatureMessage(identity.pubkey, pr.display_name, pr.bio, pr.avatar_url, pr.enc_pub, pr.updated_at));
      feed.profile = pr;
    }
    await this.saveFeed(feed);
  }

  /** One time: re-sign my feed in the v2 format the contract checks; drop what cannot be re-signed. */
  private async migrateOwnFeed(identity: UserIdentity): Promise<void> {
    const marker = `radica_feed_v3_${identity.pubkey}`; // v3: profile signs its encryption key; Viso delegations
    if (localStorage.getItem(marker)) return;
    const me = identity.pubkey;
    const feed = await this.getFeed(me);
    const posts: Record<string, Post> = {};
    for (const p of Object.values(feed.posts)) {
      if (p.author !== me) continue;
      const comments: Record<string, Comment> = {};
      for (const c of Object.values(p.comments || {})) {
        const msg = formatCommentSignatureMessage(c.id, c.post_id, c.author, c.text, c.timestamp);
        if (c.post_id === p.id && (await verifySignature(msg, c.sig, c.author))) comments[`${c.author}:${c.id}`] = c;
      }
      const post: Post = { ...p, is_nsfw: !!p.is_nsfw, comments, likes: Array.isArray(p.likes) ? {} : p.likes || {} };
      post.cert = identity.cert;
      post.sig = await identity.sign(formatPostSignatureMessage(post));
      posts[p.id] = post;
    }
    feed.posts = posts;
    if (feed.profile) {
      const pr = feed.profile;
      pr.enc_pub = identity.encPub;
      pr.cert = identity.cert;
      pr.sig = await identity.sign(formatProfileSignatureMessage(me, pr.display_name, pr.bio, pr.avatar_url, pr.enc_pub, pr.updated_at));
    }
    if (feed.following.length) {
      feed.following_updated_at = Date.now();
      feed.following_cert = identity.cert;
      feed.following_sig = await identity.sign(formatFollowingSignatureMessage(me, feed.following_updated_at, feed.following));
    }
    const deleted: FeedState["deleted"] = {};
    for (const id of Object.keys(feed.deleted || {}))
      deleted[id] = { sig: await identity.sign(formatDeleteSignatureMessage(me, id)), cert: identity.cert };
    feed.deleted = deleted;
    localStorage.setItem(`freenet_feed_${me}`, JSON.stringify(feed));
    localStorage.setItem(marker, "1");
  }

  public get isNodeOnline(): boolean {
    return this.isConnected;
  }

  private feedCache = new Map<string, { raw: string; feed: FeedState }>();

  private peerPostsCache = new Map<string, { raw: string; posts: Post[] }>();

  /** The newest posts of another person's stored feed, parsed off the main thread (the timeline never needs the rest). */
  private async peerPosts(pubkey: string): Promise<Post[]> {
    const raw = localStorage.getItem(`freenet_feed_${pubkey}`);
    void this.refresh(pubkey);
    if (!raw) return [];
    const hit = this.peerPostsCache.get(pubkey);
    if (hit?.raw === raw) return hit.posts;
    const { posts, total, following } = await lightFeedAsync(raw);
    this.peerPostsCache.set(pubkey, { raw, posts });
    this.peerFollowing.set(pubkey, following ?? []);
    this.postTotals.set(pubkey, total ?? posts.length);
    return posts;
  }

  /** Whom each other person follows, from their feeds read this session. */
  private peerFollowing = new Map<string, string[]>();

  /** People whose feed this node has read and who follow `pubkey`: only a part of them, never a count to show. */
  public followersOf(pubkey: string): string[] {
    return [...this.peerFollowing].filter(([k, f]) => k !== pubkey && f.includes(pubkey)).map(([k]) => k);
  }

  /** How many posts each feed this node has read holds (all of them, not only the newest the timeline shows). */
  private postTotals = new Map<string, number>();

  /** Another Freenet app's contract by its instance id, or null when the network does not have it. */
  public appContract(instance: string): Promise<Uint8Array | null> {
    return this.net.getByInstance(instance);
  }

  /** People's feeds this node keeps a copy of and passes changes on for, right now (its subscriptions). */
  public hostedFeeds(): number {
    return this.net.liveIds().filter((id) => id.startsWith("feed:")).length;
  }

  /** Posts in every feed this node has read this session. */
  public knownPostCount(): number {
    let n = 0;
    for (const v of this.postTotals.values()) n += v;
    return n;
  }

  // Load feed for a given owner pubkey
  public async getFeed(ownerPubkey: string): Promise<FeedState> {
    const key = `freenet_feed_${ownerPubkey}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        // reparsing a feed (up to 16 MB) on every call is the slow part of drawing the feed: reuse it while the stored text is unchanged
        let parsed: FeedState;
        const hit = this.feedCache.get(key);
        if (hit?.raw === raw) parsed = hit.feed;
        else {
          parsed = JSON.parse(raw);
          this.feedCache.set(key, { raw, feed: parsed });
          this.postTotals.set(ownerPubkey, Object.keys(parsed.posts ?? {}).length);
        }
        if (!parsed.profile) {
          const profRaw = localStorage.getItem(`radica_profile_${ownerPubkey}`);
          if (profRaw) {
            try {
              parsed.profile = JSON.parse(profRaw);
            } catch {}
          }
        }
        void this.refresh(ownerPubkey);
        return parsed;
      } catch {
        // pass
      }
    }
    void this.refresh(ownerPubkey);
    return {
      owner: ownerPubkey,
      posts: {},
      following: [],
    };
  }

  /** Save `feed` locally and send `delta` (what changed) to the network; kept and retried until the network takes it. */
  public async saveFeed(feed: FeedState, delta: FeedState = feed): Promise<void> {
    const key = `freenet_feed_${feed.owner}`;
    feed.posts = { ...feed.posts }; // ponytail: new ref triggers sizedPosts check without re-parsing JSON in getFeed
    const raw = JSON.stringify(feed);
    localStorage.setItem(key, raw);
    this.feedCache.set(key, { raw, feed });
    this.postTotals.set(feed.owner, Object.keys(feed.posts).length);
    if (!this.isConnected) return;
    this.pending.set(feed.owner, [...(this.pending.get(feed.owner) ?? []), delta]);
    void this.refresh(feed.owner, true); // in background: the change is already local and queued until the network takes it
  }

  // shortcut: a change the contract rejects for good is retried on every refresh of this session, then dropped on reload
  private async pushPending(owner: string): Promise<void> {
    for (const d of this.pending.get(owner) ?? []) {
      try {
        await this.net.push(`feed:${owner}`, d); // the contract merges it with what other peers sent
        this.pending.set(owner, (this.pending.get(owner) ?? []).filter((x) => x !== d));
      } catch (e) {
        console.warn("[Freenet] The network did not accept a change to feed", owner, e);
      }
    }
  }

  // ---- Logs (log-contract): inbox/<pubkey>, communities, community-chat/<id>, room/<id> ----

  // JSON kept in memory while its stored text is unchanged: re-parsing a log or chat on every call is what slows each sync pass.
  // Only for reads that never modify what they get back.
  private jsonCache = new Map<string, { raw: string; val: unknown }>();
  private readJson<T>(key: string, empty: string): T {
    const raw = localStorage.getItem(key) || empty;
    const hit = this.jsonCache.get(key);
    if (hit?.raw === raw) return hit.val as T;
    const val = JSON.parse(raw);
    this.jsonCache.set(key, { raw, val });
    return val as T;
  }

  private logEntries(name: string): LogEntry[] {
    try {
      return Object.values(this.readJson<Record<string, LogEntry>>(`freenet_log_${name}`, "{}"));
    } catch {
      return [];
    }
  }

  private communitiesFold?: { raw: string | null; list: Community[] };

  /** Communities folded from the log, recomputed only when the stored log changes (folding replays every entry, and this is read on each sync pass). */
  private foldedCommunities(): Community[] {
    const raw = localStorage.getItem("freenet_log_communities");
    if (this.communitiesFold?.raw !== raw) this.communitiesFold = { raw, list: foldCommunities(this.logEntries("communities"), GENESIS) };
    return this.communitiesFold.list;
  }

  private saveLog(name: string, entries: LogEntry[]): void {
    localStorage.setItem(`freenet_log_${name}`, JSON.stringify(Object.fromEntries(entries.map((e) => [`${e.author}:${e.id}`, e]))));
  }

  /** Sign `body` as a new entry of log `name`, apply it here and send it to the network. */
  private async logAppend(name: string, body: object): Promise<void> {
    const me = this.identity;
    if (!me) throw new Error("No identity to sign with");
    const e: LogEntry = { author: me.pubkey, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), ts: Date.now(), body: JSON.stringify(body), sig: "" };
    e.sig = await me.sign(formatLogEntryMessage(name, e.author, e.id, e.ts, e.body));
    if (me.cert) e.cert = me.cert;
    this.saveLog(name, [...this.logEntries(name), e]);
    this.applyLog(name);
    if (this.isConnected) void this.pushLog(name, [e]);
    else {
      this.unsentLogs.add(name); // offline: sent once the node is back
      this.retryUnsent(name);
    }
  }

  /** Publish (or withdraw) a block on my own blocklist; anyone who trusts my list then hides that author. */
  public setBlocked(target: string, on: boolean): Promise<void> {
    return this.logAppend(`blocklist/${this.me}`, { type: "block", target, on });
  }
  /** Report a post on my own blocklist: I and anyone who trusts my list stop seeing it. */
  public reportPost(author: string, postId: string, reason: string): Promise<void> {
    return this.logAppend(`blocklist/${this.me}`, { type: "report", target: `${author}:${postId}`, reason: reason.slice(0, 200) });
  }


  /** Name my Delta blog (its site prefix) on my profile, or none. */
  public setDeltaSite(prefix: string | null): Promise<void> {
    return this.logAppend(`delta/${this.me}`, { type: "site", prefix });
  }

  /** The Delta blog `pubkey` named, from their own newest entry, as last fetched (refreshLog(`delta/<pubkey>`) to update). */
  public deltaSiteOf(pubkey: string): string | null {
    const mine = this.logEntries(`delta/${pubkey}`).filter((e) => e.author === pubkey).sort((a, b) => b.ts - a.ts)[0];
    try {
      const prefix = mine && JSON.parse(mine.body).prefix;
      return typeof prefix === "string" ? prefix : null;
    } catch {
      return null;
    }
  }

  private siteCode?: Promise<string>;

  /** A Delta site read from the network (under the code hash Delta's pointer names), or null when it is not there. */
  private sites = new Map<string, Promise<DeltaSite | null>>();

  /** A Delta site, fetched once per session: a big site is megabytes and slow to come from the network. Null when it
   *  cannot be had right now (a failed fetch is tried again next time). */
  public deltaSite(prefix: string): Promise<DeltaSite | null> {
    let site = this.sites.get(prefix);
    if (!site) {
      site = (async () => {
        this.siteCode ??= resolveSiteCode((k) => this.net.getRaw(k));
        const raw = await this.net.getRaw(siteKey(await this.siteCode, prefix));
        return raw ? parseSite(raw) : null;
      })().catch((e) => {
        console.warn("[Delta] Could not fetch site", prefix, e);
        return null;
      });
      this.sites.set(prefix, site);
      void site.then((s) => s || this.sites.delete(prefix));
    }
    return site;
  }

  private blocklistFolds = new Map<string, { raw: string | null; set: Set<string> }>();
  private reportFolds = new Map<string, { raw: string | null; map: Map<string, string> }>();

  /** Posts (`<author>:<post id>`) that `curator` reported, with the reason, as last fetched. */
  public reportedBy(curator: string): Map<string, string> {
    const raw = localStorage.getItem(`freenet_log_blocklist/${curator}`);
    const hit = this.reportFolds.get(curator);
    if (hit?.raw === raw) return hit.map;
    const map = foldReports(this.logEntries(`blocklist/${curator}`), curator);
    this.reportFolds.set(curator, { raw, map });
    return map;
  }

  /** Authors that `curator` blocks, as last fetched. Call refreshLog(`blocklist/<curator>`) to update. */
  public blockedBy(curator: string): Set<string> {
    const raw = localStorage.getItem(`freenet_log_blocklist/${curator}`);
    const hit = this.blocklistFolds.get(curator);
    if (hit?.raw === raw) return hit.set;
    const set = foldBlocklist(this.logEntries(`blocklist/${curator}`), curator);
    this.blocklistFolds.set(curator, { raw, set });
    return set;
  }

  private async pushLog(name: string, entries: LogEntry[]): Promise<void> {
    try {
      await this.net.push(`log:${name}`, { entries: Object.fromEntries(entries.map((e) => [`${e.author}:${e.id}`, e])) });
      this.unsentLogs.delete(name);
    } catch (e) {
      this.unsentLogs.add(name);
      console.warn("[Freenet] Could not send to log", name, e); // kept locally, sent again on the next refresh
      this.retryUnsent(name);
    }
  }

  /** Send a log's unsent entries again until the network takes them: nothing else refreshes someone else's inbox,
   *  so a message whose first send failed would otherwise never reach them. */
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private retryUnsent(name: string): void {
    if (this.retryTimers.has(name)) return;
    this.retryTimers.set(name, setTimeout(async () => {
      await this.refreshLog(name, true); // fetch, then send what the network does not have
      this.retryTimers.delete(name);
      if (this.unsentLogs.has(name)) this.retryUnsent(name);
    }, REFRESH_EVERY_MS));
  }

  /** Fetch a log (and subscribe to it), send it what only we have, then rebuild the state it feeds. */
  public async refreshLog(name: string, force = false): Promise<void> {
    if (!this.isConnected) return;
    const last = this.lastRefresh.get(`log:${name}`) ?? 0;
    if (!shouldFetch({ force, sinceLast: Date.now() - last, liveAge: this.net.liveAge(`log:${name}`), unsent: this.unsentLogs.has(name) })) return;
    this.lastRefresh.set(`log:${name}`, Date.now());
    try {
      const remote = (await this.net.get<{ entries: Record<string, LogEntry> }>(`log:${name}`))?.entries ?? {};
      await this.takeLog(name, remote);
    } catch (e) {
      console.warn("[Freenet] Could not fetch log", name, e);
    }
  }

  /** A followed log changed on the network: take the state or the new entries the node sent instead of fetching it again. */
  private async logChanged(name: string, c: Change): Promise<void> {
    try {
      const remote = c.state
        ? JSON.parse(c.state).entries
        : c.delta
          ? { ...this.readJson<Record<string, LogEntry>>(`freenet_log_${name}`, "{}"), ...JSON.parse(c.delta).entries }
          : undefined;
      if (remote) {
        this.lastRefresh.set(`log:${name}`, Date.now());
        return await this.takeLog(name, remote);
      }
    } catch (e) {
      console.warn("[Freenet] Could not apply the change of log", name, e);
    }
    return this.refreshLog(name, true);
  }

  /** Merge the network's entries of a log with ours, rebuild what it feeds, and send what only we have. */
  private async takeLog(name: string, remote: Record<string, LogEntry>): Promise<void> {
    const local = this.logEntries(name);
    const missing = local.filter((e) => !remote[`${e.author}:${e.id}`]);
    const before = localStorage.getItem(`freenet_log_${name}`);
    this.saveLog(name, [...missing, ...Object.values(remote)]);
    if (localStorage.getItem(`freenet_log_${name}`) !== before) { // unchanged log: no rebuild, no redraw
      this.applyLog(name);
      this.notifyListeners();
    }
    if (missing.length) await this.pushLog(name, missing);
    else this.unsentLogs.delete(name); // the network has everything we hold
    if (name === "communities") void this.checkJoined();
  }

  /** Rebuild the local chat lists, notifications and rooms a log feeds. Communities are folded on read. */
  private applyLog(name: string): void {
    const entries = this.logEntries(name);
    if (name === `inbox/${this.me}`) {
      this.readUpTo = this.foldReadUpTo(); // before storing: notifications older than "mark all read" are stored read
      // my clears and removals first: a message newer than a removal, below, brings the conversation back
      const hides = foldChatHides(entries, this.me);
      const atLeast = (key: string, upto: number) => upto > Number(localStorage.getItem(key) ?? 0) && localStorage.setItem(key, String(upto));
      for (const [room, upto] of Object.entries(hides.cleared)) atLeast(`freenet_chat_cleared_${room}`, upto);
      for (const [peer, upto] of Object.entries(hides.removed)) atLeast(`freenet_chat_removed_${this.me}_${peer}`, upto);
      for (const [room, on] of Object.entries(hides.rooms))
        if (on) localStorage.setItem(`freenet_room_left_${this.me}_${room}`, "1");
        else localStorage.removeItem(`freenet_room_left_${this.me}_${room}`);
      const rooms = new Set<string>();
      const read = { ...this.readJson<Record<string, number>>("radica_chat_read", "{}"), ...foldChatRead(entries, this.me) };
      for (const e of entries) {
        let b: any;
        try {
          b = JSON.parse(e.body);
        } catch {
          continue;
        }
        if (b.type === "chat" && b.message?.sender === e.author && typeof b.message.room_id === "string") {
          const peer = b.message.sender === this.me ? b.message.recipient : b.message.sender;
          if (b.message.room_id === this.getRoomId(this.me, peer)) {
            rooms.add(b.message.room_id);
            this.addChatPeer(this.me, peer, e.ts);
            const m = b.message as ChatMessage;
            const seen = Math.max(read[m.room_id] ?? 0, Number(localStorage.getItem(`freenet_chat_cleared_${m.room_id}`) || 0));
            // a DM from someone else rings the bell as soon as the inbox arrives, not only once the chat is opened
            if (m.recipient === this.me && m.sender !== this.me && m.timestamp > seen)
              this.storeNotification(this.me, { id: `n_${m.id}`, type: "chat", from: m.sender, text: "sent you an encrypted direct message 🔒", timestamp: m.timestamp, read: false });
          }
        } else if (b.type === "notif" && b.notif?.from === e.author) {
          this.storeNotification(this.me, { ...b.notif, id: `n_${e.author}:${e.id}`, timestamp: e.ts, read: false });
        } else if (b.type === "room_invite" && b.room?.creator === e.author && typeof b.room.id === "string") {
          this.mergeRemotePrivateRooms([b.room]);
          // my signed membership and sealed room secret for a River room: sent with my first message there
          if (b.room.river && typeof b.river_join?.member === "string") localStorage.setItem(`river_join_${b.room.id}`, JSON.stringify(b.river_join));
          void this.refreshLog(`room/${b.room.id}`);
        } else if (b.type === "room_ref" && e.author === this.me && typeof b.roomId === "string" && /^privroom_[\w]+$/.test(b.roomId)) {
          void this.refreshLog(`room/${b.roomId}`); // a room I made or joined: its log has the descriptor and my key
        }
      }
      // "mark all read" is a signed entry of mine, so it survives a re-login or a new device
      if (this.readUpTo) this.markNotificationsReadUpTo(this.me, this.readUpTo);
      // my inbox holds both directions of each conversation; only I can delete from it
      for (const roomId of rooms) this.writeChat(roomId, foldChat(entries, roomId, (a) => a === this.me, undefined, (a, m) => a === m.sender || a === m.recipient), entries);
    } else if (name === "directory") {
      for (const e of [...entries].sort((a, b) => a.ts - b.ts)) {
        try {
          const b = JSON.parse(e.body);
          const known = this.knownPeers[e.author]?.display_name; // a name from the person's own feed profile wins
          if (b.type === "hello" && typeof b.display_name === "string" && (!known || known.startsWith("Persona @")))
            this.knownPeers[e.author] = { ...this.knownPeers[e.author], display_name: b.display_name.slice(0, 100) };
        } catch {}
      }
    } else if (name.startsWith("community-chat/")) {
      const id = name.slice("community-chat/".length);
      const comm = this.foldedCommunities().find((c) => c.id === id);
      const isMod = (pk: string) => !!comm && (pk === comm.creator || comm.moderators.includes(pk));
      const banned = (pk: string) => !!comm?.banned_members?.includes(pk);
      this.writeChat(`comm_${id}`, foldChat(entries, `comm_${id}`, (a, m) => a === m.sender || isMod(a), banned), entries);
    } else if (name.startsWith("room/")) {
      const id = name.slice("room/".length);
      const room = foldRoom(entries, id);
      if (room) {
        const list: PrivateRoom[] = JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]");
        localStorage.setItem("freenet_private_rooms", JSON.stringify([...list.filter((r) => r.id !== id), room]));
        this.saveRoomsToNode();
      }
      this.writeChat(id, foldChat(entries, id), entries);
    }
  }

  /** Messages from the log, plus local ones the log has not received yet. */
  private writeChat(roomId: string, fromLog: ChatMessage[], entries: LogEntry[]): void {
    const inLog = new Set(entries.map((e) => /"id":"([^"]+)"/.exec(e.body)?.[1]).filter(Boolean)); // ids of the messages entries carry
    const local = this.readJson<ChatMessage[]>(`freenet_chat_${roomId}`, "[]");
    const merged = [...fromLog, ...local.filter((m) => !inLog.has(m.id))].sort((a, b) => a.timestamp - b.timestamp);
    localStorage.setItem(`freenet_chat_${roomId}`, JSON.stringify(merged));
  }

  /** The key to encrypt to for `pubkey`: the one in their signed profile (Viso users), else the persona key. */
  private async encPubOf(pubkey: string): Promise<string> {
    if (pubkey === this.me && this.identity) return this.identity.encPub;
    const enc = (await this.getFeed(pubkey)).profile?.enc_pub;
    return enc && /^[0-9a-f]{64}$/.test(enc) ? enc : pubkey;
  }

  // A Viso persona has one app key per device, and the profile names only one: each device also publishes its key in
  // the log devices/<persona>, and direct messages carry a copy encrypted to every one of them.
  // shortcut: a key is never withdrawn (a lost device keeps getting copies), add a "revoke" entry when that matters

  /** Encryption keys `pubkey`'s devices published (entries by that persona only: the log contract checks the author). */
  private deviceKeys(pubkey: string): string[] {
    const keys = this.logEntries(`devices/${pubkey}`)
      .filter((e) => e.author === pubkey)
      .map((e) => {
        try {
          return JSON.parse(e.body).enc_pub;
        } catch {
          return null;
        }
      });
    return keys.filter((k): k is string => typeof k === "string" && /^[0-9a-f]{64}$/.test(k));
  }

  /** Every key a direct message to `pubkey` must be readable with: their profile's and their devices'. */
  private async encPubsOf(pubkey: string): Promise<string[]> {
    await this.refreshLog(`devices/${pubkey}`); // at most once a minute
    return [...new Set([await this.encPubOf(pubkey), ...this.deviceKeys(pubkey)])];
  }

  /** Publish this device's key once, so the messages sent to me reach it too. A local key is the same on every device. */
  private async announceDevice(identity: UserIdentity): Promise<void> {
    if (identity.encPub === identity.pubkey) return;
    const name = `devices/${identity.pubkey}`;
    await this.refreshLog(name, true);
    if (!this.deviceKeys(identity.pubkey).includes(identity.encPub)) await this.logAppend(name, { type: "device", enc_pub: identity.encPub });
  }

  /** Which log a chat room lives in: DMs in my inbox, community rooms and private rooms in their own log. */
  private logOfRoom(roomId: string): string {
    if (roomId.startsWith("comm_")) return `community-chat/${roomId.slice(5)}`;
    if (roomId.startsWith("privroom_")) return `room/${roomId}`;
    return `inbox/${this.me}`;
  }

  // Update user profile info
  public async updateProfile(
    identity: UserIdentity,
    displayName: string,
    bio: string,
    avatarUrl: string
  ): Promise<ProfileInfo> {
    const updatedAt = Date.now();
    const sigMsg = formatProfileSignatureMessage(identity.pubkey, displayName, bio, avatarUrl, identity.encPub, updatedAt);
    const sig = await identity.sign(sigMsg);

    const profile: ProfileInfo = {
      display_name: displayName,
      bio,
      avatar_url: avatarUrl,
      enc_pub: identity.encPub,
      updated_at: updatedAt,
      sig,
      cert: identity.cert,
    };

    const feed = await this.getFeed(identity.pubkey);
    feed.profile = profile;
    await this.saveFeed(feed, { owner: feed.owner, posts: {}, following: [], profile });
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
      media_uri: await this.mediaRefOf(mediaUri),
      location,
      event_date: eventDate,
      is_nsfw: !!isNsfw,
      timestamp,
      sig: "",
      likes: {},
      comments: {},
      nsfw_score: nsfwScore,
      cert: identity.cert,
    };
    post.sig = await identity.sign(formatPostSignatureMessage(post));

    const feed = await this.getFeed(identity.pubkey);
    feed.posts[id] = post;
    await this.saveFeed(feed, { owner: feed.owner, posts: { [id]: post }, following: [] });
    this.peerCache[id] = post;
    this.broadcast({ type: "post", post });
    void this.notifyMentions(caption, id, identity.pubkey);
    return post;
  }

  /** An image goes to its own contract and the post names it (the feed stays small). Offline or refused: the image
   *  stays in the post, as before. */
  private async mediaRefOf(uri?: string): Promise<string | undefined> {
    const bytes = uri && this.isConnected ? dataUrlBytes(uri) : null;
    if (!bytes) return uri;
    try {
      const hash = await this.net.putMedia(bytes);
      keepMedia(hash, bytes); // shown at once, not fetched back
      return MEDIA_PREFIX + hash;
    } catch (e) {
      console.warn("[Freenet] Could not publish the image on its own, keeping it in the post:", e);
      return uri;
    }
  }

  /** An image a post names (see media.ts). */
  public getMedia(hash: string): Promise<Uint8Array | null> {
    return this.isConnected ? this.net.getMedia(hash) : Promise.resolve(null);
  }

  // Delete a post
  public async deletePost(identity: UserIdentity, postId: string): Promise<boolean> {
    const feed = await this.getFeed(identity.pubkey);
    if (!feed.posts[postId]) return false;

    delete feed.posts[postId];
    const sig = await identity.sign(formatDeleteSignatureMessage(identity.pubkey, postId));
    feed.deleted = { ...feed.deleted, [postId]: { sig, cert: identity.cert } };
    await this.saveFeed(feed, { owner: feed.owner, posts: {}, following: [], deleted: { [postId]: feed.deleted[postId] } });
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
      cert: identity.cert,
    };

    const feed = await this.getFeed(postAuthorPubkey);
    if (feed.posts[postId]) {
      feed.posts[postId].comments[`${identity.pubkey}:${commentId}`] = comment;
      const post = { ...feed.posts[postId], likes: {}, comments: { [`${identity.pubkey}:${commentId}`]: comment } };
      await this.saveFeed(feed, { owner: feed.owner, posts: { [postId]: post }, following: [] });

      // Trigger notification if commenting on someone else's post
      if (identity.pubkey !== postAuthorPubkey) {
        await this.addNotification(postAuthorPubkey, {
          type: "comment",
          from: identity.pubkey,
          text: `commented: "${text.substring(0, 35)}..."`,
          linkPostId: postId,
        });
      }
      void this.notifyMentions(text, postId, postAuthorPubkey, [postAuthorPubkey]); // the post's author already hears of the comment
    }
    return comment;
  }

  /** Take back one of my comments. The feed contract has no deletion, but it replaces a comment with a new version
   *  of the same author and id whose signature sorts higher, so every node keeps the same one: an empty version
   *  (a comment is never empty otherwise) stands for "deleted" and is not shown. */
  public async deleteComment(identity: UserIdentity, postAuthor: string, postId: string, key: string): Promise<boolean> {
    const feed = await this.getFeed(postAuthor);
    const post = feed.posts[postId];
    const old = post?.comments[key];
    if (!old || old.author !== identity.pubkey || old.text === "") return false;
    for (let ts = Math.max(Date.now(), old.timestamp + 1), tries = 0; tries < 64; ts++, tries++) {
      const c: Comment = { ...old, text: "", timestamp: ts, cert: identity.cert, sig: "" };
      c.sig = await identity.sign(formatCommentSignatureMessage(c.id, c.post_id, c.author, c.text, c.timestamp));
      if (c.sig <= old.sig) continue; // signatures are deterministic: another timestamp gives another one
      post.comments[key] = c;
      await this.saveFeed(feed, { owner: feed.owner, posts: { [postId]: { ...post, likes: {}, comments: { [key]: c } } }, following: [] });
      return true;
    }
    return false;
  }

  // Like or unlike a post
  public async toggleLike(identity: UserIdentity, postAuthorPubkey: string, postId: string): Promise<boolean> {
    const feed = await this.getFeed(postAuthorPubkey);
    if (!feed.posts[postId]) return false;

    const post = feed.posts[postId];
    const liked = !post.likes?.[identity.pubkey]?.liked;
    const ts = Date.now();
    const sig = await identity.sign(formatLikeSignatureMessage(postAuthorPubkey, postId, identity.pubkey, liked, ts));
    post.likes = { ...post.likes, [identity.pubkey]: { liked, ts, sig, cert: identity.cert } };
    if (liked && identity.pubkey !== postAuthorPubkey) {
      // Trigger notification if liking someone else's post
      await this.addNotification(postAuthorPubkey, {
        type: "like",
        from: identity.pubkey,
        text: "liked your post.",
        linkPostId: postId,
      });
    }
    await this.saveFeed(feed, { owner: feed.owner, posts: { [postId]: { ...post, comments: {}, likes: { [identity.pubkey]: post.likes[identity.pubkey] } } }, following: [] });
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
    feed.following_cert = identity.cert;
    feed.following_sig = await identity.sign(
      formatFollowingSignatureMessage(identity.pubkey, feed.following_updated_at, feed.following)
    );
    const { following_updated_at, following_sig, following_cert } = feed;
    await this.saveFeed(feed, { owner: feed.owner, posts: {}, following: [...feed.following], following_updated_at, following_sig, following_cert });
    return following;
  }

  // Aggregate timeline: own posts + followed users' posts sorted by timestamp
  public async getTimeline(identity: UserIdentity): Promise<Post[]> {
    const myFeed = await this.getFeed(identity.pubkey);
    const postMap: Record<string, Post> = { ...myFeed.posts };

    for (const followedPubkey of myFeed.following) {
      for (const p of await this.peerPosts(followedPubkey)) postMap[p.id] = p;
      for (const p of Object.values(this.peerCache)) {
        if (p.author === followedPubkey && !postMap[p.id]) { // a live copy is older than the feed's: it misses later comments
          postMap[p.id] = p;
        }
      }
    }

    return Object.values(postMap).sort((a, b) => b.timestamp - a.timestamp);
  }

  // Global Explore feed: all posts published by any persona on the network
  public async getExploreTimeline(identity: UserIdentity): Promise<Post[]> {
    const myFeed = await this.getFeed(identity.pubkey);
    const postMap: Record<string, Post> = { ...this.peerCache, ...myFeed.posts }; // feed copies win: a live copy misses later comments

    // followed personas plus everyone in the directory (shortcut: first 30, no paging)
    const others = Object.keys(this.knownPeers).filter((k) => k !== identity.pubkey && /^[0-9a-f]{64}$/.test(k)).slice(0, 30);
    const peers = await Promise.all([...new Set([...myFeed.following, ...others])].map((k) => this.peerPosts(k)));
    for (const posts of peers) for (const p of posts) postMap[p.id] = p;

    return Object.values(postMap).sort((a, b) => b.timestamp - a.timestamp);
  }

  /** Members of a community plus everyone who spoke in its chat (nobody has to "join" to chat). */
  public getCommunityParticipants(comm: Community): string[] {
    const banned = comm.banned_members ?? [];
    const speakers = this.visibleChat(`comm_${comm.id}`).map((m) => m.sender);
    return [...new Set([...comm.members, ...speakers])].filter((pk) => pk !== "system" && !banned.includes(pk)); // "system" is the seed communities' creator, not a person
  }

  public getDiscoveredPeers(myPubkey: string): { pubkey: string; name: string }[] {
    const list: { pubkey: string; name: string }[] = [];
    for (const [pk, prof] of Object.entries(this.knownPeers)) {
      if (pk !== myPubkey) {
        list.push({ pubkey: pk, name: prof.display_name || `Persona @${personaName(pk).substring(0, 6)}` });
      }
    }
    return list;
  }

  // ---- 1-on-1 P2P Chat ----

  public getRoomId(pkA: string, pkB: string): string {
    return pkA < pkB ? `${pkA}:${pkB}` : `${pkB}:${pkA}`;
  }

  // ---- DMs with River users: River keeps DMs inside a room both are in (direct_messages), not in Radica's inbox log ----

  /** A River room that holds `peer` (their key there), with my key in it. */
  private async sharedRiverRoom(identity: UserIdentity, peer: string): Promise<PrivateRoom> {
    const rooms = await this.rivers();
    const list: PrivateRoom[] = JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]");
    for (const room of list) {
      if (!room.river || !room.members?.includes(identity.pubkey)) continue;
      const state = await rooms.load(room.river.owner);
      if (state && rooms.read(state, room.river.owner, this.riverKey(identity, room), this.riverJoin(room.id)).members.some((m) => m.vk === peer)) return room;
    }
    throw new Error("You share no River room with this contact: a DM to a River user goes through a room you are both in.");
  }

  private async sendRiverDm(identity: UserIdentity, peer: string, text: string): Promise<ChatMessage> {
    const room = await this.sharedRiverRoom(identity, peer);
    await (await this.rivers()).dm(this.riverKey(identity, room), room.river!.owner, peer, text, this.riverJoin(room.id), this.nickname());
    // what I sent is sealed to the other side, so my copy goes to my own inbox log, encrypted to myself: it survives a
    // refresh (this page has no storage of its own) and reaches my other devices
    const [roomId, id, timestamp] = [this.getRoomId(identity.pubkey, peer), `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, Date.now()];
    const sealed = await encryptDirectMessage(identity.secretKey, identity.encPub, text);
    const sig = await identity.sign(formatChatMessageSignatureMessage(id, roomId, identity.pubkey, peer, sealed, timestamp));
    const message: ChatMessage = { id, room_id: roomId, sender: identity.pubkey, recipient: peer, text: sealed, timestamp, sig, enc_pub: identity.encPub, to_enc_pub: identity.encPub };
    const key = `freenet_chat_${roomId}`;
    localStorage.setItem(key, JSON.stringify([...JSON.parse(localStorage.getItem(key) || "[]"), message]));
    this.addChatPeer(identity.pubkey, peer);
    await this.logAppend(`inbox/${identity.pubkey}`, { type: "chat", message });
    return { ...message, text };
  }

  /** DMs River users sent me: each sender joins my DM list (so the conversation shows up unopened), a stub with no text
   *  lands in the chat's list for the unread count, and the bell gets a note. True when something new arrived. */
  public async syncRiverDms(identity: UserIdentity): Promise<boolean> {
    const rooms = await this.rivers();
    const list: PrivateRoom[] = JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]");
    let fresh = false;
    for (const room of list) {
      const owner = room.river?.owner;
      if (!owner || !room.members?.includes(identity.pubkey)) continue;
      const state = await rooms.load(owner); // at most one read of the network per room every 30 s
      if (!state) continue;
      let dms;
      try {
        dms = rooms.read(state, owner, this.riverKey(identity, room), this.riverJoin(room.id)).dms;
      } catch {
        continue;
      }
      // a sender not known as River-only yet: reading the room sorts the River members from the Radica ones
      if (dms.some((d) => d.sender && !this.riverOnly.has(d.sender))) await this.riverMessages(identity, room).catch(() => []);
      for (const d of dms) {
        if (!d.sender || !this.riverOnly.has(d.sender)) continue;
        const roomId = this.getRoomId(identity.pubkey, d.sender);
        const id = `rvdm_${d.sig.slice(0, 16)}`;
        const key = `freenet_chat_${roomId}`;
        const stubs: ChatMessage[] = JSON.parse(localStorage.getItem(key) || "[]");
        if (stubs.some((m) => m.id === id)) continue;
        const marks = JSON.parse(localStorage.getItem("radica_chat_read") || "{}") || {};
        if (marks[roomId] === undefined) localStorage.setItem("radica_chat_read", JSON.stringify({ ...marks, [roomId]: d.time_ms - 1 })); // the first one counts as unread
        stubs.push({ id, room_id: roomId, sender: d.sender, recipient: identity.pubkey, text: "", timestamp: d.time_ms, sig: d.sig });
        localStorage.setItem(key, JSON.stringify(stubs));
        this.addChatPeer(identity.pubkey, d.sender, d.time_ms);
        this.storeNotification(identity.pubkey, { id, type: "chat", from: d.sender, text: "sent you a direct message", timestamp: d.time_ms, read: false });
        fresh = true;
      }
    }
    return fresh;
  }

  /** My sent DMs plus those River users sent me in the River rooms we share, oldest first. */
  private async riverDmThread(identity: UserIdentity, peer: string): Promise<ChatMessage[]> {
    void this.refreshLog(`inbox/${identity.pubkey}`);
    const rooms = await this.rivers();
    const roomId = this.getRoomId(identity.pubkey, peer);
    const list: PrivateRoom[] = JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]");
    const seen = new Set<string>();
    const incoming: ChatMessage[] = [];
    for (const room of list) {
      if (!room.river || !room.members?.includes(identity.pubkey)) continue;
      const state = await this.riverState(rooms, room.river.owner);
      if (!state) continue;
      for (const d of rooms.read(state, room.river.owner, this.riverKey(identity, room), this.riverJoin(room.id)).dms) {
        if (d.sender !== peer || seen.has(d.sig)) continue;
        seen.add(d.sig);
        incoming.push({ id: `rvdm_${d.sig.slice(0, 16)}`, room_id: roomId, sender: peer, recipient: identity.pubkey, text: d.text, timestamp: d.time_ms, sig: d.sig });
      }
    }
    const sent = await Promise.all(
      this.visibleChat(roomId)
        .filter((m) => m.sender === identity.pubkey && m.text.startsWith("e2e:"))
        .map(async (m) => ({ ...m, text: await this.plain(`me|${identity.pubkey}|${m.text}`, () => decryptDirectMessage(identity.secretKey, identity.encPub, m.text)) }))
    );
    const cleared = Number(localStorage.getItem(`freenet_chat_cleared_${roomId}`) || 0);
    return [...sent, ...incoming].filter((m) => m.timestamp > cleared).sort((a, b) => a.timestamp - b.timestamp);
  }

  public async sendChatMessage(
    identity: UserIdentity,
    recipientPubkey: string,
    text: string,
    replyTo?: string
  ): Promise<ChatMessage> {
    await this.riverOnlyReady;
    if (this.riverOnly.has(recipientPubkey)) return this.sendRiverDm(identity, recipientPubkey, text);
    const roomId = this.getRoomId(identity.pubkey, recipientPubkey);
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = Date.now();

    // 1-on-1 direct messages are end-to-end encrypted with X25519 ECDH + AES-256-GCM, to the key the recipient
    // published in their profile (a Viso user's app key) or else to their persona key
    await this.refresh(recipientPubkey); // not forced: a network round trip before every message
    const toEncPub = await this.encPubOf(recipientPubkey);
    const encryptedText = await encryptDirectMessage(identity.secretKey, toEncPub, text);
    // the recipient's other devices and mine: each gets its own copy (old clients read `text`, encrypted as before)
    const others = [...new Set([...(await this.encPubsOf(recipientPubkey)), ...(await this.encPubsOf(identity.pubkey))])].filter(
      (k) => k !== toEncPub && k !== identity.encPub
    );
    const copies = Object.fromEntries(await Promise.all(others.map(async (k) => [k, await encryptDirectMessage(identity.secretKey, k, text)])));

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
      enc_pub: identity.encPub,
      to_enc_pub: toEncPub,
      ...(others.length ? { copies } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
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
    await this.logAppend(`inbox/${recipientPubkey}`, { type: "chat", message });
    await this.logAppend(`inbox/${identity.pubkey}`, { type: "chat", message });

    // Return message with decrypted plaintext for the local caller
    return {
      ...message,
      text,
    };
  }

  private plainCache = new Map<string, string>();
  /** Decrypted text kept per ciphertext: every chat redraw would decrypt the whole history again. In memory only. */
  private async plain(key: string, decrypt: () => Promise<string>): Promise<string> {
    const hit = this.plainCache.get(key);
    if (hit !== undefined) return hit;
    const p = await decrypt();
    // ponytail: never cache failed decryptions ("[Encrypted...") so late-arriving read-keys can decrypt on retry
    if (!p.startsWith("[Encrypted")) this.plainCache.set(key, p);
    return p;
  }

  public async getChatMessages(identity: UserIdentity, peerPubkey: string): Promise<ChatMessage[]> {
    await Promise.all([this.riverOnlyReady, this.readKeysReady]);
    if (this.riverOnly.has(peerPubkey)) return this.riverDmThread(identity, peerPubkey);
    void this.refreshLog(`inbox/${identity.pubkey}`);
    const roomId = this.getRoomId(identity.pubkey, peerPubkey);
    const messages = this.visibleChat(roomId);

    // Decrypt messages asynchronously using peer's pubkey
    const mine = [identity.encPub, ...(await readEncPubs())]; // keys this device used before too
    const decryptedList = await Promise.all(
      messages.map(async (msg) => {
        // a copy encrypted to this device's key, by the sender's key
        const k = mine.find((x) => msg.copies?.[x]);
        const copy = k && msg.copies![k];
        if (copy && msg.enc_pub) return { ...msg, text: await this.plain(`${identity.pubkey}|${msg.enc_pub}|${copy}`, () => decryptDirectMessage(identity.secretKey, msg.enc_pub!, copy)) };
        if (msg.text && msg.text.startsWith("e2e:")) {
          const other = msg.sender === identity.pubkey ? msg.to_enc_pub || peerPubkey : msg.enc_pub || msg.sender;
          return { ...msg, text: await this.plain(`${identity.pubkey}|${other}|${msg.text}`, () => decryptDirectMessage(identity.secretKey, other, msg.text)) };
        }
        return msg;
      })
    );
    return decryptedList;
  }

  public getChatPeers(myPubkey: string): string[] {
    void this.refreshLog(`inbox/${myPubkey}`);
    const key = `freenet_chat_peers_${myPubkey}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  public async sendCommunityChatMessage(
    identity: UserIdentity,
    communityId: string,
    text: string,
    replyTo?: string
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
      ...(replyTo ? { reply_to: replyTo } : {}),
    };

    const roomKey = `freenet_chat_${roomId}`;
    const raw = localStorage.getItem(roomKey);
    const messages: ChatMessage[] = raw ? JSON.parse(raw) : [];
    messages.push(message);
    localStorage.setItem(roomKey, JSON.stringify(messages));

    this.broadcast({ type: "chat", message });
    await this.logAppend(`community-chat/${communityId}`, { type: "chat", message });
    return message;
  }

  public async getCommunityChatMessages(communityId: string): Promise<ChatMessage[]> {
    void this.refreshLog(`community-chat/${communityId}`);
    return this.visibleChat(`comm_${communityId}`);
  }

  /** Stored messages of a room, without those before the last time I cleared it. */
  /** When I last read each room, as stored in my own inbox log. */
  public readMarks(): Record<string, number> {
    return foldChatRead(this.logEntries(`inbox/${this.me}`), this.me);
  }

  public markRoomRead(roomId: string, upto: number): Promise<void> {
    return this.logAppend(`inbox/${this.me}`, { type: "chat_read", room: roomId, upto });
  }

  /** Messages in a room from other people newer than `since`. */
  public unreadCount(roomId: string, me: string, since: number): number {
    return this.visibleChat(roomId).filter((m) => m.sender !== me && m.timestamp > since).length;
  }

  private visibleChat(roomId: string): ChatMessage[] {
    const cleared = Number(localStorage.getItem(`freenet_chat_cleared_${roomId}`) || 0);
    const list = this.readJson<ChatMessage[]>(`freenet_chat_${roomId}`, "[]");
    return list.filter((m) => m.timestamp > cleared);
  }

  /** The River room behind a chat room id, if it is one I can act in. */
  private riverRoomOf(roomId: string): PrivateRoom | undefined {
    const list: PrivateRoom[] = JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]");
    return this.identity ? list.find((r) => r.id === roomId && r.river) : undefined;
  }

  public async deleteChatMessage(roomId: string, messageId: string): Promise<void> {
    const river = this.riverRoomOf(roomId);
    if (river) {
      // River deletes for everyone, and only the author's own messages (others' it ignores)
      await (await this.rivers()).act(this.riverKey(this.identity!, river), river.river!.owner, "delete", messageId, {}, this.riverJoin(roomId), this.nickname());
      this.notifyListeners();
      return;
    }
    const roomKey = `freenet_chat_${roomId}`;
    const raw = localStorage.getItem(roomKey);
    if (raw) {
      const messages: ChatMessage[] = JSON.parse(raw);
      const filtered = messages.filter((m) => m.id !== messageId);
      localStorage.setItem(roomKey, JSON.stringify(filtered));
    }
    this.broadcast({ type: "chat_delete", roomId, messageId });
    await this.logAppend(this.logOfRoom(roomId), { type: "chat_delete", roomId, messageId });
    this.notifyListeners();
  }

  /** Toggle my `emoji` on a message. In a direct message `peer` also gets the entry in their inbox. */
  public async reactToChatMessage(roomId: string, messageId: string, emoji: string, peer?: string): Promise<void> {
    const river = this.riverRoomOf(roomId);
    if (river) {
      const rooms = await this.rivers();
      const [owner, key, join] = [river.river!.owner, this.riverKey(this.identity!, river), this.riverJoin(roomId)];
      const state = rooms.cached(owner);
      const mine = !!state && !!rooms.read(state, owner, key, join).messages.find((m) => m.id === messageId)?.reactions[emoji]?.includes(vkOf(key));
      await rooms.act(key, owner, mine ? "unreact" : "react", messageId, { emoji }, join, this.nickname());
      this.notifyListeners();
      return;
    }
    const key = `freenet_chat_${roomId}`;
    const list: ChatMessage[] = JSON.parse(localStorage.getItem(key) || "[]");
    const m = list.find((x) => x.id === messageId);
    if (!m) return;
    const others = (m.reactions?.[emoji] ?? []).filter((a) => a !== this.me);
    const on = !(m.reactions?.[emoji] ?? []).includes(this.me);
    m.reactions = { ...m.reactions, [emoji]: on ? [...others, this.me] : others };
    if (!m.reactions[emoji].length) delete m.reactions[emoji];
    localStorage.setItem(key, JSON.stringify(list));
    const body = { type: "chat_react", roomId, messageId, emoji, on };
    await this.logAppend(this.logOfRoom(roomId), body);
    if (peer) await this.logAppend(`inbox/${peer}`, body);
    this.notifyListeners();
  }

  public async clearChatRoom(roomId: string): Promise<void> {
    // only my view: messages up to now stay hidden here, even when the network sends them again
    const upto = Date.now();
    localStorage.setItem(`freenet_chat_cleared_${roomId}`, String(upto));
    // a signed entry in my inbox: the clear holds on my other devices and after a new sign-in
    void this.logAppend(`inbox/${this.me}`, { type: "chat_clear", room: roomId, upto }).catch((e) => console.warn("[Freenet] chat_clear:", e));
    this.broadcast({ type: "chat_clear", roomId });
    this.notifyListeners();
  }

  public removeChatPeer(myPubkey: string, peerPubkey: string): void {
    const key = `freenet_chat_peers_${myPubkey}`;
    const raw = localStorage.getItem(key);
    let list: string[] = raw ? JSON.parse(raw) : [];
    list = list.filter((p) => p !== peerPubkey);
    localStorage.setItem(key, JSON.stringify(list));
    // the network log still holds their old messages: remember when I removed them so those do not bring them back
    const upto = Date.now();
    localStorage.setItem(`freenet_chat_removed_${myPubkey}_${peerPubkey}`, String(upto));
    void this.logAppend(`inbox/${myPubkey}`, { type: "chat_remove", peer: peerPubkey, upto }).catch((e) => console.warn("[Freenet] chat_remove:", e));
    this.notifyListeners();
  }

  /** Fetch the feeds of people whose name or avatar is not known yet (knownPeers lives in memory only); each feed is fetched at most once a minute. */
  public warmPeers(pubkeys: string[]): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const pk of pubkeys.slice(0, 30)) {
      if (this.riverOnly.has(pk)) continue; // a River key has no Radica feed to fetch
      const k = this.knownPeers[pk];
      if (pk !== this.me && (!k?.avatar_url || k.display_name.startsWith("Persona @")) && Date.now() - (this.lastRefresh.get(pk) ?? 0) > LIVE_RECHECK_MS) jobs.push(this.refresh(pk, false, true)); // people with no avatar are not refetched every minute
    }
    return Promise.all(jobs).then(() => {});
  }

  public isChatPeerRemoved(myPubkey: string, peerPubkey: string): boolean {
    return !!localStorage.getItem(`freenet_chat_removed_${myPubkey}_${peerPubkey}`);
  }

  /** `ts`: when the message that adds the peer was sent; a removal hides only messages up to the removal. */
  private addChatPeer(ownerPubkey: string, peerPubkey: string, ts = Date.now()): void {
    if (!ownerPubkey || !peerPubkey || peerPubkey === "community") return;
    const removedKey = `freenet_chat_removed_${ownerPubkey}_${peerPubkey}`;
    const removed = localStorage.getItem(removedKey);
    if (ts <= Number(removed ?? 0)) return;
    if (removed !== null) localStorage.removeItem(removedKey); // a newer message brings the conversation back (a write per inbox entry otherwise)
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
    void this.refreshLog(`inbox/${identity.pubkey}`);
    const key = `freenet_notifs_${identity.pubkey}`;
    const raw = localStorage.getItem(key);
    const list: NotificationItem[] = raw ? JSON.parse(raw) : [];
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  public async addNotification(
    recipientPubkey: string,
    notif: Omit<NotificationItem, "id" | "timestamp" | "read">
  ): Promise<void> {
    if (recipientPubkey === this.me || !this.identity) return;
    await this.logAppend(`inbox/${recipientPubkey}`, { type: "notif", notif: { ...notif, from: this.me } });
  }

  /** Tell each persona a post or comment mentions (at most 10, so a post cannot spam the network). */
  private async notifyMentions(text: string, postId: string, postOwner: string, skip: string[] = []): Promise<void> {
    const name = (pk: string) => this.knownPeers[pk]?.display_name ?? pk.slice(0, 8);
    const excerpt = plainMentions(text, name).replace(/\s+/g, " ").trim();
    for (const pk of mentionsIn(text).filter((pk) => !skip.includes(pk)).slice(0, 10))
      await this.addNotification(pk, {
        type: "mention",
        from: this.me,
        text: `mentioned you: "${excerpt.length > 60 ? excerpt.slice(0, 60) + "\u2026" : excerpt}"`,
        linkPostId: postId,
        linkPostOwner: postOwner,
      }).catch((e) => console.warn("[Freenet] mention:", e));
  }

  /** The newest "mark all read" of mine in my inbox log (0 if none). */
  private foldReadUpTo(): number {
    let upto = 0;
    for (const e of this.logEntries(`inbox/${this.me}`)) {
      if (e.author !== this.me || !e.body.includes("notif_read")) continue;
      try {
        const b = JSON.parse(e.body);
        if (b.type === "notif_read" && typeof b.upto === "number") upto = Math.max(upto, b.upto);
      } catch {}
    }
    return upto;
  }
  private readUpTo?: number;

  private storeNotification(owner: string, item: NotificationItem): void {
    if (this.dismissedNotifications(owner).includes(item.id)) return; // the log would bring it back otherwise
    // a notification made after the inbox was read (River DMs) still honours "mark all read"
    if (owner === this.me && item.timestamp <= (this.readUpTo ??= this.foldReadUpTo())) item = { ...item, read: true };
    const key = `freenet_notifs_${owner}`;
    const list: NotificationItem[] = JSON.parse(localStorage.getItem(key) || "[]");
    const kept = keepNewest(list, item, 50);
    if (kept !== list) localStorage.setItem(key, JSON.stringify(kept));
  }

  private dismissedNotifications(owner: string): string[] {
    return JSON.parse(localStorage.getItem(`freenet_notifs_dismissed_${owner}`) || "[]");
  }

  /** Delete one notification for good (on this device): a later read of the inbox log does not bring it back. */
  public dismissNotification(identity: UserIdentity, id: string): void {
    const dismissed = this.dismissedNotifications(identity.pubkey);
    if (!dismissed.includes(id)) localStorage.setItem(`freenet_notifs_dismissed_${identity.pubkey}`, JSON.stringify([...dismissed, id].slice(-500)));
    const key = `freenet_notifs_${identity.pubkey}`;
    const list: NotificationItem[] = JSON.parse(localStorage.getItem(key) || "[]");
    localStorage.setItem(key, JSON.stringify(list.filter((n) => n.id !== id)));
  }

  private markNotificationsReadUpTo(owner: string, upto: number): number {
    const key = `freenet_notifs_${owner}`;
    const list: NotificationItem[] = JSON.parse(localStorage.getItem(key) || "[]");
    for (const item of list) if (item.timestamp <= upto) item.read = true;
    localStorage.setItem(key, JSON.stringify(list));
    return list.reduce((m, n) => Math.max(m, n.timestamp), 0);
  }

  public async markNotificationsAsRead(identity: UserIdentity): Promise<void> {
    const upto = this.markNotificationsReadUpTo(identity.pubkey, Infinity);
    this.readUpTo = Math.max(this.readUpTo ?? 0, upto);
    if (upto) await this.logAppend(`inbox/${identity.pubkey}`, { type: "notif_read", upto });
  }

  // ---- Decentralized Communities & Moderation ----

  public async getCommunities(): Promise<Community[]> {
    void this.refreshLog("communities");
    // until the network's log is in, the communities I joined come from what my node remembers
    const early = (c: Community) => !this.communitiesLoaded && this.joinedOnNode.has(c.id) && !c.members.includes(this.me);
    // "system" is the seed communities' creator, not a person: it must not count as a member
    return this.foldedCommunities().map((c) => ({ ...c, moderators: [...c.moderators], deleted_post_ids: [...c.deleted_post_ids], members: [...c.members.filter((m) => m !== "system"), ...(early(c) ? [this.me] : [])] })); // copies: callers edit them and the folded list is shared
  }

  /** The communities I joined, as my node remembers them: page storage does not outlive the session, and a join that
   *  never reached the network (tab closed first) would be lost. */
  private joinedOnNode = new Set<string>();
  private communitiesLoaded = false;
  private joinedReady: Promise<void> = Promise.resolve();
  private async restoreJoined(): Promise<void> {
    const { nodeGet } = await import("./delegate.ts");
    try {
      for (const id of JSON.parse((await nodeGet(`joined:${this.me}`)) || "[]")) if (typeof id === "string") this.joinedOnNode.add(id);
    } catch {}
    this.notifyListeners();
  }
  /** After the network's log came in: join again where my join was lost (no join or leave of mine in the log), then
   *  remember what the log says. */
  private async checkJoined(): Promise<void> {
    await this.joinedReady; // or the node's list would be overwritten before it is read
    this.communitiesLoaded = true;
    const mine = new Set<string>();
    for (const e of this.logEntries("communities"))
      if (e.author === this.me && /"community_(join|leave)"/.test(e.body))
        try {
          mine.add(JSON.parse(e.body).community_id);
        } catch {}
    for (const id of this.joinedOnNode) if (!mine.has(id)) void this.logAppend("communities", { type: "community_join", community_id: id });
    const joined = this.foldedCommunities().filter((c) => c.members.includes(this.me)).map((c) => c.id);
    if (joined.join() === [...this.joinedOnNode].join()) return;
    this.joinedOnNode = new Set(joined);
    void import("./delegate.ts").then((m) => m.nodePut(`joined:${this.me}`, JSON.stringify(joined)), () => {});
  }

  public async getCommunity(idOrSlug: string): Promise<Community | null> {
    const communities = await this.getCommunities();
    const query = idOrSlug.toLowerCase().replace(/^r\//, "");
    return (
      communities.find((c) => c.id.toLowerCase() === query || c.slug.toLowerCase() === query) || null
    );
  }

  public async createCommunity(
    identity: UserIdentity,
    name: string,
    rawSlug: string,
    description: string,
    avatarUrl?: string
  ): Promise<Community> {
    const slug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40);
    const id = `c_${slug}`;
    if (!slug) throw new Error("Choose a name made of letters, digits or _.");
    if (await this.getCommunity(id)) throw new Error(`r/${slug} already exists.`);
    await this.logAppend("communities", {
      type: "community_create",
      community: { id, name: name.trim(), description: description.trim(), avatar_url: avatarUrl },
    });
    return (await this.getCommunity(id))!;
  }

  /** Append a community event; the fold applies it only if the author may (see logfold.ts). */
  private async communityEvent(type: string, communityId: string, extra: object = {}): Promise<Community | null> {
    await this.logAppend("communities", { type, community_id: communityId, ...extra });
    this.notifyListeners();
    return this.getCommunity(communityId);
  }

  public async toggleJoinCommunity(identity: UserIdentity, communityId: string): Promise<boolean> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return false;
    const join = !comm.members.includes(identity.pubkey);
    await this.communityEvent(join ? "community_join" : "community_leave", comm.id);
    return join;
  }

  public async addCommunityModerator(
    identity: UserIdentity,
    communityId: string,
    modPubkey: string
  ): Promise<{ success: boolean; msg: string }> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return { success: false, msg: "Community not found" };
    if (identity.pubkey !== comm.creator && !comm.moderators.includes(identity.pubkey)) {
      return { success: false, msg: "Only moderators or owner can promote users." };
    }
    if (comm.moderators.includes(modPubkey)) return { success: false, msg: "User is already a moderator." };
    await this.communityEvent("community_mod_add", comm.id, { target: modPubkey });
    return { success: true, msg: "User promoted to moderator." };
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
    if (identity.pubkey !== comm.creator && identity.pubkey !== modPubkey) {
      return { success: false, msg: "Only the community creator can demote moderators." };
    }
    await this.communityEvent("community_mod_remove", comm.id, { target: modPubkey });
    return { success: true, msg: "Moderator removed." };
  }

  public async banMemberFromCommunity(
    identity: UserIdentity,
    communityId: string,
    targetPubkey: string
  ): Promise<{ success: boolean; msg: string; community?: Community }> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return { success: false, msg: "Community not found" };
    if (identity.pubkey !== comm.creator && !comm.moderators.includes(identity.pubkey)) {
      return { success: false, msg: "Only moderators or owner can ban members." };
    }
    if (targetPubkey === comm.creator) {
      return { success: false, msg: "The community creator/owner cannot be banned!" };
    }
    const updated = await this.communityEvent("community_ban", comm.id, { target: targetPubkey });
    return { success: true, msg: "User banned from community.", community: updated ?? undefined };
  }

  public async unbanMemberFromCommunity(
    identity: UserIdentity,
    communityId: string,
    targetPubkey: string
  ): Promise<{ success: boolean; msg: string; community?: Community }> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return { success: false, msg: "Community not found" };
    if (identity.pubkey !== comm.creator && !comm.moderators.includes(identity.pubkey)) {
      return { success: false, msg: "Only moderators or owner can unban members." };
    }
    const updated = await this.communityEvent("community_unban", comm.id, { target: targetPubkey });
    return { success: true, msg: "User unbanned.", community: updated ?? undefined };
  }

  public async modDeletePost(
    identity: UserIdentity,
    communityId: string,
    postId: string,
    postAuthor: string
  ): Promise<{ success: boolean; msg: string }> {
    const comm = await this.getCommunity(communityId);
    if (!comm) return { success: false, msg: "Community not found" };
    const isModerator = identity.pubkey === comm.creator || comm.moderators.includes(identity.pubkey);
    if (!isModerator && identity.pubkey !== postAuthor) {
      return { success: false, msg: "You do not have moderation rights in this community." };
    }
    await this.communityEvent("community_delete_post", comm.id, { post_id: postId, post_author: postAuthor });
    if (identity.pubkey === postAuthor) await this.deletePost(identity, postId);
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

  // ---- Private rooms on River (riverRooms.ts); rooms without `river` are the older log-based ones ----

  /** My River key in a room: the one a link, code or imported River identity gave me, else the derived owner key in a
   *  room I made here, else my identity key. */
  private riverKey(identity: UserIdentity, room: PrivateRoom): Uint8Array {
    const given = localStorage.getItem(`river_key_${room.id}`);
    if (given) return hexToBytes(given);
    return room.creator === identity.pubkey ? roomOwnerSk(identity.secretKey, room.id) : identity.secretKey;
  }

  /** The room's owner key when I own it: derived for rooms made here, or the imported River key that is the owner's. */
  private riverOwnerKey(identity: UserIdentity, room: PrivateRoom): Uint8Array {
    const key = this.riverKey(identity, room);
    return vkOf(key) === room.river?.owner ? key : roomOwnerSk(identity.secretKey, room.id);
  }

  private riverJoin(roomId: string): RiverJoin | undefined {
    try {
      return JSON.parse(localStorage.getItem(`river_join_${roomId}`) || "null") ?? undefined;
    } catch {
      return undefined;
    }
  }

  private nickname(): string {
    return this.knownPeers[this.me]?.display_name || `Persona @${personaName(this.me).substring(0, 6)}`;
  }

  /** A room I made before rooms moved to River: made again on River (same name and members, under an id derived from
   *  the old one, so a second device lands on the same room) and the old one points to it. Old messages stay behind. */
  private migrating = new Set<string>();
  private async moveToRiver(identity: UserIdentity, room: PrivateRoom): Promise<void> {
    if (this.migrating.has(room.id)) return;
    this.migrating.add(room.id);
    try {
      const name = await this.getPrivateRoomDecryptedName(identity, room);
      const next = await this.createPrivateRoom(identity, name, room.members, `${room.id}_r`);
      await this.logAppend(`room/${room.id}`, { type: "room_moved", roomId: room.id, to: next.id });
      this.notifyListeners();
    } catch (e) {
      console.warn("[River] Could not move room", room.id, e); // tried again next session
    }
  }

  /** The old room was moved to River by its creator. */
  private movedToRiver(room: PrivateRoom): boolean {
    return this.logEntries(`room/${room.id}`).some((e) => {
      try {
        return e.author === room.creator && JSON.parse(e.body).type === "room_moved";
      } catch {
        return false;
      }
    });
  }

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
      this.saveRoomsToNode();
    }
  }

  /** A note in my own inbox that I belong to this room, so a fresh browser (or a lost local cache) can find it again. */
  private rememberedRooms = new Set<string>();
  private async rememberRoom(roomId: string): Promise<void> {
    if (this.rememberedRooms.has(roomId)) return;
    this.rememberedRooms.add(roomId);
    const known = this.logEntries(`inbox/${this.me}`).some((e) => {
      try {
        const b = JSON.parse(e.body);
        return e.author === this.me && b.type === "room_ref" && b.roomId === roomId;
      } catch {
        return false;
      }
    });
    if (!known) await this.logAppend(`inbox/${this.me}`, { type: "room_ref", roomId }).catch((e) => console.warn("[Freenet] room_ref:", e));
  }

  public async createPrivateRoom(
    identity: UserIdentity,
    name: string,
    memberPubkeys: string[],
    roomId = `privroom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  ): Promise<PrivateRoom> {
    const owner = await (await this.rivers()).create(identity.secretKey, roomId, name, this.nickname());
    const room: PrivateRoom = {
      id: roomId,
      creator: identity.pubkey,
      name_encrypted: "", // the name lives sealed in the River room
      members: [identity.pubkey],
      encrypted_keys: {},
      created_at: Date.now(),
      sig: "",
      river: { owner },
    };
    // the room's descriptor tells members and my other devices where it is; River decides who is in it
    this.mergeRemotePrivateRooms([room]);
    this.broadcast({ type: "private_room", room });
    await this.logAppend(`room/${roomId}`, { type: "private_room", room });
    await this.rememberRoom(roomId);
    for (const member of new Set(memberPubkeys.filter((m) => m && m !== identity.pubkey))) {
      await this.inviteMemberToPrivateRoom(identity, roomId, member).catch((e) => console.warn("[River] Could not invite", member, e));
    }
    this.notifyListeners();
    return (await this.getPrivateRooms(identity)).find((r) => r.id === roomId) ?? room;
  }

  public async getPrivateRooms(identity: UserIdentity): Promise<PrivateRoom[]> {
    void this.refreshLog(`inbox/${identity.pubkey}`); // invitations
    const raw = localStorage.getItem("freenet_private_rooms");
    const list: PrivateRoom[] = raw ? JSON.parse(raw) : [];
    for (const r of list)
      if (r.members?.includes(identity.pubkey)) {
        void this.refreshLog(`room/${r.id}`);
        if (this.isConnected) void this.rememberRoom(r.id); // rooms made before the inbox note existed
      }
    for (const r of list)
      if (!r.river && r.creator === identity.pubkey && this.isConnected && this.logEntries(`room/${r.id}`).length && !this.movedToRiver(r))
        void this.moveToRiver(identity, r);
    // Only return rooms where current identity is an authorized member (and has not left: an old invite still lists me)
    return list.filter(
      (r) => !(!r.river && this.movedToRiver(r))
    ).filter(
      (r) =>
        r.members &&
        r.members.includes(identity.pubkey) &&
        !localStorage.getItem(`freenet_room_left_${identity.pubkey}_${r.id}`) &&
        !hasLeftRoom(this.logEntries(`room/${r.id}`), r.id, identity.pubkey)
    );
  }

  public async getPrivateRoomKey(
    identity: UserIdentity,
    room: PrivateRoom
  ): Promise<Uint8Array | null> {
    if (room.river) return null; // River seals the room: there is no Radica room key
    const cached = this.privateRoomKeyCache.get(room.id);
    if (cached) return cached;
    await this.readKeysReady;

    const myEncryptedKey = room.encrypted_keys ? room.encrypted_keys[identity.pubkey] : undefined;
    if (!myEncryptedKey) return null;

    // Encrypted by the moderator who last rotated the keys, by the creator, or by myself when I joined through an invite link
    const key =
      (room.keys_enc_pub ? await decryptRoomKeyFromPeer(identity.secretKey, room.keys_enc_pub, myEncryptedKey) : null) ??
      (await decryptRoomKeyFromPeer(identity.secretKey, room.creator_enc_pub || room.creator, myEncryptedKey)) ??
      (await decryptRoomKeyFromPeer(identity.secretKey, identity.encPub, myEncryptedKey));
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
    if (room.river) {
      // lists are drawn often: the copy here, and the network read behind (the list is drawn again when it lands)
      const rooms = await this.rivers();
      const state = rooms.cached(room.river.owner);
      if (!state) void rooms.load(room.river.owner).then((s) => s && this.notifyListeners());
      try {
        const name = state ? rooms.read(state, room.river.owner, this.riverKey(identity, room), this.riverJoin(room.id)).name : null;
        if (name) return name;
      } catch (e) {
        console.warn("[River] Could not read room", room.id, e);
      }
      return `Private Room (${room.id.slice(9, 15)})`;
    }
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
    await this.refreshLog(`room/${roomId}`, true); // start from the room as the network has it: a stale copy would undo others
    const rooms = await this.getPrivateRooms(identity);
    const room = rooms.find((r) => r.id === roomId);
    if (!room) throw new Error("Private room not found or unauthorized");
    // members decrypt their key with the creator's public key, and peers accept the room only from its creator
    if (room.creator !== identity.pubkey) throw new Error("Only the room creator can invite (others can share the invite link)");
    if (room.river) {
      const join = await (await this.rivers()).invite(this.riverOwnerKey(identity, room), room.river.owner, await this.encPubOf(newMemberPubkey));
      if (!room.members.includes(newMemberPubkey)) room.members.push(newMemberPubkey);
      this.replacePrivateRoom(room);
      await this.logAppend(`room/${room.id}`, { type: "private_room", room });
      await this.logAppend(`inbox/${newMemberPubkey}`, { type: "room_invite", room, river_join: join }); // the secret in it is sealed to them
      this.addNotification(newMemberPubkey, { type: "chat", from: identity.pubkey, text: `invited you to an encrypted Private Room 🔒`, linkRoomId: room.id });
      this.notifyListeners();
      return room;
    }

    const roomKey = await this.getPrivateRoomKey(identity, room);
    if (!roomKey) throw new Error("Cannot decrypt room key to invite peer");

    const encKey = await encryptRoomKeyForPeer(identity.secretKey, await this.encPubOf(newMemberPubkey), roomKey);
    room.encrypted_keys[newMemberPubkey] = encKey;
    if (!room.members.includes(newMemberPubkey)) {
      room.members.push(newMemberPubkey);
    }

    this.mergeRemotePrivateRooms([room]);
    this.broadcast({ type: "private_room", room });
    await this.logAppend(`room/${room.id}`, { type: "private_room", room });
    await this.logAppend(`inbox/${newMemberPubkey}`, { type: "room_invite", room });

    this.addNotification(newMemberPubkey, {
      type: "chat",
      from: identity.pubkey,
      text: `invited you to an encrypted Private Room 🔒`,
      linkRoomId: room.id,
    });

    this.notifyListeners();
    return room;
  }

  /**
   * My room list also lives in the node's delegate: the page keeps its state in the URL hash, which the shell cuts at 8192
   * chars, so a long room list does not fit. (The `room_ref` notes in my inbox log bring rooms back too, from the network.)
   */
  private roomsSaveTimer?: ReturnType<typeof setTimeout>;
  private saveRoomsToNode(): void {
    if (!this.me) return;
    clearTimeout(this.roomsSaveTimer);
    this.roomsSaveTimer = setTimeout(async () => {
      const rooms = (JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]") as PrivateRoom[]).filter((r) => r.members?.includes(this.me));
      const { nodePut } = await import("./delegate.ts");
      await nodePut(`privrooms:${this.me}`, JSON.stringify(rooms));
    }, 500);
  }

  private async restoreRoomsFromNode(): Promise<void> {
    const { nodeGet } = await import("./delegate.ts");
    const raw = await nodeGet(`privrooms:${this.me}`);
    if (!raw) return;
    let saved: PrivateRoom[];
    try {
      saved = JSON.parse(raw);
    } catch {
      return;
    }
    for (const r of saved) // keys invite links gave me in River rooms, and what lets them in
      if (r?.river && !localStorage.getItem(`river_key_${r.id}`)) {
        const [k, join] = [await nodeGet(`river-key:${r.id}`), await nodeGet(`river-join:${r.id}`)];
        if (k) localStorage.setItem(`river_key_${r.id}`, k);
        if (join) localStorage.setItem(`river_join_${r.id}`, join);
      }
    const have = new Set((JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]") as PrivateRoom[]).map((r) => r.id));
    const missing = saved.filter((r) => r?.id && Array.isArray(r.members) && r.members.includes(this.me) && !have.has(r.id));
    if (!missing.length) return;
    this.mergeRemotePrivateRooms(missing);
    for (const r of missing) void this.refreshLog(`room/${r.id}`); // the log has the latest members and keys
    this.notifyListeners();
  }

  /** Store `room` as the room's state: unlike `mergeRemotePrivateRooms`, members that left stay gone. */
  private replacePrivateRoom(room: PrivateRoom): void {
    const list: PrivateRoom[] = JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]");
    localStorage.setItem("freenet_private_rooms", JSON.stringify([...list.filter((r) => r.id !== room.id), room]));
    this.saveRoomsToNode();
  }

  /** The creator, or a moderator the creator named, removes a member and rotates the room key for the others. */
  public async kickMemberFromPrivateRoom(
    identity: UserIdentity,
    roomId: string,
    targetPubkey: string
  ): Promise<PrivateRoom> {
    await this.refreshLog(`room/${roomId}`, true); // start from the room as the network has it: a stale copy would undo others
    const rooms = await this.getPrivateRooms(identity);
    const room = rooms.find((r) => r.id === roomId);
    if (!room) throw new Error("Private room not found or unauthorized");
    if (room.river) {
      const byOwner = room.creator === identity.pubkey;
      const mods = this.rosters.get(room.id)?.moderators ?? room.moderators ?? [];
      if (!byOwner && !mods.includes(identity.pubkey)) throw new Error("Only the room owner or a moderator can remove members");
      // River bans them; the owner's ban (or the owner's next visit after a moderator's) seals what comes next under a new secret
      await (await this.rivers()).kick(this.riverKey(identity, room), room.river.owner, await this.encPubOf(targetPubkey));
      room.members = room.members.filter((m) => m !== targetPubkey);
      if (byOwner) {
        this.replacePrivateRoom(room);
        await this.logAppend(`room/${room.id}`, { type: "private_room", room });
      } else await this.logAppend(`room/${room.id}`, { type: "room_kick", roomId: room.id, target: targetPubkey }); // the member list follows
      this.notifyListeners();
      return room;
    }

    const byCreator = room.creator === identity.pubkey;
    const mods = room.moderators ?? [];
    if (!byCreator && !mods.includes(identity.pubkey)) throw new Error("Only the room creator or a moderator can kick members");
    if (targetPubkey === room.creator) throw new Error("The room creator cannot be kicked");
    if (!byCreator && mods.includes(targetPubkey)) throw new Error("Only the room creator can kick a moderator");

    // 1. Remove from members (and moderators), and drop their key
    room.members = room.members.filter((m) => m !== targetPubkey);
    room.moderators = mods.filter((m) => m !== targetPubkey);
    delete room.encrypted_keys?.[targetPubkey];

    // 2. Key rotation for forward secrecy: a new symmetric key for the room, encrypted by me for each remaining member
    const newRoomKey = generateRoomKey();
    const currentName = await this.getPrivateRoomDecryptedName(identity, room);
    room.name_encrypted = await encryptWithSymmetricKey(newRoomKey, currentName);
    this.privateRoomKeyCache.set(room.id, newRoomKey);
    const updatedKeys: Record<string, string> = {};
    for (const m of room.members) {
      try {
        updatedKeys[m] = await encryptRoomKeyForPeer(identity.secretKey, await this.encPubOf(m), newRoomKey);
      } catch (e) {
        console.warn(`Could not re-encrypt key for member ${m}:`, e);
      }
    }
    room.encrypted_keys = updatedKeys;
    room.keys_enc_pub = byCreator ? undefined : identity.encPub;

    this.replacePrivateRoom(room);
    this.broadcast({ type: "private_room_kick", roomId, kicked: targetPubkey, room });
    // the creator publishes the whole descriptor; a moderator can only publish the kick, which peers check against the moderators list
    if (byCreator) await this.logAppend(`room/${room.id}`, { type: "private_room", room });
    else
      await this.logAppend(`room/${room.id}`, {
        type: "room_kick",
        roomId,
        target: targetPubkey,
        name_encrypted: room.name_encrypted,
        encrypted_keys: room.encrypted_keys,
        keys_enc_pub: room.keys_enc_pub,
      });
    this.notifyListeners();
    return room;
  }

  /** A member leaves a room: the room log says so, and the room disappears from my list. The creator cannot leave. */
  public async leavePrivateRoom(identity: UserIdentity, roomId: string): Promise<void> {
    const room = (await this.getPrivateRooms(identity)).find((r) => r.id === roomId);
    if (!room) throw new Error("Private room not found or unauthorized");
    // the creator only removes the room from their own list (members keep it); a member also leaves its roster
    if (room.creator !== identity.pubkey) await this.logAppend(`room/${roomId}`, { type: "room_leave", roomId });
    localStorage.setItem(`freenet_room_left_${identity.pubkey}_${roomId}`, String(Date.now()));
    // in my inbox too: page storage does not outlive the session, and my other devices drop it as well
    await this.logAppend(`inbox/${identity.pubkey}`, { type: "room_hide", roomId });
    this.privateRoomKeyCache.delete(roomId);
    const keys = { ...room.encrypted_keys };
    delete keys[identity.pubkey];
    this.replacePrivateRoom({
      ...room,
      members: room.members.filter((m) => m !== identity.pubkey),
      moderators: (room.moderators ?? []).filter((m) => m !== identity.pubkey),
      encrypted_keys: keys,
    });
    this.notifyListeners();
  }

  /** Creator only: let a member kick others (or take that back). */
  public async setPrivateRoomModerator(identity: UserIdentity, roomId: string, target: string, on: boolean): Promise<PrivateRoom> {
    await this.refreshLog(`room/${roomId}`, true);
    const room = (await this.getPrivateRooms(identity)).find((r) => r.id === roomId);
    if (!room) throw new Error("Private room not found or unauthorized");
    if (room.creator !== identity.pubkey) throw new Error("Only the room creator can name moderators");
    const roster = room.river ? this.rosters.get(room.id) : undefined;
    if (target === room.creator || !(roster?.members ?? room.members).includes(target)) throw new Error("Only a member other than the creator can be a moderator");
    const current = roster?.moderators ?? room.moderators ?? [];
    room.moderators = on ? [...new Set([...current, target])] : current.filter((m) => m !== target);
    if (room.river) {
      // River's deputies: the owner lists them, and the room enforces their bans
      const vks = await Promise.all(room.moderators.map((m) => this.encPubOf(m)));
      await (await this.rivers()).setDeputies(this.riverOwnerKey(identity, room), room.river.owner, vks);
    }
    this.replacePrivateRoom(room);
    this.broadcast({ type: "private_room", room });
    await this.logAppend(`room/${room.id}`, { type: "private_room", room });
    this.notifyListeners();
    return room;
  }

  /** Who is in each River room as River's contract says (persona where I know who holds the key, else the River key). */
  /** River keys with no Radica persona behind them: contacts that come from River itself. */
  /** ...mapped to the rooms they are in (id -> name). Kept: a DM to one must not fall back to the inbox after a reload. */
  public riverOnly = new Map<string, Record<string, string>>();
  /** Filled from the node's storage after sign-in; sending or reading a DM waits for it. */
  private riverOnlyReady: Promise<void> = Promise.resolve();
  private riverOnlySaveTimer: ReturnType<typeof setTimeout> | undefined;
  private saveRiverOnly(): void {
    clearTimeout(this.riverOnlySaveTimer);
    this.riverOnlySaveTimer = setTimeout(async () => {
      const { nodePut } = await import("./delegate.ts");
      await nodePut(`river-only:${this.me}`, JSON.stringify(Object.fromEntries(this.riverOnly)));
    }, 500);
  }
  private async restoreRiverOnly(): Promise<void> {
    const { nodeGet } = await import("./delegate.ts");
    try {
      for (const [vk, rooms] of Object.entries(JSON.parse((await nodeGet(`river-only:${this.me}`)) || "{}"))) if (!this.riverOnly.has(vk)) this.riverOnly.set(vk, rooms as Record<string, string>);
    } catch {}
    this.notifyListeners(); // the DM list can now tell the River contacts
  }
  private rosters = new Map<string, { members: string[]; creator: string; moderators: string[]; deputyOf: Record<string, string[]> }>();
  public riverRoster(roomId: string): { members: string[]; creator: string; moderators: string[]; deputyOf: Record<string, string[]> } | undefined {
    return this.rosters.get(roomId);
  }

  /** The room from the copy here, so a chat opens at once; a network read that is due redraws it when it lands. Waits only when there is no copy. */
  private async riverState(rooms: RiverRooms, owner: string): Promise<string | null> {
    const cached = rooms.cached(owner);
    if (!cached) return rooms.load(owner);
    void rooms.load(owner).then((s) => s !== cached && this.notifyListeners());
    return cached;
  }

  /** A River room's messages, authors named by persona where I know who holds the key. */
  private async riverMessages(identity: UserIdentity, room: PrivateRoom): Promise<ChatMessage[]> {
    const rooms = await this.rivers();
    const owner = room.river!.owner;
    const state = await this.riverState(rooms, owner);
    if (!state) return [];
    const myKey = this.riverKey(identity, room);
    const view = rooms.read(state, owner, myKey, this.riverJoin(room.id));
    const who = new Map<string, string>([[owner, room.creator], [vkOf(myKey), identity.pubkey]]);
    for (const p of room.members) if (p !== room.creator) who.set(await this.encPubOf(p), p);

    const cleared = Number(localStorage.getItem(`freenet_chat_cleared_${room.id}`) || 0);
    const name = (vk: string | null) => (vk ? who.get(vk) ?? vk : "");
    // whoever I know no Radica persona for goes by their nickname in the room (and is a River-only member)
    const here = new Set(view.members.map((m) => m.vk));
    for (const [vk, rooms] of this.riverOnly) if (!here.has(vk)) delete rooms[room.id]; // left, or pruned
    for (const m of view.members) if (!who.has(m.vk)) this.riverOnly.set(m.vk, { ...this.riverOnly.get(m.vk), [room.id]: view.name ?? "room" });
    this.saveRiverOnly();
    // a River-only member's nickname follows what they set in River (a Radica persona keeps its own profile name)
    for (const m of view.members)
      if (m.nickname && (!who.has(m.vk) || !this.knownPeers[name(m.vk)])) this.knownPeers[name(m.vk)] = { ...this.knownPeers[name(m.vk)], display_name: m.nickname };
    this.rosters.set(room.id, {
      members: view.members.map((m) => name(m.vk)),
      creator: name(owner),
      moderators: view.members.filter((m) => m.deputy).map((m) => name(m.vk)),
      deputyOf: Object.fromEntries(view.members.filter((m) => m.deputy).map((m) => [name(m.vk), m.deputy_of.map(name)])),
    });
    const messages: ChatMessage[] = view.messages
      .map((m) => ({
        id: m.id,
        room_id: room.id,
        private_room_id: room.id,
        sender: name(m.author),
        text: m.text,
        timestamp: m.time_ms,
        sig: "",
        ...(m.reply_to ? { reply_to: m.reply_to } : {}),
        reactions: Object.fromEntries(Object.entries(m.reactions).map(([e, vks]) => [e, vks.filter((v): v is string => !!v).map(name)])),
      }))
      .filter((m) => m.timestamp > cleared);
    if (room.creator === identity.pubkey) void rooms.rotateIfDue(this.riverOwnerKey(identity, room), owner, state).catch((e) => console.warn("[River] rotate:", e));
    localStorage.setItem(`freenet_chat_${room.id}`, JSON.stringify(messages.map((m) => ({ ...m, text: "" })))); // for unread counts: no plaintext kept
    return messages;
  }

  /** An invite link to a River room, carrying a River invitation code: Radica, River and riverctl all accept it.
   *  Whoever holds it can join (as with the older rooms' links). Only the owner can make one. */
  public async getRiverInviteLink(identity: UserIdentity, room: PrivateRoom): Promise<string> {
    if (room.creator !== identity.pubkey || !room.river) throw new Error("Only the room owner can make an invite link");
    const code = await (await this.rivers()).invitation(this.riverOwnerKey(identity, room), room.river.owner);
    return `${window.location.origin}${window.location.pathname}#river_invite=${code}`;
  }

  /** Joining (again) a room I removed: it comes back here and on my other devices. */
  private unhideRoom(identity: UserIdentity, roomId: string): void {
    const key = `freenet_room_left_${identity.pubkey}_${roomId}`;
    if (localStorage.getItem(key) === null && !foldChatHides(this.logEntries(`inbox/${identity.pubkey}`), identity.pubkey).rooms[roomId]) return;
    localStorage.removeItem(key);
    void this.logAppend(`inbox/${identity.pubkey}`, { type: "room_hide", roomId, on: false }).catch((e) => console.warn("[Freenet] room_hide:", e));
  }

  /** Join a River room from a River invitation code (made by Radica, River's UI or riverctl). */
  public async joinRiverInvitation(identity: UserIdentity, code: string): Promise<PrivateRoom> {
    const { owner, sk, join } = (await this.rivers()).accept(code);
    const list: PrivateRoom[] = JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]");
    const known = list.find((r) => r.river?.owner === owner);
    const roomId = known?.id ?? `privroom_river_${owner.slice(0, 16)}`;
    this.unhideRoom(identity, roomId);
    this.keepRiverAccess(roomId, sk, join);
    // a room made outside Radica has no persona as creator: its owner key stands in
    const room: PrivateRoom = known
      ? { ...known, members: [...new Set([...known.members, identity.pubkey])] }
      : { id: roomId, creator: owner, name_encrypted: "", members: [identity.pubkey], encrypted_keys: {}, created_at: Date.now(), sig: "", river: { owner } };
    this.mergeRemotePrivateRooms([room]);
    await this.rememberRoom(roomId);
    this.notifyListeners();
    return room;
  }

  /** Take on my identity in a River room from River's "Export ID" token: the same member there, not a second one. */
  public async importRiverIdentity(identity: UserIdentity, token: string): Promise<PrivateRoom> {
    const { owner, sk, join } = (await this.rivers()).importIdentity(token);
    const list: PrivateRoom[] = JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]");
    const known = list.find((r) => r.river?.owner === owner);
    const roomId = known?.id ?? `privroom_river_${owner.slice(0, 16)}`;
    this.unhideRoom(identity, roomId);
    this.keepRiverAccess(roomId, sk, join);
    // the owner's own key makes me the room's creator here; otherwise its owner key stands in for a creator persona
    const creator = vkOf(hexToBytes(sk)) === owner ? identity.pubkey : known?.creator ?? owner;
    const room: PrivateRoom = known
      ? { ...known, creator, members: [...new Set([...known.members, identity.pubkey])] }
      : { id: roomId, creator, name_encrypted: "", members: [identity.pubkey], encrypted_keys: {}, created_at: Date.now(), sig: "", river: { owner } };
    this.mergeRemotePrivateRooms([room]);
    await this.rememberRoom(roomId);
    this.notifyListeners();
    return room;
  }

  /** My identity in a River room as River's "Export ID" token (it holds my key in that room: a password). */
  public async exportRiverIdentity(identity: UserIdentity, room: PrivateRoom): Promise<string> {
    if (!room.river) throw new Error("Only River rooms have a River identity");
    return (await this.rivers()).exportIdentity(this.riverKey(identity, room), room.river.owner, this.riverJoin(room.id), this.nickname());
  }

  /** The key a link gave me in a room and what lets it in, here and in the node (the page's storage does not last). */
  private keepRiverAccess(roomId: string, k: string, join: RiverJoin): void {
    localStorage.setItem(`river_key_${roomId}`, k);
    localStorage.setItem(`river_join_${roomId}`, JSON.stringify(join));
    void import("./delegate.ts").then(async (m) => {
      await m.nodePut(`river-key:${roomId}`, k);
      await m.nodePut(`river-join:${roomId}`, JSON.stringify(join));
    });
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
    inviteData: { roomId: string; name: string; keyHex: string; creator: string; river?: { owner: string; k: string; member: string; secret?: string } }
  ): Promise<PrivateRoom> {
    const { roomId, name, keyHex, creator } = inviteData;
    this.unhideRoom(identity, roomId); // joining again after leaving
    if (inviteData.river) {
      const { owner, k, member, secret } = inviteData.river;
      if (!/^[0-9a-f]{64}$/.test(owner) || !/^[0-9a-f]{64}$/.test(k)) throw new Error("Invalid invite link");
      this.keepRiverAccess(roomId, k, { member, secret: secret || undefined }); // the link's key is my key in this room
      const room: PrivateRoom = { id: roomId, creator, name_encrypted: "", members: [creator, identity.pubkey], encrypted_keys: {}, created_at: Date.now(), sig: "invite_join", river: { owner } };
      this.mergeRemotePrivateRooms([room]);
      await this.logAppend(`room/${roomId}`, { type: "room_join", roomId }); // so the room's member list shows me
      await this.rememberRoom(roomId);
      this.notifyListeners();
      return room;
    }
    const roomKey = hexToBytes(keyHex);
    if (roomKey.length !== 32) {
      throw new Error("Invalid room key in invite link");
    }

    // Cache the decrypted room key locally
    this.privateRoomKeyCache.set(roomId, roomKey);

    // Encrypt room key for self so it persists across sessions
    const encKeyForSelf = await encryptRoomKeyForPeer(identity.secretKey, identity.encPub, roomKey);

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
    await this.logAppend(`room/${roomId}`, { type: "room_join", roomId, encrypted_key: encKeyForSelf }); // my copy of the key, for my eyes only
    await this.rememberRoom(roomId);
    this.notifyListeners();
    return room;
  }

  public async sendPrivateRoomChatMessage(
    identity: UserIdentity,
    room: PrivateRoom,
    text: string,
    replyTo?: string
  ): Promise<ChatMessage> {
    if (room.river) {
      await (await this.rivers()).say(this.riverKey(identity, room), room.river.owner, text, this.riverJoin(room.id), this.nickname(), replyTo);
      for (const member of room.members)
        if (member !== identity.pubkey) this.addNotification(member, { type: "chat", from: identity.pubkey, text: "sent a message in an encrypted Private Room 🔒", linkRoomId: room.id });
      const now = Date.now();
      return { id: `river_${now}`, room_id: room.id, private_room_id: room.id, sender: identity.pubkey, text, timestamp: now, sig: "" };
    }
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
      ...(replyTo ? { reply_to: replyTo } : {}),
    };

    const storageKey = `freenet_chat_${room.id}`;
    const raw = localStorage.getItem(storageKey);
    const messages: ChatMessage[] = raw ? JSON.parse(raw) : [];
    messages.push(message);
    localStorage.setItem(storageKey, JSON.stringify(messages));

    this.broadcast({ type: "chat", message });
    await this.logAppend(`room/${room.id}`, { type: "chat", message });

    // Send notifications to all other room members
    for (const member of room.members) {
      if (member !== identity.pubkey) {
        this.addNotification(member, {
          type: "chat",
          from: identity.pubkey,
          text: "sent a message in an encrypted Private Room 🔒",
          linkRoomId: room.id,
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
    if (room.river) return this.riverMessages(identity, room);
    void this.refreshLog(`room/${room.id}`);
    const messages = this.visibleChat(room.id);

    const roomKey = await this.getPrivateRoomKey(identity, room);
    if (!roomKey) return messages;

    const decryptedList = await Promise.all(
      messages.map(async (msg) => {
        if (msg.text && msg.text.startsWith("sym:")) {
          return { ...msg, text: await this.plain(`sym|${identity.pubkey}|${room.id}|${msg.text}`, () => decryptWithSymmetricKey(roomKey, msg.text)) };
        }
        return msg;
      })
    );
    return decryptedList;
  }
}

export const freenet = new FreenetClient();
