const { test, expect } = require("@playwright/test");
const { failOnConsoleErrors } = require("./helpers");
const { login } = require("./app-helpers");

test.beforeEach(async ({ page }) => {
  failOnConsoleErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
});

test("mobile user can login, open project list, and see main actions", async ({ page }) => {
  await login(page);

  await expect(page.locator("#projectList")).toBeVisible();

  await expect(
    page.getByRole("button", { name: /\+ nova obra/i })
  ).toBeVisible();

  const firstCard = page.locator(".project-card").first();

  await expect(firstCard).toBeVisible();

  await expect(
    firstCard.getByRole("button", { name: /editar/i })
  ).toBeVisible();

  await expect(
    firstCard.getByRole("button", { name: /apagar/i })
  ).toBeVisible();
});