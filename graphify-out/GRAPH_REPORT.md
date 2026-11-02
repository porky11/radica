# Graph Report - radica  (2026-11-02)

## Corpus Check
- 98 files · ~524,980 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1534 nodes · 4164 edges · 53 communities (46 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `acf3c685`
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
- [[_COMMUNITY_avatar.ts|avatar.ts]]
- [[_COMMUNITY_fetch-moderation-model.mjs|fetch-moderation-model.mjs]]
- [[_COMMUNITY_icons.ts|icons.ts]]
- [[_COMMUNITY_showProfilePage|showProfilePage]]
- [[_COMMUNITY_SUMMARY|SUMMARY.md]]
- [[_COMMUNITY_updates.ts|updates.ts]]
- [[_COMMUNITY_CHANGELOG|CHANGELOG.md]]
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
- [[_COMMUNITY_.applyLog|.applyLog]]
- [[_COMMUNITY_WebOfTrust|WebOfTrust]]
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]
- [[_COMMUNITY_gifPicker.ts|gifPicker.ts]]
- [[_COMMUNITY_checkUrlInviteHash|checkUrlInviteHash]]
- [[_COMMUNITY_showProfilePage|showProfilePage]]
- [[_COMMUNITY_NotificationItem|NotificationItem]]
- [[_COMMUNITY_renderCommunities|renderCommunities]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 182 edges
2. `UserIdentity` - 71 edges
3. `renderTimeline()` - 47 edges
4. `PrivateRoom` - 36 edges
5. `RiverRooms` - 33 edges
6. `init()` - 30 edges
7. `openUserProfile()` - 28 edges
8. `getAuthorDisplayName()` - 27 edges
9. `SafeStorage` - 27 edges
10. `escapeHtml()` - 26 edges

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

## Communities (53 total, 7 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (258): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+250 more)

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.13
Nodes (51): generateDefaultAvatar(), renderIcon(), applyChatLayoutAttr(), attachBubbleDeleteListeners(), chatExcerpt(), chatTime(), clearActiveChat(), currentChatLayout() (+43 more)

### Community 4 - "scripts"
Cohesion: 0.07
Nodes (27): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+19 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.07
Nodes (56): getIdentity(), api(), call(), chain, delegateMessage(), kvKey(), message(), nodeAppKey() (+48 more)

### Community 6 - "🚀 Getting Started"
Cohesion: 0.08
Nodes (22): 1. Installation, 1. 🛡️ On-Device AI Moderation (Desert Ant Labs), 2. 🔒 Automated PII Redaction & Text Censorship, 2. Development Mode, 3. Contract Compilation & Testing, 3. ⏱️ Decentralized Anti-Flooding & Rate Limiting, 4. Build Production Web Application, 4. 🌐 Cryptographic Personas & Decentralized Storage (+14 more)

### Community 7 - "lib.rs"
Cohesion: 0.10
Nodes (59): AuthorizedEncryptedSecretForMember, AuthorizedMember, ChatRoomParametersV1, ChatRoomStateV1, ChatRoomStateV1Delta, Error, HashMap, MessageId (+51 more)

### Community 8 - "dependencies"
Cohesion: 0.09
Nodes (22): dependencies, @desert-ant-labs/moderator, @fontsource-variable/fraunces, @fontsource-variable/inter, @freenetorg/freenet-stdlib, @litertjs/core, @noble/curves, @noble/ed25519 (+14 more)

### Community 9 - "compilerOptions"
Cohesion: 0.24
Nodes (3): roomOwnerSk(), vkOf(), PrivateRoom

### Community 10 - "moderation.ts"
Cohesion: 0.25
Nodes (9): analyzeImageFile(), analyzeTextContent(), BAD_WORDS, BAD_WORDS_RE, censorTextAndPII(), getModerator(), ImageModerationResult, TextCensorshipResult (+1 more)

### Community 11 - "SafeStorage"
Cohesion: 0.16
Nodes (22): activeTimers, clearSecretChatSession(), dec, decryptSecretMessage(), enc, encryptSecretMessage(), formatTtlLabel(), generateEphemeralKeyPair() (+14 more)

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
Cohesion: 0.08
Nodes (43): CHAT_TOKEN_RE, chatText(), escape(), escMd(), extractCommentMedia(), linkCard(), linkify(), md() (+35 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.40
Nodes (5): alertUnread(), chatReadMap(), toShell(), updateChatBadge(), updateNotificationsBadge()

### Community 23 - "feedsize.ts"
Cohesion: 0.23
Nodes (17): bodies(), CHAT_REACTIONS, foldBlocklist(), foldChat(), foldChatHides(), foldChatRead(), foldCommentLikes(), foldCommunities() (+9 more)

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.53
Nodes (4): cut(), escape(), Root, rootsSvg()

### Community 26 - "avatar.ts"
Cohesion: 0.16
Nodes (15): chunk(), esc(), Fetch, fillFreetunes(), fmtTime(), freetunesCard(), freetunesLink(), FtRelease (+7 more)

### Community 28 - "icons.ts"
Cohesion: 0.08
Nodes (51): bitsOf(), cat(), challengeBytes(), checkProof(), decodeProof(), enc, grind(), makeProof() (+43 more)

### Community 29 - "showProfilePage"
Cohesion: 0.13
Nodes (5): UnifiedConversation, PoWProof, Community, Post, UserIdentity

### Community 30 - "SUMMARY.md"
Cohesion: 0.06
Nodes (44): decodeCbor(), deltaPrefixOf(), DeltaSite, pageHref(), parseSite(), pointerKey(), pointerParams(), resolveSiteCode() (+36 more)

### Community 31 - "updates.ts"
Cohesion: 0.15
Nodes (12): updateNotifsSoundBtn(), getAudioContext(), isSoundEnabled(), playBufferPop(), playPopSound(), playSynthesizedPop(), preloadPopSound(), setSoundEnabled() (+4 more)

### Community 32 - "CHANGELOG.md"
Cohesion: 0.47
Nodes (7): ECOSYSTEM, EcosystemApp, ecosystemCard(), ecosystemFooter(), esc(), hrefOf(), link()

### Community 34 - "NotificationItem"
Cohesion: 0.12
Nodes (35): analyzeAudioBlob(), blobCache, cacheKeyOf(), chatMediaCardsHtml(), ChatMediaItem, ChatMediaKind, dataUriToBytesAndMime(), decodeWaveformHex() (+27 more)

### Community 36 - "nodeOrigin"
Cohesion: 0.14
Nodes (16): giveUpWorker(), lightFeed, lightFeedAsync(), lightFeedOf(), mergeFeedText(), parseInline(), raw, waiting (+8 more)

### Community 37 - "types.ts"
Cohesion: 0.83
Nodes (3): closeModal(), installModalDismiss(), openModals()

### Community 39 - "checkUrlInviteHash"
Cohesion: 0.50
Nodes (4): closeGifPicker(), CURATED_GIFS, GifItem, openGifPicker()

### Community 40 - "Reader"
Cohesion: 0.14
Nodes (21): plainMentions(), measureImageDimensions(), normalizeAudioMime(), prepareChatAudioFile(), prepareChatDocFile(), prepareChatImageFile(), PreparedChatMedia, handleClassicDropFiles() (+13 more)

### Community 41 - "showProfilePage"
Cohesion: 0.29
Nodes (6): avatarCache, buildDefaultAvatar(), compressAvatarFile(), compressPostImageFile(), svgToBase64Uri(), h()

### Community 42 - "alertUnread"
Cohesion: 0.27
Nodes (9): CommunitySort, compare(), findCommunities(), FinderInput, FinderResult, slugOf(), all, comm() (+1 more)

### Community 43 - "freenet.ts"
Cohesion: 0.15
Nodes (30): addReadKeys(), decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptRoomKeyForPeer(), encryptWithSymmetricKey() (+22 more)

### Community 45 - ".applyLog"
Cohesion: 0.36
Nodes (7): FEED_TARGET, feedBytes(), formatBytes(), oldestToFree(), postBytes(), renderFeedSize(), updateMyPostsAndScopeCounts()

### Community 46 - "WebOfTrust"
Cohesion: 0.27
Nodes (3): PostReactionEvaluation, TrustBadgeInfo, WebOfTrust

### Community 47 - "rootsfx.ts"
Cohesion: 0.15
Nodes (14): checkMilestones(), networkCounts(), renderMilestones(), Counts, countsOf(), FIRST, Metric, METRIC_LABELS (+6 more)

### Community 48 - "gifPicker.ts"
Cohesion: 0.08
Nodes (50): cacheCard(), checkUrlInviteHash(), checkUrlPostHash(), closeRailPages(), deleteCommentFromCard(), deletePostFromCard(), formatTimeAgo(), getWebOfTrust() (+42 more)

### Community 49 - "checkUrlInviteHash"
Cohesion: 0.25
Nodes (8): appendChatMessageToView(), hiddenUsers(), isHiddenAuthor(), openRoomId(), saveList(), sendActiveChatText(), setCuratorTrusted(), setUserHidden()

### Community 50 - "showProfilePage"
Cohesion: 0.43
Nodes (5): computeSafetyBlocks(), enc, PreviewItem, shouldHydratePreview(), shouldUpdateCachedPreview()

### Community 51 - "NotificationItem"
Cohesion: 0.67
Nodes (3): reconcile(), reconcileItems(), NotificationItem

### Community 52 - "renderCommunities"
Cohesion: 0.50
Nodes (4): checkCommunitiesOnNetwork(), isJoined(), openCreateCommunityDialog(), renderCommunities()

## Knowledge Gaps
- **408 isolated node(s):** `electron`, `path`, `{dialog}`, `name`, `version` (+403 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cert` connect `lib.rs` to `nodeOrigin`, `whoiam.ts`, `signOut`, `feedsize.ts`, `showProfilePage`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `delta.ts` to `RiverRooms`, `NotificationItem`, `whoiam.ts`, `compilerOptions`, `freenet.ts`, `SafeStorage`, `feature_request.md`, `freenames.ts`, `showProfilePage`, `SUMMARY.md`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `showProfilePage` to `main.ts`, `RiverRooms`, `lib.rs`, `nodeOrigin`, `Reader`, `compilerOptions`, `freenet.ts`, `delta.ts`, `freenames.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `electron`, `path`, `{dialog}` to the rest of the system?**
  _408 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.007547169811320755 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._
- **Should `init` be split into smaller, more focused modules?**
  _Cohesion score 0.13176470588235295 - nodes in this community are weakly interconnected._