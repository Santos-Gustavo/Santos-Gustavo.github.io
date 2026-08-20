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

  const emailInput = page.locator("#authEmail");
  const passwordInput = page.locator("#authPassword");

  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await expect(passwordInput).toBeVisible({ timeout: 10000 });

  await emailInput.fill(E2E_EMAIL);
  await passwordInput.fill(E2E_PASSWORD);

  await page
    .getByRole("button", { name: /entrar|login|iniciar/i })
    .click();

  await expect
    .poll(
      async () => page.evaluate(() => document.body.innerText),
      {
        timeout: 15000,
        message: "Expected logged-in app screen after login",
      }
    )
    .toMatch(/obras|nova obra|relatório|relatorio|projeto|project/i);
}

test("user can start a weekly report flow", async ({ page }) => {
  await login(page);

  const visibleButtonsAfterLogin = await page
    .locator("button:visible")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.textContent?.trim()).filter(Boolean)
    );

  console.log("Visible buttons after login:", visibleButtonsAfterLogin);

  const newProjectButton = page.getByRole("button", {
    name: /nova obra/i,
  });

  await expect(newProjectButton).toBeVisible({ timeout: 10000 });
  await newProjectButton.click();

  await page.locator("#companyName").fill("E2E Test Company");
    await page.locator("#companyTagline").fill("Construção · Renovação · Remodelação");
    await page.locator("#companyNif").fill("509123456");
    await page.locator("#companyInci").fill("12345");
    await page.locator("#responsible").fill("E2E Responsible");
    await page.locator("#companyPhone").fill("+351 912 345 678");
    await page.locator("#companyEmail").fill("e2e.company@example.com");

    await page.getByRole("button", { name: /seguinte/i }).click();

    const visibleFieldsAfterCompany = await page
    .locator("input:visible, textarea:visible, select:visible, button:visible")
    .evaluateAll((elements) =>
        elements.map((el) => ({
        tag: el.tagName,
        id: el.id || "",
        name: el.getAttribute("name") || "",
        type: el.getAttribute("type") || "",
        placeholder: el.getAttribute("placeholder") || "",
        text: el.textContent?.trim() || "",
        value: el.value || "",
        className: el.className || "",
        }))
    );

    console.log(
    "Visible fields after company step:",
    JSON.stringify(visibleFieldsAfterCompany, null, 2)
    );

    expect(visibleFieldsAfterCompany.length).toBeGreaterThan(0);
    await page.locator("#projectName").fill("E2E Test Project");
    await page.locator("#clientName").fill("E2E Test Client");
    await page.locator("#location").fill("Rua E2E 123, Porto");
    await page.locator("#contractNum").fill("E2E-2026-001");
    await page.locator("#distributedTo").fill("Cliente · Arquivo");
    await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

    await page.getByRole("button", { name: /seguinte/i }).click();

    const visibleAfterProjectStep = await page
    .locator("input:visible, textarea:visible, select:visible, button:visible, div:visible")
    .evaluateAll((elements) =>
        elements
        .map((el) => ({
            tag: el.tagName,
            id: el.id || "",
            text: el.textContent?.trim().replace(/\s+/g, " ").slice(0, 160) || "",
            className: el.className || "",
            dataNavAction: el.getAttribute("data-nav-action") || "",
            dataMode: el.getAttribute("data-mode") || "",
            dataReportAction: el.getAttribute("data-report-action") || "",
        }))
        .filter((el) =>
            el.id ||
            el.text ||
            el.dataNavAction ||
            el.dataMode ||
            el.dataReportAction
        )
    );

    console.log(
    "Visible elements after project step:",
    JSON.stringify(visibleAfterProjectStep, null, 2)
    );

    const bodyAfterProjectStep = await page.evaluate(() => document.body.innerText);

    console.log("BODY AFTER PROJECT STEP:");
    console.log(bodyAfterProjectStep);

    console.log(
    "Visible elements after project step:",
    JSON.stringify(visibleAfterProjectStep, null, 2)
    );

    // temporary discovery assertion only
    expect(bodyAfterProjectStep.length).toBeGreaterThan(0);

  const visibleFields = await page
    .locator("input:visible, textarea:visible, select:visible, button:visible")
    .evaluateAll((elements) =>
      elements.map((el) => ({
        tag: el.tagName,
        id: el.id || "",
        name: el.getAttribute("name") || "",
        type: el.getAttribute("type") || "",
        placeholder: el.getAttribute("placeholder") || "",
        text: el.textContent?.trim() || "",
        value: el.value || "",
        className: el.className || "",
      }))
    );

  console.log(
    "Visible fields after + Nova Obra:",
    JSON.stringify(visibleFields, null, 2)
  );

  expect(visibleFields.length).toBeGreaterThan(0);
});