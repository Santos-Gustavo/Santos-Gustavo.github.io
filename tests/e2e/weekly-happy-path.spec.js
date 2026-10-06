import { expect, test } from "@playwright/test";
import {
  expectEstadoDaObraOpen,
  addWorkItemInEstadoDaObra,
  saveEstadoDaObra,
  generateReportFromEstadoDaObra,
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

async function dumpVisibleState(page, label) {
  const state = await page.evaluate(() => {
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const controls = Array.from(
      document.querySelectorAll(
        "input, textarea, select, button, [data-nav-action], [data-mode], [data-report-action]"
      )
    )
      .filter(visible)
      .map((el) => ({
        tag: el.tagName,
        id: el.id || "",
        type: el.getAttribute("type") || "",
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160),
        value: "value" in el ? el.value : "",
        className: el.className || "",
        dataNavAction: el.getAttribute("data-nav-action") || "",
        dataMode: el.getAttribute("data-mode") || "",
        dataReportAction: el.getAttribute("data-report-action") || "",
      }));

    return {
      stepLabel: document.querySelector("#stepLabel")?.textContent?.trim() || "",
      bodyText: document.body.innerText.trim().slice(0, 2000),
      controls,
    };
  });

  console.log(`\n===== ${label} =====`);
  console.log(JSON.stringify(state, null, 2));
  console.log(`===== END ${label} =====\n`);

  return state;
}


// ESTADO-DA-OBRA-WORKSPACE-001 Phase 4 — the weekly report is generated from
// the saved Estado da Obra (no 9-step wizard). The review-step home-button
// checks (FIX 7/8) still run, on the legal/financial flow's review step —
// the only flow that still uses it.
test("user can create a project and generate a weekly report from Estado da Obra", async ({ page }) => {
  test.setTimeout(90000);

  const projectName = `E2E Test Project ${Date.now()}`;
  const summary =
    "Durante esta semana foram concluídos trabalhos de preparação, organização da frente de projeto e avanço nas tarefas principais previstas.";
  const workDescription =
    "Preparação das superfícies, aplicação de primário e primeira demão de pintura interior.";
  const nextStep = "Concluir a segunda demão de pintura e iniciar os acabamentos finais.";

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
  await page.locator("#clientName").fill("E2E Test Client");
  await page.locator("#location").fill("Rua E2E 123, Porto");
  await page.locator("#contractNum").fill("E2E-2026-001");
  await page.locator("#distributedTo").fill("Cliente · Arquivo");
  await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i, {
    timeout: 20000,
  });

  // A new project lands straight in Estado da Obra: no "Tipo de Relatório"
  // page, and no route into the old weekly wizard.
  await expect(page.locator("#step-mode")).toHaveCount(0);
  await expect(page.locator('[data-nav-action="select-mode"][data-mode="weekly"]')).toHaveCount(0);

  await expectEstadoDaObraOpen(page);

  await page.locator("#workStatusProgressSlider").fill("35");
  await expect(page.locator("#workStatusProgressPct")).toHaveText("35%");
  await page.locator("#workStatusSummary").fill(summary);
  await addWorkItemInEstadoDaObra(page, {
    type: "Pintura Interior",
    area: "Sala",
    description: workDescription,
    status: "in_progress",
  });
  await page.locator("#workStatusNextSteps").fill(nextStep);

  await saveEstadoDaObra(page);
  await generateReportFromEstadoDaObra(page);

  await expect(page.locator("#workStatusReportResult")).toContainText(/relatório\s*#001 gerado/i);

  const { text } = await readOpenedReport(page, () =>
    page.locator('#workStatusReportResult [data-generated-report-action="view-pdf"]').click()
  );
  expect(text).toContain(summary);
  expect(text).toContain(workDescription);
  expect(text).toContain(nextStep);
  expect(text).toContain("35%");

  // FIX 7/8 — review step header/home confirmation, via the legal flow.
  await page.locator('[data-nav-action="open-legal"]').click();
  // Walk "Seguinte" through the legal flow until its review step (#step12).
  for (let i = 0; i < 6 && !/\bactive\b/.test((await page.locator("#step12").getAttribute("class")) || ""); i += 1) {
    const label = await page.locator("#stepLabel").textContent();
    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).not.toHaveText(label || "", { timeout: 10000 });
  }
  await expect(page.locator("#step12")).toHaveClass(/active/, { timeout: 10000 });

  const homeButton = page
    .locator('[data-nav-action="home"]')
    .filter({ visible: true });

  await expect(homeButton).toBeVisible();

  // FIX 7 — "Voltar ao Início" lives in the step header, not the nav-bar
  // next to "Gerar Relatório".
  await expect(page.locator(".step-header-with-action")).toContainText(
    "Voltar ao Início"
  );
  await expect(page.locator("#step12 .nav-bar")).not.toContainText(
    "Voltar ao Início"
  );

  // FIX 8 — clicking home asks for confirmation; Cancel keeps the user here.
  await homeButton.click();

  await expect(page.locator("#confirmDialogTitle")).toHaveText(
    "Voltar ao início?"
  );
  await expect(page.locator("#confirmDialogMessage")).toHaveText(
    "Pode perder alterações que ainda não foram guardadas. Quer continuar?"
  );

  await page.locator('[data-confirm-action="cancel"]').click();

  await expect(page.locator("#confirmDialog")).toBeHidden();
  await expect(page.locator("#step12")).toHaveClass(/active/);

  await homeButton.click();
  await page.locator('[data-confirm-action="confirm"]').click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 10000,
  });
});
