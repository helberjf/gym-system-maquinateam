import { expect, test } from "@playwright/test";

test.describe("Public home", () => {
  test("loads and shows brand content", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Maquina|Premium|Juiz/i);

    // There should be at least one call-to-action linking to login or planos.
    const loginLink = page.getByRole("link", { name: /login|entrar/i }).first();
    await expect(loginLink).toBeVisible();
  });

  test("navigates from home to login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /login|entrar/i }).first().click();

    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(
      page.getByRole("heading", { name: /entre|acesso|evolucao/i }),
    ).toBeVisible();
  });
});
