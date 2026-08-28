import { expect, test } from "@playwright/test";

// Payments are disabled/deferred for the current MVP trial — see
// docs/validation/MVP-VALIDATION-001.md ("Product stop list"). This spec
// asserts that decision holds, not just that no payment button happens to be
// wired up today. It must fail the moment a payment affordance — button,
// data-payment-action element, or payment-request wording — becomes
// reachable again anywhere in the app.

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

const PAYMENT_WORDING =
  /marcar como pago|confirmar pagamento|mark as paid|multibanco|mb ?way|eupago|pedido de pagamento|referência de pagamento/i;

async function login(page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "Missing E2E login credentials. Set E2E_EMAIL and E2E_PASSWORD in .env.",
    );
  }

  await page.goto("/");

  await expect(page.locator("#authEmail")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#authPassword")).toBeVisible({ timeout: 10000 });

  await page.locator("#authEmail").fill(E2E_EMAIL);
  await page.locator("#authPassword").fill(E2E_PASSWORD);

  await page.getByRole("button", { name: /entrar|login|iniciar/i }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 15000,
  });
}

test("logged-out screen has no payment affordance", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#authEmail")).toBeVisible({ timeout: 10000 });

  await expect(page.locator("[data-payment-action]")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(PAYMENT_WORDING);
});

test("payment UI exposes no client-side action anywhere in the logged-in app", async ({
  page,
}) => {
  await login(page);

  // No element anywhere renders a payment-initiation affordance. The two
  // EuPago buttons that used to exist here are HTML-commented out in
  // index.html — this asserts that stays true, not just that it happens to
  // be true today. Locator counts include the whole DOM regardless of which
  // wizard step is currently active, so this covers every step at once.
  await expect(page.locator("[data-payment-action]")).toHaveCount(0);

  // No element anywhere lets the browser set/confirm a paid status directly
  // — payment status must only ever be written by the eupago-webhook Edge
  // Function (server-side, service-role client), and that function is not
  // wired to any UI while payments are deferred.
  await expect(page.locator('[data-payment-action="mark-paid"]')).toHaveCount(0);
  await expect(page.locator('[data-payment-action="set-paid"]')).toHaveCount(0);
  await expect(page.locator('[data-payment-action="confirm-paid"]')).toHaveCount(0);
  await expect(page.locator("[data-payment-status]")).toHaveCount(0);

  // No visible text anywhere implies a payment can be requested, made, or
  // marked paid from this UI — covers Multibanco/MB WAY/EuPago references and
  // any future "mark as paid" copy, not just the current button labels.
  await expect(page.locator("body")).not.toContainText(PAYMENT_WORDING);

  await expect(
    page.getByRole("button", {
      name: /marcar como pago|confirmar pagamento|mark as paid/i,
    }),
  ).toHaveCount(0);
});
