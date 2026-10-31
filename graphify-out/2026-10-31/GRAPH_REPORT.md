# Graph Report - radica  (2026-10-31)

## Corpus Check
- 83 files · ~219,820 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1298 nodes · 3428 edges · 37 communities (33 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ae4dfdc5`
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
- [[_COMMUNITY_showProfilePage|showProfilePage]]
- [[_COMMUNITY_SUMMARY|SUMMARY.md]]
- [[_COMMUNITY_updates.ts|updates.ts]]
- [[_COMMUNITY_NotificationItem|NotificationItem]]
- [[_COMMUNITY_.logAppend|.logAppend]]
- [[_COMMUNITY_freetunes.ts|freetunes.ts]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 149 edges
2. `UserIdentity` - 60 edges
3. `renderTimeline()` - 41 edges
4. `RiverRooms` - 32 edges
5. `PrivateRoom` - 32 edges
6. `init()` - 26 edges
7. `openUserProfile()` - 25 edges
8. `escapeHtml()` - 24 edges
9. `SafeStorage` - 24 edges
10. `Community` - 23 edges

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

## Communities (37 total, 4 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (209): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+201 more)

### Community 1 - "FreenetClient"
Cohesion: 0.05
Nodes (12): formatChatMessageSignatureMessage(), FreenetClient, LogEntry, MessengerActiveState, MessengerDeps, UnifiedConversation, RiverJoin, ChatMessage (+4 more)

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.12
Nodes (49): generateDefaultAvatar(), nodeOrigin(), renderIcon(), appendChatMessageToView(), applyChatLayoutAttr(), attachBubbleDeleteListeners(), chatExcerpt(), chatTime() (+41 more)

### Community 4 - "scripts"
Cohesion: 0.07
Nodes (27): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+19 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.09
Nodes (45): api(), call(), chain, delegateMessage(), kvKey(), message(), nodeAppKey(), nodeGet() (+37 more)

### Community 6 - "🚀 Getting Started"
Cohesion: 0.09
Nodes (22): 1. Installation, 1. 🛡️ On-Device AI Moderation (Desert Ant Labs), 2. 🔒 Automated PII Redaction & Text Censorship, 2. Development Mode, 3. Contract Compilation & Testing, 3. ⏱️ Decentralized Anti-Flooding & Rate Limiting, 4. Build Production Web Application, 4. 🌐 Cryptographic Personas & Decentralized Storage (+14 more)

### Community 7 - "lib.rs"
Cohesion: 0.10
Nodes (58): AuthorizedEncryptedSecretForMember, AuthorizedMember, ChatRoomParametersV1, ChatRoomStateV1, ChatRoomStateV1Delta, Error, HashMap, MessageId (+50 more)

### Community 8 - "dependencies"
Cohesion: 0.09
Nodes (22): dependencies, @desert-ant-labs/moderator, @fontsource-variable/fraunces, @fontsource-variable/inter, @freenetorg/freenet-stdlib, @litertjs/core, @noble/curves, @noble/ed25519 (+14 more)

### Community 9 - "compilerOptions"
Cohesion: 0.07
Nodes (53): compressPostImageFile(), addReadKeys(), decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptRoomKeyForPeer() (+45 more)

### Community 10 - "moderation.ts"
Cohesion: 0.25
Nodes (9): analyzeImageFile(), analyzeTextContent(), BAD_WORDS, BAD_WORDS_RE, censorTextAndPII(), getModerator(), ImageModerationResult, TextCensorshipResult (+1 more)

### Community 11 - "Contributor Covenant Code of Conduct"
Cohesion: 0.08
Nodes (36): decodeCbor(), deltaPrefixOf(), DeltaSite, pageHref(), parseSite(), pointerKey(), pointerParams(), resolveSiteCode() (+28 more)

### Community 12 - "resetPublishBtnState"
Cohesion: 0.29
Nodes (8): blockPublishBtnForNsfw(), blockPublishBtnForUnverified(), isPostInCooldown(), resetPublishBtnState(), setMediaSensitive(), setMediaVerifiedSafe(), showScanResult(), startPostCooldown()

### Community 14 - "signOut"
Cohesion: 0.13
Nodes (34): check(), de(), delta(), Entry, entry_msg(), err(), LogState, merge() (+26 more)

### Community 15 - "switchToMyPostsScope"
Cohesion: 0.12
Nodes (19): getIdentity(), yieldToMain(), applyTheme(), bootSettled(), bootStep(), checkUrlInviteHash(), hideBoot(), init() (+11 more)

### Community 16 - "feature_request.md"
Cohesion: 0.08
Nodes (28): CURRENT, LEGACY, limiter(), dataUrlBytes(), inflight, keepMedia(), mediaHashOf(), mediaRef() (+20 more)

### Community 18 - "SafeStorage"
Cohesion: 0.17
Nodes (18): delta_only_to_a_peer_without_it(), only_the_named_bytes_are_valid(), params(), RadicaMediaContract, ContractError, ContractInterface, Parameters, RelatedContracts (+10 more)

### Community 19 - ".process"
Cohesion: 0.14
Nodes (20): Identity, key_of(), kv_name(), parse_sk(), Req, Option, Parameters, Result (+12 more)

### Community 20 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+4 more)

### Community 21 - "caption.ts"
Cohesion: 0.14
Nodes (25): chatText(), escape(), escMd(), linkCard(), linkify(), md(), mention(), mentionsIn() (+17 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.10
Nodes (33): alertUnread(), chatReadMap(), checkCommunitiesOnNetwork(), deleteCommentFromCard(), deletePostFromCard(), formatTimeAgo(), initCardListeners(), isJoined() (+25 more)

### Community 23 - "feedsize.ts"
Cohesion: 0.08
Nodes (30): CommunitySort, compare(), findCommunities(), FinderInput, FinderResult, slugOf(), all, comm() (+22 more)

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.15
Nodes (14): checkMilestones(), networkCounts(), renderMilestones(), Counts, countsOf(), FIRST, Metric, METRIC_LABELS (+6 more)

### Community 25 - "roots.ts"
Cohesion: 0.53
Nodes (4): cut(), escape(), Root, rootsSvg()

### Community 26 - "avatar.ts"
Cohesion: 0.32
Nodes (8): hiddenUsers(), isHiddenAuthor(), refreshTrustedBlocklists(), renderBlocklists(), saveList(), setCuratorTrusted(), setUserHidden(), trustedCurators()

### Community 28 - "icons.ts"
Cohesion: 0.07
Nodes (52): bitsOf(), cat(), challengeBytes(), checkProof(), decodeProof(), enc, grind(), makeProof() (+44 more)

### Community 29 - "showProfilePage"
Cohesion: 0.50
Nodes (4): closeRailPages(), isOpen(), showFeed(), showProfilePage()

### Community 30 - "SUMMARY.md"
Cohesion: 0.83
Nodes (3): closeModal(), installModalDismiss(), openModals()

### Community 34 - "NotificationItem"
Cohesion: 0.40
Nodes (4): avatarCache, buildDefaultAvatar(), compressAvatarFile(), svgToBase64Uri()

### Community 38 - "freetunes.ts"
Cohesion: 0.06
Nodes (26): freenet, chunk(), esc(), Fetch, fillFreetunes(), fmtTime(), freetunesCard(), freetunesLink() (+18 more)

## Knowledge Gaps
- **346 isolated node(s):** `electron`, `path`, `{dialog}`, `name`, `version` (+341 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cert` connect `lib.rs` to `FreenetClient`, `whoiam.ts`, `compilerOptions`, `signOut`, `feedsize.ts`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `FreenetClient` to `init`, `compilerOptions`, `Contributor Covenant Code of Conduct`, `feature_request.md`, `feedsize.ts`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `FreenetClient` to `main.ts`, `lib.rs`, `freetunes.ts`, `compilerOptions`, `feedsize.ts`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `electron`, `path`, `{dialog}` to the rest of the system?**
  _346 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.009302325581395349 - nodes in this community are weakly interconnected._
- **Should `FreenetClient` be split into smaller, more focused modules?**
  _Cohesion score 0.05314710683838201 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._