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