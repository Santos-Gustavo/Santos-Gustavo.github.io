// js/main.js

import { initNavigation } from "#navigation/navigation.js";
import { initProjects } from "#projects/project-index.js";
import { initClients } from "#clients/client-index.js";
import { initCompanyProfile } from "#company/company-index.js";
import { initWorksSection } from "#projects/sections/works.js";
import { initPhotosSection } from "#projects/sections/photos.js";
import { initIncidentsSection } from "#projects/sections/incidents.js";
import { initExtrasSection } from "#projects/sections/extras.js";
import { initNextStepsSection } from "#projects/sections/next-steps.js";
import { initFinancialSection } from "#projects/sections/financial.js";
import { initReviewSection } from "#projects/sections/review.js";
import { initUiControls } from "#ui/ui-controls.js";
import { initConfirmDialog } from "#ui/confirm-dialog.js";
import { initPayments } from "#payments/payment.js";
import { initAuth } from "#auth/auth.js";
import { appState } from "#state/app-state.js";
import { initReportGenerator } from "#reports/report-generator.js";
import { initReportHistory } from "#reports/report-history.js";
import { initReportDefaults } from "#reports/report-defaults.js";
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

  initClients();
  console.info("[ESM boot] Clients initialized.");

  initCompanyProfile();
  console.info("[ESM boot] Company profile initialized.");

  initUiControls();
  console.info("[ESM boot] UI controls initialized.");

  initConfirmDialog();
  console.info("[ESM boot] Confirm dialog initialized.");

  initWorksSection();
  console.info("[ESM boot] Works initialized.");

  initPhotosSection();
  console.info("[ESM boot] Photos initialized.");

  initIncidentsSection();
  console.info("[ESM boot] Incidents initialized.");

  initExtrasSection();
  console.info("[ESM boot] Extras initialized.");

  initNextStepsSection();
  console.info("[ESM boot] Next steps initialized.");

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