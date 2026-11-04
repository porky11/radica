# Graph Report - radica  (2026-11-04)

## Corpus Check
- 197 files · ~658,694 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1955 nodes · 5176 edges · 85 communities (74 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 85 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3f7e5376`
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
- [[_COMMUNITY_durable.ts|durable.ts]]
- [[_COMMUNITY_translate.ts|translate.ts]]
- [[_COMMUNITY_types.ts|types.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_viso.ts|viso.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_communityFinder.ts|communityFinder.ts]]
- [[_COMMUNITY_verify.js|verify.js]]
- [[_COMMUNITY_split-freenet-dist.mjs|split-freenet-dist.mjs]]
- [[_COMMUNITY_BatchTranslator|BatchTranslator]]
- [[_COMMUNITY_feedsize.ts|feedsize.ts]]
- [[_COMMUNITY_pow.ts|pow.ts]]
- [[_COMMUNITY_Radica donation contract|Radica donation contract]]
- [[_COMMUNITY_mentionPicker.ts|mentionPicker.ts]]
- [[_COMMUNITY_Radica attester|Radica attester]]
- [[_COMMUNITY_RadicaSupport.test.js|RadicaSupport.test.js]]
- [[_COMMUNITY_hardhat.config.js|hardhat.config.js]]
- [[_COMMUNITY_fetch-translation-models.mjs|fetch-translation-models.mjs]]
- [[_COMMUNITY_icons.ts|icons.ts]]
- [[_COMMUNITY_start.sh|start.sh]]
- [[_COMMUNITY_README|README.md]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 200 edges
2. `UserIdentity` - 76 edges
3. `renderTimeline()` - 56 edges
4. `escapeHtml()` - 48 edges
5. `PrivateRoom` - 38 edges
6. `init()` - 33 edges
7. `RiverRooms` - 33 edges
8. `SafeStorage` - 33 edges
9. `initCardListeners()` - 32 edges
10. `ChatMessage` - 30 edges

## Surprising Connections (you probably didn't know these)
- `connect()` --indirect_call--> `api()`  [INFERRED]
  attester/src/main.js → ui/src/delegate.ts
- `Entry` --references--> `Cert`  [EXTRACTED]
  log-contract/src/lib.rs → ui/src/whoiam.ts
- `judgeClaim()` --calls--> `decodeProofToken()`  [EXTRACTED]
  attester/src/core.js → donate-app/src/lib.js
- `judgeClaim()` --calls--> `pubkeyOf()`  [EXTRACTED]
  attester/src/core.js → donate-app/src/lib.js
- `tok()` --calls--> `encodeProofToken()`  [EXTRACTED]
  attester/src/core.test.js → donate-app/src/lib.js

## Import Cycles
- 3-file cycle: `ui/src/crypto.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/crypto.ts`
- 4-file cycle: `ui/src/crypto.ts -> ui/src/types.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/crypto.ts`
- 4-file cycle: `ui/src/crypto.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/riverPointer.ts -> ui/src/crypto.ts`
- 5-file cycle: `ui/src/crypto.ts -> ui/src/types.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/riverPointer.ts -> ui/src/crypto.ts`

## Communities (85 total, 11 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (275): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+267 more)

### Community 1 - "RiverRooms"
Cohesion: 0.27
Nodes (8): giveUpWorker(), lightFeed, lightFeedAsync(), lightFeedOf(), mergeFeedText(), parseInline(), raw, waiting

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.11
Nodes (59): generateDefaultAvatar(), nodeOrigin(), msg(), escapeHtml(), safeUrl(), shortenKey(), renderIcon(), appendChatMessageToView() (+51 more)

### Community 4 - "scripts"
Cohesion: 0.06
Nodes (30): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+22 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.16
Nodes (27): getIdentity(), handleSignOut(), takeHandedKey(), appPath(), canonicalBase(), certShowsHost(), connectMessage(), createLocalIdentity() (+19 more)

### Community 6 - "🚀 Getting Started"
Cohesion: 0.08
Nodes (23): 1. Installation, 1. 🛡️ On-Device AI Moderation (Desert Ant Labs), 2. 🔒 Automated PII Redaction & Text Censorship, 2. Development Mode, 3. Contract Compilation & Testing, 3. ⏱️ Decentralized Anti-Flooding & Rate Limiting, 4. Build Production Web Application, 4. 🌐 Cryptographic Personas & Decentralized Storage (+15 more)

### Community 7 - "lib.rs"
Cohesion: 0.10
Nodes (59): AuthorizedEncryptedSecretForMember, AuthorizedMember, ChatRoomParametersV1, ChatRoomStateV1, ChatRoomStateV1Delta, Error, HashMap, MessageId (+51 more)

### Community 8 - "dependencies"
Cohesion: 0.07
Nodes (26): dependencies, @browsermt/bergamot-translator, @desert-ant-labs/moderator, @fontsource-variable/fraunces, @fontsource-variable/inter, @freenetorg/freenet-stdlib, @litertjs/core, mediabunny (+18 more)

### Community 9 - "compilerOptions"
Cohesion: 0.14
Nodes (21): code(), createPoll(), enc(), fillFreepolls(), fpIdentity(), FpPoll, FpQuestion, freepollsCard() (+13 more)

### Community 10 - "moderation.ts"
Cohesion: 0.20
Nodes (12): stageVideo(), analyzeImageFile(), analyzeTextContent(), BAD_WORDS, BAD_WORDS_RE, censorTextAndPII(), getModerator(), ImageModerationResult (+4 more)

### Community 11 - "SafeStorage"
Cohesion: 0.19
Nodes (19): burnAtOf(), formatChatMessageSignatureMessage(), cancelMessageBurn(), getActiveSecretChatTTL(), getSecretRoomId(), addSecretChatPeer(), burnSecretMessage(), getItem() (+11 more)

### Community 12 - "resetPublishBtnState"
Cohesion: 0.29
Nodes (8): blockPublishBtnForNsfw(), blockPublishBtnForUnverified(), isPostInCooldown(), resetPublishBtnState(), setMediaSensitive(), setMediaVerifiedSafe(), showScanResult(), startPostCooldown()

### Community 13 - "vite.config.ts"
Cohesion: 0.22
Nodes (21): GENESIS, bodies(), CHAT_REACTIONS, dedupeChat(), foldBlocklist(), foldChat(), foldChatHides(), foldChatRead() (+13 more)

### Community 14 - "signOut"
Cohesion: 0.13
Nodes (34): check(), de(), delta(), Entry, entry_msg(), err(), LogState, merge() (+26 more)

### Community 15 - "delta.ts"
Cohesion: 0.05
Nodes (4): FreenetClient, LogEntry, Change, NotificationItem

### Community 16 - "feature_request.md"
Cohesion: 0.10
Nodes (18): CURRENT, LEGACY, limiter(), codes, contractCode(), ContractId, contractKey(), FreenetNetwork (+10 more)

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
Nodes (29): CHAT_TOKEN_RE, chatText(), escMd(), extractCommentMedia(), isSafeUrl(), LINK_RE, linkCard(), linkify() (+21 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.07
Nodes (47): enc, issueReceipt(), judgeClaim(), logEntryMessage(), SCOPE_FIELD, signEntry(), CFG, donor (+39 more)

### Community 23 - "feedsize.ts"
Cohesion: 0.20
Nodes (5): UnifiedConversation, PoWProof, Community, Post, UserIdentity

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.17
Nodes (22): fillChatMedia(), keepChatMediaUrl(), pauseAllOtherAudio(), resolveChatMediaUrl(), sealChatMedia(), sealChatMediaChunked(), sealWithKey(), sendChatAttachment() (+14 more)

### Community 26 - "avatar.ts"
Cohesion: 0.06
Nodes (41): applyTheme(), bootSettled(), bootStep(), checkCommunitiesOnNetwork(), checkUrlInviteHash(), checkUrlPostHash(), closeRailPages(), draftKey() (+33 more)

### Community 28 - "icons.ts"
Cohesion: 0.18
Nodes (26): bitsOf(), cat(), challengeBytes(), checkProof(), decodeProof(), enc, grind(), makeProof() (+18 more)

### Community 29 - "showProfilePage"
Cohesion: 0.15
Nodes (19): Exports, loadRiver(), river(), RiverCall, Anchor, anchorOf(), instanceOf(), keyOf() (+11 more)

### Community 30 - "SUMMARY.md"
Cohesion: 0.21
Nodes (3): RiverNet, RiverRooms, device()

### Community 31 - "updates.ts"
Cohesion: 0.08
Nodes (44): freenet, amVouched(), refreshSupporters(), updateNotifsSoundBtn(), getAudioContext(), isSoundEnabled(), playBufferPop(), playPopSound() (+36 more)

### Community 34 - "NotificationItem"
Cohesion: 0.12
Nodes (24): PreparedChatMedia, ConversationState, yieldToMain(), ChatLayoutMode, chatTranslations, CLOCK_FMT, createMessengerChat(), formatClock() (+16 more)

### Community 36 - "nodeOrigin"
Cohesion: 0.16
Nodes (14): chunk(), Fetch, fillFreetunes(), fmtTime(), freetunesCard(), freetunesLink(), FtRelease, FtTrack (+6 more)

### Community 37 - "types.ts"
Cohesion: 0.83
Nodes (3): closeModal(), installModalDismiss(), openModals()

### Community 39 - "versionCheck.ts"
Cohesion: 0.29
Nodes (3): roomOwnerSk(), vkOf(), room()

### Community 40 - "Reader"
Cohesion: 0.19
Nodes (17): analyzeAudioBlob(), chatMediaCardsHtml(), defaultWaveform(), fetchChatMedia(), fileExtensionIcon(), formatBytes(), formatMediaDuration(), maskChatMediaTokens() (+9 more)

### Community 41 - "showProfilePage"
Cohesion: 0.33
Nodes (6): closeGifPicker(), CURATED_GIFS, GifItem, openGifPicker(), heavyUrl(), heavyUrlFor()

### Community 42 - "alertUnread"
Cohesion: 0.24
Nodes (14): decodeCbor(), deltaPrefixOf(), DeltaSite, pageHref(), parseSite(), pointerKey(), pointerParams(), resolveSiteCode() (+6 more)

### Community 43 - "freenet.ts"
Cohesion: 0.10
Nodes (27): decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptRoomKeyForPeer(), encryptWithSymmetricKey(), formatCommentSignatureMessage() (+19 more)

### Community 44 - "communityFinder.ts"
Cohesion: 0.23
Nodes (14): api(), call(), chain, delegateMessage(), kvKey(), message(), nodeAppKey(), nodeGet() (+6 more)

### Community 45 - "freenames.ts"
Cohesion: 0.22
Nodes (9): nameHref(), namesOf(), ownerOf(), registryKey(), RegState, sitesOf(), A, B (+1 more)

### Community 46 - "WebOfTrust"
Cohesion: 0.25
Nodes (3): PostReactionEvaluation, TrustBadgeInfo, WebOfTrust

### Community 47 - "rootsfx.ts"
Cohesion: 0.07
Nodes (28): checkMilestones(), networkCounts(), renderMilestones(), Counts, countsOf(), FIRST, Metric, METRIC_LABELS (+20 more)

### Community 48 - "gifPicker.ts"
Cohesion: 0.09
Nodes (46): alertUnread(), applyMaskBadWords(), cacheCard(), deleteCommentFromCard(), deletePostFromCard(), formatTimeAgo(), getWebOfTrust(), hiddenUsers() (+38 more)

### Community 49 - "createMessengerChat"
Cohesion: 0.12
Nodes (16): devDependencies, chai, ethers, hardhat, @nomicfoundation/hardhat-chai-matchers, @nomicfoundation/hardhat-ethers, @nomicfoundation/hardhat-verify, @openzeppelin/contracts (+8 more)

### Community 50 - "Reader"
Cohesion: 0.50
Nodes (6): ECOSYSTEM, EcosystemApp, ecosystemCard(), ecosystemFooter(), hrefOf(), link()

### Community 51 - "NotificationItem"
Cohesion: 0.33
Nodes (9): reconcile(), reconcileItems(), isSaved(), keyOf(), load(), memo, savedId(), savedPosts() (+1 more)

### Community 52 - "createMessengerChat"
Cohesion: 0.17
Nodes (22): checksHtml(), ConversationDeps, createConversationState(), Delivery, deliveryOf(), dmPeerOf(), KeyValue, localReadMarks() (+14 more)

### Community 53 - "media.ts"
Cohesion: 0.26
Nodes (9): postMediaHash(), dataUrlBytes(), inflight, keepMedia(), mediaRef(), mediaUrl(), bytes, hash (+1 more)

### Community 54 - "avatar.ts"
Cohesion: 0.40
Nodes (4): avatarCache, buildDefaultAvatar(), compressAvatarFile(), svgToBase64Uri()

### Community 55 - "parseChatMedia"
Cohesion: 0.14
Nodes (23): compressPostImageFile(), AUDIO_EXT, blobCache, cacheKeyOf(), ChatMediaItem, ChatMediaKind, ChunkProgress, dataUriToBytesAndMime() (+15 more)

### Community 56 - "rootsfx.ts"
Cohesion: 0.24
Nodes (15): activeTimers, clearSecretChatSession(), dec, decryptSecretMessage(), enc, encryptSecretMessage(), generateEphemeralKeyPair(), getOrCreateSecretSession() (+7 more)

### Community 57 - "Radica — domain language"
Cohesion: 0.33
Nodes (5): Chat, Decisions, Device storage, Radica — domain language, Supporters

### Community 60 - "roots.ts"
Cohesion: 0.60
Nodes (3): cut(), Root, rootsSvg()

### Community 61 - "durable.ts"
Cohesion: 0.19
Nodes (7): createDurable(), durable, DURABLE_PREFIXES, DurableNode, DurableStore, isDurable(), packageKey()

### Community 62 - "translate.ts"
Cohesion: 0.23
Nodes (12): files(), setReaderLang(), availableLangs(), detectLang(), gateway(), getTranslator(), LANGS, loadRegistry() (+4 more)

### Community 63 - "types.ts"
Cohesion: 0.21
Nodes (8): overlayFeed(), mergeRoomBackup(), Comment, FeedState, Like, PostCategory, RoomState, SecretChatSession

### Community 64 - "package.json"
Cohesion: 0.15
Nodes (12): dependencies, @semaphore-protocol/core, viem, devDependencies, vite, name, private, scripts (+4 more)

### Community 65 - "viso.ts"
Cohesion: 0.31
Nodes (9): asNumber(), cat(), enc, hex(), u32le(), u64le(), visoIdentityInstance(), visoIdentityParams() (+1 more)

### Community 66 - "package.json"
Cohesion: 0.17
Nodes (11): dependencies, @freenetorg/freenet-stdlib, @noble/ed25519, @noble/hashes, viem, name, private, scripts (+3 more)

### Community 67 - "communityFinder.ts"
Cohesion: 0.27
Nodes (9): CommunitySort, compare(), findCommunities(), FinderInput, FinderResult, slugOf(), all, comm() (+1 more)

### Community 68 - "verify.js"
Cohesion: 0.24
Nodes (6): ADDRESSES, DEPLOYED, { ethers, network }, { TREASURY, ADDRESSES }, hre, { TREASURY, ADDRESSES, DEPLOYED }

### Community 69 - "split-freenet-dist.mjs"
Cohesion: 0.18
Nodes (9): all, cfg, cfgPath, copy(), dist, fingerprint, hash, heavy (+1 more)

### Community 70 - "BatchTranslator"
Cohesion: 0.20
Nodes (3): BatchTranslator, @browsermt/bergamot-translator/translator.js, TranslatorBacking

### Community 71 - "feedsize.ts"
Cohesion: 0.42
Nodes (6): FEED_TARGET, feedBytes(), formatBytes(), oldestToFree(), postBytes(), renderFeedSize()

### Community 72 - "pow.ts"
Cohesion: 0.67
Nodes (5): countLeadingZeroBits(), createPoWChallenge(), enc, solvePoW(), verifyPoW()

### Community 73 - "Radica donation contract"
Cohesion: 0.33
Nodes (5): Before Base mainnet, Deploy, Deployments, Radica donation contract, Test

### Community 74 - "mentionPicker.ts"
Cohesion: 0.40
Nodes (5): attachMentionPicker(), namesToKeys(), Person, picked, withMentionKeys()

### Community 75 - "Radica attester"
Cohesion: 0.40
Nodes (4): CapRover, Radica attester, Run, Test

### Community 76 - "RadicaSupport.test.js"
Cohesion: 0.40
Nodes (3): { ethers }, { expect }, Tier

### Community 77 - "hardhat.config.js"
Cohesion: 0.50
Nodes (3): path, { subtask }, { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD }

### Community 78 - "fetch-translation-models.mjs"
Cohesion: 0.50
Nodes (3): out, pairs, registry

## Knowledge Gaps
- **529 isolated node(s):** `name`, `private`, `type`, `start`, `test` (+524 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cert` connect `lib.rs` to `whoiam.ts`, `freenet.ts`, `vite.config.ts`, `signOut`, `feedsize.ts`, `updates.ts`, `types.ts`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `delta.ts` to `CHANGELOG.md`, `viso.ts`, `.logAppend`, `whoiam.ts`, `versionCheck.ts`, `alertUnread`, `freenet.ts`, `SafeStorage`, `vite.config.ts`, `freenames.ts`, `communityFinder.ts`, `feature_request.md`, `media.ts`, `feedsize.ts`, `Contributor Covenant Code of Conduct`, `freenames.ts`, `rootsfx.ts`, `SUMMARY.md`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `feedsize.ts` to `CHANGELOG.md`, `main.ts`, `NotificationItem`, `.logAppend`, `lib.rs`, `versionCheck.ts`, `freenet.ts`, `SafeStorage`, `vite.config.ts`, `delta.ts`, `freenames.ts`, `types.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _529 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.007042253521126761 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._
- **Should `init` be split into smaller, more focused modules?**
  _Cohesion score 0.1087431693989071 - nodes in this community are weakly interconnected._