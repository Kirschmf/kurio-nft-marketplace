import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  action,
  add,
  boot,
  createOrder,
  login,
  visitSignedIn,
} from "./helpers";

async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 160; i++) {
    if (await target.evaluate((element) => element === document.activeElement))
      return;
    await page.keyboard.press("Tab");
  }
  throw new Error(
    `Control is not reachable by Tab: ${await target.textContent()}`,
  );
}
async function enter(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  await tabTo(page, target);
  await page.keyboard.press("Enter");
}
test.beforeEach(async ({ page }) => boot(page));

test("T065 complete purchase uses Tab and Enter", async ({ page }) => {
  test.setTimeout(60000);
  const signIn =
    page.viewportSize()!.width <= 600
      ? page.locator(".mobile-nav").getByRole("link", { name: "Meu perfil" })
      : page.getByRole("link", { name: "Entrar", exact: true });
  await enter(page, signIn);
  const email = page.getByRole("textbox", { name: "E-mail", exact: true });
  await tabTo(page, email);
  await page.keyboard.type("collector.a@example.test");
  await tabTo(page, page.getByLabel("Senha", { exact: true }));
  await page.keyboard.type("CollectorDemoA!2026");
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/\/login/);
  await enter(
    page,
    page.getByRole("link", { name: "Ver Emerald Ape #042", exact: true }),
  );
  await enter(
    page,
    page.getByRole("button", { name: "Comprar agora", exact: true }),
  );
  await expect(page).toHaveURL(/\/checkout/);
  if (page.viewportSize()!.width <= 600)
    await enter(
      page,
      page.getByRole("button", { name: "Continuar para carteira" }),
    );
  await enter(
    page,
    page.getByRole("button", { name: "Conectar carteira", exact: true }),
  );
  await enter(
    page,
    page.getByRole("button", { name: "Revisar compra", exact: true }),
  );
  await enter(
    page,
    page.getByRole("button", { name: "Confirmar compra", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "Compra confirmada!" }),
  ).toBeVisible();
});

test("T066 login and mobile filters contain and restore focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const trigger = page.getByRole("link", { name: "Entrar", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  const filters = page.getByRole("button", { name: "Filtros", exact: true });
  await filters.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 28; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(filters).toBeFocused();
});

test("T070 T071 shimmer runs normally and stops with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await action(page, "scenario.set", { scenario: "slow" });
  await page.goto("/?q=Emerald");
  const skeleton = page.locator(".skeleton").first();
  await expect(skeleton).toBeVisible();
  expect(
    await skeleton.evaluate(
      (element) => getComputedStyle(element).animationName,
    ),
  ).toBe("shimmer");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await skeleton.evaluate(
      (element) => getComputedStyle(element).animationName,
    ),
  ).toBe("none");
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(4);
});

test("T069 T080 T081 all nine screens and favorites fit required widths", async ({
  page,
}) => {
  test.setTimeout(90000);
  await login(page);
  await add(page);
  const order = await createOrder(page);
  await action(page, "order.resolve", {
    orderId: order.id,
    status: "confirmed",
  });
  await add(page, 2);
  for (const width of [390, 414, 768, 1440, 720]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/nfts/emerald-042",
      "/cart",
      "/checkout",
      "/login",
      "/register",
      "/account/profile",
      "/account/wallets",
      `/orders/${order.id}`,
      "/favorites",
    ]) {
      await visitSignedIn(page, route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `${route} at ${width}`,
      ).toBe(true);
    }
  }
});

test("T073 background refresh preserves catalog and announces progress", async ({
  page,
}) => {
  const cards = page.locator(".nft-grid .nft-card");
  await expect(cards).toHaveCount(9);
  await expect(page.locator("#main-content")).toHaveAttribute(
    "data-connection",
    "connected",
  );
  await action(page, "scenario.set", { scenario: "slow" });
  await action(page, "nft.change", { priceEth: "2.19" });
  await expect(page.locator(".background-status")).toHaveText(
    "Atualizando resultados…",
  );
  await expect(cards).toHaveCount(9);
  await expect(page.locator(".skeleton")).toHaveCount(0);
  await expect(cards.first()).toContainText("2.19 ETH");
});

test("T080 checkout remains operable in a short mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await add(page);
  await login(page, "a", "/checkout");
  await expect(page.locator(".skeleton")).toHaveCount(0);
  const fields = page.locator(
    ".checkout-layout > section form :is(input, select, textarea)",
  );
  for (const field of await fields.all()) {
    await field.focus();
    await field.scrollIntoViewIfNeeded();
    await expect
      .poll(
        () =>
          field.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const hit = document.elementFromPoint(
              rect.x + rect.width / 2,
              rect.y + rect.height / 2,
            );
            return {
              inside: rect.top >= -1 && rect.bottom <= innerHeight + 1,
              uncovered: hit === element || element.contains(hit),
            };
          }),
        { message: (await field.getAttribute("id")) ?? "checkout field" },
      )
      .toEqual({ inside: true, uncovered: true });
  }
  await page.getByRole("button", { name: "Continuar para carteira" }).click();
  await page
    .getByRole("button", { name: "Conectar carteira", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Revisar compra", exact: true })
    .click();
  await expect(page.locator("#quote-review")).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Revise e confirme" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada!" }),
  ).toBeVisible();
});
