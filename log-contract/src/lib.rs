//! Radica log contract: an append-only set of signed entries anyone can add to.
//! Parameters name the log (UTF-8, e.g. `radica/inbox/<pubkey>`, `radica/communities`), so an entry signed for one
//! log cannot be replayed into another. What an entry means (a message, a moderation event) is decided by the
//! clients, which know each entry's author for sure.
//!
//! Signed message (must match ui/src/crypto.ts formatLogEntryMessage):
//!   radica/log/v1:<parameters hex>:<author>:<id>:<ts>:<body>
//!
//! Merge is a union keyed `<author>:<id>`; the same key with two bodies keeps the larger signature, so every node
//! converges (idempotent, commutative, associative).

use ed25519_dalek::{Signature, VerifyingKey};
use freenet_stdlib::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub author: String, // hex pubkey
    pub id: String,
    pub ts: u64,
    pub body: String,
    pub sig: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct LogState {
    #[serde(default)]
    pub entries: BTreeMap<String, Entry>, // "<author>:<id>" -> entry
}

/// What a peer holds: key -> signature prefix.
pub type Summary = BTreeMap<String, String>;

pub const MAX_BODY: usize = 64 * 1024;
pub const MAX_ID: usize = 100;

fn err(m: &str) -> ContractError {
    ContractError::Other(m.into())
}

pub fn entry_msg(params_hex: &str, e: &Entry) -> String {
    format!("radica/log/v1:{params_hex}:{}:{}:{}:{}", e.author, e.id, e.ts, e.body)
}

pub fn check(params_hex: &str, key: &str, e: &Entry) -> Result<(), ContractError> {
    if key != format!("{}:{}", e.author, e.id) || e.id.is_empty() || e.id.len() > MAX_ID || e.body.len() > MAX_BODY {
        return Err(err("bad entry key or size"));
    }
    let pk: [u8; 32] = hex::decode(&e.author).map_err(|_| err("author not hex"))?.try_into().map_err(|_| err("author must be 32 bytes"))?;
    let sig: [u8; 64] = hex::decode(&e.sig).map_err(|_| err("sig not hex"))?.try_into().map_err(|_| err("sig must be 64 bytes"))?;
    VerifyingKey::from_bytes(&pk)
        .map_err(|_| err("bad author key"))?
        .verify_strict(entry_msg(params_hex, e).as_bytes(), &Signature::from_bytes(&sig))
        .map_err(|_| err("bad signature"))
}

/// Merge `inc` into `state`; fails only on a forged or oversized entry.
pub fn merge(params_hex: &str, state: &mut LogState, inc: LogState) -> Result<(), ContractError> {
    for (k, e) in inc.entries {
        if state.entries.get(&k).map_or(true, |cur| e.sig > cur.sig) {
            check(params_hex, &k, &e)?;
            state.entries.insert(k, e);
        }
    }
    Ok(())
}

fn prefix(s: &str) -> String {
    s.chars().take(16).collect()
}

pub fn summarize(s: &LogState) -> Summary {
    s.entries.iter().map(|(k, e)| (k.clone(), prefix(&e.sig))).collect()
}

pub fn delta(s: &LogState, peer: &Summary) -> LogState {
    let have: BTreeSet<(&String, String)> = peer.iter().map(|(k, v)| (k, v.clone())).collect();
    LogState {
        entries: s.entries.iter().filter(|(k, e)| !have.contains(&(*k, prefix(&e.sig)))).map(|(k, e)| (k.clone(), e.clone())).collect(),
    }
}

fn de<T: for<'a> Deserialize<'a> + Default>(b: &[u8]) -> Result<T, ContractError> {
    if b.is_empty() {
        return Ok(T::default());
    }
    serde_json::from_slice(b).map_err(|e| ContractError::Deser(e.to_string()))
}

fn ser<T: Serialize>(v: &T) -> Result<Vec<u8>, ContractError> {
    serde_json::to_vec(v).map_err(|e| ContractError::Deser(e.to_string()))
}

pub struct RadicaLogContract;

#[contract]
impl ContractInterface for RadicaLogContract {
    fn validate_state(p: Parameters<'static>, state: State<'static>, _r: RelatedContracts<'static>) -> Result<ValidateResult, ContractError> {
        let params = hex::encode(p.as_ref());
        let ok = de::<LogState>(state.as_ref()).is_ok_and(|s| s.entries.iter().all(|(k, e)| check(&params, k, e).is_ok()));
        Ok(if ok { ValidateResult::Valid } else { ValidateResult::Invalid })
    }

    fn update_state(p: Parameters<'static>, state: State<'static>, data: Vec<UpdateData<'static>>) -> Result<UpdateModification<'static>, ContractError> {
        let params = hex::encode(p.as_ref());
        let mut cur: LogState = de(state.as_ref())?;
        for item in data {
            let parts: Vec<Vec<u8>> = match item {
                UpdateData::State(s) => vec![s.as_ref().to_vec()],
                UpdateData::Delta(d) => vec![d.as_ref().to_vec()],
                UpdateData::StateAndDelta { state, delta } => vec![state.as_ref().to_vec(), delta.as_ref().to_vec()],
                _ => return Err(ContractError::InvalidUpdate),
            };
            for part in parts {
                merge(&params, &mut cur, de(&part)?).map_err(|_| ContractError::InvalidUpdate)?;
            }
        }
        Ok(UpdateModification::valid(State::from(ser(&cur)?)))
    }

    fn summarize_state(_p: Parameters<'static>, state: State<'static>) -> Result<StateSummary<'static>, ContractError> {
        Ok(StateSummary::from(ser(&summarize(&de(state.as_ref())?))?))
    }

    fn get_state_delta(_p: Parameters<'static>, state: State<'static>, summary: StateSummary<'static>) -> Result<StateDelta<'static>, ContractError> {
        let d = delta(&de(state.as_ref())?, &de(summary.as_ref())?);
        Ok(StateDelta::from(if d.entries.is_empty() { vec![] } else { ser(&d)? }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    const P: &str = "7261646963612f74657374"; // "radica/test"

    fn entry(k: &SigningKey, id: &str, ts: u64, body: &str, params: &str) -> (String, Entry) {
        let author = hex::encode(k.verifying_key().as_bytes());
        let mut e = Entry { author: author.clone(), id: id.into(), ts, body: body.into(), sig: String::new() };
        e.sig = hex::encode(k.sign(entry_msg(params, &e).as_bytes()).to_bytes());
        (format!("{author}:{id}"), e)
    }
    fn state(es: Vec<(String, Entry)>) -> LogState {
        LogState { entries: es.into_iter().collect() }
    }
    fn merged(parts: &[LogState]) -> LogState {
        let mut s = LogState::default();
        for p in parts {
            merge(P, &mut s, p.clone()).unwrap();
        }
        s
    }

    #[test]
    fn merge_laws_and_delta_path() {
        let (a, b) = (SigningKey::from_bytes(&[1; 32]), SigningKey::from_bytes(&[2; 32]));
        let s = vec![
            state(vec![entry(&a, "1", 1, "hi", P), entry(&b, "1", 2, "yo", P)]),
            state(vec![entry(&a, "1", 1, "same id, other body", P)]),
            state(vec![entry(&b, "2", 3, "{\"type\":\"chat\"}", P)]),
        ];
        for x in &s {
            assert_eq!(merged(&[x.clone(), x.clone()]), merged(&[x.clone()]));
            for y in &s {
                assert_eq!(merged(&[x.clone(), y.clone()]), merged(&[y.clone(), x.clone()]));
                for z in &s {
                    assert_eq!(merged(&[merged(&[x.clone(), y.clone()]), z.clone()]), merged(&[x.clone(), merged(&[y.clone(), z.clone()])]));
                }
                let (x, y) = (merged(&[x.clone()]), merged(&[y.clone()]));
                let mut via = x.clone();
                merge(P, &mut via, delta(&y, &summarize(&x))).unwrap();
                assert_eq!(via, merged(&[x.clone(), y.clone()]));
            }
        }
        let all = merged(&s);
        assert!(delta(&all, &summarize(&all)).entries.is_empty());
    }

    #[test]
    fn forgeries_and_replays_are_rejected() {
        let (a, b) = (SigningKey::from_bytes(&[1; 32]), SigningKey::from_bytes(&[2; 32]));
        let mut s = LogState::default();
        // signed for another log
        assert!(merge(P, &mut s, state(vec![entry(&a, "1", 1, "x", "6f74686572")])).is_err());
        // body changed in transit
        let (k, mut e) = entry(&a, "1", 1, "x", P);
        e.body = "y".into();
        assert!(merge(P, &mut s, state(vec![(k, e)])).is_err());
        // stored under someone else's key
        let (_, e) = entry(&a, "1", 1, "x", P);
        assert!(merge(P, &mut s, state(vec![(format!("{}:1", hex::encode(b.verifying_key().as_bytes())), e)])).is_err());
        assert!(s.entries.is_empty());
    }
}
