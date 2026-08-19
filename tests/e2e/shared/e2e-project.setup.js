const { test } = require("@playwright/test");
const { login } = require("../helpers/app-helpers");

const {
  createE2EProjectThroughUi,
} = require("./e2e-project");

test("setup: create shared E2E project", async ({ page }) => {
  await login(page);

  await createE2EProjectThroughUi(page);
});