const { test, expect } = require("@playwright/test");
const { failOnConsoleErrors } = require("../helpers");

test.beforeEach(async ({ page }) => {
  failOnConsoleErrors(page);
});

test("user can login and see project list", async ({ page }) => {
  await page.goto("/");

  await page.fill("#authEmail", process.env.E2E_EMAIL);
  await page.fill("#authPassword", process.env.E2E_PASSWORD);

  await page.getByRole("button", { name: /^entrar$/i }).click();

  await expect(page.locator("#projectList")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^obras$/i })).toBeVisible();
});