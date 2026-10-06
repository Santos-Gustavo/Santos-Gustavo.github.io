// tests/e2e/helpers/canonical-report-helper.js
//
// ESTADO-DA-OBRA-WORKSPACE-001 Phase 4 — drives the product's only weekly
// report path: Estado da Obra (edit → Guardar alterações) → Gerar relatório.
// Replaces the old 9-step weekly wizard steps the earlier specs clicked
// through; that wizard is no longer reachable from the product.

import { expect } from "@playwright/test";

// From the mode page ("Mais opções" / right after creating a project), the
// "Relatório Semanal" tile opens Estado da Obra.
export async function openEstadoDaObraFromModePage(page) {
  await page.locator('[data-nav-action="open-estado-obra"]').click();
  await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i, { timeout: 10000 });
  await waitForWorkspaceReady(page);
}

export async function waitForWorkspaceReady(page) {
  await expect(page.locator("#step-estado-obra")).toHaveAttribute("data-workspace-state", "ready", {
    timeout: 15000,
  });
}

export async function addWorkItemInEstadoDaObra(page, { type, area, description, status = "pending" }) {
  await page.locator("#workStatusAddWorkItemBtn").click();
  const form = page.locator("#workStatusAddWorkItemForm");
  if (type) await form.locator('select[data-add-work-field="type"]').selectOption({ label: type });
  if (area) await form.locator('select[data-add-work-field="area"]').selectOption({ label: area });
  await form.locator('textarea[data-add-work-field="description"]').fill(description);
  await form.locator('select[data-add-work-field="status"]').selectOption(status);
  await form.locator('[data-ws-action="submit-add-work-item"]').click();
}

export async function addPhotoInEstadoDaObra(page, filePath) {
  const before = await page.locator("#workStatusPhotosList [data-photo-id]").count();
  await page.locator("#workStatusPhotoInput").setInputFiles(filePath);
  await expect(page.locator("#workStatusPhotosList [data-photo-id]")).toHaveCount(before + 1, { timeout: 20000 });
}

export async function saveEstadoDaObra(page) {
  await expect(page.locator("#workStatusSaveBtn")).toBeEnabled();
  await page.locator("#workStatusSaveBtn").click();
  await expect(page.locator("#workStatusSaveHint")).toHaveText("Alterações guardadas.", { timeout: 15000 });
}

// Clicks "Gerar relatório" on a clean workspace and waits for the success
// panel; the report also opens in a new tab and a "Relatório gerado" pop-up
// confirms it — both are dismissed here. Returns the generated report id.
export async function generateReportFromEstadoDaObra(page) {
  const tabPromise = page.waitForEvent("popup");
  await page.locator("#workStatusGenerateReportBtn").click();
  const panel = page.locator("#workStatusReportResult");
  await expect(panel).toHaveAttribute("data-state", "success", { timeout: 20000 });
  await expect(panel.locator('[data-generated-report-action="view-pdf"]')).toBeVisible();
  await expect(panel.locator('[data-generated-report-action="share"]')).toBeVisible();
  const reportId = await panel.getAttribute("data-report-id");

  await expect(page.locator("#confirmDialogTitle")).toHaveText("Relatório gerado", { timeout: 20000 });
  await page.locator('[data-confirm-action="confirm"]').click();
  await expect(page.locator("#confirmDialog")).toBeHidden();
  (await tabPromise).close();

  return { reportId };
}

// Full flow used by the specs that previously walked the weekly wizard:
// mode page → Estado da Obra → fill + save → Gerar relatório → back to the
// project list.
export async function createCanonicalReportFromModePage(
  page,
  { progress = "45", summary, workDescription, nextSteps = "", photoPath = null }
) {
  await openEstadoDaObraFromModePage(page);

  await page.locator("#workStatusProgressSlider").fill(String(progress));
  await page.locator("#workStatusSummary").fill(summary);
  if (nextSteps) await page.locator("#workStatusNextSteps").fill(nextSteps);
  if (workDescription) {
    await addWorkItemInEstadoDaObra(page, {
      type: "Pintura Interior",
      area: "Sala",
      description: workDescription,
      status: "in_progress",
    });
  }
  if (photoPath) await addPhotoInEstadoDaObra(page, photoPath);

  await saveEstadoDaObra(page);
  const result = await generateReportFromEstadoDaObra(page);

  await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();
  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, { timeout: 10000 });

  return result;
}

// "Ver PDF" / history "Abrir" open the rendered report in a new tab (blob URL).
export async function readOpenedReport(page, clickOpen) {
  const popupPromise = page.waitForEvent("popup");
  await clickOpen();
  const popup = await popupPromise;
  await popup.waitForLoadState("load");
  const text = await popup.locator("body").innerText();
  const html = await popup.content();
  await popup.close();
  return { text, html };
}
