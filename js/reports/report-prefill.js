// js/reports/report-prefill.js

import { appState } from "#state/app-state.js";
import { setValue } from "#forms/form-values.js";
import { updatePhaseUI, updateAlertUI, updateIncidentsUI, syncProgressSlider } from "#ui/ui-controls.js";
import { renderWorks } from "#projects/sections/works.js";
import { renderPhotos } from "#projects/sections/photos.js";
import { renderIncidents } from "#projects/sections/incidents.js";
import { renderExtras } from "#projects/sections/extras.js";
import { renderNextSteps } from "#projects/sections/next-steps.js";
import { updateFinancialPreview } from "#projects/sections/financial.js";
import { buildReview } from "#projects/sections/review.js";

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
  syncProgressSlider();

  setValue("alertTitle", previousReport.alert_title || "");
  setValue("alertDesc", previousReport.alert_desc || "");
  setValue("alertDeadline", previousReport.alert_deadline || "");
  setValue("alertConsequence", previousReport.alert_consequence || "");

  setValue("financialNote", previousReport.financial_note || "");

  updatePhaseUI();
  updateAlertUI();
  updateIncidentsUI();

  renderWorks();
  renderPhotos();
  renderIncidents();
  renderExtras();
  renderNextSteps();

  updateFinancialPreview();
  buildReview();
}