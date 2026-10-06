// tests/e2e/project-master-sheet.spec.js
//
// ESTADO-DA-OBRA-WORKSPACE-001 — Estado da Obra as the canonical project
// workspace. Seeds canonical rows (project_status_state / project_work_items /
// project_incidents / project_photos) directly via the service-role client,
// drives the real UI as the logged-in owner, and verifies persisted state via
// the service-role client — so "nothing persisted before Guardar" and
// "Guardar persisted exactly this" are checked against the database itself,
// not against client state.
//
// Replaces the PROJECT-MASTER-SHEET-001 expectations (state consolidated from
// reports.works, quick-tap status changes persisting immediately): those
// behaviors no longer exist.

import fs from "fs";
import path from "path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { APP_ENV } from "../../js/config/env.js";
import { getServiceRoleClient, hasServiceRoleEnv } from "./helpers/supabase-admin.js";
import { ensureE2ECompany } from "./helpers/e2e-fixtures.js";

// Same pattern as project-archived-photo-evidence.spec.js — Playwright loads
// specs as CommonJS here, so __dirname is available and import.meta is not.
const TEST_PHOTO_PATH = path.join(__dirname, "fixtures", "test-photo.png");

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

const PHOTO_BUCKET = "project-photos";

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

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, { timeout: 15000 });

  await page.waitForTimeout(500);
}

async function createTestProject(client, { name, status = 1 }) {
  const company = await ensureE2ECompany();

  const { data: testClient, error: clientError } = await client
    .from("clients")
    .insert({ company_id: company.id, name: `${name} Client`, address: "Rua E2E Workspace, Porto" })
    .select()
    .single();
  if (clientError) throw clientError;

  const { data: project, error: projectError } = await client
    .from("projects")
    .insert({
      company_id: company.id,
      client_id: testClient.id,
      name,
      site_address: "Rua E2E Workspace, Porto",
      type_of_work: "Fixture",
      start_date: new Date().toISOString().slice(0, 10),
      contract_num: `E2E-WS-${Date.now()}`,
      contract_value: 5000,
      status,
    })
    .select()
    .single();
  if (projectError) throw projectError;

  return { company, project };
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

  // One row per insert: a PostgREST bulk insert whose rows have different key
  // sets sends NULL (not the column default) for each row's missing keys.
  const inserts = [
    ...workItems.map((row) => ["project_work_items", row]),
    ...incidents.map((row) => ["project_incidents", row]),
    ...photos.map((row) => ["project_photos", row]),
  ];

  for (const [table, row] of inserts) {
    const payload = { project_id: project.id, ...row };
    if (table === "project_photos") payload.storage_path = workspacePhotoPath(project, row.storage_path);
    const { error } = await client.from(table).insert(payload);
    if (error) throw error;
  }
}

// Phase 4 — project_photos.storage_path must live in the project's own
// workspace folder (trg_project_photos_storage_path), so seeds only name the file.
function workspacePhotoPath(project, name) {
  const file = String(name || `${crypto.randomUUID()}.jpg`).replace(/\//g, "-");
  return `${project.company_id}/${project.id}/workspace/${file}`;
}

// A legacy report + project_work_item_status override on the same project:
// Estado da Obra must ignore both for display, and must never write to them.
async function seedLegacyState(client, project) {
  const { data: report, error } = await client
    .from("reports")
    .insert({
      project_id: project.id,
      report_num: 1,
      report_date: "2026-08-10",
      distributed_to: "Cliente",
      sent_via: 1,
      phase: "Fundações",
      progress_pct: 5,
      week_summary: "Resumo legado E2E",
      works: [{ id: crypto.randomUUID(), type: "Outro", area: "Sala", desc: "LEGACY WORK — must not render", status: "blocked" }],
      incidents: [{ id: crypto.randomUUID(), desc: "LEGACY INCIDENT — must not render" }],
      extras: [],
      next_steps: [{ id: crypto.randomUUID(), desc: "LEGACY NEXT STEP — must not render" }],
      status: 0,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: overrideError } = await client.from("project_work_item_status").insert({
    project_id: project.id,
    item_id: crypto.randomUUID(),
    status: "done",
    desc: "LEGACY OVERRIDE ITEM — must not render",
  });
  if (overrideError) throw overrideError;

  return report;
}

async function snapshotLegacy(client, projectId) {
  const [{ data: reports }, { data: overrides }] = await Promise.all([
    client.from("reports").select("*").eq("project_id", projectId).order("id"),
    client.from("project_work_item_status").select("*").eq("project_id", projectId).order("id"),
  ]);

  return JSON.stringify({ reports, overrides });
}

async function openWorkspace(page, projectName, { archivedFilter = false } = {}) {
  if (archivedFilter) {
    await page.locator('[data-project-filter="archived"]').filter({ visible: true }).click();
  }

  const projectCard = page.locator("#projectList .project-card").filter({ hasText: projectName });
  await expect(projectCard).toHaveCount(1, { timeout: 15000 });
  await projectCard.first().click();

  await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i, { timeout: 10000 });
  await expect(page.locator("#workStatusProjectLabel")).toHaveText(projectName);
  // Controls are read-only until the canonical workspace has loaded.
  await expect(page.locator("#step-estado-obra")).toHaveAttribute("data-workspace-state", "ready", { timeout: 15000 });
}

async function backToProjects(page) {
  await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();
  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, { timeout: 10000 });
}

async function saveWorkspace(page) {
  await expect(page.locator("#workStatusSaveBtn")).toBeEnabled();
  await page.locator("#workStatusSaveBtn").click();
  await expect(page.locator("#workStatusSaveHint")).toHaveText("Alterações guardadas.", { timeout: 15000 });
  await expect(page.locator("#workStatusSaveBtn")).toBeDisabled();
}

function workCard(page, id) {
  return page.locator(`.work-status-item-card[data-work-item-id="${id}"]`);
}

function incidentCard(page, id) {
  return page.locator(`.work-status-item-card[data-incident-id="${id}"]`);
}

async function getRow(client, table, id) {
  const { data, error } = await client.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

test.describe("ESTADO-DA-OBRA-WORKSPACE-001 — Estado da Obra canonical workspace", () => {
  test.beforeEach(() => {
    const missing = missingEnv();
    if (missing.length > 0) {
      test.skip(true, `Set ${missing.join(", ")}.`);
    }
  });

  test("A/I: renders only canonical state, ignores legacy reports/overrides, and has no immediate quick-tap", async ({ page }) => {
    test.setTimeout(60000);

    const client = getServiceRoleClient();
    const projectName = `E2E Workspace Load ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });

    await seedLegacyState(client, project);

    const ids = {
      pending: crypto.randomUUID(),
      progress: crypto.randomUUID(),
      doneHidden: crypto.randomUUID(),
      removed: crypto.randomUUID(),
      openIncident: crypto.randomUUID(),
      resolvedIncident: crypto.randomUUID(),
      removedIncident: crypto.randomUUID(),
    };

    await seedWorkspace(client, {
      project,
      status: {
        phase: "Cobertura",
        progressPct: 40,
        summary: "Resumo canónico E2E",
        nextSteps: "Passo canónico A\nPasso canónico B",
      },
      workItems: [
        { id: ids.pending, type: "Pintura Interior", area: "Sala", description: "Canon pendente", status: "pending" },
        { id: ids.progress, type: "Outro", area: "Cozinha", description: "Canon em curso", status: "in_progress" },
        { id: ids.doneHidden, type: "Outro", area: "Exterior", description: "Canon concluída oculta", status: "done", include_in_reports: false },
        { id: ids.removed, description: "Canon removida", status: "pending", deactivated_at: new Date().toISOString() },
      ],
      incidents: [
        { id: ids.openIncident, description: "Canon incidente aberto", status: "open" },
        { id: ids.resolvedIncident, description: "Canon incidente resolvido", status: "resolved", resolved_at: new Date().toISOString() },
        { id: ids.removedIncident, description: "Canon incidente removido", status: "open", deactivated_at: new Date().toISOString() },
      ],
      photos: [
        { storage_path: `e2e-workspace-load/${Date.now()}.jpg`, description: "Canon foto legenda", stage: "after" },
      ],
    });

    await login(page);
    await openWorkspace(page, projectName);

    await expect(page.locator("#workStatusProgressPct")).toHaveText("40%");
    await expect(page.locator('[data-work-status-phase="Cobertura"]')).toHaveClass(/selected/);
    await expect(page.locator("#workStatusSummary")).toHaveValue("Resumo canónico E2E");
    await expect(page.locator("#workStatusNextSteps")).toHaveValue("Passo canónico A\nPasso canónico B");

    await expect(page.locator("#workStatusPendingList")).toContainText("Canon pendente");
    await expect(page.locator("#workStatusProgressList")).toContainText("Canon em curso");
    await expect(page.locator("#workStatusDoneList")).toContainText("Canon concluída oculta");
    await expect(workCard(page, ids.doneHidden)).toContainText("Oculto dos próximos relatórios");
    await expect(workCard(page, ids.pending)).not.toContainText("Oculto dos próximos relatórios");

    // Deactivated rows never render.
    await expect(page.locator("#step-estado-obra")).not.toContainText("Canon removida");
    await expect(page.locator("#step-estado-obra")).not.toContainText("Canon incidente removido");

    // Legacy report/override state is not merged in any more.
    await expect(page.locator("#step-estado-obra")).not.toContainText("LEGACY");

    await expect(incidentCard(page, ids.openIncident)).toContainText("Em aberto");
    await expect(incidentCard(page, ids.resolvedIncident)).toContainText("Resolvido");

    await expect(page.locator("#workStatusPhotosHeading")).toHaveText("Fotografias (1)");
    await expect(page.locator('#workStatusPhotosList input[data-ws-field="description"]')).toHaveValue("Canon foto legenda");

    // I: the old one-tap "Marcar como concluída"/"Reabrir" persist-immediately
    // control is gone; nothing is dirty on open.
    await expect(page.getByRole("button", { name: "Marcar como concluída" })).toHaveCount(0);
    await expect(page.locator("#workStatusSaveBtn")).toBeDisabled();
  });

  test("B/C: phase/progress/summary/next steps persist only via Guardar; unsaved edits are lost on reload", async ({ page }) => {
    test.setTimeout(60000);

    const client = getServiceRoleClient();
    const projectName = `E2E Workspace Save ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });

    await login(page);
    await openWorkspace(page, projectName);

    await expect(page.locator("#workStatusProgressPct")).toHaveText("0%");
    await expect(page.locator("#workStatusSaveBtn")).toBeDisabled();

    // C: edit everything, then reload without saving.
    await page.locator('[data-work-status-phase="Instalações"]').click();
    await page.locator("#workStatusProgressSlider").fill("33");
    await page.locator("#workStatusSummary").fill("Rascunho nunca guardado");
    await page.locator("#workStatusNextSteps").fill("Passo nunca guardado");
    await expect(page.locator("#workStatusSaveHint")).toHaveText(/alterações por guardar/i);

    page.once("dialog", (dialog) => dialog.accept()); // beforeunload
    await page.reload();
    await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, { timeout: 15000 });

    const { data: afterReload } = await client
      .from("project_status_state")
      .select("*")
      .eq("project_id", project.id)
      .maybeSingle();
    expect(afterReload).toBeNull();

    await openWorkspace(page, projectName);
    await expect(page.locator("#workStatusProgressPct")).toHaveText("0%");
    await expect(page.locator("#workStatusSummary")).toHaveValue("");
    await expect(page.locator("#workStatusNextSteps")).toHaveValue("");

    // B: edit and save explicitly.
    await page.locator('[data-work-status-phase="Cobertura"]').click();
    await page.locator("#workStatusProgressSlider").fill("77");
    await page.locator("#workStatusSummary").fill("Resumo E2E guardado");
    await page.locator("#workStatusNextSteps").fill("Encomendar azulejos\nAgendar inspeção");

    await saveWorkspace(page);

    const { data: saved } = await client
      .from("project_status_state")
      .select("*")
      .eq("project_id", project.id)
      .single();
    expect(saved).toMatchObject({
      phase: "Cobertura",
      progress_pct: 77,
      summary: "Resumo E2E guardado",
      next_steps: "Encomendar azulejos\nAgendar inspeção",
    });

    await page.reload();
    await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, { timeout: 15000 });
    await openWorkspace(page, projectName);

    await expect(page.locator("#workStatusProgressPct")).toHaveText("77%");
    await expect(page.locator('[data-work-status-phase="Cobertura"]')).toHaveClass(/selected/);
    await expect(page.locator("#workStatusSummary")).toHaveValue("Resumo E2E guardado");
    await expect(page.locator("#workStatusNextSteps")).toHaveValue("Encomendar azulejos\nAgendar inspeção");
  });

  test("D/J: work items — add, status, edit, hide/show, remove are draft-only until Guardar; legacy tables untouched", async ({ page }) => {
    test.setTimeout(90000);

    const client = getServiceRoleClient();
    const projectName = `E2E Workspace Works ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });
    await seedLegacyState(client, project);

    const ids = {
      toProgress: crypto.randomUUID(),
      toEdit: crypto.randomUUID(),
      toHide: crypto.randomUUID(),
      toRemove: crypto.randomUUID(),
    };

    await seedWorkspace(client, {
      project,
      workItems: [
        { id: ids.toProgress, type: "Outro", area: "Sala", description: "Mudar para em curso", status: "pending" },
        { id: ids.toEdit, type: "Outro", area: "Sala", description: "Descrição original", status: "pending" },
        { id: ids.toHide, type: "Outro", area: "Sala", description: "Ocultar do relatório", status: "done" },
        { id: ids.toRemove, type: "Outro", area: "Sala", description: "Remover este trabalho", status: "in_progress" },
      ],
    });

    const legacyBefore = await snapshotLegacy(client, project.id);

    await login(page);
    await openWorkspace(page, projectName);

    // Hide then show again is a no-op: nothing to save.
    await workCard(page, ids.toHide).getByRole("button", { name: "Ocultar do relatório" }).click();
    await expect(workCard(page, ids.toHide)).toContainText("Oculto dos próximos relatórios");
    await expect(page.locator("#workStatusSaveBtn")).toBeEnabled();
    await workCard(page, ids.toHide).getByRole("button", { name: "Mostrar no relatório" }).click();
    await expect(page.locator("#workStatusSaveBtn")).toBeDisabled();

    // Add (draft only).
    await page.locator("#workStatusAddWorkItemBtn").click();
    const addForm = page.locator("#workStatusAddWorkItemForm");
    await addForm.locator('select[data-add-work-field="type"]').selectOption({ label: "Fachada / Revestimento Exterior" });
    await addForm.locator('select[data-add-work-field="area"]').selectOption({ label: "Exterior" });
    await addForm.locator('textarea[data-add-work-field="description"]').fill("Trabalho novo E2E");
    await addForm.locator('select[data-add-work-field="status"]').selectOption("in_progress");
    await addForm.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.locator("#workStatusProgressList")).toContainText("Trabalho novo E2E");

    // Status change moves the card between lists.
    await workCard(page, ids.toProgress).locator('select[data-ws-field="status"]').selectOption("in_progress");
    await expect(page.locator("#workStatusProgressList")).toContainText("Mudar para em curso");
    await expect(page.locator("#workStatusPendingList")).not.toContainText("Mudar para em curso");

    // Edit description.
    await workCard(page, ids.toEdit).getByRole("button", { name: "Editar" }).click();
    await workCard(page, ids.toEdit).locator('textarea[data-ws-field="description"]').fill("Descrição editada E2E");
    await workCard(page, ids.toEdit).getByRole("button", { name: "Concluir edição" }).click();
    await expect(workCard(page, ids.toEdit)).toContainText("Descrição editada E2E");

    // Hide (keeps status, stays visible).
    await workCard(page, ids.toHide).getByRole("button", { name: "Ocultar do relatório" }).click();
    await expect(page.locator("#workStatusDoneList")).toContainText("Ocultar do relatório");
    await expect(workCard(page, ids.toHide)).toContainText("Oculto dos próximos relatórios");

    // Remove.
    await workCard(page, ids.toRemove).getByRole("button", { name: "Remover" }).click();
    await expect(page.locator("#step-estado-obra")).not.toContainText("Remover este trabalho");

    // Nothing persisted yet.
    expect((await getRow(client, "project_work_items", ids.toProgress)).status).toBe("pending");
    expect((await getRow(client, "project_work_items", ids.toEdit)).description).toBe("Descrição original");
    expect((await getRow(client, "project_work_items", ids.toHide)).include_in_reports).toBe(true);
    expect((await getRow(client, "project_work_items", ids.toRemove)).deactivated_at).toBeNull();
    const { data: beforeSaveRows } = await client.from("project_work_items").select("id").eq("project_id", project.id);
    expect(beforeSaveRows).toHaveLength(4);

    await saveWorkspace(page);

    const progress = await getRow(client, "project_work_items", ids.toProgress);
    expect(progress.status).toBe("in_progress");

    const edited = await getRow(client, "project_work_items", ids.toEdit);
    expect(edited.description).toBe("Descrição editada E2E");
    expect(edited.status).toBe("pending");

    const hidden = await getRow(client, "project_work_items", ids.toHide);
    expect(hidden.include_in_reports).toBe(false);
    expect(hidden.status).toBe("done");
    expect(hidden.deactivated_at).toBeNull();

    const removed = await getRow(client, "project_work_items", ids.toRemove);
    expect(removed).not.toBeNull(); // soft delete — the row still exists
    expect(removed.deactivated_at).not.toBeNull();

    const { data: added } = await client
      .from("project_work_items")
      .select("*")
      .eq("project_id", project.id)
      .eq("description", "Trabalho novo E2E");
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      type: "Fachada / Revestimento Exterior",
      area: "Exterior",
      status: "in_progress",
      include_in_reports: true,
      deactivated_at: null,
    });

    // J: Estado da Obra never wrote to reports or project_work_item_status.
    expect(await snapshotLegacy(client, project.id)).toBe(legacyBefore);

    // Reopen — a server round-trip — shows the canonical result.
    await backToProjects(page);
    await openWorkspace(page, projectName);
    await expect(page.locator("#workStatusProgressList")).toContainText("Mudar para em curso");
    await expect(page.locator("#workStatusProgressList")).toContainText("Trabalho novo E2E");
    await expect(page.locator("#workStatusPendingList")).toContainText("Descrição editada E2E");
    await expect(workCard(page, ids.toHide)).toContainText("Oculto dos próximos relatórios");
    await expect(page.locator("#step-estado-obra")).not.toContainText("Remover este trabalho");
  });

  test("E: incidents — add, resolve/reopen, hide, remove are draft-only until Guardar; resolve and hide stay independent", async ({ page }) => {
    test.setTimeout(90000);

    const client = getServiceRoleClient();
    const projectName = `E2E Workspace Incidents ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });

    const ids = {
      toResolve: crypto.randomUUID(),
      toHide: crypto.randomUUID(),
      toRemove: crypto.randomUUID(),
    };

    await seedWorkspace(client, {
      project,
      incidents: [
        { id: ids.toResolve, description: "Incidente a resolver", status: "open" },
        { id: ids.toHide, description: "Incidente a ocultar", status: "open" },
        { id: ids.toRemove, description: "Incidente a remover", status: "open" },
      ],
    });

    await login(page);
    await openWorkspace(page, projectName);

    await page.locator("#workStatusAddIncidentBtn").click();
    await page.locator('#workStatusAddIncidentForm textarea[data-add-incident-field="description"]').fill("Incidente novo E2E");
    await page.locator("#workStatusAddIncidentForm").getByRole("button", { name: "Adicionar" }).click();
    await expect(page.locator("#workStatusIncidentsList")).toContainText("Incidente novo E2E");

    await incidentCard(page, ids.toResolve).getByRole("button", { name: "Resolver" }).click();
    await expect(incidentCard(page, ids.toResolve)).toContainText("Resolvido");
    await expect(incidentCard(page, ids.toResolve)).not.toContainText("Oculto dos próximos relatórios");

    await incidentCard(page, ids.toHide).getByRole("button", { name: "Editar" }).click();
    await incidentCard(page, ids.toHide).locator('textarea[data-ws-field="description"]').fill("Incidente editado E2E");
    await incidentCard(page, ids.toHide).getByRole("button", { name: "Concluir edição" }).click();
    await expect(incidentCard(page, ids.toHide)).toContainText("Incidente editado E2E");

    await incidentCard(page, ids.toHide).getByRole("button", { name: "Ocultar do relatório" }).click();
    await expect(incidentCard(page, ids.toHide)).toContainText("Oculto dos próximos relatórios");
    await expect(incidentCard(page, ids.toHide)).toContainText("Em aberto");

    await incidentCard(page, ids.toRemove).getByRole("button", { name: "Remover" }).click();
    await expect(page.locator("#workStatusIncidentsList")).not.toContainText("Incidente a remover");

    // Nothing persisted yet.
    expect((await getRow(client, "project_incidents", ids.toResolve)).status).toBe("open");
    expect((await getRow(client, "project_incidents", ids.toHide)).include_in_reports).toBe(true);
    expect((await getRow(client, "project_incidents", ids.toHide)).description).toBe("Incidente a ocultar");
    expect((await getRow(client, "project_incidents", ids.toRemove)).deactivated_at).toBeNull();

    await saveWorkspace(page);

    const resolved = await getRow(client, "project_incidents", ids.toResolve);
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_at).not.toBeNull();
    expect(resolved.include_in_reports).toBe(true); // resolving doesn't hide

    const hidden = await getRow(client, "project_incidents", ids.toHide);
    expect(hidden.include_in_reports).toBe(false);
    expect(hidden.status).toBe("open"); // hiding doesn't resolve
    expect(hidden.description).toBe("Incidente editado E2E");

    const removed = await getRow(client, "project_incidents", ids.toRemove);
    expect(removed).not.toBeNull();
    expect(removed.deactivated_at).not.toBeNull();

    const { data: added } = await client
      .from("project_incidents")
      .select("*")
      .eq("project_id", project.id)
      .eq("description", "Incidente novo E2E");
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ status: "open", include_in_reports: true, deactivated_at: null });

    // Reopen a resolved incident.
    await incidentCard(page, ids.toResolve).getByRole("button", { name: "Reabrir" }).click();
    await saveWorkspace(page);

    const reopened = await getRow(client, "project_incidents", ids.toResolve);
    expect(reopened.status).toBe("open");
    expect(reopened.resolved_at).toBeNull();
  });

  test("F: photo upload persists immediately; metadata and removal wait for Guardar; storage object is kept", async ({ page }) => {
    test.setTimeout(90000);

    const client = getServiceRoleClient();
    const projectName = `E2E Workspace Photos ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });

    await login(page);
    await openWorkspace(page, projectName);

    // Leave an unrelated unsaved edit pending — uploading must not save it.
    await page.locator("#workStatusSummary").fill("Resumo pendente durante upload");

    await page.locator("#workStatusPhotoInput").setInputFiles(TEST_PHOTO_PATH);
    await expect(page.locator("#workStatusPhotosHeading")).toHaveText("Fotografias (1)", { timeout: 20000 });

    // Persisted immediately: row + storage object exist without Guardar.
    const { data: rows } = await client.from("project_photos").select("*").eq("project_id", project.id);
    expect(rows).toHaveLength(1);
    const photo = rows[0];
    expect(photo.storage_path.startsWith(`${project.company_id}/${project.id}/workspace/`)).toBe(true);
    expect(photo.include_in_reports).toBe(true);
    expect(photo.deactivated_at).toBeNull();

    const { data: storedFile, error: downloadError } = await client.storage.from(PHOTO_BUCKET).download(photo.storage_path);
    expect(downloadError).toBeNull();
    expect(storedFile).toBeTruthy();

    // The unrelated summary edit is still a pending draft, not saved.
    await expect(page.locator("#workStatusSaveBtn")).toBeEnabled();
    const { data: statusRow } = await client.from("project_status_state").select("*").eq("project_id", project.id).maybeSingle();
    expect(statusRow).toBeNull();

    // Metadata edit — draft only.
    const photoCard = page.locator(`.work-status-photo-card[data-photo-id="${photo.id}"]`);
    await photoCard.locator('input[data-ws-field="description"]').fill("Legenda E2E");
    await photoCard.locator('select[data-ws-field="stage"]').selectOption("before");
    expect((await getRow(client, "project_photos", photo.id)).description).toBeNull();

    await saveWorkspace(page);

    const afterMeta = await getRow(client, "project_photos", photo.id);
    expect(afterMeta.description).toBe("Legenda E2E");
    expect(afterMeta.stage).toBe("before");

    // Remove — draft only, then a soft delete on Guardar.
    await photoCard.getByRole("button", { name: "Remover" }).click();
    await expect(page.locator("#workStatusPhotosHeading")).toHaveText("Fotografias (0)");
    expect((await getRow(client, "project_photos", photo.id)).deactivated_at).toBeNull();

    await saveWorkspace(page);

    const afterRemove = await getRow(client, "project_photos", photo.id);
    expect(afterRemove).not.toBeNull();
    expect(afterRemove.deactivated_at).not.toBeNull();

    // The storage object is never hard-deleted by the product.
    const { error: stillThereError } = await client.storage.from(PHOTO_BUCKET).download(photo.storage_path);
    expect(stillThereError).toBeNull();
  });

  test("G: unsaved changes guard back, Mais opções and Gerar relatório", async ({ page }) => {
    test.setTimeout(60000);

    const client = getServiceRoleClient();
    const projectName = `E2E Workspace Guard ${Date.now()}`;
    await createTestProject(client, { name: projectName });

    await login(page);
    await openWorkspace(page, projectName);

    await page.locator("#workStatusSummary").fill("Rascunho por guardar");

    // Back → leave-without-saving prompt; cancel keeps the draft.
    await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();
    await expect(page.locator("#confirmDialogMessage")).toHaveText(
      "Existem alterações por guardar. Quer sair sem guardar?"
    );
    await page.locator('[data-confirm-action="cancel"]').click();
    await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i);
    await expect(page.locator("#workStatusSummary")).toHaveValue("Rascunho por guardar");

    // Gerar relatório → "save first" dialog (Cancelar / Guardar alterações);
    // Cancelar keeps the draft and stays put. Phase 4's
    // canonical-report-generation.spec.js covers the DB side of this gate.
    await page.locator("#workStatusGenerateReportBtn").click();
    await expect(page.locator("#confirmDialogMessage")).toHaveText(
      "Existem alterações por guardar. Guarde as alterações antes de gerar o relatório."
    );
    await expect(page.locator('[data-confirm-action="cancel"]')).toHaveText("Cancelar");
    await expect(page.locator('[data-confirm-action="confirm"]')).toHaveText("Guardar alterações");
    await page.locator('[data-confirm-action="cancel"]').click();
    await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i);
    await expect(page.locator("#workStatusSummary")).toHaveValue("Rascunho por guardar");

    // Mais opções → leave prompt; confirming discards and leaves.
    await page.locator("#workStatusMoreOptionsBtn").click();
    await expect(page.locator("#confirmDialogMessage")).toHaveText(
      "Existem alterações por guardar. Quer sair sem guardar?"
    );
    await page.locator('[data-confirm-action="confirm"]').click();
    await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, { timeout: 10000 });

    // After a save, leaving doesn't prompt.
    await backToProjects(page);
    await openWorkspace(page, projectName);
    await expect(page.locator("#workStatusSummary")).toHaveValue("");
    await page.locator("#workStatusSummary").fill("Resumo guardado");
    await saveWorkspace(page);
    await backToProjects(page);
  });

  test("load race: controls stay read-only until the canonical workspace has loaded", async ({ page }) => {
    test.setTimeout(60000);

    const client = getServiceRoleClient();
    const projectName = `E2E Workspace Load Race ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });
    await seedWorkspace(client, { project, incidents: [{ description: "Incidente existente", status: "open" }] });

    await login(page);

    // Hold the incidents query so the loading window is observable.
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/rest/v1/project_incidents*", async (route) => {
      await gate;
      await route.continue();
    });

    await page.locator("#projectList .project-card").filter({ hasText: projectName }).first().click();
    await expect(page.locator("#step-estado-obra")).toHaveAttribute("data-workspace-state", "loading");

    await expect(page.locator("#workStatusSummary")).toBeDisabled();
    await expect(page.locator("#workStatusNextSteps")).toBeDisabled();
    await expect(page.locator("#workStatusProgressSlider")).toBeDisabled();
    await expect(page.locator("#workStatusAddIncidentBtn")).toBeHidden();
    await expect(page.locator("#workStatusAddWorkItemBtn")).toBeHidden();
    await expect(page.locator("#workStatusAddPhotoBtn")).toBeHidden();
    await expect(page.locator("#workStatusSaveBar")).toBeHidden();

    release();
    await expect(page.locator("#step-estado-obra")).toHaveAttribute("data-workspace-state", "ready", { timeout: 15000 });

    // Once loaded, an edit is kept (not overwritten by the late load).
    await page.locator("#workStatusAddIncidentBtn").click();
    await page.locator('#workStatusAddIncidentForm textarea[data-add-incident-field="description"]').fill("Incidente após carregar");
    await page.locator("#workStatusAddIncidentForm").getByRole("button", { name: "Adicionar" }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator("#workStatusIncidentsList")).toContainText("Incidente existente");
    await expect(page.locator("#workStatusIncidentsList")).toContainText("Incidente após carregar");
    await expect(page.locator("#workStatusSaveBtn")).toBeEnabled();
  });

  test("H: archived project is view-only in Estado da Obra and rejected by the save RPC", async ({ page }) => {
    test.setTimeout(60000);

    const client = getServiceRoleClient();
    const projectName = `E2E Workspace Archived ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName, status: 5 });

    const workId = crypto.randomUUID();
    const incidentId = crypto.randomUUID();
    await seedWorkspace(client, {
      project,
      status: { phase: "Concluído", progressPct: 100, summary: "Obra arquivada", nextSteps: "" },
      workItems: [{ id: workId, type: "Outro", area: "Sala", description: "Trabalho arquivado E2E", status: "done" }],
      incidents: [{ id: incidentId, description: "Incidente arquivado E2E", status: "open" }],
      photos: [{ storage_path: `e2e-workspace-archived/${Date.now()}.jpg`, description: "Foto arquivada" }],
    });

    await login(page);
    await openWorkspace(page, projectName, { archivedFilter: true });

    await expect(page.locator("#workStatusDoneList")).toContainText("Trabalho arquivado E2E");
    await expect(page.locator("#workStatusIncidentsList")).toContainText("Incidente arquivado E2E");

    await expect(page.locator("#workStatusProgressSlider")).toBeDisabled();
    await expect(page.locator("#workStatusSummary")).toBeDisabled();
    await expect(page.locator("#workStatusNextSteps")).toBeDisabled();
    await expect(page.locator("#workStatusPhasePicker")).toHaveClass(/is-readonly/);
    await expect(page.locator("#workStatusSaveBar")).toBeHidden();
    await expect(page.locator("#workStatusAddWorkItemBtn")).toBeHidden();
    await expect(page.locator("#workStatusAddIncidentBtn")).toBeHidden();
    await expect(page.locator("#workStatusAddPhotoBtn")).toBeHidden();
    await expect(page.locator("#workStatusGenerateReportBtn")).toBeHidden();
    await expect(page.locator("#step-estado-obra .work-status-item-actions")).toHaveCount(0);
    await expect(workCard(page, workId).locator('select[data-ws-field="status"]')).toBeDisabled();
    await expect(page.locator('#workStatusPhotosList input[data-ws-field="description"]')).toBeDisabled();

    // Server-side: the RPC itself refuses, even if the UI were bypassed.
    const owner = createClient(APP_ENV.SUPABASE_URL, APP_ENV.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await owner.auth.signInWithPassword({ email: E2E_EMAIL, password: E2E_PASSWORD });

    const { error } = await owner.rpc("save_project_workspace", {
      p_project_id: project.id,
      p_status: { phase: "Fundações", progress_pct: 1, summary: "forjado", next_steps: "" },
      p_work_items: [],
      p_incidents: [],
      p_photos: [],
    });
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/arquivado/i);

    const { data: statusRow } = await client.from("project_status_state").select("*").eq("project_id", project.id).single();
    expect(statusRow.summary).toBe("Obra arquivada");

    await owner.auth.signOut();
  });

  test("save RPC safety (K/M/N/O): cross-owner rejected, partial and empty payloads never deactivate, failure rolls back everything", async () => {
    test.setTimeout(60000);

    const otherEmail = process.env.E2E_OTHER_EMAIL?.trim();
    const otherPassword = process.env.E2E_OTHER_PASSWORD;
    test.skip(!otherEmail || !otherPassword, "Set E2E_OTHER_EMAIL / E2E_OTHER_PASSWORD for the cross-owner case.");

    const client = getServiceRoleClient();
    const projectName = `E2E Workspace RPC ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });

    const keepId = crypto.randomUUID();
    const changeId = crypto.randomUUID();
    const keepIncidentId = crypto.randomUUID();
    const keepPhotoId = crypto.randomUUID();
    await seedWorkspace(client, {
      project,
      status: { phase: "Fundações", progressPct: 10, summary: "Antes", nextSteps: "" },
      workItems: [
        { id: keepId, description: "Não enviado no payload", status: "pending" },
        { id: changeId, description: "Vai mudar", status: "pending" },
      ],
      incidents: [{ id: keepIncidentId, description: "Incidente não enviado", status: "open" }],
      photos: [{ id: keepPhotoId, storage_path: `e2e-workspace-rpc/${Date.now()}.jpg`, description: "Foto não enviada" }],
    });

    async function snapshotWorkspace() {
      const [s, w, i, p] = await Promise.all([
        client.from("project_status_state").select("*").eq("project_id", project.id).single(),
        client.from("project_work_items").select("*").eq("project_id", project.id).order("id"),
        client.from("project_incidents").select("*").eq("project_id", project.id).order("id"),
        client.from("project_photos").select("*").eq("project_id", project.id).order("id"),
      ]);
      return JSON.stringify([s.data, w.data, i.data, p.data]);
    }

    const owner = createClient(APP_ENV.SUPABASE_URL, APP_ENV.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await owner.auth.signInWithPassword({ email: E2E_EMAIL, password: E2E_PASSWORD });

    const other = createClient(APP_ENV.SUPABASE_URL, APP_ENV.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await other.auth.signInWithPassword({ email: otherEmail, password: otherPassword });

    try {
      // K: another owner targeting this project fails and changes nothing,
      // including an attempt to deactivate rows by explicit id.
      const beforeCrossOwner = await snapshotWorkspace();
      const { error: crossError } = await other.rpc("save_project_workspace", {
        p_project_id: project.id,
        p_status: { phase: "Cobertura", progress_pct: 99, summary: "Sequestrado", next_steps: "x" },
        p_work_items: [{ id: keepId, description: "Sequestrado", status: "done", include_in_reports: false, deactivated: true }],
        p_incidents: [{ id: keepIncidentId, description: "Sequestrado", status: "resolved", include_in_reports: false, deactivated: true }],
        p_photos: [{ id: keepPhotoId, description: "Sequestrado", stage: "after", include_in_reports: false, deactivated: true }],
      });
      expect(crossError).toBeTruthy();
      expect(crossError.message).toMatch(/sem permissão/i);
      expect(await snapshotWorkspace()).toBe(beforeCrossOwner);

      // O: explicitly empty collections update status but touch no existing row.
      const beforeEmpty = await snapshotWorkspace();
      const { error: emptyError } = await owner.rpc("save_project_workspace", {
        p_project_id: project.id,
        p_status: { phase: "Fundações", progress_pct: 15, summary: "Só estado", next_steps: "" },
        p_work_items: [],
        p_incidents: [],
        p_photos: [],
      });
      expect(emptyError).toBeNull();
      const afterEmpty = JSON.parse(await snapshotWorkspace());
      const beforeEmptyParsed = JSON.parse(beforeEmpty);
      expect(afterEmpty[0].summary).toBe("Só estado");
      expect(afterEmpty.slice(1)).toEqual(beforeEmptyParsed.slice(1));

      // N: a partial payload (only changeId) must never deactivate the
      // omitted work item, incident or photo.
      const { error: okError } = await owner.rpc("save_project_workspace", {
        p_project_id: project.id,
        p_status: { phase: "Fundações", progress_pct: 20, summary: "Depois", next_steps: "" },
        p_work_items: [{ id: changeId, description: "Mudou", status: "done", include_in_reports: true, deactivated: false }],
        p_incidents: [],
        p_photos: [],
      });
      expect(okError).toBeNull();

      const kept = await getRow(client, "project_work_items", keepId);
      expect(kept.deactivated_at).toBeNull();
      expect(kept.description).toBe("Não enviado no payload");
      expect((await getRow(client, "project_work_items", changeId)).status).toBe("done");
      expect((await getRow(client, "project_incidents", keepIncidentId)).deactivated_at).toBeNull();
      expect((await getRow(client, "project_photos", keepPhotoId)).deactivated_at).toBeNull();

      // M: a bad photo id later in the payload rolls back the status + work
      // item + incident writes made earlier in the same call.
      const beforeRollback = await snapshotWorkspace();
      const { error: badError } = await owner.rpc("save_project_workspace", {
        p_project_id: project.id,
        p_status: { phase: "Cobertura", progress_pct: 90, summary: "Nunca deve persistir", next_steps: "" },
        p_work_items: [
          { id: changeId, description: "Nunca deve persistir", status: "pending", include_in_reports: true, deactivated: false },
          { id: keepId, description: "Nunca deve persistir", status: "pending", include_in_reports: true, deactivated: true },
          { id: crypto.randomUUID(), description: "Novo que nunca deve persistir", status: "pending", include_in_reports: true, deactivated: false },
        ],
        p_incidents: [{ id: keepIncidentId, description: "Nunca deve persistir", status: "resolved", include_in_reports: false, deactivated: false }],
        p_photos: [{ id: crypto.randomUUID(), description: "x", stage: "during", include_in_reports: true, deactivated: false }],
      });
      expect(badError).toBeTruthy();
      expect(await snapshotWorkspace()).toBe(beforeRollback);

      // Same for an invalid status value (check-constraint failure).
      const { error: badStatusError } = await owner.rpc("save_project_workspace", {
        p_project_id: project.id,
        p_status: { phase: "Cobertura", progress_pct: 90, summary: "Nunca deve persistir", next_steps: "" },
        p_work_items: [{ id: changeId, description: "x", status: "blocked", include_in_reports: true, deactivated: false }],
        p_incidents: [],
        p_photos: [],
      });
      expect(badStatusError).toBeTruthy();
      expect(await snapshotWorkspace()).toBe(beforeRollback);
    } finally {
      await owner.auth.signOut();
      await other.auth.signOut();
    }
  });

  test("regression: the old weekly wizard is unreachable — the mode page's Relatório Semanal opens Estado da Obra", async ({ page }) => {
    test.setTimeout(60000);

    const client = getServiceRoleClient();
    const projectName = `E2E Workspace Routing ${Date.now()}`;
    await createTestProject(client, { name: projectName });

    await login(page);
    await openWorkspace(page, projectName);

    await expect(page.locator('[data-nav-action="generate-weekly-report"]')).toHaveCount(0);
    await expect(page.locator("#workStatusGenerateReportBtn")).toHaveText("Gerar relatório");

    await page.locator("#workStatusMoreOptionsBtn").click();
    await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, { timeout: 10000 });
    await expect(page.locator('[data-nav-action="select-mode"][data-mode="weekly"]')).toHaveCount(0);

    await page.locator('[data-nav-action="open-estado-obra"]').click();
    await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i, { timeout: 10000 });
    await expect(page.locator("#workStatusProjectLabel")).toHaveText(projectName);
    await expect(page.locator("#step-estado-obra")).toHaveAttribute("data-workspace-state", "ready", { timeout: 15000 });
  });

  // POST-RELEASE-POLISH-001 — phone widths: no horizontal overflow, 44px touch
  // targets, readable hidden-from-report cards, and a save bar that is really
  // sticky (it used to sit inside .step-content, an overflow container, so it
  // only ever showed at the very end of the page).
  test("mobile: no overflow, 44px targets, readable hidden cards, Guardar stays reachable mid-scroll", async ({ page }) => {
    test.setTimeout(90000);

    const client = getServiceRoleClient();
    const projectName = `E2E Workspace Mobile ${Date.now()}`;
    const { project } = await createTestProject(client, { name: projectName });
    await seedWorkspace(client, {
      project,
      status: { progressPct: 40, summary: "Resumo", nextSteps: "Passo" },
      workItems: [
        { type: "Pintura Interior", area: "Sala", description: "Em curso", status: "in_progress" },
        {
          type: "Canalização / Hidráulica",
          area: "Casa de Banho Principal",
          description: "https://exemplo.pt/um/caminho/muito/longo/sem/espacos/que/nao/quebra/naturalmente/abcdefghijklmnopqrstuvwxyz",
          status: "pending",
        },
        { type: "Alvenaria / Paredes", area: "Quarto 1", description: "Oculto", status: "done", include_in_reports: false },
      ],
      incidents: [
        { description: "Incidente aberto", status: "open" },
        { description: "Incidente resolvido e oculto", status: "resolved", include_in_reports: false },
      ],
      photos: [{ storage_path: "mobile.jpg", description: "Foto", include_in_reports: false }],
    });

    await page.setViewportSize({ width: 320, height: 640 });
    await login(page);
    await openWorkspace(page, projectName);

    const measure = () =>
      page.evaluate(() => {
        const root = document.querySelector("#step-estado-obra");
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
        };
        const describe = (el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.value || "").trim().slice(0, 30)}"`;
        let hiddenCardOpacity = 1;
        for (let el = root.querySelector(".is-hidden-from-reports .work-status-item-btn"); el; el = el.parentElement) {
          hiddenCardOpacity *= Number(getComputedStyle(el).opacity);
        }
        return {
          overflowPx: document.documentElement.scrollWidth - window.innerWidth,
          smallTargets: [...root.querySelectorAll("button, select, textarea, input:not([type=range]):not([type=file])")]
            .filter(visible)
            .filter((el) => el.getBoundingClientRect().height < 44)
            .map(describe),
          hiddenCardOpacity,
        };
      });

    const clean = await measure();
    expect(clean.overflowPx).toBeLessThanOrEqual(0);
    expect(clean.smallTargets).toEqual([]);
    expect(clean.hiddenCardOpacity).toBe(1);

    // Clean workspace: no save bar taking footer space.
    await expect(page.locator("#workStatusSaveBar")).toBeHidden();

    // Dirty, then scrolled to the middle: Guardar is on screen, directly above
    // the nav bar, and usable from there.
    await page.locator("#workStatusSummary").fill("Resumo alterado no telemóvel");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.4));

    const bar = page.locator("#workStatusSaveBar");
    await expect(bar).toBeVisible();
    await expect(page.locator("#workStatusSaveBtn")).toBeInViewport();
    const barBox = await bar.boundingBox();
    const navBox = await page.locator("#step-estado-obra .nav-bar").boundingBox();
    expect(Math.round(barBox.y + barBox.height)).toBe(Math.round(navBox.y));
    expect(navBox.y + navBox.height).toBeLessThanOrEqual(640 + 1);

    await page.locator("#workStatusSaveBtn").click();
    await expect(page.locator("#workStatusSaveHint")).toHaveText("Alterações guardadas.", { timeout: 15000 });
    const { data: saved } = await client.from("project_status_state").select("summary").eq("project_id", project.id).single();
    expect(saved.summary).toBe("Resumo alterado no telemóvel");

    // Regression: "Gerar relatório" (sticky footer) from the top of a long
    // page — the result panel at the end of the page must come into view,
    // otherwise the click looks like it did nothing and users click again.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("#workStatusGenerateReportBtn").click();
    const result = page.locator("#workStatusReportResult");
    await expect(result).toHaveAttribute("data-state", "success", { timeout: 20000 });
    await expect(result.locator('[data-generated-report-action="view-pdf"]')).toBeInViewport();
    await expect(result.locator('[data-generated-report-action="share"]')).toBeInViewport();
    await expect(page.locator("#confirmDialogTitle")).toHaveText("Relatório gerado", { timeout: 20000 });
    await page.locator('[data-confirm-action="confirm"]').click();
    await expect(page.locator("#confirmDialog")).toBeHidden();

    // Editing forms open: still no overflow / small targets.
    await page.locator('[data-ws-action="toggle-edit-work"]').first().click();
    await page.locator('[data-ws-action="toggle-edit-incident"]').first().click();
    await page.locator("#workStatusAddWorkItemBtn").click();
    await page.locator("#workStatusAddIncidentBtn").click();
    const editing = await measure();
    expect(editing.overflowPx).toBeLessThanOrEqual(0);
    expect(editing.smallTargets).toEqual([]);
  });
});

// Keep the fixture image referenced so a missing file fails loudly at load.
if (!fs.existsSync(TEST_PHOTO_PATH)) {
  throw new Error(`Missing test fixture: ${TEST_PHOTO_PATH}`);
}
