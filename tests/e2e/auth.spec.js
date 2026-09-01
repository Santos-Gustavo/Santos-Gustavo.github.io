import { expect, test } from "@playwright/test";

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

test("user can log in and reach the app", async ({ page }) => {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "Missing E2E login credentials. Set E2E_EMAIL and E2E_PASSWORD in .env."
    );
  }

  await page.goto("/");

  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");

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
      async () => page.evaluate(() => document.body.innerText),
      {
        timeout: 15000,
        message: "Expected logged-in app screen after login",
      }
    )
    .toMatch(/projetos|novo projeto|relatório|relatorio|projeto|project/i);
});

test("user can log out and returns to the auth screen", async ({ page }) => {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "Missing E2E login credentials. Set E2E_EMAIL and E2E_PASSWORD in .env."
    );
  }

  await page.goto("/");

  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");
  await page.waitForLoadState("load");

  await expect(page.locator("#authEmail")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#authPassword")).toBeVisible({ timeout: 10000 });

  await page.locator("#authEmail").fill(E2E_EMAIL);
  await page.locator("#authPassword").fill(E2E_PASSWORD);

  await page.getByRole("button", { name: /entrar|login|iniciar/i }).click();

  await expect(page.locator("#stepLabel")).toHaveText(/projetos/i, {
    timeout: 15000,
  });

  await page.locator('[data-auth-action="sign-out"]').click();

  await expect(page.locator("#authEmail")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#appShell")).not.toBeVisible();
});

test("confirm password field is hidden until Criar conta is clicked", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");

  await expect(page.locator("#authPassword")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#authPasswordConfirm")).not.toBeVisible();

  await page.locator('[data-auth-action="sign-up"]').click();

  await expect(page.locator("#authPasswordConfirm")).toBeVisible({
    timeout: 5000,
  });
});

test("switching back to Entrar hides the confirm password field again", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");

  await page.locator('[data-auth-action="sign-up"]').click();
  await expect(page.locator("#authPasswordConfirm")).toBeVisible({
    timeout: 5000,
  });

  await page.locator('[data-auth-action="sign-in"]').click();

  await expect(page.locator("#authPasswordConfirm")).not.toBeVisible();
});

test("mismatched passwords block sign-up before calling Supabase", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");

  let signupRequested = false;
  await page.route("**/auth/v1/signup*", async (route) => {
    signupRequested = true;
    await route.abort();
  });

  const timestamp = Date.now();

  await page.locator('[data-auth-action="sign-up"]').click();
  await expect(page.locator("#authPasswordConfirm")).toBeVisible({
    timeout: 5000,
  });

  await page.locator("#authEmail").fill(`e2e-signup-${timestamp}@example.com`);
  await page.locator("#authPassword").fill("Password123");
  await page.locator("#authPasswordConfirm").fill("Different123");

  await page.locator('[data-auth-action="sign-up"]').click();

  await expect(page.locator("#authMessage")).toHaveText(
    "As palavras-passe não coincidem.",
    { timeout: 5000 }
  );

  expect(signupRequested).toBe(false);
  await expect(page.locator("#authScreen")).toBeVisible();
});

test("matching passwords proceed to the sign-up flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");

  let signupRequested = false;
  await page.route("**/auth/v1/signup*", async (route) => {
    signupRequested = true;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ msg: "E2E intercepted — not a real signup." }),
    });
  });

  const timestamp = Date.now();

  await page.locator('[data-auth-action="sign-up"]').click();
  await expect(page.locator("#authPasswordConfirm")).toBeVisible({
    timeout: 5000,
  });

  await page.locator("#authEmail").fill(`e2e-signup-${timestamp}@example.com`);
  await page.locator("#authPassword").fill("Password123");
  await page.locator("#authPasswordConfirm").fill("Password123");

  await page.locator('[data-auth-action="sign-up"]').click();

  await expect
    .poll(() => signupRequested, { timeout: 5000 })
    .toBe(true);
});

test("password reveal toggle shows and hides the password without submitting", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Entrar" }).click();
  await page.waitForLoadState("load");

  const passwordInput = page.locator("#authPassword");
  const toggleBtn = page.locator('[data-toggle-password="authPassword"]');

  await passwordInput.fill("SomePassword123");
  await expect(passwordInput).toHaveAttribute("type", "password");

  await toggleBtn.click();
  await expect(passwordInput).toHaveAttribute("type", "text");
  await expect(toggleBtn).toHaveAttribute("aria-label", "Esconder palavra-passe");

  await toggleBtn.click();
  await expect(passwordInput).toHaveAttribute("type", "password");
  await expect(toggleBtn).toHaveAttribute("aria-label", "Mostrar palavra-passe");

  // Toggling must not submit/navigate away from the auth screen.
  await expect(page.locator("#authScreen")).toBeVisible();
});