import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { APP_ENV } from "../../js/config/env.js";

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

const E2E_OTHER_EMAIL = process.env.E2E_OTHER_EMAIL?.trim();
const E2E_OTHER_PASSWORD = process.env.E2E_OTHER_PASSWORD;

async function login(page, email, password) {
  await page.goto("/");

  await expect(page.locator("#authEmail")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#authPassword")).toBeVisible({ timeout: 10000 });

  await page.locator("#authEmail").fill(email);
  await page.locator("#authPassword").fill(password);

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

  await expect(page.locator("#stepLabel")).toHaveText(
    /configuração 1 de 2|configuracao 1 de 2|empresa/i,
    { timeout: 10000 }
  );

  await page.locator("#companyName").fill("E2E RLS Isolation Company");
  await page
    .locator("#companyTagline")
    .fill("Construção · Renovação · Remodelação");
  await page.locator("#companyNif").fill("509123456");
  await page.locator("#companyInci").fill("12345");
  await page.locator("#responsible").fill("E2E Responsible");
  await page.locator("#companyPhone").fill("+351 912 345 678");
  await page.locator("#companyEmail").fill("e2e.company@example.com");

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /configuração 2 de 2|configuracao 2 de 2|projeto/i,
    { timeout: 10000 }
  );

  await page.locator("#projectName").fill(projectName);
  await page.locator("#clientName").fill(clientName);
  await page.locator("#location").fill("Rua Isolamento RLS 789, Porto");
  await page.locator("#contractNum").fill(contractNum);
  await page.locator("#distributedTo").fill("Cliente · Arquivo");
  await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 20000,
  });

  await expect(page.locator("#modeProjectLabel")).toHaveText(projectName);
}

async function getOwnProjectIdFromList(page, projectName) {
  await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 10000,
  });

  const projectCard = page
    .locator("#projectList .project-card")
    .filter({ hasText: projectName });

  await expect(projectCard).toHaveCount(1, { timeout: 15000 });

  const projectId = await projectCard.first().getAttribute("data-project-id");

  return projectId;
}

test("user B cannot see or directly fetch a project created by user A", async ({
  browser,
}) => {
  test.setTimeout(60000);

  test.skip(
    !E2E_OTHER_EMAIL || !E2E_OTHER_PASSWORD,
    "Skipping RLS isolation test: set E2E_OTHER_EMAIL and E2E_OTHER_PASSWORD in .env to a second, separate Supabase user to enable cross-tenant checks."
  );

  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "Missing E2E login credentials for user A. Set E2E_EMAIL and E2E_PASSWORD in .env."
    );
  }

  const timestamp = Date.now();
  const projectName = `E2E RLS Isolation Project ${timestamp}`;
  const clientName = `E2E RLS Isolation Client ${timestamp}`;
  const contractNum = `RLS-ISO-${timestamp}`;

  // Separate browser contexts so user A's and user B's sessions never share
  // cookies/localStorage — this is what makes the two logins independent.
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  let projectId;

  try {
    await login(pageA, E2E_EMAIL, E2E_PASSWORD);
    await createProject(pageA, { projectName, clientName, contractNum });

    projectId = await getOwnProjectIdFromList(pageA, projectName);
    expect(projectId).toBeTruthy();
  } finally {
    await contextA.close();
  }

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();

  try {
    await login(pageB, E2E_OTHER_EMAIL, E2E_OTHER_PASSWORD);

    await expect(
      pageB.locator("#projectList .project-card").filter({ hasText: projectName })
    ).toHaveCount(0, { timeout: 10000 });

    // Also probe with a direct, anon-key Supabase client authenticated as
    // user B. This proves the isolation comes from RLS on the "projects"
    // table itself, not just from app-level query filtering in the UI.
    const supabaseAsUserB = createClient(
      APP_ENV.SUPABASE_URL,
      APP_ENV.SUPABASE_ANON_KEY
    );

    const { error: signInError } = await supabaseAsUserB.auth.signInWithPassword({
      email: E2E_OTHER_EMAIL,
      password: E2E_OTHER_PASSWORD,
    });

    expect(signInError).toBeNull();

    const { data: foreignProject, error: foreignProjectError } =
      await supabaseAsUserB
        .from("projects")
        .select("id, company_id, client_id, name")
        .eq("id", projectId)
        .maybeSingle();

    expect(foreignProjectError).toBeNull();
    expect(foreignProject).toBeNull();

    await supabaseAsUserB.auth.signOut();
  } finally {
    await contextB.close();
  }
});
