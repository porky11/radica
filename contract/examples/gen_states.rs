use ed25519_dalek::SigningKey;
use radica_contract::{FeedState, ProfileInfo};
use std::collections::BTreeMap;
use std::fs;

fn main() {
    let seed = [42u8; 32];
    let owner_sk = SigningKey::from_bytes(&seed);
    let owner_vk = owner_sk.verifying_key();
    let owner_hex = hex::encode(owner_vk.as_bytes());

    fs::write("params.bin", owner_vk.as_bytes()).expect("write params.bin");

    let s1 = FeedState {
        owner: owner_hex.clone(),
        profile: Some(ProfileInfo {
            display_name: "Alice".into(),
            bio: "Decentralized on Freenet".into(),
            avatar_url: "".into(),
            updated_at: 1000,
            sig: "".into(),
        }),
        posts: BTreeMap::new(),
        following: ["user_b".into()].into_iter().collect(),
    };

    let s2 = FeedState {
        owner: owner_hex,
        profile: Some(ProfileInfo {
            display_name: "Alice Wonderland".into(),
            bio: "Decentralized on Freenet - updated".into(),
            avatar_url: "".into(),
            updated_at: 2000,
            sig: "".into(),
        }),
        posts: BTreeMap::new(),
        following: ["user_b".into(), "user_c".into()].into_iter().collect(),
    };

    fs::write("state1.json", serde_json::to_vec(&s1).unwrap()).expect("write state1.json");
    fs::write("state2.json", serde_json::to_vec(&s2).unwrap()).expect("write state2.json");
    println!("Generated exactly canonical struct state1.json and state2.json");
}
