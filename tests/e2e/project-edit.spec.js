import { expect, test } from "@playwright/test";

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

async function login(page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "Missing E2E login credentials. Set E2E_EMAIL and E2E_PASSWORD in .env."
    );
  }

  await page.goto("/");

  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");

  await expect(page.locator("#authEmail")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#authPassword")).toBeVisible({ timeout: 10000 });

  await page.locator("#authEmail").fill(E2E_EMAIL);
  await page.locator("#authPassword").fill(E2E_PASSWORD);

  await page
    .getByRole("button", { name: /entrar|login|iniciar/i })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 15000,
  });

  await page.waitForTimeout(500);
}

test("editing a project updates the existing project without creating a duplicate", async ({
  page,
}) => {
  const timestamp = Date.now();

  const originalProjectName = `E2E Edit Original ${timestamp}`;
  const updatedProjectName = `E2E Edit Updated ${timestamp}`;
  const clientName = `E2E Edit Client ${timestamp}`;
  const originalContractNum = `EDIT-ORIGINAL-${timestamp}`;
  const updatedContractNum = `EDIT-UPDATED-${timestamp}`;

  await login(page);

  await page
  .locator('[data-project-action="new-project"]')
  .filter({ visible: true })
  .click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /dados do projeto/i,
    { timeout: 10000 }
  );

  await page.locator("#projectName").fill(originalProjectName);
  await page.locator("#clientName").fill(clientName);
  await page.locator("#location").fill("Rua Editável 123, Porto");
  await page.locator("#contractNum").fill(originalContractNum);
  await page.locator("#distributedTo").fill("Cliente · Arquivo");
  await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 20000,
  });

  await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 10000,
  });

  const originalProjectCard = page
    .locator("#projectList .project-card")
    .filter({ hasText: originalProjectName });

  await expect(originalProjectCard).toBeVisible({ timeout: 15000 });

  await originalProjectCard
    .getByRole("button", { name: /editar projeto|editar/i })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /dados do projeto/i,
    { timeout: 10000 }
  );

  await expect(page.locator("#projectName")).toBeVisible({ timeout: 10000 });

  await page.locator("#projectName").fill(updatedProjectName);
  await page.locator("#contractNum").fill(updatedContractNum);

    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

    await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 10000,
    });

  const updatedProjectCards = page
    .locator("#projectList .project-card")
    .filter({ hasText: updatedProjectName });

  const originalProjectCards = page
    .locator("#projectList .project-card")
    .filter({ hasText: originalProjectName });

  await expect(updatedProjectCards).toHaveCount(1, { timeout: 15000 });
  await expect(originalProjectCards).toHaveCount(0);

  await expect(updatedProjectCards.first()).toContainText(updatedContractNum);
});