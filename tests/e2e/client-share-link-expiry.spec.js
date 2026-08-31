import { expect, test } from "@playwright/test";
import {
  createTestShareLink,
  forceExpireTestLink,
  getFunctionUrl,
  missingShareLinkTestEnv,
} from "./helpers/report-share-test-helper.js";
import { tryReadFixtureState } from "./helpers/e2e-fixtures.js";

// E2E-FIXTURES-001 — report id comes from the fixture state file global
// setup writes (tests/e2e/global-setup.js), not a manually-set .env value.
const E2E_REPORT_ID = tryReadFixtureState()?.reportId;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

test("an expired share link shows the generic unavailable state, not an error", async ({
  page,
  request,
}) => {
  const missingEnv = missingShareLinkTestEnv();

  if (missingEnv.length > 0 || !E2E_REPORT_ID || !SUPABASE_ANON_KEY) {
    test.skip(
      true,
      `Set ${[...missingEnv, !E2E_REPORT_ID && "fixture report id (run global setup)", !SUPABASE_ANON_KEY && "SUPABASE_ANON_KEY"].filter(Boolean).join(", ")}.`,
    );
  }

  const { token } = await createTestShareLink(E2E_REPORT_ID);
  await forceExpireTestLink(token);

  await page.goto(`/share.html#token=${token}`);

  await expect(page.getByText("Este link não está disponível.")).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator("iframe.share-frame")).toHaveCount(0);

  // Same generic shape a client of the raw endpoint would see — no "expired" detail
  // leaked in the response body, per AC-03.1.
  const response = await request.post(getFunctionUrl("get-shared-report"), {
    headers: { apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
    data: { token },
  });

  expect(response.status()).toBe(404);
  const body = await response.json();
  expect(body).toEqual({ ok: false, message: "Este link não está disponível." });
});
