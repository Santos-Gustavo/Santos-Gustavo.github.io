const { test, expect } = require("@playwright/test");
const { failOnConsoleErrors } = require("../helpers");
const { login, waitForAtLeastOneProject } = require("../helpers/app-helpers");


async function expectStep(page, labelRegex) {
  await expect(page.locator("#stepLabel")).toHaveText(labelRegex);
}

async function selectWeeklyMode(page) {
  const weeklyMode = page
    .locator('[data-nav-action="select-mode"][data-mode="weekly"]')
    .filter({ hasText: /relatório semanal|relatorio semanal|semanal/i })
    .first();

  await expect(weeklyMode).toBeVisible({ timeout: 10000 });
  await weeklyMode.click();

  await expectStep(page, /período|periodo/i);
}

async function selectLegalMode(page) {
  const legalMode = page
    .locator('[data-nav-action="select-mode"][data-mode="legal"]')
    .filter({ hasText: /legal|financeiro/i })
    .first();

  await expect(legalMode).toBeVisible({ timeout: 10000 });
  await legalMode.click();

  await expectStep(page, /período|periodo/i);
}

async function openFirstProject(page) {
  await waitForAtLeastOneProject(page);

  const clicked = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const candidates = Array.from(
      document.querySelectorAll(
        [
          "[data-project-action='select']",
          "[data-action='select-project']",
          "[data-project-id]",
          ".project-card",
        ].join(", ")
      )
    );

    const target = candidates.find(visible);

    if (!target) {
      return false;
    }

    target.click();
    return true;
  });

  expect(clicked).toBe(true);

  await expect(page.locator("#stepLabel")).toHaveText(
    /tipo de relatório|tipo de relatorio|relatório|relatorio/i,
    { timeout: 15000 }
  );
}

test.beforeEach(async ({ page }) => {
  failOnConsoleErrors(page);
});

test("weekly report follows weekly path", async ({ page }) => {
  await openFirstProject(page);
  await selectWeeklyMode(page);

  await page.getByRole("button", { name: /seguinte/i }).click();
  await expectStep(page, /progresso/i);
});

test("legal financeiro follows legal path", async ({ page }) => {
  await openFirstProject(page);
  await selectLegalMode(page);

  await page.getByRole("button", { name: /seguinte/i }).click();
  await expectStep(page, /financeiro/i);
});

test("go home returns to projects and app can continue", async ({ page }) => {
  await login(page);

  await openFirstProject(page);
  await selectWeeklyMode(page);

  await expectStep(page, /período|periodo/i);

  const homeClicked = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const candidates = Array.from(
      document.querySelectorAll(
        [
          "[data-nav-action='home']",
          "button",
        ].join(", ")
      )
    );

    const target = candidates.find((el) => {
      const text = el.textContent || "";

      return (
        visible(el) &&
        (
          el.dataset?.navAction === "home" ||
          /obras/i.test(text) ||
          /sair/i.test(text)
        )
      );
    });

    if (!target) {
      return false;
    }

    target.click();
    return true;
  });

  expect(homeClicked).toBe(true);

  await waitForAtLeastOneProject(page);

  await openFirstProject(page);
  await selectWeeklyMode(page);

  await expectStep(page, /período|periodo/i);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expectStep(page, /progresso/i);
});