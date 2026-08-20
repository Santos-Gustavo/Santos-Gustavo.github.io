// js/reports/report-generator.js

import { buildCurrentReportDocument } from "#reports/report-document-builder.js";
import { hydrateReportPhotoUrls } from "#reports/report-photo-hydration.js";
import { renderReportHtml } from "#reports/report-renderer.js";
import { openHtmlReportPreview } from "#reports/report-preview.js";

let initialized = false;

export function initReportGenerator() {
  if (initialized) return;
  initialized = true;

  installTemporaryReportGeneratorBridge();
}

export async function generateReport(reportDocument = null) {
  const sourceDocument = reportDocument || buildCurrentReportDocument({
    includePhotoDisplayUrls: true,
  });

  const hydratedDocument = await hydrateReportPhotoUrls(sourceDocument);
  const html = renderReportHtml(hydratedDocument);

  return openHtmlReportPreview(html);
}

function installTemporaryReportGeneratorBridge() {
  // Temporary bridge for old inline save/generate flow.
  window.generateReport = generateReport;
}