import { expect, test } from "@playwright/test";
import {
  createTestShareLink,
  getFunctionUrl,
  missingShareLinkTestEnv,
  revokeTestShareLink,
} from "./helpers/report-share-test-helper.js";
import { tryReadFixtureState } from "./helpers/e2e-fixtures.js";

// E2E-FIXTURES-001 — report id comes from the fixture state file global
// setup writes (tests/e2e/global-setup.js), not a manually-set .env value.
const E2E_REPORT_ID = tryReadFixtureState()?.reportId;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

test("a revoked share link behaves identically to an expired one, from the outside", async ({
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

  const { linkId, token } = await createTestShareLink(E2E_REPORT_ID);

  // Confirm the link works before revoking it — otherwise this test could pass for
  // the wrong reason (a link that was never valid in the first place).
  const beforeRevoke = await request.post(getFunctionUrl("get-shared-report"), {
    headers: { apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
    data: { token },
  });
  expect(beforeRevoke.status()).toBe(200);

  const revoked = await revokeTestShareLink(linkId);
  expect(revoked?.revoked_link_id).toBe(linkId);

  await page.goto(`/share.html#token=${token}`);

  await expect(page.getByText("Este link não está disponível.")).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator("iframe.share-frame")).toHaveCount(0);

  const afterRevoke = await request.post(getFunctionUrl("get-shared-report"), {
    headers: { apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
    data: { token },
  });

  expect(afterRevoke.status()).toBe(404);
  const body = await afterRevoke.json();
  expect(body).toEqual({ ok: false, message: "Este link não está disponível." });
});
