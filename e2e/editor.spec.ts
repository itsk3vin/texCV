import { expect, test } from "@playwright/test";

test("opens an existing resume in the editor workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("TexCV");
  await expect(page.getByRole("button", { name: "resume.tex" })).toBeVisible();
  await expect(page.getByLabel("Editing resume.tex")).toBeVisible();
  await expect(page.getByLabel("PDF preview")).toBeVisible();
  await expect(page.getByText("US LETTER")).toBeVisible();
});

test("collapses and restores the file explorer", async ({ page }) => {
  await page.goto("/");
  const explorer = page.getByLabel("File explorer");
  await expect(explorer).toBeVisible();
  await page.getByLabel("Toggle explorer").click();
  await expect(explorer).not.toBeVisible();
  await page.getByLabel("Toggle explorer").click();
  await expect(explorer).toBeVisible();
});
