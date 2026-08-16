const { expect } = require("@playwright/test");

async function login(page) {
  await page.goto("/");

  await page.fill("#authEmail", process.env.E2E_EMAIL);
  await page.fill("#authPassword", process.env.E2E_PASSWORD);

  await page.getByRole("button", { name: /^entrar$/i }).click();

  await expect(page.locator("#projectList")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^obras$/i })).toBeVisible();
}

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
  await expect(page.locator("#projectList")).toBeVisible();

  await page.waitForFunction(() => {
    const list = document.querySelector("#projectList");
    if (!list) return false;

    const text = list.innerText || "";

    if (text.includes("A carregar obras")) return false;

    return true;
  });
}

async function waitForAtLeastOneProject(page) {
  await waitForProjectsLoaded(page);
  await expect(page.locator(".project-card").first()).toBeVisible();
}

module.exports = {
  login,
  goHome,
  waitForProjectsLoaded,
  waitForAtLeastOneProject
};