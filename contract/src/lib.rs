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
    use rand::rngs::OsRng;

    #[test]
    fn test_merge_idempotence() {
        let mut csprng = OsRng;
        let mut secret = [0u8; 32];
        rand::RngCore::fill_bytes(&mut csprng, &mut secret);
        let keypair = ed25519_dalek::SigningKey::from_bytes(&secret);
        let pubkey = keypair.verifying_key();
        let author = hex::encode(pubkey.as_bytes());
        let post_msg = format!("post1:{}:thought:Hello Freenet!::1000", author);
        let sig = keypair.sign(post_msg.as_bytes());

        let post = Post {
            id: "post1".into(),
            author,
            category: "thought".into(),
            caption: "Hello Freenet!".into(),
            community_id: None,
            media_uri: None,
            location: None,
            event_date: None,
            timestamp: 1000,
            sig: hex::encode(sig.to_bytes()),
            likes: BTreeSet::new(),
            comments: BTreeMap::new(),
        };

        let mut s1 = FeedState::default();
        let mut posts = BTreeMap::new();
        posts.insert("post1".into(), post);

        let delta = FeedDelta {
            profile: None,
            posts,
            following: None,
        };

        // First apply
        apply_delta(&pubkey, &mut s1, delta.clone()).unwrap();
        let count_after_first = s1.posts.len();
        assert_eq!(count_after_first, 1);

        // Second apply (must be idempotent: merge(A, A) == A)
        apply_delta(&pubkey, &mut s1, delta).unwrap();
        assert_eq!(s1.posts.len(), 1);
    }
}
