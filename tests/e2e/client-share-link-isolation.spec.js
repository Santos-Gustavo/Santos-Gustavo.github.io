import { expect, test } from "@playwright/test";
import {
  createTestShareLink,
  getFunctionUrl,
  missingShareLinkTestEnv,
} from "./helpers/report-share-test-helper.js";

const E2E_REPORT_ID = process.env.E2E_REPORT_ID;
const E2E_SECOND_REPORT_ID = process.env.E2E_SECOND_REPORT_ID;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const INTERNAL_ID_KEYS = ["report_id", "project_id", "company_id", "client_id", "owner_id"];

test("a share link's response never contains another report's data or any internal id", async ({
  request,
}) => {
  const missingEnv = missingShareLinkTestEnv();
  const missing = [
    ...missingEnv,
    !E2E_REPORT_ID && "E2E_REPORT_ID",
    !E2E_SECOND_REPORT_ID && "E2E_SECOND_REPORT_ID",
    !SUPABASE_ANON_KEY && "SUPABASE_ANON_KEY",
  ].filter(Boolean);

  if (missing.length > 0) {
    test.skip(
      true,
      `Set ${missing.join(", ")} in .env — both report ids must be saved reports (with snapshot_json) owned by E2E_USER_ID.`,
    );
  }

  const linkA = await createTestShareLink(E2E_REPORT_ID);
  const linkB = await createTestShareLink(E2E_SECOND_REPORT_ID);

  const [responseA, responseB] = await Promise.all([
    request.post(getFunctionUrl("get-shared-report"), {
      headers: { apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
      data: { token: linkA.token },
    }),
    request.post(getFunctionUrl("get-shared-report"), {
      headers: { apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
      data: { token: linkB.token },
    }),
  ]);

  expect(responseA.status()).toBe(200);
  expect(responseB.status()).toBe(200);

  const bodyA = await responseA.json();
  const bodyB = await responseB.json();

  // Cross-report leakage: token A's response text must never mention anything
  // identifying report B (and vice versa) — a weaker, but still meaningful, check
  // than field-by-field diffing given the two reports may share unrelated field
  // values (e.g. same company name).
  expect(JSON.stringify(bodyA)).not.toContain(E2E_SECOND_REPORT_ID);
  expect(JSON.stringify(bodyB)).not.toContain(E2E_REPORT_ID);

  // No internal id field survives in either response, per the §3.7 allowlist.
  for (const body of [bodyA, bodyB]) {
    assertNoInternalIdKeys(body.report);

    expect(body.report.meta.reportId).toBeNull();
    expect(body.report.meta.projectId).toBeNull();
    expect(body.report.company.id).toBeNull();
    expect(body.report.project.id).toBeNull();
    expect(body.report.project.clientId).toBeNull();

    for (const photo of body.report.photos || []) {
      expect(photo.id).toBeNull();
    }
  }
});

function assertNoInternalIdKeys(value, path = "report") {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoInternalIdKeys(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (INTERNAL_ID_KEYS.includes(key)) {
      throw new Error(`Found forbidden internal id key "${key}" at ${path}.${key}`);
    }

    assertNoInternalIdKeys(nested, `${path}.${key}`);
  }
}
