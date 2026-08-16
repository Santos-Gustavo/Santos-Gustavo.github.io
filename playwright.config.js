require("dotenv").config();

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:5500",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npx http-server . -p 5500",
    url: "http://127.0.0.1:5500",
    reuseExistingServer: true,
    timeout: 10_000
  }
});