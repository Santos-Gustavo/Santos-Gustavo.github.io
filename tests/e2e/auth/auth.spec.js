const { test, expect } = require("@playwright/test");
const { failOnConsoleErrors } = require("../helpers");

test.beforeEach(async ({ page }) => {
  failOnConsoleErrors(page);
});

test("app loads login screen", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /entrar/i })).toBeVisible();
  await expect(page.locator("#authEmail")).toBeVisible();
  await expect(page.locator("#authPassword")).toBeVisible();
});