# Graph Report - radica  (2026-11-05)

## Corpus Check
- 219 files · ~688,561 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2240 nodes · 6001 edges · 90 communities (78 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 88 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5dbcc47d`
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
- [[_COMMUNITY_secretChat.ts|secretChat.ts]]
- [[_COMMUNITY_Radica — domain language|Radica — domain language]]
- [[_COMMUNITY_feedlight.ts|feedlight.ts]]
- [[_COMMUNITY_ChatMessage|ChatMessage]]
- [[_COMMUNITY_showMyPost|showMyPost]]
- [[_COMMUNITY_durable.ts|durable.ts]]
- [[_COMMUNITY_translate.ts|translate.ts]]
- [[_COMMUNITY_types.ts|types.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_moderation.spec.ts|moderation.spec.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_pow.ts|pow.ts]]
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
- [[_COMMUNITY_topPosts.ts|topPosts.ts]]
- [[_COMMUNITY_media.ts|media.ts]]
- [[_COMMUNITY_communityFinder.ts|communityFinder.ts]]
- [[_COMMUNITY_Reader|Reader]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 222 edges
2. `renderTimeline()` - 77 edges
3. `UserIdentity` - 76 edges
4. `escapeHtml()` - 56 edges
5. `PrivateRoom` - 38 edges
6. `initCardListeners()` - 35 edges
7. `init()` - 34 edges
8. `RiverRooms` - 34 edges
9. `SafeStorage` - 34 edges
10. `openUserProfile()` - 33 edges

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

## Communities (90 total, 12 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (297): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+289 more)

### Community 1 - "RiverRooms"
Cohesion: 0.17
Nodes (23): AsocialWorkItem, addReadKeys(), decryptDirectMessage(), decryptRoomKeyFromPeer(), enc, encryptDirectMessage(), encryptRoomKeyForPeer(), formatCommunitySignatureMessage() (+15 more)

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.12
Nodes (41): fillAsocial(), fillFreenames(), shortKey(), shortenKey(), appendChatMessageToView(), applyChatLayoutAttr(), attachBubbleDeleteListeners(), chatExcerpt() (+33 more)

### Community 4 - "scripts"
Cohesion: 0.06
Nodes (30): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+22 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.17
Nodes (26): getIdentity(), handleSignOut(), roomOwnerSk(), takeHandedKey(), appPath(), canonicalBase(), certShowsHost(), connectMessage() (+18 more)

### Community 6 - "🚀 Getting Started"
Cohesion: 0.06
Nodes (33): 1. Installation, 1. 🛡️ On-Device AI Moderation (Desert Ant Labs), 2. 🔒 Automated PII Redaction & Text Censorship, 2. Development Mode, 3. Contract Compilation & Testing, 3. ⏱️ Decentralized Anti-Flooding & Rate Limiting, 4. Build Production Web Application, 4. 🌐 Cryptographic Personas & Decentralized Storage (+25 more)

### Community 7 - "lib.rs"
Cohesion: 0.10
Nodes (60): AuthorizedEncryptedSecretForMember, AuthorizedMember, ChatRoomParametersV1, ChatRoomStateV1, ChatRoomStateV1Delta, HashMap, MessageId, apply() (+52 more)

### Community 8 - "dependencies"
Cohesion: 0.07
Nodes (26): dependencies, @browsermt/bergamot-translator, @desert-ant-labs/moderator, @fontsource-variable/fraunces, @fontsource-variable/inter, @freenetorg/freenet-stdlib, @litertjs/core, mediabunny (+18 more)

### Community 9 - "compilerOptions"
Cohesion: 0.06
Nodes (45): decodeCbor(), deltaCard(), deltaInCaption(), DeltaPage, deltaPrefixOf(), DeltaSite, DeltaUri, fillDelta() (+37 more)

### Community 11 - "SafeStorage"
Cohesion: 0.08
Nodes (57): burnAtOf(), checksHtml(), ConversationDeps, ConversationState, createConversationState(), Delivery, deliveryOf(), dmPeerOf() (+49 more)

### Community 12 - "resetPublishBtnState"
Cohesion: 0.33
Nodes (7): blockPublishBtnForUnverified(), isPostInCooldown(), resetPublishBtnState(), setMediaSensitive(), setMediaVerifiedSafe(), showScanResult(), startPostCooldown()

### Community 13 - "vite.config.ts"
Cohesion: 0.18
Nodes (24): a_proof_holds_for_its_identity_only_and_under_the_real_master_only(), a_sign_result_becomes_the_bundle_viso_stores(), binding_payload(), call(), cbor(), fixture(), handle(), key32() (+16 more)

### Community 14 - "signOut"
Cohesion: 0.13
Nodes (34): check(), de(), delta(), Entry, entry_msg(), err(), LogState, merge() (+26 more)

### Community 15 - "delta.ts"
Cohesion: 0.07
Nodes (25): isHeavy(), all, cfg, cfgPath, copy(), dist, files(), fingerprint (+17 more)

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
Nodes (26): bodies(), CHAT_REACTIONS, dedupeChat(), directoryWeights(), foldBlocklist(), foldChat(), foldChatHides(), foldChatRead() (+18 more)

### Community 21 - "caption.ts"
Cohesion: 0.13
Nodes (30): CHAT_TOKEN_RE, chatText(), escMd(), extractCommentMedia(), isSafeUrl(), LINK_RE, linkCard(), linkify() (+22 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.07
Nodes (47): enc, issueReceipt(), judgeClaim(), logEntryMessage(), SCOPE_FIELD, signEntry(), CFG, donor (+39 more)

### Community 23 - "feedsize.ts"
Cohesion: 0.13
Nodes (26): amGlobalMod(), checkCommunitiesOnNetwork(), getWebOfTrust(), hiddenCommunityIds(), hideCommunityForAll(), isJoined(), isKnownSender(), isOpen() (+18 more)

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.19
Nodes (18): cacheKeyOf(), ChatMediaItem, ChunkProgress, fillChatMedia(), keepChatMediaUrl(), pauseAllOtherAudio(), resolveChatMediaUrl(), wireDownload() (+10 more)

### Community 25 - "freenames.ts"
Cohesion: 0.17
Nodes (4): encryptWithSymmetricKey(), formatChatMessageSignatureMessage(), PrivateRoom, room()

### Community 26 - "avatar.ts"
Cohesion: 0.15
Nodes (19): code(), createPoll(), enc(), fillFreepolls(), fpIdentity(), FpPoll, FpQuestion, LINK_RE (+11 more)

### Community 28 - "icons.ts"
Cohesion: 0.18
Nodes (21): decodeProof(), asBytes(), asNumber(), asString(), cborDecode(), cborEncode(), CborValue, enumVariant() (+13 more)

### Community 30 - "freenet.ts"
Cohesion: 0.28
Nodes (15): bitsOf(), cat(), challengeBytes(), checkProof(), enc, grind(), makeProof(), Proof (+7 more)

### Community 31 - "updates.ts"
Cohesion: 0.07
Nodes (66): freenet, checked, checkGhostkey(), ghostkey(), REFUSALS, requestGhostkeyProof(), verifiedGhostkeys(), foldGreenhouse() (+58 more)

### Community 34 - "NotificationItem"
Cohesion: 0.12
Nodes (21): PreparedChatMedia, ICON_PATHS, IconName, ChatLayoutMode, chatTranslations, CLOCK_FMT, formatClock(), formatDateSeparator() (+13 more)

### Community 35 - "secretChat.ts"
Cohesion: 0.19
Nodes (13): stageVideo(), analyzeImageFile(), analyzeTextContent(), BAD_WORDS, BAD_WORDS_RE, censorTextAndPII(), getModerator(), ImageModerationResult (+5 more)

### Community 36 - "nodeOrigin"
Cohesion: 0.12
Nodes (20): ECOSYSTEM, EcosystemApp, ecosystemCard(), ecosystemFooter(), hrefOf(), link(), chunk(), Fetch (+12 more)

### Community 37 - "types.ts"
Cohesion: 0.83
Nodes (3): closeModal(), installModalDismiss(), openModals()

### Community 39 - "versionCheck.ts"
Cohesion: 0.25
Nodes (8): safeUrl(), closeGifPicker(), CURATED_GIFS, GifItem, openGifPicker(), heavyUrl(), heavyUrlFor(), getTranslator()

### Community 40 - "Reader"
Cohesion: 0.18
Nodes (11): alertUnread(), checkMilestones(), networkCounts(), paintReactionsBy(), toggleDislikeFromCard(), toggleLikeFromCard(), toShell(), updateNotificationsBadge() (+3 more)

### Community 41 - "conversationState.ts"
Cohesion: 0.40
Nodes (5): attachMentionPicker(), namesToKeys(), Person, picked, withMentionKeys()

### Community 42 - "delegate.ts"
Cohesion: 0.14
Nodes (22): freenameInCaption(), FreenameUri, getResolvedFreename(), inflightResolutions, isKey(), namesOf(), ownerOf(), parseFreenameUri() (+14 more)

### Community 43 - "UserIdentity"
Cohesion: 0.20
Nodes (4): MessengerDeps, UnifiedConversation, Community, UserIdentity

### Community 44 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+4 more)

### Community 45 - "ecosystem.ts"
Cohesion: 0.24
Nodes (3): PostReactionEvaluation, TrustBadgeInfo, WebOfTrust

### Community 46 - "WebOfTrust"
Cohesion: 0.18
Nodes (16): compressPostImageFile(), chatMediaCardsHtml(), fileExtensionIcon(), formatBytes(), formatMediaDuration(), measureImageDimensions(), normalizeAudioMime(), prepareChatAudioFile() (+8 more)

### Community 47 - "rootsfx.ts"
Cohesion: 0.18
Nodes (11): renderMilestones(), Counts, FIRST, Metric, METRIC_LABELS, METRICS, Milestone, nextUp() (+3 more)

### Community 48 - "gifPicker.ts"
Cohesion: 0.15
Nodes (29): freepollsCard(), freepollsLink(), cacheCard(), deleteCommentFromCard(), deletePostFromCard(), globalRemove(), initCardListeners(), modDeleteFromCard() (+21 more)

### Community 49 - "createMessengerChat"
Cohesion: 0.12
Nodes (16): devDependencies, chai, ethers, hardhat, @nomicfoundation/hardhat-chai-matchers, @nomicfoundation/hardhat-ethers, @nomicfoundation/hardhat-verify, @openzeppelin/contracts (+8 more)

### Community 50 - "createMessengerChat"
Cohesion: 0.14
Nodes (29): ASOCIAL_RECORDS_CODE_BYTES, asocialCard(), AsocialData, asocialLink(), asocialOwnStoreKey(), asocialOwnStoreParams(), asocialPersonHref(), asocialPersonOf() (+21 more)

### Community 54 - "avatar.ts"
Cohesion: 0.40
Nodes (4): avatarCache, buildDefaultAvatar(), compressAvatarFile(), svgToBase64Uri()

### Community 55 - "parseChatMedia"
Cohesion: 0.13
Nodes (30): analyzeAudioBlob(), AUDIO_EXT, blobCache, ChatMediaKind, dataUriToBytesAndMime(), decodeWaveformHex(), defaultWaveform(), encodeChatMediaToken() (+22 more)

### Community 56 - "secretChat.ts"
Cohesion: 0.30
Nodes (12): cleanExcerpt(), decodeB64u(), defaultNodeOrigin(), encodeB64u(), OrtoBlog, ortoCard(), ortoInCaption(), OrtoPost (+4 more)

### Community 57 - "Radica — domain language"
Cohesion: 0.33
Nodes (5): Chat, Decisions, Device storage, Radica — domain language, Supporters

### Community 58 - "feedlight.ts"
Cohesion: 0.23
Nodes (9): giveUpWorker(), lightFeed, lightFeedAsync(), lightFeedOf(), mergeFeedText(), parseInline(), waiting, overlayFeed() (+1 more)

### Community 59 - "ChatMessage"
Cohesion: 0.17
Nodes (5): decryptWithSymmetricKey(), getCryptoKeyFromBytes(), readEncPubs(), MessengerActiveState, ChatMessage

### Community 60 - "showMyPost"
Cohesion: 0.31
Nodes (10): reconcile(), reconcileItems(), isSaved(), keyOf(), load(), memo, savedId(), savedPosts() (+2 more)

### Community 61 - "durable.ts"
Cohesion: 0.09
Nodes (19): createDurable(), durable, DURABLE_PREFIXES, DurableNode, DurableStore, isDurable(), packageKey(), updateNotifsSoundBtn() (+11 more)

### Community 62 - "translate.ts"
Cohesion: 0.19
Nodes (15): before, draftTranslateHtml(), initDraftTranslate(), translateKeeping(), setReaderLang(), availableLangs(), detectLang(), gateway() (+7 more)

### Community 63 - "types.ts"
Cohesion: 0.17
Nodes (11): GONE_MESSAGE, whyGone, PoWProof, Comment, FeedState, Like, Post, PostCategory (+3 more)

### Community 64 - "package.json"
Cohesion: 0.15
Nodes (12): dependencies, @semaphore-protocol/core, viem, devDependencies, vite, name, private, scripts (+4 more)

### Community 66 - "package.json"
Cohesion: 0.17
Nodes (11): dependencies, @freenetorg/freenet-stdlib, @noble/ed25519, @noble/hashes, viem, name, private, scripts (+3 more)

### Community 67 - "pow.ts"
Cohesion: 0.33
Nodes (11): countLeadingZeroBits(), createPoWChallenge(), enc, ID_PREFIX, POST_POW_SINCE, postHasPow(), postIdWithPow(), powBits() (+3 more)

### Community 68 - "verify.js"
Cohesion: 0.24
Nodes (6): ADDRESSES, DEPLOYED, { ethers, network }, { TREASURY, ADDRESSES }, hre, { TREASURY, ADDRESSES, DEPLOYED }

### Community 69 - "split-freenet-dist.mjs"
Cohesion: 0.42
Nodes (6): FEED_TARGET, feedBytes(), formatBytes(), oldestToFree(), postBytes(), renderFeedSize()

### Community 70 - "BatchTranslator"
Cohesion: 0.20
Nodes (3): BatchTranslator, @browsermt/bergamot-translator/translator.js, TranslatorBacking

### Community 73 - "Radica donation contract"
Cohesion: 0.33
Nodes (5): Before Base mainnet, Deploy, Deployments, Radica donation contract, Test

### Community 74 - "delegate.ts"
Cohesion: 0.16
Nodes (16): api(), call(), chain, delegateMessage(), ghostkeyDelegateMessage(), kvKey(), message(), nodeAppKey() (+8 more)

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
Cohesion: 0.14
Nodes (33): generateDefaultAvatar(), nodeOrigin(), freenamesCard(), nameHref(), escapeHtml(), safeUrl(), renderIcon(), applyProfile() (+25 more)

### Community 85 - "showMyPost"
Cohesion: 0.07
Nodes (36): applyTheme(), bootSettled(), bootStep(), checkUrlInviteHash(), checkUrlPostHash(), closeRailPages(), draftKey(), finishWelcome() (+28 more)

### Community 86 - "topPosts.ts"
Cohesion: 0.22
Nodes (8): EQUAL, FeedSort, isFuture(), postScore(), sortPosts(), Weights, WINDOW_MS, now

### Community 87 - "media.ts"
Cohesion: 0.33
Nodes (7): dataUrlBytes(), inflight, keepMedia(), mediaUrl(), urls, bytes, hash

### Community 88 - "communityFinder.ts"
Cohesion: 0.27
Nodes (9): CommunitySort, compare(), findCommunities(), FinderInput, FinderResult, slugOf(), all, comm() (+1 more)

## Knowledge Gaps
- **583 isolated node(s):** `name`, `private`, `type`, `start`, `test` (+578 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FreenetClient` connect `moderation.ts` to `RiverRooms`, `whoiam.ts`, `compilerOptions`, `SafeStorage`, `feature_request.md`, `compilerOptions`, `freenames.ts`, `icons.ts`, `showProfilePage`, `CHANGELOG.md`, `delegate.ts`, `UserIdentity`, `createMessengerChat`, `parseChatMedia`, `secretChat.ts`, `feedlight.ts`, `ChatMessage`, `types.ts`, `.applyLog`, `delegate.ts`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `Cert` connect `lib.rs` to `whoiam.ts`, `UserIdentity`, `signOut`, `compilerOptions`, `updates.ts`, `types.ts`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `UserIdentity` to `CHANGELOG.md`, `RiverRooms`, `main.ts`, `NotificationItem`, `lib.rs`, `.applyLog`, `moderation.ts`, `SafeStorage`, `freenames.ts`, `ChatMessage`, `showProfilePage`, `types.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _583 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.006514657980456026 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._
- **Should `init` be split into smaller, more focused modules?**
  _Cohesion score 0.12195121951219512 - nodes in this community are weakly interconnected._