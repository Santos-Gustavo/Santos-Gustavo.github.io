const { test, expect } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "../../..");
const JS_DIR = path.join(ROOT, "js");
const FUNCTIONS_DIR = path.join(ROOT, "supabase", "functions");

import fs from "node:fs";
import path from "node:path";


function readFrontendFiles() {
  const root = process.cwd();
  const includeDirs = ["js"];
  const files = [];

  for (const dir of includeDirs) {
    walkDir(path.join(root, dir), files, root);
  }

  return files;
}

function walkDir(dir, files, root) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkDir(fullPath, files, root);
      continue;
    }

    if (!entry.name.endsWith(".js")) {
      continue;
    }

    files.push({
      path: path.relative(root, fullPath).replaceAll("\\", "/"),
      content: fs.readFileSync(fullPath, "utf8"),
    });
  }
}
  
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

    const legacyGlobals = await page.evaluate(() => ({
      saveAndGenerateReport: typeof window.saveAndGenerateReport,
      goNext: typeof window.goNext,
      goBack: typeof window.goBack,
      goHome: typeof window.goHome,
      selectMode: typeof window.selectMode,
      renderProjectList: typeof window.renderProjectList,
      setWork: typeof window.setWork,
      setPhoto: typeof window.setPhoto,
      buildReview: typeof window.buildReview,
      selectPhase: typeof window.selectPhase,
      toggleAlert: typeof window.toggleAlert,
      toggleIncidents: typeof window.toggleIncidents,
    }));

    expect(legacyGlobals).toEqual({
      saveAndGenerateReport: "undefined",
      goNext: "undefined",
      goBack: "undefined",
      goHome: "undefined",
      selectMode: "undefined",
      renderProjectList: "undefined",
      setWork: "undefined",
      setPhoto: "undefined",
      buildReview: "undefined",
      selectPhase: "undefined",
      toggleAlert: "undefined",
      toggleIncidents: "undefined",
    });
  });
});

// test.describe("payment button wiring", () => {
//   test("Multibanco and MB WAY buttons call the correct method", async ({ page }) => {
//     await page.goto("/");

//     await page.evaluate(() => {
//       window.__paymentCalls = [];

//       window.createEupagoPayment = function mockCreateEupagoPayment(method) {
//         window.__paymentCalls.push(method);
//       };
//     });

//     const multibancoButton = page.getByRole("button", {
//       name: /pagar pro por multibanco/i,
//     });

//     const mbwayButton = page.getByRole("button", {
//       name: /pagar pro por mb way/i,
//     });

//     await expect(multibancoButton).toBeVisible();
//     await expect(mbwayButton).toBeVisible();

//     await multibancoButton.click();

//     await expect
//       .poll(async () => page.evaluate(() => window.__paymentCalls))
//       .toEqual(["multibanco"]);

//     await mbwayButton.click();

//     await expect
//       .poll(async () => page.evaluate(() => window.__paymentCalls))
//       .toEqual(["multibanco", "mbway"]);
//   });
// });

test.describe("normalized DB frontend contract", () => {
  const jsFiles = readAllFiles(JS_DIR, [".js"]);

  test("reports payload no longer uses removed company_id/client_id columns", () => {
    const files = readFrontendFiles();

    const reportFiles = files.filter((file) =>
      file.path.includes("js/database/db-reports.js") ||
      file.path.includes("js/reports/")
    );

    for (const file of reportFiles) {
      expectNoPattern(
        file.content,
        /company_id\s*:/,
        `${file.path} should not write company_id into reports payload`,
      );

      expectNoPattern(
        file.content,
        /client_id\s*:/,
        `${file.path} should not write client_id into reports payload`,
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

test("normalizeSentVia work with smallint values", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const module = await import("/js/mappers/report-mapper.js");

    if (typeof module.normalizeSentVia !== "function") {
      return {
        normalizeWhatsApp: "missing",
        normalizeEmail: "missing",
        normalizePdf: "missing",
        normalizeManual: "missing",
      };
    }

    return {
      normalizeWhatsApp: module.normalizeSentVia("whatsapp"),
      normalizeEmail: module.normalizeSentVia("email"),
      normalizePdf: module.normalizeSentVia("pdf_download"),
      normalizeManual: module.normalizeSentVia("manual"),
      normalizeNumericWhatsApp: module.normalizeSentVia(1),
      normalizeNumericEmail: module.normalizeSentVia(2),
      normalizeNumericPdf: module.normalizeSentVia(3),
      normalizeNull: module.normalizeSentVia(null),
    };
  });

  expect(result.normalizeWhatsApp).toBe(1);
  expect(result.normalizeEmail).toBe(2);
  expect(result.normalizePdf).toBe(3);
  expect(result.normalizeManual).toBe(0);
  expect(result.normalizeNumericWhatsApp).toBe(1);
  expect(result.normalizeNumericEmail).toBe(2);
  expect(result.normalizeNumericPdf).toBe(3);
  expect(result.normalizeNull).toBe(0);
});

test.describe("EuPago Edge Function contract", () => {
  const functionFile = path.join(
    FUNCTIONS_DIR,
    "create-eupago-payment",
    "index.ts"
  );

  test("admin client is not overridden with the user Authorization header", () => {
    const content = read(functionFile);

    const forbidden =
      /createClient\(\s*supabaseUrl\s*,\s*serviceRoleKey\s*,\s*{[\s\S]{0,500}Authorization:\s*authHeader/;

    expect(
      forbidden.test(content),
      "Do not create service-role/admin client with Authorization: authHeader. That triggers payments RLS."
    ).toBe(false);
  });


});