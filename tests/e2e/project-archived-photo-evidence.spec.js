import path from "node:path";
import { expect, test } from "@playwright/test";
import { createCanonicalReportFromModePage, readOpenedReport } from "./helpers/canonical-report-helper.js";

const TEST_PHOTO_PATH = path.join(__dirname, "fixtures", "test-photo.png");

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

async function createProject(page, { projectName, clientName, contractNum }) {
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
  await page.locator("#location").fill("Rua Evidência Fotográfica 456, Porto");
  await page.locator("#contractNum").fill(contractNum);
  await page.locator("#distributedTo").fill("Cliente · Arquivo");
  await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 20000,
  });

  await expect(page.locator("#modeProjectLabel")).toHaveText(projectName);
}

async function selectProjectFromCurrentList(page, projectName) {
  const projectCard = page
    .locator("#projectList .project-card")
    .filter({ hasText: projectName });

  await expect(projectCard).toHaveCount(1, { timeout: 15000 });

  // PROJECT-HUB-INTEGRATION-001 — the card itself opens Estado da Obra;
  // "Mais opções" (the mode picker / lifecycle actions) now lives inside
  // Estado da Obra's own header, not on this card.
  await projectCard.first().click();

  await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i, {
    timeout: 10000,
  });

  await page.locator("#workStatusMoreOptionsBtn").click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 10000,
  });

  await expect(page.locator("#modeProjectLabel")).toHaveText(projectName);
}

test("photo evidence attached to a report remains preserved after the project is archived", async ({
  page,
}) => {
  test.setTimeout(60000);

  const timestamp = Date.now();

  const projectName = `E2E Archived Photo Project ${timestamp}`;
  const clientName = `E2E Archived Photo Client ${timestamp}`;
  const contractNum = `ARCHIVED-PHOTO-${timestamp}`;

  await login(page);

  await createProject(page, { projectName, clientName, contractNum });

  // ESTADO-DA-OBRA-WORKSPACE-001 Phase 4 — the photo is added in Estado da
  // Obra and frozen into the report generated from the saved workspace.
  await createCanonicalReportFromModePage(page, {
    progress: "45",
    summary: "Resumo E2E para validar que a evidência fotográfica sobrevive ao arquivamento do projeto.",
    workDescription: "Trabalho de teste para validar evidência fotográfica preservada após arquivamento.",
    photoPath: TEST_PHOTO_PATH,
  });

  await selectProjectFromCurrentList(page, projectName);

  const reportHistoryList = page.locator("#reportHistoryList");

  await expect(reportHistoryList).toContainText(/relatório\s*#?1/i, {
    timeout: 15000,
  });

  await expect(reportHistoryList).toContainText(/snapshot disponível/i, {
    timeout: 15000,
  });

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toMatch(/concluir|conclu/i);
    await dialog.accept("Conclusão E2E para validar evidência fotográfica");
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
    await dialog.accept("Arquivo E2E para validar evidência fotográfica");
  });

  await page
    .locator('[data-project-lifecycle-action="archive"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#modeProjectStatus")).toHaveText(/arquivada/i, {
    timeout: 15000,
  });

  await expect(reportHistoryList).toContainText(/relatório\s*#?1/i, {
    timeout: 15000,
  });

  await expect(reportHistoryList).toContainText(/snapshot disponível/i, {
    timeout: 15000,
  });

  const openReportButton = reportHistoryList.locator(
    '[data-report-history-action="open"]'
  );

  await expect(openReportButton.first()).toBeVisible({ timeout: 10000 });
  await expect(openReportButton.first()).toBeEnabled();

  // The frozen photo still renders (signed from the snapshot's storagePath)
  // after the project is archived.
  const { html } = await readOpenedReport(page, () => openReportButton.first().click());
  expect(html).toMatch(/<div class="photo-frame">\s*<img src="https:\/\/[^"]+"/);
});
