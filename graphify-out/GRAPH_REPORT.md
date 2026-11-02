# Graph Report - radica  (2026-11-02)

## Corpus Check
- 112 files · ~537,974 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1649 nodes · 4520 edges · 61 communities (52 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.66)
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
- [[_COMMUNITY_versionCheck.ts|versionCheck.ts]]
- [[_COMMUNITY_Reader|Reader]]
- [[_COMMUNITY_showProfilePage|showProfilePage]]
- [[_COMMUNITY_alertUnread|alertUnread]]
- [[_COMMUNITY_freenet.ts|freenet.ts]]
- [[_COMMUNITY_communityFinder.ts|communityFinder.ts]]
- [[_COMMUNITY_freenames.ts|freenames.ts]]
- [[_COMMUNITY_WebOfTrust|WebOfTrust]]
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]
- [[_COMMUNITY_gifPicker.ts|gifPicker.ts]]
- [[_COMMUNITY_createMessengerChat|createMessengerChat]]
- [[_COMMUNITY_Reader|Reader]]
- [[_COMMUNITY_NotificationItem|NotificationItem]]
- [[_COMMUNITY_createMessengerChat|createMessengerChat]]
- [[_COMMUNITY_media.ts|media.ts]]
- [[_COMMUNITY_avatar.ts|avatar.ts]]
- [[_COMMUNITY_parseChatMedia|parseChatMedia]]
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]
- [[_COMMUNITY_Radica — domain language|Radica — domain language]]
- [[_COMMUNITY_Reader|Reader]]
- [[_COMMUNITY_templateNesting.test.ts|templateNesting.test.ts]]
- [[_COMMUNITY_roots.ts|roots.ts]]

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

## Communities (61 total, 9 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (265): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+257 more)

### Community 1 - "RiverRooms"
Cohesion: 0.06
Nodes (38): CommunitySort, compare(), findCommunities(), FinderInput, FinderResult, slugOf(), all, comm() (+30 more)

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.13
Nodes (48): generateDefaultAvatar(), msg(), escapeHtml(), safeUrl(), shortenKey(), renderIcon(), applyChatLayoutAttr(), attachBubbleDeleteListeners() (+40 more)

### Community 4 - "scripts"
Cohesion: 0.07
Nodes (27): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+19 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.19
Nodes (24): getIdentity(), roomOwnerSk(), takeHandedKey(), appPath(), canonicalBase(), certShowsHost(), connectMessage(), createLocalIdentity() (+16 more)

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
Cohesion: 0.14
Nodes (21): code(), createPoll(), enc(), fillFreepolls(), fpIdentity(), FpPoll, FpQuestion, freepollsCard() (+13 more)

### Community 10 - "moderation.ts"
Cohesion: 0.25
Nodes (9): analyzeImageFile(), analyzeTextContent(), BAD_WORDS, BAD_WORDS_RE, censorTextAndPII(), getModerator(), ImageModerationResult, TextCensorshipResult (+1 more)

### Community 11 - "SafeStorage"
Cohesion: 0.08
Nodes (49): burnAtOf(), checksHtml(), ConversationDeps, ConversationState, createConversationState(), Delivery, deliveryOf(), dmPeerOf() (+41 more)

### Community 12 - "resetPublishBtnState"
Cohesion: 0.29
Nodes (8): blockPublishBtnForNsfw(), blockPublishBtnForUnverified(), isPostInCooldown(), resetPublishBtnState(), setMediaSensitive(), setMediaVerifiedSafe(), showScanResult(), startPostCooldown()

### Community 13 - "vite.config.ts"
Cohesion: 0.23
Nodes (17): bodies(), CHAT_REACTIONS, foldBlocklist(), foldChat(), foldChatHides(), foldChatRead(), foldCommentLikes(), foldCommunities() (+9 more)

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
Cohesion: 0.11
Nodes (32): CHAT_TOKEN_RE, chatText(), escMd(), extractCommentMedia(), isSafeUrl(), LINK_RE, linkCard(), linkify() (+24 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.19
Nodes (20): renderSupporterStatus(), clearStoredReceipt(), dec, DONATION_ADDRESSES, enc, explorerTxUrl(), fromBase64(), getStoredReceipt() (+12 more)

### Community 23 - "feedsize.ts"
Cohesion: 0.13
Nodes (5): MessengerDeps, UnifiedConversation, Community, Post, UserIdentity

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.29
Nodes (7): checkUrlInviteHash(), handleJoinFromInviteUrl(), INVITE_PARAMS, inviteFromParams(), openPostLink(), riverCodeIn(), goTo()

### Community 26 - "avatar.ts"
Cohesion: 0.09
Nodes (23): nodeOrigin(), pageHref(), nameHref(), alertUnread(), applyTheme(), bootSettled(), bootStep(), checkCommunitiesOnNetwork() (+15 more)

### Community 28 - "icons.ts"
Cohesion: 0.17
Nodes (27): bitsOf(), cat(), challengeBytes(), checkProof(), decodeProof(), enc, grind(), makeProof() (+19 more)

### Community 29 - "showProfilePage"
Cohesion: 0.21
Nodes (13): Exports, loadRiver(), river(), anchorOf(), instanceOf(), knownAnchor(), nextFloor(), pointerId() (+5 more)

### Community 30 - "SUMMARY.md"
Cohesion: 0.17
Nodes (8): RiverCall, Anchor, roomKey(), RiverNet, RiverRooms, RiverView, vkOf(), device()

### Community 31 - "updates.ts"
Cohesion: 0.09
Nodes (19): createDurable(), durable, DURABLE_PREFIXES, DurableNode, DurableStore, isDurable(), packageKey(), updateNotifsSoundBtn() (+11 more)

### Community 34 - "NotificationItem"
Cohesion: 0.13
Nodes (19): PreparedChatMedia, ICON_PATHS, IconName, ChatLayoutMode, CLOCK_FMT, formatClock(), formatDateSeparator(), formatInboxTime() (+11 more)

### Community 36 - "nodeOrigin"
Cohesion: 0.16
Nodes (14): chunk(), Fetch, fillFreetunes(), fmtTime(), freetunesCard(), freetunesLink(), FtRelease, FtTrack (+6 more)

### Community 37 - "types.ts"
Cohesion: 0.83
Nodes (3): closeModal(), installModalDismiss(), openModals()

### Community 39 - "versionCheck.ts"
Cohesion: 0.16
Nodes (10): handleSignOut(), UPDATES, check(), newNotes(), shortNote(), showReloadModal(), startVersionCheck(), restart() (+2 more)

### Community 40 - "Reader"
Cohesion: 0.20
Nodes (15): analyzeAudioBlob(), chatMediaCardsHtml(), defaultWaveform(), encodeChatMediaToken(), encodeWaveformHex(), fetchChatMedia(), maskChatMediaTokens(), normalizePeaksToBars() (+7 more)

### Community 41 - "showProfilePage"
Cohesion: 0.50
Nodes (4): closeGifPicker(), CURATED_GIFS, GifItem, openGifPicker()

### Community 42 - "alertUnread"
Cohesion: 0.26
Nodes (13): decodeCbor(), deltaPrefixOf(), DeltaSite, parseSite(), pointerKey(), pointerParams(), resolveSiteCode(), siteKey() (+5 more)

### Community 43 - "freenet.ts"
Cohesion: 0.15
Nodes (29): addReadKeys(), decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptRoomKeyForPeer(), encryptWithSymmetricKey() (+21 more)

### Community 44 - "communityFinder.ts"
Cohesion: 0.26
Nodes (14): api(), call(), chain, delegateMessage(), kvKey(), message(), nodeAppKey(), nodeGet() (+6 more)

### Community 45 - "freenames.ts"
Cohesion: 0.23
Nodes (9): namesOf(), ownerOf(), registryKey(), RegState, sitesOf(), A, B, zoneKey() (+1 more)

### Community 46 - "WebOfTrust"
Cohesion: 0.27
Nodes (3): PostReactionEvaluation, TrustBadgeInfo, WebOfTrust

### Community 47 - "rootsfx.ts"
Cohesion: 0.13
Nodes (19): checkMilestones(), networkCounts(), paintReactionsBy(), reactionsByHtml(), renderMilestones(), toggleDislikeFromCard(), toggleLikeFromCard(), Counts (+11 more)

### Community 48 - "gifPicker.ts"
Cohesion: 0.08
Nodes (49): cacheCard(), checkUrlPostHash(), closeRailPages(), deleteCommentFromCard(), deletePostFromCard(), formatTimeAgo(), getWebOfTrust(), hiddenUsers() (+41 more)

### Community 49 - "createMessengerChat"
Cohesion: 0.24
Nodes (11): fileExtensionIcon(), measureImageDimensions(), normalizeAudioMime(), prepareChatAudioFile(), prepareChatDocFile(), prepareChatImageFile(), nextTtl(), yieldToMain() (+3 more)

### Community 50 - "Reader"
Cohesion: 0.50
Nodes (6): ECOSYSTEM, EcosystemApp, ecosystemCard(), ecosystemFooter(), hrefOf(), link()

### Community 51 - "NotificationItem"
Cohesion: 0.67
Nodes (3): reconcile(), reconcileItems(), NotificationItem

### Community 52 - "createMessengerChat"
Cohesion: 0.31
Nodes (4): KeyValue, localReadMarks(), seedReadMark(), RiverJoin

### Community 53 - "media.ts"
Cohesion: 0.33
Nodes (7): dataUrlBytes(), inflight, keepMedia(), mediaUrl(), bytes, hash, urls

### Community 54 - "avatar.ts"
Cohesion: 0.25
Nodes (7): avatarCache, buildDefaultAvatar(), compressAvatarFile(), compressPostImageFile(), svgToBase64Uri(), h(), appendChatMessageToView()

### Community 55 - "parseChatMedia"
Cohesion: 0.14
Nodes (25): AUDIO_EXT, blobCache, cacheKeyOf(), ChatMediaItem, ChatMediaKind, dataUriToBytesAndMime(), decodeWaveformHex(), fillChatMedia() (+17 more)

### Community 56 - "rootsfx.ts"
Cohesion: 0.52
Nodes (5): along(), Box, f(), growRoots(), rootPaths()

### Community 57 - "Radica — domain language"
Cohesion: 0.40
Nodes (4): Chat, Decisions, Device storage, Radica — domain language

### Community 60 - "roots.ts"
Cohesion: 0.60
Nodes (3): cut(), Root, rootsSvg()

## Knowledge Gaps
- **427 isolated node(s):** `electron`, `path`, `{dialog}`, `name`, `version` (+422 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cert` connect `lib.rs` to `RiverRooms`, `whoiam.ts`, `vite.config.ts`, `signOut`, `feedsize.ts`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `delta.ts` to `CHANGELOG.md`, `.logAppend`, `whoiam.ts`, `Reader`, `alertUnread`, `freenet.ts`, `SafeStorage`, `freenames.ts`, `feature_request.md`, `createMessengerChat`, `feedsize.ts`, `freenames.ts`, `SUMMARY.md`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `feedsize.ts` to `CHANGELOG.md`, `main.ts`, `NotificationItem`, `.logAppend`, `RiverRooms`, `lib.rs`, `freenet.ts`, `SafeStorage`, `delta.ts`, `createMessengerChat`, `freenames.ts`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `electron`, `path`, `{dialog}` to the rest of the system?**
  _427 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.007380073800738007 - nodes in this community are weakly interconnected._
- **Should `RiverRooms` be split into smaller, more focused modules?**
  _Cohesion score 0.06464646464646465 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._