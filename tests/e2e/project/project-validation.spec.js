const { test, expect } = require("@playwright/test");
const { failOnConsoleErrors } = require("../helpers");
const { login } = require("../helpers/app-helpers");

test.beforeEach(async ({ page }) => {
  failOnConsoleErrors(page);
});

test("cannot create project without required company and project fields", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: /\+ nova obra/i }).click();

  await expect(page.locator("#companyName")).toBeVisible();

  // Try to continue without company name
  await page.getByRole("button", { name: /seguinte/i }).click();

  // Should stay on company step
  await expect(page.locator("#companyName")).toBeVisible();

  // Fill company data
  const unique = Date.now();

  await page.fill("#companyName", `Validation Empresa ${unique}`);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#projectName")).toBeVisible();

  // Try to continue without project/client fields
  await page.getByRole("button", { name: /seguinte/i }).click();

  // Should stay on project step
  await expect(page.locator("#projectName")).toBeVisible();
});