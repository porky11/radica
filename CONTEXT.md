# Radica — domain language

Terms the code and its reviews use. Keep them exact.

## Chat

- **Conversation** — one chat as the user sees it, named by its room id: a direct message (`<pk>:<pk>`, the two public keys sorted), a Secret Chat (`secret_…`), a private room or channel (`priv_…`, `privroom_…`, River), or a community chat (`comm_…`).
- **Conversation state** — the module that answers, for a conversation, everything that is not the message text: when each message burns, how far each side has read, who is typing, the TTL in force. Both chat views (Messenger and Classic) read it; neither keeps its own copy.
- **Read mark** — how far *I* have read a conversation (a timestamp): the later of this device's mark and the one my other devices left in my inbox log. Unread = messages from others after it. A conversation never read counts from its start if it is a direct message or Secret Chat (someone wrote to me), and counts nothing if it is a room or community (its history is not news; joining one gives it a read mark of "now"). Kept by Conversation state.
- **Peer read mark** — how far *the other person* in a direct message or Secret Chat has read. Drives the ✓✓ "read" checks.
- **Secret Chat** — a one-to-one conversation encrypted with per-message ratchet keys, stored only on this device.
- **TTL** — the disappearing-message timer of a Secret Chat, chosen from fixed presets (Off, 10s … 24h).
- **Burn** — destroying a message whose TTL has run out: removed from local storage and announced to the peer. A message burns when its time comes, whether or not its conversation is open.

## Device storage

- **Page storage** — `safeStorage`: the page's own key/value store. In Freenet's sandboxed shell it lives in memory, plus the URL hash, and a browser refresh keeps only the hash.
- **Durable key** — a page-storage key that must outlive a browser refresh. Declared once by prefix in `durable.ts` (`DURABLE_PREFIXES`); every write is copied to the node's delegate in one package per persona (`durable:<persona>`), and at sign-in the package fills in what the page lost.
- **Identity keys** — the local seed, the Viso session and the read keys. Needed before we know who is signing in, so they are kept on the node by their own code, outside the durable package.

## Decisions

- Both chat views stay (Messenger and Classic, 2026-11): shared chat behaviour lives in Conversation state, not in either view.
- Durable keys travel in one package per persona, not one node entry per key (2026-11): the delegate cannot list its keys, and one read at sign-in is enough. On restore the page wins when it already holds a key; the node only fills in what is missing.
