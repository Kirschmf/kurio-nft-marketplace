import { expect, test } from "@playwright/test";
import { action, add, api, boot, createOrder, login } from "./helpers";

test.beforeEach(async ({ page }) => boot(page));

test("T018 closing login while the cart merge is pending does not navigate later", async ({
  page,
}) => {
  await add(page, 2);
  await page.goto("/login?redirect=%2Fcheckout");
  await expect(page.locator(".cart-link")).toHaveAttribute(
    "aria-label",
    "Carrinho, 2 itens",
  );
  await action(page, "network.hold", { method: "POST", path: "/cart/merge" });
  await action(page, "network.hold", {
    method: "GET",
    path: "/cart",
    phase: "response",
  });
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill("collector.a@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("CollectorDemoA!2026");
  const sent = page.waitForRequest((request) =>
    request.url().endsWith("/api/cart/merge"),
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await sent;
  if (page.viewportSize()!.width <= 600)
    await page
      .getByRole("link", { name: "Kurio, início", exact: true })
      .click();
  else
    await page.getByRole("button", { name: "Fechar acesso à conta" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  const received = page.waitForResponse((response) =>
    response.url().endsWith("/api/cart/merge"),
  );
  await action(page, "network.release", {
    method: "POST",
    path: "/cart/merge",
  });
  expect((await received).status()).toBe(200);
  await action(page, "network.release", {
    method: "GET",
    path: "/cart",
    phase: "response",
  });
  await expect(page.locator(".cart-link")).toHaveAttribute(
    "aria-label",
    "Carrinho, 2 itens",
  );
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(page.locator(".account-link")).toContainText("Alex");
});

for (const expired of [true, false]) {
  test(`T019 late ${expired ? "401" : "200"} from A cannot affect B`, async ({
    page,
  }) => {
    await login(page, "a", "/account/profile");
    const name = page.getByRole("textbox", {
      name: "Nome de exibição",
      exact: true,
    });
    await expect(name).toBeVisible();
    const phase = expired ? "request" : "response";
    await action(page, "network.hold", {
      method: "PATCH",
      path: "/profile",
      phase,
    });
    if (expired) await action(page, "session.expire");
    const sent = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/profile") && request.method() === "PATCH",
    );
    await name.fill("Resposta da conta anterior");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await sent;
    if (!expired) {
      // Observe the committed value before logout, while its HTTP response is held.
      await expect
        .poll(async () =>
          (await import("./helpers"))
            .api<{ displayName: string }>(page, "GET", "/profile")
            .then((value) => value.data.displayName),
        )
        .toBe("Resposta da conta anterior");
    }
    // SPA navigation keeps the old mutation alive while B signs in.
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page.locator(".header-actions")).toContainText("Entrar");
    if (page.viewportSize()!.width <= 600)
      await page
        .locator(".mobile-nav")
        .getByRole("link", { name: "Meu perfil" })
        .click();
    else await page.getByRole("link", { name: "Entrar", exact: true }).click();
    await page
      .getByRole("textbox", { name: "E-mail", exact: true })
      .fill("collector.b@example.test");
    await page.getByLabel("Senha", { exact: true }).fill("CollectorDemoB!2026");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.locator(".account-link")).toContainText("Bia");
    const received = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/profile") &&
        response.request().method() === "PATCH",
    );
    await action(page, "network.release", {
      method: "PATCH",
      path: "/profile",
      phase,
    });
    expect((await received).status()).toBe(expired ? 401 : 200);
    await expect(page.locator(".account-link")).toContainText("Bia");
    if (page.viewportSize()!.width <= 600)
      await page
        .locator(".mobile-nav")
        .getByRole("link", { name: "Meu perfil" })
        .click();
    else await page.locator(".account-link").click();
    await expect(
      page.getByRole("textbox", { name: "E-mail", exact: true }),
    ).toHaveValue("collector.b@example.test");
    await expect(page.locator(".toast")).not.toContainText("Perfil atualizado");
  });
}

test("T072 initial favorites failure exposes retry and recovers", async ({
  page,
}) => {
  await login(page, "a", "/account/profile");
  await expect(
    page.getByRole("textbox", { name: "Nome de exibição", exact: true }),
  ).toBeVisible();
  await action(page, "scenario.set", { scenario: "server-error" });
  await page
    .getByRole("link", { name: "Lista de interesse", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();
  await expect(page.locator(".skeleton")).toHaveCount(0);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Sua lista ainda está vazia" }),
  ).toBeVisible();
});

test("T051 T067 password errors are associated, focused and cleared on recovery", async ({
  page,
}) => {
  await login(page, "a", "/account/profile");
  await page
    .getByLabel("Senha atual", { exact: true })
    .fill("CollectorDemoA!2026");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("ChangedCollector!2026");
  const confirmation = page.getByLabel("Confirmar nova senha", { exact: true });
  await confirmation.fill("DifferentCollector!2026");
  await page
    .getByRole("button", { name: "Alterar senha", exact: true })
    .click();
  await expect(confirmation).toHaveAttribute("aria-invalid", "true");
  await expect(confirmation).toHaveAttribute("aria-describedby", /error/);
  await expect(confirmation).toBeFocused();
  await confirmation.fill("ChangedCollector!2026");
  await page
    .getByRole("button", { name: "Alterar senha", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Senha alterada");
  await expect(confirmation).toHaveAttribute("aria-invalid", "false");
});

test("T062 delayed private event from A stays isolated after B signs in", async ({
  page,
}) => {
  await login(page, "a", "/account/profile");
  await add(page);
  const order = await createOrder(page);
  await action(page, "events.hold");
  await action(page, "order.resolve", {
    orderId: order.id,
    status: "confirmed",
  });
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.locator(".header-actions")).toContainText("Entrar");
  if (page.viewportSize()!.width <= 600)
    await page
      .locator(".mobile-nav")
      .getByRole("link", { name: "Meu perfil" })
      .click();
  else await page.getByRole("link", { name: "Entrar", exact: true }).click();
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill("collector.b@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("CollectorDemoB!2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator("#main-content")).toHaveAttribute(
    "data-connection",
    "connected",
  );
  await page
    .getByRole("button", { name: "Abrir cenários da demonstração" })
    .click();
  const count = page.locator(".demo-status>span");
  const before = await count.textContent();
  const released = await api<{ released: number }>(
    page,
    "POST",
    "/demo/actions",
    { type: "events.release" },
  );
  expect(released.data.released).toBe(1);
  await expect(count).toHaveText(before!);
  expect((await api(page, "GET", `/orders/${order.id}`)).status).toBe(404);
  expect((await api(page, "GET", `/orders/${order.id}/receipt`)).status).toBe(
    404,
  );
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(page.locator(".account-link")).toContainText("Bia");
});
