import { expect, test } from "@playwright/test";

// DESIGN-SYSTEM-001 (§6) / LIVE-SITE-FETCH-001 — index.html is the public
// site root ("/"), a standalone, unauthenticated marketing page; the
// authenticated wizard app lives at app.html. The landing page does not
// embed the app shell and must never contain payment or overclaiming
// ("Visualizado pelo cliente") wording. See docs/features/DESIGN-SYSTEM-001.md
// and docs/features/LIVE-SITE-FETCH-001.md.

const PAYMENT_WORDING =
  /marcar como pago|confirmar pagamento|mark as paid|multibanco|mb ?way|eupago|stripe|pagamento|subscrição|plano/i;

test.describe("landing page (DESIGN-SYSTEM-001)", () => {
  test("shows the marketing headline and primary CTA, with no app shell", async ({
    page,
  }) => {
    await page.goto("/");

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
    await page.goto("/");

    await expect(page.locator("[data-payment-action]")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(PAYMENT_WORDING);
  });

  test("does not overclaim who viewed the report", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("body")).toContainText("Visualizado");
    await expect(page.locator("body")).not.toContainText("Visualizado pelo cliente");
  });

  test("Entrar link reaches the authenticated app entry at app.html", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Entrar" }).click();
    await page.waitForLoadState("load");

    // The static dev server used for local/CI runs 301-redirects clean URLs
    // (/app.html -> /app); GitHub Pages serves /app.html directly with no
    // redirect. Accept either so this test is agnostic to which static
    // server fronted the request.
    await expect(page).toHaveURL(/\/app(\.html)?$/);
    await expect(page.locator("#authScreen")).toBeVisible();
    await expect(page.locator("#authEmail")).toBeVisible();
  });

  test("reset-password page loads independently", async ({ page }) => {
    await page.goto("/reset-password.html");

    await expect(page.locator("#newPassword")).toBeVisible();
  });
});
