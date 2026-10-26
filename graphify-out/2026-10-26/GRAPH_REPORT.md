# Graph Report - radica  (2026-10-26)

## Corpus Check
- 57 files · ~181,928 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 921 nodes · 2305 edges · 34 communities (29 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c56cbbe7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_main.ts|main.ts]]
- [[_COMMUNITY_FreenetClient|FreenetClient]]
- [[_COMMUNITY_lib.rs|lib.rs]]
- [[_COMMUNITY_init|init]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_whoiam.ts|whoiam.ts]]
- [[_COMMUNITY_🚀 Getting Started|🚀 Getting Started]]
- [[_COMMUNITY_lib.rs|lib.rs]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_moderation.ts|moderation.ts]]
- [[_COMMUNITY_Contributor Covenant Code of Conduct|Contributor Covenant Code of Conduct]]
- [[_COMMUNITY_resetPublishBtnState|resetPublishBtnState]]
- [[_COMMUNITY_signOut|signOut]]
- [[_COMMUNITY_switchToMyPostsScope|switchToMyPostsScope]]
- [[_COMMUNITY_feature_request|feature_request.md]]
- [[_COMMUNITY_WHOIAM_KEY|WHOIAM_KEY]]
- [[_COMMUNITY_SafeStorage|SafeStorage]]
- [[_COMMUNITY_.process|.process]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_caption.ts|caption.ts]]
- [[_COMMUNITY_attachCardListeners|attachCardListeners]]
- [[_COMMUNITY_feedsize.ts|feedsize.ts]]
- [[_COMMUNITY_Contributor Covenant Code of Conduct|Contributor Covenant Code of Conduct]]
- [[_COMMUNITY_roots.ts|roots.ts]]
- [[_COMMUNITY_avatar.ts|avatar.ts]]
- [[_COMMUNITY_fetch-moderation-model.mjs|fetch-moderation-model.mjs]]
- [[_COMMUNITY_icons.ts|icons.ts]]
- [[_COMMUNITY_renderRoots|renderRoots]]
- [[_COMMUNITY_SUMMARY|SUMMARY.md]]
- [[_COMMUNITY_updates.ts|updates.ts]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 106 edges
2. `UserIdentity` - 50 edges
3. `RiverRooms` - 27 edges
4. `PrivateRoom` - 27 edges
5. `init()` - 23 edges
6. `renderTimeline()` - 20 edges
7. `SafeStorage` - 20 edges
8. `Cert` - 20 edges
9. `merge()` - 19 edges
10. `handle()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Entry` --references--> `Cert`  [EXTRACTED]
  log-contract/src/lib.rs → ui/src/whoiam.ts
- `ProfileInfo` --references--> `Cert`  [EXTRACTED]
  contract/src/lib.rs → ui/src/whoiam.ts
- `Comment` --references--> `Cert`  [EXTRACTED]
  contract/src/lib.rs → ui/src/whoiam.ts
- `Like` --references--> `Cert`  [EXTRACTED]
  contract/src/lib.rs → ui/src/whoiam.ts
- `Post` --references--> `Cert`  [EXTRACTED]
  contract/src/lib.rs → ui/src/whoiam.ts

## Import Cycles
- None detected.

## Communities (34 total, 5 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (186): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, allCommunities, allPrivateRooms, blocklistsModal, brandLogo (+178 more)

### Community 1 - "FreenetClient"
Cohesion: 0.07
Nodes (9): FreenetClient, LogEntry, RiverJoin, ChatMessage, Community, NotificationItem, Post, PrivateRoom (+1 more)

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (71): BTreeSet, main(), SigningKey, state(), check_comment(), check_post(), Comment, comment_msg() (+63 more)

### Community 3 - "init"
Cohesion: 0.17
Nodes (36): generateDefaultAvatar(), renderIcon(), attachBubbleDeleteListeners(), blockPublishBtnForNsfw(), chatExcerpt(), chatReadMap(), chatTime(), communityOf() (+28 more)

### Community 4 - "scripts"
Cohesion: 0.07
Nodes (27): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+19 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.12
Nodes (33): getIdentity(), api(), call(), chain, nodeAppKey(), nodeGet(), nodePut(), register() (+25 more)

### Community 6 - "🚀 Getting Started"
Cohesion: 0.09
Nodes (22): 1. Installation, 1. 🛡️ On-Device AI Moderation (Desert Ant Labs), 2. 🔒 Automated PII Redaction & Text Censorship, 2. Development Mode, 3. Contract Compilation & Testing, 3. ⏱️ Decentralized Anti-Flooding & Rate Limiting, 4. Build Production Web Application, 4. 🌐 Cryptographic Personas & Decentralized Storage (+14 more)

### Community 7 - "lib.rs"
Cohesion: 0.10
Nodes (57): AuthorizedEncryptedSecretForMember, AuthorizedMember, ChatRoomParametersV1, ChatRoomStateV1, ChatRoomStateV1Delta, Error, HashMap, MessageId (+49 more)

### Community 8 - "dependencies"
Cohesion: 0.09
Nodes (22): dependencies, @desert-ant-labs/moderator, @fontsource-variable/fraunces, @fontsource-variable/inter, @freenetorg/freenet-stdlib, @litertjs/core, @noble/curves, @noble/ed25519 (+14 more)

### Community 9 - "compilerOptions"
Cohesion: 0.08
Nodes (47): decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptRoomKeyForPeer(), encryptWithSymmetricKey(), formatChatMessageSignatureMessage() (+39 more)

### Community 10 - "moderation.ts"
Cohesion: 0.33
Nodes (7): analyzeImageFile(), analyzeTextContent(), censorTextAndPII(), getModerator(), ImageModerationResult, TextCensorshipResult, TextModerationResult

### Community 11 - "Contributor Covenant Code of Conduct"
Cohesion: 0.10
Nodes (23): Exports, loadRiver(), river(), RiverCall, Anchor, anchorOf(), Floor, instanceOf() (+15 more)

### Community 12 - "resetPublishBtnState"
Cohesion: 0.50
Nodes (4): isPostInCooldown(), resetPublishBtnState(), setMediaVerifiedSafe(), startPostCooldown()

### Community 14 - "signOut"
Cohesion: 0.13
Nodes (34): check(), de(), delta(), Entry, entry_msg(), err(), LogState, merge() (+26 more)

### Community 15 - "switchToMyPostsScope"
Cohesion: 0.16
Nodes (14): applyTheme(), checkUrlInviteHash(), init(), initTheme(), INVITE_PARAMS, inviteFromParams(), reloadPosts(), renderCommunities() (+6 more)

### Community 16 - "feature_request.md"
Cohesion: 0.17
Nodes (13): CURRENT, LEGACY, limiter(), codes, contractCode(), ContractId, contractKey(), FreenetNetwork (+5 more)

### Community 18 - "SafeStorage"
Cohesion: 0.23
Nodes (3): decodeBase64State(), encodeBase64State(), SafeStorage

### Community 19 - ".process"
Cohesion: 0.14
Nodes (20): Identity, key_of(), kv_name(), parse_sk(), Req, Option, Parameters, Result (+12 more)

### Community 20 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+4 more)

### Community 21 - "caption.ts"
Cohesion: 0.37
Nodes (11): escape(), linkCard(), linkify(), nodeOrigin(), render(), renderCaption(), renderPost(), resolve() (+3 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.17
Nodes (13): attachCardListeners(), hiddenUsers(), isHiddenAuthor(), openPostLink(), refreshTrustedBlocklists(), renderBlocklists(), setCuratorTrusted(), setTagFilter() (+5 more)

### Community 23 - "feedsize.ts"
Cohesion: 0.42
Nodes (6): FEED_TARGET, feedBytes(), formatBytes(), oldestToFree(), postBytes(), renderFeedSize()

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.25
Nodes (7): Attribution, Contributor Covenant Code of Conduct, Enforcement, Our Pledge, Our Responsibilities, Our Standards, Scope

### Community 25 - "roots.ts"
Cohesion: 0.53
Nodes (4): cut(), escape(), Root, rootsSvg()

### Community 26 - "avatar.ts"
Cohesion: 0.40
Nodes (3): compressAvatarFile(), compressPostImageFile(), svgToBase64Uri()

### Community 29 - "renderRoots"
Cohesion: 0.67
Nodes (3): renderRoots(), showProfilePage(), updateCategoryCounts()

## Knowledge Gaps
- **289 isolated node(s):** `electron`, `path`, `{dialog}`, `name`, `version` (+284 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cert` connect `lib.rs` to `compilerOptions`, `whoiam.ts`, `signOut`, `FreenetClient`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `FreenetClient` to `main.ts`, `compilerOptions`, `lib.rs`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `FreenetClient` to `compilerOptions`, `Contributor Covenant Code of Conduct`, `whoiam.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `electron`, `path`, `{dialog}` to the rest of the system?**
  _289 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.010582010582010581 - nodes in this community are weakly interconnected._
- **Should `FreenetClient` be split into smaller, more focused modules?**
  _Cohesion score 0.07373428474345906 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.0934761441090555 - nodes in this community are weakly interconnected._