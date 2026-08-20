// js/legacy/legacy-bridge.js

import { appState } from "#state/app-state.js";
import { setValue } from "#forms/form-values.js";
import { savePhotosForReport } from "#database/db-photos.js";
import {
  createReport,
  getLatestReportForProject,
} from "#database/db-reports.js";
import { saveReportToSupabase } from "#reports/report-save.js";

export function installLegacyBridge() {
  window.setValue = setValue;

  // Temporary bridge for remaining inline handlers only.
  // This file must not own runtime state.
  window.savePhotosForReport = savePhotosForReport;

  window.createReport = function createReportLegacy(projectId, values) {
    return createReport({
      projectId,
      values,
      state: appState,
    });
  };

  window.getLatestReportForProject = getLatestReportForProject;
  window.applyPreviousReportToForm = applyPreviousReportToForm;

  window.saveReportToSupabase = saveReportToSupabase;
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

export function applyPreviousReportToForm(previousReport) {
  if (!previousReport) return;

  appState.phase = previousReport.phase || appState.phase || "";

  appState.alertOn = Boolean(previousReport.alert_on);
  appState.incidentsOn = Boolean(previousReport.incidents_on);

  appState.works = Array.isArray(previousReport.works)
    ? previousReport.works
    : [];

  appState.extras = Array.isArray(previousReport.extras)
    ? previousReport.extras
    : [];

  appState.nextSteps = Array.isArray(previousReport.next_steps)
    ? previousReport.next_steps
    : [];

  // New report should get new site photos.
  appState.photos = [];

  appState.incidents =
    previousReport.incidents_on && Array.isArray(previousReport.incidents)
      ? previousReport.incidents
      : [];

  setValue("p-periodStart", previousReport.period_start || "");
  setValue("p-periodEnd", previousReport.period_end || "");
  setValue("p-distributedTo", previousReport.distributed_to || "");
  setValue("p-reportDate", new Date().toISOString().slice(0, 10));

  const previousReportNum = Number(previousReport.report_num || 0);
  setValue("p-reportNum", String(previousReportNum + 1));

  setValue("weekSummary", previousReport.week_summary || "");
  setValue("progressSlider", previousReport.progress_pct || 0);

  setValue("alertTitle", previousReport.alert_title || "");
  setValue("alertDesc", previousReport.alert_desc || "");
  setValue("alertDeadline", previousReport.alert_deadline || "");
  setValue("alertConsequence", previousReport.alert_consequence || "");

  setValue("financialNote", previousReport.financial_note || "");

  if (typeof window.updatePhaseUI === "function") {
    window.updatePhaseUI();
  }

  if (typeof window.updateAlertUI === "function") {
    window.updateAlertUI();
  }

  if (typeof window.updateIncidentsUI === "function") {
    window.updateIncidentsUI();
  }

  if (typeof window.renderWorks === "function") {
    window.renderWorks();
  }

  if (typeof window.renderPhotos === "function") {
    window.renderPhotos();
  }

  if (typeof window.renderIncidents === "function") {
    window.renderIncidents();
  }

  if (typeof window.renderExtras === "function") {
    window.renderExtras();
  }

  if (typeof window.renderNextSteps === "function") {
    window.renderNextSteps();
  }

  if (typeof window.updateFinancialPreview === "function") {
    window.updateFinancialPreview();
  }

  if (typeof window.buildReview === "function") {
    window.buildReview();
  }
}