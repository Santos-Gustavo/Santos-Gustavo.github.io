import { expect, test } from "@playwright/test";
import {
  createCanonicalReportFromModePage,
  readOpenedReport,
} from "./helpers/canonical-report-helper.js";

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

  const emailInput = page.locator("#authEmail");
  const passwordInput = page.locator("#authPassword");

  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await expect(passwordInput).toBeVisible({ timeout: 10000 });

  await emailInput.fill(E2E_EMAIL);
  await passwordInput.fill(E2E_PASSWORD);

  await page
    .getByRole("button", { name: /entrar|login|iniciar/i })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 15000,
  });

  await page.waitForTimeout(500);
}

test("generated weekly report appears in saved reports", async ({ page }) => {
  test.setTimeout(90000);

  const timestamp = Date.now();

  const projectName = `E2E Report Persist Project ${timestamp}`;
  const clientName = `E2E Report Persist Client ${timestamp}`;
  const contractNum = `REPORT-${timestamp}`;

  await login(page);

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
  await page.locator("#location").fill("Rua Relatório Persistente 123, Porto");
  await page.locator("#contractNum").fill(contractNum);
  await page.locator("#distributedTo").fill("Cliente · Arquivo");
  await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 20000,
  });

  // ESTADO-DA-OBRA-WORKSPACE-001 Phase 4 — weekly reports are generated from
  // the saved Estado da Obra; the old 9-step wizard is not reachable.
  const summary =
    "Resumo E2E persistente para confirmar que o relatório semanal fica guardado e reaparece no projeto.";

  await createCanonicalReportFromModePage(page, {
    progress: "45",
    summary,
    workDescription: "Trabalho persistente de teste para validar relatório guardado.",
    nextSteps: "Validar que o relatório aparece nos relatórios guardados.",
  });

  const projectCard = page
    .locator("#projectList .project-card")
    .filter({ hasText: projectName });

  await expect(projectCard).toBeVisible({
    timeout: 15000,
  });

  // PROJECT-HUB-INTEGRATION-001 — the card itself opens Estado da Obra;
  // "Mais opções" (mode picker) now lives inside Estado da Obra's own header.
  await projectCard.click();

  await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i, {
    timeout: 10000,
  });

  await page.locator("#workStatusMoreOptionsBtn").click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 10000,
  });

  await expect(page.locator("#modeProjectLabel")).toHaveText(projectName);

  await expect(page.getByText(/relatórios guardados/i)).toBeVisible();

  await expect(
        page.locator("body")
        ).toContainText(contractNum, {
        timeout: 15000,
    });

    await expect(
        page.locator("body")
        ).toContainText(/relatório\s*#?1/i, {
        timeout: 15000,
    });

  // The saved report re-opens from its frozen snapshot.
  const { text } = await readOpenedReport(page, () =>
    page.locator('#reportHistoryList [data-report-history-action="open"]').first().click()
  );
  expect(text).toContain(summary);
});
