# Graph Report - radica  (2026-11-04)

## Corpus Check
- 198 files · ~661,351 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1984 nodes · 5258 edges · 80 communities (68 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 84 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7778c954`
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
- [[_COMMUNITY_freenames.ts|freenames.ts]]
- [[_COMMUNITY_freenet.ts|freenet.ts]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_ecosystem.ts|ecosystem.ts]]
- [[_COMMUNITY_WebOfTrust|WebOfTrust]]
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]
- [[_COMMUNITY_gifPicker.ts|gifPicker.ts]]
- [[_COMMUNITY_createMessengerChat|createMessengerChat]]
- [[_COMMUNITY_Reader|Reader]]
- [[_COMMUNITY_templateNesting.test.ts|templateNesting.test.ts]]
- [[_COMMUNITY_createMessengerChat|createMessengerChat]]
- [[_COMMUNITY_media.ts|media.ts]]
- [[_COMMUNITY_avatar.ts|avatar.ts]]
- [[_COMMUNITY_parseChatMedia|parseChatMedia]]
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]
- [[_COMMUNITY_Radica — domain language|Radica — domain language]]
- [[_COMMUNITY_icons.ts|icons.ts]]
- [[_COMMUNITY_durable.ts|durable.ts]]
- [[_COMMUNITY_translate.ts|translate.ts]]
- [[_COMMUNITY_types.ts|types.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_communityFinder.ts|communityFinder.ts]]
- [[_COMMUNITY_verify.js|verify.js]]
- [[_COMMUNITY_split-freenet-dist.mjs|split-freenet-dist.mjs]]
- [[_COMMUNITY_BatchTranslator|BatchTranslator]]
- [[_COMMUNITY_feedsize.ts|feedsize.ts]]
- [[_COMMUNITY_Radica donation contract|Radica donation contract]]
- [[_COMMUNITY_Radica attester|Radica attester]]
- [[_COMMUNITY_RadicaSupport.test.js|RadicaSupport.test.js]]
- [[_COMMUNITY_hardhat.config.js|hardhat.config.js]]
- [[_COMMUNITY_fetch-translation-models.mjs|fetch-translation-models.mjs]]
- [[_COMMUNITY_icons.ts|icons.ts]]
- [[_COMMUNITY_start.sh|start.sh]]
- [[_COMMUNITY_README|README.md]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 202 edges
2. `UserIdentity` - 76 edges
3. `renderTimeline()` - 56 edges
4. `escapeHtml()` - 50 edges
5. `PrivateRoom` - 38 edges
6. `SafeStorage` - 34 edges
7. `init()` - 33 edges
8. `RiverRooms` - 33 edges
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

## Communities (80 total, 12 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (276): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+268 more)

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.15
Nodes (36): shortenKey(), alertUnread(), applyChatLayoutAttr(), attachBubbleDeleteListeners(), clearActiveChat(), currentChatLayout(), filterClassicMessages(), fitChatInput() (+28 more)

### Community 4 - "scripts"
Cohesion: 0.06
Nodes (30): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+22 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.16
Nodes (28): getIdentity(), handleSignOut(), roomOwnerSk(), takeHandedKey(), appPath(), canonicalBase(), certShowsHost(), connectMessage() (+20 more)

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
Cohesion: 0.16
Nodes (18): Exports, loadRiver(), river(), RiverCall, Anchor, anchorOf(), instanceOf(), keyOf() (+10 more)

### Community 10 - "moderation.ts"
Cohesion: 0.20
Nodes (20): decodeProof(), asBytes(), asNumber(), asString(), cborDecode(), cborEncode(), CborValue, enumVariant() (+12 more)

### Community 11 - "SafeStorage"
Cohesion: 0.19
Nodes (19): burnAtOf(), formatChatMessageSignatureMessage(), cancelMessageBurn(), getActiveSecretChatTTL(), getSecretRoomId(), addSecretChatPeer(), burnSecretMessage(), getItem() (+11 more)

### Community 12 - "resetPublishBtnState"
Cohesion: 0.33
Nodes (7): blockPublishBtnForUnverified(), isPostInCooldown(), resetPublishBtnState(), setMediaSensitive(), setMediaVerifiedSafe(), showScanResult(), startPostCooldown()

### Community 13 - "vite.config.ts"
Cohesion: 0.24
Nodes (20): GENESIS, bodies(), CHAT_REACTIONS, foldBlocklist(), foldChat(), foldChatHides(), foldChatRead(), foldCommentLikes() (+12 more)

### Community 14 - "signOut"
Cohesion: 0.13
Nodes (34): check(), de(), delta(), Entry, entry_msg(), err(), LogState, merge() (+26 more)

### Community 16 - "feature_request.md"
Cohesion: 0.11
Nodes (18): CURRENT, LEGACY, codes, contractCode(), ContractId, contractKey(), FreenetNetwork, oneAtATime (+10 more)

### Community 18 - "SafeStorage"
Cohesion: 0.17
Nodes (18): delta_only_to_a_peer_without_it(), only_the_named_bytes_are_valid(), params(), RadicaMediaContract, ContractError, ContractInterface, Parameters, RelatedContracts (+10 more)

### Community 19 - ".process"
Cohesion: 0.14
Nodes (20): Identity, key_of(), kv_name(), parse_sk(), Req, Option, Parameters, Result (+12 more)

### Community 20 - "compilerOptions"
Cohesion: 0.15
Nodes (3): dedupeChat(), MessengerActiveState, ChatMessage

### Community 21 - "caption.ts"
Cohesion: 0.06
Nodes (57): CHAT_TOKEN_RE, chatText(), escMd(), extractCommentMedia(), isSafeUrl(), LINK_RE, linkCard(), linkify() (+49 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.07
Nodes (47): enc, issueReceipt(), judgeClaim(), logEntryMessage(), SCOPE_FIELD, signEntry(), CFG, donor (+39 more)

### Community 23 - "feedsize.ts"
Cohesion: 0.28
Nodes (3): UnifiedConversation, Community, UserIdentity

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.22
Nodes (18): cacheKeyOf(), keepChatMediaUrl(), resolveChatMediaUrl(), sealChatMediaChunked(), sealWithKey(), sendChatAttachment(), uploadChatMedia(), isFragmentedMp4() (+10 more)

### Community 26 - "avatar.ts"
Cohesion: 0.09
Nodes (25): applyTheme(), bootSettled(), bootStep(), checkUrlInviteHash(), checkUrlPostHash(), closeRailPages(), draftKey(), handleJoinFromInviteUrl() (+17 more)

### Community 28 - "icons.ts"
Cohesion: 0.14
Nodes (21): code(), createPoll(), enc(), fillFreepolls(), fpIdentity(), FpPoll, FpQuestion, freepollsCard() (+13 more)

### Community 29 - "showProfilePage"
Cohesion: 0.23
Nodes (4): RiverNet, RiverRooms, vkOf(), device()

### Community 30 - "SUMMARY.md"
Cohesion: 0.28
Nodes (15): bitsOf(), cat(), challengeBytes(), checkProof(), enc, grind(), makeProof(), Proof (+7 more)

### Community 31 - "updates.ts"
Cohesion: 0.09
Nodes (52): foldGreenhouse(), greenhouseTokens(), parse(), Seed, SEED_DAYS, SEED_STATUSES, SeedKind, SeedStatus (+44 more)

### Community 34 - "NotificationItem"
Cohesion: 0.09
Nodes (27): PreparedChatMedia, ConversationState, tickBurnCountdowns(), triggerRowBurnAnimation(), freenet, limiter(), yieldToMain(), ChatLayoutMode (+19 more)

### Community 35 - ".logAppend"
Cohesion: 0.24
Nodes (14): decodeCbor(), deltaPrefixOf(), DeltaSite, pageHref(), parseSite(), pointerKey(), pointerParams(), resolveSiteCode() (+6 more)

### Community 36 - "nodeOrigin"
Cohesion: 0.16
Nodes (14): chunk(), Fetch, fillFreetunes(), fmtTime(), freetunesCard(), freetunesLink(), FtRelease, FtTrack (+6 more)

### Community 37 - "types.ts"
Cohesion: 0.83
Nodes (3): closeModal(), installModalDismiss(), openModals()

### Community 39 - "versionCheck.ts"
Cohesion: 0.29
Nodes (7): finishWelcome(), hasDefaultName(), isJoined(), maybeShowWelcome(), renderWelcomeSuggestions(), welcomeDoneKey(), welcomeStep()

### Community 40 - "Reader"
Cohesion: 0.15
Nodes (23): compressPostImageFile(), analyzeAudioBlob(), chatMediaCardsHtml(), defaultWaveform(), fetchChatMedia(), fileExtensionIcon(), formatBytes(), formatMediaDuration() (+15 more)

### Community 41 - "showProfilePage"
Cohesion: 0.26
Nodes (14): api(), call(), chain, delegateMessage(), kvKey(), message(), nodeAppKey(), nodeGet() (+6 more)

### Community 42 - "freenames.ts"
Cohesion: 0.22
Nodes (9): nameHref(), namesOf(), ownerOf(), registryKey(), RegState, sitesOf(), zoneKey(), A (+1 more)

### Community 43 - "freenet.ts"
Cohesion: 0.13
Nodes (27): addReadKeys(), decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptRoomKeyForPeer(), encryptWithSymmetricKey() (+19 more)

### Community 44 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+4 more)

### Community 45 - "ecosystem.ts"
Cohesion: 0.50
Nodes (6): ECOSYSTEM, EcosystemApp, ecosystemCard(), ecosystemFooter(), hrefOf(), link()

### Community 46 - "WebOfTrust"
Cohesion: 0.25
Nodes (3): PostReactionEvaluation, TrustBadgeInfo, WebOfTrust

### Community 47 - "rootsfx.ts"
Cohesion: 0.07
Nodes (28): checkMilestones(), networkCounts(), renderMilestones(), Counts, countsOf(), FIRST, Metric, METRIC_LABELS (+20 more)

### Community 48 - "gifPicker.ts"
Cohesion: 0.08
Nodes (51): amVouched(), applyMaskBadWords(), cacheCard(), deleteCommentFromCard(), deletePostFromCard(), formatTimeAgo(), getWebOfTrust(), hiddenUsers() (+43 more)

### Community 49 - "createMessengerChat"
Cohesion: 0.12
Nodes (16): devDependencies, chai, ethers, hardhat, @nomicfoundation/hardhat-chai-matchers, @nomicfoundation/hardhat-ethers, @nomicfoundation/hardhat-verify, @openzeppelin/contracts (+8 more)

### Community 52 - "createMessengerChat"
Cohesion: 0.23
Nodes (16): checksHtml(), ConversationDeps, createConversationState(), Delivery, deliveryOf(), dmPeerOf(), KeyValue, localReadMarks() (+8 more)

### Community 53 - "media.ts"
Cohesion: 0.26
Nodes (9): postMediaHash(), dataUrlBytes(), inflight, keepMedia(), mediaRef(), mediaUrl(), urls, bytes (+1 more)

### Community 54 - "avatar.ts"
Cohesion: 0.40
Nodes (4): avatarCache, buildDefaultAvatar(), compressAvatarFile(), svgToBase64Uri()

### Community 55 - "parseChatMedia"
Cohesion: 0.14
Nodes (22): AUDIO_EXT, blobCache, ChatMediaItem, ChatMediaKind, ChunkProgress, dataUriToBytesAndMime(), decodeWaveformHex(), encodeChatMediaToken() (+14 more)

### Community 56 - "rootsfx.ts"
Cohesion: 0.20
Nodes (18): activeTimers, clearSecretChatSession(), dec, decryptSecretMessage(), enc, encryptSecretMessage(), formatTtlLabel(), generateEphemeralKeyPair() (+10 more)

### Community 57 - "Radica — domain language"
Cohesion: 0.33
Nodes (5): Chat, Decisions, Device storage, Radica — domain language, Supporters

### Community 61 - "durable.ts"
Cohesion: 0.07
Nodes (29): createDurable(), durable, DURABLE_PREFIXES, DurableNode, DurableStore, isDurable(), packageKey(), reconcile() (+21 more)

### Community 62 - "translate.ts"
Cohesion: 0.24
Nodes (12): setReaderLang(), availableLangs(), detectLang(), gateway(), getTranslator(), LANGS, loadRegistry(), readerLang() (+4 more)

### Community 63 - "types.ts"
Cohesion: 0.12
Nodes (17): giveUpWorker(), lightFeed, lightFeedAsync(), lightFeedOf(), mergeFeedText(), parseInline(), waiting, overlayFeed() (+9 more)

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
Nodes (10): all, cfg, cfgPath, copy(), dist, files(), fingerprint, hash (+2 more)

### Community 70 - "BatchTranslator"
Cohesion: 0.20
Nodes (3): BatchTranslator, @browsermt/bergamot-translator/translator.js, TranslatorBacking

### Community 71 - "feedsize.ts"
Cohesion: 0.42
Nodes (6): FEED_TARGET, feedBytes(), formatBytes(), oldestToFree(), postBytes(), renderFeedSize()

### Community 73 - "Radica donation contract"
Cohesion: 0.33
Nodes (5): Before Base mainnet, Deploy, Deployments, Radica donation contract, Test

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
Cohesion: 0.13
Nodes (31): generateDefaultAvatar(), nodeOrigin(), escapeHtml(), safeUrl(), renderIcon(), appendChatMessageToView(), applyProfile(), blockPublishBtnForNsfw() (+23 more)

## Knowledge Gaps
- **534 isolated node(s):** `name`, `private`, `type`, `start`, `test` (+529 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cert` connect `lib.rs` to `RiverRooms`, `whoiam.ts`, `vite.config.ts`, `signOut`, `feedsize.ts`, `updates.ts`, `types.ts`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `delta.ts` to `CHANGELOG.md`, `RiverRooms`, `.logAppend`, `whoiam.ts`, `Reader`, `freenames.ts`, `SafeStorage`, `freenet.ts`, `vite.config.ts`, `moderation.ts`, `feature_request.md`, `compilerOptions`, `media.ts`, `feedsize.ts`, `rootsfx.ts`, `freenames.ts`, `showProfilePage`, `types.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `feedsize.ts` to `CHANGELOG.md`, `RiverRooms`, `main.ts`, `NotificationItem`, `lib.rs`, `freenet.ts`, `SafeStorage`, `vite.config.ts`, `delta.ts`, `compilerOptions`, `freenames.ts`, `types.ts`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _534 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.007017543859649123 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._