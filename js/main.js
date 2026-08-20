import { initAuth } from "#auth/auth.js";
import { appState } from "#state/app-state.js";
import { JOB_TYPES, AREAS, CONTENT_STEPS } from "#config/app-options.js";

async function boot() {
  console.info("[ESM boot] Native ES modules loaded.");

  console.info("[ESM boot] State loaded:", appState.currentStepId);
  console.info("[ESM boot] Options loaded:", {
    jobTypes: JOB_TYPES.length,
    areas: AREAS.length,
    flows: Object.keys(CONTENT_STEPS),
  });

  await initAuth();

  console.info("[ESM boot] Auth initialized.");
}

boot().catch((error) => {
  console.error("[ESM boot] Fatal startup error:", error);
});