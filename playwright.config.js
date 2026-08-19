require("dotenv").config();

const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",

  fullyParallel: false,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  webServer: {
    command: "npx serve . -l 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },

  projects: [
    {
      name: "setup",
      testMatch: /shared\/e2e-project\.setup\.js/,
    },

    {
      name: "chromium",
      dependencies: ["setup"],
      teardown: "teardown",
      use: {
        ...devices["Desktop Chrome"],
      },
      testIgnore: [
        /shared\/e2e-project\.setup\.js/,
        /shared\/e2e-project\.teardown\.js/,
      ],
    },

    {
      name: "teardown",
      testMatch: /shared\/e2e-project\.teardown\.js/,
    },
  ],
});