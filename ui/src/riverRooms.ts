// Private rooms on River's room contract. The rules (who is a member, who may write, who reads what) are River's
// contract's, not Radica's: river.wasm builds the signed, sealed deltas and the contract refuses the rest.
//
// - A room is River's: its key is BLAKE3(room contract code || CBOR{owner}), with the code hash from River's pointer.
// - The owner key of a room is derived from its creator's identity key and the room id, so it needs no storage and
//   comes back on any device holding that identity.
// - A member's River key is their identity key (`identity.secretKey`, published as `encPub`), or the key an invite
//   link carried.
// - Only the owner invites (River's private rooms: only the owner signs the secret each member gets).
import { blake3 } from "@noble/hashes/blake3.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import type { ContractKey } from "@freenetorg/freenet-stdlib";
import { bytesToHex, hexToBytes } from "./crypto.ts";
import type { RiverCall } from "./river.ts";
import { type Anchor, roomKey } from "./riverPointer.ts";

export type RiverJoin = { member: string; secret?: string };
export type RiverView = {
  name: string | null;
  private: boolean;
  members: { vk: string; nickname: string | null; owner: boolean }[];
  messages: { id: string; author: string | null; time_ms: number; text: string }[];
};

export type RiverNet = {
  getRaw(key: ContractKey, watch?: `river:${string}`): Promise<Uint8Array | null>;
  putRaw(key: ContractKey, code: Uint8Array, params: Uint8Array, state: Uint8Array): Promise<void>;
  updateRaw(key: ContractKey, delta: Uint8Array): Promise<void>;
};

/** The owner key of room `roomId` made by the holder of `identitySk`: BLAKE3 keyed by that key. */
export function roomOwnerSk(identitySk: Uint8Array, roomId: string): Uint8Array {
  return blake3(new TextEncoder().encode(`radica/river-room-owner/v1:${roomId}`), { key: identitySk });
}

export const vkOf = (sk: Uint8Array): string => bytesToHex(ed25519.getPublicKey(sk));

export class RiverRooms {
  private states = new Map<string, string>(); // owner vk -> state (hex CBOR), as last read or written
  private fetched = new Map<string, number>(); // owner vk -> when it was last read from the network
  private call: RiverCall;
  private net: RiverNet;
  private anchor: () => Promise<Anchor>;
  private roomCode: () => Promise<Uint8Array>;
  private store: Pick<Storage, "getItem" | "setItem">;

  constructor(call: RiverCall, net: RiverNet, anchor: () => Promise<Anchor>, roomCode: () => Promise<Uint8Array>, store: Pick<Storage, "getItem" | "setItem"> = localStorage) {
    this.call = call;
    this.net = net;
    this.anchor = anchor;
    this.roomCode = roomCode;
    this.store = store;
  }

  private async key(owner: string): Promise<ContractKey> {
    return roomKey(await this.anchor(), this.call, owner);
  }

  private async writable(): Promise<void> {
    const a = await this.anchor();
    if (!a.canWrite)
      throw new Error(a.withdrawn ? "River withdrew its room contract: rooms are read-only." : "River updated its room contract: update Radica to write in rooms again (they stay readable).");
  }

  private keep(owner: string, state: string): void {
    this.states.set(owner, state);
    try {
      this.store.setItem(`river_state_${owner}`, state); // sealed: no plaintext of a private room is in it
    } catch {}
  }

  /** The last copy here, without asking the network (for names in lists drawn often). */
  cached(owner: string): string | null {
    return this.states.get(owner) ?? this.store.getItem(`river_state_${owner}`);
  }

  /** The room changed on the network (its subscription said so): the next `load` reads it again. */
  changed(owner: string): void {
    this.fetched.delete(owner);
  }

  /** The room as the network has it (and follow its changes), else the last copy here. Read at most every 30 s:
   *  the subscription brings changes in between (`changed`). */
  async load(owner: string, force = false): Promise<string | null> {
    if (!force && Date.now() - (this.fetched.get(owner) ?? 0) < 30_000 && this.cached(owner)) return this.cached(owner);
    this.fetched.set(owner, Date.now());
    try {
      const raw = await this.net.getRaw(await this.key(owner), `river:${owner}`);
      if (raw) this.keep(owner, bytesToHex(raw));
    } catch (e) {
      console.warn("[River] Could not fetch room", owner, e);
    }
    return this.cached(owner);
  }

  /** Make a private room owned by a key derived from mine; returns its owner key. */
  async create(mySk: Uint8Array, roomId: string, name: string, nickname: string): Promise<string> {
    await this.writable();
    const ownerSk = roomOwnerSk(mySk, roomId);
    const owner = vkOf(ownerSk);
    const state: string = this.call({ op: "new_room", owner_sk: bytesToHex(ownerSk), name, nickname, private: true, time_ms: Date.now() }).state;
    const params = hexToBytes(this.call({ op: "params", owner_vk: owner }).params);
    await this.net.putRaw(await this.key(owner), await this.roomCode(), params, hexToBytes(state));
    this.keep(owner, state);
    return owner;
  }

  /** As the owner, let `inviteeVk` in: their signed membership and their sealed copy of the room secret. */
  async invite(mySk: Uint8Array, roomId: string, owner: string, inviteeVk: string): Promise<RiverJoin> {
    const state = await this.load(owner, true); // a write starts from the room as it is now (members, secret version)
    if (!state) throw new Error("Room not found on the network");
    const r = this.call({ op: "invite", inviter_sk: bytesToHex(roomOwnerSk(mySk, roomId)), owner_vk: owner, state, invitee_vk: inviteeVk });
    return { member: r.member, secret: r.secret };
  }

  /** As the owner, ban `targetVk` and seal what comes next under a secret they do not get. */
  async kick(mySk: Uint8Array, roomId: string, owner: string, targetVk: string): Promise<void> {
    await this.writable();
    const state = await this.load(owner, true); // a write starts from the room as it is now (members, secret version)
    if (!state) throw new Error("Room not found on the network");
    const ownerSk = bytesToHex(roomOwnerSk(mySk, roomId));
    await this.send(owner, state, this.call({ op: "kick", owner_sk: ownerSk, state, target_vk: targetVk, time_ms: Date.now() }).delta);
  }

  /** Post `text` as `sk`; `join` and `nickname` go along until the room holds me (a first message, or after a prune). */
  async say(sk: Uint8Array, owner: string, text: string, join?: RiverJoin, nickname?: string): Promise<void> {
    await this.writable();
    const state = await this.load(owner, true); // a write starts from the room as it is now (members, secret version)
    if (!state) throw new Error("Room not found on the network");
    const me = vkOf(sk);
    const inRoom = me === owner || this.read(state, owner, sk, join).members.some((m) => m.vk === me);
    const extra = inRoom ? {} : { join, nickname };
    const delta = this.call({ op: "message", author_sk: bytesToHex(sk), owner_vk: owner, state, text, time_ms: Date.now(), ...extra }).delta;
    if (!(await this.send(owner, state, delta))) throw new Error("The room did not take the message (not a member?)");
  }

  /** Apply `delta` here first (the contract runs the same code), then send it; false when it changes nothing. */
  private async send(owner: string, state: string, delta: string): Promise<boolean> {
    const next: string = this.call({ op: "apply", owner_vk: owner, state, delta }).state;
    if (next === state) return false;
    await this.net.updateRaw(await this.key(owner), hexToBytes(delta));
    this.keep(owner, next);
    return true;
  }

  /** The room as `sk` sees it; `join` lets an invitee read it before their first message files their secret. */
  read(state: string, owner: string, sk: Uint8Array, join?: RiverJoin): RiverView {
    return this.call({ op: "read", owner_vk: owner, state, member_sk: bytesToHex(sk), secret: join?.secret }) as RiverView;
  }
}
