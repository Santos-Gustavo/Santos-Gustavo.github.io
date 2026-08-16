// const { test, expect } = require("@playwright/test");
// const { failOnConsoleErrors } = require("./helpers");
// const { login, waitForAtLeastOneProject } = require("./app-helpers");


// test.beforeEach(async ({ page }) => {
//   failOnConsoleErrors(page);
// });

// test("editing project updates existing project instead of creating duplicate", async ({ page }) => {
//   await login(page);

//   await waitForAtLeastOneProject(page);
  
//   const beforeCount = await page.locator(".project-card").count();

//   const firstCard = page.locator(".project-card").first();
//   await expect(firstCard).toBeVisible();

//   await firstCard.getByRole("button", { name: /editar obra/i }).click();

//   // Edit opens at company step first.
//   await expect(page.locator("#companyName")).toBeVisible();

//   // Go to project/obra data step.
//   await page.getByRole("button", { name: /seguinte/i }).click();

//   await expect(page.locator("#projectName")).toBeVisible();

//   const newName = `Obra Editada ${Date.now()}`;

//   await page.fill("#projectName", newName);

//   await page.getByRole("button", { name: /seguinte/i }).click();

//   await expect(page.locator("#projectList")).toBeVisible();
//   await expect(page.locator("#stepLabel")).toHaveText(/obras/i);

//   const afterCount = await page.locator(".project-card").count();

//   expect(afterCount).toBe(beforeCount);
//   await expect(page.getByText(newName)).toBeVisible();
// });