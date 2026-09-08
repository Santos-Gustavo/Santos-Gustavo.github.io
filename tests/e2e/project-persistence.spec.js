import { expect, test } from "@playwright/test";

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

async function login(page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "Missing E2E login credentials. Set E2E_EMAIL and E2E_PASSWORD in .env."
    );
  }

  await page.goto("/");

  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");

  const emailInput = page.locator("#authEmail");
  const passwordInput = page.locator("#authPassword");

  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await expect(passwordInput).toBeVisible({ timeout: 10000 });

  await emailInput.fill(E2E_EMAIL);
  await passwordInput.fill(E2E_PASSWORD);

  await page
    .getByRole("button", { name: /entrar|login|iniciar/i })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 15000,
  });

  await page.waitForTimeout(500);
}


test("created project appears in project list and can be reopened", async ({
  page,
}) => {
  const timestamp = Date.now();

  const projectName = `E2E Persist Project ${timestamp}`;
  const clientName = `E2E Persist Client ${timestamp}`;
  const location = "Rua Persistência 123, Porto";
  const contractNum = `PERSIST-${timestamp}`;

  await login(page);

  await page
  .locator('[data-project-action="new-project"]')
  .filter({ visible: true })
  .click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /dados do projeto/i,
    { timeout: 10000 }
  );

  await page.locator("#projectName").fill(projectName);
  await page.locator("#clientName").fill(clientName);
  await page.locator("#location").fill(location);
  await page.locator("#contractNum").fill(contractNum);
  await page.locator("#distributedTo").fill("Cliente · Arquivo");
  await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 20000,
  });

  await page.locator('[data-nav-action="back"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 10000,
  });

  const projectCard = page
    .locator("#projectList .project-card")
    .filter({ hasText: projectName });

  await expect(projectCard).toBeVisible({
    timeout: 15000,
  });

  // PROJECT-HUB-INTEGRATION-001 — the card itself now opens Estado da Obra;
  // "Mais opções" is where the mode picker moved to.
  await projectCard.getByRole("button", { name: /mais opções/i }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 10000,
  });

  await expect(page.locator("#modeProjectLabel")).toHaveText(projectName);
  // Exact text — "Relatório Semanal" is the mode-picker tile; a loose /i regex
  // would also match Estado da Obra's "Gerar relatório semanal" shortcut
  // button, which sits in the DOM at the same time (PROJECT-HUB-INTEGRATION-001).
  await expect(page.getByText("Relatório Semanal", { exact: true })).toBeVisible();
  await expect(page.getByText(/legal \/ financeiro/i)).toBeVisible();
});