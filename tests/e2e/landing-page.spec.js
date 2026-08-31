import { expect, test } from "@playwright/test";

// DESIGN-SYSTEM-001 — landing-page.html is a standalone, unauthenticated
// marketing page. It does not embed the app shell and must never contain
// payment or overclaiming ("Visualizado pelo cliente") wording. See
// docs/features/DESIGN-SYSTEM-001.md.

const PAYMENT_WORDING =
  /marcar como pago|confirmar pagamento|mark as paid|multibanco|mb ?way|eupago|stripe|pagamento|subscrição|plano/i;

test.describe("landing page (DESIGN-SYSTEM-001)", () => {
  test("shows the marketing headline and primary CTA, with no app shell", async ({
    page,
  }) => {
    await page.goto("/landing-page.html");

    await expect(
      page.getByRole("heading", {
        name: /Relatórios de obra profissionais, enviados por WhatsApp\./i,
      })
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: "Testar grátis" }).first()
    ).toBeVisible();

    await expect(page.locator("#authScreen")).toHaveCount(0);
    await expect(page.locator("#appShell")).toHaveCount(0);
  });

  test("has no payment UI or wording", async ({ page }) => {
    await page.goto("/landing-page.html");

    await expect(page.locator("[data-payment-action]")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(PAYMENT_WORDING);
  });

  test("does not overclaim who viewed the report", async ({ page }) => {
    await page.goto("/landing-page.html");

    await expect(page.locator("body")).toContainText("Visualizado");
    await expect(page.locator("body")).not.toContainText("Visualizado pelo cliente");
  });
});
