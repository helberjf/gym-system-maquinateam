import { expect, test } from "@playwright/test";

test.describe("Auth guards", () => {
  test("redirects unauthenticated users away from /dashboard", async ({
    page,
  }) => {
    const response = await page.goto("/dashboard");
    // Next middleware redirects anonymous traffic to /login with callbackUrl.
    await page.waitForURL(/\/login/);
    expect(page.url()).toMatch(/callbackUrl/);
    // The final page should render the login form.
    await expect(page.locator("#email")).toBeVisible();
    // Response chain is fine; just sanity-check we didn't get a 500.
    expect(response?.status() ?? 200).toBeLessThan(500);
  });

  test("login form shows client validation for empty submit", async ({
    page,
  }) => {
    await page.goto("/login");

    const submit = page.getByRole("button", { name: /entrar agora/i });
    await submit.click();

    // The zod resolver surfaces inline field errors; email field must still be focusable.
    const email = page.locator("#email");
    await expect(email).toBeVisible();
    // At least one error text should appear near the fields.
    await expect(page.locator("p.text-xs.text-brand-white").first()).toBeVisible();
  });

  test("login form rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#email").fill("nope@example.com");
    await page.locator("#password").fill("invalid-password");
    await page.getByRole("button", { name: /entrar agora/i }).click();

    // Error banner should eventually appear (credentials error).
    const errorBanner = page.getByText(
      /credenciais|invalid|nao foi possivel|email ou senha/i,
    );
    await expect(errorBanner.first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Authenticated happy path (optional)", () => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated smoke.",
  );

  test("logs in and lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(email!);
    await page.locator("#password").fill(password!);
    await page.getByRole("button", { name: /entrar agora/i }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
