const { test, expect } = require("@playwright/test");
const { login } = require("../helpers/app-helpers");

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

async function expectProjectListVisible(page) {
  await expect(page.locator("#projectList")).toBeVisible({
    timeout: 10000,
  });
}

async function expectExactProjectCardNameCount(page, projectName, count) {
  await expect(
    page.locator("#projectList .project-card-name").filter({
      hasText: new RegExp(`^${escapeRegExp(projectName)}$`),
    })
  ).toHaveCount(count, {
    timeout: 10000,
  });
}

async function createProjectThroughUi(page, overrides = {}) {
  const unique = uniqueSuffix();

  const project = {
    unique,

    companyName: `Edit Persist Empresa ${unique}`,
    companyNif: `${Date.now()}`.slice(0, 9),
    responsible: "Responsável Teste",
    companyPhone: "912345678",
    companyEmail: "teste@example.com",

    projectName: `Edit Persist Obra ${unique}`,
    clientName: `Edit Persist Cliente ${unique}`,
    location: "Porto",
    contractNum: `EDIT-${unique}`,
    contractValue: "1000",

    ...overrides,
  };

  await expectProjectListVisible(page);

  await page.getByRole("button", { name: /\+ nova obra/i }).click();

  await expect(page.locator("#companyName")).toBeVisible({
    timeout: 10000,
  });

  await page.fill("#companyName", project.companyName);
  await page.fill("#companyNif", project.companyNif);
  await page.fill("#responsible", project.responsible);
  await page.fill("#companyPhone", project.companyPhone);
  await page.fill("#companyEmail", project.companyEmail);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#projectName")).toBeVisible({
    timeout: 10000,
  });

  await page.fill("#projectName", project.projectName);
  await page.fill("#clientName", project.clientName);
  await page.fill("#location", project.location);
  await page.fill("#contractNum", project.contractNum);

  const contractValue = page.locator("#contractValue").first();

  if ((await contractValue.count()) > 0 && (await contractValue.isVisible())) {
    await contractValue.fill(project.contractValue);
  }

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 10000,
  });

  await page.getByRole("button", { name: /← obras/i }).click();

  await expectProjectListVisible(page);

  await expectExactProjectCardNameCount(page, project.projectName, 1);

  return project;
}

async function openEditFromProjectList(page, projectName) {
  await expectProjectListVisible(page);

  const projectCard = page.locator(".project-card", {
    hasText: projectName,
  }).first();

  await expect(projectCard).toBeVisible({
    timeout: 10000,
  });

  await projectCard.getByRole("button", { name: /editar/i }).click();

  await expect(page.locator("#companyName")).toBeVisible({
    timeout: 10000,
  });
}

async function saveProjectEdit(page) {
  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#projectName")).toBeVisible({
    timeout: 10000,
  });

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expectProjectListVisible(page);
}

async function deleteProjectFromList(page, projectName) {
  await expectProjectListVisible(page);

  const projectCard = page.locator(".project-card", {
    hasText: projectName,
  }).first();

  if ((await projectCard.count()) === 0) {
    return;
  }

  if (!(await projectCard.isVisible().catch(() => false))) {
    return;
  }

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });

  await projectCard.getByRole("button", { name: /apagar/i }).click();

  await expectExactProjectCardNameCount(page, projectName, 0);
}

test("edited project details persist after reopening edit form", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedBrowserErrors(page);

  await login(page);

  const project = await createProjectThroughUi(page);

  const suffix = uniqueSuffix();

  const editedProjectName = `Persist Edited Obra ${suffix}`;
  const editedClientName = `Cliente Persist ${suffix}`;
  const editedLocation = `Porto Persist ${suffix}`;
  const editedContractNum = `PERSIST-${suffix}`;

  await openEditFromProjectList(page, project.projectName);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#projectName")).toBeVisible({
    timeout: 10000,
  });

  await page.fill("#projectName", editedProjectName);
  await page.fill("#clientName", editedClientName);
  await page.fill("#location", editedLocation);
  await page.fill("#contractNum", editedContractNum);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expectProjectListVisible(page);

  await expectExactProjectCardNameCount(page, editedProjectName, 1);
  await expectExactProjectCardNameCount(page, project.projectName, 0);

  await openEditFromProjectList(page, editedProjectName);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#projectName")).toHaveValue(editedProjectName);
  await expect(page.locator("#clientName")).toHaveValue(editedClientName);
  await expect(page.locator("#location")).toHaveValue(editedLocation);
  await expect(page.locator("#contractNum")).toHaveValue(editedContractNum);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expectProjectListVisible(page);

  await deleteProjectFromList(page, editedProjectName);

  expect(unexpectedErrors).toEqual([]);
});

test("editing project does not create duplicate project cards", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedBrowserErrors(page);

  await login(page);

  const project = await createProjectThroughUi(page);

  const editedName = `Edited No Duplicate ${uniqueSuffix()}`;

  await openEditFromProjectList(page, project.projectName);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#projectName")).toBeVisible({
    timeout: 10000,
  });

  await page.fill("#projectName", editedName);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expectProjectListVisible(page);

  await expectExactProjectCardNameCount(page, editedName, 1);
  await expectExactProjectCardNameCount(page, project.projectName, 0);

  await openEditFromProjectList(page, editedName);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#projectName")).toHaveValue(editedName);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expectProjectListVisible(page);

  await deleteProjectFromList(page, editedName);

  expect(unexpectedErrors).toEqual([]);
});