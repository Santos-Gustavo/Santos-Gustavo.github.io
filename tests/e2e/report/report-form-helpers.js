const { expect } = require("@playwright/test");

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

  return date.toISOString().slice(0, 10);
}

async function fillRequired(page, selector, value) {
  const locator = page.locator(selector).first();

  await expect(locator, `Required field missing or hidden: ${selector}`).toBeVisible();
  await locator.fill(String(value));
}

async function fillOptional(page, selector, value) {
  const locator = page.locator(selector).first();

  if ((await locator.count()) === 0) return false;
  if (!(await locator.isVisible())) return false;

  await locator.fill(String(value));
  return true;
}

async function clickRequiredButton(page, name) {
  const button = page.getByRole("button", { name }).first();

  await expect(button, `Required button missing: ${name}`).toBeVisible();
  await button.click();
}

async function clickOptionalButton(page, name) {
  const button = page.getByRole("button", { name }).first();

  if ((await button.count()) === 0) return false;
  if (!(await button.isVisible())) return false;

  await button.click();
  return true;
}

export async function selectWeeklyReport(page) {
  const weeklyOption = page.locator(
    '[data-nav-action="select-mode"][data-mode="weekly"]'
  );

  await expect(weeklyOption).toBeVisible({ timeout: 10000 });
  await weeklyOption.click();

  await expect(page.locator("#stepLabel")).toContainText(/Passo 1 de 9/i, {
    timeout: 10000,
  });

  await expect(page.locator("#stepLabel")).toContainText(/período|periodo/i);

  await page.getByRole("button", { name: /seguinte/i }).click();

  await expect(page.locator("#stepLabel")).toContainText(/progresso/i, {
    timeout: 10000,
  });
}


async function fillReportMainFields(page, suffix) {
  await fillOptional(page, "#p-reportDate", todayInputValue());

  // Period fields are disabled logically. Clear them only if they still exist in the UI.
  await fillOptional(page, "#p-periodStart", "");
  await fillOptional(page, "#p-periodEnd", "");

  await fillOptional(page, "#p-distributedTo", `Cliente Teste ${suffix}`);


//   await fillRequired(page, "#progressPct", "55");
}

async function addWorkItemIfAvailable(page, suffix) {
  const addWorkClicked = await clickOptionalButton(
    page,
    /adicionar trabalho|adicionar obra|adicionar atividade|adicionar item/i
  );

  if (!addWorkClicked) return false;

  await fillOptional(page, "#workTitle", `Trabalho teste ${suffix}`);
  await fillOptional(page, "#workDescription", `Descrição trabalho teste ${suffix}`);
  await fillOptional(page, "#workArea", "Sala");
  await fillOptional(page, "#workWorker", "João Teste");

  await clickOptionalButton(
    page,
    /guardar trabalho|adicionar trabalho|confirmar trabalho|guardar item/i
  );

  return true;
}

async function addExtraIfAvailable(page, suffix) {
  const addExtraClicked = await clickOptionalButton(page, /adicionar extra|novo extra/i);

  if (!addExtraClicked) return false;

  await fillOptional(page, "#extraTitle", `Extra teste ${suffix}`);
  await fillOptional(page, "#extraDescription", `Descrição extra teste ${suffix}`);
  await fillOptional(page, "#extraValue", "120");

  await clickOptionalButton(page, /guardar extra|adicionar extra|confirmar extra/i);

  return true;
}

async function addNextStepIfAvailable(page, suffix) {
  const addNextStepClicked = await clickOptionalButton(
    page,
    /adicionar próximo passo|adicionar tarefa|novo passo/i
  );

  if (!addNextStepClicked) return false;

  await fillOptional(page, "#nextStepTitle", `Próximo passo teste ${suffix}`);
  await fillOptional(page, "#nextStepDescription", `Descrição próximo passo ${suffix}`);
  await fillOptional(page, "#nextStepDeadline", todayInputValue());

  await clickOptionalButton(
    page,
    /guardar próximo passo|adicionar próximo passo|confirmar passo|guardar tarefa/i
  );

  return true;
}

module.exports = {
  uniqueSuffix,
  todayInputValue,
  fillRequired,
  fillOptional,
  clickRequiredButton,
  clickOptionalButton,
  selectWeeklyReport,
  fillReportMainFields,
  addWorkItemIfAvailable,
  addExtraIfAvailable,
  addNextStepIfAvailable,
};