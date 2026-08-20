// js/legacy/legacy-bridge.js

import { setValue } from "#forms/form-values.js";
import { savePhotosForReport } from "#database/db-photos.js";
import {
  createReport,
  getLatestReportForProject,
} from "#database/db-reports.js";
import { saveReportToSupabase } from "#reports/report-save.js";

export function installLegacyBridge() {
  window.setValue = setValue;
  window.applyPreviousReportToForm = applyPreviousReportToForm;

  // Temporary bridge for legacy report/photo files.
  window.savePhotosForReport = savePhotosForReport;

  window.createReport = function createReportLegacy(projectId, values) {
    return createReport({
      projectId,
      values,
      state: window.S,
    });
  };

  window.getLatestReportForProject = getLatestReportForProject;
  window.saveReportToSupabase = saveReportToSupabase;

  // Temporary bridge for old inline onclick="saveAndGenerateReport()".
  window.saveAndGenerateReport = saveAndGenerateReport;
}

async function saveAndGenerateReport() {
  const saved = await saveReportToSupabase();

  if (!saved) {
    return null;
  }

  if (typeof window.generateReport === "function") {
    await window.generateReport(saved.snapshotJson || null);
  } else {
    console.warn("generateReport() is not available. Report was saved, but PDF/HTML was not generated.");
  }

  return saved;
}

function normalizeSentVia(value) {
  const text = String(value || "").trim().toLowerCase();

  if (text === "whatsapp") return 1;
  if (text === "email") return 2;
  if (text === "pdf_download") return 3;
  if (text === "pdf") return 3;
  if (text === "manual") return 0;

  if (value === 1 || value === "1") return 1;
  if (value === 2 || value === "2") return 2;
  if (value === 3 || value === "3") return 3;
  if (value === 0 || value === "0") return 0;

  return 1;
}

function applyPreviousReportToForm(previousReport) {
  if (!previousReport) return;

  const today = new Date().toISOString().split("T")[0];
  const nextReportNum = Number(previousReport.report_num || 0) + 1;

  setValue("p-reportNum", nextReportNum);
  setValue("p-reportDate", today);

  // Keep blank for now. Period logic can be migrated cleanly later.
  setValue("p-periodStart", "");
  setValue("p-periodEnd", "");

  setValue("p-distributedTo", previousReport.distributed_to || "");
  setValue("p-sentVia", normalizeSentVia(previousReport.sent_via));

  setValue("progressSlider", previousReport.progress_pct || 0);
  setValue("progressPct", previousReport.progress_pct || 0);
  setValue("weekSummary", previousReport.week_summary || "");

  setValue("financialNote", previousReport.financial_note || "");

  setValue("alertTitle", previousReport.alert_title || "");
  setValue("alertDesc", previousReport.alert_desc || "");
  setValue("alertDeadline", previousReport.alert_deadline || "");
  setValue("alertConsequence", previousReport.alert_consequence || "");

  if (window.S) {
    window.S.phase = previousReport.phase || window.S.phase || "";

    window.S.alertOn = Boolean(previousReport.alert_on);
    window.S.incidentsOn = Boolean(previousReport.incidents_on);

    window.S.works = Array.isArray(previousReport.works)
      ? structuredClone(previousReport.works)
      : [];

    window.S.extras = Array.isArray(previousReport.extras)
      ? structuredClone(previousReport.extras)
      : [];

    window.S.nextSteps = Array.isArray(previousReport.next_steps)
      ? structuredClone(previousReport.next_steps)
      : [];

    // Do not prefill old saved photos into a new weekly report.
    // New report should get new site photos.
    window.S.photos = [];

    window.S.incidents =
      previousReport.incidents_on && Array.isArray(previousReport.incidents)
        ? structuredClone(previousReport.incidents)
        : [];
  }

  if (typeof window.renderWorks === "function") window.renderWorks();
  if (typeof window.renderExtras === "function") window.renderExtras();
  if (typeof window.renderNextSteps === "function") window.renderNextSteps();
  if (typeof window.renderIncidents === "function") window.renderIncidents();
  if (typeof window.renderPhotos === "function") window.renderPhotos();

  if (typeof window.updatePhaseUI === "function") window.updatePhaseUI();
  if (typeof window.updateAlertUI === "function") window.updateAlertUI();
  if (typeof window.updateIncidentsUI === "function") window.updateIncidentsUI();

  syncProgressLabel(previousReport.progress_pct);
}

function syncProgressLabel(progressPct) {
  const value = Number(progressPct || 0);

  const progressValue = document.getElementById("progressValue");
  if (progressValue) {
    progressValue.textContent = `${value}%`;
  }

  const progressSlider = document.getElementById("progressSlider");
  if (progressSlider) {
    progressSlider.value = value;
  }
}