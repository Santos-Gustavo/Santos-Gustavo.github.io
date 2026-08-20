const { expect } = require("@playwright/test");

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function login(page) {
  const email = requireEnv("E2E_EMAIL");
  const password = requireEnv("E2E_PASSWORD");

  await page.goto("/");

  await page.fill("#authEmail", email);
  await page.fill("#authPassword", password);

  await page.getByRole("button", { name: /^entrar$/i }).click();

  await expect(page.locator("#projectList")).toBeVisible({
    timeout: 10000,
  });
}

module.exports = {
  login,
};


async function goHome(page) {
  const homeButton = page.getByRole("button", { name: /voltar ao início/i });

  if (await homeButton.count()) {
    await homeButton.first().click();
  }

  await expect(page.locator("#projectList")).toBeVisible();
}

module.exports = {
  login,
  goHome
};


async function waitForProjectsLoaded(page) {
  await page.waitForLoadState("domcontentloaded");

  await expect
    .poll(
      async () => {
        return await page.evaluate(() => {
          const isVisible = (el) => {
            if (!el) return false;
            if (typeof el.checkVisibility === "function") {
              return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
            }
            return Boolean(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
          };

          const stepLabel = document.querySelector("#stepLabel")?.textContent?.trim() || "";
          const bodyText = document.body?.innerText || "";

          const candidates = Array.from(
            document.querySelectorAll(
              "[data-project-action], [data-action='select-project'], [data-project-id], .project-card"
            )
          );

          const hasVisibleProjectCard = candidates.some(isVisible);

          return (
            /obras/i.test(stepLabel) ||
            /nova obra/i.test(bodyText) ||
            hasVisibleProjectCard
          );
        });
      },
      {
        timeout: 15000,
        message: "Expected projects screen or project cards/actions to be loaded and visible",
      }
    )
    .toBe(true);

  const projectAction = page
    .locator(
      [
        "[data-project-action='select']",
        "[data-action='select-project']",
        "[data-project-id]",
        ".project-card",
        "button:has-text('Relatório')",
        "button:has-text('Relatorio')",
        "button:has-text('Abrir')",
        "button:has-text('Editar')",
      ].join(", ")
    )
    .filter({ visible: true })
    .first();

  await expect(projectAction).toBeVisible({ timeout: 15000 });
}

async function waitForAtLeastOneProject(page) {
  await waitForProjectsLoaded(page);
}

module.exports = {
  login,
  goHome,
  waitForProjectsLoaded,
  waitForAtLeastOneProject
};