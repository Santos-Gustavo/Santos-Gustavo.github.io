// tests/e2e/helpers/e2e-fixtures.js
//
// E2E-FIXTURES-001 — single source of truth for the E2E suite's own test data:
// creating it (ensureE2E*), reading back what global setup created
// (readFixtureState), and deleting it (cleanupE2EData). Service-role only,
// Node-side — never imported from app/browser code.
//
// The ensureE2E* functions talk to the DB directly with the service-role
// client rather than importing the app's js/database/*.js modules — those
// modules resolve `#database/...` specifiers through the browser-only import
// map in app.html, which plain Node ESM cannot resolve without a bundler.
// Field shapes below are kept in sync by hand with js/database/db-*.js and
// js/mappers/report-mapper.js — see the comments at each insert.

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getServiceRoleClient, hasServiceRoleEnv } from "./supabase-admin.js";

// Playwright's loader transpiles these test-side ESM files to CommonJS (the
// package is "type": "commonjs"), which supports plain `import`/`export` but
// not `import.meta` — so this uses Node's native CJS __dirname rather than
// the usual `fileURLToPath(import.meta.url)` ESM idiom.

export const E2E_USER_ID = process.env.E2E_USER_ID;

const E2E_OTHER_USER_ID = process.env.E2E_OTHER_USER_ID;
const E2E_OTHER_EMAIL = process.env.E2E_OTHER_EMAIL?.trim();
const E2E_OTHER_PASSWORD = process.env.E2E_OTHER_PASSWORD;

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const STORAGE_BUCKET = "project-photos";
const STORAGE_DELETE_BATCH_SIZE = 50;
const ID_BATCH_SIZE = 100;

export const FIXTURE_STATE_PATH = path.join(__dirname, "..", ".fixtures-state.json");

export const FIXTURE_NAMES = Object.freeze({
  COMPANY: "E2E Fixture Company",
  CLIENT: "E2E Fixture Client",
  CLIENT_B: "E2E Fixture Client B",
  PROJECT: "E2E Fixture Project",
  PROJECT_B: "E2E Fixture Project B",
});

// Matches the E2E-CLEANUP-001 known test patterns (case-insensitive, anywhere
// in the string). Broad by design — safe only because every caller also
// scopes by owner_id to a known test account first, never by name alone.
export function isTestName(name) {
  const value = String(name || "").toLowerCase();
  return (
    value.includes("e2e") ||
    value.includes("smoke") ||
    value.includes("fixture") ||
    value.includes("test") ||
    value.includes("playwright")
  );
}

function requireEnv() {
  if (!E2E_USER_ID) {
    throw new Error("E2E_USER_ID must be set in .env for fixture setup/cleanup.");
  }

  if (!hasServiceRoleEnv()) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set in .env for fixture setup/cleanup."
    );
  }
}

function nullableText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

// ---------------------------------------------------------------------------
// Fixture state file — written once by global setup, read by any spec that
// needs the ids of the fixtures it created (report ids in particular, which
// used to be hand-set in .env). Kept out of git (see .gitignore) since it's
// regenerated fresh on every `npm run test:e2e` run.
// ---------------------------------------------------------------------------

export function writeFixtureState(state) {
  fs.writeFileSync(FIXTURE_STATE_PATH, JSON.stringify(state, null, 2));
}

export function readFixtureState() {
  if (!fs.existsSync(FIXTURE_STATE_PATH)) {
    throw new Error(
      `Fixture state file not found at ${FIXTURE_STATE_PATH}. Global setup ` +
        "(tests/e2e/global-setup.js) must run before specs — it should run " +
        "automatically via playwright.config.js's globalSetup."
    );
  }

  return JSON.parse(fs.readFileSync(FIXTURE_STATE_PATH, "utf8"));
}

// Non-throwing variant for spec-file module top levels, which read fixture
// ids eagerly (mirroring the old `process.env.E2E_REPORT_ID` pattern) and
// need a plain `null` — not a crash during test collection — when global
// setup was skipped (e.g. no service-role key configured locally).
export function tryReadFixtureState() {
  try {
    return readFixtureState();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ensureE2E* — idempotent create-if-missing fixture helpers. Each is safe to
// call more than once per run (or across runs, if E2E_SKIP_CLEANUP=true left
// prior data in place) — they look for the existing row first and reuse it.
// ---------------------------------------------------------------------------

// The app's single-company model (COMPANY-PROFILE-001) treats whichever
// company already exists for this owner as "the" primary company — so unlike
// ensureE2EClient/ensureE2EProject below, this does NOT match by name. Any
// existing company for the known E2E test owner already scopes safely (this
// account is never used for anything but E2E runs), and reusing it (rather
// than name-matching "E2E Fixture Company" specifically) mirrors
// loadPrimaryCompany()'s own "oldest company wins" behavior.
export async function ensureE2ECompany() {
  requireEnv();
  const client = getServiceRoleClient();

  const { data: existing, error: findError } = await client
    .from("companies")
    .select("*")
    .eq("owner_id", E2E_USER_ID)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const { data: created, error: insertError } = await client
    .from("companies")
    .insert({
      owner_id: E2E_USER_ID,
      name: FIXTURE_NAMES.COMPANY,
      nif: null,
      impic: null,
      responsible: "E2E Fixture Responsible",
      phone: "+351 900 000 000",
      email: "e2e-fixture@example.com",
      address: "Rua Fixture 1, Porto",
      default_vat_rate: 23.0,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

export async function ensureE2EClient(companyId, { suffix = "" } = {}) {
  requireEnv();

  if (!companyId) {
    throw new Error("companyId is required for ensureE2EClient.");
  }

  const client = getServiceRoleClient();
  const name = suffix ? `${FIXTURE_NAMES.CLIENT} ${suffix}` : FIXTURE_NAMES.CLIENT;

  const { data: existing, error: findError } = await client
    .from("clients")
    .select("*")
    .eq("company_id", companyId)
    .eq("name", name)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const { data: created, error: insertError } = await client
    .from("clients")
    .insert({
      company_id: companyId,
      name,
      phone: "+351 910 000 000",
      email: "e2e-fixture-client@example.com",
      nif: null,
      address: "Rua Fixture Cliente 2, Porto",
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

export async function ensureE2EProject(companyId, clientId, { suffix = "" } = {}) {
  requireEnv();

  if (!companyId) throw new Error("companyId is required for ensureE2EProject.");
  if (!clientId) throw new Error("clientId is required for ensureE2EProject.");

  const client = getServiceRoleClient();
  const name = suffix ? `${FIXTURE_NAMES.PROJECT} ${suffix}` : FIXTURE_NAMES.PROJECT;

  const { data: existing, error: findError } = await client
    .from("projects")
    .select("*")
    .eq("company_id", companyId)
    .eq("name", name)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const { data: created, error: insertError } = await client
    .from("projects")
    .insert({
      company_id: companyId,
      client_id: clientId,
      name,
      site_address: "Rua Fixture Obra 3, Porto",
      type_of_work: "Fixture",
      start_date: new Date().toISOString().slice(0, 10),
      expected_end_date: null,
      actual_end_date: null,
      contract_num: `E2E-FIXTURE-${suffix || "A"}`,
      contract_value: 10000,
      internal_notes: "Seeded by E2E-FIXTURES-001 global setup.",
      status: 1, // PROJECT_STATUS.ACTIVE — see js/database/db-codes.js
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

// Builds the snapshot_json document for a fixture report, matching the shape
// js/reports/report-document-builder.js produces (validated by
// js/reports/report-renderer.js's validateReportDocument, which the
// share-link specs exercise via share.html).
function buildFixtureSnapshot({ reportId, project, client, company, reportNum, reportDate }) {
  return {
    schemaVersion: 1,

    meta: {
      reportId,
      projectId: project.id,
      mode: "weekly",
      reportNumber: reportNum,
      reportDate,
      periodStart: null,
      periodEnd: null,
      generatedAt: new Date().toISOString(),
    },

    company: {
      id: company.id,
      name: company.name || "",
      tagline: "",
      nif: company.nif || "",
      impic: company.impic || "",
      responsible: company.responsible || "",
      phone: company.phone || "",
      email: company.email || "",
    },

    project: {
      id: project.id,
      clientId: client.id,
      name: project.name || "",
      clientName: client.name || "",
      location: project.site_address || "",
      contractNumber: project.contract_num || "",
      contractValue: Number(project.contract_value) || 0,
    },

    progress: {
      phase: "Fundações",
      percentage: 40,
      weekSummary: "Fixture report seeded by E2E-FIXTURES-001 for share-link tests.",
    },

    alert: {
      enabled: false,
      title: "",
      description: "",
      deadline: null,
      consequence: "",
    },

    incidents: {
      enabled: false,
      items: [],
    },

    works: [],
    photos: [],
    extras: [],
    nextSteps: [],

    financialNote: "",
  };
}

export async function ensureE2EReport(projectId, { suffix = "" } = {}) {
  requireEnv();

  if (!projectId) {
    throw new Error("projectId is required for ensureE2EReport.");
  }

  const client = getServiceRoleClient();

  const { data: project, error: projectError } = await client
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError) throw projectError;

  const [{ data: clientRow, error: clientError }, { data: company, error: companyError }] =
    await Promise.all([
      client.from("clients").select("*").eq("id", project.client_id).single(),
      client.from("companies").select("*").eq("id", project.company_id).single(),
    ]);

  if (clientError) throw clientError;
  if (companyError) throw companyError;

  const { data: existing, error: findError } = await client
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("report_num", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  if (existing && existing.snapshot_json) {
    return existing;
  }

  const reportDate = new Date().toISOString().slice(0, 10);

  if (existing) {
    // Repairs a report left without a snapshot by an interrupted prior run —
    // never expected in steady state, but cheap to make resilient to.
    const snapshotJson = buildFixtureSnapshot({
      reportId: existing.id,
      project,
      client: clientRow,
      company,
      reportNum: existing.report_num,
      reportDate: existing.report_date,
    });

    const { data: repaired, error: updateError } = await client
      .from("reports")
      .update({ snapshot_json: snapshotJson, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return repaired;
  }

  // Matches js/mappers/report-mapper.js's buildReportInsertPayload shape.
  const { data: created, error: insertError } = await client
    .from("reports")
    .insert({
      project_id: projectId,
      report_num: 1,
      report_date: reportDate,
      period_start: null,
      period_end: null,
      distributed_to: "Cliente · Arquivo",
      sent_via: 1, // SENT_VIA.WHATSAPP — see js/database/db-codes.js
      phase: "Fundações",
      progress_pct: 40,
      week_summary: "Fixture report seeded by E2E-FIXTURES-001 for share-link tests.",
      alert_on: false,
      alert_title: null,
      alert_desc: null,
      alert_deadline: null,
      alert_consequence: null,
      incidents_on: false,
      financial_note: null,
      works: [],
      incidents: [],
      extras: [],
      next_steps: [],
      snapshot_json: null,
      status: 0,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  const snapshotJson = buildFixtureSnapshot({
    reportId: created.id,
    project,
    client: clientRow,
    company,
    reportNum: created.report_num,
    reportDate: created.report_date,
  });

  const { data: withSnapshot, error: snapshotError } = await client
    .from("reports")
    .update({ snapshot_json: snapshotJson, updated_at: new Date().toISOString() })
    .eq("id", created.id)
    .select()
    .single();

  if (snapshotError) throw snapshotError;
  return withSnapshot;
}

// ---------------------------------------------------------------------------
// cleanupE2EData — deletes everything ensureE2E* creates (plus anything else
// test-named under the same owner(s)), in dependency order. Moved here from
// global-teardown.js so creation and cleanup share one definition of "what
// counts as E2E test data" (isTestName) instead of two copies drifting apart.
// ---------------------------------------------------------------------------

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function selectInBatches(client, table, columns, column, ids, refine) {
  const rows = [];

  for (const batch of chunkArray(ids, ID_BATCH_SIZE)) {
    if (batch.length === 0) continue;

    let query = client.from(table).select(columns).in(column, batch);
    if (refine) query = refine(query);

    const { data, error } = await query;
    if (error) throw error;

    rows.push(...(data || []));
  }

  return rows;
}

async function deleteInBatches(client, table, column, ids, { ignoreErrorCode } = {}) {
  let deletedCount = 0;

  for (const batch of chunkArray(ids, ID_BATCH_SIZE)) {
    if (batch.length === 0) continue;

    const { error, count } = await client
      .from(table)
      .delete({ count: "exact" })
      .in(column, batch);

    if (error) {
      if (ignoreErrorCode && error.code === ignoreErrorCode) continue;
      throw error;
    }

    deletedCount += count ?? batch.length;
  }

  return deletedCount;
}

// Resolves a Supabase auth user id for cleanup scoping. Prefers an explicit
// *_USER_ID env var; otherwise signs in with the anon key purely to read back
// `data.user.id`, then signs out again. Never uses the service-role key for
// this — signing in is the same thing any test user's own browser session
// already does.
async function resolveUserId(label, explicitId, email, password) {
  if (explicitId) return explicitId;
  if (!email || !password) return null;

  const anonClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });

  if (error || !data?.user?.id) {
    console.warn(
      `[E2E cleanup] Could not resolve user id for ${label} (${email}): ${error?.message || "no user returned"}`
    );
    return null;
  }

  await anonClient.auth.signOut();
  return data.user.id;
}

async function resolveTestUserIds() {
  const primaryId = await resolveUserId("primary E2E user", E2E_USER_ID, E2E_EMAIL, E2E_PASSWORD);
  const otherId = await resolveUserId(
    "second E2E user",
    E2E_OTHER_USER_ID,
    E2E_OTHER_EMAIL,
    E2E_OTHER_PASSWORD
  );

  return [primaryId, otherId].filter(Boolean);
}

// Deletes exactly the rows a set of test projects own, in FK-safe order,
// including the Storage objects those projects' photos point at.
async function deleteProjectsDeep(client, projectIds) {
  if (projectIds.length === 0) return 0;

  const reports = await selectInBatches(client, "reports", "id", "project_id", projectIds);
  const reportIds = reports.map((report) => report.id);

  if (reportIds.length > 0) {
    const photos = await selectInBatches(client, "photos", "storage_path", "report_id", reportIds);
    const storagePaths = photos.map((photo) => photo.storage_path).filter(Boolean);

    for (const batch of chunkArray(storagePaths, STORAGE_DELETE_BATCH_SIZE)) {
      const { error: storageError } = await client.storage.from(STORAGE_BUCKET).remove(batch);

      if (storageError) {
        console.warn(`[E2E cleanup] Failed to remove ${batch.length} storage object(s): ${storageError.message}`);
      }
    }

    // report_share_links only exists once CLIENT-SHARE-LINK-001's migration is
    // deployed — treat "relation does not exist" (42P01) as nothing to clean
    // up, not a teardown failure.
    await deleteInBatches(client, "report_share_links", "report_id", reportIds, {
      ignoreErrorCode: "42P01",
    });

    await deleteInBatches(client, "photos", "report_id", reportIds);
    await deleteInBatches(client, "reports", "id", reportIds);
  }

  return deleteInBatches(client, "projects", "id", projectIds);
}

// Deletes test-named companies that, after the client/project cleanup below,
// have zero remaining clients and zero remaining projects. Re-checks live —
// never trusts a pre-cleanup snapshot — so a company is only ever removed
// once it's genuinely orphaned, never speculatively.
async function deleteZeroUseTestCompanies(client, companies) {
  const testCompanyIds = (companies || [])
    .filter((company) => isTestName(company.name))
    .map((company) => company.id);

  if (testCompanyIds.length === 0) return 0;

  const remainingClients = await selectInBatches(client, "clients", "company_id", "company_id", testCompanyIds, (q) =>
    q.is("deleted_at", null)
  );
  const remainingProjects = await selectInBatches(client, "projects", "company_id", "company_id", testCompanyIds);

  const stillInUse = new Set([
    ...remainingClients.map((row) => row.company_id),
    ...remainingProjects.map((row) => row.company_id),
  ]);

  const zeroUseCompanyIds = testCompanyIds.filter((id) => !stillInUse.has(id));
  if (zeroUseCompanyIds.length === 0) return 0;

  const deletedCompanies = await deleteInBatches(client, "companies", "id", zeroUseCompanyIds);
  const skipped = testCompanyIds.length - zeroUseCompanyIds.length;

  if (skipped > 0) {
    console.log(
      `[E2E cleanup] Skipped ${skipped} test-named compan${skipped === 1 ? "y" : "ies"} still in use (has clients or projects outside this cleanup's scope).`
    );
  }

  return deletedCompanies;
}

// Scope is strictly: companies owned by the resolved test user id(s), clients
// under those companies whose name matches isTestName(), and projects that
// point at one of those clients — then zero-use test companies once their
// clients/projects are gone. Never touches a client referenced by a project
// outside this scope, and never touches a company that isn't both test-named
// AND left with zero clients/projects after this pass. Never deletes another
// owner's data — scoping always starts from an explicit owner_id list.
export async function cleanupE2EData() {
  if (!hasServiceRoleEnv()) {
    console.log("[E2E cleanup] SUPABASE_SERVICE_ROLE_KEY not set — skipping cleanup.");
    return { deletedProjects: 0, deletedClients: 0, deletedCompanies: 0 };
  }

  const userIds = await resolveTestUserIds();

  if (userIds.length === 0) {
    console.log("[E2E cleanup] No test user id resolved — skipping cleanup.");
    return { deletedProjects: 0, deletedClients: 0, deletedCompanies: 0 };
  }

  const client = getServiceRoleClient();

  const { data: companies, error: companiesError } = await client
    .from("companies")
    .select("id, name")
    .in("owner_id", userIds);

  if (companiesError) throw companiesError;

  const companyIds = (companies || []).map((company) => company.id);

  if (companyIds.length === 0) {
    console.log("[E2E cleanup] No companies found for the configured test user(s).");
    return { deletedProjects: 0, deletedClients: 0, deletedCompanies: 0 };
  }

  const clients = await selectInBatches(client, "clients", "id, name", "company_id", companyIds, (q) =>
    q.is("deleted_at", null)
  );

  const testClientIds = clients
    .filter((clientRow) => isTestName(clientRow.name))
    .map((clientRow) => clientRow.id);

  let deletedProjects = 0;
  let deletedClients = 0;

  if (testClientIds.length === 0) {
    console.log("[E2E cleanup] No E2E-named clients found for the configured test user(s).");
  } else {
    const projects = await selectInBatches(client, "projects", "id", "client_id", testClientIds);
    const projectIds = projects.map((project) => project.id);

    deletedProjects = await deleteProjectsDeep(client, projectIds);

    // Re-check for any project still pointing at a candidate client (e.g. one
    // outside this scope) before deleting it — mirrors the DB's own ON DELETE
    // RESTRICT rather than fighting it.
    const remainingProjects = await selectInBatches(client, "projects", "client_id", "client_id", testClientIds);
    const stillReferenced = new Set(remainingProjects.map((project) => project.client_id));
    const deletableClientIds = testClientIds.filter((id) => !stillReferenced.has(id));

    deletedClients = await deleteInBatches(client, "clients", "id", deletableClientIds);

    const skipped = testClientIds.length - deletableClientIds.length;
    if (skipped > 0) {
      console.log(
        `[E2E cleanup] Skipped ${skipped} test client(s) still referenced by a project outside this cleanup's scope.`
      );
    }
  }

  const deletedCompanies = await deleteZeroUseTestCompanies(client, companies);

  return { deletedProjects, deletedClients, deletedCompanies };
}
