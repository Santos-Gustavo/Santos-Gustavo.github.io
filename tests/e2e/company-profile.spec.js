import { expect, test } from "@playwright/test";
import {
  expectEstadoDaObraOpen,
  saveEstadoDaObra,
  generateReportFromEstadoDaObra,
  readOpenedReport,
} from "./helpers/canonical-report-helper.js";
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

  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");

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

  await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i, {
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

  test("editing the company profile shows up in a newly generated report", async ({
    page,
  }) => {
    test.setTimeout(90000);

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

    await expect(page.locator("#stepLabel")).toHaveText(/estado da obra/i, {
      timeout: 20000,
    });

    // ESTADO-DA-OBRA-WORKSPACE-001 Phase 4 — the weekly report is generated
    // from the saved Estado da Obra; generate_report reads the company row
    // server-side, so the edited name must be in the generated report.
    await expectEstadoDaObraOpen(page);
    await page.locator("#workStatusSummary").fill("Resumo E2E perfil da empresa.");
    await saveEstadoDaObra(page);
    await generateReportFromEstadoDaObra(page);

    const { text } = await readOpenedReport(page, () =>
      page.locator('#workStatusReportResult [data-generated-report-action="view-pdf"]').click()
    );
    expect(text).toContain(updatedCompanyName);
  });

  // POST-RELEASE-POLISH-001 — company logo. Any picture is normalised to one
  // fixed 512×512 PNG on upload and shown in a fixed-size box in the report;
  // the path is frozen into new reports and checked at the DB boundary.
  test("company logo: any image is normalised to the same size and frozen into new reports", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);

    const userId = await resolveTestUserId();
    test.skip(!userId || !hasServiceRoleEnv(), "Needs E2E user id and SUPABASE_SERVICE_ROLE_KEY.");

    const admin = getServiceRoleClient();
    const { data: companies } = await admin
      .from("companies")
      .select("id, logo_url")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });
    const company = companies[0];
    const originalLogo = company.logo_url;
    const uploaded = [];
    let projectId = null;

    // PNG IHDR: width/height are big-endian uint32 at bytes 16..23.
    const pngSize = async (storagePath) => {
      const { data, error } = await admin.storage.from("project-photos").download(storagePath);
      if (error) throw error;
      const bytes = Buffer.from(await data.arrayBuffer());
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    };
    const currentLogo = async () =>
      (await admin.from("companies").select("logo_url").eq("id", company.id).single()).data.logo_url;
    const makeImage = (width, height, type) =>
      page.evaluate(
        ({ width, height, type }) => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.fillStyle = "#94651f";
          context.fillRect(0, 0, width, height);
          return canvas.toDataURL(type).split(",")[1];
        },
        { width, height, type }
      );

    try {
      await login(page);
      await page.locator('[data-nav-action="open-company-profile"]').filter({ visible: true }).click();
      await expect(page.locator("#stepLabel")).toHaveText(/dados da empresa/i, { timeout: 10000 });
      await expect(page.locator("#companyLogoUploadBtn")).toBeEnabled();

      // A wide PNG and a tall JPEG both end up as the same 512×512 PNG.
      const logoPattern = new RegExp(`^${company.id}/company/logo-[0-9a-f-]{36}\\.png$`);
      for (const [width, height, type, name] of [
        [1200, 300, "image/png", "wide.png"],
        [200, 800, "image/jpeg", "tall.jpg"],
      ]) {
        const previous = await currentLogo();
        await page.locator("#companyLogoInput").setInputFiles({
          name,
          mimeType: type,
          buffer: Buffer.from(await makeImage(width, height, type), "base64"),
        });
        await expect.poll(currentLogo, { timeout: 20000 }).not.toBe(previous);
        const logoPath = await currentLogo();
        uploaded.push(logoPath);
        expect(logoPath).toMatch(logoPattern);
        expect(await pngSize(logoPath)).toEqual({ width: 512, height: 512 });
        await expect(page.locator("#companyLogoPreview img.company-logo-img")).toBeVisible({ timeout: 15000 });
      }
      // Replacing a logo never deletes the old file (old reports use it).
      expect(await pngSize(uploaded[0])).toEqual({ width: 512, height: 512 });
      await expect(page.locator("#companyLogoUploadBtn")).toHaveText("Alterar logótipo");

      // The preview box is the same size whatever the logo.
      const box = await page.locator("#companyLogoPreview").boundingBox();
      expect([Math.round(box.width), Math.round(box.height)]).toEqual([96, 96]);

      // DB boundary: logo_url can only point into the company's own folder.
      const owner = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      await owner.auth.signInWithPassword({ email: E2E_EMAIL, password: E2E_PASSWORD });
      for (const bad of [
        `${crypto.randomUUID()}/company/logo.png`,
        `${company.id}/other/logo.png`,
        `${company.id}/company/../x.png`,
        `${company.id}/company/sub/x.png`,
      ]) {
        const { error } = await owner.from("companies").update({ logo_url: bad }).eq("id", company.id);
        expect(error, `logo_url ${bad} must be rejected`).toBeTruthy();
      }
      expect(await currentLogo()).toBe(uploaded[1]);

      // New reports freeze the current logo and render it.
      const { data: client } = await admin
        .from("clients")
        .insert({ company_id: company.id, name: `E2E Logo Client ${Date.now()}` })
        .select()
        .single();
      const projectName = `E2E Logo Project ${Date.now()}`;
      const { data: project } = await admin
        .from("projects")
        .insert({ company_id: company.id, client_id: client.id, name: projectName, status: 1 })
        .select()
        .single();
      projectId = project.id;

      const { data: generated, error: generateError } = await owner.rpc("generate_report", { p_project_id: project.id });
      expect(generateError).toBeNull();
      expect(generated.snapshot_json.company.logoPath).toBe(uploaded[1]);

      // A snapshot pointing at another company's logo is rejected.
      const { error: foreignLogoError } = await owner.from("reports").insert({
        project_id: project.id,
        report_num: 99,
        snapshot_json: { ...generated.snapshot_json, company: { ...generated.snapshot_json.company, logoPath: `${crypto.randomUUID()}/company/logo.png` } },
      });
      expect(foreignLogoError).toBeTruthy();

      await page.locator('[data-company-action="cancel"]').click();
      await page.locator("#projectList .project-card").filter({ hasText: projectName }).first().click();
      const card = page.locator(`[data-report-history-card="${generated.id}"]`);
      await expect(card).toBeVisible({ timeout: 15000 });
      const opened = await readOpenedReport(page, () => card.locator('[data-report-history-action="open"]').click());
      expect(opened.html).toMatch(/<img class="logo-image" src="https:\/\/[^"]+"/);
      expect(opened.html).not.toContain('class="logo-placeholder"');

      // Client share link shows it too (get-shared-report signs it).
      await card.locator('[data-report-history-action="create-share-link"]').click();
      const shareUrl = await card.locator(".share-link-input").inputValue();
      const clientPage = await context.newPage();
      await clientPage.goto(shareUrl);
      await expect(clientPage.frameLocator("iframe.share-frame").locator("img.logo-image")).toBeVisible({ timeout: 20000 });
      await clientPage.close();

      // Remover logótipo: cleared for future reports; files are kept.
      await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();
      await page.locator('[data-nav-action="open-company-profile"]').filter({ visible: true }).click();
      await page.locator("#companyLogoRemoveBtn").click();
      await expect.poll(currentLogo, { timeout: 15000 }).toBeNull();
      await expect(page.locator("#companyLogoPreview")).toHaveText("Sem logótipo");
      expect(await pngSize(uploaded[1])).toEqual({ width: 512, height: 512 });

      await owner.auth.signOut();
    } finally {
      await admin.from("companies").update({ logo_url: originalLogo }).eq("id", company.id);
      if (projectId) await admin.from("projects").delete().eq("id", projectId);
      if (uploaded.length) await admin.storage.from("project-photos").remove(uploaded);
    }
  });
});
