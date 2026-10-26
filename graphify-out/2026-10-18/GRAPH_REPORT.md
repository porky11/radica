# Graph Report - spruce  (2026-10-18)

## Corpus Check
- 26 files · ~149,209 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 509 nodes · 1034 edges · 18 communities (15 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fa5c7f3f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_main.ts|main.ts]]
- [[_COMMUNITY_FreenetClient|FreenetClient]]
- [[_COMMUNITY_lib.rs|lib.rs]]
- [[_COMMUNITY_init|init]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_whoiam.ts|whoiam.ts]]
- [[_COMMUNITY_🚀 Getting Started|🚀 Getting Started]]
- [[_COMMUNITY_crypto.ts|crypto.ts]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_moderation.ts|moderation.ts]]
- [[_COMMUNITY_Contributor Covenant Code of Conduct|Contributor Covenant Code of Conduct]]
- [[_COMMUNITY_resetPublishBtnState|resetPublishBtnState]]
- [[_COMMUNITY_signOut|signOut]]
- [[_COMMUNITY_switchToMyPostsScope|switchToMyPostsScope]]
- [[_COMMUNITY_WHOIAM_KEY|WHOIAM_KEY]]

## God Nodes (most connected - your core abstractions)
1. `FreenetClient` - 57 edges
2. `UserIdentity` - 35 edges
3. `init()` - 20 edges
4. `renderIcon()` - 16 edges
5. `renderTimeline()` - 16 edges
6. `SafeStorage` - 15 edges
7. `PrivateRoom` - 14 edges
8. `apply_delta()` - 12 edges
9. `test_keypair()` - 12 edges
10. `generateDefaultAvatar()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `init()` --calls--> `getOrCreateIdentity()`  [EXTRACTED]
  ui/src/main.ts → ui/src/crypto.ts
- `renderIdentityModal()` --calls--> `renderIcon()`  [EXTRACTED]
  ui/src/main.ts → ui/src/icons.ts
- `setMediaVerifiedSafe()` --calls--> `renderIcon()`  [EXTRACTED]
  ui/src/main.ts → ui/src/icons.ts
- `attachCardListeners()` --calls--> `censorTextAndPII()`  [EXTRACTED]
  ui/src/main.ts → ui/src/moderation.ts
- `renderChatParticipants()` --calls--> `personaName()`  [EXTRACTED]
  ui/src/main.ts → ui/src/whoiam.ts

## Import Cycles
- None detected.

## Communities (18 total, 3 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.01
Nodes (170): activeFilterBanner, activeFilterTag, addModForm, addModPubkeyInput, allCommunities, allPrivateRooms, brandLogo, chatBody (+162 more)

### Community 1 - "FreenetClient"
Cohesion: 0.09
Nodes (13): FreenetClient, ChatMessage, Comment, Community, FeedDelta, FeedState, NotificationItem, Post (+5 more)

### Community 2 - "lib.rs"
Cohesion: 0.11
Nodes (46): BTreeMap, BTreeSet, apply_delta(), Comment, compute_delta(), create_signed_comment(), create_signed_post(), de() (+38 more)

### Community 3 - "init"
Cohesion: 0.13
Nodes (40): compressAvatarFile(), compressPostImageFile(), generateDefaultAvatar(), svgToBase64Uri(), ICON_PATHS, IconName, renderIcon(), applyTheme() (+32 more)

### Community 4 - "scripts"
Cohesion: 0.08
Nodes (24): createWindow(), {dialog}, electron, {Menu}, path, author, description, devDependencies (+16 more)

### Community 5 - "whoiam.ts"
Cohesion: 0.18
Nodes (23): getOrCreateIdentity(), openIdentityModal(), renderIdentityModal(), Cert, connectMessage(), createLocalIdentity(), enc, finishSignIn() (+15 more)

### Community 6 - "🚀 Getting Started"
Cohesion: 0.09
Nodes (20): 1. Installation, 1. 🛡️ On-Device AI Moderation (Desert Ant Labs), 2. 🔒 Automated PII Redaction & Text Censorship, 2. Development Mode, 3. Contract Compilation & Testing, 3. ⏱️ Decentralized Anti-Flooding & Rate Limiting, 4. Build Production Web Application, 4. 🌐 Cryptographic Personas & Decentralized Storage (+12 more)

### Community 7 - "crypto.ts"
Cohesion: 0.13
Nodes (21): decryptDirectMessage(), decryptRoomKeyFromPeer(), decryptWithSymmetricKey(), enc, encryptDirectMessage(), encryptRoomKeyForPeer(), encryptWithSymmetricKey(), formatChatMessageSignatureMessage() (+13 more)

### Community 8 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @desert-ant-labs/moderator, @freenetorg/freenet-stdlib, @litertjs/core, @noble/curves, @noble/ed25519, @noble/hashes, devDependencies (+10 more)

### Community 9 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+4 more)

### Community 10 - "moderation.ts"
Cohesion: 0.33
Nodes (7): analyzeImageFile(), analyzeTextContent(), censorTextAndPII(), getModerator(), ImageModerationResult, TextCensorshipResult, TextModerationResult

### Community 11 - "Contributor Covenant Code of Conduct"
Cohesion: 0.25
Nodes (7): Attribution, Contributor Covenant Code of Conduct, Enforcement, Our Pledge, Our Responsibilities, Our Standards, Scope

### Community 12 - "resetPublishBtnState"
Cohesion: 0.50
Nodes (4): isPostInCooldown(), resetPublishBtnState(), setMediaVerifiedSafe(), startPostCooldown()

## Knowledge Gaps
- **253 isolated node(s):** `electron`, `path`, `{dialog}`, `name`, `version` (+248 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `UserIdentity` connect `FreenetClient` to `main.ts`, `crypto.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `FreenetClient` connect `FreenetClient` to `crypto.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `SafeStorage` connect `crypto.ts` to `main.ts`, `whoiam.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `electron`, `path`, `{dialog}` to the rest of the system?**
  _253 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.011627906976744186 - nodes in this community are weakly interconnected._
- **Should `FreenetClient` be split into smaller, more focused modules?**
  _Cohesion score 0.09462915601023018 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.11320754716981132 - nodes in this community are weakly interconnected._