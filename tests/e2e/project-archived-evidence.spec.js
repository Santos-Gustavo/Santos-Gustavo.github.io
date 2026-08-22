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

  await page.locator("#companyName").fill("E2E Archived Evidence Company");
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
  await page.locator("#location").fill("Rua Evidência Arquivada 123, Porto");
  await page.locator("#contractNum").fill(contractNum);
  await page.locator("#distributedTo").fill("Cliente · Arquivo");
  await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 20000,
  });

  await expect(page.locator("#modeProjectLabel")).toHaveText(projectName);
}

async function generateWeeklyReport(page) {
  await page
    .locator('[data-nav-action="select-mode"][data-mode="weekly"]')
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 1 de 9|período|periodo/i,
    { timeout: 10000 }
  );

  await page.locator("#p-reportNum").fill("1");
  await page.locator("#p-reportDate").fill("2026-08-20");
  await page.locator("#p-periodStart").fill("2026-08-13");
  await page.locator("#p-periodEnd").fill("2026-08-20");
  await page.locator("#p-distributedTo").fill("Cliente · Arquivo");
  await page.locator("#p-sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 2 de 9|progresso/i,
    { timeout: 10000 }
  );

  await page.locator("#progressSlider").fill("45");

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 3 de 9|resumo/i,
    { timeout: 10000 }
  );

  await page
    .locator("#weekSummary")
    .fill(
      "Resumo E2E para validar que a evidência do relatório sobrevive ao arquivamento do projeto."
    );

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 4 de 9|trabalhos/i,
    { timeout: 10000 }
  );

  await page.getByRole("button", { name: /adicionar trabalho/i }).click();

  const workSelects = page.locator("select:visible");
  const workDescription = page.locator("textarea:visible").first();

  await workSelects.nth(0).selectOption({ label: "Pintura Interior" });
  await workSelects.nth(1).selectOption({ label: "Sala" });
  await workDescription.fill(
    "Trabalho de teste para validar evidência preservada após arquivamento."
  );
  await workSelects.nth(2).selectOption({ label: "Em curso" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/passo 5 de 9|fotos/i, {
    timeout: 10000,
  });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 6 de 9|decisão|decisao/i,
    { timeout: 10000 }
  );

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 7 de 9|incidentes/i,
    { timeout: 10000 }
  );

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 8 de 9|próximos passos|proximos passos/i,
    { timeout: 10000 }
  );

  await page
    .getByRole("button", {
      name: /adicionar próximo passo|adicionar proximo passo/i,
    })
    .click();

  const nextStepInputs = page.locator("input:visible");
  const nextStepTextareas = page.locator("textarea:visible");

  if (await nextStepTextareas.count()) {
    await nextStepTextareas
      .first()
      .fill("Validar que o relatório continua acessível após o arquivamento.");
  } else if (await nextStepInputs.count()) {
    await nextStepInputs
      .first()
      .fill("Validar que o relatório continua acessível após o arquivamento.");
  }

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 9 de 9|revisão|revisao/i,
    { timeout: 10000 }
  );

  const generateButton = page.locator(
    '[data-report-action="save-and-generate"]'
  );

  const dialogPromise = page.waitForEvent("dialog");

  await generateButton.click();

  const dialog = await dialogPromise;

  expect(dialog.message()).toMatch(/relatório guardado com sucesso/i);

  await dialog.accept();
}

async function goBackToProjectList(page) {
  await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 10000,
  });
}

async function selectProjectFromCurrentList(page, projectName) {
  const projectCard = page
    .locator("#projectList .project-card")
    .filter({ hasText: projectName });

  await expect(projectCard).toHaveCount(1, { timeout: 15000 });

  await projectCard.first().click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 10000,
  });

  await expect(page.locator("#modeProjectLabel")).toHaveText(projectName);
}

test("archived project still shows saved report history and evidence stays accessible", async ({
  page,
}) => {
  test.setTimeout(60000);

  const timestamp = Date.now();

  const projectName = `E2E Archived Evidence Project ${timestamp}`;
  const clientName = `E2E Archived Evidence Client ${timestamp}`;
  const contractNum = `ARCHIVED-EVIDENCE-${timestamp}`;

  await login(page);

  await createProject(page, { projectName, clientName, contractNum });

  await generateWeeklyReport(page);

  await page.locator('[data-nav-action="home"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 10000,
  });

  await selectProjectFromCurrentList(page, projectName);

  await expect(page.getByText(/relatórios guardados/i)).toBeVisible();

  const reportHistoryList = page.locator("#reportHistoryList");

  await expect(reportHistoryList).toContainText(/relatório\s*#?1/i, {
    timeout: 15000,
  });

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toMatch(/concluir|conclu/i);
    await dialog.accept("Conclusão E2E para validar evidência arquivada");
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
    await dialog.accept("Arquivo E2E para validar evidência arquivada");
  });

  await page
    .locator('[data-project-lifecycle-action="archive"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#modeProjectStatus")).toHaveText(/arquivada/i, {
    timeout: 15000,
  });

  await expect(page.getByText(/relatórios guardados/i)).toBeVisible();

  await expect(reportHistoryList).toContainText(/relatório\s*#?1/i, {
    timeout: 15000,
  });

  const openReportButton = reportHistoryList.locator(
    '[data-report-history-action="open"]'
  );

  await expect(openReportButton.first()).toBeVisible({ timeout: 10000 });
  await expect(openReportButton.first()).toBeEnabled();

  await goBackToProjectList(page);

  await page
    .locator('[data-project-filter="archived"]')
    .filter({ visible: true })
    .click();

  await expect(
    page.locator("#projectList .project-card").filter({ hasText: projectName })
  ).toHaveCount(1, { timeout: 15000 });

  await expect(
    page
      .locator("#projectList .project-card")
      .filter({ hasText: projectName })
      .getByRole("button", { name: /editar/i })
  ).toHaveCount(0);
});
