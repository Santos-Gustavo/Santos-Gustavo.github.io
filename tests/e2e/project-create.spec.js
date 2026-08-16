// const { test, expect } = require("@playwright/test");
// const { failOnConsoleErrors } = require("./helpers");
// const { login } = require("./app-helpers");

// test.beforeEach(async ({ page }) => {
//   failOnConsoleErrors(page);
// });

// test("user can create a new project and see it in the project list", async ({ page }) => {
//   await login(page);

//   const unique = Date.now();
//   const projectName = `Obra Teste ${unique}`;

//   await page.getByRole("button", { name: /\+ nova obra/i }).click();

//   await expect(page.locator("#companyName")).toBeVisible();

//   await page.fill("#companyName", `Empresa Teste ${unique}`);
//   await page.fill("#companyNif", `${unique}`.slice(0, 9));
//   await page.fill("#responsible", "Responsável Teste");
//   await page.fill("#companyPhone", "912345678");
//   await page.fill("#companyEmail", "teste@example.com");

//   await page.getByRole("button", { name: /seguinte/i }).click();

//   await expect(page.locator("#projectName")).toBeVisible();

//   await page.fill("#projectName", projectName);
//   await page.fill("#clientName", `Cliente Teste ${unique}`);
//   await page.fill("#location", "Porto");
//   await page.fill("#contractNum", `CT-${unique}`);

//   await page.getByRole("button", { name: /seguinte/i }).click();

//   await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i);

//   await page.getByRole("button", { name: /← obras/i }).click();

//   await expect(page.locator("#projectList")).toBeVisible();
//   await expect(page.locator("#stepLabel")).toHaveText(/obras/i);
//   await expect(
//   page.locator("#projectList .project-card-name", { hasText: projectName })
// ).toBeVisible();
// });