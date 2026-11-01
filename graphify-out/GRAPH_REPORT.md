# Graph Report - radica  (2026-11-01)

## Corpus Check
- 94 files · ~508,635 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1414 nodes · 3808 edges · 53 communities (41 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bedee6b0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_main.ts|main.ts]]
- [[_COMMUNITY_RiverRooms|RiverRooms]]
- [[_COMMUNITY_lib.rs|lib.rs]]
- [[_COMMUNITY_init|init]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_whoiam.ts|whoiam.ts]]
- [[_COMMUNITY_🚀 Getting Started|🚀 Getting Started]]
- [[_COMMUNITY_lib.rs|lib.rs]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_moderation.ts|moderation.ts]]
- [[_COMMUNITY_SafeStorage|SafeStorage]]
- [[_COMMUNITY_resetPublishBtnState|resetPublishBtnState]]
- [[_COMMUNITY_signOut|signOut]]
- [[_COMMUNITY_delta.ts|delta.ts]]
- [[_COMMUNITY_feature_request|feature_request.md]]
- [[_COMMUNITY_WHOIAM_KEY|WHOIAM_KEY]]
- [[_COMMUNITY_SafeStorage|SafeStorage]]
- [[_COMMUNITY_.process|.process]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_caption.ts|caption.ts]]
- [[_COMMUNITY_attachCardListeners|attachCardListeners]]
- [[_COMMUNITY_feedsize.ts|feedsize.ts]]
- [[_COMMUNITY_Contributor Covenant Code of Conduct|Contributor Covenant Code of Conduct]]
- [[_COMMUNITY_freenames.ts|freenames.ts]]
- [[_COMMUNITY_avatar.ts|avatar.ts]]
- [[_COMMUNITY_fetch-moderation-model.mjs|fetch-moderation-model.mjs]]
- [[_COMMUNITY_icons.ts|icons.ts]]
- [[_COMMUNITY_showProfilePage|showProfilePage]]
- [[_COMMUNITY_SUMMARY|SUMMARY.md]]
- [[_COMMUNITY_updates.ts|updates.ts]]
- [[_COMMUNITY_NotificationItem|NotificationItem]]
- [[_COMMUNITY_.logAppend|.logAppend]]
- [[_COMMUNITY_nodeOrigin|nodeOrigin]]
- [[_COMMUNITY_types.ts|types.ts]]
- [[_COMMUNITY_FREETUNES_KEY|FREETUNES_KEY]]
- [[_COMMUNITY_checkUrlInviteHash|checkUrlInviteHash]]
- [[_COMMUNITY_Reader|Reader]]
- [[_COMMUNITY_showProfilePage|showProfilePage]]
- [[_COMMUNITY_alertUnread|alertUnread]]
- [[_COMMUNITY_freenet.ts|freenet.ts]]
- [[_COMMUNITY_types.ts|types.ts]]
- [[_COMMUNITY_WebOfTrust|WebOfTrust]]
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]
- [[_COMMUNITY_gifPicker.ts|gifPicker.ts]]
- [[_COMMUNITY_checkUrlInviteHash|checkUrlInviteHash]]
- [[_COMMUNITY_showProfilePage|showProfilePage]]
- [[_COMMUNITY_NotificationItem|NotificationItem]]
- [[_COMMUNITY_alertUnread|alertUnread]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 161 edges
2. `UserIdentity` - 65 edges
3. `renderTimeline()` - 46 edges
4. `PrivateRoom` - 33 edges
5. `RiverRooms` - 32 edges
6. `init()` - 29 edges
7. `openUserProfile()` - 26 edges
8. `SafeStorage` - 26 edges
9. `escapeHtml()` - 25 edges
10. `getAuthorDisplayName()` - 24 edges

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
- 3-file cycle: `ui/src/crypto.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/crypto.ts`
- 4-file cycle: `ui/src/crypto.ts -> ui/src/types.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/crypto.ts`
- 4-file cycle: `ui/src/crypto.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/riverPointer.ts -> ui/src/crypto.ts`
- 5-file cycle: `ui/src/crypto.ts -> ui/src/types.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/riverPointer.ts -> ui/src/crypto.ts`

## Communities (53 total, 12 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (212): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+204 more)

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.14
Nodes (44): generateDefaultAvatar(), appendChatMessageToView(), applyChatLayoutAttr(), attachBubbleDeleteListeners(), chatExcerpt(), chatReadMap(), chatTime(), clearActiveChat() (+36 more)

### Community 4 - "scripts"
Cohesion: 0.07
Nodes (27): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+19 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.08
Nodes (52): getIdentity(), api(), call(), chain, delegateMessage(), kvKey(), message(), nodeAppKey() (+44 more)

### Community 6 - "🚀 Getting Started"
Cohesion: 0.09
Nodes (22): 1. Installation, 1. 🛡️ On-Device AI Moderation (Desert Ant Labs), 2. 🔒 Automated PII Redaction & Text Censorship, 2. Development Mode, 3. Contract Compilation & Testing, 3. ⏱️ Decentralized Anti-Flooding & Rate Limiting, 4. Build Production Web Application, 4. 🌐 Cryptographic Personas & Decentralized Storage (+14 more)

### Community 7 - "lib.rs"
Cohesion: 0.10
Nodes (58): AuthorizedEncryptedSecretForMember, AuthorizedMember, ChatRoomParametersV1, ChatRoomStateV1, ChatRoomStateV1Delta, Error, HashMap, MessageId (+50 more)

### Community 8 - "dependencies"
Cohesion: 0.09
Nodes (22): dependencies, @desert-ant-labs/moderator, @fontsource-variable/fraunces, @fontsource-variable/inter, @freenetorg/freenet-stdlib, @litertjs/core, @noble/curves, @noble/ed25519 (+14 more)

### Community 10 - "moderation.ts"
Cohesion: 0.25
Nodes (9): analyzeImageFile(), analyzeTextContent(), BAD_WORDS, BAD_WORDS_RE, censorTextAndPII(), getModerator(), ImageModerationResult, TextCensorshipResult (+1 more)

### Community 11 - "SafeStorage"
Cohesion: 0.25
Nodes (3): RiverNet, RiverRooms, vkOf()

### Community 12 - "resetPublishBtnState"
Cohesion: 0.29
Nodes (8): blockPublishBtnForNsfw(), blockPublishBtnForUnverified(), isPostInCooldown(), resetPublishBtnState(), setMediaSensitive(), setMediaVerifiedSafe(), showScanResult(), startPostCooldown()

### Community 14 - "signOut"
Cohesion: 0.13
Nodes (34): check(), de(), delta(), Entry, entry_msg(), err(), LogState, merge() (+26 more)

### Community 16 - "feature_request.md"
Cohesion: 0.10
Nodes (20): CURRENT, LEGACY, limiter(), yieldToMain(), codes, contractCode(), ContractId, contractKey() (+12 more)

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
Cohesion: 0.09
Nodes (38): CHAT_TOKEN_RE, chatText(), escape(), escMd(), extractCommentMedia(), linkCard(), linkify(), md() (+30 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.50
Nodes (4): checkCommunitiesOnNetwork(), isJoined(), openCreateCommunityDialog(), renderCommunities()

### Community 23 - "feedsize.ts"
Cohesion: 0.23
Nodes (17): bodies(), CHAT_REACTIONS, foldBlocklist(), foldChat(), foldChatHides(), foldChatRead(), foldCommentLikes(), foldCommunities() (+9 more)

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.53
Nodes (4): cut(), escape(), Root, rootsSvg()

### Community 26 - "avatar.ts"
Cohesion: 0.12
Nodes (22): ECOSYSTEM, EcosystemApp, ecosystemCard(), ecosystemFooter(), esc(), hrefOf(), link(), chunk() (+14 more)

### Community 28 - "icons.ts"
Cohesion: 0.07
Nodes (52): bitsOf(), cat(), challengeBytes(), checkProof(), decodeProof(), enc, grind(), makeProof() (+44 more)

### Community 30 - "SUMMARY.md"
Cohesion: 0.16
Nodes (18): Exports, loadRiver(), river(), RiverCall, Anchor, anchorOf(), instanceOf(), keyOf() (+10 more)

### Community 31 - "updates.ts"
Cohesion: 0.15
Nodes (12): updateNotifsSoundBtn(), getAudioContext(), isSoundEnabled(), playBufferPop(), playPopSound(), playSynthesizedPop(), preloadPopSound(), setSoundEnabled() (+4 more)

### Community 34 - "NotificationItem"
Cohesion: 0.06
Nodes (61): avatarCache, buildDefaultAvatar(), compressAvatarFile(), compressPostImageFile(), svgToBase64Uri(), analyzeAudioBlob(), blobCache, cacheKeyOf() (+53 more)

### Community 36 - "nodeOrigin"
Cohesion: 0.08
Nodes (28): CommunitySort, compare(), findCommunities(), FinderInput, FinderResult, slugOf(), all, comm() (+20 more)

### Community 37 - "types.ts"
Cohesion: 0.83
Nodes (3): closeModal(), installModalDismiss(), openModals()

### Community 39 - "checkUrlInviteHash"
Cohesion: 0.50
Nodes (4): closeGifPicker(), CURATED_GIFS, GifItem, openGifPicker()

### Community 40 - "Reader"
Cohesion: 0.26
Nodes (4): MessengerDeps, UnifiedConversation, Community, UserIdentity

### Community 41 - "showProfilePage"
Cohesion: 0.24
Nodes (14): decodeCbor(), deltaPrefixOf(), DeltaSite, pageHref(), parseSite(), pointerKey(), pointerParams(), resolveSiteCode() (+6 more)

### Community 42 - "alertUnread"
Cohesion: 0.22
Nodes (9): nameHref(), namesOf(), ownerOf(), registryKey(), RegState, sitesOf(), A, B (+1 more)

### Community 43 - "freenet.ts"
Cohesion: 0.16
Nodes (28): addReadKeys(), decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptRoomKeyForPeer(), encryptWithSymmetricKey() (+20 more)

### Community 47 - "rootsfx.ts"
Cohesion: 0.12
Nodes (19): checkMilestones(), networkCounts(), renderMilestones(), Counts, countsOf(), FIRST, Metric, METRIC_LABELS (+11 more)

### Community 48 - "gifPicker.ts"
Cohesion: 0.08
Nodes (55): nodeOrigin(), formatBytes(), renderIcon(), cacheCard(), deleteCommentFromCard(), deletePostFromCard(), formatTimeAgo(), getWebOfTrust() (+47 more)

### Community 49 - "checkUrlInviteHash"
Cohesion: 0.50
Nodes (4): checkUrlInviteHash(), INVITE_PARAMS, inviteFromParams(), riverCodeIn()

### Community 50 - "showProfilePage"
Cohesion: 0.67
Nodes (3): closeRailPages(), isOpen(), showProfilePage()

### Community 51 - "NotificationItem"
Cohesion: 0.67
Nodes (3): reconcile(), reconcileItems(), NotificationItem

## Knowledge Gaps
- **358 isolated node(s):** `electron`, `path`, `{dialog}`, `name`, `version` (+353 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cert` connect `lib.rs` to `nodeOrigin`, `whoiam.ts`, `Reader`, `signOut`, `feedsize.ts`, `showProfilePage`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `showProfilePage` to `RiverRooms`, `NotificationItem`, `whoiam.ts`, `Reader`, `compilerOptions`, `showProfilePage`, `freenet.ts`, `alertUnread`, `.applyLog`, `SafeStorage`, `delta.ts`, `caption.ts`, `freenames.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `Reader` to `main.ts`, `RiverRooms`, `NotificationItem`, `lib.rs`, `nodeOrigin`, `compilerOptions`, `freenet.ts`, `.applyLog`, `delta.ts`, `freenames.ts`, `showProfilePage`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `electron`, `path`, `{dialog}` to the rest of the system?**
  _358 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.009216589861751152 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._
- **Should `init` be split into smaller, more focused modules?**
  _Cohesion score 0.13847780126849896 - nodes in this community are weakly interconnected._