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

  test("login form exposes credential fields and actions", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: /entre para acompanhar/i }),
    ).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /entrar agora/i }),
    ).toBeEnabled();
  });

  test("login form keeps users on the safe login surface", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#email").fill("nope@example.com");
    await page.locator("#password").fill("invalid-password");
    await page.getByRole("button", { name: /entrar agora/i }).click();

    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator("#email")).toBeVisible();
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
