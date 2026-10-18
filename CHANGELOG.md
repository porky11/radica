4.2.0 / 2026-10-18
==================

  * **NEW** 100% Offline Deterministic SVG Avatars: eliminates external CDN failures (Dicebear) in sandboxed Freenet environments.
  * **NEW** Custom Avatar Upload: on-device canvas resizing and center-square cropping to 80x80 JPEG (~2 KB).
  * **NEW** Moments Photo Auto-Compression: downscales raw camera photos client-side to 360px JPEG (~2.5-3.8 KB).
  * **FIX** Hardened SafeStorage Persistence: strictly enforces 7,500-char budget to prevent Freenet parent shell's 8,192-char slice on `Ctrl+F5` hard reloads.
  * **NEW** Resilient feed trimming preserves recent posts and media across opaque-origin browser refreshes.

4.1.0 / 2026-10-18
==================

  * **NEW** End-to-End Encrypted Private Chatrooms: multi-user AES-256-GCM symmetric room keys with X25519 ECDH key distribution.
  * **NEW** Zero-Knowledge Private Room Invites: capability fragments (`#join_room=...`) for instant invite links.
  * **NEW** Private room and chat peer persistence across Freenet sandboxed iframe reloads.

4.0.0 / 2026-10-18
==================

  * **ARCHITECTURAL REWRITE**: complete migration to Freenet decentralized P2P social network.
  * Replaced legacy Express/MongoDB with Freenet WebAssembly state contracts (Rust `radica_contract.wasm`).
  * On-device AI image moderation via Desert Ant Labs (`@desert-ant-labs/moderator` running on LiteRT.js/WASM).
  * Automated PII redaction and text censorship for Credit Cards, IBANs, Tax IDs, and profanity.
  * Anti-flooding sliding-window rate limiting engine with 15-second cooldown timers.
  * Decentralized Communities (`r/slug`) with cryptographic moderator hierarchy.
  * Passwordless Ed25519 cryptographic personas and Viso / Whoiam single sign-on integration.

3.0.0 / 2019-06-27
==================

  * New features and some bug fixes
  * **NEW** One-One chat between users, Real-time notifications, User profile edit page.
  * More advance search and fast-communication using web-sockets.
  * Re-written for better code quality.
  * Both Instagram and Google OAuth working.
  * NEW Releases for MAC, Windows, Linux and Android devices.
  * Demo website changed to https://spruce.dancodes.online.
  * MongoDB host to be declared as env variable when not using on localhost. 
    `dbHost=host.com node ./bin/www`
  * A brand new developer API for officially accessing spruce from within.
  * Code of Conduct adopted.
  * Ownership transfered to the Dan-Divy Organisation [@dan-divy](https://github.com/dan-divy).
  * Sponsors and Backers are most welcome to support this growing project.  

2.0.2 / 2019-03-27
==================

  * Updated [README.md](README.md).
  * Added the basic api structure for likes and comments.
  * New AUTHORS file added.
  * View a post from its category.
  * **NEW** An electron.js file has been added for creating a desktop appilication. See ```release/spruce-linux-ia32``` for 32bit linux computers.

  Note: _Instagram OAuth2 is still disabled._

2.0.1 / 2019-03-22
==================

  * Disabled instagram oauth-2 api temporarily.
  * Added a README.md.
  * Users can tag a post as thought/events/moments.
  * Added a new search upload for uploading thoughts (text).

2.0.0 / 2019-03-20
==================

  * Add instgram oauth-2 api with the local authentication.
  * Added new upload and view feature.
