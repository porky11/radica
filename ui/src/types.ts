import type { Cert } from "./whoiam.ts";

export type PostCategory = "thought" | "moment" | "event";

export interface ProfileInfo {
  display_name: string;
  bio: string;
  avatar_url: string;
  enc_pub?: string; // hex Ed25519 key whose X25519 form others encrypt direct messages to
  updated_at: number;
  sig: string;
  cert?: Cert; // Viso: delegation of the app key that signed
}

export interface Comment {
  id: string;
  post_id: string;
  author: string; // hex 32-byte pubkey
  text: string;
  timestamp: number;
  sig: string;
  cert?: Cert;
}

export interface Like {
  liked: boolean; // false = unliked
  ts: number;
  sig: string; // by the liker
  cert?: Cert;
}

export interface Post {
  id: string;
  author: string; // hex 32-byte pubkey
  category: PostCategory;
  caption: string;
  community_id?: string;
  media_uri?: string;
  location?: string;
  event_date?: string;
  timestamp: number;
  sig: string;
  cert?: Cert;
  likes: Record<string, Like>; // liker hex pubkey -> like (see likers())
  comments: Record<string, Comment>; // "<author>:<comment id>" -> Comment
  is_nsfw?: boolean;
  nsfw_score?: number; // local only, not signed nor sent to the contract
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar_url?: string;
  created_at: number;
  creator: string; // hex pubkey (owner / root founder)
  moderators: string[]; // list of moderator hex pubkeys
  members: string[]; // list of member hex pubkeys
  banned_members?: string[]; // list of banned member hex pubkeys
  deleted_post_ids: string[]; // post IDs removed by moderators
  sig: string;
}

export interface FeedState {
  owner: string; // hex 32-byte pubkey
  profile?: ProfileInfo;
  posts: Record<string, Post>;
  following: string[]; // list of followed hex pubkeys
  following_updated_at?: number;
  following_sig?: string; // owner signature over the list
  following_cert?: Cert;
  deleted?: Record<string, { sig: string; cert?: Cert }>; // deleted post id -> owner signature
}

/** Pubkeys that currently like a post. */
export const likers = (p: Post): string[] =>
  Object.entries(p.likes || {}).filter(([, l]) => l.liked).map(([k]) => k);

export interface UserIdentity {
  pubkey: string;
  secretKey: Uint8Array;
  sign: (msg: string) => Promise<string>;
  type?: "local" | "viso";
  personaName?: string;
  cert?: Cert; // Viso: signatures are by a delegated app key and carry this delegation
  encPub: string; // hex Ed25519 public key of secretKey: what others encrypt to
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender: string; // hex pubkey
  recipient?: string; // hex pubkey (for 1-on-1 chats)
  community_id?: string; // community ID (for community chatrooms)
  private_room_id?: string; // private room ID (for E2EE group rooms)
  text: string;
  timestamp: number;
  sig: string;
  enc_pub?: string; // sender's encryption key (Viso: the app key, not the persona)
  to_enc_pub?: string; // the recipient key the message was encrypted to
  copies?: Record<string, string>; // the same text encrypted to each other device key of recipient and sender (enc key -> ciphertext)
  reply_to?: string; // id of the message this one answers (the quote is looked up locally: encrypted rooms keep their text out of the log)
  reactions?: Record<string, string[]>; // emoji -> who reacted, folded from the room's log (never sent as is)
}

export interface PrivateRoom {
  id: string; // privroom_...
  creator: string; // hex pubkey
  creator_enc_pub?: string; // the key the member keys were encrypted with
  name_encrypted: string; // encrypted with room symmetric key (sym:iv:cipher)
  members: string[]; // list of hex pubkeys
  moderators?: string[]; // members the creator let kick others (not the creator, not each other)
  encrypted_keys: Record<string, string>; // memberPubkey -> e2e:iv:cipher(roomKeyHex)
  keys_enc_pub?: string; // the key those were encrypted with, when a moderator rotated them (else creator_enc_pub)
  created_at: number;
  sig: string;
  river?: { owner: string }; // the room lives on River's room contract under this owner key (riverRooms.ts)
}

export interface RoomState {
  participants: [string, string];
  messages: Record<string, ChatMessage>;
}

export interface NotificationItem {
  id: string;
  type: "like" | "comment" | "follow" | "chat" | "mention" | "report";
  from: string;
  text: string;
  timestamp: number;
  read: boolean;
  linkPostId?: string;
  /** Whose feed holds the post (a mention can be on anyone's post); absent: mine. */
  linkPostOwner?: string;
  /** The private room a chat notification is about. */
  linkRoomId?: string;
}
