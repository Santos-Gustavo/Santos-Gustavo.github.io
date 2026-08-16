const { test, expect } = require("@playwright/test");
const { failOnConsoleErrors } = require("./helpers");
const { login } = require("./app-helpers");

test.beforeEach(async ({ page }) => {
  failOnConsoleErrors(page);
});

test("user stays logged in after page refresh", async ({ page }) => {
  await login(page);

  await expect(page.locator("#projectList")).toBeVisible();

  await page.reload();

  await expect(page.locator("#projectList")).toBeVisible();
  await expect(page.locator("#stepLabel")).toHaveText(/obras/i);
});