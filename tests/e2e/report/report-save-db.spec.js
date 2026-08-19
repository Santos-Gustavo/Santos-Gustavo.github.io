const { test, expect } = require("@playwright/test");
const { login } = require("../app-helpers");

const {
  uniqueSuffix,
  selectWeeklyReport,
  fillReportMainFields,
  addWorkItemIfAvailable,
  addExtraIfAvailable,
  addNextStepIfAvailable,
} = require("./report-form-helpers");

const {
  saveAndGenerateReportThroughUi,
} = require("./report-engine");

test("weekly report flow shows success message after generating report", async ({ page }) => {
  const suffix = uniqueSuffix();

  const browserErrors = [];
  const dialogs = [];

  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      browserErrors.push(msg.text());
    }
  });

  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());

    if (dialog.type() === "prompt") {
      await dialog.accept("");
      return;
    }

    await dialog.accept();
  });

  await login(page);

  await expect(page.locator("#projectList")).toBeVisible({
    timeout: 10000,
  });

  const firstProjectCard = page.locator(".project-card").first();

  await expect(firstProjectCard).toBeVisible({
    timeout: 10000,
  });

  await firstProjectCard.click();

  await selectWeeklyReport(page);

  await fillReportMainFields(page, suffix);

  await addWorkItemIfAvailable(page, suffix);
  await addExtraIfAvailable(page, suffix);
  await addNextStepIfAvailable(page, suffix);

  await saveAndGenerateReportThroughUi(page);

  await expect
    .poll(
      () => dialogs,
      {
        timeout: 15000,
      }
    )
    .toContainEqual(expect.stringMatching(/relatório guardado com sucesso/i));

  expect(browserErrors).toEqual([]);
});