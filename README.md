# Radica (Freenet Edition) 🌱

[![Freenet](https://img.shields.io/badge/Network-Freenet-22c55e.svg)](https://freenet.org)
[![Live on Freenet](https://img.shields.io/badge/Freenet%20dApp-Ex88TLL48HQ...-blueviolet.svg)](http://127.0.0.1:7509/v1/contract/web/Ex88TLL48HQPA6CuYQuhc2zKFjcEdUeHbreNBrfVL2Sw/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Contract](https://img.shields.io/badge/Contract-Rust%20%7C%20WASM-orange.svg)](contract/)
[![AI Moderation](https://img.shields.io/badge/AI%20Moderation-Desert%20Ant%20Labs-6366f1.svg)](https://desertant.com)

Radica (Freenet Edition) is a **100% decentralized, serverless, and peer-to-peer social media platform** built on **[Freenet](https://freenet.org)**.

> 🌐 **Permanent Freenet Web App Address:**  
> `http://127.0.0.1:7509/v1/contract/web/Ex88TLL48HQPA6CuYQuhc2zKFjcEdUeHbreNBrfVL2Sw/`

This repository is an architectural rewrite. The legacy Node.js/Express and MongoDB backend has been entirely replaced with cryptographically verifiable **WebAssembly state contracts**, **Ed25519 client-side cryptography**, **on-device AI image moderation via Desert Ant Labs**, and an **anti-flooding engine**.

---

## 🌟 Key Features

### 1. 🛡️ On-Device AI Moderation (Desert Ant Labs)
- **Zero-Tolerance Visual Moderation**: Integrated [`@desert-ant-labs/moderator`](https://desertant.com/models/moderator/) running WebAssembly and [LiteRT.js](https://www.npmjs.com/package/@litertjs/core) directly in the client.
- **Client-Side Blocking**: Evaluates images on-device before upload. Any media detected as adult, sensitive, or explicit is immediately blocked from publication (`Publishing Prohibited`).
- **No Cloud Telemetry or Leakage**: Image scanning executes entirely in the user's browser sandbox, protecting user privacy.

### 2. 🔒 Automated PII Redaction & Text Censorship
- **Automatic Sensitive Data Masking**: Post captions, comments, and chat messages are scanned on-device for Personally Identifiable Information (PII) and automatically redacted before publishing:
  - 💳 Credit Card numbers ➔ `[💳 CARD DATA REDACTED]`
  - 🏦 European & Italian IBANs ➔ `[🏦 IBAN REDACTED]`
  - 🪪 Tax IDs & Codici Fiscali ➔ `[🪪 TAX ID REDACTED]`
  - 📧 Email addresses ➔ `[📧 EMAIL REDACTED]`
  - 📱 Phone numbers ➔ `[📱 PHONE NUMBER REDACTED]`
- **Profanity & Hate Speech Filtering**: Inappropriate language, insults, and hate speech (Italian and English) are masked with asterisks (`*****`).
- **Transparent User Feedback**: Users are notified with an informative alert detailing which categories of sensitive data or language were redacted prior to publishing.

### 3. ⏱️ Decentralized Anti-Flooding & Rate Limiting
- **15-Second Post Cooldown**: Enforces a minimum interval between posts with an active, real-time button countdown (`⏳ Cooldown (15s)`).
- **Sliding-Window Rate Limit**: Prevents automated scripts from flooding the network by limiting publication to a maximum of **3 posts per 60-second window**.
- **Duplicate Post Detection**: Normalized duplicate checking prevents posting the exact same content repeatedly.
- **Comment & Chat Throttling**: 4-second cooldown between comments and 2-second cooldown between chat messages to ensure timeline and room readability.

### 4. 🌐 Cryptographic Personas & Decentralized Storage
- **Passwordless Identity**: Personas are derived client-side using Ed25519 keypairs. Public keys serve as unique addresses (`@pubkey...`).
- **Cryptographically Signed State**: Every post, like, comment, and community interaction is signed by the author's private key.
- **Join-Semilattice WASM Contract**: The Rust smart contract (`radica_contract.wasm`) guarantees idempotent delta merges, conflict resolution, and deterministic state convergence across all Freenet peers.

### 5. 🏛️ Decentralized Communities (`r/slug`)
- **Permissionless Community Creation**: Any persona can establish a community and automatically becomes its **Founder & Root Moderator**.
- **Moderator Hierarchy**: Founders can promote members to moderators and demote them. Root founders cannot be demoted.
- **Content Moderation Actions**: Community moderators have cryptographic authority to remove posts from their community feeds.

### 6. 💬 P2P Direct Chat & Interactive Feeds
- **Private & Community Chat**: Deterministic room address derivation for 1-on-1 private messaging and community chatrooms.
- **End-to-End Encrypted Private Rooms**: Symmetric room keys (AES-256-GCM) encrypted for each member via X25519 ECDH, shareable via zero-knowledge invite fragment links (`#join_room=...`).
- **Interactive `#Hashtags` & Live Search**: Automatic hashtag tokenization, live keyword filtering, and category sorting (Thoughts, Moments, Events).
- **Dual Runtime**: Runs as a progressive Web App via Vite or as an Electron desktop application.

### 7. 🎨 Offline SVG Identicons & Custom Avatar Upload
- **100% Offline Deterministic Avatars**: Generates vibrant, unique SVG identicons derived mathematically from each persona's Ed25519 public key. Eliminates external CDN dependencies (e.g. Dicebear) that fail in air-gapped or sandboxed Freenet environments.
- **Client-Side Image Upload & Compression**: Upload profile photos directly from local device. Automatically center-cropped and compressed via HTML5 Canvas to 80x80 JPEG (~2 KB) to fit within decentralized state limits.
- **Aspect-Ratio Protected UI**: Strict 1:1 circular display rules preventing image distortion or oval stretching.

### 8. 📸 Moments Compression & Sandboxed Persistence Engine
- **Automatic High-Res Downscaling**: Uploaded Moment photos are automatically compressed client-side (max 360px, JPEG quality 0.58), transforming 5-10 MB camera files into lightweight ~2.5-3.8 KB payloads.
- **Freenet Shell Hash Persistence (`SafeStorage`)**: Survives sandboxed opaque-origin reloads where browser `localStorage` throws `SecurityError`. Syncs encrypted state to parent shell hash strictly under Freenet's 8,192-char truncation limit.
- **Resilient Feed Trimming**: Keeps identity, profile, and recent posts/Moments fully persistent across `F5` and `Ctrl+F5` hard reloads without state corruption.

---

## 🏗️ Architecture

```
d:\spruce\
├── contract/                    # Freenet WASM State Contract (Rust)
│   ├── Cargo.toml               # freenet-stdlib 0.8, ed25519-dalek, blake3
│   └── src/
│       └── lib.rs               # FeedState, idempotence, delta computation & unit tests
├── ui/                          # Client-Side Application (Vite + TypeScript)
│   ├── src/
│   │   ├── crypto.ts            # Ed25519 signatures, X25519 ECDH + AES-256-GCM E2EE
│   │   ├── avatar.ts            # Deterministic SVG identicons & client-side Canvas compression
│   │   ├── storage.ts           # SafeStorage parent shell hash sync & persistence engine
│   │   ├── whoiam.ts            # Viso / Whoiam decentralized SSO identity bridge
│   │   ├── moderation.ts        # Desert Ant Labs WASM loader & text/PII censorship
│   │   ├── freenet.ts           # Freenet client, P2P broadcast channel & room key cache
│   │   ├── types.ts             # Contract state & delta interface declarations
│   │   ├── icons.ts             # SVG icon definitions & helpers
│   │   ├── style.css            # Dark mode, glassmorphism & responsive typography
│   │   └── main.ts              # Timeline, anti-flood controller & community management
│   ├── vite.config.ts           # Vite config with WASM support and dev peer sync
│   └── package.json
├── electron.js                  # Desktop container loading local UI bundle
└── package.json                 # Monorepo development scripts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18+ (tested on Node v20/v22/v26)
- **Rust toolchain** with `wasm32-unknown-unknown` target:
  ```bash
  rustup target add wasm32-unknown-unknown
  ```

---

### 1. Installation

Clone the repository and install root and UI dependencies:

```bash
git clone https://github.com/scobru/radica.git
cd radica
npm install
npm --prefix ui install
```

---

### 2. Development Mode

Start the Vite development server:

```bash
npm run dev
```

Open your browser at `http://localhost:5173`. The development server includes a built-in multi-client WebSocket peer relay, allowing you to test real-time interactions across regular and incognito tabs simultaneously.

---

### 3. Contract Compilation & Testing

Execute the contract unit tests (validates idempotent delta merges and cryptographic signatures):

```bash
npm run test:contract
```

Compile the contract to WebAssembly release:

```bash
npm run build:contract
```

The compiled WASM artifact is generated at:
`contract/target/wasm32-unknown-unknown/release/radica_contract.wasm`

---

### 4. Build Production Web Application

Compile TypeScript and build the optimized production web assets:

```bash
npm run build:ui
```

---

### 5. Publish to Freenet

Needs [`fdev`](https://github.com/freenet/freenet-core) and a running node. The first time, create the signing key (its name decides the app address): `fdev website init radica`.

```bash
npm run radica:build     # production build in ui/dist
npm run radica:publish   # build + publish as a new website (first time)
npm run radica:update    # build + publish a new version at the same address
```

Use another key name with `RADICA_KEY=other npm run radica:update`.

---

### 6. Launch Desktop App (Electron)

Launch Radica as a native desktop application:

```bash
npm run app
```

---

## 🔒 Security & Privacy Model

- **No Remote Telemetry**: Zero external tracking, analytics, or third-party cookies.
- **On-Device Artificial Intelligence**: Visual content moderation and text redaction execute entirely on the user's hardware via WebAssembly.
- **Cryptographic Non-Repudiation**: State transitions require valid Ed25519 signatures corresponding to the author's public key.
- **Sybil & Flood Mitigation**: Cooldown timers, sliding-window limits, and duplicate checking prevent client-side network spam.

---

## 📜 Origin & Acknowledgments

- **Upstream Repository**: [dan-divy/spruce](https://github.com/dan-divy/spruce)
- **Author & Maintainer**: [Francesco Bruno (scobru)](https://github.com/scobru/radica)
- **Decentralized Network**: [Freenet Project](https://freenet.org)
- **Decentralized Identity Provider**: [Viso (scobru/viso)](https://github.com/scobru/viso) (Freenet persona delegation & cryptographic sign-in)
- **Freenet dApp Architecture**: [Freenet River](https://github.com/freenet/river) (WASM state contract patterns & P2P sync reference)
- **On-Device AI Engine**: [Desert Ant Labs](https://desertant.com)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
