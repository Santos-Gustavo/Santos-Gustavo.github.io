const { expect } = require("@playwright/test");

async function getVisibleButtons(page) {
  return page.getByRole("button").evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const style = window.getComputedStyle(button);
        const rect = button.getBoundingClientRect();

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          !button.disabled
        );
      })
      .map((button) => ({
        text: (button.innerText || button.textContent || "").trim(),
        id: button.id || "",
        onclick: button.getAttribute("onclick") || "",
        className: String(button.className || ""),
      }))
  );
}

async function getStepLabel(page) {
  return page.locator("#stepLabel").innerText().catch(() => "");
}

async function getReportStepNumber(page) {
  const label = await getStepLabel(page);

  const match = label.match(/Passo\s+(\d+)\s+de\s+(\d+)/i);

  if (!match) {
    return {
      current: null,
      total: null,
      label,
    };
  }

  return {
    current: Number(match[1]),
    total: Number(match[2]),
    label,
  };
}

async function waitForReportEngineReady(page) {
  await expect(page.locator("#stepLabel")).toBeVisible({
    timeout: 10000,
  });

  await expect
    .poll(
      async () => {
        const step = await getReportStepNumber(page);

        return step.current !== null && step.total !== null;
      },
      {
        timeout: 10000,
        intervals: [50, 100, 250],
      }
    )
    .toBe(true);
}

async function waitForReportStepToAdvance(page, previousStepNumber) {
  expect(previousStepNumber, "Could not parse previous report step").not.toBeNull();

  await expect
    .poll(
      async () => {
        const step = await getReportStepNumber(page);

        return step.current;
      },
      {
        timeout: 10000,
        intervals: [50, 100, 150, 250, 500],
      }
    )
    .toBe(previousStepNumber + 1);
}

async function clickVisibleButtonByExactOnclickAndText(page, onclickValue, textPattern) {
  const buttons = page.locator(`button[onclick="${onclickValue}"]`);
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);

    if (!(await button.isVisible())) continue;

    const isEnabled = await button.isEnabled().catch(() => false);
    if (!isEnabled) continue;

    const text = await button.innerText().catch(() => "");

    if (!textPattern.test(text)) continue;

    await button.click();
    return true;
  }

  return false;
}

async function clickVisibleButtonByText(page, textPattern) {
  const buttons = page.getByRole("button");
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);

    if (!(await button.isVisible())) continue;

    const isEnabled = await button.isEnabled().catch(() => false);
    if (!isEnabled) continue;

    const text = await button.innerText().catch(() => "");

    if (!textPattern.test(text)) continue;

    await button.click();
    return true;
  }

  return false;
}

async function advanceOneReportStep(page) {
  const before = await getReportStepNumber(page);

  if (before.current === null) {
    throw new Error(
      `Cannot advance report step because current step label is not parseable: "${before.label}"`
    );
  }

  const clicked = await clickVisibleButtonByExactOnclickAndText(
    page,
    "goNext()",
    /seguinte/i
  );

  if (!clicked) {
    const visibleButtons = await getVisibleButtons(page);

    throw new Error(
      `Could not find visible report next button at "${before.label}". Visible buttons: ` +
        JSON.stringify(visibleButtons)
    );
  }

  await waitForReportStepToAdvance(page, before.current);

  const after = await getReportStepNumber(page);

  if (after.current !== before.current + 1) {
    throw new Error(
      `Report step advanced unexpectedly. Before: "${before.label}". After: "${after.label}".`
    );
  }

  return after;
}

async function goToFinalReportStep(page) {
  await waitForReportEngineReady(page);

  for (let i = 0; i < 20; i++) {
    const step = await getReportStepNumber(page);

    if (step.current === null || step.total === null) {
      throw new Error(`Invalid report step state: "${step.label}"`);
    }

    if (step.current === step.total) {
      return step;
    }

    await advanceOneReportStep(page);
  }

  const finalStep = await getReportStepNumber(page);
  const visibleButtons = await getVisibleButtons(page);

  throw new Error(
    `Could not reach final report step. Current step: "${finalStep.label}". Visible buttons: ` +
      JSON.stringify(visibleButtons)
  );
}

async function clickGenerateReport(page) {
  const finalButtonPattern =
    /guardar e gerar|guardar relatório|gerar relatório|gerar pdf|finalizar relatório|concluir relatório/i;

  const clicked = await clickVisibleButtonByText(page, finalButtonPattern);

  if (!clicked) {
    const step = await getReportStepNumber(page);
    const visibleButtons = await getVisibleButtons(page);

    throw new Error(
      `Could not find generate/save button at "${step.label}". Visible buttons: ` +
        JSON.stringify(visibleButtons)
    );
  }
}

async function saveAndGenerateReportThroughUi(page) {
  await goToFinalReportStep(page);
  await clickGenerateReport(page);
}

module.exports = {
  getVisibleButtons,
  getStepLabel,
  getReportStepNumber,
  waitForReportEngineReady,
  waitForReportStepToAdvance,
  advanceOneReportStep,
  goToFinalReportStep,
  clickGenerateReport,
  saveAndGenerateReportThroughUi,
};