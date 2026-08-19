// const { test, expect } = require("@playwright/test");
// const { failOnConsoleErrors } = require("../helpers");
// const { login } = require("../helpers/app-helpers");

// test.beforeEach(async ({ page }) => {
//   failOnConsoleErrors(page);
// });

// test("project lifecycle: create, edit, and delete/archive project", async ({ page }) => {
//   await login(page);

//   const unique = Date.now();
//   const projectName = `Lifecycle Obra ${unique}`;
//   const editedName = `${projectName} Editada`;

//   // CREATE
//   await page.getByRole("button", { name: /\+ nova obra/i }).click();

//   await page.fill("#companyName", `Lifecycle Empresa ${unique}`);
//   await page.fill("#companyNif", `${unique}`.slice(0, 9));
//   await page.fill("#responsible", "Responsável Teste");
//   await page.fill("#companyPhone", "912345678");
//   await page.fill("#companyEmail", "teste@example.com");

//   await page.getByRole("button", { name: /seguinte/i }).click();

//   await page.fill("#projectName", projectName);
//   await page.fill("#clientName", `Lifecycle Cliente ${unique}`);
//   await page.fill("#location", "Porto");
//   await page.fill("#contractNum", `LC-${unique}`);

//   await page.getByRole("button", { name: /seguinte/i }).click();

//   await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i);

//   await page.getByRole("button", { name: /← obras/i }).click();

//   await expect(
//     page.locator("#projectList .project-card-name", { hasText: projectName })
//   ).toBeVisible();

//   // EDIT
//   const createdCard = page.locator(".project-card", { hasText: projectName });
//   await expect(createdCard).toBeVisible();
  
//   await createdCard.getByRole("button", { name: /editar/i }).click();
  
//   await expect(page.locator("#companyName")).toBeVisible();

//   await page.getByRole("button", { name: /seguinte/i }).click();

//   await expect(page.locator("#projectName")).toBeVisible();

//   await page.fill("#projectName", editedName);

//   await page.getByRole("button", { name: /seguinte/i }).click();

//   await expect(page.locator("#projectList")).toBeVisible();

//   await expect(
//     page.locator("#projectList .project-card-name", { hasText: editedName })
//   ).toBeVisible();

//   await expect(
//     page.locator("#projectList .project-card-name", { hasText: projectName })
//   ).toHaveCount(1);

//   // DELETE / ARCHIVE
//   const editedCard = page.locator(".project-card", { hasText: editedName });

//   await expect(editedCard).toBeVisible();

//   page.once("dialog", async dialog => {
//     expect(dialog.type()).toBe("confirm");
//     await dialog.accept();
//   });

//   await editedCard.getByRole("button", { name: /apagar/i }).click();

//   await expect(
//     page.locator("#projectList .project-card-name", { hasText: editedName })
//   ).toHaveCount(0);
// });