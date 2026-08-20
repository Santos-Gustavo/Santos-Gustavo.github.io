// js/reports/report-generator.js

import { buildCurrentReportDocument } from "#reports/report-document-builder.js";
import { renderReportHtml } from "#reports/report-renderer.js";
import { openHtmlReportPreview } from "#reports/report-preview.js";

let initialized = false;

export function initReportGenerator() {
  if (initialized) return;
  initialized = true;

  installTemporaryReportGeneratorBridge();
}

export function generateReport() {
  const reportDocument = buildCurrentReportDocument();
  const html = renderReportHtml(reportDocument);

  return openHtmlReportPreview(html);
}

function installTemporaryReportGeneratorBridge() {
  // Temporary bridge for old inline save/generate flow.
  window.generateReport = generateReport;
}