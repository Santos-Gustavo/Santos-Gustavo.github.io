const { test, expect } = require("@playwright/test");
const { login } = require("../helpers/app-helpers");
const { openE2EProject } = require("../shared/e2e-project");

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function collectUnexpectedBrowserErrors(page, allowedPatterns = []) {
  const unexpectedErrors = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;

    const text = msg.text();

    const isAllowed = allowedPatterns.some((pattern) => pattern.test(text));

    if (!isAllowed) {
      unexpectedErrors.push(text);
    }
  });

  page.on("pageerror", (error) => {
    const text = error.message;

    const isAllowed = allowedPatterns.some((pattern) => pattern.test(text));

    if (!isAllowed) {
      unexpectedErrors.push(text);
    }
  });

  return unexpectedErrors;
}

function collectExpectedConsoleErrors(page, expectedPattern) {
  const expectedErrors = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;

    const text = msg.text();

    if (expectedPattern.test(text)) {
      expectedErrors.push(text);
    }
  });

  page.on("pageerror", (error) => {
    const text = error.message;

    if (expectedPattern.test(text)) {
      expectedErrors.push(text);
    }
  });

  return expectedErrors;
}

async function clickNewProject(page) {
  await page.getByRole("button", { name: /\+ nova obra/i }).click();

  await expect(page.locator("#companyName")).toBeVisible({
    timeout: 10000,
  });
}

async function expectProjectListVisible(page) {
  await expect(page.locator("#projectList")).toBeVisible({
    timeout: 10000,
  });
}

async function expectProjectNameNotInList(page, projectName) {
  await expect(
    page.locator("#projectList .project-card-name", {
      hasText: projectName,
    })
  ).toHaveCount(0);
}

async function expectProjectNameInList(page, projectName) {
  await expect(
    page.locator("#projectList .project-card-name", {
      hasText: projectName,
    })
  ).toBeVisible({
    timeout: 10000,
  });
}

async function fillValidCompanyStep(page, unique) {
  await page.fill("#companyName", `Bad Scenario Empresa ${unique}`);
  await page.fill("#companyNif", `${Date.now()}`.slice(0, 9));
  await page.fill("#responsible", "Responsável Teste");
  await page.fill("#companyPhone", "912345678");
  await page.fill("#companyEmail", "teste@example.com");
}

async function fillValidProjectStep(page, projectName, unique) {
  await page.fill("#projectName", projectName);
  await page.fill("#clientName", `Bad Scenario Cliente ${unique}`);
  await page.fill("#location", "Porto");
  await page.fill("#contractNum", `BAD-${unique}`);
}

async function getVisibleButtons(page) {
  return page
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const style = window.getComputedStyle(button);
          const rect = button.getBoundingClientRect();

          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0 &&
            !button.disabled
          );
        })
        .map((button) => ({
          text: (button.innerText || button.textContent || "").trim(),
          id: button.id || "",
          onclick: button.getAttribute("onclick") || "",
          className: String(button.className || ""),
        }))
    );
}

async function clickVisibleButton(page, name) {
  const buttons = page.getByRole("button", { name });
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);

    if (!(await button.isVisible().catch(() => false))) continue;
    if (!(await button.isEnabled().catch(() => false))) continue;

    await button.click();
    return true;
  }

  return false;
}

async function clickBackToProjectList(page) {
  const candidates = [
    /← obras/i,
    /^←$/,
    /cancelar/i,
    /voltar/i,
  ];

  for (let attempt = 0; attempt < 4; attempt++) {
    if (await page.locator("#projectList").isVisible().catch(() => false)) {
      return;
    }

    for (const name of candidates) {
      const clicked = await clickVisibleButton(page, name);

      if (!clicked) continue;

      await expect
        .poll(
          async () => {
            return await page.locator("#projectList").isVisible().catch(() => false);
          },
          {
            timeout: 2000,
            intervals: [50, 100, 250, 500],
          }
        )
        .toBeTruthy()
        .catch(() => {});

      if (await page.locator("#projectList").isVisible().catch(() => false)) {
        return;
      }
    }
  }

  const visibleButtons = await getVisibleButtons(page);
  const stepLabel = await page.locator("#stepLabel").innerText().catch(() => "");

  throw new Error(
    `Could not navigate back to project list. Current step: "${stepLabel}". Visible buttons: ` +
      JSON.stringify(visibleButtons)
  );
}

test("empty company name should not create a project card", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedBrowserErrors(page);
  const unique = uniqueSuffix();
  const projectName = `Should Not Exist ${unique}`;

  await login(page);

  await clickNewProject(page);

  await page.fill("#companyName", "");
  await page.fill("#companyNif", "123456789");
  await page.fill("#responsible", "Responsável Teste");
  await page.fill("#companyPhone", "912345678");
  await page.fill("#companyEmail", "teste@example.com");

  await page.getByRole("button", { name: /seguinte/i }).click();

  const companyStillVisible = await page.locator("#companyName").isVisible().catch(() => false);

  if (!companyStillVisible) {
    await expect(page.locator("#projectName")).toBeVisible();

    await page.fill("#projectName", projectName);
    await page.fill("#clientName", `Cliente ${unique}`);
    await page.fill("#location", "Porto");
    await page.fill("#contractNum", `BAD-${unique}`);

    await page.getByRole("button", { name: /seguinte/i }).click();
  }

  await clickBackToProjectList(page);

  await expectProjectNameNotInList(page, projectName);

  expect(unexpectedErrors).toEqual([]);
});

test("empty project name shows project-name validation error", async ({ page }) => {
  const expectedPattern = /Nome da obra é obrigatório/i;

  const unexpectedErrors = collectUnexpectedBrowserErrors(page, [expectedPattern]);
  const expectedErrors = collectExpectedConsoleErrors(page, expectedPattern);

  const unique = uniqueSuffix();

  await login(page);

  await clickNewProject(page);

  await fillValidCompanyStep(page, unique);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#projectName")).toBeVisible();

  await page.fill("#projectName", "");
  await page.fill("#clientName", `Cliente Sem Obra ${unique}`);
  await page.fill("#location", "Porto");
  await page.fill("#contractNum", `BAD-${unique}`);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect
    .poll(
      () => expectedErrors.some((text) => expectedPattern.test(text)),
      {
        timeout: 5000,
      }
    )
    .toBe(true);

  expect(unexpectedErrors).toEqual([]);
});

test("empty client name shows client-name validation error", async ({ page }) => {
  const expectedPattern = /Nome do cliente é obrigatório/i;

  const unexpectedErrors = collectUnexpectedBrowserErrors(page, [expectedPattern]);
  const expectedErrors = collectExpectedConsoleErrors(page, expectedPattern);

  const unique = uniqueSuffix();
  const projectName = `No Client Obra ${unique}`;

  await login(page);

  await clickNewProject(page);

  await fillValidCompanyStep(page, unique);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#projectName")).toBeVisible();

  await page.fill("#projectName", projectName);
  await page.fill("#clientName", "");
  await page.fill("#location", "Porto");
  await page.fill("#contractNum", `BAD-${unique}`);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect
    .poll(
      () => expectedErrors.some((text) => expectedPattern.test(text)),
      {
        timeout: 5000,
      }
    )
    .toBe(true);

  expect(unexpectedErrors).toEqual([]);
});

test("partial create flow can be abandoned without creating the named project", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedBrowserErrors(page);

  const unique = uniqueSuffix();
  const projectName = `Cancelled Obra ${unique}`;

  await login(page);

  await clickNewProject(page);

  await fillValidCompanyStep(page, unique);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#projectName")).toBeVisible();

  await fillValidProjectStep(page, projectName, unique);

  await clickBackToProjectList(page);

  await expectProjectNameNotInList(page, projectName);

  expect(unexpectedErrors).toEqual([]);
});

test("delete/archive confirmation cancel keeps the shared E2E project", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedBrowserErrors(page);

  await login(page);

  const state = await openE2EProject(page);

  await page.getByRole("button", { name: /← obras/i }).click();

  await expectProjectListVisible(page);

  const projectCard = page.locator(".project-card", {
    hasText: state.projectName,
  });

  await expect(projectCard).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.dismiss();
  });

  await projectCard.getByRole("button", { name: /apagar/i }).click();

  await expectProjectNameInList(page, state.projectName);

  expect(unexpectedErrors).toEqual([]);
});

test("editing shared E2E project and returning keeps existing project visible", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedBrowserErrors(page);

  await login(page);

  const state = await openE2EProject(page);

  await page.getByRole("button", { name: /← obras/i }).click();

  await expectProjectListVisible(page);

  const projectCard = page.locator(".project-card", {
    hasText: state.projectName,
  });

  await expect(projectCard).toBeVisible();

  await projectCard.getByRole("button", { name: /editar/i }).click();

  await expect(page.locator("#companyName")).toBeVisible();

  await page.fill("#companyName", "");

  await clickBackToProjectList(page);

  await expectProjectNameInList(page, state.projectName);

  expect(unexpectedErrors).toEqual([]);
});