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
import { foldBlocklist, foldChat, foldChatRead, foldCommunities, foldRoom, hasLeftRoom, type LogEntry } from "./logfold.ts";
import { overlayFeed } from "./feedmerge.ts";
import { shouldFetch } from "./refresh.ts";
import { river } from "./river.ts";
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
  private net = new FreenetNetwork((id) =>
    void (id.startsWith("feed:") ? this.refresh(id.slice(5), true) : id.startsWith("river:") ? this.rivers().then((r) => (r.changed(id.slice(6)), this.notifyListeners())) : this.refreshLog(id.slice(4), true))
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

  // coalesce bursts (every refresh fires one) into a single pass of the heavy UI listeners
  private notifyTimer: ReturnType<typeof setTimeout> | undefined;
  private notifyListeners() {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = undefined;
      for (const fn of this.listeners) {
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      }
    }, 150);
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
  public async refresh(owner: string, force = false): Promise<void> {
    if (!this.isConnected) return;
    const last = this.lastRefresh.get(owner) ?? 0;
    const unsent = (this.pending.get(owner)?.length ?? 0) > 0;
    if (!shouldFetch({ force, sinceLast: Date.now() - last, liveAge: this.net.liveAge(`feed:${owner}`), unsent })) return;
    this.lastRefresh.set(owner, Date.now());
    try {
      await this.pushPending(owner);
      const feed = await this.net.get<FeedState>(`feed:${owner}`);
      if (!feed) return;
      for (const d of this.pending.get(owner) ?? []) overlayFeed(feed, d); // keep what the network has not taken yet
      localStorage.setItem(`freenet_feed_${owner}`, JSON.stringify(feed));
      if (feed.profile) this.knownPeers[owner] = { display_name: feed.profile.display_name, avatar_url: feed.profile.avatar_url }; // names and avatars of other people
      this.notifyListeners();
    } catch (e) {
      console.warn("[Freenet] Could not fetch feed", owner, e);
    }
  }

  /** Publish my local feed (merged with what the network has), then take the merged result. */
  /** The persona that signs log entries (messages, community actions). Call once at startup. */
  public setIdentity(identity: UserIdentity): void {
    this.identity = identity;
    this.me = identity.pubkey;
    void this.restoreRoomsFromNode();
    // communities I created before they lived on the network: publish them once
    const legacy: Community[] = JSON.parse(localStorage.getItem("freenet_communities") || "[]");
    const known = new Set(foldCommunities(this.logEntries("communities"), GENESIS).map((c) => c.id));
    for (const c of legacy) {
      if (c.creator === identity.pubkey && !known.has(c.id))
        void this.logAppend("communities", { type: "community_create", community: { id: c.id, name: c.name, description: c.description, avatar_url: c.avatar_url } });
    }
  }

  public async syncOwnFeed(identity: UserIdentity): Promise<void> {
    this.setIdentity(identity);
    await this.migrateOwnFeed(identity);
    await this.saveFeed(await this.getFeed(identity.pubkey));
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
    localStorage.setItem(`freenet_feed_${feed.owner}`, JSON.stringify(feed));
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

  private logEntries(name: string): LogEntry[] {
    try {
      return Object.values(JSON.parse(localStorage.getItem(`freenet_log_${name}`) || "{}"));
    } catch {
      return [];
    }
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
  }

  /** Publish (or withdraw) a block on my own blocklist; anyone who trusts my list then hides that author. */
  public setBlocked(target: string, on: boolean): Promise<void> {
    return this.logAppend(`blocklist/${this.me}`, { type: "block", target, on });
  }

  /** Authors that `curator` blocks, as last fetched. Call refreshLog(`blocklist/<curator>`) to update. */
  public blockedBy(curator: string): Set<string> {
    return foldBlocklist(this.logEntries(`blocklist/${curator}`), curator);
  }

  private async pushLog(name: string, entries: LogEntry[]): Promise<void> {
    try {
      await this.net.push(`log:${name}`, { entries: Object.fromEntries(entries.map((e) => [`${e.author}:${e.id}`, e])) });
      this.unsentLogs.delete(name);
    } catch (e) {
      this.unsentLogs.add(name);
      console.warn("[Freenet] Could not send to log", name, e); // kept locally, sent again on the next refresh
    }
  }

  /** Fetch a log (and subscribe to it), send it what only we have, then rebuild the state it feeds. */
  public async refreshLog(name: string, force = false): Promise<void> {
    if (!this.isConnected) return;
    const last = this.lastRefresh.get(`log:${name}`) ?? 0;
    if (!shouldFetch({ force, sinceLast: Date.now() - last, liveAge: this.net.liveAge(`log:${name}`), unsent: this.unsentLogs.has(name) })) return;
    this.lastRefresh.set(`log:${name}`, Date.now());
    try {
      const remote = (await this.net.get<{ entries: Record<string, LogEntry> }>(`log:${name}`))?.entries ?? {};
      const local = this.logEntries(name);
      const missing = local.filter((e) => !remote[`${e.author}:${e.id}`]);
      this.saveLog(name, [...missing, ...Object.values(remote)]);
      this.applyLog(name);
      this.notifyListeners();
      if (missing.length) await this.pushLog(name, missing);
    } catch (e) {
      console.warn("[Freenet] Could not fetch log", name, e);
    }
  }

  /** Rebuild the local chat lists, notifications and rooms a log feeds. Communities are folded on read. */
  private applyLog(name: string): void {
    const entries = this.logEntries(name);
    if (name === `inbox/${this.me}`) {
      const rooms = new Set<string>();
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
      let readUpTo = 0;
      for (const e of entries) {
        try {
          const b = JSON.parse(e.body);
          if (e.author === this.me && b.type === "notif_read" && typeof b.upto === "number") readUpTo = Math.max(readUpTo, b.upto);
        } catch {}
      }
      if (readUpTo) this.markNotificationsReadUpTo(this.me, readUpTo);
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
      const comm = foldCommunities(this.logEntries("communities"), GENESIS).find((c) => c.id === id);
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
    const local: ChatMessage[] = JSON.parse(localStorage.getItem(`freenet_chat_${roomId}`) || "[]");
    const merged = [...fromLog, ...local.filter((m) => !inLog.has(m.id))].sort((a, b) => a.timestamp - b.timestamp);
    localStorage.setItem(`freenet_chat_${roomId}`, JSON.stringify(merged));
  }

  /** The key to encrypt to for `pubkey`: the one in their signed profile (Viso users), else the persona key. */
  private async encPubOf(pubkey: string): Promise<string> {
    if (pubkey === this.me && this.identity) return this.identity.encPub;
    const enc = (await this.getFeed(pubkey)).profile?.enc_pub;
    return enc && /^[0-9a-f]{64}$/.test(enc) ? enc : pubkey;
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
      media_uri: mediaUri,
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
    return post;
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

    // followed personas plus everyone in the directory (shortcut: first 30, no paging)
    const others = Object.keys(this.knownPeers).filter((k) => k !== identity.pubkey && /^[0-9a-f]{64}$/.test(k)).slice(0, 30);
    for (const followedPubkey of new Set([...myFeed.following, ...others])) {
      const peerFeed = await this.getFeed(followedPubkey);
      Object.assign(postMap, peerFeed.posts);
    }

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

  private riverDmKey = (me: string, peer: string) => `river_dm_${me}_${peer}`; // what I sent: sealed to the other side, so kept here

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
    const message: ChatMessage = { id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, room_id: this.getRoomId(identity.pubkey, peer), sender: identity.pubkey, recipient: peer, text, timestamp: Date.now(), sig: "" };
    const key = this.riverDmKey(identity.pubkey, peer);
    localStorage.setItem(key, JSON.stringify([...JSON.parse(localStorage.getItem(key) || "[]"), message]));
    this.addChatPeer(identity.pubkey, peer);
    return message;
  }

  /** My sent DMs plus those River users sent me in the River rooms we share, oldest first. */
  private async riverDmThread(identity: UserIdentity, peer: string): Promise<ChatMessage[]> {
    const rooms = await this.rivers();
    const roomId = this.getRoomId(identity.pubkey, peer);
    const list: PrivateRoom[] = JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]");
    const seen = new Set<string>();
    const incoming: ChatMessage[] = [];
    for (const room of list) {
      if (!room.river || !room.members?.includes(identity.pubkey)) continue;
      const state = await rooms.load(room.river.owner);
      if (!state) continue;
      for (const d of rooms.read(state, room.river.owner, this.riverKey(identity, room), this.riverJoin(room.id)).dms) {
        if (d.sender !== peer || seen.has(d.sig)) continue;
        seen.add(d.sig);
        incoming.push({ id: `rvdm_${d.sig.slice(0, 16)}`, room_id: roomId, sender: peer, recipient: identity.pubkey, text: d.text, timestamp: d.time_ms, sig: d.sig });
      }
    }
    const sent: ChatMessage[] = JSON.parse(localStorage.getItem(this.riverDmKey(identity.pubkey, peer)) || "[]");
    return [...sent, ...incoming].sort((a, b) => a.timestamp - b.timestamp);
  }

  public async sendChatMessage(
    identity: UserIdentity,
    recipientPubkey: string,
    text: string,
    replyTo?: string
  ): Promise<ChatMessage> {
    if (this.riverOnly.has(recipientPubkey)) return this.sendRiverDm(identity, recipientPubkey, text);
    const roomId = this.getRoomId(identity.pubkey, recipientPubkey);
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = Date.now();

    // 1-on-1 direct messages are end-to-end encrypted with X25519 ECDH + AES-256-GCM, to the key the recipient
    // published in their profile (a Viso user's app key) or else to their persona key
    await this.refresh(recipientPubkey, true);
    const toEncPub = await this.encPubOf(recipientPubkey);
    const encryptedText = await encryptDirectMessage(identity.secretKey, toEncPub, text);

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

  public async getChatMessages(identity: UserIdentity, peerPubkey: string): Promise<ChatMessage[]> {
    if (this.riverOnly.has(peerPubkey)) return this.riverDmThread(identity, peerPubkey);
    void this.refreshLog(`inbox/${identity.pubkey}`);
    const roomId = this.getRoomId(identity.pubkey, peerPubkey);
    const messages = this.visibleChat(roomId);

    // Decrypt messages asynchronously using peer's pubkey
    const decryptedList = await Promise.all(
      messages.map(async (msg) => {
        if (msg.text && msg.text.startsWith("e2e:")) {
          const other = msg.sender === identity.pubkey ? msg.to_enc_pub || peerPubkey : msg.enc_pub || msg.sender;
          const plain = await decryptDirectMessage(identity.secretKey, other, msg.text);
          return { ...msg, text: plain };
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
    const list: ChatMessage[] = JSON.parse(localStorage.getItem(`freenet_chat_${roomId}`) || "[]");
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
    localStorage.setItem(`freenet_chat_cleared_${roomId}`, String(Date.now()));
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
    localStorage.setItem(`freenet_chat_removed_${myPubkey}_${peerPubkey}`, String(Date.now()));
    this.notifyListeners();
  }

  /** Fetch the feeds of people whose name or avatar is not known yet (knownPeers lives in memory only); each feed is fetched at most once a minute. */
  public warmPeers(pubkeys: string[]): void {
    for (const pk of pubkeys.slice(0, 30)) {
      const k = this.knownPeers[pk];
      if (pk !== this.me && (!k?.avatar_url || k.display_name.startsWith("Persona @"))) void this.refresh(pk);
    }
  }

  public isChatPeerRemoved(myPubkey: string, peerPubkey: string): boolean {
    return !!localStorage.getItem(`freenet_chat_removed_${myPubkey}_${peerPubkey}`);
  }

  /** `ts`: when the message that adds the peer was sent; a removal hides only messages up to the removal. */
  private addChatPeer(ownerPubkey: string, peerPubkey: string, ts = Date.now()): void {
    if (!ownerPubkey || !peerPubkey || peerPubkey === "community") return;
    const removedKey = `freenet_chat_removed_${ownerPubkey}_${peerPubkey}`;
    if (ts <= Number(localStorage.getItem(removedKey) ?? 0)) return;
    localStorage.removeItem(removedKey); // a newer message brings the conversation back
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

  private storeNotification(owner: string, item: NotificationItem): void {
    const key = `freenet_notifs_${owner}`;
    const list: NotificationItem[] = JSON.parse(localStorage.getItem(key) || "[]");
    if (list.some((n) => n.id === item.id)) return;
    if (list.length >= 50 && item.timestamp <= list[list.length - 1].timestamp) return; // already dropped as too old
    list.unshift(item);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50))); // Keep latest 50
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
    if (upto) await this.logAppend(`inbox/${identity.pubkey}`, { type: "notif_read", upto });
  }

  // ---- Decentralized Communities & Moderation ----

  public async getCommunities(): Promise<Community[]> {
    void this.refreshLog("communities");
    // "system" is the seed communities' creator, not a person: it must not count as a member
    return foldCommunities(this.logEntries("communities"), GENESIS).map((c) => ({ ...c, members: c.members.filter((m) => m !== "system") }));
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
      this.addNotification(newMemberPubkey, { type: "chat", from: identity.pubkey, text: `invited you to an encrypted Private Room 🔒` });
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
    if (room.creator === identity.pubkey) throw new Error("The creator cannot leave: nobody else could run the room");
    await this.logAppend(`room/${roomId}`, { type: "room_leave", roomId });
    localStorage.setItem(`freenet_room_left_${identity.pubkey}_${roomId}`, String(Date.now()));
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
  public riverOnly = new Set<string>(JSON.parse(localStorage.getItem("radica_river_only") || "[]")); // kept: a DM to one must not fall back to the inbox after a reload
  private rosters = new Map<string, { members: string[]; creator: string; moderators: string[]; deputyOf: Record<string, string[]> }>();
  public riverRoster(roomId: string): { members: string[]; creator: string; moderators: string[]; deputyOf: Record<string, string[]> } | undefined {
    return this.rosters.get(roomId);
  }

  /** A River room's messages, authors named by persona where I know who holds the key. */
  private async riverMessages(identity: UserIdentity, room: PrivateRoom): Promise<ChatMessage[]> {
    const rooms = await this.rivers();
    const owner = room.river!.owner;
    const state = await rooms.load(owner);
    if (!state) return [];
    const myKey = this.riverKey(identity, room);
    const view = rooms.read(state, owner, myKey, this.riverJoin(room.id));
    const who = new Map<string, string>([[owner, room.creator], [vkOf(myKey), identity.pubkey]]);
    for (const p of room.members) if (p !== room.creator) who.set(await this.encPubOf(p), p);

    const cleared = Number(localStorage.getItem(`freenet_chat_cleared_${room.id}`) || 0);
    const name = (vk: string | null) => (vk ? who.get(vk) ?? vk : "");
    // whoever I know no Radica persona for goes by their nickname in the room (and is a River-only member)
    for (const m of view.members) if (!who.has(m.vk)) this.riverOnly.add(m.vk);
    localStorage.setItem("radica_river_only", JSON.stringify([...this.riverOnly]));
    for (const m of view.members) if (m.nickname && !this.knownPeers[name(m.vk)]) this.knownPeers[name(m.vk)] = { display_name: m.nickname };
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

  /** Join a River room from a River invitation code (made by Radica, River's UI or riverctl). */
  public async joinRiverInvitation(identity: UserIdentity, code: string): Promise<PrivateRoom> {
    const { owner, sk, join } = (await this.rivers()).accept(code);
    const list: PrivateRoom[] = JSON.parse(localStorage.getItem("freenet_private_rooms") || "[]");
    const known = list.find((r) => r.river?.owner === owner);
    const roomId = known?.id ?? `privroom_river_${owner.slice(0, 16)}`;
    localStorage.removeItem(`freenet_room_left_${identity.pubkey}_${roomId}`);
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
    localStorage.removeItem(`freenet_room_left_${identity.pubkey}_${roomId}`);
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
    localStorage.removeItem(`freenet_room_left_${identity.pubkey}_${roomId}`); // joining again after leaving
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
        if (member !== identity.pubkey) this.addNotification(member, { type: "chat", from: identity.pubkey, text: "sent a message in an encrypted Private Room 🔒" });
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
