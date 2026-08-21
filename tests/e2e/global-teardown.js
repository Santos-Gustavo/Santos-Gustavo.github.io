import { chromium, expect } from "@playwright/test";

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

const ENABLE_PROJECT_CLEANUP = process.env.E2E_DELETE_ALL_PROJECTS === "true";

async function isVisible(page, selector) {
  return page.locator(selector).filter({ visible: true }).count();
}

async function login(page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "Missing E2E login credentials. Set E2E_EMAIL and E2E_PASSWORD in .env."
    );
  }

  await page.goto("/");

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

    if (/obras/i.test(stepLabel)) {
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

    await page.goto("/");
    await page.waitForTimeout(1000);
  }

  throw new Error("Could not navigate to Obras screen before cleanup.");
}

async function globalTeardown(config) {
  if (!ENABLE_PROJECT_CLEANUP) {
    console.log(
      "[E2E cleanup] Skipped. Set E2E_DELETE_ALL_PROJECTS=true to delete all projects after tests."
    );
    return;
  }

  const baseURL =
    config.projects?.[0]?.use?.baseURL ||
    config.use?.baseURL ||
    "http://localhost:3000";

  const browser = await chromium.launch();
  const page = await browser.newPage({
    baseURL,
  });

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
        name: /eliminar|apagar|remover|apagar obra|delete/i,
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

    console.log(`[E2E cleanup] Deleted ${deletedCount} project(s).`);
  } finally {
    await browser.close();
  }
}

export default globalTeardown;