# Graph Report - radica  (2026-11-06)

## Corpus Check
- 223 files · ~706,819 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2399 nodes · 6420 edges · 88 communities (79 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 98 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fc0b958c`
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
- [[_COMMUNITY_createMessengerChat|createMessengerChat]]
- [[_COMMUNITY_Reader|Reader]]
- [[_COMMUNITY_versionCheck.ts|versionCheck.ts]]
- [[_COMMUNITY_delegate.ts|delegate.ts]]
- [[_COMMUNITY_UserIdentity|UserIdentity]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_ecosystem.ts|ecosystem.ts]]
- [[_COMMUNITY_handleJoinFromInviteUrl|handleJoinFromInviteUrl]]
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
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]
- [[_COMMUNITY_splitNotifs|splitNotifs]]
- [[_COMMUNITY_durable.ts|durable.ts]]
- [[_COMMUNITY_translate.ts|translate.ts]]
- [[_COMMUNITY_heavyUrl|heavyUrl]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_moderation.spec.ts|moderation.spec.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_pow.ts|pow.ts]]
- [[_COMMUNITY_verify.js|verify.js]]
- [[_COMMUNITY_feedlight.ts|feedlight.ts]]
- [[_COMMUNITY_BatchTranslator|BatchTranslator]]
- [[_COMMUNITY_Radica donation contract|Radica donation contract]]
- [[_COMMUNITY_delegate.ts|delegate.ts]]
- [[_COMMUNITY_Radica attester|Radica attester]]
- [[_COMMUNITY_RadicaSupport.test.js|RadicaSupport.test.js]]
- [[_COMMUNITY_hardhat.config.js|hardhat.config.js]]
- [[_COMMUNITY_fetch-translation-models.mjs|fetch-translation-models.mjs]]
- [[_COMMUNITY_start.sh|start.sh]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_showMyPost|showMyPost]]
- [[_COMMUNITY_topPosts.ts|topPosts.ts]]
- [[_COMMUNITY_media.ts|media.ts]]
- [[_COMMUNITY_communityFinder.ts|communityFinder.ts]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 233 edges
2. `renderTimeline()` - 82 edges
3. `UserIdentity` - 76 edges
4. `escapeHtml()` - 60 edges
5. `PrivateRoom` - 38 edges
6. `openUserProfile()` - 37 edges
7. `initCardListeners()` - 35 edges
8. `RiverRooms` - 34 edges
9. `SafeStorage` - 34 edges
10. `init()` - 33 edges

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

## Communities (88 total, 9 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (311): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+303 more)

### Community 1 - "RiverRooms"
Cohesion: 0.08
Nodes (27): addReadKeys(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptWithSymmetricKey(), formatChatMessageSignatureMessage(), formatCommentSignatureMessage(), formatCommunitySignatureMessage() (+19 more)

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.11
Nodes (43): fillAsocial(), fillFh(), fillFreenames(), shortenKey(), appendChatMessageToView(), applyChatLayoutAttr(), attachBubbleDeleteListeners(), chatExcerpt() (+35 more)

### Community 4 - "scripts"
Cohesion: 0.06
Nodes (30): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+22 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.12
Nodes (27): dec, enc, freenameInCaption(), freenamesCard(), FreenameUri, getResolvedFreename(), inflightResolutions, isKey() (+19 more)

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
Cohesion: 0.05
Nodes (54): decodeCbor(), deltaInCaption(), DeltaPage, deltaPrefixOf(), DeltaSite, DeltaUri, parseDeltaUri(), parseSite() (+46 more)

### Community 11 - "SafeStorage"
Cohesion: 0.17
Nodes (10): overlayFeed(), GONE_MESSAGE, whyGone, Comment, FeedState, Like, PostCategory, ProfileInfo (+2 more)

### Community 12 - "resetPublishBtnState"
Cohesion: 0.25
Nodes (9): blockPublishBtnForUnverified(), isPostInCooldown(), resetPublishBtnState(), revokePosterUrl(), setMediaSensitive(), setMediaVerifiedSafe(), showScanResult(), stageVideo() (+1 more)

### Community 13 - "vite.config.ts"
Cohesion: 0.18
Nodes (24): a_proof_holds_for_its_identity_only_and_under_the_real_master_only(), a_sign_result_becomes_the_bundle_viso_stores(), binding_payload(), call(), cbor(), fixture(), handle(), key32() (+16 more)

### Community 14 - "signOut"
Cohesion: 0.13
Nodes (34): check(), de(), delta(), Entry, entry_msg(), err(), LogState, merge() (+26 more)

### Community 15 - "delta.ts"
Cohesion: 0.17
Nodes (5): renderUpdatesList(), UPDATES, bergamotPlugin(), BUILD, FREENET_ASSETS

### Community 16 - "feature_request.md"
Cohesion: 0.08
Nodes (27): CURRENT, LEGACY, limiter(), yieldToMain(), asBytes(), bgGate, codes, contractCode() (+19 more)

### Community 18 - "SafeStorage"
Cohesion: 0.17
Nodes (18): delta_only_to_a_peer_without_it(), only_the_named_bytes_are_valid(), params(), RadicaMediaContract, ContractError, ContractInterface, Parameters, RelatedContracts (+10 more)

### Community 19 - ".process"
Cohesion: 0.14
Nodes (20): Identity, key_of(), kv_name(), parse_sk(), Req, Option, Parameters, Result (+12 more)

### Community 20 - "compilerOptions"
Cohesion: 0.05
Nodes (88): GENESIS, bodies(), CHAT_REACTIONS, dedupeChat(), directoryWeights(), enc, entryJson, foldBlocklist() (+80 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.07
Nodes (47): enc, issueReceipt(), judgeClaim(), logEntryMessage(), SCOPE_FIELD, signEntry(), CFG, donor (+39 more)

### Community 23 - "feedsize.ts"
Cohesion: 0.10
Nodes (40): deltaCard(), fillDelta(), pageHref(), freepollsCard(), freepollsLink(), applyMaskBadWords(), cacheCard(), deleteCommentFromCard() (+32 more)

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.19
Nodes (21): cacheKeyOf(), fillChatMedia(), keepChatMediaUrl(), pauseAllOtherAudio(), resolveChatMediaUrl(), sealChatMediaChunked(), sealWithKey(), sendChatAttachment() (+13 more)

### Community 25 - "freenames.ts"
Cohesion: 0.16
Nodes (14): getIdentity(), applyTheme(), bootStep(), checkUrlPostHash(), draftKey(), hideBoot(), init(), initTheme() (+6 more)

### Community 26 - "avatar.ts"
Cohesion: 0.25
Nodes (19): roomOwnerSk(), takeHandedKey(), appPath(), canonicalBase(), certShowsHost(), connectMessage(), createLocalIdentity(), enc (+11 more)

### Community 28 - "icons.ts"
Cohesion: 0.07
Nodes (58): bitsOf(), cat(), challengeBytes(), checkProof(), decodeProof(), enc, grind(), makeProof() (+50 more)

### Community 29 - "showProfilePage"
Cohesion: 0.18
Nodes (4): MessengerDeps, UnifiedConversation, Community, UserIdentity

### Community 30 - "freenet.ts"
Cohesion: 0.36
Nodes (7): FEED_TARGET, feedBytes(), formatBytes(), oldestToFree(), postBytes(), renderFeedSize(), updateMyPostsAndScopeCounts()

### Community 31 - "updates.ts"
Cohesion: 0.07
Nodes (69): freenet, checked, checkGhostkey(), ghostkey(), REFUSALS, requestGhostkeyProof(), verifiedGhostkeys(), foldGreenhouse() (+61 more)

### Community 32 - "CHANGELOG.md"
Cohesion: 0.14
Nodes (8): decryptDirectMessage(), decryptRoomKeyFromPeer(), readEncPubs(), MessengerActiveState, mergeRoomBackup(), ChatMessage, PrivateRoom, room()

### Community 34 - "NotificationItem"
Cohesion: 0.11
Nodes (22): PreparedChatMedia, ICON_PATHS, IconName, ChatLayoutMode, chatTranslations, CLOCK_FMT, formatClock(), formatDateSeparator() (+14 more)

### Community 35 - "secretChat.ts"
Cohesion: 0.22
Nodes (11): analyzeImageFile(), analyzeTextContent(), BAD_WORDS, BAD_WORDS_RE, censorTextAndPII(), getModerator(), ImageModerationResult, personalDataIn() (+3 more)

### Community 36 - "nodeOrigin"
Cohesion: 0.06
Nodes (61): ECOSYSTEM, EcosystemApp, ecosystemCard(), ecosystemFooter(), hrefOf(), link(), cleanHash(), dec (+53 more)

### Community 37 - "types.ts"
Cohesion: 0.14
Nodes (32): closeModal(), hasOpenModal(), installModalDismiss(), openModals(), ActiveView, clearSelectedPostCard(), closeOtherPages(), findNextCardIndex() (+24 more)

### Community 39 - "createMessengerChat"
Cohesion: 0.24
Nodes (11): fileExtensionIcon(), normalizeAudioMime(), prepareChatAudioFile(), prepareChatDocFile(), draftTranslateHtml(), nextTtl(), handleClassicDropFiles(), setClassicStagedMedia() (+3 more)

### Community 40 - "Reader"
Cohesion: 0.17
Nodes (11): isHeavy(), all, cfg, cfgPath, copy(), dist, files(), fingerprint (+3 more)

### Community 41 - "versionCheck.ts"
Cohesion: 0.36
Nodes (8): handleSignOut(), check(), newNotes(), shortNote(), showReloadModal(), startVersionCheck(), restart(), signOut()

### Community 42 - "delegate.ts"
Cohesion: 0.12
Nodes (32): CHAT_TOKEN_RE, chatText(), escMd(), extractCommentMedia(), isSafeUrl(), LINK_RE, linkCard(), linkify() (+24 more)

### Community 44 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+4 more)

### Community 45 - "ecosystem.ts"
Cohesion: 0.22
Nodes (4): unprovenComment(), PostReactionEvaluation, TrustBadgeInfo, WebOfTrust

### Community 46 - "handleJoinFromInviteUrl"
Cohesion: 0.29
Nodes (8): checkUrlInviteHash(), handleFreenameLink(), handleJoinFromInviteUrl(), INVITE_PARAMS, inviteFromParams(), openPostLink(), riverCodeIn(), goTo()

### Community 47 - "rootsfx.ts"
Cohesion: 0.12
Nodes (19): checkMilestones(), networkCounts(), renderMilestones(), Counts, countsOf(), FIRST, Metric, METRIC_LABELS (+11 more)

### Community 48 - "gifPicker.ts"
Cohesion: 0.13
Nodes (37): generateDefaultAvatar(), nodeOrigin(), escapeHtml(), safeUrl(), renderIcon(), applyProfile(), blockPublishBtnForNsfw(), chatTime() (+29 more)

### Community 49 - "createMessengerChat"
Cohesion: 0.12
Nodes (16): devDependencies, chai, ethers, hardhat, @nomicfoundation/hardhat-chai-matchers, @nomicfoundation/hardhat-ethers, @nomicfoundation/hardhat-verify, @openzeppelin/contracts (+8 more)

### Community 50 - "createMessengerChat"
Cohesion: 0.13
Nodes (30): ASOCIAL_RECORDS_CODE_BYTES, asocialCard(), AsocialData, asocialLink(), asocialOwnStoreKey(), asocialOwnStoreParams(), asocialPersonHref(), asocialPersonOf() (+22 more)

### Community 54 - "avatar.ts"
Cohesion: 0.40
Nodes (4): avatarCache, buildDefaultAvatar(), compressAvatarFile(), svgToBase64Uri()

### Community 55 - "parseChatMedia"
Cohesion: 0.11
Nodes (35): compressPostImageFile(), analyzeAudioBlob(), AUDIO_EXT, blobCache, chatMediaCardsHtml(), ChatMediaItem, ChatMediaKind, ChunkProgress (+27 more)

### Community 56 - "secretChat.ts"
Cohesion: 0.19
Nodes (18): burnAtOf(), checksHtml(), ConversationDeps, ConversationState, createConversationState(), Delivery, deliveryOf(), dmPeerOf() (+10 more)

### Community 57 - "Radica — domain language"
Cohesion: 0.33
Nodes (5): Chat, Decisions, Device storage, Radica — domain language, Supporters

### Community 58 - "feedlight.ts"
Cohesion: 0.40
Nodes (5): finishWelcome(), hasDefaultName(), maybeShowWelcome(), welcomeDoneKey(), welcomeStep()

### Community 59 - "rootsfx.ts"
Cohesion: 0.31
Nodes (10): reconcile(), reconcileItems(), isSaved(), keyOf(), load(), memo, savedId(), savedPosts() (+2 more)

### Community 60 - "splitNotifs"
Cohesion: 0.40
Nodes (4): alertUnread(), toShell(), updateNotificationsBadge(), splitNotifs()

### Community 61 - "durable.ts"
Cohesion: 0.08
Nodes (20): createDurable(), durable, DURABLE_PREFIXES, DurableNode, DurableStore, isDurable(), packageKey(), updateNotifsSoundBtn() (+12 more)

### Community 62 - "translate.ts"
Cohesion: 0.18
Nodes (16): before, initDraftTranslate(), translateKeeping(), setReaderLang(), availableLangs(), cachedAvail, detectLang(), gateway() (+8 more)

### Community 63 - "heavyUrl"
Cohesion: 0.33
Nodes (6): closeGifPicker(), CURATED_GIFS, GifItem, openGifPicker(), heavyUrl(), heavyUrlFor()

### Community 64 - "package.json"
Cohesion: 0.15
Nodes (12): dependencies, @semaphore-protocol/core, viem, devDependencies, vite, name, private, scripts (+4 more)

### Community 66 - "package.json"
Cohesion: 0.17
Nodes (11): dependencies, @freenetorg/freenet-stdlib, @noble/ed25519, @noble/hashes, viem, name, private, scripts (+3 more)

### Community 67 - "pow.ts"
Cohesion: 0.40
Nodes (5): attachMentionPicker(), namesToKeys(), Person, picked, withMentionKeys()

### Community 68 - "verify.js"
Cohesion: 0.24
Nodes (6): ADDRESSES, DEPLOYED, { ethers, network }, { TREASURY, ADDRESSES }, hre, { TREASURY, ADDRESSES, DEPLOYED }

### Community 69 - "feedlight.ts"
Cohesion: 0.27
Nodes (8): giveUpWorker(), lightFeed, lightFeedAsync(), lightFeedOf(), mergeFeedText(), parseInline(), waiting, raw

### Community 70 - "BatchTranslator"
Cohesion: 0.20
Nodes (3): BatchTranslator, @browsermt/bergamot-translator/translator.js, TranslatorBacking

### Community 73 - "Radica donation contract"
Cohesion: 0.33
Nodes (5): Before Base mainnet, Deploy, Deployments, Radica donation contract, Test

### Community 74 - "delegate.ts"
Cohesion: 0.17
Nodes (22): api(), asBytes(), call(), chain, dec, delegateMessage(), enc, extractPayload() (+14 more)

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

### Community 85 - "showMyPost"
Cohesion: 0.09
Nodes (37): amGlobalMod(), checkCommunitiesOnNetwork(), closeRailPages(), getWebOfTrust(), hiddenCommunityIds(), hideCommunityForAll(), isKnownSender(), isMobileTextEntry() (+29 more)

### Community 86 - "topPosts.ts"
Cohesion: 0.22
Nodes (8): EQUAL, FeedSort, isFuture(), postScore(), sortPosts(), Weights, WINDOW_MS, now

### Community 87 - "media.ts"
Cohesion: 0.24
Nodes (10): postImagesHtml(), dataUrlBytes(), inflight, keepMedia(), mediaRef(), mediaUris(), mediaUrl(), urls (+2 more)

### Community 88 - "communityFinder.ts"
Cohesion: 0.27
Nodes (9): CommunitySort, compare(), findCommunities(), FinderInput, FinderResult, slugOf(), all, comm() (+1 more)

## Knowledge Gaps
- **636 isolated node(s):** `name`, `private`, `type`, `start`, `test` (+631 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FreenetClient` connect `moderation.ts` to `CHANGELOG.md`, `RiverRooms`, `nodeOrigin`, `whoiam.ts`, `.applyLog`, `compilerOptions`, `UserIdentity`, `feature_request.md`, `createMessengerChat`, `compilerOptions`, `caption.ts`, `parseChatMedia`, `media.ts`, `freenames.ts`, `icons.ts`, `showProfilePage`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `Cert` connect `lib.rs` to `RiverRooms`, `SafeStorage`, `signOut`, `compilerOptions`, `avatar.ts`, `showProfilePage`, `updates.ts`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `showProfilePage` to `CHANGELOG.md`, `RiverRooms`, `main.ts`, `NotificationItem`, `lib.rs`, `.applyLog`, `moderation.ts`, `UserIdentity`, `SafeStorage`, `compilerOptions`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _636 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.006172839506172839 - nodes in this community are weakly interconnected._
- **Should `RiverRooms` be split into smaller, more focused modules?**
  _Cohesion score 0.08163265306122448 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._