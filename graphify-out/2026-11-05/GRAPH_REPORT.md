# Graph Report - radica  (2026-11-05)

## Corpus Check
- 219 files · ~685,942 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2213 nodes · 5909 edges · 89 communities (79 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 87 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `13235f4b`
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
- [[_COMMUNITY_freenet.ts|freenet.ts]]
- [[_COMMUNITY_updates.ts|updates.ts]]
- [[_COMMUNITY_CHANGELOG|CHANGELOG.md]]
- [[_COMMUNITY_NotificationItem|NotificationItem]]
- [[_COMMUNITY_secretChat.ts|secretChat.ts]]
- [[_COMMUNITY_nodeOrigin|nodeOrigin]]
- [[_COMMUNITY_types.ts|types.ts]]
- [[_COMMUNITY_FREETUNES_KEY|FREETUNES_KEY]]
- [[_COMMUNITY_versionCheck.ts|versionCheck.ts]]
- [[_COMMUNITY_Reader|Reader]]
- [[_COMMUNITY_conversationState.ts|conversationState.ts]]
- [[_COMMUNITY_delegate.ts|delegate.ts]]
- [[_COMMUNITY_UserIdentity|UserIdentity]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_ecosystem.ts|ecosystem.ts]]
- [[_COMMUNITY_WebOfTrust|WebOfTrust]]
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]
- [[_COMMUNITY_gifPicker.ts|gifPicker.ts]]
- [[_COMMUNITY_createMessengerChat|createMessengerChat]]
- [[_COMMUNITY_createMessengerChat|createMessengerChat]]
- [[_COMMUNITY_templateNesting.test.ts|templateNesting.test.ts]]
- [[_COMMUNITY_avatar.ts|avatar.ts]]
- [[_COMMUNITY_parseChatMedia|parseChatMedia]]
- [[_COMMUNITY_topPosts.test.ts|topPosts.test.ts]]
- [[_COMMUNITY_Radica — domain language|Radica — domain language]]
- [[_COMMUNITY_icons.ts|icons.ts]]
- [[_COMMUNITY_ChatMessage|ChatMessage]]
- [[_COMMUNITY_ante.ts|ante.ts]]
- [[_COMMUNITY_durable.ts|durable.ts]]
- [[_COMMUNITY_translate.ts|translate.ts]]
- [[_COMMUNITY_types.ts|types.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_moderation.spec.ts|moderation.spec.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_communityFinder.ts|communityFinder.ts]]
- [[_COMMUNITY_verify.js|verify.js]]
- [[_COMMUNITY_split-freenet-dist.mjs|split-freenet-dist.mjs]]
- [[_COMMUNITY_BatchTranslator|BatchTranslator]]
- [[_COMMUNITY_.applyLog|.applyLog]]
- [[_COMMUNITY_Radica donation contract|Radica donation contract]]
- [[_COMMUNITY_delegate.ts|delegate.ts]]
- [[_COMMUNITY_Radica attester|Radica attester]]
- [[_COMMUNITY_RadicaSupport.test.js|RadicaSupport.test.js]]
- [[_COMMUNITY_hardhat.config.js|hardhat.config.js]]
- [[_COMMUNITY_fetch-translation-models.mjs|fetch-translation-models.mjs]]
- [[_COMMUNITY_icons.ts|icons.ts]]
- [[_COMMUNITY_start.sh|start.sh]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_showMyPost|showMyPost]]
- [[_COMMUNITY_vite.config.ts|vite.config.ts]]
- [[_COMMUNITY_media.ts|media.ts]]
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 219 edges
2. `renderTimeline()` - 77 edges
3. `UserIdentity` - 76 edges
4. `escapeHtml()` - 56 edges
5. `PrivateRoom` - 38 edges
6. `initCardListeners()` - 34 edges
7. `init()` - 34 edges
8. `SafeStorage` - 34 edges
9. `RiverRooms` - 33 edges
10. `openUserProfile()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `connect()` --indirect_call--> `api()`  [INFERRED]
  attester/src/main.js → ui/src/delegate.ts
- `Entry` --references--> `Cert`  [EXTRACTED]
  log-contract/src/lib.rs → ui/src/whoiam.ts
- `bergamotPlugin()` --indirect_call--> `f()`  [INFERRED]
  ui/vite.config.ts → ui/src/rootsfx.ts
- `judgeClaim()` --calls--> `decodeProofToken()`  [EXTRACTED]
  attester/src/core.js → donate-app/src/lib.js
- `judgeClaim()` --calls--> `pubkeyOf()`  [EXTRACTED]
  attester/src/core.js → donate-app/src/lib.js

## Import Cycles
- 3-file cycle: `ui/src/crypto.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/crypto.ts`
- 4-file cycle: `ui/src/crypto.ts -> ui/src/types.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/crypto.ts`
- 4-file cycle: `ui/src/crypto.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/riverPointer.ts -> ui/src/crypto.ts`
- 5-file cycle: `ui/src/crypto.ts -> ui/src/types.ts -> ui/src/whoiam.ts -> ui/src/riverRooms.ts -> ui/src/riverPointer.ts -> ui/src/crypto.ts`

## Communities (89 total, 10 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (296): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+288 more)

### Community 1 - "RiverRooms"
Cohesion: 0.09
Nodes (27): decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptRoomKeyForPeer(), encryptWithSymmetricKey(), formatChatMessageSignatureMessage() (+19 more)

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.13
Nodes (39): fillAsocial(), fillFreenames(), shortenKey(), appendChatMessageToView(), applyChatLayoutAttr(), attachBubbleDeleteListeners(), clearActiveChat(), currentChatLayout() (+31 more)

### Community 4 - "scripts"
Cohesion: 0.06
Nodes (30): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+22 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.21
Nodes (22): getIdentity(), takeHandedKey(), appPath(), canonicalBase(), certShowsHost(), connectMessage(), createLocalIdentity(), enc (+14 more)

### Community 6 - "🚀 Getting Started"
Cohesion: 0.06
Nodes (33): 1. Installation, 1. 🛡️ On-Device AI Moderation (Desert Ant Labs), 2. 🔒 Automated PII Redaction & Text Censorship, 2. Development Mode, 3. Contract Compilation & Testing, 3. ⏱️ Decentralized Anti-Flooding & Rate Limiting, 4. Build Production Web Application, 4. 🌐 Cryptographic Personas & Decentralized Storage (+25 more)

### Community 7 - "lib.rs"
Cohesion: 0.10
Nodes (59): AuthorizedEncryptedSecretForMember, AuthorizedMember, ChatRoomParametersV1, ChatRoomStateV1, ChatRoomStateV1Delta, HashMap, MessageId, apply() (+51 more)

### Community 8 - "dependencies"
Cohesion: 0.07
Nodes (26): dependencies, @browsermt/bergamot-translator, @desert-ant-labs/moderator, @fontsource-variable/fraunces, @fontsource-variable/inter, @freenetorg/freenet-stdlib, @litertjs/core, mediabunny (+18 more)

### Community 9 - "compilerOptions"
Cohesion: 0.08
Nodes (40): decodeCbor(), deltaCard(), deltaInCaption(), DeltaPage, deltaPrefixOf(), DeltaSite, DeltaUri, fillDelta() (+32 more)

### Community 11 - "SafeStorage"
Cohesion: 0.20
Nodes (19): cancelMessageBurn(), getActiveSecretChatTTL(), getSecretRoomId(), addSecretChatPeer(), burnSecretMessage(), editSecretMessage(), getItem(), peersKey() (+11 more)

### Community 12 - "resetPublishBtnState"
Cohesion: 0.29
Nodes (8): blockPublishBtnForNsfw(), blockPublishBtnForUnverified(), isPostInCooldown(), resetPublishBtnState(), setMediaSensitive(), setMediaVerifiedSafe(), showScanResult(), startPostCooldown()

### Community 13 - "vite.config.ts"
Cohesion: 0.18
Nodes (24): a_proof_holds_for_its_identity_only_and_under_the_real_master_only(), a_sign_result_becomes_the_bundle_viso_stores(), binding_payload(), call(), cbor(), fixture(), handle(), key32() (+16 more)

### Community 14 - "signOut"
Cohesion: 0.13
Nodes (34): check(), de(), delta(), Entry, entry_msg(), err(), LogState, merge() (+26 more)

### Community 15 - "delta.ts"
Cohesion: 0.17
Nodes (21): burnAtOf(), checksHtml(), ConversationDeps, createConversationState(), Delivery, deliveryOf(), dmPeerOf(), KeyValue (+13 more)

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
Cohesion: 0.17
Nodes (28): GENESIS, bodies(), CHAT_REACTIONS, dedupeChat(), directoryWeights(), foldBlocklist(), foldChat(), foldChatHides() (+20 more)

### Community 21 - "caption.ts"
Cohesion: 0.12
Nodes (31): CHAT_TOKEN_RE, chatText(), escMd(), extractCommentMedia(), isSafeUrl(), LINK_RE, linkCard(), linkify() (+23 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.07
Nodes (47): enc, issueReceipt(), judgeClaim(), logEntryMessage(), SCOPE_FIELD, signEntry(), CFG, donor (+39 more)

### Community 23 - "feedsize.ts"
Cohesion: 0.15
Nodes (11): GONE_MESSAGE, whyGone, mergeRoomBackup(), Comment, FeedState, Like, PostCategory, ProfileInfo (+3 more)

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.26
Nodes (14): fillChatMedia(), pauseAllOtherAudio(), resolveChatMediaUrl(), wireDownload(), isFragmentedMp4(), item(), MAX_VIDEO_SEC, playVideo() (+6 more)

### Community 25 - "freenames.ts"
Cohesion: 0.21
Nodes (3): roomOwnerSk(), vkOf(), room()

### Community 26 - "avatar.ts"
Cohesion: 0.29
Nodes (7): finishWelcome(), hasDefaultName(), isJoined(), maybeShowWelcome(), renderWelcomeSuggestions(), welcomeDoneKey(), welcomeStep()

### Community 28 - "icons.ts"
Cohesion: 0.06
Nodes (60): bitsOf(), cat(), challengeBytes(), checkProof(), decodeProof(), enc, grind(), makeProof() (+52 more)

### Community 29 - "showProfilePage"
Cohesion: 0.15
Nodes (24): asocialCard(), asocialLink(), asocialPersonHref(), asocialPersonOf(), asocialProfileCard(), asocialWorkHref(), AsocialWorkRef, GAME_CONTRACT_RE (+16 more)

### Community 31 - "updates.ts"
Cohesion: 0.07
Nodes (65): freenet, checked, checkGhostkey(), ghostkey(), REFUSALS, requestGhostkeyProof(), verifiedGhostkeys(), foldGreenhouse() (+57 more)

### Community 32 - "CHANGELOG.md"
Cohesion: 0.13
Nodes (5): seedReadMark(), addReadKeys(), RiverJoin, setActiveSecretChatTTL(), PrivateRoom

### Community 34 - "NotificationItem"
Cohesion: 0.11
Nodes (23): PreparedChatMedia, ConversationState, ICON_PATHS, IconName, ChatLayoutMode, chatTranslations, CLOCK_FMT, formatClock() (+15 more)

### Community 35 - "secretChat.ts"
Cohesion: 0.20
Nodes (12): stageVideo(), analyzeImageFile(), analyzeTextContent(), BAD_WORDS, BAD_WORDS_RE, censorTextAndPII(), getModerator(), ImageModerationResult (+4 more)

### Community 36 - "nodeOrigin"
Cohesion: 0.12
Nodes (20): ECOSYSTEM, EcosystemApp, ecosystemCard(), ecosystemFooter(), hrefOf(), link(), chunk(), Fetch (+12 more)

### Community 37 - "types.ts"
Cohesion: 0.83
Nodes (3): closeModal(), installModalDismiss(), openModals()

### Community 39 - "versionCheck.ts"
Cohesion: 0.33
Nodes (6): closeGifPicker(), CURATED_GIFS, GifItem, openGifPicker(), heavyUrl(), heavyUrlFor()

### Community 40 - "Reader"
Cohesion: 0.25
Nodes (17): activeTimers, clearSecretChatSession(), dec, decryptSecretMessage(), enc, encryptSecretMessage(), formatTtlLabel(), generateEphemeralKeyPair() (+9 more)

### Community 41 - "conversationState.ts"
Cohesion: 0.40
Nodes (5): attachMentionPicker(), namesToKeys(), Person, picked, withMentionKeys()

### Community 42 - "delegate.ts"
Cohesion: 0.12
Nodes (25): clearResolvedFreenames(), freenameInCaption(), freenamesCard(), FreenameUri, inflightResolutions, isKey(), nameHref(), namesOf() (+17 more)

### Community 43 - "UserIdentity"
Cohesion: 0.25
Nodes (3): UnifiedConversation, Community, UserIdentity

### Community 44 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+4 more)

### Community 45 - "ecosystem.ts"
Cohesion: 0.24
Nodes (3): PostReactionEvaluation, TrustBadgeInfo, WebOfTrust

### Community 46 - "WebOfTrust"
Cohesion: 0.33
Nodes (11): countLeadingZeroBits(), createPoWChallenge(), enc, ID_PREFIX, POST_POW_SINCE, postHasPow(), postIdWithPow(), powBits() (+3 more)

### Community 47 - "rootsfx.ts"
Cohesion: 0.15
Nodes (14): checkMilestones(), networkCounts(), renderMilestones(), Counts, countsOf(), FIRST, Metric, METRIC_LABELS (+6 more)

### Community 48 - "gifPicker.ts"
Cohesion: 0.07
Nodes (66): alertUnread(), amGlobalMod(), cacheCard(), checkCommunitiesOnNetwork(), deleteCommentFromCard(), deletePostFromCard(), formatTimeAgo(), getAuthorDisplayName() (+58 more)

### Community 49 - "createMessengerChat"
Cohesion: 0.12
Nodes (16): devDependencies, chai, ethers, hardhat, @nomicfoundation/hardhat-chai-matchers, @nomicfoundation/hardhat-ethers, @nomicfoundation/hardhat-verify, @openzeppelin/contracts (+8 more)

### Community 50 - "createMessengerChat"
Cohesion: 0.24
Nodes (11): compressPostImageFile(), measureImageDimensions(), normalizeAudioMime(), prepareChatAudioFile(), prepareChatDocFile(), prepareChatImageFile(), nextTtl(), yieldToMain() (+3 more)

### Community 54 - "avatar.ts"
Cohesion: 0.40
Nodes (4): avatarCache, buildDefaultAvatar(), compressAvatarFile(), svgToBase64Uri()

### Community 55 - "parseChatMedia"
Cohesion: 0.11
Nodes (40): analyzeAudioBlob(), AUDIO_EXT, blobCache, cacheKeyOf(), chatMediaCardsHtml(), ChatMediaItem, ChatMediaKind, ChunkProgress (+32 more)

### Community 56 - "topPosts.test.ts"
Cohesion: 0.22
Nodes (8): EQUAL, FeedSort, isFuture(), postScore(), sortPosts(), Weights, WINDOW_MS, now

### Community 57 - "Radica — domain language"
Cohesion: 0.33
Nodes (5): Chat, Decisions, Device storage, Radica — domain language, Supporters

### Community 58 - "icons.ts"
Cohesion: 0.42
Nodes (6): FEED_TARGET, feedBytes(), formatBytes(), oldestToFree(), postBytes(), renderFeedSize()

### Community 59 - "ChatMessage"
Cohesion: 0.17
Nodes (3): readEncPubs(), MessengerActiveState, ChatMessage

### Community 60 - "ante.ts"
Cohesion: 0.36
Nodes (8): handleSignOut(), check(), newNotes(), shortNote(), showReloadModal(), startVersionCheck(), restart(), signOut()

### Community 61 - "durable.ts"
Cohesion: 0.07
Nodes (27): createDurable(), durable, DURABLE_PREFIXES, DurableNode, DurableStore, isDurable(), packageKey(), reconcile() (+19 more)

### Community 62 - "translate.ts"
Cohesion: 0.19
Nodes (16): before, draftTranslateHtml(), initDraftTranslate(), translateKeeping(), setReaderLang(), availableLangs(), detectLang(), gateway() (+8 more)

### Community 63 - "types.ts"
Cohesion: 0.23
Nodes (9): giveUpWorker(), lightFeed, lightFeedAsync(), lightFeedOf(), mergeFeedText(), parseInline(), waiting, overlayFeed() (+1 more)

### Community 64 - "package.json"
Cohesion: 0.15
Nodes (12): dependencies, @semaphore-protocol/core, viem, devDependencies, vite, name, private, scripts (+4 more)

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
Cohesion: 0.17
Nodes (11): isHeavy(), all, cfg, cfgPath, copy(), dist, files(), fingerprint (+3 more)

### Community 70 - "BatchTranslator"
Cohesion: 0.20
Nodes (3): BatchTranslator, @browsermt/bergamot-translator/translator.js, TranslatorBacking

### Community 73 - "Radica donation contract"
Cohesion: 0.33
Nodes (5): Before Base mainnet, Deploy, Deployments, Radica donation contract, Test

### Community 74 - "delegate.ts"
Cohesion: 0.24
Nodes (15): api(), call(), chain, delegateMessage(), ghostkeyDelegateMessage(), kvKey(), message(), nodeAppKey() (+7 more)

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

### Community 80 - "icons.ts"
Cohesion: 0.11
Nodes (38): generateDefaultAvatar(), nodeOrigin(), escapeHtml(), safeUrl(), renderIcon(), applyProfile(), applyTheme(), bootSettled() (+30 more)

### Community 85 - "showMyPost"
Cohesion: 0.14
Nodes (15): checkUrlInviteHash(), checkUrlPostHash(), closeRailPages(), handleFreenameLink(), handleJoinFromInviteUrl(), INVITE_PARAMS, inviteFromParams(), openPostLink() (+7 more)

### Community 86 - "vite.config.ts"
Cohesion: 0.18
Nodes (4): UPDATES, bergamotPlugin(), BUILD, FREENET_ASSETS

### Community 87 - "media.ts"
Cohesion: 0.29
Nodes (8): dataUrlBytes(), inflight, keepMedia(), mediaRef(), mediaUrl(), urls, bytes, hash

### Community 88 - "rootsfx.ts"
Cohesion: 0.52
Nodes (5): along(), Box, f(), growRoots(), rootPaths()

## Knowledge Gaps
- **579 isolated node(s):** `name`, `private`, `type`, `start`, `test` (+574 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cert` connect `lib.rs` to `RiverRooms`, `whoiam.ts`, `UserIdentity`, `signOut`, `compilerOptions`, `feedsize.ts`, `updates.ts`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `moderation.ts` to `CHANGELOG.md`, `RiverRooms`, `whoiam.ts`, `.applyLog`, `compilerOptions`, `delegate.ts`, `UserIdentity`, `SafeStorage`, `feature_request.md`, `compilerOptions`, `parseChatMedia`, `media.ts`, `freenames.ts`, `ChatMessage`, `icons.ts`, `showProfilePage`, `freenet.ts`, `types.ts`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `UserIdentity` to `CHANGELOG.md`, `RiverRooms`, `main.ts`, `NotificationItem`, `lib.rs`, `.applyLog`, `moderation.ts`, `SafeStorage`, `compilerOptions`, `feedsize.ts`, `freenames.ts`, `ChatMessage`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _579 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.006535947712418301 - nodes in this community are weakly interconnected._
- **Should `RiverRooms` be split into smaller, more focused modules?**
  _Cohesion score 0.08734693877551021 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._