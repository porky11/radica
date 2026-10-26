//! River rooms for Radica's chat UI. A small wrapper around `river-core`, compiled to WASM for the browser: it builds
//! and reads River room states and deltas, so Radica's rooms live under River's own room contract and stay usable
//! from River and riverctl. Signatures are over CBOR of River's structs, so they are made here, never in TypeScript.
//!
//! One entry point, JSON in and out (keys and CBOR blobs as hex):
//!   {"op":"params","owner_vk"}                                   -> {"params"}    contract params of a room
//!   {"op":"new_room","owner_sk","name","nickname"}               -> {"state"}     a public room, owner as member 0
//!   {"op":"invite","inviter_sk","owner_vk","invitee_vk"}         -> {"member"}    AuthorizedMember for the invitee
//!   {"op":"message","author_sk","owner_vk","text","time_ms",     -> {"delta"}     a signed public text message
//!    "member"?,"chain"?,"nickname"?}
//! A room keeps only members with messages in it, so a member writing for the first time (or after being pruned)
//! sends their invitation (`member`), any inviters the room no longer holds (`chain`) and their nickname with it.
//!   {"op":"apply","owner_vk","state","delta"}                    -> {"state"}     what the contract makes of a delta
//!   {"op":"read","owner_vk","state"}                             -> {"name","members","messages"}
//!   {"op":"pointer","state"}                                     -> {"version","code_hash"}  River's room-contract
//!    pointer record, checked against River's author key (an all-zero code_hash means River withdrew the contract)
//! Errors come back as {"error"}.

use ed25519_dalek::{SigningKey, VerifyingKey};
use freenet_scaffold::ComposableState;
use river_core::room_state::configuration::{AuthorizedConfigurationV1, Configuration};
use river_core::room_state::member::{AuthorizedMember, Member, MemberId, MembersDelta};
use river_core::room_state::member_info::{AuthorizedMemberInfo, MemberInfo};
use river_core::room_state::message::{AuthorizedMessageV1, MessageV1, RoomMessageBody};
use river_core::room_state::privacy::RoomDisplayMetadata;
use river_core::room_state::{ChatRoomParametersV1, ChatRoomStateV1, ChatRoomStateV1Delta};
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
enum Req {
    Params { owner_vk: String },
    NewRoom { owner_sk: String, name: String, nickname: String },
    Invite { inviter_sk: String, owner_vk: String, invitee_vk: String },
    Message {
        author_sk: String,
        owner_vk: String,
        text: String,
        time_ms: u64,
        member: Option<String>,
        #[serde(default)]
        chain: Vec<String>,
        nickname: Option<String>,
    },
    Apply { owner_vk: String, state: String, delta: String },
    Read { owner_vk: String, state: String },
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

fn handle(req: Req) -> R<Value> {
    Ok(match req {
        Req::Params { owner_vk } => json!({ "params": cbor(&params(&owner_vk)?)? }),
        Req::Pointer { state } => {
            let (version, code_hash) = pointer(&state)?;
            json!({ "version": version, "code_hash": hex::encode(code_hash) })
        }
        Req::NewRoom { owner_sk, name, nickname } => {
            let owner = sk(&owner_sk)?;
            let p = ChatRoomParametersV1 { owner: owner.verifying_key() };
            if let Some(why) = river_core::room_state::configuration::new_room_refusal(&p, &name, &nickname) {
                return Err(why.to_string());
            }
            let mut state = ChatRoomStateV1::default();
            let config = Configuration {
                owner_member_id: p.owner.into(),
                display: RoomDisplayMetadata::public(name, None),
                ..Configuration::default()
            };
            state.configuration = AuthorizedConfigurationV1::new(config, &owner);
            let info = MemberInfo::new_public(p.owner.into(), 0, nickname);
            state.member_info.member_info.push(AuthorizedMemberInfo::new(info, &owner));
            json!({ "state": cbor(&state)? })
        }
        Req::Invite { inviter_sk, owner_vk, invitee_vk } => {
            let inviter = sk(&inviter_sk)?;
            let member = Member { owner_member_id: vk(&owner_vk)?.into(), invited_by: inviter.verifying_key().into(), member_vk: vk(&invitee_vk)? };
            json!({ "member": cbor(&AuthorizedMember::new(member, &inviter))? })
        }
        Req::Message { author_sk, owner_vk, text, time_ms, member, chain, nickname } => {
            let author = sk(&author_sk)?;
            let message = MessageV1 {
                room_owner: vk(&owner_vk)?.into(),
                author: author.verifying_key().into(),
                time: UNIX_EPOCH + Duration::from_millis(time_ms),
                content: RoomMessageBody::public(text),
            };
            let mut delta = ChatRoomStateV1Delta { recent_messages: Some(vec![AuthorizedMessageV1::new(message, &author)]), ..Default::default() };
            if let Some(member) = member {
                let member: AuthorizedMember = uncbor(&member)?;
                if member.member.member_vk != author.verifying_key() {
                    return Err("this invitation is for another key".into());
                }
                let mut added = chain.iter().map(|c| uncbor(c)).collect::<R<Vec<AuthorizedMember>>>()?;
                added.push(member);
                delta.members = Some(MembersDelta::new(added));
                if let Some(nick) = nickname {
                    let info = MemberInfo::new_public(author.verifying_key().into(), 0, nick);
                    delta.member_info = Some(vec![AuthorizedMemberInfo::new_with_member_key(info, &author)]);
                }
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
        Req::Read { owner_vk, state } => {
            let p = params(&owner_vk)?;
            let s: ChatRoomStateV1 = uncbor(&state)?;
            let owner_id: MemberId = p.owner.into();
            let nick = |id: MemberId| {
                s.member_info.member_info.iter().find(|i| i.member_info.member_id == id).map(|i| i.member_info.preferred_nickname.to_string_lossy())
            };
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
                    let text = m.message.content.as_public_string()?; // edits, reactions and encrypted bodies are not text
                    let ms = m.message.time.duration_since(SystemTime::UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64);
                    Some(json!({ "id": m.id().to_string(), "author": key_of(m.message.author), "time_ms": ms, "text": text }))
                })
                .collect();
            json!({ "name": s.configuration.configuration.display.name.to_string_lossy(), "members": members, "messages": messages })
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
    fn hx(k: &SigningKey) -> (String, String) {
        (hex::encode(k.to_bytes()), hex::encode(k.verifying_key().as_bytes()))
    }

    #[test]
    fn room_lifecycle_through_the_json_entry_point() {
        let (owner_sk, owner_vk) = hx(&SigningKey::from_bytes(&[1; 32]));
        let (bob_sk, bob_vk) = hx(&SigningKey::from_bytes(&[2; 32]));
        let (eve_sk, _) = hx(&SigningKey::from_bytes(&[3; 32]));

        let state = ok(json!({"op":"new_room","owner_sk":owner_sk,"name":"Radica","nickname":"Ann"}))["state"].clone();
        let apply = |state: &Value, delta: &Value| run(&json!({"op":"apply","owner_vk":owner_vk,"state":state,"delta":delta}).to_string());
        let applied = |state: &Value, delta: &Value| serde_json::from_str::<Value>(&apply(state, delta)).unwrap()["state"].clone();

        // the owner speaks
        let m = ok(json!({"op":"message","author_sk":owner_sk,"owner_vk":owner_vk,"text":"hello","time_ms":1_700_000_000_000u64}))["delta"].clone();
        let state = applied(&state, &m);

        // a stranger's message is dropped by the room's own rules (River drops, it does not error)
        let spam = ok(json!({"op":"message","author_sk":eve_sk,"owner_vk":owner_vk,"text":"spam","time_ms":1_700_000_000_001u64}))["delta"].clone();
        assert_eq!(applied(&state, &spam), state, "non-member message must not land");

        // Bob is invited and joins with his first message
        let member = ok(json!({"op":"invite","inviter_sk":owner_sk,"owner_vk":owner_vk,"invitee_vk":bob_vk}))["member"].clone();
        let m = ok(json!({"op":"message","author_sk":bob_sk,"owner_vk":owner_vk,"text":"hi Ann","time_ms":1_700_000_000_002u64,"member":member,"nickname":"Bob"}))["delta"].clone();
        let state = applied(&state, &m);

        let view = ok(json!({"op":"read","owner_vk":owner_vk,"state":state}));
        assert_eq!(view["name"], "Radica");
        let texts: Vec<_> = view["messages"].as_array().unwrap().iter().map(|m| (m["author"].clone(), m["text"].clone())).collect();
        assert_eq!(texts, vec![(json!(owner_vk), json!("hello")), (json!(bob_vk), json!("hi Ann"))]);
        let bob = view["members"].as_array().unwrap().iter().find(|m| m["vk"] == json!(bob_vk)).unwrap();
        assert_eq!(bob["nickname"], "Bob");

        // an invitation only works for the key it names
        let stolen = json!({"op":"message","author_sk":eve_sk,"owner_vk":owner_vk,"text":"x","time_ms":1u64,"member":member});
        assert!(run(&stolen.to_string()).contains("another key"));
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
