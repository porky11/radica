# Graph Report - radica  (2026-11-02)

## Corpus Check
- 112 files · ~537,767 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1648 nodes · 4517 edges · 55 communities (45 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 61 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

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
- [[_COMMUNITY_vite.config.ts|vite.config.ts]]
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
- [[_COMMUNITY_CHANGELOG|CHANGELOG.md]]
- [[_COMMUNITY_NotificationItem|NotificationItem]]
- [[_COMMUNITY_.logAppend|.logAppend]]
- [[_COMMUNITY_nodeOrigin|nodeOrigin]]
- [[_COMMUNITY_types.ts|types.ts]]
- [[_COMMUNITY_FREETUNES_KEY|FREETUNES_KEY]]
- [[_COMMUNITY_Reader|Reader]]
- [[_COMMUNITY_showProfilePage|showProfilePage]]
- [[_COMMUNITY_alertUnread|alertUnread]]
- [[_COMMUNITY_freenet.ts|freenet.ts]]
- [[_COMMUNITY_communityFinder.ts|communityFinder.ts]]
- [[_COMMUNITY_WebOfTrust|WebOfTrust]]
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]
- [[_COMMUNITY_gifPicker.ts|gifPicker.ts]]
- [[_COMMUNITY_Reader|Reader]]
- [[_COMMUNITY_NotificationItem|NotificationItem]]
- [[_COMMUNITY_createMessengerChat|createMessengerChat]]
- [[_COMMUNITY_media.ts|media.ts]]
- [[_COMMUNITY_avatar.ts|avatar.ts]]
- [[_COMMUNITY_parseChatMedia|parseChatMedia]]
- [[_COMMUNITY_Radica — domain language|Radica — domain language]]
- [[_COMMUNITY_templateNesting.test.ts|templateNesting.test.ts]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 187 edges
2. `UserIdentity` - 75 edges
3. `renderTimeline()` - 47 edges
4. `escapeHtml()` - 45 edges
5. `PrivateRoom` - 36 edges
6. `RiverRooms` - 33 edges
7. `init()` - 30 edges
8. `SafeStorage` - 30 edges
9. `ChatMessage` - 30 edges
10. `openUserProfile()` - 28 edges

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

## Communities (55 total, 10 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (265): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+257 more)

### Community 1 - "RiverRooms"
Cohesion: 0.14
Nodes (16): giveUpWorker(), lightFeed, lightFeedAsync(), lightFeedOf(), mergeFeedText(), parseInline(), raw, waiting (+8 more)

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.11
Nodes (56): generateDefaultAvatar(), msg(), safeUrl(), shortenKey(), renderIcon(), appendChatMessageToView(), applyChatLayoutAttr(), attachBubbleDeleteListeners() (+48 more)

### Community 4 - "scripts"
Cohesion: 0.07
Nodes (27): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+19 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.06
Nodes (58): getIdentity(), api(), call(), chain, delegateMessage(), kvKey(), message(), nodeAppKey() (+50 more)

### Community 6 - "🚀 Getting Started"
Cohesion: 0.08
Nodes (22): 1. Installation, 1. 🛡️ On-Device AI Moderation (Desert Ant Labs), 2. 🔒 Automated PII Redaction & Text Censorship, 2. Development Mode, 3. Contract Compilation & Testing, 3. ⏱️ Decentralized Anti-Flooding & Rate Limiting, 4. Build Production Web Application, 4. 🌐 Cryptographic Personas & Decentralized Storage (+14 more)

### Community 7 - "lib.rs"
Cohesion: 0.10
Nodes (59): AuthorizedEncryptedSecretForMember, AuthorizedMember, ChatRoomParametersV1, ChatRoomStateV1, ChatRoomStateV1Delta, Error, HashMap, MessageId (+51 more)

### Community 8 - "dependencies"
Cohesion: 0.09
Nodes (22): dependencies, @desert-ant-labs/moderator, @fontsource-variable/fraunces, @fontsource-variable/inter, @freenetorg/freenet-stdlib, @litertjs/core, @noble/curves, @noble/ed25519 (+14 more)

### Community 10 - "moderation.ts"
Cohesion: 0.25
Nodes (9): analyzeImageFile(), analyzeTextContent(), BAD_WORDS, BAD_WORDS_RE, censorTextAndPII(), getModerator(), ImageModerationResult, TextCensorshipResult (+1 more)

### Community 11 - "SafeStorage"
Cohesion: 0.20
Nodes (17): formatChatMessageSignatureMessage(), cancelMessageBurn(), getActiveSecretChatTTL(), getSecretRoomId(), addSecretChatPeer(), burnSecretMessage(), getItem(), peersKey() (+9 more)

### Community 12 - "resetPublishBtnState"
Cohesion: 0.29
Nodes (8): blockPublishBtnForNsfw(), blockPublishBtnForUnverified(), isPostInCooldown(), resetPublishBtnState(), setMediaSensitive(), setMediaVerifiedSafe(), showScanResult(), startPostCooldown()

### Community 13 - "vite.config.ts"
Cohesion: 0.23
Nodes (19): freenet, GENESIS, bodies(), CHAT_REACTIONS, foldBlocklist(), foldChat(), foldChatHides(), foldChatRead() (+11 more)

### Community 14 - "signOut"
Cohesion: 0.13
Nodes (34): check(), de(), delta(), Entry, entry_msg(), err(), LogState, merge() (+26 more)

### Community 16 - "feature_request.md"
Cohesion: 0.10
Nodes (19): CURRENT, LEGACY, limiter(), codes, contractCode(), ContractId, contractKey(), FreenetNetwork (+11 more)

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
Cohesion: 0.05
Nodes (59): CHAT_TOKEN_RE, chatText(), escMd(), extractCommentMedia(), isSafeUrl(), LINK_RE, linkCard(), linkify() (+51 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.23
Nodes (11): FEED_TARGET, feedBytes(), formatBytes(), oldestToFree(), postBytes(), refreshVisibleReactions(), reloadPosts(), renderFeedSize() (+3 more)

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.13
Nodes (16): alertUnread(), checkUrlInviteHash(), checkUrlPostHash(), closeRailPages(), handleJoinFromInviteUrl(), INVITE_PARAMS, inviteFromParams(), isOpen() (+8 more)

### Community 26 - "avatar.ts"
Cohesion: 0.50
Nodes (4): checkCommunitiesOnNetwork(), isJoined(), openCreateCommunityDialog(), renderCommunities()

### Community 28 - "icons.ts"
Cohesion: 0.08
Nodes (51): bitsOf(), cat(), challengeBytes(), checkProof(), decodeProof(), enc, grind(), makeProof() (+43 more)

### Community 29 - "showProfilePage"
Cohesion: 0.25
Nodes (5): ConversationState, MessengerDeps, UnifiedConversation, Community, UserIdentity

### Community 30 - "SUMMARY.md"
Cohesion: 0.06
Nodes (45): decodeCbor(), deltaPrefixOf(), DeltaSite, parseSite(), pointerKey(), pointerParams(), resolveSiteCode(), siteKey() (+37 more)

### Community 31 - "updates.ts"
Cohesion: 0.06
Nodes (38): createDurable(), durable, DURABLE_PREFIXES, DurableNode, DurableStore, isDurable(), packageKey(), renderSupporterStatus() (+30 more)

### Community 32 - "CHANGELOG.md"
Cohesion: 0.21
Nodes (18): activeTimers, clearSecretChatSession(), dec, decryptSecretMessage(), enc, encryptSecretMessage(), formatTtlLabel(), generateEphemeralKeyPair() (+10 more)

### Community 34 - "NotificationItem"
Cohesion: 0.14
Nodes (24): chatMediaCardsHtml(), fileExtensionIcon(), formatBytes(), formatMediaDuration(), normalizeAudioMime(), parseChatMedia(), prepareChatAudioFile(), prepareChatDocFile() (+16 more)

### Community 36 - "nodeOrigin"
Cohesion: 0.27
Nodes (9): CommunitySort, compare(), findCommunities(), FinderInput, FinderResult, slugOf(), all, comm() (+1 more)

### Community 37 - "types.ts"
Cohesion: 0.83
Nodes (3): closeModal(), installModalDismiss(), openModals()

### Community 40 - "Reader"
Cohesion: 0.21
Nodes (14): analyzeAudioBlob(), defaultWaveform(), encodeChatMediaToken(), encodeWaveformHex(), fetchChatMedia(), maskChatMediaTokens(), normalizePeaksToBars(), openChatMedia() (+6 more)

### Community 41 - "showProfilePage"
Cohesion: 0.50
Nodes (4): closeGifPicker(), CURATED_GIFS, GifItem, openGifPicker()

### Community 42 - "alertUnread"
Cohesion: 0.39
Nodes (6): canPostInRoom(), computeSafetyBlocks(), enc, PreviewItem, shouldHydratePreview(), shouldUpdateCachedPreview()

### Community 43 - "freenet.ts"
Cohesion: 0.14
Nodes (26): addReadKeys(), decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptRoomKeyForPeer(), encryptWithSymmetricKey() (+18 more)

### Community 44 - "communityFinder.ts"
Cohesion: 0.54
Nodes (6): countLeadingZeroBits(), createPoWChallenge(), enc, PoWProof, solvePoW(), verifyPoW()

### Community 46 - "WebOfTrust"
Cohesion: 0.27
Nodes (3): PostReactionEvaluation, TrustBadgeInfo, WebOfTrust

### Community 47 - "rootsfx.ts"
Cohesion: 0.12
Nodes (19): checkMilestones(), networkCounts(), renderMilestones(), Counts, countsOf(), FIRST, Metric, METRIC_LABELS (+11 more)

### Community 48 - "gifPicker.ts"
Cohesion: 0.11
Nodes (36): cacheCard(), deleteCommentFromCard(), deletePostFromCard(), formatTimeAgo(), getWebOfTrust(), initCardListeners(), isWotModerationEnabled(), modDeleteFromCard() (+28 more)

### Community 51 - "NotificationItem"
Cohesion: 0.67
Nodes (3): reconcile(), reconcileItems(), NotificationItem

### Community 52 - "createMessengerChat"
Cohesion: 0.20
Nodes (19): burnAtOf(), checksHtml(), ConversationDeps, createConversationState(), Delivery, deliveryOf(), dmPeerOf(), KeyValue (+11 more)

### Community 53 - "media.ts"
Cohesion: 0.33
Nodes (7): dataUrlBytes(), inflight, keepMedia(), mediaUrl(), bytes, hash, urls

### Community 54 - "avatar.ts"
Cohesion: 0.29
Nodes (6): avatarCache, buildDefaultAvatar(), compressAvatarFile(), compressPostImageFile(), svgToBase64Uri(), h()

### Community 55 - "parseChatMedia"
Cohesion: 0.14
Nodes (23): AUDIO_EXT, blobCache, cacheKeyOf(), ChatMediaItem, ChatMediaKind, dataUriToBytesAndMime(), decodeWaveformHex(), fillChatMedia() (+15 more)

### Community 57 - "Radica — domain language"
Cohesion: 0.40
Nodes (4): Chat, Decisions, Device storage, Radica — domain language

## Knowledge Gaps
- **427 isolated node(s):** `electron`, `path`, `{dialog}`, `name`, `version` (+422 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cert` connect `lib.rs` to `RiverRooms`, `whoiam.ts`, `vite.config.ts`, `signOut`, `feedsize.ts`, `showProfilePage`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `delta.ts` to `CHANGELOG.md`, `.logAppend`, `whoiam.ts`, `Reader`, `compilerOptions`, `SafeStorage`, `freenet.ts`, `vite.config.ts`, `feature_request.md`, `feedsize.ts`, `freenames.ts`, `showProfilePage`, `SUMMARY.md`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `showProfilePage` to `main.ts`, `RiverRooms`, `NotificationItem`, `.logAppend`, `lib.rs`, `compilerOptions`, `freenet.ts`, `SafeStorage`, `vite.config.ts`, `delta.ts`, `feedsize.ts`, `freenames.ts`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `electron`, `path`, `{dialog}` to the rest of the system?**
  _427 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.007380073800738007 - nodes in this community are weakly interconnected._
- **Should `RiverRooms` be split into smaller, more focused modules?**
  _Cohesion score 0.13666666666666666 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._