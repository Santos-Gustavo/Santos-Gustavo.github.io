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
        name: /Cada obra organizada e registada, no telemóvel\./i,
      })
    ).toBeVisible();

    await expect(
      page
        .getByRole("link", { name: "Experimentar com uma obra em curso" })
        .first()
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

    await page.getByRole("link", { name: "Entrar", exact: true }).click();
    await page.waitForLoadState("load");

    // The static dev server used for local/CI runs 301-redirects clean URLs
    // (/app.html -> /app); GitHub Pages serves /app.html directly with no
    // redirect. Accept either so this test is agnostic to which static
    // server fronted the request.
    await expect(page).toHaveURL(/\/app(\.html)?$/);
    await expect(page.locator("#authScreen")).toBeVisible();
    await expect(page.locator("#authEmail")).toBeVisible();
  });

  test("does not claim unsupported product capabilities", async ({ page }) => {
    await page.goto("/");

    const body = page.locator("body");
    await expect(body).toContainText(
      "Visualizado indica que o link foi aberto. Não indica quem o abriu"
    );
    await expect(body).not.toContainText(
      /guarda automaticamente as|autosave|modo offline|gantt|kanban|assinatura digital|prova legal|IMPIC|ilimitad/i
    );
  });

  test("header anchors point at existing sections", async ({ page }) => {
    await page.goto("/");

    for (const id of ["como-funciona", "relatorios", "faq"]) {
      await expect(page.locator(`.landing-nav a[href="#${id}"]`)).toHaveCount(1);
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(page.locator('a[href="examples/relatorio-exemplo.pdf"]')).toHaveCount(1);
  });

  test("sample report link serves the fictional demo PDF", async ({ page, request }) => {
    await page.goto("/");
    const href = await page.locator('a[href$=".pdf"]').getAttribute("href");
    const response = await request.get(`/${href}`);

    expect(response.status()).toBe(200);
    expect((await response.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  for (const width of [320, 360]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await page.goto("/");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.locator(".sticky-bottom-bar .btn-primary")).toBeVisible();
    });
  }

  test("reset-password page loads independently", async ({ page }) => {
    await page.goto("/reset-password.html");

    await expect(page.locator("#newPassword")).toBeVisible();
  });
});

// Compliance quick wins (docs/compliance/PRELAUNCH-QUICK-WINS.md): public
// pages must not call Google Fonts or a JS CDN at runtime — Inter and
// supabase-js are vendored. Supabase itself is the expected backend.
test.describe("no third-party font/CDN requests", () => {
  const BLOCKED_HOSTS = /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/;

  for (const path of ["/", "/app.html", "/share.html", "/reset-password.html"]) {
    test(`${path} loads only first-party fonts and scripts`, async ({ page }) => {
      const blocked = [];
      page.on("request", (request) => {
        if (BLOCKED_HOSTS.test(request.url())) blocked.push(request.url());
      });

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(blocked).toEqual([]);
      if (path !== "/reset-password.html") {
        const interLoaded = await page.evaluate(async () => {
          await document.fonts.ready;
          return [...document.fonts].some(
            (face) => face.family.replace(/"/g, "") === "Inter" && face.status === "loaded"
          );
        });
        expect(interLoaded).toBe(true);
      }
    });
  }

  test("app.html still initialises the vendored Supabase client", async ({ page }) => {
    await page.goto("/app.html");

    await expect(page.locator("#authScreen")).toBeVisible();
    expect(await page.evaluate(() => typeof window.supabase?.createClient)).toBe("function");
  });
});
