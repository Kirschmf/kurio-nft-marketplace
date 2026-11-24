import { expect, test } from "@playwright/test";
import { action, add, api, boot, login } from "./helpers";
import type { CartView } from "../../src/lib/types";

test.beforeEach(async ({ page }) => boot(page));
test("T065 T066 keyboard, dialog containment and focus restoration", async ({
  page,
}) => {
  const trigger = page.getByRole("button", {
    name: "Abrir cenários da demonstração",
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 28; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test("T067 invalid form focuses and describes the field", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Criar conta" }).click();
  const input = page.getByRole("textbox", {
    name: "Nome de usuário",
    exact: true,
  });
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveAttribute("aria-describedby", /error/);
  await expect(input).toBeFocused();
});
test("T069 T080 T081 no overflow at 390, 768, 1440 or 200 percent equivalent width", async ({
  page,
}) => {
  await login(page);
  await add(page);
  for (const width of [390, 768, 1440, 720]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/nfts/emerald-042",
      "/cart",
      "/checkout",
      "/account/profile",
      "/account/wallets",
    ]) {
      await page.goto(route);
      await expect(page.locator("#main-content")).not.toBeEmpty();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `${route} at ${width}`,
      ).toBe(true);
    }
  }
});
test("T070 T071 slow skeletons and reduced motion remain accessible", async ({
  page,
}) => {
  await action(page, "scenario.set", { scenario: "slow" });
  await page.goto("/?q=Emerald");
  await expect(
    page.getByRole("status", { name: "Carregando" }).first(),
  ).toBeVisible();
  expect(
    await page
      .locator(".skeleton")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(4);
  await page.goto("/nfts/emerald-042");
  await expect(page.locator(".skeleton-detail")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042" }),
  ).toBeVisible();
  await page.goto("/cart");
  await expect(page.locator(".skeleton-summary")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible();
});
test("T072 transient failures stop retrying and recover on request", async ({
  page,
}) => {
  await action(page, "scenario.set", { scenario: "server-error" });
  await page.goto("/?q=Emerald");
  await expect(page.getByRole("alert")).toContainText("temporariamente");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(4);
});
test("T074 reset restores sessions, versions, cart, favorites and orders", async ({
  page,
}) => {
  await login(page);
  await add(page);
  await api(page, "PUT", "/favorites/emerald-042");
  await action(page, "nft.change", { priceEth: "9.19" });
  await api(page, "POST", "/demo/reset", { scenario: "default", seed: 7 });
  await page.reload();
  await expect(page.locator(".header-actions")).toContainText("Entrar");
  await login(page);
  expect((await api<string[]>(page, "GET", "/favorites")).data).toEqual([]);
  expect((await api<CartView>(page, "GET", "/cart")).data.lines).toEqual([]);
  await page.goto("/nfts/emerald-042");
  await expect(page.locator(".detail-price")).toHaveText("1.19 ETH");
});
test("T079 auxiliary actions explain scope without pretending to send", async ({
  page,
}) => {
  await page
    .locator(".editorial")
    .getByRole("button", { name: /Ler mais/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("demonstração");
  await page.getByRole("button", { name: "Entendi" }).click();
  await page
    .getByRole("textbox", { name: "E-mail para novidades" })
    .fill("fiction@example.test");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Nenhum e-mail foi cadastrado",
  );
});
test("T064 mounting pages does not duplicate socket effects", async ({
  page,
}) => {
  await add(page);
  for (const route of ["/cart", "/nfts/emerald-042", "/cart"]) {
    await page.goto(route);
    await expect(page.locator("#main-content")).not.toBeEmpty();
  }
  await expect(page.locator("#main-content")).toHaveAttribute(
    "data-connection",
    "connected",
  );
  await action(page, "nft.change", { priceEth: "4.19" });
  await expect(page.locator(".cart-product>span")).toHaveText("4.19 ETH");
  await page
    .getByRole("button", { name: "Abrir cenários da demonstração" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("1 eventos recebidos");
});
