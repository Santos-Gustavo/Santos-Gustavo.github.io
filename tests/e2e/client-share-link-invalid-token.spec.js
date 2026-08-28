import { expect, test } from "@playwright/test";
import {
  getFunctionUrl,
  randomNeverIssuedToken,
} from "./helpers/report-share-test-helper.js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const UNAVAILABLE_BODY = { ok: false, message: "Este link não está disponível." };

test.describe("invalid / never-issued tokens", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON_KEY,
    "Set SUPABASE_URL and SUPABASE_ANON_KEY in .env.",
  );

  test("a well-formed but never-issued token shows the generic unavailable state", async ({
    page,
  }) => {
    const token = randomNeverIssuedToken();

    await page.goto(`/share.html#token=${token}`);

    await expect(page.getByText("Este link não está disponível.")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("iframe.share-frame")).toHaveCount(0);
  });

  test("no token in the URL shows the generic unavailable state, not a crash", async ({
    page,
  }) => {
    await page.goto("/share.html");

    await expect(page.getByText("Este link não está disponível.")).toBeVisible({
      timeout: 10000,
    });
  });

  for (const [label, token] of [
    ["empty string", ""],
    ["too short", "abc"],
    ["wrong charset", "not a url safe token!!"],
  ]) {
    test(`malformed token (${label}) gets the same generic 404 shape`, async ({
      request,
    }) => {
      const response = await request.post(getFunctionUrl("get-shared-report"), {
        headers: { apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
        data: { token },
      });

      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual(UNAVAILABLE_BODY);
    });
  }

  test("a syntactically valid but never-issued token gets the same generic 404 shape", async ({
    request,
  }) => {
    const response = await request.post(getFunctionUrl("get-shared-report"), {
      headers: { apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
      data: { token: randomNeverIssuedToken() },
    });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual(UNAVAILABLE_BODY);
  });
});
