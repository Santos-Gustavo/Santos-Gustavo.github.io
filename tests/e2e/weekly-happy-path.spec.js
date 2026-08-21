import { expect, test } from "@playwright/test";

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

  async function login(page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "Missing E2E login credentials. Set E2E_EMAIL and E2E_PASSWORD in .env."
    );
  }

  await page.goto("/");

  const emailInput = page.locator("#authEmail");
  const passwordInput = page.locator("#authPassword");

  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await expect(passwordInput).toBeVisible({ timeout: 10000 });

  await emailInput.fill(E2E_EMAIL);
  await passwordInput.fill(E2E_PASSWORD);

  await page
    .getByRole("button", { name: /entrar|login|iniciar/i })
    .click();

  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const isVisible = (element) => {
            if (!element) return false;

            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();

            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0
            );
          };

          const buttons = Array.from(document.querySelectorAll("button"));

          return buttons.some((button) => {
            return isVisible(button) && /sair/i.test(button.textContent || "");
          });
        }),
      {
        timeout: 15000,
        message: "Expected authenticated UI to show Sair after login",
      }
    )
    .toBe(true);

  await page.waitForTimeout(500);
}

async function dumpVisibleState(page, label) {
  const state = await page.evaluate(() => {
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const controls = Array.from(
      document.querySelectorAll(
        "input, textarea, select, button, [data-nav-action], [data-mode], [data-report-action]"
      )
    )
      .filter(visible)
      .map((el) => ({
        tag: el.tagName,
        id: el.id || "",
        type: el.getAttribute("type") || "",
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160),
        value: "value" in el ? el.value : "",
        className: el.className || "",
        dataNavAction: el.getAttribute("data-nav-action") || "",
        dataMode: el.getAttribute("data-mode") || "",
        dataReportAction: el.getAttribute("data-report-action") || "",
      }));

    return {
      stepLabel: document.querySelector("#stepLabel")?.textContent?.trim() || "",
      bodyText: document.body.innerText.trim().slice(0, 2000),
      controls,
    };
  });

  console.log(`\n===== ${label} =====`);
  console.log(JSON.stringify(state, null, 2));
  console.log(`===== END ${label} =====\n`);

  return state;
}


test("user can create and generate a weekly report", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: /novo projeto/i }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /configuração 1 de 2|configuracao 1 de 2|empresa/i,
    {
      timeout: 10000,
    }
  );

  await page.locator("#companyName").fill("E2E Test Company");
  await page
    .locator("#companyTagline")
    .fill("Construção · Renovação · Remodelação");
  await page.locator("#companyNif").fill("509123456");
  await page.locator("#companyInci").fill("12345");
  await page.locator("#responsible").fill("E2E Responsible");
  await page.locator("#companyPhone").fill("+351 912 345 678");
  await page.locator("#companyEmail").fill("e2e.company@example.com");

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /configuração 2 de 2|configuracao 2 de 2|projeto/i,
    {
      timeout: 10000,
    }
  );

  await page.locator("#projectName").fill("E2E Test Project");
  await page.locator("#clientName").fill("E2E Test Client");
  await page.locator("#location").fill("Rua E2E 123, Porto");
  await page.locator("#contractNum").fill("E2E-2026-001");
  await page.locator("#distributedTo").fill("Cliente · Arquivo");
  await page.locator("#sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/tipo de relatório/i, {
    timeout: 10000,
  });

  await page
    .locator('[data-nav-action="select-mode"][data-mode="weekly"]')
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 1 de 9|período|periodo/i,
    {
      timeout: 10000,
    }
  );

  await page.locator("#p-reportNum").fill("1");
  await page.locator("#p-reportDate").fill("2026-08-20");
  await page.locator("#p-periodStart").fill("2026-08-13");
  await page.locator("#p-periodEnd").fill("2026-08-20");
  await page.locator("#p-distributedTo").fill("Cliente · Arquivo");
  await page.locator("#p-sentVia").selectOption({ label: "WhatsApp" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 2 de 9|progresso/i,
    {
      timeout: 10000,
    }
  );

  await page.locator("#progressSlider").fill("35");

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 3 de 9|resumo/i,
    {
      timeout: 10000,
    }
  );

  await page
    .locator("#weekSummary")
    .fill(
      "Durante esta semana foram concluídos trabalhos de preparação, organização da frente de projeto e avanço nas tarefas principais previstas."
    );

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 4 de 9|trabalhos/i,
    {
      timeout: 10000,
    }
  );

  await page.getByRole("button", { name: /adicionar trabalho/i }).click();

  const workSelects = page.locator("select:visible");
  const workDescription = page.locator("textarea:visible").first();

  await workSelects.nth(0).selectOption({ label: "Pintura Interior" });
  await workSelects.nth(1).selectOption({ label: "Sala" });
  await workDescription.fill(
    "Preparação das superfícies, aplicação de primário e primeira demão de pintura interior."
  );
  await workSelects.nth(2).selectOption({ label: "Em curso" });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/passo 5 de 9|fotos/i, {
    timeout: 10000,
  });

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 6 de 9|decisão|decisao/i,
    {
      timeout: 10000,
    }
  );

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 7 de 9|incidentes/i,
    {
      timeout: 10000,
    }
  );

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 8 de 9|próximos passos|proximos passos/i,
    {
      timeout: 10000,
    }
  );

  await page
    .getByRole("button", {
      name: /adicionar próximo passo|adicionar proximo passo/i,
    })
    .click();

  const nextStepInputs = page.locator("input:visible");
  const nextStepTextareas = page.locator("textarea:visible");

  if (await nextStepTextareas.count()) {
    await nextStepTextareas
      .first()
      .fill("Concluir a segunda demão de pintura e iniciar os acabamentos finais.");
  } else if (await nextStepInputs.count()) {
    await nextStepInputs
      .first()
      .fill("Concluir a segunda demão de pintura e iniciar os acabamentos finais.");
  }

  await page.locator('[data-nav-action="next"]').filter({ visible: true }).click();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 9 de 9|revisão|revisao/i,
    {
      timeout: 10000,
    }
  );

  const generateButton = page.locator(
    '[data-report-action="save-and-generate"]'
  );

  await expect(generateButton).toBeVisible({
    timeout: 10000,
  });

  const dialogPromise = page.waitForEvent("dialog");

  await generateButton.click();

  const dialog = await dialogPromise;

  expect(dialog.message()).toMatch(/relatório guardado com sucesso/i);

  await dialog.accept();

  await expect(page.locator("#stepLabel")).toHaveText(
    /passo 9 de 9|revisão|revisao/i,
    {
      timeout: 10000,
    }
  );

  await expect(generateButton).toBeVisible();
  await expect(
    page.locator('[data-nav-action="home"]').filter({ visible: true })
  ).toBeVisible();
});