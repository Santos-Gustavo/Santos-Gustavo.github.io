// tests/e2e/global-setup.js
//
// E2E-FIXTURES-001 — runs once before the whole suite (wired in via
// playwright.config.js's `globalSetup`) and guarantees the baseline fixtures
// every spec assumes exist: one company, two clients, two projects, and two
// reports (each with a valid snapshot_json) for the known E2E test owner.
// Idempotent — ensureE2E*() reuses existing rows instead of duplicating them,
// so this is safe to run every single `npm run test:e2e` invocation, whether
// the account is freshly cleaned or (with E2E_SKIP_CLEANUP=true) still holds
// data from a prior run.

import dotenv from "dotenv";
import {
  ensureE2ECompany,
  ensureE2EClient,
  ensureE2EProject,
  ensureE2EReport,
  writeFixtureState,
  E2E_USER_ID,
} from "./helpers/e2e-fixtures.js";
import { hasServiceRoleEnv } from "./helpers/supabase-admin.js";

// playwright.config.js already loads .env for the main process before this
// file is ever imported — this call is a no-op then, and a safety net if
// this file is ever loaded outside that pipeline.
dotenv.config();

export default async function globalSetup() {
  if (!E2E_USER_ID || !hasServiceRoleEnv()) {
    console.warn(
      "[E2E fixtures] E2E_USER_ID / SUPABASE_SERVICE_ROLE_KEY not set — skipping fixture " +
        "seeding. Specs that need a pre-existing company or a seeded report will fail or skip."
    );
    return;
  }

  const company = await ensureE2ECompany();

  const clientA = await ensureE2EClient(company.id);
  const projectA = await ensureE2EProject(company.id, clientA.id);
  const reportA = await ensureE2EReport(projectA.id);

  const clientB = await ensureE2EClient(company.id, { suffix: "B" });
  const projectB = await ensureE2EProject(company.id, clientB.id, { suffix: "B" });
  const reportB = await ensureE2EReport(projectB.id, { suffix: "B" });

  writeFixtureState({
    companyId: company.id,
    clientId: clientA.id,
    projectId: projectA.id,
    reportId: reportA.id,
    secondClientId: clientB.id,
    secondProjectId: projectB.id,
    secondReportId: reportB.id,
  });

  console.log(
    `[E2E fixtures] Ready — company ${company.id}, report ${reportA.id}, secondReport ${reportB.id}`
  );
}
