import { expect, test } from "@playwright/test";
import {
  createTestShareLink,
  deleteShareLinksForReport,
  forceExpireTestLink,
  getProjectNameForReport,
  missingShareLinkTestEnv,
} from "./helpers/report-share-test-helper.js";
import { tryReadFixtureState } from "./helpers/e2e-fixtures.js";

// REPORT DELIVERY / CLIENT CONFIRMATION-001 — contractor-facing delivery telemetry on
// the existing report-history/share-link UI. These specs cover the badge/text states
// described in docs/features/CLIENT-SHARE-LINK-001.md (Delivery Telemetry section):
// "Não visualizado" / "Visualizado" / "Expirado" / "Cancelado", plus the forbidden-word
// guard (no approval/signature language allowed in this UI).

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

// E2E-FIXTURES-001 — report ids come from the fixture state file global setup
// writes (tests/e2e/global-setup.js), not manually-set .env values.
const fixtureState = tryReadFixtureState();
const E2E_REPORT_ID = fixtureState?.reportId;
// A second, independent report — used for the expiry test so a backdated created_at
// (see forceExpireTestLink) can never be shadowed by a freshly-created link left over
// from another test on the same report.
const E2E_SECOND_REPORT_ID = fixtureState?.secondReportId;

const FORBIDDEN_WORDS =
  /Aprovado|Aprovação|Aceite|Assinado|Confirmado|Confirmação do cliente|Validado/i;

function missingEnv(reportId, reportIdLabel) {
  const missing = missingShareLinkTestEnv();
  if (!E2E_EMAIL || !E2E_PASSWORD) missing.push("E2E_EMAIL / E2E_PASSWORD");
  if (!reportId) missing.push(reportIdLabel);
  return missing;
}

async function login(page) {
  await page.goto("/");

  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");

  const emailInput = page.locator("#authEmail");
  const passwordInput = page.locator("#authPassword");

  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await expect(passwordInput).toBeVisible({ timeout: 10000 });

  await emailInput.fill(E2E_EMAIL);
  await passwordInput.fill(E2E_PASSWORD);

  await page.getByRole("button", { name: /entrar|login|iniciar/i }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 15000,
  });
}

// Navigates from the project list to the project owning reportId and waits for its
// report-history list to render. Callable more than once per test (via the "←
// Projetos" back button) to model "reopening" the report history after a change.
async function openProjectWithReport(page, projectName, reportId) {
  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 15000,
  });

  await page
    .locator("#projectList")
    .getByText(projectName, { exact: true })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 10000,
  });

  await expect(
    page.locator(`[data-report-history-card="${reportId}"]`)
  ).toBeVisible({ timeout: 15000 });
}

async function reopenProjectWithReport(page, projectName, reportId) {
  await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();
  await openProjectWithReport(page, projectName, reportId);
}

test.describe("share link delivery status (CLIENT-CONFIRMATION-001)", () => {
  test("lifecycle: Não visualizado -> Visualizado -> Cancelado, with no approval/signature wording", async ({
    page,
    context,
  }) => {
    const missing = missingEnv(E2E_REPORT_ID, "fixture report id (run global setup)");
    if (missing.length > 0) {
      test.skip(true, `Set ${missing.join(", ")}.`);
    }

    const projectName = await getProjectNameForReport(E2E_REPORT_ID);
    await deleteShareLinksForReport(E2E_REPORT_ID);

    await login(page);
    await openProjectWithReport(page, projectName, E2E_REPORT_ID);

    const card = page.locator(`[data-report-history-card="${E2E_REPORT_ID}"]`);
    const panel = card.locator("[data-share-panel]");

    await card
      .locator(`[data-report-history-action="create-share-link"]`)
      .click();

    await expect(panel.locator(".share-status-badge")).toHaveText("Não visualizado", {
      timeout: 10000,
    });
    await expect(panel.locator(".share-status-text")).toHaveText(
      "O cliente ainda não abriu este link."
    );
    await expect(panel.locator(".share-status-expiry")).toContainText("Expira em:");
    await expect(panel).not.toContainText(FORBIDDEN_WORDS);

    const shareUrl = await panel.locator(".share-link-input").inputValue();
    expect(shareUrl).toContain("/share.html#token=");

    // Open the link as the client, in an unauthenticated context, to trigger the
    // access_count / last_accessed_at update on the server.
    const clientPage = await context.newPage();
    await clientPage.goto(shareUrl);
    await expect(clientPage.locator("iframe.share-frame")).toBeVisible({
      timeout: 10000,
    });
    await clientPage.close();

    await reopenProjectWithReport(page, projectName, E2E_REPORT_ID);

    const reopenedPanel = page
      .locator(`[data-report-history-card="${E2E_REPORT_ID}"]`)
      .locator("[data-share-panel]");

    await expect(reopenedPanel.locator(".share-status-badge")).toHaveText("Visualizado", {
      timeout: 10000,
    });
    await expect(reopenedPanel.locator(".share-status-text")).toContainText(
      "Último acesso:"
    );
    await expect(reopenedPanel.locator(".share-status-text")).toContainText(
      "1 visualizações"
    );
    await expect(reopenedPanel).not.toContainText(FORBIDDEN_WORDS);

    await reopenedPanel
      .locator(`[data-report-history-action="revoke-share-link"]`)
      .click();

    await expect(reopenedPanel.locator(".share-status-badge")).toHaveText("Cancelado", {
      timeout: 10000,
    });
    await expect(reopenedPanel.locator(".share-status-text")).toHaveText(
      "O acesso a este link foi revogado."
    );
    await expect(
      reopenedPanel.locator(`[data-report-history-action="revoke-share-link"]`)
    ).toHaveCount(0);
    await expect(reopenedPanel).not.toContainText(FORBIDDEN_WORDS);
  });

  test("an expired share link shows Expirado in the report history", async ({ page }) => {
    const missing = missingEnv(E2E_SECOND_REPORT_ID, "fixture second report id (run global setup)");
    if (missing.length > 0) {
      test.skip(true, `Set ${missing.join(", ")}.`);
    }

    const projectName = await getProjectNameForReport(E2E_SECOND_REPORT_ID);
    await deleteShareLinksForReport(E2E_SECOND_REPORT_ID);
    const { token } = await createTestShareLink(E2E_SECOND_REPORT_ID);
    await forceExpireTestLink(token);

    await login(page);
    await openProjectWithReport(page, projectName, E2E_SECOND_REPORT_ID);

    const panel = page
      .locator(`[data-report-history-card="${E2E_SECOND_REPORT_ID}"]`)
      .locator("[data-share-panel]");

    await expect(panel.locator(".share-status-badge")).toHaveText("Expirado", {
      timeout: 10000,
    });
    await expect(panel.locator(".share-status-text")).toContainText(
      "Este link expirou em"
    );
    await expect(panel).not.toContainText(FORBIDDEN_WORDS);
  });
});
