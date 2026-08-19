const { test } = require("@playwright/test");
const {
  deleteProjectsByTestPrefixes,
  countProjectsByTestPrefixes,
} = require("../helpers/db-cleanup");

test("teardown: delete all E2E test projects from database", async () => {
  await deleteProjectsByTestPrefixes();

  const remaining = await countProjectsByTestPrefixes();

  if (remaining.length > 0) {
    throw new Error(
      `E2E cleanup failed. Remaining projects: ${JSON.stringify(
        remaining,
        null,
        2
      )}`
    );
  }
});