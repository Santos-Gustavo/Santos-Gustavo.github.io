const fs = require("fs");
const path = require("path");
const { expect } = require("@playwright/test");

const STATE_DIR = path.resolve(__dirname, "../.state");
const STATE_FILE = path.join(STATE_DIR, "e2e-project.json");

function uniqueSuffix() {
  return Date.now().toString();
}

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

function buildE2EProjectState() {
  const unique = uniqueSuffix();

  return {
    unique,

    companyName: `E2E Empresa ${unique}`,
    companyNif: unique.slice(0, 9),
    responsible: "Responsável E2E",
    companyPhone: "912345678",
    companyEmail: "e2e@example.com",

    projectName: `E2E Obra ${unique}`,
    clientName: `E2E Cliente ${unique}`,
    location: "Porto",
    contractNum: `E2E-${unique}`,
    contractValue: "1000",

    createdAt: new Date().toISOString(),
  };
}

function writeE2EProjectState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  return state;
}

function readE2EProjectState() {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      `Missing E2E project state file: ${STATE_FILE}. Run the shared setup first.`
    );
  }

  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

async function createE2EProjectThroughUi(page) {
  const state = writeE2EProjectState(buildE2EProjectState());

  await expect(page.locator("#projectList")).toBeVisible({
    timeout: 10000,
  });

  await page.getByRole("button", { name: /\+ nova obra/i }).click();

  await page.fill("#companyName", state.companyName);
  await page.fill("#companyNif", state.companyNif);
  await page.fill("#responsible", state.responsible);
  await page.fill("#companyPhone", state.companyPhone);
  await page.fill("#companyEmail", state.companyEmail);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#projectName")).toBeVisible({
    timeout: 10000,
  });

  await page.fill("#projectName", state.projectName);
  await page.fill("#clientName", state.clientName);
  await page.fill("#location", state.location);
  await page.fill("#contractNum", state.contractNum);

  const contractValue = page.locator("#contractValue");

  if ((await contractValue.count()) > 0 && (await contractValue.first().isVisible())) {
    await contractValue.first().fill(state.contractValue);
  }

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 10000,
  });

  await page.getByRole("button", { name: /← obras/i }).click();

  await expect(page.locator("#projectList")).toBeVisible({
    timeout: 10000,
  });

  await expect(
    page.locator("#projectList .project-card-name", {
      hasText: state.projectName,
    })
  ).toBeVisible({
    timeout: 10000,
  });

  return state;
}

async function openE2EProject(page) {
  const state = readE2EProjectState();

  await expect(page.locator("#projectList")).toBeVisible({
    timeout: 10000,
  });

  const projectCard = page.locator(".project-card", {
    hasText: state.projectName,
  });

  await expect(projectCard).toBeVisible({
    timeout: 10000,
  });

  await projectCard.click();

  return state;
}

async function deleteOrArchiveE2EProjectThroughUi(page) {
  const state = readE2EProjectState();

  await expect(page.locator("#projectList")).toBeVisible({
    timeout: 10000,
  });

  const projectCard = page.locator(".project-card", {
    hasText: state.projectName,
  });

  if ((await projectCard.count()) === 0) {
    return;
  }

  if (!(await projectCard.first().isVisible())) {
    return;
  }

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });

  await projectCard.getByRole("button", { name: /apagar/i }).click();

  await expect(
    page.locator("#projectList .project-card-name", {
      hasText: state.projectName,
    })
  ).toHaveCount(0, {
    timeout: 10000,
  });
}

module.exports = {
  STATE_FILE,
  buildE2EProjectState,
  writeE2EProjectState,
  readE2EProjectState,
  createE2EProjectThroughUi,
  openE2EProject,
  deleteOrArchiveE2EProjectThroughUi,
};