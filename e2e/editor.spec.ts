import { expect, test } from "@playwright/test";

test("opens an existing resume in the editor workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("TexCV");
  await expect(page.getByRole("button", { name: /CorgiResume/ })).toBeVisible();
  await expect(page.getByLabel("Editing CorgiResume")).toBeVisible();
  await expect(page.getByLabel("PDF preview")).toBeVisible();
  await expect(page.getByText("US LETTER")).toBeVisible();
});

test("collapses and restores the file explorer with the keyboard shortcut", async ({ page }) => {
  await page.goto("/");
  const explorer = page.getByLabel("File explorer");
  await expect(explorer).toBeVisible();
  const expandedWidth = await explorer.evaluate((element) => element.getBoundingClientRect().width);
  await page.keyboard.press("Meta+b");
  await expect.poll(() => explorer.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(expandedWidth);
  await page.keyboard.press("Meta+b");
  await expect.poll(() => explorer.evaluate((element) => element.getBoundingClientRect().width)).toBe(expandedWidth);
});
