import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { getServiceRoleClient, hasServiceRoleEnv } from "./helpers/supabase-admin.js";

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const E2E_USER_ID = process.env.E2E_USER_ID;

// Resolves the test user's id without the service-role key, for environments
// where E2E_USER_ID isn't set — same approach global-teardown.js uses.
async function resolveTestUserId() {
  if (E2E_USER_ID) return E2E_USER_ID;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !E2E_EMAIL || !E2E_PASSWORD) {
    return null;
  }

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
  });

  if (error || !data?.user?.id) return null;

  await anonClient.auth.signOut();
  return data.user.id;
}

async function countCompaniesForTestUser() {
  const userId = await resolveTestUserId();
  if (!userId || !hasServiceRoleEnv()) return null;

  const client = getServiceRoleClient();
  const { count, error } = await client
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (error) throw error;
  return count;
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

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 15000,
  });

  await page.waitForTimeout(500);
}

async function createProject(page, { projectName, clientName, contractNum }) {
  await page
    .locator('[data-project-action="new-project"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(/dados do projeto/i, {
    timeout: 10000,
  });

  await page.locator("#projectName").fill(projectName);
  await page.locator("#clientName").fill(clientName);
  await page.locator("#location").fill("Rua Company Profile 123, Porto");
  await page.locator("#contractNum").fill(contractNum);
  await page.locator("#distributedTo").fill("Cliente · Arquivo");
  await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 20000,
  });

  await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 10000,
  });
}

async function getProjectCompanyId(projectName) {
  const userId = await resolveTestUserId();
  if (!userId || !hasServiceRoleEnv()) return null;

  const client = getServiceRoleClient();

  const { data: companies, error: companiesError } = await client
    .from("companies")
    .select("id")
    .eq("owner_id", userId);
  if (companiesError) throw companiesError;

  const companyIds = (companies || []).map((c) => c.id);
  if (companyIds.length === 0) return null;

  const { data: projects, error: projectsError } = await client
    .from("projects")
    .select("company_id")
    .eq("name", projectName)
    .in("company_id", companyIds)
    .limit(1)
    .maybeSingle();

  if (projectsError) throw projectsError;
  return projects?.company_id || null;
}

test.describe("COMPANY-PROFILE-001 — single company profile", () => {
  test("creating two projects does not create two companies", async ({ page }) => {
    const timestamp = Date.now();

    const before = await countCompaniesForTestUser();

    await login(page);

    await createProject(page, {
      projectName: `E2E Company Profile A ${timestamp}`,
      clientName: `E2E Company Profile Client A ${timestamp}`,
      contractNum: `CP-A-${timestamp}`,
    });

    await createProject(page, {
      projectName: `E2E Company Profile B ${timestamp}`,
      clientName: `E2E Company Profile Client B ${timestamp}`,
      contractNum: `CP-B-${timestamp}`,
    });

    const after = await countCompaniesForTestUser();

    if (before === null || after === null) {
      test.skip(true, "SUPABASE_SERVICE_ROLE_KEY / E2E_USER_ID not available for DB-level assertion.");
      return;
    }

    expect(after).toBe(before);
  });

  test("company profile can be edited and does not create a duplicate company", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const updatedName = `E2E Company Profile Edited ${timestamp}`;

    const before = await countCompaniesForTestUser();

    await login(page);

    await page
      .locator('[data-nav-action="open-company-profile"]')
      .filter({ visible: true })
      .click();

    await expect(page.locator("#stepLabel")).toHaveText(/dados da empresa/i, {
      timeout: 10000,
    });

    await expect(page.locator("#companyName")).not.toHaveValue("", { timeout: 10000 });

    await page.locator("#companyName").fill(updatedName);
    await page.locator("#companyPhone").fill("+351 900 000 000");

    await page.locator('[data-company-action="save"]').click();

    await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
      timeout: 10000,
    });

    const after = await countCompaniesForTestUser();

    if (before === null || after === null) {
      test.skip(true, "SUPABASE_SERVICE_ROLE_KEY / E2E_USER_ID not available for DB-level assertion.");
      return;
    }

    expect(after).toBe(before);

    // Re-open the profile screen and confirm the edit persisted (not reverted,
    // not shadowed by a second row).
    await page
      .locator('[data-nav-action="open-company-profile"]')
      .filter({ visible: true })
      .click();

    await expect(page.locator("#companyName")).toHaveValue(updatedName, {
      timeout: 10000,
    });

    await page.locator('[data-company-action="cancel"]').click();
  });

  test("creating a project after editing the company still uses the same company_id", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const projectName = `E2E Company Profile Consistency ${timestamp}`;
    const clientName = `E2E Company Profile Consistency Client ${timestamp}`;

    await login(page);

    await page
      .locator('[data-nav-action="open-company-profile"]')
      .filter({ visible: true })
      .click();

    await expect(page.locator("#stepLabel")).toHaveText(/dados da empresa/i, {
      timeout: 10000,
    });

    await page.locator("#companyName").fill(`E2E Company Profile Consistency Co ${timestamp}`);
    await page.locator('[data-company-action="save"]').click();

    await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
      timeout: 10000,
    });

    await createProject(page, {
      projectName,
      clientName,
      contractNum: `CP-CONSIST-${timestamp}`,
    });

    if (!hasServiceRoleEnv()) {
      test.skip(true, "SUPABASE_SERVICE_ROLE_KEY not available for DB-level assertion.");
      return;
    }

    const projectCompanyId = await getProjectCompanyId(projectName);
    const userId = await resolveTestUserId();

    const client = getServiceRoleClient();
    const { data: companies, error } = await client
      .from("companies")
      .select("id, name, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) throw error;

    expect(projectCompanyId).toBeTruthy();
    expect(projectCompanyId).toBe(companies[0].id);
  });

  test("project creation still works end-to-end with the client datalist", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const projectName = `E2E Company Profile Client Selector ${timestamp}`;
    const clientName = `E2E Company Profile Selector Client ${timestamp}`;

    await login(page);

    await createProject(page, {
      projectName,
      clientName,
      contractNum: `CP-SELECT-${timestamp}`,
    });

    const projectCard = page
      .locator("#projectList .project-card")
      .filter({ hasText: projectName });

    await expect(projectCard).toBeVisible({ timeout: 15000 });
    await expect(projectCard).toContainText(clientName);
  });

  test("editing the company profile shows up in a newly generated report's review screen", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const updatedCompanyName = `E2E Company Profile Report Co ${timestamp}`;
    const projectName = `E2E Company Profile Report Project ${timestamp}`;
    const clientName = `E2E Company Profile Report Client ${timestamp}`;

    await login(page);

    // Edit the company profile first — the report's review screen must reflect
    // this, not stale data (REQ-04).
    await page
      .locator('[data-nav-action="open-company-profile"]')
      .filter({ visible: true })
      .click();

    await expect(page.locator("#stepLabel")).toHaveText(/dados da empresa/i, {
      timeout: 10000,
    });

    await page.locator("#companyName").fill(updatedCompanyName);
    await page.locator('[data-company-action="save"]').click();

    await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
      timeout: 10000,
    });

    await page
      .locator('[data-project-action="new-project"]')
      .filter({ visible: true })
      .click();

    await expect(page.locator("#stepLabel")).toHaveText(/dados do projeto/i, {
      timeout: 10000,
    });

    await page.locator("#projectName").fill(projectName);
    await page.locator("#clientName").fill(clientName);
    await page.locator("#location").fill("Rua Company Profile Report 123, Porto");
    await page.locator("#contractNum").fill(`CP-REPORT-${timestamp}`);
    await page.locator("#distributedTo").fill("Cliente · Arquivo");
    await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

    await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

    await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
      timeout: 20000,
    });

    await page
      .locator('[data-nav-action="select-mode"][data-mode="weekly"]')
      .click();

    await expect(page.locator("#stepLabel")).toHaveText(/passo 1 de 9|período|periodo/i, {
      timeout: 10000,
    });

    await page.locator("#p-reportNum").fill("1");
    await page.locator("#p-reportDate").fill("2026-08-31");
    await page.locator("#p-periodStart").fill("2026-08-24");
    await page.locator("#p-periodEnd").fill("2026-08-31");

    for (let i = 0; i < 8; i++) {
      await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();
      await page.waitForTimeout(150);
    }

    await expect(page.locator("#stepLabel")).toHaveText(/passo 9 de 9|revisão|revisao/i, {
      timeout: 10000,
    });

    await expect(page.locator("#reviewContent")).toContainText(updatedCompanyName, {
      timeout: 10000,
    });
  });
});
