import { expect, test } from "@playwright/test";

test.describe("Public blog and SEO", () => {
  test("lists blog posts and opens an article", async ({ page }) => {
    await page.goto("/blog");

    await expect(
      page.getByRole("heading", { name: /luta, rotina e evolucao/i }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /como escolher o melhor plano/i })
      .click();

    await expect(page).toHaveURL(/\/blog\/como-escolher-plano-de-luta/);
    await expect(
      page.getByRole("heading", {
        name: /como escolher o melhor plano de luta/i,
      }),
    ).toBeVisible();
    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .evaluate((node) => node.textContent ?? "");
    expect(jsonLd).toContain("BlogPosting");
  });

  test("exposes blog entries in sitemap", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBeTruthy();

    const body = await response.text();
    expect(body).toContain("/blog");
    expect(body).toContain("/blog/beneficios-do-muay-thai-para-iniciantes");
  });
});
