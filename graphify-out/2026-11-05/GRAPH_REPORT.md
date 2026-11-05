# Graph Report - radica  (2026-11-05)

## Corpus Check
- 219 files · ~686,692 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2218 nodes · 5929 edges · 83 communities (72 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 87 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4c5d280e`
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
- [[_COMMUNITY_Radica — domain language|Radica — domain language]]
- [[_COMMUNITY_ChatMessage|ChatMessage]]
- [[_COMMUNITY_durable.ts|durable.ts]]
- [[_COMMUNITY_translate.ts|translate.ts]]
- [[_COMMUNITY_types.ts|types.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_moderation.spec.ts|moderation.spec.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_verify.js|verify.js]]
- [[_COMMUNITY_split-freenet-dist.mjs|split-freenet-dist.mjs]]
- [[_COMMUNITY_BatchTranslator|BatchTranslator]]
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
- [[_COMMUNITY_media.ts|media.ts]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 220 edges
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

## Communities (83 total, 11 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (297): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, alerted, allCommunities, allPrivateRooms, blocklistsModal (+289 more)

### Community 2 - "lib.rs"
Cohesion: 0.09
Nodes (72): BTreeSet, main(), SigningKey, state(), an_author_takes_back_a_comment_with_an_empty_version(), check_comment(), check_post(), Comment (+64 more)

### Community 3 - "init"
Cohesion: 0.11
Nodes (57): fillAsocial(), generateDefaultAvatar(), escapeHtml(), safeUrl(), shortenKey(), renderIcon(), appendChatMessageToView(), applyChatLayoutAttr() (+49 more)

### Community 4 - "scripts"
Cohesion: 0.06
Nodes (30): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+22 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.21
Nodes (22): roomOwnerSk(), takeHandedKey(), appPath(), canonicalBase(), certShowsHost(), connectMessage(), createLocalIdentity(), enc (+14 more)

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
Cohesion: 0.07
Nodes (41): decodeCbor(), deltaCard(), deltaInCaption(), DeltaPage, deltaPrefixOf(), DeltaSite, DeltaUri, fillDelta() (+33 more)

### Community 11 - "SafeStorage"
Cohesion: 0.08
Nodes (54): burnAtOf(), checksHtml(), ConversationDeps, ConversationState, createConversationState(), Delivery, deliveryOf(), dmPeerOf() (+46 more)

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
Cohesion: 0.18
Nodes (4): UPDATES, bergamotPlugin(), BUILD, FREENET_ASSETS

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
Cohesion: 0.06
Nodes (76): addReadKeys(), decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptRoomKeyForPeer(), encryptWithSymmetricKey() (+68 more)

### Community 21 - "caption.ts"
Cohesion: 0.14
Nodes (28): CHAT_TOKEN_RE, chatText(), escMd(), extractCommentMedia(), isSafeUrl(), LINK_RE, linkCard(), linkify() (+20 more)

### Community 22 - "attachCardListeners"
Cohesion: 0.07
Nodes (47): enc, issueReceipt(), judgeClaim(), logEntryMessage(), SCOPE_FIELD, signEntry(), CFG, donor (+39 more)

### Community 24 - "Contributor Covenant Code of Conduct"
Cohesion: 0.23
Nodes (16): cacheKeyOf(), fillChatMedia(), keepChatMediaUrl(), pauseAllOtherAudio(), resolveChatMediaUrl(), wireDownload(), isFragmentedMp4(), item() (+8 more)

### Community 26 - "avatar.ts"
Cohesion: 0.40
Nodes (5): finishWelcome(), hasDefaultName(), maybeShowWelcome(), welcomeDoneKey(), welcomeStep()

### Community 28 - "icons.ts"
Cohesion: 0.07
Nodes (58): bitsOf(), cat(), challengeBytes(), checkProof(), decodeProof(), enc, grind(), makeProof() (+50 more)

### Community 29 - "showProfilePage"
Cohesion: 0.36
Nodes (8): handleSignOut(), check(), newNotes(), shortNote(), showReloadModal(), startVersionCheck(), restart(), signOut()

### Community 30 - "freenet.ts"
Cohesion: 0.29
Nodes (8): measureImageDimensions(), prepareChatDocFile(), prepareChatImageFile(), nextTtl(), yieldToMain(), handleClassicDropFiles(), setClassicStagedMedia(), createMessengerChat()

### Community 31 - "updates.ts"
Cohesion: 0.07
Nodes (68): freenet, checked, checkGhostkey(), ghostkey(), REFUSALS, requestGhostkeyProof(), verifiedGhostkeys(), foldGreenhouse() (+60 more)

### Community 32 - "CHANGELOG.md"
Cohesion: 0.14
Nodes (4): seedReadMark(), RiverJoin, setActiveSecretChatTTL(), room()

### Community 34 - "NotificationItem"
Cohesion: 0.12
Nodes (21): PreparedChatMedia, ICON_PATHS, IconName, ChatLayoutMode, chatTranslations, CLOCK_FMT, formatClock(), formatDateSeparator() (+13 more)

### Community 35 - "secretChat.ts"
Cohesion: 0.20
Nodes (12): stageVideo(), analyzeImageFile(), analyzeTextContent(), BAD_WORDS, BAD_WORDS_RE, censorTextAndPII(), getModerator(), ImageModerationResult (+4 more)

### Community 36 - "nodeOrigin"
Cohesion: 0.09
Nodes (33): asocialCard(), asocialLink(), asocialPersonHref(), asocialPersonOf(), asocialProfileCard(), asocialWorkHref(), AsocialWorkRef, GAME_CONTRACT_RE (+25 more)

### Community 37 - "types.ts"
Cohesion: 0.83
Nodes (3): closeModal(), installModalDismiss(), openModals()

### Community 39 - "versionCheck.ts"
Cohesion: 0.33
Nodes (6): closeGifPicker(), CURATED_GIFS, GifItem, openGifPicker(), heavyUrl(), heavyUrlFor()

### Community 40 - "Reader"
Cohesion: 0.32
Nodes (6): alertUnread(), openNotification(), renderNotifs(), toShell(), updateNotificationsBadge(), splitNotifs()

### Community 41 - "conversationState.ts"
Cohesion: 0.40
Nodes (5): attachMentionPicker(), namesToKeys(), Person, picked, withMentionKeys()

### Community 42 - "delegate.ts"
Cohesion: 0.13
Nodes (26): fillFreenames(), freenameInCaption(), freenamesCard(), FreenameUri, getResolvedFreename(), inflightResolutions, isKey(), nameHref() (+18 more)

### Community 43 - "UserIdentity"
Cohesion: 0.18
Nodes (6): MessengerActiveState, MessengerDeps, UnifiedConversation, ChatMessage, Community, UserIdentity

### Community 44 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+4 more)

### Community 45 - "ecosystem.ts"
Cohesion: 0.24
Nodes (3): PostReactionEvaluation, TrustBadgeInfo, WebOfTrust

### Community 46 - "WebOfTrust"
Cohesion: 0.52
Nodes (5): along(), Box, f(), growRoots(), rootPaths()

### Community 47 - "rootsfx.ts"
Cohesion: 0.15
Nodes (14): checkMilestones(), networkCounts(), renderMilestones(), Counts, countsOf(), FIRST, Metric, METRIC_LABELS (+6 more)

### Community 48 - "gifPicker.ts"
Cohesion: 0.07
Nodes (66): freepollsCard(), freepollsLink(), amGlobalMod(), cacheCard(), checkCommunitiesOnNetwork(), deleteCommentFromCard(), deletePostFromCard(), formatTimeAgo() (+58 more)

### Community 49 - "createMessengerChat"
Cohesion: 0.12
Nodes (16): devDependencies, chai, ethers, hardhat, @nomicfoundation/hardhat-chai-matchers, @nomicfoundation/hardhat-ethers, @nomicfoundation/hardhat-verify, @openzeppelin/contracts (+8 more)

### Community 50 - "createMessengerChat"
Cohesion: 0.50
Nodes (4): pathLabel(), resolve(), short(), webLabel()

### Community 54 - "avatar.ts"
Cohesion: 0.29
Nodes (6): avatarCache, buildDefaultAvatar(), compressAvatarFile(), compressPostImageFile(), svgToBase64Uri(), h()

### Community 55 - "parseChatMedia"
Cohesion: 0.12
Nodes (34): analyzeAudioBlob(), AUDIO_EXT, blobCache, chatMediaCardsHtml(), ChatMediaItem, ChatMediaKind, ChunkProgress, dataUriToBytesAndMime() (+26 more)

### Community 57 - "Radica — domain language"
Cohesion: 0.33
Nodes (5): Chat, Decisions, Device storage, Radica — domain language, Supporters

### Community 61 - "durable.ts"
Cohesion: 0.07
Nodes (29): createDurable(), durable, DURABLE_PREFIXES, DurableNode, DurableStore, isDurable(), packageKey(), reconcile() (+21 more)

### Community 62 - "translate.ts"
Cohesion: 0.19
Nodes (16): before, draftTranslateHtml(), initDraftTranslate(), translateKeeping(), setReaderLang(), availableLangs(), detectLang(), gateway() (+8 more)

### Community 63 - "types.ts"
Cohesion: 0.05
Nodes (42): CommunitySort, compare(), findCommunities(), FinderInput, FinderResult, slugOf(), giveUpWorker(), lightFeed (+34 more)

### Community 64 - "package.json"
Cohesion: 0.15
Nodes (12): dependencies, @semaphore-protocol/core, viem, devDependencies, vite, name, private, scripts (+4 more)

### Community 66 - "package.json"
Cohesion: 0.17
Nodes (11): dependencies, @freenetorg/freenet-stdlib, @noble/ed25519, @noble/hashes, viem, name, private, scripts (+3 more)

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
Cohesion: 0.60
Nodes (3): cut(), Root, rootsSvg()

### Community 85 - "showMyPost"
Cohesion: 0.07
Nodes (34): nodeOrigin(), getIdentity(), applyTheme(), bootSettled(), bootStep(), checkUrlInviteHash(), checkUrlPostHash(), closeRailPages() (+26 more)

### Community 87 - "media.ts"
Cohesion: 0.21
Nodes (12): sealChatMedia(), sealChatMediaChunked(), sealWithKey(), dataUrlBytes(), inflight, keepMedia(), mediaHashOf(), mediaUrl() (+4 more)

## Knowledge Gaps
- **580 isolated node(s):** `name`, `private`, `type`, `start`, `test` (+575 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Cert` connect `lib.rs` to `RiverRooms`, `whoiam.ts`, `UserIdentity`, `signOut`, `compilerOptions`, `updates.ts`, `types.ts`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `moderation.ts` to `CHANGELOG.md`, `RiverRooms`, `.applyLog`, `compilerOptions`, `delegate.ts`, `UserIdentity`, `SafeStorage`, `feature_request.md`, `compilerOptions`, `showMyPost`, `media.ts`, `feedsize.ts`, `freenames.ts`, `ChatMessage`, `icons.ts`, `types.ts`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `UserIdentity` connect `UserIdentity` to `CHANGELOG.md`, `RiverRooms`, `main.ts`, `NotificationItem`, `lib.rs`, `.applyLog`, `moderation.ts`, `SafeStorage`, `compilerOptions`, `feedsize.ts`, `freenames.ts`, `types.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _580 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.006514657980456026 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208860759493671 - nodes in this community are weakly interconnected._
- **Should `init` be split into smaller, more focused modules?**
  _Cohesion score 0.108708357685564 - nodes in this community are weakly interconnected._