export type PostCategory = "thought" | "moment" | "event";

export interface ProfileInfo {
  display_name: string;
  bio: string;
  avatar_url: string;
  updated_at: number;
  sig: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author: string; // hex 32-byte pubkey
  text: string;
  timestamp: number;
  sig: string;
  ante?: string;
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
  likes: string[]; // list of author hex pubkeys
  comments: Record<string, Comment>; // comment_id -> Comment
  is_nsfw?: boolean;
  nsfw_score?: number;
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
  deleted_post_ids: string[]; // post IDs removed by moderators
  sig: string;
}

export interface FeedState {
  owner: string; // hex 32-byte pubkey
  profile?: ProfileInfo;
  posts: Record<string, Post>;
  following: string[]; // list of followed hex pubkeys
}

export interface FeedDelta {
  profile?: ProfileInfo;
  posts: Record<string, Post>;
  following?: string[];
  deleted_posts?: string[];
}

export interface UserIdentity {
  pubkey: string;
  secretKey: Uint8Array;
  sign: (msg: string) => Promise<string>;
  type?: "local" | "viso";
  personaName?: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender: string; // hex pubkey
  recipient?: string; // hex pubkey (for 1-on-1 chats)
  community_id?: string; // community ID (for community chatrooms)
  text: string;
  timestamp: number;
  sig: string;
}

export interface RoomState {
  participants: [string, string];
  messages: Record<string, ChatMessage>;
}

export interface NotificationItem {
  id: string;
  type: "like" | "comment" | "follow" | "chat";
  from: string;
  text: string;
  timestamp: number;
  read: boolean;
  linkPostId?: string;
}
