// tests/e2e/project-master-sheet.spec.js
//
// PROJECT-MASTER-SHEET-001 — "Ver Estado da Obra". Seeds reports directly via the
// service-role client (mirrors tests/e2e/helpers/report-share-test-helper.js) rather
// than driving the full multi-step weekly report wizard twice per test, since what's
// under test is the consolidation/quick-tap/prefill logic, not report creation itself
// (already covered by weekly-happy-path.spec.js / report-persistence.spec.js).

import { expect, test } from "@playwright/test";
import { getServiceRoleClient, hasServiceRoleEnv } from "./helpers/supabase-admin.js";
import { ensureE2ECompany } from "./helpers/e2e-fixtures.js";

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

function missingEnv() {
  const missing = [];
  if (!hasServiceRoleEnv()) missing.push("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.E2E_USER_ID) missing.push("E2E_USER_ID");
  if (!E2E_EMAIL || !E2E_PASSWORD) missing.push("E2E_EMAIL / E2E_PASSWORD");
  return missing;
}

async function login(page) {
  await page.goto("/");

  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");

  await expect(page.locator("#authEmail")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#authPassword")).toBeVisible({ timeout: 10000 });

  await page.locator("#authEmail").fill(E2E_EMAIL);
  await page.locator("#authPassword").fill(E2E_PASSWORD);

  await page.getByRole("button", { name: /entrar|login|iniciar/i }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 15000,
  });

  await page.waitForTimeout(500);
}

async function insertTestClient(client, companyId, name) {
  const { data, error } = await client
    .from("clients")
    .insert({
      company_id: companyId,
      name,
      phone: "+351 910 000 000",
      email: null,
      nif: null,
      address: "Rua E2E Master Sheet, Porto",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function insertTestProject(client, companyId, clientId, name) {
  const { data, error } = await client
    .from("projects")
    .insert({
      company_id: companyId,
      client_id: clientId,
      name,
      site_address: "Rua E2E Master Sheet, Porto",
      type_of_work: "Fixture",
      start_date: new Date().toISOString().slice(0, 10),
      contract_num: `E2E-MASTER-SHEET-${Date.now()}`,
      contract_value: 5000,
      status: 1,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function insertTestReport(client, {
  projectId,
  reportNum,
  reportDate,
  progressPct,
  works = [],
  incidents = [],
}) {
  const { data, error } = await client
    .from("reports")
    .insert({
      project_id: projectId,
      report_num: reportNum,
      report_date: reportDate,
      period_start: null,
      period_end: null,
      distributed_to: "Cliente",
      sent_via: 1,
      phase: "Acabamentos",
      progress_pct: progressPct,
      week_summary: `Resumo E2E — relatório #${reportNum}.`,
      alert_on: false,
      incidents_on: incidents.length > 0,
      financial_note: null,
      works,
      incidents,
      extras: [],
      next_steps: [],
      snapshot_json: null,
      status: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// PROJECT-HUB-INTEGRATION-001 — Estado da Obra is the project hub now:
// clicking the card itself opens it directly (no dedicated card button
// anymore — that slot is "Mais opções", which goes to the old mode picker).
async function openMasterSheetFromProjectList(page, projectName) {
  const projectCard = page
    .locator("#projectList .project-card")
    .filter({ hasText: projectName });

  await expect(projectCard).toHaveCount(1, { timeout: 15000 });

  await projectCard.first().click();

  await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i, {
    timeout: 10000,
  });

  await expect(page.locator("#workStatusProjectLabel")).toHaveText(projectName);
}

test.describe("PROJECT-MASTER-SHEET-001 — Ver Estado da Obra", () => {
  test.beforeEach(() => {
    const missing = missingEnv();
    if (missing.length > 0) {
      test.skip(true, `Set ${missing.join(", ")}.`);
    }
  });

  test("project card shows the action, and an empty project shows clear empty states", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const projectName = `E2E Master Sheet Empty Project ${timestamp}`;
    const clientName = `E2E Master Sheet Empty Client ${timestamp}`;

    const client = getServiceRoleClient();
    const company = await ensureE2ECompany();
    const testClient = await insertTestClient(client, company.id, clientName);
    const project = await insertTestProject(client, company.id, testClient.id, projectName);

    await login(page);

    const projectCard = page
      .locator("#projectList .project-card")
      .filter({ hasText: projectName });

    await expect(projectCard).toHaveCount(1, { timeout: 15000 });
    await expect(
      projectCard.first().getByRole("button", { name: /mais opções/i })
    ).toBeVisible();

    await openMasterSheetFromProjectList(page, projectName);

    await expect(page.locator("#workStatusProgressPct")).toHaveText("0%");
    // Editable panel: 8 phase options, nothing selected yet, save disabled
    // (nothing edited since opening — no unsaved changes to warn about).
    await expect(page.locator(".work-status-phase-option")).toHaveCount(8);
    await expect(page.locator("#workStatusSaveBtn")).toBeDisabled();
    await expect(page.locator("#workStatusPendingList")).toContainText(
      "Sem trabalhos pendentes registados."
    );
    await expect(page.locator("#workStatusProgressList")).toContainText(
      "Sem trabalhos em curso registados."
    );
    await expect(page.locator("#workStatusDoneList")).toContainText(
      "Sem trabalhos concluídos registados."
    );
    await expect(page.locator("#workStatusIncidentsList")).toContainText(
      "Sem incidentes registados."
    );

    // Section headings surface a count, and the report shortcut is available
    // for an active project (Estado da Obra as project home, not a dead end).
    await expect(page.locator("#workStatusPendingHeading")).toHaveText("Pendentes (0)");
    await expect(page.locator("#workStatusGenerateReportBtn")).toBeVisible();

    // A work item can be added directly on Estado da Obra, with no source
    // report — it shows up as Pendente immediately, saved right away (this
    // quick-tap-style action is not part of the Guardar alterações draft).
    page.once("dialog", async (dialog) => {
      await dialog.accept("Reparar fissura na fachada — E2E adicionado");
    });
    await page.locator("#workStatusAddWorkItemBtn").click();

    await expect(page.locator("#workStatusPendingHeading")).toHaveText("Pendentes (1)");
    await expect(page.locator("#workStatusPendingList")).toContainText(
      "Reparar fissura na fachada — E2E adicionado"
    );
  });

  test("consolidates work items and incidents across reports, quick-tap status persists, and weekly report prefills open items", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const timestamp = Date.now();
    const projectName = `E2E Master Sheet Project ${timestamp}`;
    const clientName = `E2E Master Sheet Client ${timestamp}`;

    const client = getServiceRoleClient();
    const company = await ensureE2ECompany();
    const testClient = await insertTestClient(client, company.id, clientName);
    const project = await insertTestProject(client, company.id, testClient.id, projectName);

    // Report #1 (older): w1 blocked, w2 done. Incident i1.
    await insertTestReport(client, {
      projectId: project.id,
      reportNum: 1,
      reportDate: "2026-08-10",
      progressPct: 20,
      works: [
        { id: "e2e-w1", type: "Pintura Interior", area: "Sala", desc: "Pintura da sala — E2E w1", status: "blocked" },
        { id: "e2e-w2", type: "Canalização / Hidráulica", area: "Cozinha", desc: "Canalização da cozinha — E2E w2", status: "done" },
      ],
      incidents: [{ id: "e2e-i1", desc: "Atraso na entrega de material — E2E i1" }],
    });

    // Report #2 (newer): w1 now progress (latest status should win), w3 blocked. Incident i2.
    await insertTestReport(client, {
      projectId: project.id,
      reportNum: 2,
      reportDate: "2026-08-20",
      progressPct: 55,
      works: [
        { id: "e2e-w1", type: "Pintura Interior", area: "Sala", desc: "Pintura da sala — E2E w1", status: "progress" },
        { id: "e2e-w3", type: "Isolamento Térmico", area: "Cobertura / Terraço", desc: "Isolamento da cobertura — E2E w3", status: "blocked" },
      ],
      incidents: [{ id: "e2e-i2", desc: "Fissura na parede exterior — E2E i2" }],
    });

    await login(page);

    await openMasterSheetFromProjectList(page, projectName);

    // Progress uses the most recent report's percentage.
    await expect(page.locator("#workStatusProgressPct")).toHaveText("55%");

    // w1 carried the newer report's "progress" status, not the older "blocked" one.
    await expect(page.locator("#workStatusProgressList")).toContainText("Pintura da sala — E2E w1");
    await expect(page.locator("#workStatusPendingList")).not.toContainText("E2E w1");

    // w3 only exists on the newer report, as blocked (Pendente).
    await expect(page.locator("#workStatusPendingList")).toContainText("Isolamento da cobertura — E2E w3");

    // w2 only exists on the older report, as done (Concluída).
    await expect(page.locator("#workStatusDoneList")).toContainText("Canalização da cozinha — E2E w2");

    // Both incidents show up, consolidated from both reports.
    await expect(page.locator("#workStatusIncidentsList")).toContainText("Atraso na entrega de material — E2E i1");
    await expect(page.locator("#workStatusIncidentsList")).toContainText("Fissura na parede exterior — E2E i2");

    // Quick-tap: mark w3 (currently Pendente) as concluída — a single action
    // button per item ("Marcar como concluída" / "Reabrir"), not a 3-way picker.
    const w3Card = page
      .locator(".work-status-item-card")
      .filter({ hasText: "Isolamento da cobertura — E2E w3" });

    await w3Card.getByRole("button", { name: "Marcar como concluída" }).click();

    await expect(page.locator("#workStatusPendingList")).toContainText(
      "Sem trabalhos pendentes registados."
    );
    await expect(page.locator("#workStatusDoneList")).toContainText("Isolamento da cobertura — E2E w3");

    // Once done, the same item offers "Reabrir" instead — never both actions at once.
    const w3CardAfterComplete = page
      .locator("#workStatusDoneList .work-status-item-card")
      .filter({ hasText: "Isolamento da cobertura — E2E w3" });

    await expect(w3CardAfterComplete.getByRole("button", { name: "Reabrir" })).toBeVisible();
    await expect(
      w3CardAfterComplete.getByRole("button", { name: "Marcar como concluída" })
    ).toHaveCount(0);

    // Leave the screen and come back to prove the status change persisted server-side
    // (Estado da Obra never caches this client-side — reopening always re-queries the
    // DB) rather than just surviving in local JS state from the click above.
    await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, { timeout: 10000 });
    await openMasterSheetFromProjectList(page, projectName);

    await expect(page.locator("#workStatusDoneList")).toContainText("Isolamento da cobertura — E2E w3");
    await expect(page.locator("#workStatusPendingList")).toContainText(
      "Sem trabalhos pendentes registados."
    );

    // Now: open items are only Em curso (w1) — Pendentes is empty (w3 became Concluída),
    // Concluídas (w2, w3) must not be pre-filled, incidents must not be pre-filled.
    // Still on Estado da Obra (reopened above) — use its own "Gerar relatório
    // semanal" shortcut directly, the project hub's own entry point.
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/pré-preenchidos/i);
      await dialog.accept();
    });

    await page.locator('[data-nav-action="generate-weekly-report"]').click();

    await expect(page.locator("#stepLabel")).toHaveText(/passo 1 de 9|período|periodo/i, {
      timeout: 10000,
    });

    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/passo 2 de 9|progresso/i, {
      timeout: 10000,
    });

    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/passo 3 de 9|resumo/i, {
      timeout: 10000,
    });

    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/passo 4 de 9|trabalhos/i, {
      timeout: 10000,
    });

    const workCards = page.locator("#workList .item-card, #worksList .item-card");
    await expect(workCards).toHaveCount(1);
    await expect(workCards.first()).toContainText("Pintura da sala — E2E w1");
    await expect(workCards.first().locator("textarea")).toHaveValue("Pintura da sala — E2E w1");

    const statusSelect = workCards.first().locator('select[data-work-field="status"]');
    await expect(statusSelect).toHaveValue("progress");

    // Incidents must start clean — never pre-filled from Estado da Obra by default.
    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/passo 5 de 9|fotos/i, {
      timeout: 10000,
    });

    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/passo 6 de 9|decisão|decisao/i, {
      timeout: 10000,
    });

    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/passo 7 de 9|incidentes/i, {
      timeout: 10000,
    });

    await expect(page.locator("#incidentsToggle")).not.toHaveClass(/on/);
    await expect(page.locator("#incidentList")).toContainText(
      "Sem incidentes registados."
    );
  });

  test("archived project stays view-only in Estado da Obra", async ({ page }) => {
    test.setTimeout(60000);

    const timestamp = Date.now();
    const projectName = `E2E Master Sheet Archived Project ${timestamp}`;
    const clientName = `E2E Master Sheet Archived Client ${timestamp}`;

    const client = getServiceRoleClient();
    const company = await ensureE2ECompany();
    const testClient = await insertTestClient(client, company.id, clientName);
    const project = await insertTestProject(client, company.id, testClient.id, projectName);

    await insertTestReport(client, {
      projectId: project.id,
      reportNum: 1,
      reportDate: "2026-08-10",
      progressPct: 30,
      works: [
        { id: "e2e-arch-w1", type: "Pintura Interior", area: "Sala", desc: "Pintura E2E arquivado", status: "blocked" },
      ],
      incidents: [],
    });

    await login(page);

    const projectCard = page
      .locator("#projectList .project-card")
      .filter({ hasText: projectName });

    await expect(projectCard).toHaveCount(1, { timeout: 15000 });
    // Lifecycle actions (pause/complete/archive/reopen) live on the mode
    // picker, reached via "Mais opções" now that the card itself opens
    // Estado da Obra.
    await projectCard.first().getByRole("button", { name: /mais opções/i }).click();

    await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
      timeout: 10000,
    });

    page.once("dialog", async (dialog) => {
      await dialog.accept("Conclusão E2E — master sheet arquivado");
    });
    await page
      .locator('[data-project-lifecycle-action="complete"]')
      .filter({ visible: true })
      .click();

    await expect(page.locator("#modeProjectStatus")).toHaveText(/concluída/i, {
      timeout: 15000,
    });

    page.once("dialog", async (dialog) => {
      await dialog.accept("Arquivo E2E — master sheet arquivado");
    });
    await page
      .locator('[data-project-lifecycle-action="archive"]')
      .filter({ visible: true })
      .click();

    await expect(page.locator("#modeProjectStatus")).toHaveText(/arquivada/i, {
      timeout: 15000,
    });

    await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, { timeout: 10000 });

    await page.locator('[data-project-filter="archived"]').filter({ visible: true }).click();

    await openMasterSheetFromProjectList(page, projectName);

    await expect(page.locator("#workStatusPendingList")).toContainText("Pintura E2E arquivado");

    const statusButtons = page
      .locator(".work-status-item-card")
      .filter({ hasText: "Pintura E2E arquivado" })
      .getByRole("button");

    await expect(statusButtons).toHaveCount(1);

    for (const button of await statusButtons.all()) {
      await expect(button).toBeDisabled();
    }

    // Archived project: no new weekly report can be started from here either.
    await expect(page.locator("#workStatusGenerateReportBtn")).toBeHidden();

    // Nor can the editable Fase/Progresso/Resumo panel be touched.
    await expect(page.locator("#workStatusProgressSlider")).toBeDisabled();
    await expect(page.locator("#workStatusSummary")).toBeDisabled();
    await expect(page.locator("#workStatusSaveBtn")).toBeHidden();
    await expect(page.locator("#workStatusAddWorkItemBtn")).toBeHidden();
  });

  test("Fase atual / Progresso geral / Resumo da obra stay a local draft until saved, warn before leaving unsaved, and feed the weekly report once saved", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const timestamp = Date.now();
    const projectName = `E2E Master Sheet Editable ${timestamp}`;
    const clientName = `E2E Master Sheet Editable Client ${timestamp}`;

    const client = getServiceRoleClient();
    const company = await ensureE2ECompany();
    const testClient = await insertTestClient(client, company.id, clientName);
    const project = await insertTestProject(client, company.id, testClient.id, projectName);

    // phase "Acabamentos" / 20% — the report-derived fallback, only used until
    // something is actually saved to Estado da Obra.
    await insertTestReport(client, {
      projectId: project.id,
      reportNum: 1,
      reportDate: "2026-08-10",
      progressPct: 20,
      works: [],
      incidents: [],
    });

    await login(page);
    await openMasterSheetFromProjectList(page, projectName);

    await expect(page.locator("#workStatusProgressPct")).toHaveText("20%");
    await expect(page.locator("#workStatusSaveBtn")).toBeDisabled();

    // Edit all three fields — a local draft only, nothing saved yet.
    await page.locator('[data-work-status-phase="Cobertura"]').click();
    await page.locator("#workStatusProgressSlider").fill("77");
    await page
      .locator("#workStatusSummary")
      .fill("Resumo E2E guardado — obra em bom ritmo.");

    await expect(page.locator("#workStatusSaveHint")).toHaveText(
      /alterações por guardar/i
    );
    await expect(page.locator("#workStatusSaveBtn")).toBeEnabled();

    // Leaving now must warn, with the exact required copy — and cancelling
    // must leave the draft untouched on screen.
    await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();
    await expect(page.locator("#confirmDialogMessage")).toHaveText(
      "Existem alterações por guardar. Quer sair sem guardar?"
    );

    await page.locator('[data-confirm-action="cancel"]').click();
    await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i);
    await expect(page.locator('[data-work-status-phase="Cobertura"]')).toHaveClass(
      /selected/
    );

    // Save explicitly.
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toBe("Alterações guardadas.");
      await dialog.accept();
    });
    await page.locator("#workStatusSaveBtn").click();

    await expect(page.locator("#workStatusSaveBtn")).toBeDisabled();
    await expect(page.locator("#workStatusSaveHint")).toHaveText("");

    // Nothing unsaved now — leaving must not warn.
    await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, { timeout: 10000 });

    // Reopen — a server round-trip, not client cache — saved values survive.
    await openMasterSheetFromProjectList(page, projectName);
    await expect(page.locator("#workStatusProgressPct")).toHaveText("77%");
    await expect(page.locator('[data-work-status-phase="Cobertura"]')).toHaveClass(
      /selected/
    );
    await expect(page.locator("#workStatusSummary")).toHaveValue(
      "Resumo E2E guardado — obra em bom ritmo."
    );

    // "Gerar relatório semanal" prefills from the saved Estado da Obra state —
    // Cobertura / 77% — not the older report's own Acabamentos / 20%.
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.locator('[data-nav-action="generate-weekly-report"]').click();

    await expect(page.locator("#stepLabel")).toHaveText(/passo 1 de 9|período|periodo/i, {
      timeout: 10000,
    });

    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/passo 2 de 9|progresso/i, {
      timeout: 10000,
    });

    await expect(page.locator(".phase-option.selected")).toHaveText("Cobertura");
    await expect(page.locator("#progressPct")).toHaveText("77%");

    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();
    await expect(page.locator("#stepLabel")).toHaveText(/passo 3 de 9|resumo/i, {
      timeout: 10000,
    });

    await expect(page.locator("#weekSummary")).toHaveValue(
      "Resumo E2E guardado — obra em bom ritmo."
    );
  });
});
