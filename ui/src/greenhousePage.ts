// The Greenhouse page: plant a seed (an idea or a bug), vote on the open ones, and (the maintainer) mark what became of
// them. Only supporters plant and vote; anyone can read. main.ts calls initGreenhouse once.
import { freenet } from "./freenet.ts";
import { safeStorage } from "./storage";
import { escapeHtml } from "./html.ts";
import { renderChatText } from "./caption.ts";
import { verifyReceipt, supporterStorageKey, type SupporterTier } from "./supporter.ts";
import { foldGreenhouse, greenhouseTokens, SEED_DAYS, SEED_STATUSES, TIER_WEIGHT, type Seed } from "./greenhouse.ts";
import { RADICA_MAINTAINER } from "./types.ts";

let whoAmI: () => string | null = () => null;
let displayName: (pubkey: string) => string = (pk) => pk.slice(0, 8);
const verified = new Map<string, SupporterTier | null>(); // `${author}|${token}` -> tier, or null when it does not verify

const myToken = (): string | null => {
  const me = whoAmI();
  return me ? safeStorage.getItem(supporterStorageKey(me)) : null;
};

async function tiers(): Promise<(author: string) => SupporterTier | undefined> {
  const tokens = greenhouseTokens(freenet.greenhouseEntries());
  const me = whoAmI();
  const mine = myToken();
  if (me && mine) tokens.set(me, mine); // my own receipt counts here before my first entry carries it
  await Promise.all(
    [...tokens].map(async ([author, token]) => {
      const k = `${author}|${token}`;
      if (!verified.has(k)) verified.set(k, await verifyReceipt(token, author).then((r) => r.tier, () => null));
    })
  );
  return (author) => {
    const t = tokens.get(author);
    return (t && verified.get(`${author}|${t}`)) || undefined;
  };
}

const left = (ms: number) => {
  const h = Math.ceil(ms / 3_600_000);
  return h > 48 ? `${Math.ceil(h / 24)} days left` : `${h} h left`;
};

function seedHtml(s: Seed, canVote: boolean, isMaintainer: boolean): string {
  const open = s.closes > Date.now();
  const outcome = open ? left(s.closes - Date.now()) : s.up > s.down ? "🌱 Sprouted" : "🥀 Withered";
  const vote = (v: 1 | -1, label: string, title: string) =>
    `<button type="button" class="btn-secondary btn-xs${s.mine === v ? " active" : ""}" data-gh-vote="${v}" data-gh-seed="${escapeHtml(s.id)}" title="${title}" ${canVote && open ? "" : "disabled"}>${label}</button>`;
  const status = isMaintainer
    ? `<select class="gh-status" data-gh-seed="${escapeHtml(s.id)}" aria-label="Status"><option value="">No status</option>${Object.entries(SEED_STATUSES)
        .map(([k, l]) => `<option value="${k}"${s.status === k ? " selected" : ""}>${l}</option>`)
        .join("")}</select>`
    : s.status
      ? `<span class="identity-badge">${SEED_STATUSES[s.status]}</span>`
      : "";
  return `<div class="gh-seed${open ? "" : " closed"}">
    <div class="gh-seed-head"><span class="identity-badge">${s.kind === "bug" ? "🐛 Bug" : "💡 Feature"}</span><strong>${escapeHtml(s.title)}</strong></div>
    ${s.text ? `<div class="gh-seed-text">${renderChatText(s.text, displayName)}</div>` : ""}
    <div class="gh-seed-meta">by <span class="author-clickable" data-author="${escapeHtml(s.author)}">${escapeHtml(displayName(s.author))}</span> · ${outcome} · ${s.voters} ${s.voters === 1 ? "voter" : "voters"} ${status}</div>
    <div class="gh-seed-votes">${vote(1, `▲ ${s.up}`, s.kind === "bug" ? "Me too" : "I want this")}${s.kind === "feature" ? vote(-1, `▼ ${s.down}`, "I don't want this") : ""}</div>
  </div>`;
}

/** Redraw the page from the log as it is here (a refresh from the network redraws it again when it lands). */
export async function renderGreenhouse(): Promise<void> {
  const list = document.getElementById("greenhouse-list");
  if (!list) return;
  const me = whoAmI() ?? "";
  const tierOf = await tiers();
  const canVote = !!tierOf(me);
  const form = document.getElementById("greenhouse-form") as HTMLFormElement | null;
  const gate = document.getElementById("greenhouse-gate");
  if (form) form.style.display = canVote ? "flex" : "none";
  if (gate) gate.style.display = canVote ? "none" : "";
  const seeds = foldGreenhouse(freenet.greenhouseEntries(), tierOf, me, RADICA_MAINTAINER);
  list.innerHTML = seeds.length ? seeds.map((s) => seedHtml(s, canVote, me === RADICA_MAINTAINER)).join("") : `<p style="color: var(--text-muted); font-size: 0.85rem;">Nothing planted yet.</p>`;
}

async function append(body: object): Promise<void> {
  const token = myToken();
  if (!token) return;
  await freenet.greenhouseAppend({ ...body, receipt: token });
  await renderGreenhouse();
}

export function initGreenhouse(deps: { whoAmI: () => string | null; displayName: (pubkey: string) => string }): void {
  whoAmI = deps.whoAmI;
  displayName = deps.displayName;
  const days = document.getElementById("greenhouse-days") as HTMLSelectElement | null;
  if (days) days.innerHTML = SEED_DAYS.map((d) => `<option value="${d}"${d === 14 ? " selected" : ""}>${d} days</option>`).join("");
  const weights = document.getElementById("greenhouse-weights");
  if (weights) weights.textContent = `Votes weigh by supporter tier: 🌱 Sprout ${TIER_WEIGHT.sprout}, 🌿 Root ${TIER_WEIGHT.root}, 🌳 Oak ${TIER_WEIGHT.oak}.`;

  const form = document.getElementById("greenhouse-form") as HTMLFormElement | null;
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return;
    const btn = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (btn) btn.disabled = true;
    try {
      await append({ type: "seed", kind: fd.get("kind") === "bug" ? "bug" : "feature", title, text: String(fd.get("text") ?? "").trim(), days: Number(fd.get("days")) });
      form.reset();
      if (days) days.value = "14";
    } catch (err) {
      alert(`Could not plant it: ${(err as Error).message || err}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  const list = document.getElementById("greenhouse-list");
  list?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-gh-vote]");
    if (!btn) return;
    const v = Number(btn.dataset.ghVote);
    // pressing my current vote again takes it back
    void append({ type: "vote", seed: btn.dataset.ghSeed, v: btn.classList.contains("active") ? 0 : v }).catch((err) => alert(`Could not vote: ${err.message || err}`));
  });
  list?.addEventListener("change", (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>(".gh-status");
    if (sel) void freenet.greenhouseAppend({ type: "status", seed: sel.dataset.ghSeed, status: sel.value || null }).then(renderGreenhouse);
  });
}

/** Open the page: draw what is here, then what the network has. */
export async function openGreenhouse(): Promise<void> {
  await renderGreenhouse();
  await freenet.refreshLog("greenhouse").catch(() => {});
  await renderGreenhouse();
}
