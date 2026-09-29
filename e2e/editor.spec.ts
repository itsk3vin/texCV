import { expect, test } from "@playwright/test";

test("opens an existing resume in the editor workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("TexCV");
  await expect(page.getByRole("button", { name: "CorgiResume", exact: true })).toBeVisible();
  await expect(page.getByLabel("Resume form")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Work Experience" })).toBeVisible();
  const experience = page.getByRole("button", { name: /Founder & Software Engineer/ });
  await expect(experience).toHaveAttribute("aria-expanded", "false");
  await experience.click();
  await expect(experience).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("PDF preview")).toBeVisible();
  await expect(page.getByText("US LETTER")).toBeVisible();
});

test("edits resume fields and preserves them across editor modes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /DePaul University/ }).click();
  const school = page.getByPlaceholder("DePaul University").first();
  await school.fill("Lakeview University");
  await page.getByRole("button", { name: "LaTeX", exact: true }).click();
  await expect(page.getByLabel("Editing CorgiResume")).toBeVisible();
  await page.getByRole("button", { name: "Form", exact: true }).click();
  await page.getByRole("button", { name: /Lakeview University/ }).click();
  await expect(page.getByPlaceholder("DePaul University").first()).toHaveValue("Lakeview University");
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
