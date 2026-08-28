import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { APP_ENV } from "../../js/config/env.js";
import { getServiceRoleClient, hasServiceRoleEnv } from "./helpers/supabase-admin.js";

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

const E2E_USER_ID = process.env.E2E_USER_ID;

// Same second-user env vars rls-isolation.spec.js already uses, plus an optional
// direct-id override so cleanup doesn't have to sign in just to learn the id.
const E2E_OTHER_USER_ID = process.env.E2E_OTHER_USER_ID;
const E2E_OTHER_EMAIL = process.env.E2E_OTHER_EMAIL?.trim();
const E2E_OTHER_PASSWORD = process.env.E2E_OTHER_PASSWORD;

const ENABLE_PROJECT_CLEANUP = process.env.E2E_DELETE_ALL_PROJECTS === "true";

const STORAGE_BUCKET = "project-photos";
const STORAGE_DELETE_BATCH_SIZE = 50;

// Test data created by these specs is always named with one of these markers — see
// requirement 6: "E2E" prefix, or "Playwright"/"Teste" anywhere in the name. Matching
// is deliberately case-sensitive and exact-substring, not a loose case-insensitive
// scan, so this can never sweep up a real contractor's client just because their name
// happens to contain "teste" in ordinary Portuguese.
function isTestName(name) {
  const value = String(name || "");
  return value.startsWith("E2E") || value.includes("Playwright") || value.includes("Teste");
}

function chunkArray(items, size) {
  const chunks = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

async function isVisible(page, selector) {
  return page.locator(selector).filter({ visible: true }).count();
}

async function login(page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "Missing E2E login credentials. Set E2E_EMAIL and E2E_PASSWORD in .env."
    );
  }

  await page.goto("/");

  await expect(page.locator("#authEmail")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#authPassword")).toBeVisible({ timeout: 10000 });

  await page.locator("#authEmail").fill(E2E_EMAIL);
  await page.locator("#authPassword").fill(E2E_PASSWORD);

  await page
    .getByRole("button", { name: /entrar|login|iniciar/i })
    .click();

  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const visible = (element) => {
            if (!element) return false;

            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();

            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0
            );
          };

          return Array.from(document.querySelectorAll("button")).some(
            (button) =>
              visible(button) && /sair/i.test(button.textContent || "")
          );
        }),
      {
        timeout: 15000,
        message: "Expected authenticated UI to show Sair after login",
      }
    )
    .toBe(true);

  await page.waitForTimeout(1000);
}

async function goToProjectList(page) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const stepLabel = await page.locator("#stepLabel").innerText().catch(() => "");

    if (/projetos/i.test(stepLabel)) {
      await expect(page.locator("#projectList")).toBeVisible({
        timeout: 10000,
      });

      await page.waitForTimeout(1000);
      return;
    }

    const homeButtons = page.locator('[data-nav-action="home"]').filter({
      visible: true,
    });

    if ((await homeButtons.count()) > 0) {
      await homeButtons.first().click();
      await page.waitForTimeout(700);
      continue;
    }

    const backButtons = page.locator('[data-nav-action="back"]').filter({
      visible: true,
    });

    if ((await backButtons.count()) > 0) {
      await backButtons.first().click();
      await page.waitForTimeout(700);
      continue;
    }

    await page.goto("/");
    await page.waitForTimeout(1000);
  }

  throw new Error("Could not navigate to Projetos screen before cleanup.");
}

// Resolves a Supabase auth user id for cleanup scoping. Prefers an explicit *_USER_ID
// env var (no network round trip); otherwise signs in with the anon key using the same
// email/password rls-isolation.spec.js already uses for its second user, purely to read
// back `data.user.id`, then signs out again. Never uses the service-role key for this —
// signing in is the same thing any test user's own browser session already does.
async function resolveUserId(label, explicitId, email, password) {
  if (explicitId) return explicitId;

  if (!email || !password) return null;

  const anonClient = createClient(APP_ENV.SUPABASE_URL, APP_ENV.SUPABASE_ANON_KEY);

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

// PostgREST encodes .in("col", ids) as a URL query param — with a few hundred UUIDs
// (36 chars each) that URL can exceed the ~16KB request-header limit and the whole
// request fails outright (HeadersOverflowError), not just returns fewer rows. Batching
// every .in() call that scales with accumulated test data (there were 148+ stray
// projects/clients the first time this ran) avoids that entirely.
const ID_BATCH_SIZE = 100;

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

// Deletes exactly the rows a set of test projects owns, in FK-safe order, including the
// Storage objects those projects' photos point at (plain row deletes never touch
// Storage — only the app's delete-project Edge Function does that today, and this
// cleanup path intentionally goes straight to the DB instead of driving that function).
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
    // deployed — treat "relation does not exist" (42P01) as nothing to clean up, not
    // a teardown failure.
    await deleteInBatches(client, "report_share_links", "report_id", reportIds, {
      ignoreErrorCode: "42P01",
    });

    await deleteInBatches(client, "photos", "report_id", reportIds);
    await deleteInBatches(client, "reports", "id", reportIds);
  }

  return deleteInBatches(client, "projects", "id", projectIds);
}

// Service-role, DB-level pass — this is the only thing that actually deletes
// E2E-created *clients* (there is no app UI or Edge Function that deletes a client at
// all). Also re-sweeps projects the browser-driven loop above can't reach (a different
// filter tab, a second test user), since a project referencing a client blocks that
// client's deletion (projects.client_id -> clients.id is ON DELETE RESTRICT).
//
// Scope is strictly: companies owned by the resolved test user id(s), clients under
// those companies whose name matches isTestName(), and projects that point at one of
// those clients. Never touches companies themselves (requirement 8), and never touches
// a client that still has a project outside this scope pointing at it.
async function cleanupTestClientsAndProjects(userIds) {
  if (userIds.length === 0) {
    console.log("[E2E cleanup] No test user id resolved — skipping client/project DB cleanup.");
    return { deletedProjects: 0, deletedClients: 0 };
  }

  if (!hasServiceRoleEnv()) {
    console.log(
      "[E2E cleanup] SUPABASE_SERVICE_ROLE_KEY not set — skipping client/project DB cleanup."
    );
    return { deletedProjects: 0, deletedClients: 0 };
  }

  const client = getServiceRoleClient();

  const { data: companies, error: companiesError } = await client
    .from("companies")
    .select("id")
    .in("owner_id", userIds);

  if (companiesError) throw companiesError;

  const companyIds = (companies || []).map((company) => company.id);

  if (companyIds.length === 0) {
    console.log("[E2E cleanup] No companies found for the configured test user(s).");
    return { deletedProjects: 0, deletedClients: 0 };
  }

  const clients = await selectInBatches(client, "clients", "id, name", "company_id", companyIds, (q) =>
    q.is("deleted_at", null)
  );

  const testClientIds = clients
    .filter((clientRow) => isTestName(clientRow.name))
    .map((clientRow) => clientRow.id);

  if (testClientIds.length === 0) {
    console.log("[E2E cleanup] No E2E-named clients found for the configured test user(s).");
    return { deletedProjects: 0, deletedClients: 0 };
  }

  const projects = await selectInBatches(client, "projects", "id", "client_id", testClientIds);
  const projectIds = projects.map((project) => project.id);

  const deletedProjects = await deleteProjectsDeep(client, projectIds);

  // Re-check for any project still pointing at a candidate client (e.g. one outside
  // this scope, or one deleteProjectsDeep couldn't remove) before deleting it — this
  // mirrors the DB's own ON DELETE RESTRICT rather than fighting it.
  const remainingProjects = await selectInBatches(client, "projects", "client_id", "client_id", testClientIds);

  const stillReferenced = new Set(remainingProjects.map((project) => project.client_id));
  const deletableClientIds = testClientIds.filter((id) => !stillReferenced.has(id));

  const deletedClients = await deleteInBatches(client, "clients", "id", deletableClientIds);

  const skipped = testClientIds.length - deletableClientIds.length;

  if (skipped > 0) {
    console.log(
      `[E2E cleanup] Skipped ${skipped} test client(s) still referenced by a project outside this cleanup's scope.`
    );
  }

  return { deletedProjects, deletedClients };
}

async function globalTeardown(config) {
  if (!ENABLE_PROJECT_CLEANUP) {
    console.log(
      "[E2E cleanup] Skipped. Set E2E_DELETE_ALL_PROJECTS=true to delete all projects after tests."
    );
    return;
  }

  const baseURL =
    config.projects?.[0]?.use?.baseURL ||
    config.use?.baseURL ||
    "http://localhost:3000";

  const browser = await chromium.launch();
  const page = await browser.newPage({
    baseURL,
  });

  // This UI-driven pass is best-effort and intentionally non-fatal: it depends on a
  // delete affordance existing on the project list card, which the app may not expose
  // at all points in its lifecycle (project cards currently only carry "edit" and
  // "archive-hide" actions — see js/projects/project-list.js). If it can't find
  // anything to click, that must never block the DB-level pass below, which is the
  // one actually responsible for this task's goal (deleting E2E clients) and doesn't
  // depend on any UI affordance existing.
  try {
    try {
      page.on("dialog", async (dialog) => {
        await dialog.accept();
      });

      await login(page);
      await goToProjectList(page);

      let deletedCount = 0;

      while (true) {
        await goToProjectList(page);

        const projectCards = page.locator("#projectList .project-card");
        const count = await projectCards.count();

        console.log(`[E2E cleanup] Visible project card count: ${count}`);

        if (count === 0) {
          break;
        }

        const firstCard = projectCards.first();

        const deleteButton = firstCard.getByRole("button", {
          name: /eliminar|remover|remover|remover projeto|delete/i,
        });

        await expect(deleteButton).toBeVisible({ timeout: 10000 });

        await deleteButton.click({
          force: true,
        });

        await expect(projectCards).toHaveCount(count - 1, {
          timeout: 20000,
        });

        deletedCount += 1;
        await page.waitForTimeout(500);
      }

      console.log(`[E2E cleanup] UI pass: deleted ${deletedCount} project(s).`);
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.warn(
      "[E2E cleanup] UI pass failed or found nothing to delete (this is expected if the " +
        "project list has no delete action today) — continuing to the DB pass:",
      error instanceof Error ? error.message : error
    );
  }

  // Second pass: service-role, DB-level. Catches E2E-created *clients* (nothing above
  // touches those — there's no UI or Edge Function that deletes a client), plus any
  // test projects the UI pass above couldn't reach (a non-"Ativas" filter tab, or a
  // second test user). Failure here is logged, not thrown — it must never turn a
  // clean UI-pass run into a failed test run.
  try {
    const userIds = await resolveTestUserIds();
    const { deletedProjects, deletedClients } = await cleanupTestClientsAndProjects(userIds);

    console.log(
      `[E2E cleanup] DB pass: deleted ${deletedProjects} project(s) and ${deletedClients} client(s).`
    );
  } catch (error) {
    console.error(
      "[E2E cleanup] DB pass failed:",
      error instanceof Error ? error.message : error
    );
  }
}

export default globalTeardown;