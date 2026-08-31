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

async function createClient(page, { name, phone, email }) {
  await page.locator('[data-client-action="new"]').filter({ visible: true }).click();

  await expect(page.locator("#clientFormPanel")).toHaveClass(/active/, {
    timeout: 5000,
  });

  await page.locator("#clientFormName").fill(name);

  if (phone) await page.locator("#clientFormPhone").fill(phone);
  if (email) await page.locator("#clientFormEmail").fill(email);

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
    /dados do projeto/i,
    { timeout: 10000 }
  );

  await page.locator("#projectName").fill(projectName);
  await page.locator("#clientName").fill(clientName);
  await page.locator("#location").fill("Rua Client Mgmt 123, Porto");
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

test.describe("CLIENT-MANAGEMENT-001 — directory", () => {
  test("logged-out user cannot see the client directory", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Entrar" }).click();
    await page.waitForLoadState("load");

    await expect(page.locator("#authScreen")).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator('[data-nav-action="open-clients"]').filter({ visible: true })
    ).toHaveCount(0);

    await expect(page.locator("#step-clients")).not.toBeVisible();
  });

  test("logged-in user can open Clientes", async ({ page }) => {
    await login(page);
    await openClientsPage(page);

    await expect(page.locator("#stepLabel")).toHaveText(/clientes/i);
  });

  test("user can create a client from the Clientes page", async ({ page }) => {
    const timestamp = Date.now();
    const name = `E2E Client Create ${timestamp}`;

    await login(page);
    await openClientsPage(page);

    const card = await createClient(page, {
      name,
      phone: "912345678",
      email: "create@example.com",
    });

    await expect(card).toContainText("912345678");
    await expect(card).toContainText("create@example.com");
  });

  test("user can edit client name, phone and email", async ({ page }) => {
    const timestamp = Date.now();
    const originalName = `E2E Client Edit ${timestamp}`;
    const updatedName = `E2E Client Edited ${timestamp}`;

    await login(page);
    await openClientsPage(page);

    const card = await createClient(page, {
      name: originalName,
      phone: "911111111",
      email: "before@example.com",
    });

    await card.locator('[data-client-action="edit"]').click();

    await expect(page.locator("#clientFormPanel")).toHaveClass(/active/, {
      timeout: 5000,
    });
    await expect(page.locator("#clientFormName")).toHaveValue(originalName);

    await page.locator("#clientFormName").fill(updatedName);
    await page.locator("#clientFormPhone").fill("922222222");
    await page.locator("#clientFormEmail").fill("after@example.com");

    await page.locator('[data-client-action="save"]').click();

    const updatedCard = page.locator("#clientList .project-card").filter({
      hasText: updatedName,
    });

    await expect(updatedCard).toBeVisible({ timeout: 15000 });
    await expect(updatedCard).toContainText("922222222");
    await expect(updatedCard).toContainText("after@example.com");

    await expect(
      page.locator("#clientList .project-card").filter({ hasText: originalName })
    ).toHaveCount(0);
  });

  test("client list filters instantly by name or phone", async ({ page }) => {
    const timestamp = Date.now();
    const nameA = `E2E Client Search Alpha ${timestamp}`;
    const nameB = `E2E Client Search Beta ${timestamp}`;
    const phoneB = `9${String(timestamp).slice(-8)}`;

    await login(page);
    await openClientsPage(page);

    await createClient(page, { name: nameA, phone: "900000001" });
    await createClient(page, { name: nameB, phone: phoneB });

    const searchInput = page.locator("#clientSearchInput");

    await searchInput.fill(nameA);
    await expect(
      page.locator("#clientList .project-card").filter({ hasText: nameA })
    ).toBeVisible();
    await expect(
      page.locator("#clientList .project-card").filter({ hasText: nameB })
    ).toHaveCount(0);

    await searchInput.fill(phoneB);
    await expect(
      page.locator("#clientList .project-card").filter({ hasText: nameB })
    ).toBeVisible();
    await expect(
      page.locator("#clientList .project-card").filter({ hasText: nameA })
    ).toHaveCount(0);

    await searchInput.fill("");
  });

  test("linked project count appears on the client card", async ({ page }) => {
    const timestamp = Date.now();
    const clientName = `E2E Client ProjectCount ${timestamp}`;
    const projectName = `E2E Client Mgmt Project ${timestamp}`;
    const contractNum = `CLIENT-MGMT-${timestamp}`;

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
  });
});
