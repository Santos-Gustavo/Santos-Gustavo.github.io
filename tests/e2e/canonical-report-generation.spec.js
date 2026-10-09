// tests/e2e/canonical-report-generation.spec.js
//
// ESTADO-DA-OBRA-WORKSPACE-001 Phase 4 — "Gerar relatório" is a pure export
// of the SAVED canonical Estado da Obra, built server-side by
// generate_report (supabase/migrations/20261006140000_generate_report_rpc.sql).
//
// Every content assertion re-reads reports rows from the database through the
// service-role client — never trusts what the current UI happens to show.
// Storage-path hardening (case M) lives in rls-estado-da-obra-workspace.spec.js.

import fs from "fs";
import path from "path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { APP_ENV } from "../../js/config/env.js";
import { getServiceRoleClient, hasServiceRoleEnv } from "./helpers/supabase-admin.js";
import { ensureE2ECompany } from "./helpers/e2e-fixtures.js";
import { readOpenedReport } from "./helpers/canonical-report-helper.js";
import { renderReportHtml } from "../../js/reports/report-renderer.js";

const TEST_PHOTO_PATH = path.join(__dirname, "fixtures", "test-photo.png");
const PHOTO_BUCKET = "project-photos";

const E2E_EMAIL = process.env.E2E_EMAIL || process.env.TEST_USER_EMAIL || process.env.PLAYWRIGHT_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD || process.env.TEST_USER_PASSWORD || process.env.PLAYWRIGHT_PASSWORD;
const E2E_USER_ID = process.env.E2E_USER_ID;

function missingEnv() {
  const missing = [];
  if (!hasServiceRoleEnv()) missing.push("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  if (!E2E_USER_ID) missing.push("E2E_USER_ID");
  if (!E2E_EMAIL || !E2E_PASSWORD) missing.push("E2E_EMAIL / E2E_PASSWORD");
  return missing;
}

async function login(page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");
  await expect(page.locator("#authEmail")).toBeVisible({ timeout: 10000 });
  await page.locator("#authEmail").fill(E2E_EMAIL);
  await page.locator("#authPassword").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /entrar|login|iniciar/i }).click();
  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, { timeout: 15000 });
  await page.waitForTimeout(500);
}

async function signInOwner() {
  const owner = createClient(APP_ENV.SUPABASE_URL, APP_ENV.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await owner.auth.signInWithPassword({ email: E2E_EMAIL, password: E2E_PASSWORD });
  if (error) throw error;
  return owner;
}

async function createTestProject(client, { name, status = 1 }) {
  const company = await ensureE2ECompany();

  const { data: testClient, error: clientError } = await client
    .from("clients")
    .insert({ company_id: company.id, name: `${name} Client`, address: "Rua E2E Relatório, Porto" })
    .select()
    .single();
  if (clientError) throw clientError;

  const { data: project, error: projectError } = await client
    .from("projects")
    .insert({
      company_id: company.id,
      client_id: testClient.id,
      name,
      site_address: "Rua E2E Relatório, Porto",
      type_of_work: "Fixture",
      start_date: new Date().toISOString().slice(0, 10),
      contract_num: `E2E-RG-${Date.now()}`,
      contract_value: 7500,
      status,
    })
    .select()
    .single();
  if (projectError) throw projectError;

  return { company, project, testClient };
}

function workspacePhotoPath(project, file) {
  return `${project.company_id}/${project.id}/workspace/${file}`;
}

async function seedWorkspace(client, { project, status, workItems = [], incidents = [], photos = [] }) {
  if (status) {
    const { error } = await client.from("project_status_state").insert({
      project_id: project.id,
      company_id: project.company_id,
      phase: status.phase || "",
      progress_pct: status.progressPct || 0,
      summary: status.summary || "",
      next_steps: status.nextSteps || "",
    });
    if (error) throw error;
  }

  // One row per insert so omitted keys take their column defaults; rows are
  // created in array order (snapshot ordering is created_at, id).
  for (const row of workItems) {
    const { error } = await client.from("project_work_items").insert({ project_id: project.id, ...row });
    if (error) throw error;
  }
  for (const row of incidents) {
    const { error } = await client.from("project_incidents").insert({ project_id: project.id, ...row });
    if (error) throw error;
  }
  for (const { upload, file, ...row } of photos) {
    const storagePath = workspacePhotoPath(project, file || `${crypto.randomUUID()}.png`);
    if (upload) {
      const { error: uploadError } = await client.storage
        .from(PHOTO_BUCKET)
        .upload(storagePath, fs.readFileSync(TEST_PHOTO_PATH), { contentType: "image/png", upsert: false });
      if (uploadError) throw uploadError;
    }
    const { error } = await client.from("project_photos").insert({ project_id: project.id, storage_path: storagePath, ...row });
    if (error) throw error;
  }
}

async function openWorkspace(page, projectName) {
  const projectCard = page.locator("#projectList .project-card").filter({ hasText: projectName });
  await expect(projectCard).toHaveCount(1, { timeout: 15000 });
  await projectCard.first().click();
  await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i, { timeout: 10000 });
  await expect(page.locator("#step-estado-obra")).toHaveAttribute("data-workspace-state", "ready", { timeout: 15000 });
}

// Clicks "Gerar relatório", waits for success, checks the report opened in a
// new tab and the "Relatório gerado" pop-up, then dismisses both. Returns the
// report id, plus the auto-opened tab's text when { withTabText: true }.
async function generateViaUi(page, { withTabText = false } = {}) {
  await expect(page.locator("#workStatusGenerateReportBtn")).toBeEnabled();
  const tabPromise = page.waitForEvent("popup");
  await page.locator("#workStatusGenerateReportBtn").click();
  const panel = page.locator("#workStatusReportResult");
  await expect(panel).toHaveAttribute("data-state", "success", { timeout: 20000 });
  const reportId = await panel.getAttribute("data-report-id");
  const reportNum = (await panel.locator("strong").textContent()).trim();

  await expect(page.locator("#confirmDialogTitle")).toHaveText("Relatório gerado", { timeout: 20000 });
  await expect(page.locator("#confirmDialogMessage")).toHaveText(
    `O relatório ${reportNum} foi gerado e guardado. Foi aberto num novo separador.`
  );
  await expect(page.locator('[data-confirm-action="cancel"]')).toBeHidden();
  await page.locator('[data-confirm-action="confirm"]').click();
  await expect(page.locator("#confirmDialog")).toBeHidden();

  const tab = await tabPromise;
  await expect.poll(() => tab.url(), { timeout: 15000 }).toMatch(/^blob:/);
  await tab.waitForLoadState("load");
  const tabText = withTabText ? await tab.locator("body").innerText() : null;
  await tab.close();

  return withTabText ? { reportId, tabText } : reportId;
}

async function saveWorkspace(page) {
  await expect(page.locator("#workStatusSaveBtn")).toBeEnabled();
  await page.locator("#workStatusSaveBtn").click();
  await expect(page.locator("#workStatusSaveHint")).toHaveText("Alterações guardadas.", { timeout: 15000 });
}

async function getReport(client, id) {
  const { data, error } = await client.from("reports").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function reportsForProject(client, projectId) {
  const { data, error } = await client.from("reports").select("*").eq("project_id", projectId).order("report_num");
  if (error) throw error;
  return data;
}

const workCard = (page, id) => page.locator(`.work-status-item-card[data-work-item-id="${id}"]`);
const incidentCard = (page, id) => page.locator(`.work-status-item-card[data-incident-id="${id}"]`);
const photoCard = (page, id) => page.locator(`.work-status-photo-card[data-photo-id="${id}"]`);

test.describe("ESTADO-DA-OBRA-WORKSPACE-001 Phase 4 — canonical report generation", () => {
  test.beforeEach(() => {
    const missing = missingEnv();
    if (missing.length > 0) test.skip(true, `Set ${missing.join(", ")}.`);
  });

  test("13 + C/D/E/F/L: report #N stays frozen after workspace edits; #N+1 reflects the new saved state; share link works", async ({ page, context }) => {
    test.setTimeout(150000);

    const client = getServiceRoleClient();
    const projectName = `E2E Report Gen History ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });

    const ids = {
      A: crypto.randomUUID(), // visible
      B: crypto.randomUUID(), // hidden
      C: crypto.randomUUID(), // visible
      D: crypto.randomUUID(), // deactivated
      openIncident: crypto.randomUUID(),
      hiddenIncident: crypto.randomUUID(),
      removedIncident: crypto.randomUUID(),
      photoKeep: crypto.randomUUID(),
      photoToHide: crypto.randomUUID(),
      photoHidden: crypto.randomUUID(),
      photoNotClient: crypto.randomUUID(),
      photoRemoved: crypto.randomUUID(),
    };

    await seedWorkspace(client, {
      project,
      status: { phase: "Cobertura", progressPct: 40, summary: "Resumo N", nextSteps: "Passo um\n\n  Passo dois  " },
      workItems: [
        { id: ids.A, type: "Pintura Interior", area: "Sala", description: "Tarefa A", status: "pending" },
        { id: ids.B, type: "Demolição", area: "Cave", description: "Tarefa B oculta", status: "in_progress", include_in_reports: false },
        { id: ids.C, type: "Cobertura / Telhado", area: "Exterior", description: "Tarefa C original", status: "done" },
        { id: ids.D, description: "Tarefa D removida", status: "pending", deactivated_at: new Date().toISOString() },
      ],
      incidents: [
        { id: ids.openIncident, description: "Incidente aberto original", status: "open" },
        { id: ids.hiddenIncident, description: "Incidente oculto", status: "open", include_in_reports: false },
        { id: ids.removedIncident, description: "Incidente removido", status: "open", deactivated_at: new Date().toISOString() },
      ],
      photos: [
        { id: ids.photoKeep, upload: true, description: "Foto mantida original", area: "Sala", worker: "João", stage: "after" },
        { id: ids.photoToHide, upload: true, description: "Foto a ocultar" },
        { id: ids.photoHidden, description: "Foto oculta", include_in_reports: false },
        { id: ids.photoNotClient, description: "Foto interna", is_client_visible: false },
        { id: ids.photoRemoved, description: "Foto removida", deactivated_at: new Date().toISOString() },
      ],
    });

    await login(page);
    await openWorkspace(page, projectName);

    // ---- Report #N from the saved state --------------------------------
    const reportNId = await generateViaUi(page);
    await expect(page.locator("#workStatusReportResult")).toContainText("#001");

    const reportN = await getReport(client, reportNId);
    const snapN = reportN.snapshot_json;

    expect(reportN.report_num).toBe(1);
    expect(reportN.snapshot_version).toBe(1);
    expect(snapN.snapshotVersion).toBe(1);
    expect(snapN.meta).toMatchObject({ reportId: reportNId, projectId: project.id, mode: "weekly", reportNumber: 1 });
    expect(snapN.meta.generatedAt).toBeTruthy();
    expect(snapN.project).toMatchObject({ name: projectName, clientName: `${projectName} Client`, location: "Rua E2E Relatório, Porto" });
    expect(snapN.company.name).toBeTruthy();
    expect(snapN.progress).toEqual({ phase: "Cobertura", percentage: 40, weekSummary: "Resumo N" });
    expect(snapN.nextSteps).toEqual([
      { description: "Passo um", date: null },
      { description: "Passo dois", date: null },
    ]);

    // C: hidden task absent; deactivated task absent; every status included.
    expect(snapN.works).toEqual([
      { type: "Pintura Interior", area: "Sala", description: "Tarefa A", status: "pending" },
      { type: "Cobertura / Telhado", area: "Exterior", description: "Tarefa C original", status: "done" },
    ]);
    // E: hidden and deactivated incidents absent.
    expect(snapN.incidents).toEqual({ enabled: true, items: [{ description: "Incidente aberto original", status: "open" }] });
    // F: hidden / not-client-visible / deactivated photos absent.
    expect(snapN.photos.map((p) => p.description)).toEqual(["Foto mantida original", "Foto a ocultar"]);
    expect(snapN.photos[0]).toMatchObject({
      id: null,
      area: "Sala",
      worker: "João",
      stage: "after",
      storagePath: expect.stringMatching(new RegExp(`^${project.company_id}/${project.id}/workspace/`)),
      displayUrl: "",
    });

    // Write-once legacy mirrors, in the legacy shapes/codes.
    expect(reportN.phase).toBe("Cobertura");
    expect(reportN.progress_pct).toBe(40);
    expect(reportN.week_summary).toBe("Resumo N");
    expect(reportN.incidents_on).toBe(true);
    expect(reportN.works).toEqual([
      { id: ids.A, type: "Pintura Interior", area: "Sala", desc: "Tarefa A", status: "blocked" },
      { id: ids.C, type: "Cobertura / Telhado", area: "Exterior", desc: "Tarefa C original", status: "done" },
    ]);
    expect(reportN.incidents).toEqual([{ id: ids.openIncident, desc: "Incidente aberto original", status: "open" }]);
    expect(reportN.next_steps).toEqual([
      { desc: "Passo um", date: null },
      { desc: "Passo dois", date: null },
    ]);

    // No report-scoped `photos` rows — history/share render from the snapshot.
    const { count: legacyPhotoRows } = await client.from("photos").select("id", { count: "exact", head: true }).eq("report_id", reportNId);
    expect(legacyPhotoRows).toBe(0);

    // "Ver PDF" renders THAT saved report.
    const viewN = await readOpenedReport(page, () =>
      page.locator('#workStatusReportResult [data-generated-report-action="view-pdf"]').click()
    );
    expect(viewN.text).toContain("Tarefa A");
    expect(viewN.text).toContain("Tarefa C original");
    expect(viewN.text).not.toContain("Tarefa B oculta");
    expect(viewN.text).toContain("Incidente aberto original");
    expect(viewN.text).toContain("Em aberto");
    expect(viewN.text).not.toContain("Incidente oculto");
    expect(viewN.text).toContain("Passo dois");
    expect(viewN.html).toMatch(/<div class="photo-frame">\s*<img src="https:\/\/[^"]+"/);

    // ---- Edit + save the workspace through the UI -----------------------
    await workCard(page, ids.A).locator('select[data-ws-field="status"]').selectOption("in_progress");
    await workCard(page, ids.B).getByRole("button", { name: "Mostrar no relatório" }).click();
    await workCard(page, ids.C).getByRole("button", { name: "Editar" }).click();
    await workCard(page, ids.C).locator('textarea[data-ws-field="description"]').fill("Tarefa C editada");
    await workCard(page, ids.C).getByRole("button", { name: "Concluir edição" }).click();
    await photoCard(page, ids.photoKeep).locator('input[data-ws-field="description"]').fill("Foto mantida editada");
    await photoCard(page, ids.photoToHide).getByRole("button", { name: "Ocultar do relatório" }).click();
    await incidentCard(page, ids.openIncident).getByRole("button", { name: "Editar" }).click();
    await incidentCard(page, ids.openIncident).locator('textarea[data-ws-field="description"]').fill("Incidente editado");
    await incidentCard(page, ids.openIncident).getByRole("button", { name: "Concluir edição" }).click();
    await incidentCard(page, ids.openIncident).getByRole("button", { name: "Resolver" }).click();
    await page.locator("#workStatusSummary").fill("Resumo N+1");
    await saveWorkspace(page);

    // ---- Report #N+1 -----------------------------------------------------
    const reportN1Id = await generateViaUi(page);
    await expect(page.locator("#workStatusReportResult")).toContainText("#002");

    // #N, reloaded from the DB, is byte-for-byte what was generated.
    expect(await getReport(client, reportNId)).toEqual(reportN);

    const reportN1 = await getReport(client, reportN1Id);
    const snapN1 = reportN1.snapshot_json;
    expect(reportN1.report_num).toBe(2);
    expect(snapN1.progress.weekSummary).toBe("Resumo N+1");
    // D: the restored (un-hidden) task appears; A's new status; C's new text.
    expect(snapN1.works).toEqual([
      { type: "Pintura Interior", area: "Sala", description: "Tarefa A", status: "in_progress" },
      { type: "Demolição", area: "Cave", description: "Tarefa B oculta", status: "in_progress" },
      { type: "Cobertura / Telhado", area: "Exterior", description: "Tarefa C editada", status: "done" },
    ]);
    expect(snapN1.incidents.items).toEqual([{ description: "Incidente editado", status: "resolved" }]);
    expect(snapN1.photos.map((p) => p.description)).toEqual(["Foto mantida editada"]);

    // The old report still renders its old content from history.
    const historyN = page.locator(`[data-report-history-card="${reportNId}"]`);
    await expect(historyN).toBeVisible({ timeout: 15000 });
    const reopenedN = await readOpenedReport(page, () => historyN.locator('[data-report-history-action="open"]').click());
    expect(reopenedN.text).toContain("Tarefa C original");
    expect(reopenedN.text).not.toContain("Tarefa C editada");
    expect(reopenedN.text).toContain("Foto mantida original");
    expect(reopenedN.text).not.toContain("Tarefa B oculta");

    // ---- L: client share link for the new canonical report --------------
    await expect(page.locator("#step-estado-obra")).toHaveAttribute("data-workspace-state", "ready", { timeout: 15000 });
    const reportN2Id = await generateViaUi(page); // #003, same content as #N+1
    await page.locator('#workStatusReportResult [data-generated-report-action="share"]').click();
    const shareInput = page.locator("#workStatusReportResult .share-link-input");
    await expect(shareInput).toBeVisible({ timeout: 20000 });
    const shareUrl = await shareInput.inputValue();
    expect(shareUrl).toMatch(/\/share\.html#token=/);

    const { data: links } = await client.from("report_share_links").select("report_id").eq("report_id", reportN2Id);
    expect(links).toHaveLength(1);

    const clientPage = await context.newPage();
    await clientPage.goto(shareUrl);
    const frame = clientPage.frameLocator("iframe.share-frame");
    await expect(frame.locator("body")).toContainText("Tarefa C editada", { timeout: 20000 });
    await expect(frame.locator("body")).toContainText("Resolvido");
    await expect(frame.locator(".photo-frame img")).toHaveCount(1);
    await expect(frame.locator(".photo-frame img")).toHaveAttribute("src", /^https:\/\//);
    await clientPage.close();
  });

  test("A/B: generation reads canonical tables only — legacy reports.works and project_work_item_status never leak in", async () => {
    test.setTimeout(60000);

    const client = getServiceRoleClient();
    const { project } = await createTestProject(client, { name: `E2E Report Gen Legacy ${Date.now()}` });

    const { data: legacy, error: legacyError } = await client
      .from("reports")
      .insert({
        project_id: project.id,
        report_num: 1,
        report_date: "2026-08-10",
        phase: "Fundações",
        progress_pct: 5,
        week_summary: "LEGACY SUMMARY",
        works: [{ id: crypto.randomUUID(), type: "Outro", area: "Sala", desc: "LEGACY WORK", status: "blocked" }],
        incidents: [{ id: crypto.randomUUID(), desc: "LEGACY INCIDENT" }],
        next_steps: [{ id: crypto.randomUUID(), desc: "LEGACY NEXT STEP" }],
        incidents_on: true,
        status: 0,
      })
      .select()
      .single();
    if (legacyError) throw legacyError;

    const { error: overrideError } = await client.from("project_work_item_status").insert({
      project_id: project.id,
      item_id: crypto.randomUUID(),
      status: "done",
      desc: "LEGACY OVERRIDE",
    });
    if (overrideError) throw overrideError;

    await seedWorkspace(client, {
      project,
      status: { phase: "Acabamentos", progressPct: 80, summary: "Canónico", nextSteps: "Canónico passo" },
      workItems: [{ description: "Trabalho canónico", status: "in_progress" }],
    });

    const owner = await signInOwner();
    try {
      const { data, error } = await owner.rpc("generate_report", { p_project_id: project.id });
      expect(error).toBeNull();

      const report = await getReport(client, data.id);
      expect(report.report_num).toBe(2);

      const everything = JSON.stringify(report);
      for (const legacyText of ["LEGACY WORK", "LEGACY INCIDENT", "LEGACY NEXT STEP", "LEGACY SUMMARY", "LEGACY OVERRIDE"]) {
        expect(everything).not.toContain(legacyText);
      }
      expect(report.snapshot_json.works.map((w) => w.description)).toEqual(["Trabalho canónico"]);
      expect(report.snapshot_json.incidents).toEqual({ enabled: false, items: [] });
      expect(report.incidents_on).toBe(false);
      expect(report.snapshot_json.progress).toEqual({ phase: "Acabamentos", percentage: 80, weekSummary: "Canónico" });

      // The legacy report itself is untouched.
      expect(await getReport(client, legacy.id)).toEqual(legacy);

      // The browser can't steer content: extra arguments are rejected.
      const { error: extraArgError } = await owner.rpc("generate_report", {
        p_project_id: project.id,
        p_works: [{ description: "forjado" }],
      });
      expect(extraArgError).toBeTruthy();
      expect((await reportsForProject(client, project.id)).map((r) => r.report_num)).toEqual([1, 2]);
    } finally {
      await owner.auth.signOut();
    }
  });

  test("G: an unsaved workspace never calls generate_report; Guardar alterações saves first and the report uses the saved state", async ({ page }) => {
    test.setTimeout(90000);

    const client = getServiceRoleClient();
    const projectName = `E2E Report Gen Dirty ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });
    await seedWorkspace(client, { project, status: { phase: "Fundações", progressPct: 10, summary: "Guardado" } });

    let rpcCalls = 0;
    page.on("request", (request) => {
      if (request.url().includes("/rest/v1/rpc/generate_report")) rpcCalls += 1;
    });

    await login(page);
    await openWorkspace(page, projectName);

    await page.locator("#workStatusSummary").fill("Rascunho não guardado");

    await page.locator("#workStatusGenerateReportBtn").click();
    await expect(page.locator("#confirmDialogMessage")).toHaveText(
      "Existem alterações por guardar. Guarde as alterações antes de gerar o relatório."
    );
    await expect(page.locator('[data-confirm-action="cancel"]')).toHaveText("Cancelar");
    await expect(page.locator('[data-confirm-action="confirm"]')).toHaveText("Guardar alterações");
    await page.locator('[data-confirm-action="cancel"]').click();

    await expect(page.locator("#workStatusSummary")).toHaveValue("Rascunho não guardado");
    await expect(page.locator("#workStatusReportResult")).toBeHidden();
    expect(rpcCalls).toBe(0);
    expect(await reportsForProject(client, project.id)).toEqual([]);
    const { data: unsavedState } = await client.from("project_status_state").select("summary").eq("project_id", project.id).single();
    expect(unsavedState.summary).toBe("Guardado");

    // Hold the RPC so the in-flight state is observable: editing is locked.
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/rest/v1/rpc/generate_report*", async (route) => {
      await gate;
      await route.continue();
    });

    await page.locator("#workStatusGenerateReportBtn").click();
    await page.locator('[data-confirm-action="confirm"]').click();

    await expect(page.locator("#workStatusReportResult")).toHaveAttribute("data-state", "loading", { timeout: 15000 });
    await expect(page.locator("#workStatusGenerateReportBtn")).toBeDisabled();
    await expect(page.locator("#workStatusGenerateReportBtn")).toHaveText("A gerar relatório...");
    await expect(page.locator("#workStatusSummary")).toBeDisabled();
    await expect(page.locator("#workStatusAddWorkItemBtn")).toBeHidden();
    // Saved before generating.
    const { data: savedState } = await client.from("project_status_state").select("summary").eq("project_id", project.id).single();
    expect(savedState.summary).toBe("Rascunho não guardado");

    release();
    await expect(page.locator("#workStatusReportResult")).toHaveAttribute("data-state", "success", { timeout: 20000 });
    await expect(page.locator("#workStatusSummary")).toBeEnabled();
    expect(rpcCalls).toBe(1);

    const reports = await reportsForProject(client, project.id);
    expect(reports).toHaveLength(1);
    expect(reports[0].snapshot_json.progress.weekSummary).toBe("Rascunho não guardado");
  });

  test("new tab blocked by the browser: the pop-up still confirms and offers Abrir relatório", async ({ page }) => {
    test.setTimeout(60000);

    const client = getServiceRoleClient();
    const projectName = `E2E Report Gen Blocked Tab ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });
    await seedWorkspace(client, { project, status: { phase: "Fundações", progressPct: 10, summary: "Separador bloqueado" } });

    // Simulate a popup blocker for the click-time placeholder tab only.
    await page.addInitScript(() => {
      const original = window.open;
      window.open = (url, ...rest) => (url === "" ? null : original.call(window, url, ...rest));
    });

    await login(page);
    await openWorkspace(page, projectName);
    await page.locator("#workStatusGenerateReportBtn").click();
    await expect(page.locator("#workStatusReportResult")).toHaveAttribute("data-state", "success", { timeout: 20000 });

    await expect(page.locator("#confirmDialogTitle")).toHaveText("Relatório gerado");
    await expect(page.locator("#confirmDialogMessage")).toHaveText("O relatório #001 foi gerado e guardado.");
    await expect(page.locator('[data-confirm-action="cancel"]')).toHaveText("Fechar");

    const opened = await readOpenedReport(page, () =>
      page.locator('[data-confirm-action="confirm"]', { hasText: "Abrir relatório" }).click()
    );
    expect(opened.text).toContain("Separador bloqueado");
    await expect(page.locator("#confirmDialog")).toBeHidden();
    expect((await reportsForProject(client, project.id)).map((r) => r.report_num)).toEqual([1]);
  });

  // POST-RELEASE-POLISH-001 (20261008120000_generate_report_period_choice.sql)
  // — "Período do relatório" De / Até: prefilled with the automatic period,
  // editable, validated in the UI and again by generate_report.
  test("chosen period: prefilled, editable, validated client- and server-side, frozen into the report", async ({ page }) => {
    test.setTimeout(90000);

    const client = getServiceRoleClient();
    const owner = await signInOwner();
    const projectName = `E2E Report Gen Chosen Period ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });
    await seedWorkspace(client, { project, status: { phase: "Fundações", progressPct: 10, summary: "Período escolhido" } });

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
    const shift = (isoDate, days) => {
      const [y, m, d] = isoDate.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
    };
    const pt = (isoDate) => isoDate.split("-").reverse().join("/");

    try {
      // Server-side validation: nothing is created for a bad period.
      const bad = [
        [{ p_period_start: shift(today, -3) }, /duas datas/],
        [{ p_period_start: shift(today, -1), p_period_end: shift(today, -2) }, /posterior/],
        [{ p_period_start: shift(today, -1), p_period_end: shift(today, 1) }, /depois de hoje/],
        [{ p_period_start: shift(today, -400), p_period_end: today }, /mais de um ano/],
      ];
      for (const [period, message] of bad) {
        const { data, error } = await owner.rpc("generate_report", { p_project_id: project.id, ...period });
        expect(data).toBeNull();
        expect(error?.message).toMatch(message);
      }
      expect(await reportsForProject(client, project.id)).toEqual([]);

      // Explicit dates are used as given.
      const { data: explicit, error: explicitError } = await owner.rpc("generate_report", {
        p_project_id: project.id,
        p_period_start: shift(today, -20),
        p_period_end: shift(today, -14),
      });
      expect(explicitError).toBeNull();
      expect([explicit.period_start, explicit.period_end]).toEqual([shift(today, -20), shift(today, -14)]);
      expect(explicit.snapshot_json.meta).toMatchObject({ periodStart: shift(today, -20), periodEnd: shift(today, -14) });
      expect(explicit.report_date).toBe(today);

      // UI: prefilled with the automatic period (day after #001 → today, clamped).
      let rpcCalls = 0;
      page.on("request", (request) => {
        if (request.url().includes("/rest/v1/rpc/generate_report")) rpcCalls += 1;
      });
      await login(page);
      await openWorkspace(page, projectName);
      const start = page.locator("#workStatusPeriodStart");
      const end = page.locator("#workStatusPeriodEnd");
      await expect(start).toHaveValue(today);
      await expect(end).toHaveValue(today);
      await expect(start).toBeEnabled();

      // Invalid in the UI: no RPC call, no save prompt, no tab.
      await start.fill(shift(today, -1));
      await end.fill(shift(today, -2));
      await page.locator("#workStatusGenerateReportBtn").click();
      await expect(page.locator("#workStatusReportResult")).toHaveAttribute("data-state", "error");
      await expect(page.locator("#workStatusReportResult")).toContainText("não pode ser posterior");
      await expect(page.locator("#confirmDialog")).toBeHidden();
      expect(rpcCalls).toBe(0);
      expect(page.context().pages()).toHaveLength(1);

      // Changing the dates does not make the workspace "unsaved".
      await expect(page.locator("#workStatusSaveBar")).toBeHidden();

      // A chosen period is frozen into the report and shown.
      await start.fill(shift(today, -5));
      await end.fill(shift(today, -1));
      const { reportId, tabText } = await generateViaUi(page, { withTabText: true });
      const expected = `Período ${pt(shift(today, -5))} – ${pt(shift(today, -1))}`;
      // The report itself uses the REPORT-LAYOUT-V2 wording.
      expect(tabText).toContain(`Período: ${pt(shift(today, -5))} – ${pt(shift(today, -1))}`);
      await expect(page.locator("#workStatusReportResult [data-report-period]")).toHaveText(expected);
      const saved = await getReport(client, reportId);
      expect([saved.report_num, saved.period_start, saved.period_end]).toEqual([2, shift(today, -5), shift(today, -1)]);

      // Then the fields move on to the next automatic period.
      await expect(start).toHaveValue(today);
      await expect(end).toHaveValue(today);
    } finally {
      await owner.auth.signOut();
    }
  });

  test("H: concurrent generation never duplicates report_num; a double click generates once", async ({ page }) => {
    test.setTimeout(90000);

    const client = getServiceRoleClient();
    const projectName = `E2E Report Gen Concurrency ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });
    await seedWorkspace(client, { project, status: { phase: "Fundações", progressPct: 10, summary: "Concorrência" } });

    const owner = await signInOwner();
    const ownerTab2 = await signInOwner();
    try {
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          (i % 2 ? ownerTab2 : owner).rpc("generate_report", { p_project_id: project.id })
        )
      );
      for (const { error } of results) expect(error).toBeNull();

      const nums = results.map(({ data }) => data.report_num).sort((a, b) => a - b);
      expect(nums).toEqual([1, 2, 3, 4, 5, 6]);
      expect((await reportsForProject(client, project.id)).map((r) => r.report_num)).toEqual([1, 2, 3, 4, 5, 6]);
    } finally {
      await owner.auth.signOut();
      await ownerTab2.auth.signOut();
    }

    await login(page);
    await openWorkspace(page, projectName);
    await page.locator("#workStatusGenerateReportBtn").dblclick();
    await expect(page.locator("#workStatusReportResult")).toHaveAttribute("data-state", "success", { timeout: 20000 });
    await expect(page.locator("#workStatusReportResult")).toContainText("#007");
    await page.waitForTimeout(1500);
    expect((await reportsForProject(client, project.id)).map((r) => r.report_num)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("I: a failed generation leaves no report, no report-photo rows and consumes no number", async () => {
    test.setTimeout(60000);

    const client = getServiceRoleClient();
    const { project } = await createTestProject(client, { name: `E2E Report Gen Failure ${Date.now()}` });
    await seedWorkspace(client, {
      project,
      status: { phase: "Fundações", progressPct: 10, summary: "Falha" },
      workItems: [{ description: "Trabalho", status: "pending" }],
      photos: [{ description: "Foto" }],
    });

    // Re-home the project under a second company of the same owner: its
    // existing photo path (still under the original company folder) is now
    // outside {company_id}/{project_id}/, so generate_report must abort.
    const { data: secondCompany, error: companyError } = await client
      .from("companies")
      .insert({ owner_id: E2E_USER_ID, name: `E2E Report Gen Second Company ${Date.now()}` })
      .select()
      .single();
    if (companyError) throw companyError;

    // projects (client_id, company_id) must reference a client of the same
    // company, so the move needs a client in the second company too.
    const { data: secondClient, error: secondClientError } = await client
      .from("clients")
      .insert({ company_id: secondCompany.id, name: "E2E Report Gen Second Client" })
      .select()
      .single();
    if (secondClientError) throw secondClientError;

    const owner = await signInOwner();
    try {
      const { error: moveError } = await client
        .from("projects")
        .update({ company_id: secondCompany.id, client_id: secondClient.id })
        .eq("id", project.id);
      if (moveError) throw moveError;

      const { data, error } = await owner.rpc("generate_report", { p_project_id: project.id });
      expect(data).toBeNull();
      expect(error).toBeTruthy();
      expect(error.message).toMatch(/fora da pasta/i);

      expect(await reportsForProject(client, project.id)).toEqual([]);
    } finally {
      await client.from("projects").update({ company_id: project.company_id, client_id: project.client_id }).eq("id", project.id);
      await client.from("clients").delete().eq("id", secondClient.id);
      await client.from("companies").delete().eq("id", secondCompany.id);
    }

    try {
      const { data, error } = await owner.rpc("generate_report", { p_project_id: project.id });
      expect(error).toBeNull();
      expect(data.report_num).toBe(1);
      const { count } = await client.from("photos").select("id", { count: "exact", head: true }).eq("report_id", data.id);
      expect(count).toBe(0);
    } finally {
      await owner.auth.signOut();
    }
  });

  test("J: archived/completed projects cannot generate; another owner and anon cannot either", async ({ page }) => {
    test.setTimeout(90000);

    const client = getServiceRoleClient();
    const stamp = Date.now();
    const { project: archived } = await createTestProject(client, { name: `E2E Report Gen Archived ${stamp}`, status: 5 });
    const { project: completed } = await createTestProject(client, { name: `E2E Report Gen Completed ${stamp}`, status: 3 });
    const { project: paused } = await createTestProject(client, { name: `E2E Report Gen Paused ${stamp}`, status: 2 });

    const owner = await signInOwner();
    try {
      const archivedResult = await owner.rpc("generate_report", { p_project_id: archived.id });
      expect(archivedResult.error?.message).toMatch(/arquivado/i);

      const completedResult = await owner.rpc("generate_report", { p_project_id: completed.id });
      expect(completedResult.error?.message).toMatch(/em curso ou pausadas/i);

      const pausedResult = await owner.rpc("generate_report", { p_project_id: paused.id });
      expect(pausedResult.error).toBeNull();
      expect(pausedResult.data.report_num).toBe(1);
    } finally {
      await owner.auth.signOut();
    }

    const otherEmail = process.env.E2E_OTHER_EMAIL?.trim();
    const otherPassword = process.env.E2E_OTHER_PASSWORD;
    if (otherEmail && otherPassword) {
      const other = createClient(APP_ENV.SUPABASE_URL, APP_ENV.SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await other.auth.signInWithPassword({ email: otherEmail, password: otherPassword });
      const crossResult = await other.rpc("generate_report", { p_project_id: paused.id });
      expect(crossResult.error?.message).toMatch(/sem permissão/i);
      await other.auth.signOut();
    }

    const anon = createClient(APP_ENV.SUPABASE_URL, APP_ENV.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anonResult = await anon.rpc("generate_report", { p_project_id: paused.id });
    expect(anonResult.error).toBeTruthy();

    expect(await reportsForProject(client, archived.id)).toEqual([]);
    expect(await reportsForProject(client, completed.id)).toEqual([]);
    expect((await reportsForProject(client, paused.id)).map((r) => r.report_num)).toEqual([1]);

    // UI: no "Gerar relatório" on an archived project.
    await login(page);
    await page.locator('[data-project-filter="archived"]').filter({ visible: true }).click();
    await openWorkspace(page, archived.name);
    await expect(page.locator("#workStatusGenerateReportBtn")).toBeHidden();
  });

  test("K: a pre-Phase-4 report (legacy snapshot shape) still opens from history and shares", async ({ page, context }) => {
    test.setTimeout(90000);

    const client = getServiceRoleClient();
    const projectName = `E2E Report Gen Old Report ${Date.now()}`;
    const { project, company, testClient } = await createTestProject(client, { name: projectName });

    // Exactly what report-document-builder.js wrote before Phase 4: legacy
    // status codes, incidents without status, photo under .../reports/{id}/.
    const reportId = crypto.randomUUID();
    const oldPhotoPath = `${project.company_id}/${project.id}/reports/${reportId}/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await client.storage
      .from(PHOTO_BUCKET)
      .upload(oldPhotoPath, fs.readFileSync(TEST_PHOTO_PATH), { contentType: "image/png" });
    if (uploadError) throw uploadError;

    const legacySnapshot = {
      schemaVersion: 1,
      meta: { reportId, projectId: project.id, mode: "weekly", reportNumber: "1", reportDate: "2026-08-20", periodStart: "2026-08-13", periodEnd: "2026-08-20", generatedAt: "2026-08-20T10:00:00.000Z" },
      company: { id: company.id, name: "Empresa Antiga", tagline: "Slogan antigo", nif: "", impic: "", responsible: "", phone: "", email: "" },
      project: { id: project.id, clientId: testClient.id, name: projectName, clientName: testClient.name, location: "Porto", contractNumber: "OLD-1", contractValue: 1000 },
      progress: { phase: "Estrutura e Alvenaria", percentage: 30, weekSummary: "Resumo do relatório antigo" },
      alert: { enabled: true, title: "Decisão antiga", description: "Escolher azulejo", deadline: "2026-08-25", consequence: "Atraso" },
      incidents: { enabled: true, items: [{ description: "Incidente antigo" }] },
      works: [
        { type: "Alvenaria / Paredes", area: "Sala", description: "Antigo concluído", status: "done" },
        { type: "Canalização / Hidráulica", area: "Cozinha", description: "Antigo em curso", status: "progress" },
        { type: "Pintura Interior", area: "Quarto 1", description: "Antigo pendente", status: "blocked" },
      ],
      photos: [{ id: crypto.randomUUID(), area: "Sala", description: "Foto antiga", worker: "Rui", stage: "during", storagePath: oldPhotoPath, displayUrl: "" }],
      extras: [],
      nextSteps: [{ description: "Passo antigo", date: "2026-08-27" }],
      financialNote: "",
    };

    const { error: insertError } = await client.from("reports").insert({
      id: reportId,
      project_id: project.id,
      report_num: 1,
      report_date: "2026-08-20",
      works: [],
      snapshot_json: legacySnapshot,
      status: 0,
    });
    if (insertError) throw insertError;

    // The old-style object has no photos row, so teardown wouldn't remove it.
    try {
    await login(page);
    await openWorkspace(page, projectName);
    const card = page.locator(`[data-report-history-card="${reportId}"]`);
    await expect(card).toBeVisible({ timeout: 15000 });

    const opened = await readOpenedReport(page, () => card.locator('[data-report-history-action="open"]').click());
    for (const text of ["Resumo do relatório antigo", "Antigo concluído", "Antigo em curso", "Antigo pendente", "Incidente antigo", "Passo antigo", "Decisão antiga", "Slogan antigo"]) {
      expect(opened.text).toContain(text);
    }
    // Legacy status codes keep their legacy labels/styling; no new status tags.
    expect(opened.html).toContain('<span class="work-tag blocked">');
    expect(opened.html).toContain('<span class="work-tag progress">');
    expect(opened.html).not.toContain("Em aberto");
    // Legacy reports never displayed their (wizard-prefilled) period.
    expect(opened.html).not.toContain("data-report-period");
    expect(opened.html).toMatch(/<div class="photo-frame">\s*<img src="https:\/\/[^"]+"/);

    // A canonical snapshot with the new vocabulary renders with the same
    // labels/styling as its legacy equivalent.
    const asCanonical = {
      ...legacySnapshot,
      works: legacySnapshot.works.map((w) => ({ ...w, status: { blocked: "pending", progress: "in_progress", done: "done" }[w.status] })),
    };
    expect(renderReportHtml(asCanonical)).toBe(renderReportHtml(legacySnapshot));

    // Old reports still share.
    await card.locator('[data-report-history-action="create-share-link"]').click();
    const shareUrl = await card.locator(".share-link-input").inputValue();
    const clientPage = await context.newPage();
    await clientPage.goto(shareUrl);
    await expect(clientPage.frameLocator("iframe.share-frame").locator("body")).toContainText("Resumo do relatório antigo", { timeout: 20000 });
    await clientPage.close();
    } finally {
      await client.storage.from(PHOTO_BUCKET).remove([oldPhotoPath]);
    }
  });

  // The Phase 2 backfill copied the latest legacy report's photos into
  // project_photos at their original .../reports/{report_id}/... path. Those
  // rows must keep generating reports, and the backfill must be able to
  // re-create them — without opening the door to any other non-workspace path.
  test("legacy-path canonical photo: accepted for its own project, included in generated reports; other legacy-looking paths rejected", async ({ page }) => {
    test.setTimeout(90000);

    const client = getServiceRoleClient();
    const owner = await signInOwner();
    const stamp = Date.now();
    const { project } = await createTestProject(client, { name: `E2E Report Gen Legacy Photo ${stamp}` });
    const { project: otherProject } = await createTestProject(client, { name: `E2E Report Gen Legacy Photo Other ${stamp}` });

    async function legacyReportWithPhoto(target) {
      const reportId = crypto.randomUUID();
      const storagePath = `${target.company_id}/${target.id}/reports/${reportId}/${crypto.randomUUID()}.png`;
      const { error: reportError } = await client
        .from("reports")
        .insert({ id: reportId, project_id: target.id, report_num: 1, report_date: "2026-08-20", works: [], status: 0 });
      if (reportError) throw reportError;
      const { error: uploadError } = await client.storage
        .from(PHOTO_BUCKET)
        .upload(storagePath, fs.readFileSync(TEST_PHOTO_PATH), { contentType: "image/png" });
      if (uploadError) throw uploadError;
      const { error: photoError } = await client
        .from("photos")
        .insert({ report_id: reportId, storage_path: storagePath, description: "Foto migrada", stage: 0 });
      if (photoError) throw photoError;
      return { reportId, storagePath };
    }

    const own = await legacyReportWithPhoto(project);
    const foreign = await legacyReportWithPhoto(otherProject);

    try {
      // Exactly the backfill's row shape, written as the owner (RLS + trigger).
      const legacyRowId = crypto.randomUUID();
      const { error: legacyInsertError } = await owner.from("project_photos").insert({
        id: legacyRowId,
        project_id: project.id,
        storage_path: own.storagePath,
        description: "Foto migrada",
        stage: "during",
        include_in_reports: true,
        is_client_visible: true,
      });
      expect(legacyInsertError).toBeNull();

      // Same-value rewrite (the old backfill upsert) is a no-op for the trigger.
      const { error: rewriteError } = await client
        .from("project_photos")
        .update({ storage_path: own.storagePath, description: "Foto migrada" })
        .eq("id", legacyRowId);
      expect(rewriteError).toBeNull();

      const rejected = {
        "legacy-looking path with no legacy photos row": `${project.company_id}/${project.id}/reports/${own.reportId}/${crypto.randomUUID()}.png`,
        "another project's legacy photo": foreign.storagePath,
        "another project's legacy photo re-prefixed into this project": `${project.company_id}/${project.id}/reports/${foreign.reportId}/${foreign.storagePath.split("/").pop()}`,
      };
      for (const [label, storagePath] of Object.entries(rejected)) {
        const { error } = await owner.from("project_photos").insert({ project_id: project.id, storage_path: storagePath });
        expect(error, `insert with ${label} must fail`).toBeTruthy();
        const { error: updateError } = await owner.from("project_photos").update({ storage_path: storagePath }).eq("id", legacyRowId);
        expect(updateError, `re-point to ${label} must fail`).toBeTruthy();
      }
      const { error: moveError } = await owner.from("project_photos").update({ project_id: otherProject.id }).eq("id", legacyRowId);
      expect(moveError).toBeTruthy();

      const { data: stillLegacy } = await client.from("project_photos").select("project_id, storage_path").eq("id", legacyRowId).single();
      expect(stillLegacy).toEqual({ project_id: project.id, storage_path: own.storagePath });

      // generate_report accepts it and freezes the legacy path into the snapshot.
      const { data, error } = await owner.rpc("generate_report", { p_project_id: project.id });
      expect(error).toBeNull();
      const generated = Array.isArray(data) ? data[0] : data;
      expect(generated.report_num).toBe(2);
      expect(generated.snapshot_json.photos).toEqual([
        expect.objectContaining({ storagePath: own.storagePath, description: "Foto migrada" }),
      ]);

      // ... and the report renders the photo.
      await login(page);
      await openWorkspace(page, project.name);
      const card = page.locator(`[data-report-history-card="${generated.id}"]`);
      await expect(card).toBeVisible({ timeout: 15000 });
      const opened = await readOpenedReport(page, () => card.locator('[data-report-history-action="open"]').click());
      expect(opened.text).toContain("Foto migrada");
      expect(opened.html).toMatch(/<div class="photo-frame">\s*<img src="https:\/\/[^"]+"/);
    } finally {
      await client.storage.from(PHOTO_BUCKET).remove([own.storagePath, foreign.storagePath]);
      await owner.auth.signOut();
    }
  });

  // POST-RELEASE-POLISH-001 (20261007120000_generate_report_period.sql) — the
  // period is derived server-side: first report = last 7 days; afterwards from
  // the day after the previous non-deleted report up to today. Frozen once
  // generated; shown on canonical reports and in the success panel.
  test("period: derived server-side from the previous report, frozen, and shown on the report", async ({ page }) => {
    test.setTimeout(90000);

    const client = getServiceRoleClient();
    const owner = await signInOwner();
    const projectName = `E2E Report Gen Period ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });

    const shift = (isoDate, days) => {
      const [y, m, d] = isoDate.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
    };
    const pt = (isoDate) => isoDate.split("-").reverse().join("/");
    const generate = async () => {
      const { data, error } = await owner.rpc("generate_report", { p_project_id: project.id });
      expect(error).toBeNull();
      return Array.isArray(data) ? data[0] : data;
    };

    try {
      // First report: the 7 days up to today.
      const first = await generate();
      const today = first.report_date;
      expect(first.period_end).toBe(today);
      expect(first.period_start).toBe(shift(today, -7));
      expect(first.snapshot_json.meta).toMatchObject({ periodStart: first.period_start, periodEnd: today });

      // Same day again: starts the day after the previous report, clamped to today.
      const second = await generate();
      expect([second.period_start, second.period_end]).toEqual([today, today]);

      // A legacy report as the previous one: starts the day after its date.
      const { error: legacyError } = await client.from("reports").insert({
        project_id: project.id,
        report_num: 3,
        report_date: shift(today, -10),
        period_start: shift(today, -40),
        period_end: shift(today, 30),
        works: [],
        status: 0,
      });
      if (legacyError) throw legacyError;
      const fourth = await generate();
      expect(fourth.report_num).toBe(4);
      expect([fourth.period_start, fourth.period_end]).toEqual([shift(today, -9), today]);

      // A soft-deleted report is not "the previous report".
      await client.from("reports").update({ deleted_at: new Date().toISOString() }).eq("id", fourth.id);
      const fifth = await generate();
      expect([fifth.period_start, fifth.period_end]).toEqual([shift(today, -9), today]);

      // Frozen once generated.
      for (const patch of [{ period_start: shift(today, -1) }, { period_end: shift(today, 1) }]) {
        const { error } = await owner.from("reports").update(patch).eq("id", first.id);
        expect(error, `update ${Object.keys(patch)[0]} must fail`).toBeTruthy();
      }
      const { data: firstAgain } = await client.from("reports").select("period_start, period_end").eq("id", first.id).single();
      expect(firstAgain).toEqual({ period_start: shift(today, -7), period_end: today });

      // UI: success panel and the rendered report show the period.
      await login(page);
      await openWorkspace(page, projectName);
      const { reportId, tabText } = await generateViaUi(page, { withTabText: true });
      const expected = `Período ${pt(today)} – ${pt(today)}`;
      // The report auto-opened in a new tab is the saved #006.
      // REPORT-LAYOUT-V2: the report says "N.º 006" and a same-day period is one date.
      expect(tabText).toContain("N.º 006");
      expect(tabText).toContain(`Período: ${pt(today)}`);
      expect(tabText).not.toContain(`${pt(today)} – ${pt(today)}`);
      await expect(page.locator("#workStatusReportResult [data-report-period]")).toHaveText(expected);
      const viewed = await readOpenedReport(page, () =>
        page.locator('#workStatusReportResult [data-generated-report-action="view-pdf"]').click()
      );
      expect(viewed.text).toContain(`Período: ${pt(today)}`);
      expect((await getReport(client, reportId)).report_num).toBe(6);

      // An older report opened from history shows its own frozen period.
      const card = page.locator(`[data-report-history-card="${first.id}"]`);
      await expect(card).toBeVisible({ timeout: 15000 });
      const opened = await readOpenedReport(page, () => card.locator('[data-report-history-action="open"]').click());
      expect(opened.text).toContain(`Período: ${pt(shift(today, -7))} – ${pt(today)}`);
    } finally {
      await owner.auth.signOut();
    }
  });
});

if (!fs.existsSync(TEST_PHOTO_PATH)) {
  throw new Error(`Missing test fixture: ${TEST_PHOTO_PATH}`);
}
