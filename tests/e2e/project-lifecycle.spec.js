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
          const isVisible = (element) => {
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
              isVisible(button) && /sair/i.test(button.textContent || "")
          );
        }),
      {
        timeout: 15000,
        message: "Expected authenticated UI to show Sair after login",
      }
    )
    .toBe(true);

  await page.waitForTimeout(500);
}

test("project can be paused and resumed from the project page", async ({
  page,
}) => {
  const timestamp = Date.now();

  const projectName = `E2E Lifecycle Project ${timestamp}`;
  const clientName = `E2E Lifecycle Client ${timestamp}`;
  const contractNum = `LIFE-${timestamp}`;

  await login(page);

  await page.getByRole("button", { name: /novo projeto/i }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /configuração 1 de 2|configuracao 1 de 2|empresa/i,
    { timeout: 10000 }
  );

  await page.locator("#companyName").fill("E2E Lifecycle Company");
  await page
    .locator("#companyTagline")
    .fill("Construção · Renovação · Remodelação");
  await page.locator("#companyNif").fill("509123456");
  await page.locator("#companyInci").fill("12345");
  await page.locator("#responsible").fill("E2E Responsible");
  await page.locator("#companyPhone").fill("+351 912 345 678");
  await page.locator("#companyEmail").fill("e2e.company@example.com");

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /configuração 2 de 2|configuracao 2 de 2|projeto/i,
    { timeout: 10000 }
  );

  await page.locator("#projectName").fill(projectName);
  await page.locator("#clientName").fill(clientName);
  await page.locator("#location").fill("Rua Lifecycle 123, Porto");
  await page.locator("#contractNum").fill(contractNum);
  await page.locator("#distributedTo").fill("Cliente · Arquivo");
  await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 10000,
  });

  await expect(page.locator("#modeProjectLabel")).toHaveText(projectName);
  await expect(page.locator("#modeProjectStatus")).toHaveText(/em curso/i);

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toMatch(/pausar/i);
    await dialog.accept("Pausa E2E para validar ciclo de vida");
  });

  await page
    .locator('[data-project-lifecycle-action="pause"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#modeProjectStatus")).toHaveText(/pausada/i, {
    timeout: 15000,
  });

  await expect(
    page.locator('[data-project-lifecycle-action="resume"]').filter({
        visible: true,
    })
    ).toBeVisible({
    timeout: 10000,
    });

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toMatch(/retomar/i);
    await dialog.accept("Retoma E2E para validar ciclo de vida");
  });

  await page
    .locator('[data-project-lifecycle-action="resume"]')
    .filter({ visible: true })
    .click();

  await expect(page.locator("#modeProjectStatus")).toHaveText(/em curso/i, {
    timeout: 15000,
  });

  await expect(
    page.locator('[data-project-lifecycle-action="pause"]').filter({
        visible: true,
    })
    ).toBeVisible({
    timeout: 10000,
    });
});