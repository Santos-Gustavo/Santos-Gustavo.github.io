import { expect, test } from "@playwright/test";
import {
  createTestShareLink,
  missingShareLinkTestEnv,
} from "./helpers/report-share-test-helper.js";

const E2E_REPORT_ID = process.env.E2E_REPORT_ID;

test("client share link renders a read-only report with no admin surface reachable", async ({
  page,
}) => {
  const missingEnv = missingShareLinkTestEnv();

  if (missingEnv.length > 0 || !E2E_REPORT_ID) {
    test.skip(
      true,
      `Set ${[...missingEnv, !E2E_REPORT_ID && "E2E_REPORT_ID"].filter(Boolean).join(", ")} in .env — E2E_REPORT_ID must be a saved report (with snapshot_json) owned by E2E_USER_ID.`,
    );
  }

  const { token } = await createTestShareLink(E2E_REPORT_ID);

  // No login step at all — this is the point of the test.
  await page.goto(`/share.html#token=${token}`);

  const frame = page.frameLocator("iframe.share-frame");
  await expect(frame.locator("body")).toBeVisible({ timeout: 10000 });

  // Different document entirely, not just hidden.
  await expect(page.locator("#authScreen")).toHaveCount(0);
  await expect(page.locator("#appScreen")).toHaveCount(0);

  // Zero admin/lifecycle affordances anywhere the client could reach — top page or
  // inside the rendered report — per AC-04.3.
  for (const attr of [
    "data-project-action",
    "data-report-action",
    "data-nav-action",
    "data-auth-action",
    "data-payment-action",
    "data-report-history-action",
  ]) {
    await expect(page.locator(`[${attr}]`)).toHaveCount(0);
    await expect(frame.locator(`[${attr}]`)).toHaveCount(0);
  }

  const forbiddenLabels =
    /Editar|Arquivar|Ocultar|Reabrir|Pausar|Marcar como conclu[íi]do|Novo relat[óo]rio|Novo projeto/i;

  await expect(page.getByText(forbiddenLabels)).toHaveCount(0);
  await expect(frame.getByText(forbiddenLabels)).toHaveCount(0);
});
