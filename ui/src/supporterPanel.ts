// The identity page's supporter section: the badge, redeeming a donation proof or a receipt (and following the
// attester's answer), removing it, and the public supporters wall. main.ts calls initSupporterPanel once.
import { freenet } from "./freenet.ts";
import { safeStorage } from "./storage";
import {
  verifyReceipt,
  getStoredReceipt,
  saveStoredReceipt,
  clearStoredReceipt,
  isReceiptRemoved,
  unremoveReceipts,
  RECEIPT_ISSUERS,
  supporterBadge,
  foldSupporters,
  supporterStorageKey,
  type SupporterTier,
} from "./supporter.ts";

let whoAmI: () => string | null = () => null;
let displayName: (pubkey: string) => string = (pk) => pk;

/** Redraw the badge and the wall (before initSupporterPanel: nobody signed in, so the badge is hidden). */
export function renderSupporterStatus() {
  const badgeCard = document.getElementById("supporter-active-badge-card");
  const badgeLabel = document.getElementById("supporter-active-badge-label");
  const badgeDetails = document.getElementById("supporter-active-details");

  const pubkey = whoAmI();
  if (!pubkey) {
    if (badgeCard) badgeCard.style.display = "none";
    return;
  }

  const receipt = getStoredReceipt(pubkey);
  if (receipt && badgeCard && badgeLabel && badgeDetails) {
    const badge = supporterBadge(receipt);
    badgeCard.style.display = "block";
    badgeLabel.textContent = `${badge.icon} ${badge.label}`;
    badgeLabel.className = `identity-badge ${badge.badgeClass}`;
    badgeDetails.textContent = badge.description;
  } else if (badgeCard) {
    badgeCard.style.display = "none";
  }

  if (!receipt) void adoptAttestedReceipt();
  const toggle = document.getElementById("supporter-public-toggle") as HTMLInputElement | null;
  if (toggle) toggle.checked = !!freenet.supporterTokens().find((t) => t.author === pubkey)?.token;
  void renderSupporterWall();
}

/** Take a receipt the attester bot published for me, once it verifies against a trusted issuer. */
async function adoptAttestedReceipt(): Promise<boolean> {
  const me = whoAmI();
  if (!me || getStoredReceipt(me)) return false;
  for (const token of freenet.supporterReceiptsFor(me)) {
    if (isReceiptRemoved(token, me)) continue; // removed by the reader: not brought back
    try {
      await verifyReceipt(token, me);
      saveStoredReceipt(token, me);
      renderSupporterStatus();
      return true;
    } catch {} // signed by a key Radica does not trust: ignore
  }
  return false;
}

/** Watch the attester's answer to a proof sent at `since`: progress every check, then the badge or the reason it refused. */
function awaitAttestation(msg: HTMLElement, since: number) {
  const me = whoAmI()!; // a proof is only sent signed in
  let checks = 0;
  const stop = (text: string, color: string) => {
    clearInterval(timer);
    msg.textContent = text;
    msg.style.color = color;
  };
  const tick = async () => {
    checks++;
    await freenet.refreshLog("supporter-receipts", true).catch(() => {});
    if (getStoredReceipt(me) || (await adoptAttestedReceipt())) return stop("Donation verified! Supporter badge activated 🌱", "var(--primary)");
    // a minute of slack for clocks that differ between this device and the attester
    const no = freenet.supporterRejectionsFor(me, RECEIPT_ISSUERS).filter((r) => r.ts >= since - 60_000).at(-1);
    if (no) return stop(`The attester could not verify this proof: ${no.reason}.`, "var(--danger)");
    const sec = Math.round((Date.now() - since) / 1000);
    if (sec > 15 * 60) return stop("No answer from the attester after 15 minutes. Your proof stays published: the badge appears by itself once verified.", "var(--text-muted)");
    msg.textContent = `⏳ Proof sent. Waiting for the attester to check it on-chain… ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} elapsed, ${checks} check${checks > 1 ? "s" : ""}`;
  };
  const timer = setInterval(tick, 15_000);
  void tick();
}

async function renderSupporterWall() {
  const wall = document.getElementById("supporter-wall");
  if (!wall) return;
  await freenet.refreshLog("supporters");
  const byTier = await foldSupporters(freenet.supporterTokens());
  const rows = (["oak", "root", "sprout"] as SupporterTier[])
    .filter((t) => byTier[t].length)
    .map((t) => {
      const row = document.createElement("div");
      row.style.marginBottom = "4px";
      const icon = { oak: "🌳", root: "🌿", sprout: "🌱" }[t];
      row.textContent = `${icon} ${t[0].toUpperCase()}${t.slice(1)}: ${byTier[t].map(displayName).join(", ")}`;
      return row;
    });
  wall.replaceChildren(...rows);
  if (!rows.length) wall.textContent = "No public supporters yet. Be the first!";
}

/** Wire the section's buttons (once). */
export function initSupporterPanel(deps: {
  whoAmI: () => string | null;
  displayName: (pubkey: string) => string;
  openLink: (this: HTMLAnchorElement, e: Event) => void;
}): void {
  whoAmI = deps.whoAmI;
  displayName = deps.displayName;
  document.getElementById("supporter-public-toggle")?.addEventListener("change", async (e) => {
    const toggle = e.target as HTMLInputElement;
    const pubkey = whoAmI();
    const token = pubkey && safeStorage.getItem(supporterStorageKey(pubkey));
    if (!token) return;
    toggle.disabled = true;
    try {
      await freenet.setSupporterPublic(toggle.checked ? token : null);
      await renderSupporterWall();
    } catch (err) {
      toggle.checked = !toggle.checked;
      alert((err as Error).message || "Could not update the supporters wall.");
    } finally {
      toggle.disabled = false;
    }
  });

  document.getElementById("supporter-donate-link")?.addEventListener("click", deps.openLink); // inside Freenet's sandbox a plain link may not open

  document.getElementById("redeem-receipt-btn")?.addEventListener("click", async () => {
    const input = document.getElementById("redeem-receipt-input") as HTMLInputElement | null;
    const msg = document.getElementById("redeem-receipt-msg");
    const pubkey = whoAmI();
    if (!input || !msg || !pubkey) return;

    const token = input.value.trim();
    if (!token) {
      msg.textContent = "Please paste a receipt token.";
      msg.style.color = "var(--danger)";
      return;
    }

    if (token.startsWith("RADICA-ZK-V1:")) {
      try {
        await freenet.submitSupporterClaim(token);
        unremoveReceipts(pubkey); // a badge removed before comes back with its old receipt
        input.value = "";
        msg.style.color = "var(--text-muted)";
        awaitAttestation(msg, Date.now());
      } catch (err) {
        msg.textContent = (err as Error).message || "Could not publish the proof.";
        msg.style.color = "var(--danger)";
      }
      return;
    }

    try {
      msg.textContent = "Verifying receipt...";
      msg.style.color = "var(--text-muted)";
      const receipt = await verifyReceipt(token, pubkey);
      saveStoredReceipt(token, pubkey);
      input.value = "";
      msg.textContent = `Verified! Activated ${supporterBadge(receipt).label} 🌱`;
      msg.style.color = "var(--primary)";
      renderSupporterStatus();
    } catch (err) {
      msg.textContent = (err as Error).message || "Verification failed.";
      msg.style.color = "var(--danger)";
    }
  });

  document.getElementById("supporter-clear-btn")?.addEventListener("click", () => {
    const pubkey = whoAmI();
    if (pubkey && confirm("Remove this supporter receipt from this device?")) {
      clearStoredReceipt(pubkey, freenet.supporterReceiptsFor(pubkey));
      if (freenet.supporterTokens().find((t) => t.author === pubkey)?.token) void freenet.setSupporterPublic(null);
      renderSupporterStatus();
    }
  });
}
