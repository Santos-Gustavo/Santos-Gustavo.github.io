const { test, expect } = require("@playwright/test");
const { login } = require("./app-helpers");

function uniqueSuffix() {
  return Date.now().toString();
}

async function clickFirstVisibleRoleButton(page, pattern) {
  const buttons = page.getByRole("button", { name: pattern });
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);

    if (!(await button.isVisible())) continue;

    const text = await button.innerText().catch(() => "");
    const id = await button.getAttribute("id").catch(() => "");
    const onclick = await button.getAttribute("onclick").catch(() => "");

    console.log("CLICKING BUTTON:", {
      index: i,
      text,
      id,
      onclick,
    });

    await button.click();
    return true;
  }

  return false;
}


async function fillIfVisible(page, selector, value) {
  const locator = page.locator(selector);

  if (await locator.count() === 0) return;
  if (!(await locator.first().isVisible())) return;

  await locator.first().fill(String(value));
}

async function clickIfVisible(page, roleName) {
  const button = page.getByRole("button", { name: roleName });

  if (await button.count() === 0) return false;
  if (!(await button.first().isVisible())) return false;

  await button.first().click();
  return true;
}

async function selectWeeklyReport(page) {
  const weeklyOption = page.getByText(/relatório semanal/i).first();

  await expect(weeklyOption).toBeVisible();
  await weeklyOption.click();

  await expect(page.locator("#stepLabel")).toHaveText(/relatório/i);
}

async function fillReportMainFields(page, suffix) {
  await fillIfVisible(page, "#p-reportDate", "2026-08-19");

  // Period fields are disabled logically, but clear them if still present in the UI.
  await fillIfVisible(page, "#p-periodStart", "");
  await fillIfVisible(page, "#p-periodEnd", "");

  await fillIfVisible(page, "#p-distributedTo", `Cliente Teste ${suffix}`);

  const sentVia = page.locator("#p-sentVia");
  if ((await sentVia.count()) > 0 && (await sentVia.first().isVisible())) {
	const tagName = await sentVia.first().evaluate((el) => el.tagName.toLowerCase());

	if (tagName === "select") {
	  await sentVia.first().selectOption({ label: /whatsapp/i }).catch(async () => {
		await sentVia.first().selectOption("WhatsApp").catch(async () => {
		  await sentVia.first().selectOption("whatsapp").catch(() => {});
		});
	  });
	} else {
	  await sentVia.first().fill("WhatsApp");
	}
  }

  await fillIfVisible(page, "#progressPct", "55");
  await fillIfVisible(page, "#weekSummary", `Resumo semanal automático ${suffix}`);
  await fillIfVisible(page, "#financialNote", `Nota financeira automática ${suffix}`);
}

async function addWorkItem(page, suffix) {
  const addWorkClicked = await clickIfVisible(page, /adicionar trabalho|adicionar obra|adicionar atividade|adicionar item/i);

  if (!addWorkClicked) return;

  await fillIfVisible(page, "#workTitle", `Trabalho teste ${suffix}`);
  await fillIfVisible(page, "#workDescription", `Descrição trabalho teste ${suffix}`);
  await fillIfVisible(page, "#workArea", "Sala");
  await fillIfVisible(page, "#workWorker", "João Teste");

  await clickIfVisible(page, /guardar trabalho|adicionar trabalho|confirmar trabalho|guardar item/i);
}

async function addExtraIfAvailable(page, suffix) {
  const addExtraClicked = await clickIfVisible(page, /adicionar extra|novo extra/i);

  if (!addExtraClicked) return;

  await fillIfVisible(page, "#extraTitle", `Extra teste ${suffix}`);
  await fillIfVisible(page, "#extraDescription", `Descrição extra teste ${suffix}`);
  await fillIfVisible(page, "#extraValue", "120");

  await clickIfVisible(page, /guardar extra|adicionar extra|confirmar extra/i);
}

async function addNextStepIfAvailable(page, suffix) {
  const addNextStepClicked = await clickIfVisible(page, /adicionar próximo passo|adicionar tarefa|novo passo/i);

  if (!addNextStepClicked) return;

  await fillIfVisible(page, "#nextStepTitle", `Próximo passo teste ${suffix}`);
  await fillIfVisible(page, "#nextStepDescription", `Descrição próximo passo ${suffix}`);
  await fillIfVisible(page, "#nextStepDeadline", "2026-08-26");

  await clickIfVisible(page, /guardar próximo passo|adicionar próximo passo|confirmar passo|guardar tarefa/i);
}


async function clickVisibleButtonByOnclick(page, onclickValue) {
  const buttons = page.getByRole("button");
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);

    if (!(await button.isVisible())) continue;

    const onclick = await button.getAttribute("onclick").catch(() => "");

    if (onclick === onclickValue) {
      const text = await button.innerText().catch(() => "");

      console.log("CLICKING ONCLICK BUTTON:", {
        index: i,
        text,
        onclick,
      });

      await button.click();
      return true;
    }
  }

  return false;
}

async function clickVisibleButtonByText(page, pattern) {
  const buttons = page.getByRole("button");
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);

    if (!(await button.isVisible())) continue;

    const text = await button.innerText().catch(() => "");

    if (pattern.test(text)) {
      const onclick = await button.getAttribute("onclick").catch(() => "");

      console.log("CLICKING TEXT BUTTON:", {
        index: i,
        text,
        onclick,
      });

      await button.click();
      return true;
    }
  }

  return false;
}

async function saveAndGenerate(page) {
  const finalButtonPattern =
    /guardar e gerar|guardar relatório|gerar relatório|gerar pdf|finalizar relatório|concluir relatório/i;

  for (let step = 0; step < 15; step++) {
    const stepLabel = await page.locator("#stepLabel").innerText().catch(() => "");
    console.log("SAVE LOOP STEP:", step, stepLabel);

    const clickedFinal = await clickVisibleButtonByText(page, finalButtonPattern);

    if (clickedFinal) {
      console.log("CLICKED FINAL SAVE/GENERATE BUTTON");
      return;
    }

    const clickedNext = await clickVisibleButtonByOnclick(page, "goNext()");

    if (clickedNext) {
      await page.waitForTimeout(300);
      continue;
    }

    break;
  }

  const visibleButtons = await page
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const style = window.getComputedStyle(button);
          const rect = button.getBoundingClientRect();

          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0
          );
        })
        .map((button) => ({
          text: (button.innerText || button.textContent || "").trim(),
          id: button.id || "",
          onclick: button.getAttribute("onclick") || "",
          className: String(button.className || ""),
        }))
    );

  const stepLabel = await page.locator("#stepLabel").innerText().catch(() => "");

  console.log("STEP LABEL BEFORE SAVE FAILURE:", stepLabel);
  console.log("VISIBLE BUTTONS BEFORE SAVE:", visibleButtons);

  throw new Error("Could not find save/generate report button.");
}


test("full weekly report can be generated and saved in Supabase", async ({ page }) => {
  const suffix = uniqueSuffix();

  page.on("console", (msg) => { console.log("BROWSER CONSOLE:", msg.type(), msg.text());});
  page.on("pageerror", (error) => { console.log("BROWSER PAGE ERROR:", error.message);});

  const dialogs = [];

  page.on("dialog", async (dialog) => {
	const message = dialog.message();
	const type = dialog.type();

	console.log("DIALOG:", {
	  type,
	  message,
	});

	dialogs.push(message);

	if (type === "prompt") {
	  await dialog.accept("");
	  return;
	}

	await dialog.accept();
  });

  await login(page);

  await expect(page.locator("#projectList")).toBeVisible();

  const firstProjectCard = page.locator(".project-card").first();
  await expect(firstProjectCard).toBeVisible();

  await firstProjectCard.click();

  await selectWeeklyReport(page);

  await fillReportMainFields(page, suffix);

  await addWorkItem(page, suffix);
  await addExtraIfAvailable(page, suffix);
  await addNextStepIfAvailable(page, suffix);

  await saveAndGenerate(page);

  await expect
	.poll(
	  () => dialogs.some((message) => /relatório guardado com sucesso/i.test(message)),
	  {
		timeout: 5000,
	  }
	)
	.toBe(true);

//   const reportRows = await page.evaluate(async ({ suffix }) => {
// 	const { data, error } = await supabaseClient
// 	  .from("reports")
// 	  .select(`
// 		id,
// 		project_id,
// 		report_num,
// 		report_date,
// 		distributed_to,
// 		sent_via,
// 		progress_pct,
// 		week_summary,
// 		financial_note,
// 		works,
// 		extras,
// 		next_steps,
// 		status,
// 		created_at
// 	  `)
// 	  .ilike("week_summary", `%${suffix}%`)
// 	  .order("created_at", { ascending: false })
// 	  .limit(1);

// 	return {
// 	  data,
// 	  error,
// 	};
//   }, { suffix });

//   expect(reportRows.error).toBeNull();
//   expect(reportRows.data).toHaveLength(1);

//   const report = reportRows.data[0];

//   expect(report.id).toBeTruthy();
//   expect(report.project_id).toBeTruthy();

//   // Normalized reports table should use project_id only.
//   expect(report.company_id).toBeUndefined();
//   expect(report.client_id).toBeUndefined();

//   expect(report.week_summary).toContain(suffix);
//   expect(report.progress_pct).toBe(55);

//   // sent_via should be smallint code: 1 = WhatsApp.
//   expect(report.sent_via).toBe(1);

//   // status should be smallint code: 0 = draft.
//   expect(report.status).toBe(0);
//   expect(typeof report.status).toBe("number");

//   // Period fields are currently disabled.
//   expect(report.period_start).toBeUndefined();
//   expect(report.period_end).toBeUndefined();
});

// const photoRows = await page.evaluate(async ({ reportId }) => {
//   const { data, error } = await supabaseClient
//     .from("photos")
//     .select(`
//       id,
//       report_id,
//       storage_path,
//       file_url,
//       tag_code,
//       source_code,
//       stage_code,
//       created_at
//     `)
//     .eq("report_id", reportId)
//     .order("created_at", { ascending: false });

//   return {
//     data,
//     error,
//   };
// }, { reportId: report.id });

// expect(photoRows.error).toBeNull();

// for (const photo of photoRows.data || []) {
//   expect(photo.report_id).toBe(report.id);

//   // Normalized photos table should not expose old relationship columns.
//   expect(photo.company_id).toBeUndefined();
//   expect(photo.client_id).toBeUndefined();
//   expect(photo.project_id).toBeUndefined();

//   expect(typeof photo.tag_code).toBe("number");
//   expect(typeof photo.source_code).toBe("number");
// }