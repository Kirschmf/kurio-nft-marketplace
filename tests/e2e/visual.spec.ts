import { expect, test } from "@playwright/test";
import { add, boot, login } from "./helpers";

test.beforeEach(async ({ page }) => boot(page));
for (const route of ["home", "detail", "cart", "checkout"] as const) {
  test(`T075 visual ${route}`, async ({ page }) => {
    if (route === "cart" || route === "checkout") await add(page, 2);
    if (route === "checkout") await login(page, "a", "/checkout");
    else
      await page.goto(
        route === "home"
          ? "/"
          : route === "detail"
            ? "/nfts/emerald-042"
            : "/cart",
      );
    await expect(page.locator(".skeleton")).toHaveCount(0);
    await page.evaluate(async () => {
      // Full-page captures also need assets outside the lazy-loading viewport.
      for (const image of document.images) image.loading = "eager";
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((image) =>
          image.decode().catch(() => undefined),
        ),
      );
    });
    await expect(page.locator(".connection-notice")).toHaveCount(0);
    await expect(page).toHaveScreenshot(`${route}.png`, { fullPage: true });
  });
}
