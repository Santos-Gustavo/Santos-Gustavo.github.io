const { test, expect } = require("@playwright/test");
const { failOnConsoleErrors } = require("./helpers");
const { login, waitForAtLeastOneProject } = require("./app-helpers");

async function expectStep(page, labelRegex) {
  await expect(page.locator("#stepLabel")).toHaveText(labelRegex);
}

async function openFirstProject(page) {
  await waitForAtLeastOneProject(page);

  const firstProject = page.locator(".project-card").first();

  await expect(firstProject).toBeVisible();

  await firstProject.click();

  await expectStep(page, /tipo de relatório/i);
}

test.beforeEach(async ({ page }) => {
  failOnConsoleErrors(page);
});

test("weekly report follows weekly path", async ({ page }) => {
  await login(page);
  await openFirstProject(page);

  await page.getByText(/relatório semanal/i).click();

  await expectStep(page, /progresso/i);
});

test("legal financeiro follows legal path", async ({ page }) => {
  await login(page);
  await openFirstProject(page);

  await page.getByText(/legal \/ financeiro/i).click();

  await expectStep(page, /financeiro/i);
});

test("go home returns to projects and app can continue", async ({ page }) => {
  await login(page);
  await openFirstProject(page);

  await page.getByRole("button", { name: /← obras/i }).click();

  await expect(page.locator("#projectList")).toBeVisible();
  await expectStep(page, /obras/i);

  await openFirstProject(page);

  await page.getByText(/relatório semanal/i).click();

  await expectStep(page, /progresso/i);
});