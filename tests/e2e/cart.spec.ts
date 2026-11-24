import { expect, test } from "@playwright/test";
import { action, add, api, boot, login } from "./helpers";
import type { CartView } from "../../src/lib/types";

test.beforeEach(async ({ page }) => boot(page));
test("T025 T026 cart groups editions and persists quantities/removal", async ({
  page,
}) => {
  await add(page, 2);
  await add(page, 3);
  await add(page, 1, "ten");
  await page.goto("/cart");
  await expect(page.locator(".cart-row")).toHaveCount(2);
  await expect(page.locator(".cart-row").first().locator("output")).toHaveText(
    "5",
  );
  await page
    .locator(".cart-row")
    .first()
    .getByRole("button", { name: "Diminuir quantidade" })
    .click();
  await expect(page.locator(".cart-row").first().locator("output")).toHaveText(
    "4",
  );
  await page.reload();
  await expect(page.locator(".cart-row").first().locator("output")).toHaveText(
    "4",
  );
  await page
    .locator(".cart-row")
    .last()
    .getByRole("button", { name: /Remover Emerald/ })
    .click();
  await expect(page.locator(".cart-row")).toHaveCount(1);
});
test("T027 rejects zero, negative, fractional and excessive quantities", async ({
  page,
}) => {
  for (const quantity of [0, -1, 1.5, 51]) {
    const result = await api(page, "POST", "/cart/items", {
      nftId: "emerald-042",
      editionId: "fifty",
      quantity,
    });
    expect(result.status).toBe(quantity === 51 ? 409 : 422);
  }
  expect((await api<CartView>(page, "GET", "/cart")).data.lines).toHaveLength(
    0,
  );
});
test("T028 T029 coupon valid, invalid, expired and removal", async ({
  page,
}) => {
  await add(page, 2);
  await page.goto("/cart");
  const input = page.getByRole("textbox", { name: "Código promocional" });
  for (const code of ["INVALID", "EXPIRED10"]) {
    await input.fill(code);
    await page.getByRole("button", { name: "Aplicar", exact: true }).click();
    await expect(page.locator(".coupon [role=alert]")).toContainText(
      code === "INVALID" ? "Não encontramos" : "expirou",
    );
  }
  await input.fill("WELCOME10");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.locator(".summary-total")).toContainText("2.158 ETH");
  await page.getByRole("button", { name: "Remover", exact: true }).click();
  await expect(page.locator(".summary-total")).toContainText("2.396 ETH");
});
test("T030 repeated merge and a new visitor cart are each consumed once", async ({
  page,
}) => {
  await add(page, 2);
  const guest = await page.evaluate(() => localStorage.getItem("kurio-guest"));
  await login(page);
  let cart = (await api<CartView>(page, "GET", "/cart")).data;
  expect(cart.lines[0].quantity).toBe(2);
  await api(page, "POST", "/cart/merge", {
    guestCartId: guest,
    mergeId: guest,
  });
  cart = (await api<CartView>(page, "GET", "/cart")).data;
  expect(cart.lines[0].quantity).toBe(2);
  await page.goto("/account/profile");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:5173\/\?/);
  await add(page, 1);
  await login(page);
  expect(
    (await api<CartView>(page, "GET", "/cart")).data.lines[0].quantity,
  ).toBe(3);
});
test("T031 guest merge explains stock adjustment", async ({ page }) => {
  await login(page);
  await add(page, 49);
  await page.goto("/account/profile");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:5173\/\?/);
  await add(page, 5);
  await login(page);
  await expect(page.locator(".toast")).toContainText("quantidade ajustada");
  expect(
    (await api<CartView>(page, "GET", "/cart")).data.lines[0].quantity,
  ).toBe(50);
});
test("T033 precision is preserved from API through cart presentation", async ({
  page,
}) => {
  await action(page, "nft.change", { priceEth: "0.000000000000000019" });
  await add(page, 3);
  await page.goto("/cart");
  await page
    .getByRole("textbox", { name: "Código promocional" })
    .fill("WELCOME10");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.locator(".summary-total")).toContainText(
    "0.016000000000000052 ETH",
  );
});
