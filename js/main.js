// js/main.js

import { initNavigation } from "#navigation/navigation.js";
import { initProjects } from "#projects/project-index.js";
import { initClients } from "#clients/client-index.js";
import { initCompanyProfile } from "#company/company-index.js";
import { initExtrasSection } from "#projects/sections/extras.js";
import { initFinancialSection } from "#projects/sections/financial.js";
import { initReviewSection } from "#projects/sections/review.js";
import { initConfirmDialog } from "#ui/confirm-dialog.js";
import { initPayments } from "#payments/payment.js";
import { initAuth } from "#auth/auth.js";
import { appState } from "#state/app-state.js";
import { initReportGenerator } from "#reports/report-generator.js";
import { initReportHistory } from "#reports/report-history.js";
import { initReportDefaults } from "#reports/report-defaults.js";
import { initProjectWorkItemsUi } from "#projects/project-work-items-ui.js";
import { JOB_TYPES, AREAS, CONTENT_STEPS } from "#config/app-options.js";

async function boot() {
  console.info("[ESM boot] Native ES modules loaded.");

  console.info("[ESM boot] State loaded:", appState.currentStepId);
  console.info("[ESM boot] Options loaded:", {
    jobTypes: JOB_TYPES.length,
    areas: AREAS.length,
    flows: Object.keys(CONTENT_STEPS),
  });


  initNavigation();
  console.info("[ESM boot] Navigation initialized.");

  initReportDefaults();
  console.info("[ESM boot] Report defaults initialized.");

  initProjects();
  console.info("[ESM boot] Projects initialized.");

  initProjectWorkItemsUi();
  console.info("[ESM boot] Estado da Obra initialized.");

  initClients();
  console.info("[ESM boot] Clients initialized.");

  initCompanyProfile();
  console.info("[ESM boot] Company profile initialized.");

  initConfirmDialog();
  console.info("[ESM boot] Confirm dialog initialized.");

  initExtrasSection();
  console.info("[ESM boot] Extras initialized.");

  initFinancialSection();
  console.info("[ESM boot] Financial initialized.");

  initReviewSection();
  console.info("[ESM boot] Review initialized.");

  initReportGenerator();
  console.info("[ESM boot] Report generator initialized.");

  initReportHistory();
  console.info("[ESM boot] Report history initialized.");

  initPayments();
  console.info("[ESM boot] Payments initialized.");

  await initAuth();
  console.info("[ESM boot] Auth initialized.");
}

boot().catch((error) => {
  console.error("[ESM boot] Fatal startup error:", error);
});