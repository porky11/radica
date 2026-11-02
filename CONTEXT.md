# Radica — domain language

Terms the code and its reviews use. Keep them exact.

## Chat

- **Conversation** — one chat as the user sees it, named by its room id: a direct message (`<pk>:<pk>`, the two public keys sorted), a Secret Chat (`secret_…`), a private room or channel (`priv_…`, `privroom_…`, River), or a community chat (`comm_…`).
- **Conversation state** — the module that answers, for a conversation, everything that is not the message text: when each message burns, how far each side has read, who is typing, the TTL in force. Both chat views (Messenger and Classic) read it; neither keeps its own copy.
- **Read mark** — how far *I* have read a conversation (a timestamp). Drives unread counts. A conversation seen for the first time gets a read mark of "now", so its history does not count as unread.
- **Peer read mark** — how far *the other person* in a direct message or Secret Chat has read. Drives the ✓✓ "read" checks.
- **Secret Chat** — a one-to-one conversation encrypted with per-message ratchet keys, stored only on this device.
- **TTL** — the disappearing-message timer of a Secret Chat, chosen from fixed presets (Off, 10s … 24h).
- **Burn** — destroying a message whose TTL has run out: removed from local storage and announced to the peer. A message burns when its time comes, whether or not its conversation is open.

## Decisions

- Both chat views stay (Messenger and Classic, 2026-11): shared chat behaviour lives in Conversation state, not in either view.
