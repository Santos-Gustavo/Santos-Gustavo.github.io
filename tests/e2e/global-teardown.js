import dotenv from "dotenv";
import { chromium, expect } from "@playwright/test";
import { cleanupE2EData } from "./helpers/e2e-fixtures.js";

// playwright.config.js already loads .env for the main process, but
// globalTeardown is a separately-imported ESM module — this call is a no-op
// when the vars are already set (dotenv never overrides an existing
// process.env key) and a safety net when they aren't.
dotenv.config();

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

// E2E-FIXTURES-001 — replaces the old positive opt-in flag
// (E2E_DELETE_ALL_PROJECTS=true, easy to forget and easy to leave permanently
// on in .env, both of which happened) with a safer negative escape hatch:
// cleanup now runs by default on every `npm run test:e2e`, and this is only
// set to skip it when deliberately inspecting failed-test data by hand.
// Normalized instead of a strict `=== "true"` check so a value quoted,
// padded, or differently-cased in .env still resolves correctly.
function isSkipCleanup(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

const SKIP_CLEANUP = isSkipCleanup(process.env.E2E_SKIP_CLEANUP);

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

  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const visible = (element) => {
            if (!element) return false;

            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();

            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0
            );
          };

          return Array.from(document.querySelectorAll("button")).some(
            (button) =>
              visible(button) && /sair/i.test(button.textContent || "")
          );
        }),
      {
        timeout: 15000,
        message: "Expected authenticated UI to show Sair after login",
      }
    )
    .toBe(true);

  await page.waitForTimeout(1000);
}

async function goToProjectList(page) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const stepLabel = await page.locator("#stepLabel").innerText().catch(() => "");

    if (/projetos/i.test(stepLabel)) {
      await expect(page.locator("#projectList")).toBeVisible({
        timeout: 10000,
      });

      await page.waitForTimeout(1000);
      return;
    }

    const homeButtons = page.locator('[data-nav-action="home"]').filter({
      visible: true,
    });

    if ((await homeButtons.count()) > 0) {
      await homeButtons.first().click();
      await page.waitForTimeout(700);
      continue;
    }

    const backButtons = page.locator('[data-nav-action="back"]').filter({
      visible: true,
    });

    if ((await backButtons.count()) > 0) {
      await backButtons.first().click();
      await page.waitForTimeout(700);
      continue;
    }

    await page.goto("/app.html");
    await page.waitForTimeout(1000);
  }

  throw new Error("Could not navigate to Projetos screen before cleanup.");
}

async function globalTeardown(config) {
  if (SKIP_CLEANUP) {
    console.log("[E2E cleanup] Skipped because E2E_SKIP_CLEANUP=true");
    return;
  }

  // Non-secret status line — logs only the resolved boolean, never any env
  // value or credential, so this is safe to leave permanently.
  console.log("[E2E cleanup] Enabled: true");

  const baseURL =
    config.projects?.[0]?.use?.baseURL ||
    config.use?.baseURL ||
    "http://localhost:3000";

  const browser = await chromium.launch();
  const page = await browser.newPage({
    baseURL,
  });

  // This UI-driven pass is best-effort and intentionally non-fatal: it depends on a
  // delete affordance existing on the project list card, which the app may not expose
  // at all points in its lifecycle (project cards currently only carry "edit" and
  // "archive-hide" actions — see js/projects/project-list.js). If it can't find
  // anything to click, that must never block the DB-level pass below, which is the
  // one actually responsible for this task's goal (deleting E2E clients) and doesn't
  // depend on any UI affordance existing.
  try {
    try {
      page.on("dialog", async (dialog) => {
        await dialog.accept();
      });

      await login(page);
      await goToProjectList(page);

      let deletedCount = 0;

      while (true) {
        await goToProjectList(page);

        const projectCards = page.locator("#projectList .project-card");
        const count = await projectCards.count();

        console.log(`[E2E cleanup] Visible project card count: ${count}`);

        if (count === 0) {
          break;
        }

        const firstCard = projectCards.first();

        const deleteButton = firstCard.getByRole("button", {
          name: /eliminar|remover|remover|remover projeto|delete/i,
        });

        await expect(deleteButton).toBeVisible({ timeout: 10000 });

        await deleteButton.click({
          force: true,
        });

        await expect(projectCards).toHaveCount(count - 1, {
          timeout: 20000,
        });

        deletedCount += 1;
        await page.waitForTimeout(500);
      }

      console.log(`[E2E cleanup] UI pass: deleted ${deletedCount} project(s).`);
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.warn(
      "[E2E cleanup] UI pass failed or found nothing to delete (this is expected if the " +
        "project list has no delete action today) — continuing to the DB pass:",
      error instanceof Error ? error.message : error
    );
  }

  // Second pass: service-role, DB-level, via the shared e2e-fixtures helper (the same
  // module global-setup.js uses to create this data, so creation and cleanup always
  // agree on what counts as E2E test data). Catches E2E-created *clients* (the UI pass
  // above only ever targets project cards — CLIENT-MANAGEMENT-001 did add a client
  // "Eliminar" action, but it's blocked for any client with a linked project, which
  // describes essentially every E2E-created client, so this DB pass remains the one
  // that actually clears them), plus any test projects the UI pass couldn't reach (a
  // non-"Ativas" filter tab, or a second test user), plus zero-use test companies once
  // their clients/projects are gone. Failure here is logged, not thrown — it must
  // never turn a clean UI-pass run into a failed test run.
  try {
    const { deletedProjects, deletedClients, deletedCompanies } = await cleanupE2EData();

    console.log(
      `[E2E cleanup] DB pass: deleted ${deletedProjects} project(s), ${deletedClients} client(s), and ${deletedCompanies} zero-use test compan${deletedCompanies === 1 ? "y" : "ies"}.`
    );
  } catch (error) {
    console.error(
      "[E2E cleanup] DB pass failed:",
      error instanceof Error ? error.message : error
    );
  }
}

export default globalTeardown;
