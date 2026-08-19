const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const JS_DIR = path.join(ROOT, "js");
const FUNCTIONS_DIR = path.join(ROOT, "supabase", "functions");

function readAllFiles(dir, extensions = [".js", ".ts", ".html"]) {
  const results = [];

  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...readAllFiles(fullPath, extensions));
      continue;
    }

    if (extensions.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function relative(filePath) {
  return path.relative(ROOT, filePath);
}

function expectNoPattern(content, regex, message) {
  expect(regex.test(content), message).toBe(false);
}

function expectSomeFileContains(files, text, message) {
  const found = files.some((file) => read(file).includes(text));
  expect(found, message).toBe(true);
}

test.describe("global frontend functions", () => {
  test("payment and report helper functions are exposed globally", async ({ page }) => {
    await page.goto("/");

    const globals = await page.evaluate(() => {
      return {
        createEupagoPayment: typeof window.createEupagoPayment,
        saveAndGenerateReport: typeof window.saveAndGenerateReport,
        saveReportToSupabase: typeof window.saveReportToSupabase,
        createReport: typeof window.createReport,
        savePhotosForReport: typeof window.savePhotosForReport,
        getLatestReportForProject: typeof window.getLatestReportForProject,
      };
    });

    expect(globals.createEupagoPayment).toBe("function");
    expect(globals.saveAndGenerateReport).toBe("function");
    expect(globals.saveReportToSupabase).toBe("function");
    expect(globals.createReport).toBe("function");
    expect(globals.savePhotosForReport).toBe("function");
    expect(globals.getLatestReportForProject).toBe("function");
  });
});

test.describe("payment button wiring", () => {
  test("Multibanco and MB WAY buttons call the correct method", async ({ page }) => {
    await page.goto("/");

    await page.evaluate(() => {
      window.__paymentCalls = [];

      window.createEupagoPayment = function mockCreateEupagoPayment(method) {
        window.__paymentCalls.push(method);
      };
    });

    const multibancoButton = page.getByRole("button", {
      name: /pagar pro por multibanco/i,
    });

    const mbwayButton = page.getByRole("button", {
      name: /pagar pro por mb way/i,
    });

    await expect(multibancoButton).toBeVisible();
    await expect(mbwayButton).toBeVisible();

    await multibancoButton.click();

    await expect
      .poll(async () => page.evaluate(() => window.__paymentCalls))
      .toEqual(["multibanco"]);

    await mbwayButton.click();

    await expect
      .poll(async () => page.evaluate(() => window.__paymentCalls))
      .toEqual(["multibanco", "mbway"]);
  });
});

test.describe("normalized DB frontend contract", () => {
  const jsFiles = readAllFiles(JS_DIR, [".js"]);

  test("reports payload no longer uses removed company_id/client_id columns", () => {
    const combined = jsFiles.map(read).join("\n");

    const forbiddenPatterns = [
      /from\(["']reports["']\)[\s\S]{0,1600}company_id\s*:/,
      /from\(["']reports["']\)[\s\S]{0,1600}client_id\s*:/,
      /company_id\s*:\s*companyId[\s\S]{0,1600}from\(["']reports["']\)/,
      /client_id\s*:\s*clientId[\s\S]{0,1600}from\(["']reports["']\)/,
    ];

    for (const regex of forbiddenPatterns) {
      expectNoPattern(
        combined,
        regex,
        `Reports insert/update still appears to use a removed normalized column: ${regex}`
      );
    }
  });

  test("photos payload no longer uses removed relationship columns", () => {
    const combined = jsFiles.map(read).join("\n");

    const forbiddenPatterns = [
      /from\(["']photos["']\)[\s\S]{0,1600}company_id\s*:/,
      /from\(["']photos["']\)[\s\S]{0,1600}client_id\s*:/,
      /from\(["']photos["']\)[\s\S]{0,1600}project_id\s*:/,
      /company_id\s*:\s*companyId[\s\S]{0,1600}from\(["']photos["']\)/,
      /client_id\s*:\s*clientId[\s\S]{0,1600}from\(["']photos["']\)/,
      /project_id\s*:\s*projectId[\s\S]{0,1600}from\(["']photos["']\)/,
    ];

    for (const regex of forbiddenPatterns) {
      expectNoPattern(
        combined,
        regex,
        `Photos insert/update still appears to use a removed normalized column: ${regex}`
      );
    }
  });


  test("reports and photos status/code fields use smallint-safe values", () => {
    const combined = jsFiles.map(read).join("\n");

    expect(combined.includes('status: "draft"')).toBe(false);
    expect(combined.includes("status: 'draft'")).toBe(false);
    expect(combined.includes('sent_via: "whatsapp"')).toBe(false);
    expect(combined.includes("sent_via: 'whatsapp'")).toBe(false);
    expect(combined.includes('source_code: "manual"')).toBe(false);
    expect(combined.includes("source_code: 'manual'")).toBe(false);
  });

  test("createReport uses generated next report number, not raw form value", () => {
    const combined = jsFiles.map(read).join("\n");

    expect(
      combined.includes("getNextReportNum"),
      "createReport should generate next report number to avoid reports_project_report_num_unique violations"
    ).toBe(true);

    expect(
      combined.includes("report_num: v.reportNum ? Number(v.reportNum) : null"),
      "createReport should not directly trust v.reportNum anymore"
    ).toBe(false);
  });

  test("required normalized relationship columns are still used", () => {
    const combined = jsFiles.map(read).join("\n");

    expect(combined.includes("client_id")).toBe(true);
    expect(combined.includes("project_id")).toBe(true);
    expect(combined.includes("report_id")).toBe(true);
  });
});

test.describe("sent_via conversion contract", () => {
  test("normalizeSentVia work with smallint values", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(() => {
      return {
        normalizeWhatsApp: window.normalizeSentVia
          ? window.normalizeSentVia("WhatsApp")
          : "missing",
        normalizeEmail: window.normalizeSentVia
          ? window.normalizeSentVia("Email")
          : "missing",
        normalizePdf: window.normalizeSentVia
          ? window.normalizeSentVia("PDF")
          : "missing",
        normalizeManual: window.normalizeSentVia
          ? window.normalizeSentVia("Manual")
          : "missing",
      };
    });

    expect(result.normalizeWhatsApp).toBe(1);
    expect(result.normalizeEmail).toBe(2);
    expect(result.normalizePdf).toBe(3);
    expect(result.normalizeManual).toBe(0);
  });
});

test.describe("EuPago Edge Function contract", () => {
  const functionFile = path.join(
    FUNCTIONS_DIR,
    "create-eupago-payment",
    "index.ts"
  );

//   test("create-eupago-payment uses separate user and admin clients", () => {
//     const content = read(functionFile);

//     expect(content).toContain("const supabaseUser");
//     expect(content).toContain("const supabaseAdmin");
//     expect(content).toContain("supabaseUser.auth.getUser()");
//     expect(content).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
//   });

  test("admin client is not overridden with the user Authorization header", () => {
    const content = read(functionFile);

    const forbidden =
      /createClient\(\s*supabaseUrl\s*,\s*serviceRoleKey\s*,\s*{[\s\S]{0,500}Authorization:\s*authHeader/;

    expect(
      forbidden.test(content),
      "Do not create service-role/admin client with Authorization: authHeader. That triggers payments RLS."
    ).toBe(false);
  });

//   test("EuPago business failure is handled even when HTTP status is 200", () => {
//     const content = read(functionFile);

//     expect(content).toContain("isEuPagoSuccess");
//     expect(content).toContain("STATUS_FAILED");
//     expect(content).toContain("raw_create_response");

//     expect(
//       content.includes("!eupagoResponse.ok || !isEuPagoSuccess"),
//       "EuPago can return HTTP 200 with sucesso:false, so body success must be checked"
//     ).toBe(true);
//   });
});