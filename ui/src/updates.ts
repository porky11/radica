// Newest first. Add an entry here with every user-visible release.
export const UPDATES: { date: string; text: string }[] = [
  { date: "2026-10-24", text: "The build now downloads and checks the image-scan model itself (npm run build), so it is served with the app inside Freenet." },
  { date: "2026-10-24", text: "Your profile card shows how much your published posts weigh; past 16 MB, \"Free space\" deletes your oldest posts (after asking)." },
  { date: "2026-10-24", text: "The feed loads 20 posts at a time (scroll to the end or press Show more), and pictures load as you reach them." },
  { date: "2026-10-24", text: "New Moment photos are kept sharper (up to 1024 px) and open full size when you click them." },
  { date: "2026-10-24", text: "Image scan can now run fully inside the Freenet gateway: the LiteRT runtime ships with the app (add moderator.tflite to ui/public/moderation/model/)." },
  { date: "2026-10-24", text: "Unread chat badges now follow you to a new login or device." },
  { date: "2026-10-24", text: "Chat sidebar shows a red badge with the number of unread messages on each conversation." },
  { date: "2026-10-24", text: "Blocklists screen: see the lists you trust, add one by public key, and edit your own." },
  { date: "2026-10-24", text: "\"Mark all read\" now sticks after logging in again or on another device." },
  { date: "2026-10-24", text: "Shared blocklists: add a user to your public blocklist, or trust someone else's to hide the authors they block. Images are no longer published when the on-device scan cannot run." },
  { date: "2026-10-24", text: "Comments are now ordered oldest-first; long room lists in Chat scroll instead of stretching the sidebar." },
  { date: "2026-10-23", text: "Hide a user's posts on this device. Links are no longer mangled by the phone-number censor." },
];
