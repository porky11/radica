//! River rooms for Radica's chat UI. A small wrapper around `river-core`, compiled to WASM for the browser: it builds
//! and reads River room states and deltas, so Radica's rooms live under River's own room contract and stay usable
//! from River and riverctl. Signatures and encryption are river-core's own, never re-implemented in TypeScript.
//!
//! One entry point, JSON in and out (keys and CBOR blobs as hex):
//!   {"op":"params","owner_vk"}                                        -> {"params"}  contract params of a room
//!   {"op":"new_room","owner_sk","name","nickname","private"?,"time_ms"} -> {"state"}   owner as member 0
//!   {"op":"invite","inviter_sk","owner_vk","state","invitee_vk"}       -> {"member","secret"?}
//!   {"op":"message","author_sk","owner_vk","state","text","time_ms",   -> {"delta"}   a signed text message
//!    "join"?: {"member","chain"?,"secret"?}, "nickname"?, "reply_to"?}  (reply_to: the id of the message answered)
//!   {"op":"act","author_sk","owner_vk","state","action","target","text"?,"emoji"?,"time_ms"} -> {"delta"}
//!    River's message actions: action = edit | delete (own messages) | react | unreact; target = a message id
//!   {"op":"kick","banner_sk","owner_vk","state","target_vk","time_ms"} -> {"delta"}  ban, by the owner or one of its
//!    deputies; banned by the owner in a private room, also a new secret version for everyone else
//!   {"op":"rotate","owner_sk","state","time_ms"}                     -> {"delta"}   a new secret version for the members
//!    (after a deputy's ban: only the owner signs secrets; `read` says when, as `rotate_due`)
//!   {"op":"deputies","owner_sk","state","deputies":[vk],"time_ms"}    -> {"delta"}   the owner's moderators (River's deputy
//!    ban authority: an owner's deputy may ban anyone below the owner; dropping one un-enforces their bans)
//!   {"op":"apply","owner_vk","state","delta"}                         -> {"state"}   what the contract makes of a delta
//!   {"op":"read","owner_vk","state","member_sk"?,"secret"?}           -> {"name","private","members","messages"}
//!    (`secret`: the blob an invitation carried, so an invitee reads the room before their first message files it)
//!   {"op":"pointer","state"}                                          -> {"version","code_hash"}
//!   {"op":"invitation","owner_sk","state","invitee_sk"}               -> {"code"}    a River invitation (base58 CBOR, as
//!    River's UI and riverctl make and read them): the invitee's key, membership and the room's secrets in clear
//!   {"op":"accept","code"}                                            -> {"owner_vk","sk","member","secrets"}
//!   {"op":"import_identity","token"}                                 -> {"owner_vk","sk","member","chain","nickname","room_name","secrets"}
//!    River's "Export ID" token (-----BEGIN RIVER IDENTITY-----): one's key and membership in one room
//!   {"op":"export_identity","sk","owner_vk","state","member"?,"chain"?,"secrets"?,"nickname"?} -> {"token"}
//! `message` and `read` also take `secrets` ({version: secret hex}): the plain secrets a River invitation carries.
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
use river_core::room_state::identity::IdentityExport;
use river_core::room_state::ban::{AuthorizedUserBan, UserBan};
use river_core::room_state::configuration::{AuthorizedConfigurationV1, Configuration};
use river_core::room_state::content::{
    ActionContentV1, DecodedContent, ReplyContentV1, TextContentV1, ACTION_CONTENT_VERSION, CONTENT_TYPE_ACTION, CONTENT_TYPE_REPLY, CONTENT_TYPE_TEXT, REPLY_CONTENT_VERSION, TEXT_CONTENT_VERSION,
};
use river_core::room_state::message::MessageId;
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
    Message { author_sk: String, owner_vk: String, state: String, text: String, time_ms: u64, join: Option<Join>, nickname: Option<String>, #[serde(default)] secrets: HashMap<String, String>, reply_to: Option<String> },
    Act { author_sk: String, owner_vk: String, state: String, action: String, target: String, text: Option<String>, emoji: Option<String>, time_ms: u64, #[serde(default)] secrets: HashMap<String, String> },
    Kick { banner_sk: String, owner_vk: String, state: String, target_vk: String, time_ms: u64 },
    Rotate { owner_sk: String, state: String, time_ms: u64 },
    Deputies { owner_sk: String, state: String, deputies: Vec<String> },
    Apply { owner_vk: String, state: String, delta: String },
    Read { owner_vk: String, state: String, member_sk: Option<String>, secret: Option<String>, #[serde(default)] secrets: HashMap<String, String> },
    Pointer { state: String },
    Invitation { owner_sk: String, state: String, invitee_sk: String },
    Accept { code: String },
    ImportIdentity { token: String },
    ExportIdentity { sk: String, owner_vk: String, state: String, member: Option<String>, #[serde(default)] chain: Vec<String>, #[serde(default)] secrets: HashMap<String, String>, nickname: Option<String> },
}

/// River's invitation, field for field as River's UI defines it (ui/src/components/members.rs), so codes go both ways.
#[derive(serde::Serialize, Deserialize)]
struct Invitation {
    room: VerifyingKey,
    invitee_signing_key: SigningKey,
    invitee: AuthorizedMember,
    #[serde(default)]
    room_secrets: Vec<(u32, [u8; 32])>,
}

/// Plain secrets handed in (`{version: hex}`) added to those `me` opens.
fn with_plain(mut secrets: HashMap<u32, [u8; 32]>, plain: &HashMap<String, String>) -> R<HashMap<u32, [u8; 32]>> {
    for (v, h) in plain {
        secrets.entry(v.parse().map_err(|_| "bad secret version".to_string())?).or_insert(key32(h)?);
    }
    Ok(secrets)
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

/// A message body as River writes it: CBOR content, sealed under the current secret in a private room.
fn body(s: &ChatRoomStateV1, secrets: &HashMap<u32, [u8; 32]>, content_type: u32, version: u32, plain: Vec<u8>) -> R<RoomMessageBody> {
    if !is_private(s) {
        return Ok(RoomMessageBody::public_raw(content_type, version, plain));
    }
    let v = s.secrets.current_version;
    let key = secrets.get(&v).ok_or(format!("no room secret v{v} for this key yet"))?;
    let (ciphertext, nonce) = encrypt_with_symmetric_key(key, &plain);
    Ok(RoomMessageBody::private(content_type, version, ciphertext, nonce, v))
}

/// Message ids travel as the decimal of River's hash.
fn msg_id(id: &str) -> R<MessageId> {
    Ok(MessageId(freenet_scaffold::util::FastHash(id.parse().map_err(|_| "bad message id".to_string())?)))
}

/// As River's rotate_secret: the next version, derived from the owner key, sealed for every member but `skip`
/// (bans have already taken the banned out of the member list).
fn rotation(s: &ChatRoomStateV1, owner: &SigningKey, skip: Option<VerifyingKey>, time_ms: u64) -> R<SecretsDelta> {
    if !is_private(s) {
        return Err("a public room has no secret".into());
    }
    let owner_vk = owner.verifying_key();
    let v = s.secrets.current_version.checked_add(1).ok_or("secret version overflow")?;
    let record = SecretVersionRecordV1 { version: v, cipher_spec: RoomCipherSpec::Aes256Gcm, created_at: time(time_ms) };
    let secret = derive_room_secret(&owner.to_bytes(), &owner_vk, v);
    let keep = std::iter::once(owner_vk).chain(s.members.members.iter().map(|m| m.member.member_vk)).filter(|k| Some(*k) != skip);
    let blobs = keep
        .map(|k| {
            let (ciphertext, nonce, eph) = encrypt_secret_for_member(&secret, &k);
            let blob = EncryptedSecretForMemberV1 { member_id: k.into(), secret_version: v, ciphertext, nonce, sender_ephemeral_public_key: eph.to_bytes(), provider: owner_vk.into() };
            AuthorizedEncryptedSecretForMember::new(blob, owner)
        })
        .collect();
    Ok(SecretsDelta { current_version: Some(v), new_versions: vec![AuthorizedSecretVersionRecord::new(record, owner)], new_encrypted_secrets: blobs })
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
        Req::Message { author_sk, owner_vk, state, text, time_ms, join, nickname, secrets: plain, reply_to } => {
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
            let secrets = with_plain(secrets_of(&s, &p, &author, blob.as_ref()), &plain)?;
            if let Some(nick) = nickname {
                let info = MemberInfo { member_id: author.verifying_key().into(), version: 0, preferred_nickname: seal(&s, &secrets, nick.as_bytes())?, deputies: Vec::new() };
                delta.member_info = Some(vec![AuthorizedMemberInfo::new_with_member_key(info, &author)]);
            }
            if let Some(b) = blob {
                delta.secrets = Some(SecretsDelta { current_version: None, new_versions: vec![], new_encrypted_secrets: vec![b] });
            }
            let content = match reply_to {
                // name and preview are the replier's own, unvalidated and shown by no client (River #482): left empty
                Some(id) => body(&s, &secrets, CONTENT_TYPE_REPLY, REPLY_CONTENT_VERSION, ReplyContentV1::new(text, msg_id(&id)?, String::new(), String::new()).encode())?,
                None => body(&s, &secrets, CONTENT_TYPE_TEXT, TEXT_CONTENT_VERSION, TextContentV1::new(text).encode())?,
            };
            let message = MessageV1 { room_owner: p.owner.into(), author: author.verifying_key().into(), time: time(time_ms), content };
            delta.recent_messages = Some(vec![AuthorizedMessageV1::new(message, &author)]);
            json!({ "delta": cbor(&delta)? })
        }
        Req::Act { author_sk, owner_vk, state, action, target, text, emoji, time_ms, secrets: plain } => {
            let (author, p) = (sk(&author_sk)?, params(&owner_vk)?);
            let s: ChatRoomStateV1 = uncbor(&state)?;
            let secrets = with_plain(secrets_of(&s, &p, &author, None), &plain)?;
            let target = msg_id(&target)?;
            let need = |v: Option<String>, what: &str| v.ok_or(format!("{action} needs {what}"));
            let act = match action.as_str() {
                "edit" => ActionContentV1::edit(target, need(text, "text")?),
                "delete" => ActionContentV1::delete(target),
                "react" => ActionContentV1::reaction(target, need(emoji, "emoji")?),
                "unreact" => ActionContentV1::remove_reaction(target, need(emoji, "emoji")?),
                _ => return Err(format!("unknown action {action}")),
            };
            let content = body(&s, &secrets, CONTENT_TYPE_ACTION, ACTION_CONTENT_VERSION, act.encode())?;
            let message = MessageV1 { room_owner: p.owner.into(), author: author.verifying_key().into(), time: time(time_ms), content };
            json!({ "delta": cbor(&ChatRoomStateV1Delta { recent_messages: Some(vec![AuthorizedMessageV1::new(message, &author)]), ..Default::default() })? })
        }
        Req::Kick { banner_sk, owner_vk, state, target_vk, time_ms } => {
            let (banner, p, target) = (sk(&banner_sk)?, params(&owner_vk)?, vk(&target_vk)?);
            let s: ChatRoomStateV1 = uncbor(&state)?;
            let (owner_id, banner_id): (MemberId, MemberId) = (p.owner.into(), banner.verifying_key().into());
            let ban = UserBan { owner_member_id: owner_id, banned_at: time(time_ms), banned_user: target.into() };
            let mut delta = ChatRoomStateV1Delta { bans: Some(vec![AuthorizedUserBan::new(ban, banner_id, &banner)]), ..Default::default() };
            if is_private(&s) && banner.verifying_key() == p.owner {
                delta.secrets = Some(rotation(&s, &banner, Some(target), time_ms)?);
            }
            json!({ "delta": cbor(&delta)? })
        }
        Req::Rotate { owner_sk, state, time_ms } => {
            let s: ChatRoomStateV1 = uncbor(&state)?;
            json!({ "delta": cbor(&ChatRoomStateV1Delta { secrets: Some(rotation(&s, &sk(&owner_sk)?, None, time_ms)?), ..Default::default() })? })
        }
        Req::Deputies { owner_sk, state, deputies } => {
            let owner = sk(&owner_sk)?;
            let s: ChatRoomStateV1 = uncbor(&state)?;
            let owner_id: MemberId = owner.verifying_key().into();
            let mine = s.member_info.member_info.iter().find(|i| i.member_info.member_id == owner_id).ok_or("the owner has no member info")?;
            let info = MemberInfo {
                version: mine.member_info.version + 1, // last write wins by version
                deputies: deputies.iter().map(|d| vk(d).map(MemberId::from)).collect::<R<_>>()?,
                ..mine.member_info.clone()
            };
            json!({ "delta": cbor(&ChatRoomStateV1Delta { member_info: Some(vec![AuthorizedMemberInfo::new(info, &owner)]), ..Default::default() })? })
        }
        Req::Invitation { owner_sk, state, invitee_sk } => {
            let (owner, invitee) = (sk(&owner_sk)?, sk(&invitee_sk)?);
            let p = ChatRoomParametersV1 { owner: owner.verifying_key() };
            let s: ChatRoomStateV1 = uncbor(&state)?;
            let member = Member { owner_member_id: p.owner.into(), invited_by: p.owner.into(), member_vk: invitee.verifying_key() };
            let mut room_secrets: Vec<(u32, [u8; 32])> = secrets_of(&s, &p, &owner, None).into_iter().collect();
            room_secrets.sort_unstable_by_key(|(v, _)| *v); // as River: a stable encoding
            let inv = Invitation { room: p.owner, invitee_signing_key: invitee, invitee: AuthorizedMember::new(member, &owner), room_secrets };
            let mut b = Vec::new();
            ciborium::ser::into_writer(&inv, &mut b).map_err(|e| e.to_string())?;
            json!({ "code": bs58::encode(b).into_string() })
        }
        Req::Accept { code } => {
            let b = bs58::decode(code.trim()).into_vec().map_err(|_| "not a River invitation code".to_string())?;
            let inv: Invitation = ciborium::de::from_reader(b.as_slice()).map_err(|_| "not a River invitation code".to_string())?;
            if inv.invitee.member.member_vk != inv.invitee_signing_key.verifying_key() {
                return Err("this invitation's key does not match its membership".into());
            }
            let secrets: HashMap<String, String> = inv.room_secrets.iter().map(|(v, k)| (v.to_string(), hex::encode(k))).collect();
            json!({ "owner_vk": hex::encode(inv.room.as_bytes()), "sk": hex::encode(inv.invitee_signing_key.to_bytes()), "member": cbor(&inv.invitee)?, "secrets": secrets })
        }
        Req::ImportIdentity { token } => {
            let id = IdentityExport::from_armored_string(&token)?; // also checks the key is the membership's
            let chain = id.invite_chain.iter().map(cbor).collect::<R<Vec<_>>>()?;
            let secrets: HashMap<String, String> = id.invitation_secrets.iter().map(|(v, k)| (v.to_string(), hex::encode(k))).collect();
            json!({ "owner_vk": hex::encode(id.room_owner.as_bytes()), "sk": hex::encode(id.signing_key.to_bytes()), "member": cbor(&id.authorized_member)?,
                "chain": chain, "nickname": id.self_nickname, "room_name": id.room_name, "secrets": secrets })
        }
        Req::ExportIdentity { sk: key, owner_vk, state, member, chain, secrets: plain, nickname } => {
            // as River's Export ID: the owner signs its own membership; a member's comes from its invitation or the room
            let (me, p) = (sk(&key)?, params(&owner_vk)?);
            let s: ChatRoomStateV1 = uncbor(&state)?;
            let my_vk = me.verifying_key();
            let (authorized_member, invite_chain) = if my_vk == p.owner {
                let id: MemberId = p.owner.into();
                (AuthorizedMember::new(Member { owner_member_id: id, invited_by: id, member_vk: p.owner }, &me), vec![])
            } else if let Some(m) = member {
                (uncbor(&m)?, chain.iter().map(|c| uncbor(c)).collect::<R<Vec<AuthorizedMember>>>()?)
            } else {
                let m = s.members.members.iter().find(|m| m.member.member_vk == my_vk).ok_or("not a member of this room")?;
                (m.clone(), s.members.get_invite_chain(m, &p).map_err(|e| format!("{e:?}"))?)
            };
            let secrets = with_plain(secrets_of(&s, &p, &me, None), &plain)?;
            let id = IdentityExport {
                room_owner: p.owner,
                signing_key: me.clone(),
                authorized_member,
                invite_chain,
                member_info: s.member_info.canonical(my_vk.into()).cloned(),
                room_name: open(&s.configuration.configuration.display.name, &secrets),
                self_nickname: nickname,
                invitation_secrets: secrets,
            };
            json!({ "token": id.to_armored_string() })
        }
        Req::Apply { owner_vk, state, delta } => {
            let p = params(&owner_vk)?;
            let mut s: ChatRoomStateV1 = uncbor(&state)?;
            let d: ChatRoomStateV1Delta = uncbor(&delta)?;
            s.apply_delta(&s.clone(), &p, &Some(d))?;
            s.verify(&s, &p)?;
            json!({ "state": cbor(&s)? })
        }
        Req::Read { owner_vk, state, member_sk, secret, secrets: plain } => {
            let p = params(&owner_vk)?;
            let s: ChatRoomStateV1 = uncbor(&state)?;
            let blob = secret.as_deref().map(uncbor::<AuthorizedEncryptedSecretForMember>).transpose()?;
            let secrets = match member_sk {
                Some(k) => secrets_of(&s, &p, &sk(&k)?, blob.as_ref()),
                None => HashMap::new(),
            };
            let secrets = with_plain(secrets, &plain)?;
            let owner_id: MemberId = p.owner.into();
            let nick = |id: MemberId| s.member_info.member_info.iter().find(|i| i.member_info.member_id == id).and_then(|i| open(&i.member_info.preferred_nickname, &secrets));
            // authors are member ids (hashes): map them back to keys through the member list
            let mut keys = vec![(owner_id, p.owner)];
            keys.extend(s.members.members.iter().map(|m| (m.member.id(), m.member.member_vk)));
            let key_of = |id: MemberId| keys.iter().find(|(k, _)| *k == id).map(|(_, v)| hex::encode(v.as_bytes()));
            let deputies = s.member_info.deputies_of(owner_id);
            let members: Vec<Value> = keys
                .iter()
                .map(|(id, v)| json!({ "vk": hex::encode(v.as_bytes()), "nickname": nick(*id), "owner": *id == owner_id, "deputy": deputies.contains(id) }))
                .collect();
            // a ban newer than the current secret: the banned one may still hold it, so the owner should rotate
            let since = s.secrets.versions.iter().find(|r| r.record.version == s.secrets.current_version).map(|r| r.record.created_at);
            let rotate_due = is_private(&s) && s.bans.0.iter().any(|b| since.is_some_and(|t| b.ban.banned_at > t));
            // open what we hold a secret for, then let River fold its actions (edits, deletions, reactions) over it
            let mut plaintext: HashMap<MessageId, Vec<u8>> = HashMap::new();
            for m in &s.recent_messages.messages {
                if let RoomMessageBody::Private { ciphertext, nonce, secret_version, .. } = &m.message.content {
                    if let Some(p) = secrets.get(secret_version).and_then(|k| decrypt_with_symmetric_key(k, ciphertext, nonce).ok()) {
                        plaintext.insert(m.id(), p);
                    }
                }
            }
            let mut folded = s.recent_messages.clone();
            folded.rebuild_actions_state_with_decrypted(&plaintext);
            let acts = &folded.actions_state;
            let messages: Vec<Value> = s
                .recent_messages
                .messages
                .iter()
                .filter(|m| !m.message.content.is_action() && !acts.deleted.contains(&m.id()))
                .filter_map(|m| {
                    let content = match &m.message.content {
                        RoomMessageBody::Private { content_type, content_version, .. } => {
                            RoomMessageBody::public_raw(*content_type, *content_version, plaintext.get(&m.id())?.clone()).decode_content()?
                        }
                        body => body.decode_content()?,
                    };
                    // events and bodies we hold no secret for are not shown
                    let (text, reply_to) = match content {
                        DecodedContent::Text(t) => (t.text, None),
                        DecodedContent::Reply(r) => (r.text, Some(r.target_message_id.0 .0.to_string())),
                        _ => return None,
                    };
                    let id = m.id();
                    let text = acts.edited_content.get(&id).cloned().unwrap_or(text);
                    let reactions: HashMap<&String, Vec<Option<String>>> =
                        acts.reactions.get(&id).map(|r| r.iter().map(|(e, who)| (e, who.iter().map(|w| key_of(*w)).collect())).collect()).unwrap_or_default();
                    let ms = m.message.time.duration_since(UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64);
                    Some(json!({ "id": id.0 .0.to_string(), "author": key_of(m.message.author), "time_ms": ms, "text": text,
                        "reply_to": reply_to, "edited": acts.edited_content.contains_key(&id), "reactions": reactions }))
                })
                .collect();
            let name = open(&s.configuration.configuration.display.name, &secrets);
            json!({ "name": name, "private": is_private(&s), "members": members, "messages": messages, "rotate_due": rotate_due })
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

        // River's actions, sealed like the rest: a reply, a reaction, an edit and a deletion
        let id_of = |state: &Value, text: &str| {
            let v = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":ann_sk}));
            v["messages"].as_array().unwrap().iter().find(|m| m["text"] == text).unwrap()["id"].as_str().unwrap().to_string()
        };
        let act = |state: &Value, sk: &str, action: &str, target: &str, extra: Value, t: u64| {
            let mut req = json!({"op":"act","author_sk":sk,"owner_vk":ann,"state":state,"action":action,"target":target,"time_ms":t});
            req.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
            apply(&ann, state, &ok(req)["delta"])
        };
        let plan = id_of(&state, "secret plan");
        let state = say(&bob_sk, &ann, &state, "sounds good", 1_700_000_000_010, json!({"reply_to":plan}));
        let state = act(&state, &bob_sk, "react", &plan, json!({"emoji":"👍"}), 1_700_000_000_011);
        let again = id_of(&state, "again");
        let state = act(&state, &bob_sk, "edit", &again, json!({"text":"again!"}), 1_700_000_000_012);
        let state = act(&state, &ann_sk, "edit", &again, json!({"text":"hijacked"}), 1_700_000_000_013); // not Ann's: River ignores it
        let hi = id_of(&state, "count me in");
        let state = act(&state, &bob_sk, "delete", &hi, json!({}), 1_700_000_000_014);
        let view = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":bob_sk}));
        let msgs = view["messages"].as_array().unwrap();
        let find = |t: &str| msgs.iter().find(|m| m["text"] == t).cloned();
        assert_eq!(find("sounds good").unwrap()["reply_to"], json!(plan));
        assert_eq!(find("secret plan").unwrap()["reactions"]["👍"], json!([bob]));
        assert_eq!(find("again!").unwrap()["edited"], true);
        assert!(find("hijacked").is_none() && find("count me in").is_none());
        let state = act(&state, &bob_sk, "unreact", &plan, json!({"emoji":"👍"}), 1_700_000_000_015);
        let view = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":ann_sk}));
        assert!(view["messages"].as_array().unwrap().iter().all(|m| m["reactions"].as_object().unwrap().is_empty()));
        let wire = hex::decode(state.as_str().unwrap()).unwrap();
        assert!(!wire.windows("👍".len()).any(|w| w == "👍".as_bytes()), "reaction in clear");

        // Ann kicks Carl: he is gone, and what is said after is sealed under a secret he never got
        let (carl_sk, carl) = hx(4);
        let inv = ok(json!({"op":"invite","inviter_sk":ann_sk,"owner_vk":ann,"state":state,"invitee_vk":carl}));
        let state = say(&carl_sk, &ann, &state, "hi all", 1_700_000_000_003, json!({"join":{"member":inv["member"],"secret":inv["secret"]}}));
        let kick = ok(json!({"op":"kick","banner_sk":ann_sk,"owner_vk":ann,"state":state,"target_vk":carl,"time_ms":1_700_000_000_004u64}))["delta"].clone();
        let state = apply(&ann, &state, &kick);
        let state = say(&bob_sk, &ann, &state, "after carl", 1_700_000_000_005, json!({}));
        let carl_view = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":carl_sk}));
        assert!(!carl_view["members"].as_array().unwrap().iter().any(|m| m["vk"] == json!(carl)), "carl still a member");
        assert!(!texts(&carl_view).iter().any(|(_, t)| t == "after carl"), "carl reads the new secret");
        assert!(texts(&ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":ann_sk}))).iter().any(|(_, t)| t == "after carl"));
        assert!(run(&json!({"op":"message","author_sk":carl_sk,"owner_vk":ann,"state":state,"text":"x","time_ms":1_700_000_000_006u64}).to_string()).contains("no room secret"));

        // a River invitation code (what River's UI and riverctl exchange) lets Dan in with nothing else
        let (dan_sk, dan) = hx(5);
        let code = ok(json!({"op":"invitation","owner_sk":ann_sk,"state":state,"invitee_sk":dan_sk}))["code"].clone();
        let acc = ok(json!({"op":"accept","code":code}));
        assert_eq!((acc["owner_vk"].clone(), acc["sk"].clone()), (json!(ann), json!(dan_sk)));
        let plain = acc["secrets"].clone();
        assert_eq!(ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":dan_sk,"secrets":plain}))["name"], "SOS");
        let state = say(&dan_sk, &ann, &state, "dan here", 1_700_000_000_007, json!({"join":{"member":acc["member"]},"nickname":"Dan","secrets":plain}));
        assert!(texts(&ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":bob_sk}))).contains(&(json!(dan), json!("dan here"))));
        assert!(run(&json!({"op":"accept","code":"not-a-code"}).to_string()).contains("not a River invitation"));

        // anyone else sees no name, no nicknames and no text, and the state on the wire holds no plaintext
        let view = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":eve_sk}));
        assert_eq!((view["name"].clone(), view["private"].clone(), texts(&view).len()), (Value::Null, json!(true), 0));
        let wire = hex::decode(state.as_str().unwrap()).unwrap();
        for plain in ["SOS", "secret plan", "count me in", "Bob"] {
            assert!(!wire.windows(plain.len()).any(|w| w == plain.as_bytes()), "{plain} in clear");
        }
    }

    #[test]
    fn owner_deputies_ban_and_the_owner_rotates() {
        let ((ann_sk, ann), (bob_sk, bob), (carl_sk, carl)) = (hx(1), hx(2), hx(4));
        let state = ok(json!({"op":"new_room","owner_sk":ann_sk,"name":"SOS","nickname":"Ann","private":true,"time_ms":1}))["state"].clone();
        let mut state = say(&ann_sk, &ann, &state, "hello", 1_700_000_000_000, json!({}));
        for (sk, vk, t) in [(&bob_sk, &bob, 1), (&carl_sk, &carl, 2)] {
            let inv = ok(json!({"op":"invite","inviter_sk":ann_sk,"owner_vk":ann,"state":state,"invitee_vk":vk}));
            state = say(sk, &ann, &state, "hi", 1_700_000_000_000 + t, json!({"join":{"member":inv["member"],"secret":inv["secret"]}}));
        }
        let kick = |state: &Value, by: &str, t: u64| apply(&ann, state, &ok(json!({"op":"kick","banner_sk":by,"owner_vk":ann,"state":state,"target_vk":carl,"time_ms":t}))["delta"]);
        let in_room = |state: &Value, who: &str| ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":ann_sk}))["members"].as_array().unwrap().iter().any(|m| m["vk"] == json!(who));

        // Bob is no moderator yet: his ban does nothing
        assert!(in_room(&kick(&state, &bob_sk, 1_700_000_000_010), &carl));
        // Ann makes Bob a deputy; now his ban holds, and Ann is told to rotate
        let state = apply(&ann, &state, &ok(json!({"op":"deputies","owner_sk":ann_sk,"state":state,"deputies":[bob]}))["delta"]);
        let view = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":ann_sk}));
        assert!(view["members"].as_array().unwrap().iter().any(|m| m["vk"] == json!(bob) && m["deputy"] == true));
        let state = kick(&state, &bob_sk, 1_700_000_000_020);
        assert!(!in_room(&state, &carl));
        assert_eq!(ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":ann_sk}))["rotate_due"], true);
        let state = apply(&ann, &state, &ok(json!({"op":"rotate","owner_sk":ann_sk,"state":state,"time_ms":1_700_000_000_030u64}))["delta"]);
        assert_eq!(ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":ann_sk}))["rotate_due"], false);
        let state = say(&bob_sk, &ann, &state, "carl is out", 1_700_000_000_040, json!({}));
        let carl_view = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":carl_sk}));
        assert!(!texts(&carl_view).iter().any(|(_, t)| t == "carl is out"));
        // dropping Bob as deputy un-enforces his ban (River's rule): Carl may come back with his invitation
        let state = apply(&ann, &state, &ok(json!({"op":"deputies","owner_sk":ann_sk,"state":state,"deputies":[]}))["delta"]);
        assert!(!ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":ann_sk}))["members"].as_array().unwrap().iter().any(|m| m["deputy"] == true));
    }

    #[test]
    fn identity_tokens_round_trip_with_river_format() {
        let ((ann_sk, ann), (bob_sk, bob)) = (hx(1), hx(2));
        let state = ok(json!({"op":"new_room","owner_sk":ann_sk,"name":"Italiani","nickname":"Ann","private":true,"time_ms":1}))["state"].clone();
        let inv = ok(json!({"op":"invite","inviter_sk":ann_sk,"owner_vk":ann,"state":state,"invitee_vk":bob}));
        let state = say(&bob_sk, &ann, &state, "ciao", 1_700_000_000_000, json!({"join":{"member":inv["member"],"secret":inv["secret"]},"nickname":"Bob"}));
        // Bob exports (as from River's Export ID) and imports elsewhere: same key, same room, he reads and writes as before
        let token = ok(json!({"op":"export_identity","sk":bob_sk,"owner_vk":ann,"state":state,"nickname":"Bob"}))["token"].as_str().unwrap().to_string();
        assert!(token.starts_with("-----BEGIN RIVER IDENTITY-----"));
        assert!(IdentityExport::from_armored_string(&token).is_ok(), "River reads it");
        let id = ok(json!({"op":"import_identity","token":token}));
        assert_eq!((id["owner_vk"].clone(), id["sk"].clone(), id["nickname"].clone(), id["room_name"].clone()), (json!(ann), json!(bob_sk), json!("Bob"), json!("Italiani")));
        let state = say(&bob_sk, &ann, &state, "same me", 1_700_000_000_001, json!({"secrets":id["secrets"]}));
        let view = ok(json!({"op":"read","owner_vk":ann,"state":state,"member_sk":ann_sk}));
        assert_eq!(view["members"].as_array().unwrap().iter().filter(|m| m["vk"] == json!(bob)).count(), 1, "one Bob, not two");
        // the owner exports too (self-signed membership, as River does)
        let owner = ok(json!({"op":"export_identity","sk":ann_sk,"owner_vk":ann,"state":state}))["token"].as_str().unwrap().to_string();
        assert_eq!(ok(json!({"op":"import_identity","token":owner}))["sk"], json!(ann_sk));
        assert!(run(&json!({"op":"import_identity","token":"-----BEGIN RIVER IDENTITY-----\nxyz\n-----END RIVER IDENTITY-----"}).to_string()).contains("error"));
    }

    // River's frozen invitation (riverctl INVITATION_FIXED_FIXTURE_V302, also in River's UI): owner [3;32], invitee
    // [2;32], invited by [1;32], secrets v0 = [0xA1;32] and v3 = [0xB2;32]. Ours must read it and write it byte for byte.
    const RIVER_INVITATION: &str = "6DdkgteQ42ZdqjP42dauXJKUPV7Pb4YG5wxPzvBDezf3pwCkWX5ENtvTM8Eb9bVzDTG986W4SEY6MVx653EuNkBYhfTx7FM7uFHy3bJng5xoq8S6gfwuau9AgvWEixELwY7Pn9hErx6rymdPeBrpBouZgKkSLCbSqteJL3r1x8adRXkJVfDd8N9P1L9Uorah6J6sxisDuBcT3TZ71zmWaHkWwEptej7DUNUxCruLXjLGcJdWUaYP2YRAP5siqbNUz1rL9Jh5ZK7t8sq2p7WBSJasSyLuSJhDDw2qmRs5nGexupvbcimptn1xQBdzNa6q3bgzt8Qka3Ror5AD7iN6UNpGQPqwgrmvX6g8q2zVMDKh1JeEP9tezNtpmige3WvwRMg2wKk7pFnLNaeGyutEVQrsrd73D9TsB1Mkz86WwxMU8pKvonLgr2TB9yJdiX1BBkDPRZ6yE2bEzxyeo3PZ6t9Nw4WVszSBnFDkAKzAnCoHdo9qpm6n4iY5R6rsANPn75WDiUM16UyqzVsYdWH2JhoVuvpz7D8HUgbGcjTDsMxi33aERdtd7vG24oDMMsKYYNP6VGdXfyRWKm7LUk9M1hFyD1Sf9FZksUxpp924mRNyaJUCniR9pY984jDUrNE3gCuK1PoF9ShtCvEd";

    #[test]
    fn reads_and_writes_river_invitations_byte_for_byte() {
        let acc = ok(json!({"op":"accept","code":RIVER_INVITATION}));
        assert_eq!(acc["owner_vk"], hx(3).1);
        assert_eq!(acc["sk"], hx(2).0);
        assert_eq!(acc["secrets"], json!({"0": "a1".repeat(32), "3": "b2".repeat(32)}));
        let inv: Invitation = ciborium::de::from_reader(bs58::decode(RIVER_INVITATION).into_vec().unwrap().as_slice()).unwrap();
        assert_eq!(inv.invitee.member.invited_by, MemberId::from(SigningKey::from_bytes(&[1; 32]).verifying_key()));
        let mut b = Vec::new();
        ciborium::ser::into_writer(&inv, &mut b).unwrap();
        assert_eq!(bs58::encode(b).into_string(), RIVER_INVITATION);
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
