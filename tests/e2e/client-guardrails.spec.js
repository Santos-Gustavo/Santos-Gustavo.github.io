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

async function openClientsPage(page) {
  await page
    .locator('[data-nav-action="open-clients"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(/clientes/i, {
    timeout: 10000,
  });

  await expect(page.locator("#clientList")).toBeVisible({ timeout: 10000 });
}

async function createClient(page, { name, phone }) {
  await page.locator('[data-client-action="new"]').filter({ visible: true }).click();

  await expect(page.locator("#clientFormPanel")).toHaveClass(/active/, {
    timeout: 5000,
  });

  await page.locator("#clientFormName").fill(name);
  if (phone) await page.locator("#clientFormPhone").fill(phone);

  await page.locator('[data-client-action="save"]').click();

  const card = page.locator("#clientList .project-card").filter({ hasText: name });
  await expect(card).toBeVisible({ timeout: 15000 });

  return card;
}

async function createProjectForClient(page, { projectName, clientName, contractNum }) {
  await page
    .locator('[data-project-action="new-project"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /configuração 1 de 2|configuracao 1 de 2|empresa/i,
    { timeout: 10000 }
  );

  await page.locator("#companyName").fill("E2E Client Mgmt Company");
  await page.locator("#companyTagline").fill("Construção · Renovação · Remodelação");
  await page.locator("#companyNif").fill("509123456");
  await page.locator("#companyInci").fill("12345");
  await page.locator("#responsible").fill("E2E Responsible");
  await page.locator("#companyPhone").fill("+351 912 345 678");
  await page.locator("#companyEmail").fill("e2e.company@example.com");

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /configuração 2 de 2|configuracao 2 de 2|projeto/i,
    { timeout: 10000 }
  );

  await page.locator("#projectName").fill(projectName);
  await page.locator("#clientName").fill(clientName);
  await page.locator("#location").fill("Rua Client Mgmt Guardrails 123, Porto");
  await page.locator("#contractNum").fill(contractNum);
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
}

test.describe("CLIENT-MANAGEMENT-001 — evidence & archive guardrails", () => {
  test("client with a linked project cannot be hard-deleted and shows the required message", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const clientName = `E2E Client Guardrail Delete ${timestamp}`;
    const projectName = `E2E Client Mgmt Guardrail Project ${timestamp}`;
    const contractNum = `CLIENT-MGMT-GUARD-${timestamp}`;

    await login(page);

    await createProjectForClient(page, {
      projectName,
      clientName,
      contractNum,
    });

    await openClientsPage(page);

    const searchInput = page.locator("#clientSearchInput");
    await searchInput.fill(clientName);

    const card = page.locator("#clientList .project-card").filter({ hasText: clientName });
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText(/1 obra associada/i);

    let dialogMessage = "";
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await card.locator('[data-client-action="delete"]').click();

    await expect.poll(() => dialogMessage).toMatch(
      /não é possível eliminar um cliente com obras associadas\. utilize a opção arquivar\./i
    );

    // Client must still exist afterwards — the delete was blocked, not performed.
    await expect(card).toBeVisible();
  });

  test("zero-history client can be deleted", async ({ page }) => {
    const timestamp = Date.now();
    const clientName = `E2E Client Zero History ${timestamp}`;

    await login(page);
    await openClientsPage(page);

    const card = await createClient(page, { name: clientName, phone: "933333333" });
    await expect(card).toContainText(/0 obras associadas/i);

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });

    await card.locator('[data-client-action="delete"]').click();

    await expect(
      page.locator("#clientList .project-card").filter({ hasText: clientName })
    ).toHaveCount(0, { timeout: 15000 });
  });

  test("archived client disappears from the active list and the new-project client selector", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const clientName = `E2E Client Archive Hide ${timestamp}`;

    await login(page);
    await openClientsPage(page);

    const card = await createClient(page, { name: clientName, phone: "944444444" });

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });

    await card.locator('[data-client-action="archive"]').click();

    await expect(
      page.locator("#clientList .project-card").filter({ hasText: clientName })
    ).toHaveCount(0, { timeout: 15000 });

    await page.locator('[data-client-filter="archived"]').click();

    const archivedCard = page
      .locator("#clientList .project-card")
      .filter({ hasText: clientName });

    await expect(archivedCard).toBeVisible({ timeout: 10000 });
    await expect(archivedCard).toContainText(/arquivado/i);

    // Back to the active tab, then confirm the archived client is not offered
    // as a suggestion when creating a new project.
    await page.locator('[data-client-filter="active"]').click();

    await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, { timeout: 10000 });

    await page
      .locator('[data-project-action="new-project"]')
      .filter({ visible: true })
      .click();

    await expect(page.locator("#stepLabel")).toHaveText(
      /configuração 1 de 2|configuracao 1 de 2|empresa/i,
      { timeout: 10000 }
    );

    await page.locator("#companyName").fill("E2E Client Mgmt Company");
    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

    await expect(page.locator("#stepLabel")).toHaveText(
      /configuração 2 de 2|configuracao 2 de 2|projeto/i,
      { timeout: 10000 }
    );

    await expect(
      page.locator(`#clientNameOptions option[value="${clientName}"]`)
    ).toHaveCount(0);
  });
});
