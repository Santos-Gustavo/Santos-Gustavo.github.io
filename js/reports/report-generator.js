// js/reports/report-generator.js

import { buildCurrentReportDocument } from "#reports/report-document-builder.js";
import { hydrateReportPhotoUrls } from "#reports/report-photo-hydration.js";
import { renderReportHtml } from "#reports/report-renderer.js";
import { openHtmlReportPreview } from "#reports/report-preview.js";
import { saveReportToSupabase } from "#reports/report-save.js";

let initialized = false;

export function initReportGenerator() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleReportClick, true);
}

export async function generateReport(reportDocument = null) {
  const sourceDocument = reportDocument || buildCurrentReportDocument({
    includePhotoDisplayUrls: true,
  });

  const hydratedDocument = await hydrateReportPhotoUrls(sourceDocument);
  const html = renderReportHtml(hydratedDocument);

  return openHtmlReportPreview(html);
}

export async function saveAndGenerateReport() {
  const saved = await saveReportToSupabase();

  if (!saved) {
    return null;
  }

  await generateReport(saved.snapshotJson || null);

  return saved;
}

function handleReportClick(event) {
  const button = event.target.closest("[data-report-action]");
  if (!button) return;

  const action = button.dataset.reportAction;

  if (action !== "save-and-generate") return;

  event.preventDefault();

  saveAndGenerateReport().catch((error) => {
    console.error("Failed to save and generate report:", error);
    alert("Erro ao gerar relatório: " + error.message);
  });
}