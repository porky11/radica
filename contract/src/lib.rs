use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use freenet_stdlib::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

pub type R<T> = Result<T, ContractError>;

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct ProfileInfo {
    pub display_name: String,
    pub bio: String,
    pub avatar_url: String,
    pub updated_at: u64,
    pub sig: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Comment {
    pub id: String,
    pub post_id: String,
    pub author: String, // hex pubkey
    pub text: String,
    pub timestamp: u64,
    pub sig: String, // hex signature by author
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ante: Option<String>, // optional anti-spam PoW
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Post {
    pub id: String,
    pub author: String, // hex pubkey
    pub category: String, // "thought" | "moment" | "event"
    pub caption: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub community_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_uri: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_date: Option<String>,
    pub timestamp: u64,
    pub sig: String, // hex signature by author/owner
    #[serde(default)]
    pub likes: BTreeSet<String>, // set of author hex pubkeys
    #[serde(default)]
    pub comments: BTreeMap<String, Comment>, // comment_id -> Comment
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct FeedState {
    pub owner: String, // hex 32-byte pubkey
    #[serde(default)]
    pub profile: Option<ProfileInfo>,
    #[serde(default)]
    pub posts: BTreeMap<String, Post>,
    #[serde(default)]
    pub following: BTreeSet<String>, // hex pubkeys of followed users
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct FeedSummary {
    pub profile_updated_at: u64,
    pub post_timestamps: BTreeMap<String, u64>,
    pub post_comment_ids: BTreeMap<String, BTreeSet<String>>,
    pub post_likes: BTreeMap<String, BTreeSet<String>>,
    pub following_count: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct FeedDelta {
    pub profile: Option<ProfileInfo>,
    #[serde(default)]
    pub posts: BTreeMap<String, Post>,
    #[serde(default)]
    pub following: Option<BTreeSet<String>>,
}

// ---- Cryptographic & validation helpers ----

pub fn parse_owner_pubkey(params: &[u8]) -> R<VerifyingKey> {
    if params.len() == 32 {
        let mut arr = [0u8; 32];
        arr.copy_from_slice(params);
        VerifyingKey::from_bytes(&arr).map_err(|e| ContractError::Deser(e.to_string()))
    } else if params.len() >= 64 {
        // Assume hex string prefix
        let hex_slice = std::str::from_utf8(&params[..64])
            .map_err(|e| ContractError::Deser(e.to_string()))?;
        let bytes = hex::decode(hex_slice)
            .map_err(|e| ContractError::Deser(e.to_string()))?;
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        VerifyingKey::from_bytes(&arr).map_err(|e| ContractError::Deser(e.to_string()))
    } else {
        Err(ContractError::Deser("Invalid parameters length for owner pubkey".into()))
    }
}

pub fn verify_post_sig(owner_vk: &VerifyingKey, post: &Post) -> R<()> {
    let msg = format!(
        "{}:{}:{}:{}:{}:{}",
        post.id,
        post.author,
        post.category,
        post.caption,
        post.media_uri.as_deref().unwrap_or(""),
        post.timestamp
    );
    let sig_bytes = hex::decode(&post.sig)
        .map_err(|e| ContractError::Deser(format!("Invalid sig hex: {}", e)))?;
    if sig_bytes.len() != 64 {
        return Err(ContractError::Deser("Signature must be 64 bytes".into()));
    }
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(&sig_bytes);
    let sig = Signature::from_bytes(&sig_arr);
    owner_vk
        .verify(msg.as_bytes(), &sig)
        .map_err(|e| ContractError::Deser(format!("Signature verification failed: {}", e)))
}

pub fn verify_comment_sig(comment: &Comment) -> R<()> {
    let author_bytes = hex::decode(&comment.author)
        .map_err(|e| ContractError::Deser(format!("Invalid author hex: {}", e)))?;
    if author_bytes.len() != 32 {
        return Err(ContractError::Deser("Author pubkey must be 32 bytes".into()));
    }
    let mut author_arr = [0u8; 32];
    author_arr.copy_from_slice(&author_bytes);
    let vk = VerifyingKey::from_bytes(&author_arr)
        .map_err(|e| ContractError::Deser(e.to_string()))?;

    let msg = format!(
        "{}:{}:{}:{}:{}",
        comment.id, comment.post_id, comment.author, comment.text, comment.timestamp
    );
    let sig_bytes = hex::decode(&comment.sig)
        .map_err(|e| ContractError::Deser(format!("Invalid sig hex: {}", e)))?;
    if sig_bytes.len() != 64 {
        return Err(ContractError::Deser("Signature must be 64 bytes".into()));
    }
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(&sig_bytes);
    let sig = Signature::from_bytes(&sig_arr);
    vk.verify(msg.as_bytes(), &sig)
        .map_err(|e| ContractError::Deser(format!("Comment signature failed: {}", e)))
}

// ---- Semilattice Merge & Synchronization ----

pub fn apply_delta(owner_vk: &VerifyingKey, state: &mut FeedState, delta: FeedDelta) -> R<()> {
    // 1. Profile update (Last-Write-Wins by updated_at)
    if let Some(new_profile) = delta.profile {
        let should_update = match &state.profile {
            Some(existing) => new_profile.updated_at > existing.updated_at,
            None => true,
        };
        if should_update {
            state.profile = Some(new_profile);
        }
    }

    // 2. Following list update (Union merge)
    if let Some(new_following) = delta.following {
        state.following.extend(new_following);
    }

    // 3. Posts & comments & likes merge
    for (id, delta_post) in delta.posts {
        if let Some(existing_post) = state.posts.get_mut(&id) {
            // Existing post: merge likes & comments
            existing_post.likes.extend(delta_post.likes);
            for (cid, comment) in delta_post.comments {
                if !existing_post.comments.contains_key(&cid) {
                    verify_comment_sig(&comment)?;
                    existing_post.comments.insert(cid, comment);
                }
            }
        } else {
            // New post: verify author signature
            verify_post_sig(owner_vk, &delta_post)?;
            for comment in delta_post.comments.values() {
                verify_comment_sig(comment)?;
            }
            state.posts.insert(id, delta_post);
        }
    }

    Ok(())
}

pub fn summarize(state: &FeedState) -> FeedSummary {
    FeedSummary {
        profile_updated_at: state.profile.as_ref().map(|p| p.updated_at).unwrap_or(0),
        post_timestamps: state
            .posts
            .iter()
            .map(|(k, v)| (k.clone(), v.timestamp))
            .collect(),
        post_comment_ids: state
            .posts
            .iter()
            .map(|(k, v)| (k.clone(), v.comments.keys().cloned().collect()))
            .collect(),
        post_likes: state
            .posts
            .iter()
            .map(|(k, v)| (k.clone(), v.likes.clone()))
            .collect(),
        following_count: state.following.len(),
    }
}

pub fn compute_delta(state: &FeedState, summary: &FeedSummary) -> FeedDelta {
    let mut delta_posts = BTreeMap::new();

    for (post_id, post) in &state.posts {
        let peer_has_post = summary.post_timestamps.contains_key(post_id);
        if !peer_has_post {
            // Peer is completely missing this post
            delta_posts.insert(post_id.clone(), post.clone());
        } else {
            // Peer has the post, check for missing comments or likes
            let peer_comments = summary.post_comment_ids.get(post_id);
            let missing_comments: BTreeMap<String, Comment> = post
                .comments
                .iter()
                .filter(|(cid, _)| {
                    peer_comments.map_or(true, |cids| !cids.contains(*cid))
                })
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect();

            let peer_likes = summary.post_likes.get(post_id);
            let missing_likes: BTreeSet<String> = post
                .likes
                .iter()
                .filter(|uid| peer_likes.map_or(true, |likes| !likes.contains(*uid)))
                .cloned()
                .collect();

            if !missing_comments.is_empty() || !missing_likes.is_empty() {
                let mut partial_post = post.clone();
                partial_post.comments = missing_comments;
                partial_post.likes = missing_likes;
                delta_posts.insert(post_id.clone(), partial_post);
            }
        }
    }

    let profile_delta = if let Some(p) = &state.profile {
        if p.updated_at > summary.profile_updated_at {
            Some(p.clone())
        } else {
            None
        }
    } else {
        None
    };

    let following_delta = if state.following.len() > summary.following_count {
        Some(state.following.clone())
    } else {
        None
    };

    FeedDelta {
        profile: profile_delta,
        posts: delta_posts,
        following: following_delta,
    }
}

// ---- Serialization glue ----

fn de<T: for<'a> Deserialize<'a>>(b: &[u8]) -> R<T> {
    serde_json::from_slice(b).map_err(|e| ContractError::Deser(e.to_string()))
}

fn ser<T: Serialize>(v: &T) -> R<Vec<u8>> {
    serde_json::to_vec(v).map_err(|e| ContractError::Deser(e.to_string()))
}

// ---- Freenet Contract Interface ----

pub struct SpruceFeedContract;

#[contract]
impl ContractInterface for SpruceFeedContract {
    fn validate_state(
        parameters: Parameters<'static>,
        state: State<'static>,
        _related: RelatedContracts<'static>,
    ) -> Result<ValidateResult, ContractError> {
        let owner_vk = parse_owner_pubkey(parameters.as_ref())?;
        let feed: FeedState = de(state.as_ref())?;

        // Check posts validity
        for post in feed.posts.values() {
            verify_post_sig(&owner_vk, post)?;
            for comment in post.comments.values() {
                verify_comment_sig(comment)?;
            }
        }

        Ok(ValidateResult::Valid)
    }

    fn update_state(
        parameters: Parameters<'static>,
        state: State<'static>,
        data: Vec<UpdateData<'static>>,
    ) -> Result<UpdateModification<'static>, ContractError> {
        let owner_vk = parse_owner_pubkey(parameters.as_ref())?;
        let mut current_state: FeedState = if state.as_ref().is_empty() {
            FeedState::default()
        } else {
            de(state.as_ref())?
        };

        for item in data {
            match item {
                UpdateData::State(new_state) => {
                    let incoming: FeedState = de(new_state.as_ref())?;
                    let delta = compute_delta(&incoming, &summarize(&current_state));
                    apply_delta(&owner_vk, &mut current_state, delta)?;
                }
                UpdateData::Delta(delta_bytes) => {
                    let delta: FeedDelta = de(delta_bytes.as_ref())?;
                    apply_delta(&owner_vk, &mut current_state, delta)?;
                }
                _ => {}
            }
        }

        let updated_bytes = ser(&current_state)?;
        Ok(UpdateModification::valid(State::from(updated_bytes)))
    }

    fn summarize_state(
        _parameters: Parameters<'static>,
        state: State<'static>,
    ) -> Result<StateSummary<'static>, ContractError> {
        let feed: FeedState = if state.as_ref().is_empty() {
            FeedState::default()
        } else {
            de(state.as_ref())?
        };
        let summary = summarize(&feed);
        let bytes = ser(&summary)?;
        Ok(StateSummary::from(bytes))
    }

    fn get_state_delta(
        _parameters: Parameters<'static>,
        state: State<'static>,
        summary: StateSummary<'static>,
    ) -> Result<StateDelta<'static>, ContractError> {
        if state.as_ref().is_empty() {
            return Ok(StateDelta::from(vec![]));
        }

        let feed: FeedState = de(state.as_ref())?;
        let sum: FeedSummary = if summary.as_ref().is_empty() {
            FeedSummary::default()
        } else {
            de(summary.as_ref())?
        };

        let delta = compute_delta(&feed, &sum);

        // Crucial dapp-builder requirement: if no changes needed, return empty bytes
        if delta.posts.is_empty() && delta.profile.is_none() && delta.following.is_none() {
            return Ok(StateDelta::from(vec![]));
        }

        let bytes = ser(&delta)?;
        Ok(StateDelta::from(bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::Signer;

    fn test_keypair(seed: u8) -> (ed25519_dalek::SigningKey, VerifyingKey, String) {
        let secret = [seed; 32];
        let keypair = ed25519_dalek::SigningKey::from_bytes(&secret);
        let pubkey = keypair.verifying_key();
        let hex_pub = hex::encode(pubkey.as_bytes());
        (keypair, pubkey, hex_pub)
    }

    fn create_signed_post(
        keypair: &ed25519_dalek::SigningKey,
        id: &str,
        caption: &str,
        timestamp: u64,
    ) -> Post {
        let author = hex::encode(keypair.verifying_key().as_bytes());
        let msg = format!("{}:{}:thought:{}:{}:{}", id, author, caption, "", timestamp);
        let sig = keypair.sign(msg.as_bytes());
        Post {
            id: id.into(),
            author,
            category: "thought".into(),
            caption: caption.into(),
            community_id: None,
            media_uri: None,
            location: None,
            event_date: None,
            timestamp,
            sig: hex::encode(sig.to_bytes()),
            likes: BTreeSet::new(),
            comments: BTreeMap::new(),
        }
    }

    fn create_signed_comment(
        keypair: &ed25519_dalek::SigningKey,
        id: &str,
        post_id: &str,
        text: &str,
        timestamp: u64,
    ) -> Comment {
        let author = hex::encode(keypair.verifying_key().as_bytes());
        let msg = format!("{}:{}:{}:{}:{}", id, post_id, author, text, timestamp);
        let sig = keypair.sign(msg.as_bytes());
        Comment {
            id: id.into(),
            post_id: post_id.into(),
            author,
            text: text.into(),
            timestamp,
            sig: hex::encode(sig.to_bytes()),
            ante: None,
        }
    }

    #[test]
    fn test_merge_idempotence() {
        let (owner_sk, owner_vk, _) = test_keypair(42);
        let post = create_signed_post(&owner_sk, "p1", "Idempotence test", 1000);

        let mut s1 = FeedState::default();
        let mut posts = BTreeMap::new();
        posts.insert("p1".into(), post);

        let delta = FeedDelta {
            profile: None,
            posts,
            following: None,
        };

        // First apply
        apply_delta(&owner_vk, &mut s1, delta.clone()).unwrap();
        assert_eq!(s1.posts.len(), 1);

        // Second apply (must be strictly idempotent: merge(A, A) == A)
        apply_delta(&owner_vk, &mut s1, delta).unwrap();
        assert_eq!(s1.posts.len(), 1);
    }

    #[test]
    fn test_semilattice_commutativity() {
        let (owner_sk, owner_vk, _) = test_keypair(42);
        let (alice_sk, _, alice_hex) = test_keypair(101);
        let (bob_sk, _, _) = test_keypair(102);

        let base_post = create_signed_post(&owner_sk, "p1", "Commutativity test", 1000);

        // Delta 1 adds Alice's comment
        let comment_a = create_signed_comment(&alice_sk, "c1", "p1", "Comment from Alice", 1050);
        let mut post_d1 = base_post.clone();
        post_d1.comments.insert("c1".into(), comment_a);
        let mut d1_posts = BTreeMap::new();
        d1_posts.insert("p1".into(), post_d1);
        let d1 = FeedDelta {
            profile: None,
            posts: d1_posts,
            following: None,
        };

        // Delta 2 adds Bob's comment and Alice's like
        let comment_b = create_signed_comment(&bob_sk, "c2", "p1", "Comment from Bob", 1060);
        let mut post_d2 = base_post.clone();
        post_d2.comments.insert("c2".into(), comment_b);
        post_d2.likes.insert(alice_hex);
        let mut d2_posts = BTreeMap::new();
        d2_posts.insert("p1".into(), post_d2);
        let d2 = FeedDelta {
            profile: None,
            posts: d2_posts,
            following: None,
        };

        // Branch 1: apply d1 then d2
        let mut state_order_12 = FeedState::default();
        apply_delta(&owner_vk, &mut state_order_12, d1.clone()).unwrap();
        apply_delta(&owner_vk, &mut state_order_12, d2.clone()).unwrap();

        // Branch 2: apply d2 then d1
        let mut state_order_21 = FeedState::default();
        apply_delta(&owner_vk, &mut state_order_21, d2).unwrap();
        apply_delta(&owner_vk, &mut state_order_21, d1).unwrap();

        // Commutativity: state_order_12 == state_order_21 regardless of arrival sequence
        assert_eq!(state_order_12, state_order_21);
        let final_post = state_order_12.posts.get("p1").unwrap();
        assert_eq!(final_post.comments.len(), 2);
        assert_eq!(final_post.likes.len(), 1);
    }

    #[test]
    fn test_post_signature_verification_and_tampering() {
        let (owner_sk, owner_vk, _) = test_keypair(42);
        let (attacker_sk, attacker_vk, _) = test_keypair(99);

        let valid_post = create_signed_post(&owner_sk, "p1", "Legitimate post", 1000);
        assert!(verify_post_sig(&owner_vk, &valid_post).is_ok());

        // 1. Caption altered
        let mut tampered_caption = valid_post.clone();
        tampered_caption.caption = "Malicious altered caption".into();
        assert!(verify_post_sig(&owner_vk, &tampered_caption).is_err());

        // 2. Timestamp altered
        let mut tampered_ts = valid_post.clone();
        tampered_ts.timestamp = 999999;
        assert!(verify_post_sig(&owner_vk, &tampered_ts).is_err());

        // 3. Post signed by attacker, verified against owner
        let attacker_post = create_signed_post(&attacker_sk, "p2", "Attacker post", 1000);
        assert!(verify_post_sig(&owner_vk, &attacker_post).is_err());
        assert!(verify_post_sig(&attacker_vk, &attacker_post).is_ok());

        // 4. Corrupted signature bytes
        let mut bad_sig = valid_post.clone();
        bad_sig.sig = "deadbeef".into(); // Too short
        assert!(verify_post_sig(&owner_vk, &bad_sig).is_err());
    }

    #[test]
    fn test_comment_signature_verification_and_tampering() {
        let (author_sk, _, _) = test_keypair(50);
        let valid_comment = create_signed_comment(&author_sk, "c1", "p1", "Nice photo!", 1000);
        assert!(verify_comment_sig(&valid_comment).is_ok());

        // 1. Text altered
        let mut tampered_text = valid_comment.clone();
        tampered_text.text = "Altered spam text".into();
        assert!(verify_comment_sig(&tampered_text).is_err());

        // 2. Post ID altered
        let mut tampered_pid = valid_comment.clone();
        tampered_pid.post_id = "p_different".into();
        assert!(verify_comment_sig(&tampered_pid).is_err());

        // 3. Invalid signature
        let mut bad_sig = valid_comment.clone();
        bad_sig.sig = "00".repeat(64);
        assert!(verify_comment_sig(&bad_sig).is_err());
    }

    #[test]
    fn test_profile_last_write_wins() {
        let (_, owner_vk, _) = test_keypair(42);
        let mut state = FeedState::default();

        let p1 = ProfileInfo {
            display_name: "Original Name".into(),
            bio: "Original bio".into(),
            avatar_url: "".into(),
            updated_at: 1000,
            sig: "".into(),
        };
        apply_delta(
            &owner_vk,
            &mut state,
            FeedDelta {
                profile: Some(p1),
                posts: BTreeMap::new(),
                following: None,
            },
        )
        .unwrap();
        assert_eq!(state.profile.as_ref().unwrap().display_name, "Original Name");

        // Newer profile update (updated_at: 2000) overrides
        let p2 = ProfileInfo {
            display_name: "New Name".into(),
            bio: "New bio".into(),
            avatar_url: "".into(),
            updated_at: 2000,
            sig: "".into(),
        };
        apply_delta(
            &owner_vk,
            &mut state,
            FeedDelta {
                profile: Some(p2),
                posts: BTreeMap::new(),
                following: None,
            },
        )
        .unwrap();
        assert_eq!(state.profile.as_ref().unwrap().display_name, "New Name");

        // Stale profile update (updated_at: 500) is ignored
        let p_stale = ProfileInfo {
            display_name: "Stale Name".into(),
            bio: "Stale bio".into(),
            avatar_url: "".into(),
            updated_at: 500,
            sig: "".into(),
        };
        apply_delta(
            &owner_vk,
            &mut state,
            FeedDelta {
                profile: Some(p_stale),
                posts: BTreeMap::new(),
                following: None,
            },
        )
        .unwrap();
        assert_eq!(state.profile.as_ref().unwrap().display_name, "New Name");
    }

    #[test]
    fn test_following_gset_union() {
        let (_, owner_vk, _) = test_keypair(42);
        let mut state = FeedState::default();

        let mut set1 = BTreeSet::new();
        set1.insert("userA".into());
        set1.insert("userB".into());

        apply_delta(
            &owner_vk,
            &mut state,
            FeedDelta {
                profile: None,
                posts: BTreeMap::new(),
                following: Some(set1),
            },
        )
        .unwrap();
        assert_eq!(state.following.len(), 2);

        // Union with set2
        let mut set2 = BTreeSet::new();
        set2.insert("userB".into());
        set2.insert("userC".into());

        apply_delta(
            &owner_vk,
            &mut state,
            FeedDelta {
                profile: None,
                posts: BTreeMap::new(),
                following: Some(set2),
            },
        )
        .unwrap();
        assert_eq!(state.following.len(), 3);
        assert!(state.following.contains("userA"));
        assert!(state.following.contains("userB"));
        assert!(state.following.contains("userC"));
    }

    #[test]
    fn test_summarize_and_compute_delta_minimal() {
        let (owner_sk, _, _) = test_keypair(42);
        let (commenter_sk, _, _) = test_keypair(77);

        let mut post = create_signed_post(&owner_sk, "p1", "Post 1", 1000);
        let c1 = create_signed_comment(&commenter_sk, "c1", "p1", "Comment 1", 1010);
        post.comments.insert("c1".into(), c1);
        post.likes.insert("liker_hex".into());

        let mut full_state = FeedState::default();
        full_state.posts.insert("p1".into(), post.clone());

        // Peer has post p1 but is missing the comment and like
        let mut peer_post = post.clone();
        peer_post.comments.clear();
        peer_post.likes.clear();

        let mut peer_state = FeedState::default();
        peer_state.posts.insert("p1".into(), peer_post);

        let peer_summary = summarize(&peer_state);
        let delta = compute_delta(&full_state, &peer_summary);

        // Delta should ONLY include missing comment c1 and liker_hex
        assert_eq!(delta.posts.len(), 1);
        let delta_post = delta.posts.get("p1").unwrap();
        assert_eq!(delta_post.comments.len(), 1);
        assert!(delta_post.comments.contains_key("c1"));
        assert_eq!(delta_post.likes.len(), 1);
        assert!(delta_post.likes.contains("liker_hex"));

        // If states are identical, delta is completely empty
        let identical_summary = summarize(&full_state);
        let empty_delta = compute_delta(&full_state, &identical_summary);
        assert!(empty_delta.posts.is_empty());
        assert!(empty_delta.profile.is_none());
        assert!(empty_delta.following.is_none());
    }

    #[test]
    fn test_freenet_contract_interface_validation_and_update() {
        let (owner_sk, owner_vk, _) = test_keypair(42);
        let params = Parameters::from(owner_vk.as_bytes().to_vec());

        let post = create_signed_post(&owner_sk, "p1", "Freenet validated post", 1000);
        let mut feed = FeedState::default();
        feed.posts.insert("p1".into(), post);

        let valid_state_bytes = ser(&feed).unwrap();
        let state = State::from(valid_state_bytes);

        // 1. validate_state succeeds on valid feed
        let val_res = SpruceFeedContract::validate_state(
            params.clone(),
            state.clone(),
            RelatedContracts::default(),
        )
        .unwrap();
        assert_eq!(val_res, ValidateResult::Valid);

        // 2. validate_state fails if post signature is tampered
        let mut bad_feed = feed.clone();
        bad_feed.posts.get_mut("p1").unwrap().caption = "tampered".into();
        let bad_state = State::from(ser(&bad_feed).unwrap());
        assert!(SpruceFeedContract::validate_state(
            params.clone(),
            bad_state,
            RelatedContracts::default()
        )
        .is_err());

        // 3. get_state_delta returns empty bytes if identical (prevents infinite network gossip)
        let summary = SpruceFeedContract::summarize_state(params.clone(), state.clone()).unwrap();
        let delta = SpruceFeedContract::get_state_delta(params.clone(), state, summary).unwrap();
        assert!(delta.as_ref().is_empty());

        // 4. update_state with Delta successfully updates contract state
        let (bob_sk, _, _) = test_keypair(123);
        let comment = create_signed_comment(&bob_sk, "c1", "p1", "Nice contract!", 1050);
        let mut post_delta = create_signed_post(&owner_sk, "p1", "Freenet validated post", 1000);
        post_delta.comments.insert("c1".into(), comment);
        let mut delta_posts = BTreeMap::new();
        delta_posts.insert("p1".into(), post_delta);

        let feed_delta = FeedDelta {
            profile: None,
            posts: delta_posts,
            following: None,
        };
        let delta_bytes = ser(&feed_delta).unwrap();

        let update_res = SpruceFeedContract::update_state(
            params,
            State::from(ser(&feed).unwrap()),
            vec![UpdateData::Delta(StateDelta::from(delta_bytes))],
        )
        .unwrap();

        let new_state = update_res.unwrap_valid();
        let updated_feed: FeedState = de(new_state.as_ref()).unwrap();
        assert_eq!(
            updated_feed
                .posts
                .get("p1")
                .unwrap()
                .comments
                .len(),
            1
        );
    }
}
