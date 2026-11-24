import { expect, test } from "@playwright/test";
import { add, boot, checkout, login } from "./helpers";

test("catalog → detail → visitor cart → login → confirmed receipt", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await boot(page);
  await page
    .getByRole("link", { name: "Ver Emerald Ape #042", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Adicionar ao carrinho", exact: true })
    .click();
  await page.goto("/cart");
  await expect(page.locator(".cart-row")).toHaveCount(1);
  await page.getByRole("link", { name: "Finalizar compra" }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, "a", "/checkout");
  await checkout(page);
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada!" }),
  ).toBeVisible();
  await expect(page.getByText(/DEMO-/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada!" }),
  ).toBeVisible();
  await page.goto("/cart");
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("T068 socket connection updates an open cart through the real client", async ({
  page,
}) => {
  await boot(page);
  await add(page);
  await page.goto("/cart");
  await expect(page.locator(".cart-product>span")).toHaveText("1.19 ETH");
  const { action } = await import("./helpers");
  await action(page, "nft.change", { priceEth: "2.19" });
  await expect(page.locator(".cart-product>span")).toHaveText("2.19 ETH");
  await expect(page.locator(".toast")).toHaveAttribute("role", "status");
  await expect(page.locator(".toast")).toHaveAttribute("aria-live", "polite");
  await page
    .getByRole("button", { name: "Abrir cenários da demonstração" })
    .click();
  await expect(page.getByTestId("socket-status")).toHaveText("connected");
});
