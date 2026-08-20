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

// tests/e2e/report/report-engine.js

async function fillCurrentStepIfNeeded(page) {
  const label = (await page.locator("#stepLabel").textContent()) || "";

  if (/próximos passos|proximos passos/i.test(label)) {
    const addButton = page
      .locator("button:has-text('Adicionar próximo passo'), button:has-text('Adicionar proximo passo')")
      .filter({ visible: true })
      .first();

    if ((await addButton.count()) > 0) {
      await addButton.click().catch(() => {});
      // Wait for dynamic inputs to be inserted into DOM
      await page.waitForTimeout(200); 
    }

    const fields = page.locator("input:visible, textarea:visible");
    const count = await fields.count();

    for (let i = 0; i < count; i += 1) {
      const field = fields.nth(i);

      const type = (await field.getAttribute("type").catch(() => ""))?.toLowerCase();
      if (["hidden", "file", "checkbox", "radio"].includes(type || "")) {
        continue;
      }

      const currentValue = await field.inputValue().catch(() => "");

      if (!currentValue.trim()) {
        if (type === "date") {
          await field.fill("2026-08-20");
        } else if (type === "number") {
          await field.fill("1");
        } else {
          await field.fill(`E2E próximo passo ${i + 1}`);
        }

        // Trigger native change/input events for ESM state synchronization
        await field.dispatchEvent("input").catch(() => {});
        await field.dispatchEvent("change").catch(() => {});
      }
    }
  }
}

async function advanceOneReportStep(page) {
  const before = await getReportStepNumber(page);

  if (before.current === null) {
    throw new Error(
      `Cannot advance report step because current step label is not parseable: "${before.label}"`
    );
  }

  await fillCurrentStepIfNeeded(page);

  const clicked = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const candidates = Array.from(
      document.querySelectorAll(
        [
          "[data-nav-action='next']",
          "button.btn-next",
          "button",
        ].join(", ")
      )
    );

    const target = candidates.find((el) => {
      const text = el.textContent || "";

      return (
        visible(el) &&
        (
          el.dataset?.navAction === "next" ||
          el.classList.contains("btn-next") ||
          /seguinte|próximo|proximo|avançar|avancar/i.test(text)
        )
      );
    });

    if (!target) {
      return false;
    }

    target.click();
    return true;
  });

  if (!clicked) {
    const visibleButtons = await getVisibleButtons(page);

    throw new Error(
      `Could not find visible report next button at "${before.label}". Visible buttons: ` +
        JSON.stringify(visibleButtons)
    );
  }

  await page.waitForTimeout(500);

  const after = await getReportStepNumber(page);

  if (after.current !== before.current || after.label !== before.label) {
    return after;
  }

  const visibleButtons = await getVisibleButtons(page);

  throw new Error(
    `Clicked report next button but step did not advance from "${before.label}". Visible buttons: ` +
      JSON.stringify(visibleButtons)
  );
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