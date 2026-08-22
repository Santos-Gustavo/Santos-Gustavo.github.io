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

  await expect(page.locator("#authEmail")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#authPassword")).toBeVisible({ timeout: 10000 });

  await page.locator("#authEmail").fill(E2E_EMAIL);
  await page.locator("#authPassword").fill(E2E_PASSWORD);

  await page
    .getByRole("button", { name: /entrar|login|iniciar/i })
    .click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 15000,
  });

  await page.waitForTimeout(500);
}

test("payment UI exposes no client-side mark-as-paid action", async ({
  page,
}) => {
  await login(page);

  // The only payment affordance in the DOM must be the two EuPago payment
  // *creation* buttons. Neither is clicked here — clicking would call the
  // real create-eupago-payment Edge Function and create a live payment row.
  const paymentActionButtons = page.locator("[data-payment-action]");

  await expect(paymentActionButtons).toHaveCount(2);

  const actions = await paymentActionButtons.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-payment-action"))
  );

  for (const action of actions) {
    expect(action).toBe("create-eupago-payment");
  }

  // No element anywhere should let the browser set/confirm a paid status
  // directly — payment status must only ever be written by the
  // eupago-webhook Edge Function (server-side, service-role client).
  await expect(page.locator('[data-payment-action="mark-paid"]')).toHaveCount(0);
  await expect(page.locator('[data-payment-action="set-paid"]')).toHaveCount(0);
  await expect(page.locator('[data-payment-action="confirm-paid"]')).toHaveCount(0);
  await expect(page.locator("[data-payment-status]")).toHaveCount(0);

  await expect(
    page.getByRole("button", {
      name: /marcar como pago|confirmar pagamento|mark as paid/i,
    })
  ).toHaveCount(0);
});
