const { test } = require("@playwright/test");
const { login } = require("../helpers/app-helpers");

const {
  deleteOrArchiveE2EProjectThroughUi,
} = require("./e2e-project");

test("teardown: delete or archive shared E2E project", async ({ page }) => {
  await login(page);

  await deleteOrArchiveE2EProjectThroughUi(page);
});