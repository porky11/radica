//! River rooms for Radica's chat UI. A small wrapper around `river-core`, compiled to WASM for the browser: it builds
//! and reads River room states and deltas, so Radica's rooms live under River's own room contract and stay usable
//! from River and riverctl. Signatures and encryption are river-core's own, never re-implemented in TypeScript.
//!
//! One entry point, JSON in and out (keys and CBOR blobs as hex):
//!   {"op":"params","owner_vk"}                                        -> {"params"}  contract params of a room
//!   {"op":"new_room","owner_sk","name","nickname","private"?,"time_ms"} -> {"state"}   owner as member 0
//!   {"op":"invite","inviter_sk","owner_vk","state","invitee_vk"}       -> {"member","secret"?}
//!   {"op":"message","author_sk","owner_vk","state","text","time_ms",   -> {"delta"}   a signed text message
//!    "join"?: {"member","chain"?,"secret"?}, "nickname"?}
//!   {"op":"kick","owner_sk","state","target_vk","time_ms"}            -> {"delta"}   ban, and in a private room a new
//!    secret version for everyone else (the banned member keeps only what they could already read)
//!   {"op":"apply","owner_vk","state","delta"}                         -> {"state"}   what the contract makes of a delta
//!   {"op":"read","owner_vk","state","member_sk"?,"secret"?}           -> {"name","private","members","messages"}
//!    (`secret`: the blob an invitation carried, so an invitee reads the room before their first message files it)
//!   {"op":"pointer","state"}                                          -> {"version","code_hash"}
//! Errors come back as {"error"}.
//!
//! A room keeps only members with messages in it, so a member writing for the first time (or after being pruned)
//! sends their invitation (`join.member`, plus any inviters the room no longer holds in `join.chain`) with the message.
//! In a private room everything a member reads is sealed with the room secret, which the owner hands each member as
//! an owner-signed blob encrypted to the member's key: only the owner can invite there, and the invitation carries
//! that blob (`secret`), which the invitee's first message files in the room. The owner's own secret is derived from
//! the owner key (river-core's `derive_room_secret`), so the owner never has to store it.

use ed25519_dalek::{SigningKey, VerifyingKey};
use freenet_scaffold::ComposableState;
use river_core::ecies::{decrypt_secret_from_member_blob_raw, decrypt_with_symmetric_key, encrypt_secret_for_member, encrypt_with_symmetric_key, seal_bytes, unseal_bytes_with_secrets};
use river_core::key_derivation::derive_room_secret;
use river_core::room_state::ban::{AuthorizedUserBan, UserBan};
use river_core::room_state::configuration::{AuthorizedConfigurationV1, Configuration};
use river_core::room_state::content::{TextContentV1, CONTENT_TYPE_TEXT};
use river_core::room_state::member::{AuthorizedMember, Member, MemberId, MembersDelta};
use river_core::room_state::member_info::{AuthorizedMemberInfo, MemberInfo};
use river_core::room_state::message::{AuthorizedMessageV1, MessageV1, RoomMessageBody};
use river_core::room_state::privacy::{PrivacyMode, RoomCipherSpec, RoomDisplayMetadata, SealedBytes};
use river_core::room_state::secret::{AuthorizedEncryptedSecretForMember, AuthorizedSecretVersionRecord, EncryptedSecretForMemberV1, SecretVersionRecordV1, SecretsDelta};
use river_core::room_state::{ChatRoomParametersV1, ChatRoomStateV1, ChatRoomStateV1Delta};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Deserialize)]
struct Join {
    member: String,
    #[serde(default)]
    chain: Vec<String>,
    secret: Option<String>,
}

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
enum Req {
    Params { owner_vk: String },
    NewRoom { owner_sk: String, name: String, nickname: String, #[serde(default)] private: bool, time_ms: u64 },
    Invite { inviter_sk: String, owner_vk: String, state: String, invitee_vk: String },
    Message { author_sk: String, owner_vk: String, state: String, text: String, time_ms: u64, join: Option<Join>, nickname: Option<String> },
    Kick { owner_sk: String, state: String, target_vk: String, time_ms: u64 },
    Apply { owner_vk: String, state: String, delta: String },
    Read { owner_vk: String, state: String, member_sk: Option<String>, secret: Option<String> },
    Pointer { state: String },
}

/// River's author key (`river:v1:vk:9Ebskq4y7NvJpTQTrF1FAxU8g6bR4Rhe4TRikXba55EJ` in River's FREENET.md): the whole
/// trust anchor of pointer resolution.
pub const RIVER_AUTHOR_VK: &str = "7a597ab5353d99b22f1f9d366536584fa444233c7fa0b0adad6bcd55c973d683";
pub const ROOM_CONTRACT_APP_ID: &[u8] = b"river.room-contract";

/// Decode and verify a 100-byte pointer record: version (u32 BE) || code hash || Ed25519 signature over
/// `freenet-pointer/state-v1 || params || version || code hash`, params = author key || app id. verify_strict, as the
/// pointer contract does.
fn pointer(state: &str) -> R<(u32, [u8; 32])> {
    let b = hex::decode(state).map_err(|e| e.to_string())?;
    if b.len() != 100 {
        return Err("a pointer record is exactly 100 bytes".into());
    }
    let version = u32::from_be_bytes(b[..4].try_into().unwrap());
    if version == 0 {
        return Err("pointer version 0".into());
    }
    let author = vk(RIVER_AUTHOR_VK)?;
    let mut msg = b"freenet-pointer/state-v1".to_vec();
    msg.extend_from_slice(author.as_bytes());
    msg.extend_from_slice(ROOM_CONTRACT_APP_ID);
    msg.extend_from_slice(&b[..36]);
    let sig = ed25519_dalek::Signature::from_bytes(&b[36..].try_into().unwrap());
    author.verify_strict(&msg, &sig).map_err(|_| "pointer record not signed by River".to_string())?;
    Ok((version, b[4..36].try_into().unwrap()))
}

type R<T> = Result<T, String>;

fn key32(h: &str) -> R<[u8; 32]> {
    hex::decode(h).map_err(|e| e.to_string())?.try_into().map_err(|_| "key must be 32 bytes".to_string())
}
fn sk(h: &str) -> R<SigningKey> {
    Ok(SigningKey::from_bytes(&key32(h)?))
}
fn vk(h: &str) -> R<VerifyingKey> {
    VerifyingKey::from_bytes(&key32(h)?).map_err(|e| e.to_string())
}
fn cbor<T: serde::Serialize>(v: &T) -> R<String> {
    let mut b = Vec::new();
    ciborium::ser::into_writer(v, &mut b).map_err(|e| e.to_string())?;
    Ok(hex::encode(b))
}
fn uncbor<T: serde::de::DeserializeOwned>(h: &str) -> R<T> {
    ciborium::de::from_reader(hex::decode(h).map_err(|e| e.to_string())?.as_slice()).map_err(|e| e.to_string())
}
fn params(owner: &str) -> R<ChatRoomParametersV1> {
    Ok(ChatRoomParametersV1 { owner: vk(owner)? })
}
fn is_private(s: &ChatRoomStateV1) -> bool {
    s.configuration.configuration.privacy_mode == PrivacyMode::Private
}
fn time(ms: u64) -> SystemTime {
    UNIX_EPOCH + Duration::from_millis(ms)
}

/// The room secrets `me` can open, by version: the owner derives them, a member opens the blobs addressed to them
/// (in the room, or the one their invitation carries).
fn secrets_of(s: &ChatRoomStateV1, p: &ChatRoomParametersV1, me: &SigningKey, extra: Option<&AuthorizedEncryptedSecretForMember>) -> HashMap<u32, [u8; 32]> {
    let mut out = HashMap::new();
    if me.verifying_key() == p.owner {
        for v in &s.secrets.versions {
            out.insert(v.record.version, derive_room_secret(&me.to_bytes(), &p.owner, v.record.version));
        }
    }
    let my_id: MemberId = me.verifying_key().into();
    for b in s.secrets.encrypted_secrets.iter().chain(extra).filter(|b| b.secret.member_id == my_id) {
        if let Ok(k) = decrypt_secret_from_member_blob_raw(&b.secret.ciphertext, &b.secret.nonce, &b.secret.sender_ephemeral_public_key, me) {
            out.insert(b.secret.secret_version, k); // a blob wins over a derived secret: rooms made by River's UI use random ones
        }
    }
    out
}

/// A value as the room stores it: plain in a public room, sealed under the current secret in a private one.
fn seal(s: &ChatRoomStateV1, secrets: &HashMap<u32, [u8; 32]>, plain: &[u8]) -> R<SealedBytes> {
    if !is_private(s) {
        return Ok(SealedBytes::public(plain.to_vec()));
    }
    let v = s.secrets.current_version;
    let key = secrets.get(&v).ok_or(format!("no room secret v{v} for this key yet"))?;
    Ok(seal_bytes(plain, key, v))
}

fn open(sealed: &SealedBytes, secrets: &HashMap<u32, [u8; 32]>) -> Option<String> {
    unseal_bytes_with_secrets(sealed, secrets).ok().map(|b| String::from_utf8_lossy(&b).into_owned())
}

fn handle(req: Req) -> R<Value> {
    Ok(match req {
        Req::Params { owner_vk } => json!({ "params": cbor(&params(&owner_vk)?)? }),
        Req::Pointer { state } => {
            let (version, code_hash) = pointer(&state)?;
            json!({ "version": version, "code_hash": hex::encode(code_hash) })
        }
        Req::NewRoom { owner_sk, name, nickname, private, time_ms } => {
            let owner = sk(&owner_sk)?;
            let p = ChatRoomParametersV1 { owner: owner.verifying_key() };
            if let Some(why) = river_core::room_state::configuration::new_room_refusal(&p, &name, &nickname) {
                return Err(why.to_string());
            }
            let mut state = ChatRoomStateV1::default();
            if private {
                let record = SecretVersionRecordV1 { version: 0, cipher_spec: RoomCipherSpec::Aes256Gcm, created_at: time(time_ms) };
                state.secrets.versions.push(AuthorizedSecretVersionRecord::new(record, &owner));
                let secret = derive_room_secret(&owner.to_bytes(), &p.owner, 0);
                let (ciphertext, nonce, eph) = encrypt_secret_for_member(&secret, &p.owner);
                let blob = EncryptedSecretForMemberV1 { member_id: p.owner.into(), secret_version: 0, ciphertext, nonce, sender_ephemeral_public_key: eph.to_bytes(), provider: p.owner.into() };
                state.secrets.encrypted_secrets.push(AuthorizedEncryptedSecretForMember::new(blob, &owner));
                state.configuration.configuration.privacy_mode = PrivacyMode::Private; // so `seal` below seals
            }
            let secrets = secrets_of(&state, &p, &owner, None);
            let config = Configuration {
                owner_member_id: p.owner.into(),
                privacy_mode: if private { PrivacyMode::Private } else { PrivacyMode::Public },
                display: RoomDisplayMetadata { name: seal(&state, &secrets, name.as_bytes())?, description: None },
                ..Configuration::default()
            };
            state.configuration = AuthorizedConfigurationV1::new(config, &owner);
            let info = MemberInfo { member_id: p.owner.into(), version: 0, preferred_nickname: seal(&state, &secrets, nickname.as_bytes())?, deputies: Vec::new() };
            state.member_info.member_info.push(AuthorizedMemberInfo::new(info, &owner));
            json!({ "state": cbor(&state)? })
        }
        Req::Invite { inviter_sk, owner_vk, state, invitee_vk } => {
            let (inviter, p, invitee) = (sk(&inviter_sk)?, params(&owner_vk)?, vk(&invitee_vk)?);
            let s: ChatRoomStateV1 = uncbor(&state)?;
            let member = Member { owner_member_id: p.owner.into(), invited_by: inviter.verifying_key().into(), member_vk: invitee };
            let mut out = json!({ "member": cbor(&AuthorizedMember::new(member, &inviter))? });
            if is_private(&s) {
                if inviter.verifying_key() != p.owner {
                    return Err("only the room owner can invite to a private room".into()); // only the owner signs secret blobs
                }
                let v = s.secrets.current_version;
                let secret = derive_room_secret(&inviter.to_bytes(), &p.owner, v);
                let secret = secrets_of(&s, &p, &inviter, None).get(&v).copied().unwrap_or(secret);
                let (ciphertext, nonce, eph) = encrypt_secret_for_member(&secret, &invitee);
                let blob = EncryptedSecretForMemberV1 { member_id: invitee.into(), secret_version: v, ciphertext, nonce, sender_ephemeral_public_key: eph.to_bytes(), provider: p.owner.into() };
                out["secret"] = json!(cbor(&AuthorizedEncryptedSecretForMember::new(blob, &inviter))?);
            }
            out
        }
        Req::Message { author_sk, owner_vk, state, text, time_ms, join, nickname } => {
            let (author, p) = (sk(&author_sk)?, params(&owner_vk)?);
            let s: ChatRoomStateV1 = uncbor(&state)?;
            let mut delta = ChatRoomStateV1Delta::default();
            let mut blob = None;
            if let Some(join) = join {
                let member: AuthorizedMember = uncbor(&join.member)?;
                if member.member.member_vk != author.verifying_key() {
                    return Err("this invitation is for another key".into());
                }
                let mut added = join.chain.iter().map(|c| uncbor(c)).collect::<R<Vec<AuthorizedMember>>>()?;
                added.push(member);
                delta.members = Some(MembersDelta::new(added));
                blob = join.secret.as_deref().map(uncbor::<AuthorizedEncryptedSecretForMember>).transpose()?;
            }
            let secrets = secrets_of(&s, &p, &author, blob.as_ref());
            if let Some(nick) = nickname {
                let info = MemberInfo { member_id: author.verifying_key().into(), version: 0, preferred_nickname: seal(&s, &secrets, nick.as_bytes())?, deputies: Vec::new() };
                delta.member_info = Some(vec![AuthorizedMemberInfo::new_with_member_key(info, &author)]);
            }
            if let Some(b) = blob {
                delta.secrets = Some(SecretsDelta { current_version: None, new_versions: vec![], new_encrypted_secrets: vec![b] });
            }
            let content = if is_private(&s) {
                let v = s.secrets.current_version;
                let key = secrets.get(&v).ok_or(format!("no room secret v{v} for this key yet"))?;
                let (ciphertext, nonce) = encrypt_with_symmetric_key(key, &TextContentV1::new(text).encode());
                RoomMessageBody::private_text(ciphertext, nonce, v)
            } else {
                RoomMessageBody::public(text)
            };
            let message = MessageV1 { room_owner: p.owner.into(), author: author.verifying_key().into(), time: time(time_ms), content };
            delta.recent_messages = Some(vec![AuthorizedMessageV1::new(message, &author)]);
            json!({ "delta": cbor(&delta)? })
        }
        Req::Kick { owner_sk, state, target_vk, time_ms } => {
            let owner = sk(&owner_sk)?;
            let (p, target) = (ChatRoomParametersV1 { owner: owner.verifying_key() }, vk(&target_vk)?);
            let s: ChatRoomStateV1 = uncbor(&state)?;
            let (owner_id, target_id): (MemberId, MemberId) = (p.owner.into(), target.into());
            let ban = UserBan { owner_member_id: owner_id, banned_at: time(time_ms), banned_user: target_id };
            let mut delta = ChatRoomStateV1Delta { bans: Some(vec![AuthorizedUserBan::new(ban, owner_id, &owner)]), ..Default::default() };
            if is_private(&s) {
                // as River's rotate_secret: the next version, derived from the owner key, sealed for everyone but the banned
                let v = s.secrets.current_version.checked_add(1).ok_or("secret version overflow")?;
                let record = SecretVersionRecordV1 { version: v, cipher_spec: RoomCipherSpec::Aes256Gcm, created_at: time(time_ms) };
                let secret = derive_room_secret(&owner.to_bytes(), &p.owner, v);
                let keep = std::iter::once(p.owner).chain(s.members.members.iter().map(|m| m.member.member_vk)).filter(|k| *k != target);
                let blobs = keep
                    .map(|k| {
                        let (ciphertext, nonce, eph) = encrypt_secret_for_member(&secret, &k);
                        let blob = EncryptedSecretForMemberV1 { member_id: k.into(), secret_version: v, ciphertext, nonce, sender_ephemeral_public_key: eph.to_bytes(), provider: owner_id };
                        AuthorizedEncryptedSecretForMember::new(blob, &owner)
                    })
                    .collect();
                delta.secrets = Some(SecretsDelta { current_version: Some(v), new_versions: vec![AuthorizedSecretVersionRecord::new(record, &owner)], new_encrypted_secrets: blobs });
            }
            json!({ "delta": cbor(&delta)? })
        }
        Req::Apply { owner_vk, state, delta } => {
            let p = params(&owner_vk)?;
            let mut s: ChatRoomStateV1 = uncbor(&state)?;
            let d: ChatRoomStateV1Delta = uncbor(&delta)?;
            s.apply_delta(&s.clone(), &p, &Some(d))?;
            s.verify(&s, &p)?;
            json!({ "state": cbor(&s)? })
        }
        Req::Read { owner_vk, state, member_sk, secret } => {
            let p = params(&owner_vk)?;
            let s: ChatRoomStateV1 = uncbor(&state)?;
            let blob = secret.as_deref().map(uncbor::<AuthorizedEncryptedSecretForMember>).transpose()?;
            let secrets = match member_sk {
                Some(k) => secrets_of(&s, &p, &sk(&k)?, blob.as_ref()),
                None => HashMap::new(),
            };
            let owner_id: MemberId = p.owner.into();
            let nick = |id: MemberId| s.member_info.member_info.iter().find(|i| i.member_info.member_id == id).and_then(|i| open(&i.member_info.preferred_nickname, &secrets));
            // authors are member ids (hashes): map them back to keys through the member list
            let mut keys = vec![(owner_id, p.owner)];
            keys.extend(s.members.members.iter().map(|m| (m.member.id(), m.member.member_vk)));
            let key_of = |id: MemberId| keys.iter().find(|(k, _)| *k == id).map(|(_, v)| hex::encode(v.as_bytes()));
            let members: Vec<Value> = keys
                .iter()
                .map(|(id, v)| json!({ "vk": hex::encode(v.as_bytes()), "nickname": nick(*id), "owner": *id == owner_id }))
                .collect();
            let messages: Vec<Value> = s
                .recent_messages
                .messages
                .iter()
                .filter_map(|m| {
                    // edits, reactions, events and bodies we hold no secret for are not shown as text
                    let text = match &m.message.content {
                        RoomMessageBody::Private { content_type, ciphertext, nonce, secret_version, .. } if *content_type == CONTENT_TYPE_TEXT => {
                            let plain = decrypt_with_symmetric_key(secrets.get(secret_version)?, ciphertext, nonce).ok()?;
                            TextContentV1::decode(&plain).ok()?.text
                        }
                        body => body.as_public_string()?,
                    };
                    let ms = m.message.time.duration_since(UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64);
                    Some(json!({ "id": m.id().to_string(), "author": key_of(m.message.author), "time_ms": ms, "text": text }))
                })
                .collect();
            let name = open(&s.configuration.configuration.display.name, &secrets);
            json!({ "name": name, "private": is_private(&s), "members": members, "messages": messages })
        }
    })
}

/// The JSON entry point (also what the tests drive).
pub fn run(input: &str) -> String {
    let out = serde_json::from_str::<Req>(input).map_err(|e| e.to_string()).and_then(handle);
    match out {
        Ok(v) => v.to_string(),
        Err(e) => json!({ "error": e }).to_string(),
    }
}

// Randomness for message nonces: the browser's crypto.getRandomValues, which river.ts hands in as `env.random_fill`.
#[cfg(target_arch = "wasm32")]
mod rng {
    #[link(wasm_import_module = "env")]
    extern "C" {
        fn random_fill(ptr: *mut u8, len: usize);
    }
    fn fill(buf: &mut [u8]) -> Result<(), getrandom::Error> {
        unsafe { random_fill(buf.as_mut_ptr(), buf.len()) };
        Ok(())
    }
    getrandom::register_custom_getrandom!(fill);
}

// Raw WASM ABI for the browser: alloc a buffer, write the request, call, read (ptr << 32 | len), dealloc both.
#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(len);
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

/// # Safety
/// `ptr` must come from `alloc(len)` (or `call`) and not be freed twice.
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    drop(Vec::from_raw_parts(ptr, 0, len));
}

/// # Safety
/// `ptr` must point to `len` bytes of UTF-8 written into a buffer from `alloc`.
#[no_mangle]
pub unsafe extern "C" fn call(ptr: *const u8, len: usize) -> u64 {
    let input = String::from_utf8_lossy(std::slice::from_raw_parts(ptr, len));
    let mut out = run(&input).into_bytes();
    out.shrink_to_fit();
    let (p, n) = (out.as_mut_ptr(), out.len());
    std::mem::forget(out);
    ((p as u64) << 32) | n as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ok(req: Value) -> Value {
        let v: Value = serde_json::from_str(&run(&req.to_string())).unwrap();
        assert!(v.get("error").is_none(), "{req} -> {v}");
        v
    }
    fn hx(seed: u8) -> (String, String) {
        let k = SigningKey::from_bytes(&[seed; 32]);
        (hex::encode(k.to_bytes()), hex::encode(k.verifying_key().as_bytes()))
    }
    fn apply(owner_vk: &str, state: &Value, delta: &Value) -> Value {
        ok(json!({"op":"apply","owner_vk":owner_vk,"state":state,"delta":delta}))["state"].clone()
    }
    fn say(sk: &str, owner_vk: &str, state: &Value, text: &str, t: u64, extra: Value) -> Value {
        let mut req = json!({"op":"message","author_sk":sk,"owner_vk":owner_vk,"state":state,"text":text,"time_ms":t});
        req.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
        apply(owner_vk, state, &ok(req)["delta"])
    }
    fn texts(view: &Value) -> Vec<(Value, Value)> {
        view["messages"].as_array().unwrap().iter().map(|m| (m["author"].clone(), m["text"].clone())).collect()
    }

    #[test]
    fn public_room_lifecycle() {
        let ((ann_sk, ann), (bob_sk, bob), (eve_sk, _)) = (hx(1), hx(2), hx(3));
        let state = ok(json!({"op":"new_room","owner_sk":ann_sk,"name":"Radica","nickname":"Ann","time_ms":1}))["state"].clone();
        let state = say(&ann_sk, &ann, &state, "hello", 1_700_000_000_000, json!({}));
        // a stranger's message is dropped by the room's own rules (River drops, it does not error)
        assert_eq!(say(&eve_sk, &ann, &state, "spam", 1_700_000_000_001, json!({})), state);

        let member = ok(json!({"op":"invite","inviter_sk":ann_sk,"owner_vk":ann,"state":state,"invitee_vk":bob}))["member"].clone();
        let state = say(&bob_sk, &ann, &state, "hi Ann", 1_700_000_000_002, json!({"join":{"member":member},"nickname":"Bob"}));

        let view = ok(json!({"op":"read","owner_vk":ann,"state":state}));
        assert_eq!((view["name"].clone(), view["private"].clone()), (json!("Radica"), json!(false)));
        assert_eq!(texts(&view), vec![(json!(ann), json!("hello")), (json!(bob), json!("hi Ann"))]);
        assert!(view["members"].as_array().unwrap().iter().any(|m| m["vk"] == json!(bob) && m["nickname"] == "Bob"));

        let stolen = json!({"op":"message","author_sk":eve_sk,"owner_vk":ann,"state":state,"text":"x","time_ms":1,"join":{"member":member}});
        assert!(run(&stolen.to_string()).contains("another key"));
    }

    #[test]
    fn private_room_is_sealed_from_everyone_but_its_members() {
        let ((ann_sk, ann), (bob_sk, bob), (eve_sk, eve)) = (hx(1), hx(2), hx(3));
        let state = ok(json!({"op":"new_room","owner_sk":ann_sk,"name":"SOS","nickname":"Ann","private":true,"time_ms":1}))["state"].clone();
        let state = say(&ann_sk, &ann, &state, "secret plan", 1_700_000_000_000, json!({}));

        // only the owner can invite, and the invitation carries Bob's sealed copy of the room secret
        assert!(run(&json!({"op":"invite","inviter_sk":bob_sk,"owner_vk":ann,"state":state,"invitee_vk":eve}).to_string()).contains("only the room owner"));
        let inv = ok(json!({"op":"invite","inviter_sk":ann_sk,"owner_vk":ann,"state":state,"invitee_vk":bob}));
        // Bob reads the room before writing, with the secret his invitation carries
        let before = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":bob_sk,"secret":inv["secret"]}));
        assert_eq!((before["name"].clone(), texts(&before).len()), (json!("SOS"), 1));
        let join = json!({"member":inv["member"],"secret":inv["secret"]});
        let state = say(&bob_sk, &ann, &state, "count me in", 1_700_000_000_001, json!({"join":join,"nickname":"Bob"}));

        for (who, sk) in [("owner", &ann_sk), ("member", &bob_sk)] {
            let view = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":sk}));
            assert_eq!(view["name"], "SOS", "{who}");
            assert_eq!(texts(&view), vec![(json!(ann), json!("secret plan")), (json!(bob), json!("count me in"))], "{who}");
            assert!(view["members"].as_array().unwrap().iter().any(|m| m["vk"] == json!(bob) && m["nickname"] == "Bob"), "{who}");
        }
        // Bob can now write without his invitation: his secret is in the room
        let state = say(&bob_sk, &ann, &state, "again", 1_700_000_000_002, json!({}));
        assert_eq!(texts(&ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":ann_sk}))).len(), 3);

        // Ann kicks Carl: he is gone, and what is said after is sealed under a secret he never got
        let (carl_sk, carl) = hx(4);
        let inv = ok(json!({"op":"invite","inviter_sk":ann_sk,"owner_vk":ann,"state":state,"invitee_vk":carl}));
        let state = say(&carl_sk, &ann, &state, "hi all", 1_700_000_000_003, json!({"join":{"member":inv["member"],"secret":inv["secret"]}}));
        let kick = ok(json!({"op":"kick","owner_sk":ann_sk,"state":state,"target_vk":carl,"time_ms":1_700_000_000_004u64}))["delta"].clone();
        let state = apply(&ann, &state, &kick);
        let state = say(&bob_sk, &ann, &state, "after carl", 1_700_000_000_005, json!({}));
        let carl_view = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":carl_sk}));
        assert!(!carl_view["members"].as_array().unwrap().iter().any(|m| m["vk"] == json!(carl)), "carl still a member");
        assert!(!texts(&carl_view).iter().any(|(_, t)| t == "after carl"), "carl reads the new secret");
        assert!(texts(&ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":ann_sk}))).iter().any(|(_, t)| t == "after carl"));
        assert!(run(&json!({"op":"message","author_sk":carl_sk,"owner_vk":ann,"state":state,"text":"x","time_ms":1_700_000_000_006u64}).to_string()).contains("no room secret"));

        // anyone else sees no name, no nicknames and no text, and the state on the wire holds no plaintext
        let view = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":eve_sk}));
        assert_eq!((view["name"].clone(), view["private"].clone(), texts(&view).len()), (Value::Null, json!(true), 0));
        let wire = hex::decode(state.as_str().unwrap()).unwrap();
        for plain in ["SOS", "secret plan", "count me in", "Bob"] {
            assert!(!wire.windows(plain.len()).any(|w| w == plain.as_bytes()), "{plain} in clear");
        }
    }

    // River's published record (pointer-records.toml at the pinned commit): version 7, the bundled room contract.
    const RECORD: &str = "00000007fa9e59e87532bc9681e8fef903f6d35a1207c25a0f0d8cca2c92e2f31761a4f9b216297f9293599742ce10f8f408227d233183511b096448472155d0dbf6ae414a5ff844091a2d1d32769649a383d0ada6af3ce57c422829acdb826d601c3d05";

    #[test]
    fn river_pointer_record_verifies_and_tampering_does_not() {
        let v = ok(json!({"op":"pointer","state":RECORD}));
        assert_eq!(v["version"], 7);
        assert_eq!(v["code_hash"], "fa9e59e87532bc9681e8fef903f6d35a1207c25a0f0d8cca2c92e2f31761a4f9");
        let mut bumped = RECORD.to_string();
        bumped.replace_range(7..8, "8"); // version 8, same signature
        assert!(run(&json!({"op":"pointer","state":bumped}).to_string()).contains("not signed by River"));
        assert!(run(&json!({"op":"pointer","state":&RECORD[..198]}).to_string()).contains("100 bytes"));
    }
}
