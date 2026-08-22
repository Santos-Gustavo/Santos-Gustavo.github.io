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

async function createProject(page, { projectName, clientName, contractNum }) {
  await page
    .locator('[data-project-action="new-project"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /configuração 1 de 2|configuracao 1 de 2|empresa/i,
    { timeout: 10000 }
  );

  await page.locator("#companyName").fill("E2E Archived Readonly Company");
  await page
    .locator("#companyTagline")
    .fill("Construção · Renovação · Remodelação");
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
  await page.locator("#location").fill("Rua Arquivada 123, Porto");
  await page.locator("#contractNum").fill(contractNum);
  await page.locator("#distributedTo").fill("Cliente · Arquivo");
  await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 20000,
  });

  await expect(page.locator("#modeProjectLabel")).toHaveText(projectName);
}

async function goBackToProjectList(page) {
  await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 10000,
  });
}

test("archived project can be viewed but not edited or used to create new reports", async ({
  page,
}) => {
  const timestamp = Date.now();

  const projectName = `E2E Archived Readonly Project ${timestamp}`;
  const clientName = `E2E Archived Readonly Client ${timestamp}`;
  const contractNum = `ARCHIVED-READONLY-${timestamp}`;

  await login(page);

  await createProject(page, {
    projectName,
    clientName,
    contractNum,
  });

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toMatch(/concluir|conclu/i);
    await dialog.accept("Conclusão E2E para validar leitura de arquivada");
  });

  await page
    .locator('[data-project-lifecycle-action="complete"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#modeProjectStatus")).toHaveText(/concluída/i, {
    timeout: 15000,
  });

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toMatch(/arquivar/i);
    await dialog.accept("Arquivo E2E para validar leitura de arquivada");
  });

  await page
    .locator('[data-project-lifecycle-action="archive"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#modeProjectStatus")).toHaveText(/arquivada/i, {
    timeout: 15000,
  });

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe(
      "Este projeto está arquivado. Não é possível criar novos relatórios semanais."
    );
    await dialog.accept();
  });

  await page
    .locator('[data-nav-action="select-mode"][data-mode="weekly"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 10000,
  });

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe(
      "Este projeto está arquivado. Não é possível criar novos relatórios legais/financeiros."
    );
    await dialog.accept();
  });

  await page
    .locator('[data-nav-action="select-mode"][data-mode="legal"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 10000,
  });

  await goBackToProjectList(page);

  await page
    .locator('[data-project-filter="archived"]')
    .filter({ visible: true })
    .click();

  const archivedProjectCard = page
    .locator("#projectList .project-card")
    .filter({ hasText: projectName });

  await expect(archivedProjectCard).toHaveCount(1, { timeout: 15000 });

  await expect(
    archivedProjectCard.getByRole("button", { name: /editar/i })
  ).toHaveCount(0);
});
