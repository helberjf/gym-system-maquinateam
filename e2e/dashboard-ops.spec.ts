import { expect, test } from "@playwright/test";

test.describe("Protected operational surfaces", () => {
  test("redirects anonymous agenda access to login", async ({ page }) => {
    await page.goto("/dashboard/agenda");
    await page.waitForURL(/\/login/);

    expect(page.url()).toMatch(/callbackUrl/);
    await expect(page.locator("#email")).toBeVisible();
  });

  test("blocks report exports for anonymous users", async ({ request }) => {
    const response = await request.get(
      "/api/reports/export?kind=attendance&format=xlsx",
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "unauthorized",
    });
  });
});
