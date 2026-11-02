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
