# Graph Report - radica  (2026-11-04)

## Corpus Check
- 200 files · ~544,254 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1984 nodes · 5258 edges · 78 communities (71 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 84 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `09bfd2e4`
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
- [[_COMMUNITY_NotificationItem|NotificationItem]]
- [[_COMMUNITY_.logAppend|.logAppend]]
- [[_COMMUNITY_nodeOrigin|nodeOrigin]]
- [[_COMMUNITY_types.ts|types.ts]]
- [[_COMMUNITY_FREETUNES_KEY|FREETUNES_KEY]]
- [[_COMMUNITY_versionCheck.ts|versionCheck.ts]]
- [[_COMMUNITY_Reader|Reader]]
- [[_COMMUNITY_showProfilePage|showProfilePage]]
- [[_COMMUNITY_freenet.ts|freenet.ts]]
- [[_COMMUNITY_WebOfTrust|WebOfTrust]]
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]
- [[_COMMUNITY_gifPicker.ts|gifPicker.ts]]
- [[_COMMUNITY_createMessengerChat|createMessengerChat]]
- [[_COMMUNITY_createMessengerChat|createMessengerChat]]
- [[_COMMUNITY_media.ts|media.ts]]
- [[_COMMUNITY_avatar.ts|avatar.ts]]
- [[_COMMUNITY_parseChatMedia|parseChatMedia]]
- [[_COMMUNITY_rootsfx.ts|rootsfx.ts]]
- [[_COMMUNITY_Radica — domain language|Radica — domain language]]
- [[_COMMUNITY_templateNesting.test.ts|templateNesting.test.ts]]
- [[_COMMUNITY_roots.ts|roots.ts]]
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

## Communities (78 total, 7 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (278): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+270 more)

### Community 1 - "RiverRooms"
Cohesion: 0.13
Nodes (6): formatCommentSignatureMessage(), formatDeleteSignatureMessage(), formatFollowingSignatureMessage(), formatPostSignatureMessage(), formatProfileSignatureMessage(), Post

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.14
Nodes (34): msg(), fillFreetunes(), alertUnread(), appendChatMessageToView(), applyChatLayoutAttr(), attachBubbleDeleteListeners(), clearActiveChat(), currentChatLayout() (+26 more)

### Community 4 - "scripts"
Cohesion: 0.06
Nodes (30): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+22 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.06
Nodes (54): getIdentity(), api(), call(), chain, delegateMessage(), kvKey(), message(), nodeAppKey() (+46 more)

### Community 6 - "🚀 Getting Started"
Cohesion: 0.08
Nodes (23): 1. Installation, 1. 🛡️ On-Device AI Moderation (Desert Ant Labs), 2. 🔒 Automated PII Redaction & Text Censorship, 2. Development Mode, 3. Contract Compilation & Testing, 3. ⏱️ Decentralized Anti-Flooding & Rate Limiting, 4. Build Production Web Application, 4. 🌐 Cryptographic Personas & Decentralized Storage (+15 more)

### Community 7 - "lib.rs"
Cohesion: 0.10
Nodes (59): AuthorizedEncryptedSecretForMember, AuthorizedMember, ChatRoomParametersV1, ChatRoomStateV1, ChatRoomStateV1Delta, Error, HashMap, MessageId (+51 more)

### Community 8 - "dependencies"
Cohesion: 0.07
Nodes (26): dependencies, @browsermt/bergamot-translator, @desert-ant-labs/moderator, @fontsource-variable/fraunces, @fontsource-variable/inter, @freenetorg/freenet-stdlib, @litertjs/core, mediabunny (+18 more)

### Community 10 - "moderation.ts"
Cohesion: 0.19
Nodes (13): stageVideo(), analyzeImageFile(), analyzeTextContent(), BAD_WORDS, BAD_WORDS_RE, censorTextAndPII(), getModerator(), ImageModerationResult (+5 more)

### Community 11 - "SafeStorage"
Cohesion: 0.19
Nodes (19): burnAtOf(), cancelMessageBurn(), getActiveSecretChatTTL(), getSecretRoomId(), addSecretChatPeer(), burnSecretMessage(), getItem(), peersKey() (+11 more)

### Community 12 - "resetPublishBtnState"
Cohesion: 0.33
Nodes (7): blockPublishBtnForUnverified(), isPostInCooldown(), resetPublishBtnState(), setMediaSensitive(), setMediaVerifiedSafe(), showScanResult(), startPostCooldown()

### Community 13 - "vite.config.ts"
Cohesion: 0.22
Nodes (21): GENESIS, bodies(), CHAT_REACTIONS, dedupeChat(), foldBlocklist(), foldChat(), foldChatHides(), foldChatRead() (+13 more)

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
Cohesion: 0.16
Nodes (22): CHAT_TOKEN_RE, chatText(), escMd(), extractCommentMedia(), isSafeUrl(), LINK_RE, linkify(), md() (+14 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.07
Nodes (47): enc, issueReceipt(), judgeClaim(), logEntryMessage(), SCOPE_FIELD, signEntry(), CFG, donor (+39 more)

### Community 23 - "feedsize.ts"
Cohesion: 0.24
Nodes (4): MessengerActiveState, MessengerDeps, UnifiedConversation, Community

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.23
Nodes (16): cacheKeyOf(), fillChatMedia(), keepChatMediaUrl(), pauseAllOtherAudio(), resolveChatMediaUrl(), wireDownload(), isFragmentedMp4(), item() (+8 more)

### Community 25 - "freenames.ts"
Cohesion: 0.16
Nodes (5): encryptRoomKeyForPeer(), RiverJoin, room(), PrivateRoom, UserIdentity

### Community 26 - "avatar.ts"
Cohesion: 0.14
Nodes (18): ECOSYSTEM, EcosystemApp, ecosystemCard(), ecosystemFooter(), hrefOf(), link(), applyTheme(), bootSettled() (+10 more)

### Community 28 - "icons.ts"
Cohesion: 0.07
Nodes (59): bitsOf(), cat(), challengeBytes(), checkProof(), decodeProof(), enc, grind(), makeProof() (+51 more)

### Community 29 - "showProfilePage"
Cohesion: 0.06
Nodes (45): decodeCbor(), deltaPrefixOf(), DeltaSite, pageHref(), parseSite(), pointerKey(), pointerParams(), resolveSiteCode() (+37 more)

### Community 30 - "SUMMARY.md"
Cohesion: 0.25
Nodes (13): analyzeAudioBlob(), defaultWaveform(), fetchChatMedia(), maskChatMediaTokens(), normalizePeaksToBars(), openChatMedia(), sealChatMedia(), sealChatMediaChunked() (+5 more)

### Community 31 - "updates.ts"
Cohesion: 0.09
Nodes (53): freenet, foldGreenhouse(), greenhouseTokens(), parse(), Seed, SEED_DAYS, SEED_STATUSES, SeedKind (+45 more)

### Community 34 - "NotificationItem"
Cohesion: 0.13
Nodes (19): PreparedChatMedia, ChatLayoutMode, chatTranslations, CLOCK_FMT, formatClock(), formatDateSeparator(), formatInboxTime(), LONG_DATE_FMT (+11 more)

### Community 35 - ".logAppend"
Cohesion: 0.18
Nodes (11): checkUrlInviteHash(), checkUrlPostHash(), handleJoinFromInviteUrl(), INVITE_PARAMS, inviteFromParams(), openPostLink(), openProfilePost(), riverCodeIn() (+3 more)

### Community 36 - "nodeOrigin"
Cohesion: 0.16
Nodes (13): chunk(), Fetch, fmtTime(), freetunesCard(), freetunesLink(), FtRelease, FtTrack, ID_RE (+5 more)

### Community 37 - "types.ts"
Cohesion: 0.83
Nodes (3): closeModal(), installModalDismiss(), openModals()

### Community 39 - "versionCheck.ts"
Cohesion: 0.29
Nodes (7): finishWelcome(), hasDefaultName(), isJoined(), maybeShowWelcome(), renderWelcomeSuggestions(), welcomeDoneKey(), welcomeStep()

### Community 40 - "Reader"
Cohesion: 0.23
Nodes (12): chatMediaCardsHtml(), fileExtensionIcon(), formatBytes(), formatMediaDuration(), prepareChatAudioFile(), prepareChatDocFile(), summarizeChatMediaText(), yieldToMain() (+4 more)

### Community 41 - "showProfilePage"
Cohesion: 0.33
Nodes (6): closeGifPicker(), CURATED_GIFS, GifItem, openGifPicker(), heavyUrl(), heavyUrlFor()

### Community 43 - "freenet.ts"
Cohesion: 0.10
Nodes (23): addReadKeys(), decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptWithSymmetricKey(), formatChatMessageSignatureMessage() (+15 more)

### Community 46 - "WebOfTrust"
Cohesion: 0.25
Nodes (3): PostReactionEvaluation, TrustBadgeInfo, WebOfTrust

### Community 47 - "rootsfx.ts"
Cohesion: 0.13
Nodes (19): checkMilestones(), networkCounts(), paintReactionsBy(), reactionsByHtml(), renderMilestones(), toggleDislikeFromCard(), toggleLikeFromCard(), Counts (+11 more)

### Community 48 - "gifPicker.ts"
Cohesion: 0.09
Nodes (52): applyMaskBadWords(), cacheCard(), deleteCommentFromCard(), deletePostFromCard(), formatTimeAgo(), getAuthorDisplayName(), getWebOfTrust(), hiddenUsers() (+44 more)

### Community 49 - "createMessengerChat"
Cohesion: 0.12
Nodes (16): devDependencies, chai, ethers, hardhat, @nomicfoundation/hardhat-chai-matchers, @nomicfoundation/hardhat-ethers, @nomicfoundation/hardhat-verify, @openzeppelin/contracts (+8 more)

### Community 52 - "createMessengerChat"
Cohesion: 0.19
Nodes (19): checksHtml(), ConversationDeps, ConversationState, createConversationState(), Delivery, deliveryOf(), dmPeerOf(), KeyValue (+11 more)

### Community 53 - "media.ts"
Cohesion: 0.33
Nodes (7): dataUrlBytes(), inflight, keepMedia(), mediaUrl(), bytes, hash, urls

### Community 54 - "avatar.ts"
Cohesion: 0.29
Nodes (6): avatarCache, buildDefaultAvatar(), compressAvatarFile(), compressPostImageFile(), svgToBase64Uri(), h()

### Community 55 - "parseChatMedia"
Cohesion: 0.15
Nodes (22): AUDIO_EXT, blobCache, ChatMediaItem, ChatMediaKind, ChunkProgress, dataUriToBytesAndMime(), decodeWaveformHex(), encodeChatMediaToken() (+14 more)

### Community 56 - "rootsfx.ts"
Cohesion: 0.19
Nodes (19): nextTtl(), activeTimers, clearSecretChatSession(), dec, decryptSecretMessage(), enc, encryptSecretMessage(), formatTtlLabel() (+11 more)

### Community 57 - "Radica — domain language"
Cohesion: 0.33
Nodes (5): Chat, Decisions, Device storage, Radica — domain language, Supporters

### Community 60 - "roots.ts"
Cohesion: 0.60
Nodes (3): cut(), Root, rootsSvg()

### Community 61 - "durable.ts"
Cohesion: 0.07
Nodes (29): createDurable(), durable, DURABLE_PREFIXES, DurableNode, DurableStore, isDurable(), packageKey(), reconcile() (+21 more)

### Community 62 - "translate.ts"
Cohesion: 0.23
Nodes (12): files(), setReaderLang(), availableLangs(), detectLang(), gateway(), getTranslator(), LANGS, loadRegistry() (+4 more)

### Community 63 - "types.ts"
Cohesion: 0.12
Nodes (17): giveUpWorker(), lightFeed, lightFeedAsync(), lightFeedOf(), mergeFeedText(), parseInline(), raw, waiting (+9 more)

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
Cohesion: 0.18
Nodes (9): all, cfg, cfgPath, copy(), dist, fingerprint, hash, heavy (+1 more)

### Community 70 - "BatchTranslator"
Cohesion: 0.20
Nodes (3): BatchTranslator, @browsermt/bergamot-translator/translator.js, TranslatorBacking

### Community 71 - "feedsize.ts"
Cohesion: 0.42
Nodes (6): FEED_TARGET, feedBytes(), formatBytes(), oldestToFree(), postBytes(), renderFeedSize()

### Community 72 - "pow.ts"
Cohesion: 0.54
Nodes (6): countLeadingZeroBits(), createPoWChallenge(), enc, PoWProof, solvePoW(), verifyPoW()

### Community 73 - "Radica donation contract"
Cohesion: 0.33
Nodes (5): Before Base mainnet, Deploy, Deployments, Radica donation contract, Test

### Community 74 - "mentionPicker.ts"
Cohesion: 0.19
Nodes (12): linkCard(), mentionsIn(), plainMentions(), renderCaption(), renderPost(), setMaskBadWords(), trendingTags(), attachMentionPicker() (+4 more)

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
Cohesion: 0.15
Nodes (28): generateDefaultAvatar(), nodeOrigin(), escapeHtml(), safeUrl(), shortenKey(), ICON_PATHS, IconName, renderIcon() (+20 more)

## Knowledge Gaps
- **534 isolated node(s):** `name`, `private`, `type`, `start`, `test` (+529 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cert` connect `lib.rs` to `RiverRooms`, `whoiam.ts`, `vite.config.ts`, `signOut`, `freenames.ts`, `updates.ts`, `types.ts`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `delta.ts` to `CHANGELOG.md`, `RiverRooms`, `whoiam.ts`, `compilerOptions`, `freenet.ts`, `SafeStorage`, `vite.config.ts`, `feature_request.md`, `feedsize.ts`, `rootsfx.ts`, `freenames.ts`, `icons.ts`, `showProfilePage`, `SUMMARY.md`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `freenames.ts` to `CHANGELOG.md`, `RiverRooms`, `main.ts`, `NotificationItem`, `lib.rs`, `compilerOptions`, `freenet.ts`, `SafeStorage`, `vite.config.ts`, `delta.ts`, `feedsize.ts`, `types.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _534 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.006993006993006993 - nodes in this community are weakly interconnected._
- **Should `RiverRooms` be split into smaller, more focused modules?**
  _Cohesion score 0.12873563218390804 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._