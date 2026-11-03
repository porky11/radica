import { test, expect, type Page } from "@playwright/test";

const chat = (p: Page) => p.locator("#chat-modal");

/** A fresh identity made on the page, so the app leaves the sign-in screen. */
async function signIn(page: Page) {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Create New Keypair" }).click();
  await expect(page.locator("#identity-modal")).toBeHidden();
}

test("signing in with a new key leaves the identity page", async ({ page }) => {
  await signIn(page);
  await expect(page.locator("#post-caption")).toBeVisible();
});

test("chat opens in the page, not full screen, and Escape closes it", async ({ page }) => {
  await signIn(page);
  await page.click("#open-chat-btn");
  await expect(chat(page)).toBeVisible();
  await expect(chat(page)).not.toHaveClass(/\bfullscreen\b/);
  await page.keyboard.press("Escape");
  await expect(chat(page)).toBeHidden();
});

test("Escape leaves full screen first, then closes the chat", async ({ page }) => {
  await signIn(page);
  await page.click("#open-chat-btn");
  await page.locator("#chat-fullscreen-btn").evaluate((b: HTMLElement) => b.click()); // its button may be hidden in the messenger layout
  await expect(chat(page)).toHaveClass(/\bfullscreen\b/);
  await page.keyboard.press("Escape");
  await expect(chat(page)).toBeVisible();
  await expect(chat(page)).not.toHaveClass(/\bfullscreen\b/);
  await page.keyboard.press("Escape");
  await expect(chat(page)).toBeHidden();
});

test("the moment composer accepts videos", async ({ page }) => {
  await signIn(page);
  await expect(page.locator("#post-file-picker")).toHaveAttribute("accept", /video\/\*/);
});

test("a thought is planted in the feed", async ({ page }) => {
  await signIn(page);
  const text = `e2e thought ${Math.random().toString(36).slice(2, 8).replace(/\d/g, "x")}`; // no long digit runs: the composer masks them as card numbers
  await page.fill("#post-caption", text);
  await page.getByRole("button", { name: "Plant post" }).click();
  await expect(page.locator(".gram-card", { hasText: text }).first()).toBeVisible({ timeout: 30_000 });
});

test("the supporter panel answers a bad receipt", async ({ page }) => {
  await signIn(page);
  await page.click("#open-identity-btn");
  await page.fill("#redeem-receipt-input", "RADICA-RECEIPT-V1:not-a-receipt");
  await page.click("#redeem-receipt-btn");
  await expect(page.locator("#redeem-receipt-msg")).not.toHaveText(/^(|Verifying receipt\.\.\.)$/);
  await expect(page.locator("#supporter-active-badge-card")).toBeHidden();
});

test("my post can be edited, and Cancel leaves it as it was", async ({ page }) => {
  await signIn(page);
  const tag = Math.random().toString(36).slice(2, 8).replace(/\d/g, "x");
  await page.fill("#post-caption", `before ${tag}`);
  await page.getByRole("button", { name: "Plant post" }).click();
  const first = page.locator(".gram-card", { hasText: `before ${tag}` }).first();
  await expect(first).toBeVisible({ timeout: 30_000 });
  const card = page.locator(`#${await first.getAttribute("id")}`); // by id: while editing, the text is in a textarea

  await card.locator(".edit-post-btn").click();
  await card.locator(".edit-post-input").fill("discarded");
  await card.locator(".edit-post-cancel").click();
  await expect(card.locator(".edit-post-input")).toHaveCount(0);
  await expect(card.locator(".gram-caption")).toHaveText(`before ${tag}`);

  await card.locator(".edit-post-btn").click();
  await card.locator(".edit-post-input").fill(`after ${tag}`);
  await card.locator(".edit-post-save").click();
  await expect(card.locator(".gram-caption")).toHaveText(`after ${tag}`);
  await expect(card.locator(".gram-edited")).toBeVisible();
  await expect(page.locator(".gram-card", { hasText: `before ${tag}` })).toHaveCount(0);
});

test("the guide opens from the rail and Escape closes it", async ({ page }) => {
  await signIn(page);
  await page.click("#guide-open-btn");
  await expect(page.locator("#guide-modal")).toBeVisible();
  await page.getByText("🚫 Hide, block and report").click();
  await expect(page.getByText("goes on your public blocklist")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#guide-modal")).toBeHidden();
});

test("a post in another language offers Translate", async ({ page }) => {
  await signIn(page);
  const tag = Math.random().toString(36).slice(2, 8).replace(/\d/g, "x");
  await page.fill("#post-caption", `Oggi non sono uscito perché pioveva anche questo pomeriggio ${tag}`);
  await page.getByRole("button", { name: "Plant post" }).click();
  const card = page.locator(".gram-card", { hasText: tag }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.locator(".translate-btn")).toHaveText("Translate from Italiano");
});

test("a post in my language offers no Translate", async ({ page }) => {
  await signIn(page); // a new identity per post: newcomers wait 15 s between posts
  const tag = Math.random().toString(36).slice(2, 8).replace(/\d/g, "x");
  await page.fill("#post-caption", `The weather is nice and you should come with us ${tag}`);
  await page.getByRole("button", { name: "Plant post" }).click();
  const mine = page.locator(".gram-card", { hasText: tag }).first();
  await expect(mine).toBeVisible({ timeout: 30_000 });
  await expect(mine.locator(".translate-btn")).toHaveCount(0);
});

test("a saved post shows under Saved, and unsaving removes it", async ({ page }) => {
  await signIn(page);
  const tag = Math.random().toString(36).slice(2, 8).replace(/\d/g, "x");
  await page.fill("#post-caption", `keep this ${tag}`);
  await page.getByRole("button", { name: "Plant post" }).click();
  const card = page.locator(".gram-card", { hasText: tag }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.locator(".save-post-btn").click();
  await expect(card.locator(".save-post-btn")).toHaveAttribute("aria-pressed", "true");
  await page.click("#scope-saved-btn");
  await expect(page.locator("#scope-saved-count")).toHaveText("1");
  const saved = page.locator(".gram-card", { hasText: tag }).first();
  await expect(saved).toBeVisible();
  await saved.locator(".save-post-btn").click();
  await expect(page.locator(".gram-card", { hasText: tag })).toHaveCount(0);
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
});
