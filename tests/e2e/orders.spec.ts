import { expect, test } from "@playwright/test";
import {
  action,
  add,
  api,
  boot,
  checkout,
  createOrder,
  firstNft,
  login,
  preparedOrder,
} from "./helpers";
import type { CartView, Order } from "../../src/lib/types";

test.beforeEach(async ({ page }) => {
  await boot(page);
  await login(page);
  await add(page, 2);
});
test("fee changes and coupon expiration require renewed confirmation", async ({
  page,
}) => {
  await checkout(page);
  await action(page, "fee.change", { feeEth: "0.02" });
  await expect(
    page.getByRole("button", { name: "Confirmar compra", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("mudou");
  const cart = (await api<CartView>(page, "GET", "/cart")).data;
  await api(page, "PUT", "/cart/coupon", {
    code: "WELCOME10",
    expectedCartVersion: cart.cart.version,
  });
  const prepared = await preparedOrder(page);
  await action(page, "scenario.set", { scenario: "expired-coupon" });
  const result = await api<Order>(
    page,
    "POST",
    "/orders",
    prepared.body,
    crypto.randomUUID(),
  );
  expect(result.status).toBe(422);
  expect(result.error?.code).toBe("COUPON_EXPIRED");
  expect((await firstNft(page)).editions[2].reserved).toBe(0);
});
test("T032 T034 T035 T038 immutable quote and receipt use registered secondary wallet", async ({
  page,
}) => {
  await page.goto("/checkout");
  await page
    .getByRole("combobox", { name: "Carteira e rede" })
    .selectOption("collector-a-secondary");
  const next = page.getByRole("button", { name: "Continuar para carteira" });
  if (page.viewportSize()!.width <= 600) await next.click();
  await page.getByRole("radio", { name: "Coinbase Wallet" }).check();
  await page
    .getByRole("button", { name: "Conectar carteira", exact: true })
    .click();
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await expect(page.locator(".quote-review")).toContainText("2.396 ETH");
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada!" }),
  ).toBeVisible();
  const id = page.url().split("/").pop()!;
  const before = (await api<Order>(page, "GET", `/orders/${id}/receipt`)).data;
  await action(page, "nft.change", { priceEth: "9.99" });
  await page.reload();
  await expect(page.locator(".summary-total")).toContainText("2.396 ETH");
  const after = (await api<Order>(page, "GET", `/orders/${id}/receipt`)).data;
  expect(after.quote).toEqual(before.quote);
  expect(after.quote.wallet.role).toBe("secondary");
  expect(after.quote.wallet.provider).toBe("coinbase");
  await page.getByRole("button", { name: "Ver transação simulada" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "não existe em um explorador",
  );
  await page.getByRole("button", { name: "Entendi" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar comprovante" }).click();
  expect((await download).suggestedFilename()).toContain(id);
});
test("T036 wallet refused or disconnected cannot create a purchase", async ({
  page,
}) => {
  await action(page, "scenario.set", { scenario: "wallet-refused" });
  await page.goto("/checkout");
  const next = page.getByRole("button", { name: "Continuar para carteira" });
  if (page.viewportSize()!.width <= 600) await next.click();
  await page
    .getByRole("button", { name: "Conectar carteira", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("recusada");
  await expect(
    page.getByRole("button", { name: "Revisar compra" }),
  ).toBeDisabled();
  await action(page, "scenario.set", { scenario: "default" });
  await page
    .getByRole("button", { name: "Conectar carteira", exact: true })
    .click();
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await api(page, "DELETE", "/wallet-connections/current");
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Conecte a carteira");
  await expect(page).toHaveURL(/checkout/);
});
test("T037 mixed-network cart is rejected without charging", async ({
  page,
}) => {
  await api(page, "POST", "/cart/items", {
    nftId: "emerald-0618",
    editionId: "fifty",
    quantity: 1,
  });
  await page.goto("/checkout");
  const next = page.getByRole("button", { name: "Continuar para carteira" });
  if (page.viewportSize()!.width <= 600) await next.click();
  await page
    .getByRole("button", { name: "Conectar carteira", exact: true })
    .click();
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await expect(page.getByRole("alert")).toContainText("rede dos NFTs");
});
test("T039 T063 quantities added during pending survive one terminal transition", async ({
  page,
}) => {
  const order = await createOrder(page);
  await add(page, 3);
  await action(page, "order.resolve", {
    orderId: order.id,
    status: "confirmed",
  });
  expect(
    (await api<CartView>(page, "GET", "/cart")).data.lines[0].quantity,
  ).toBe(3);
  await action(page, "order.resolve", {
    orderId: order.id,
    status: "declined",
  });
  expect(
    (await api<Order>(page, "GET", `/orders/${order.id}`)).data.status,
  ).toBe("confirmed");
  expect(
    (await api<CartView>(page, "GET", "/cart")).data.lines[0].quantity,
  ).toBe(3);
});
test("T040 declined payment preserves cart and releases reservations", async ({
  page,
}) => {
  await action(page, "scenario.set", { scenario: "payment-declined" });
  await checkout(page);
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pagamento recusado" }),
  ).toBeVisible();
  expect(
    (await api<CartView>(page, "GET", "/cart")).data.lines[0].quantity,
  ).toBe(2);
  const nft = await firstNft(page);
  expect(nft.editions[2].reserved).toBe(0);
  expect(nft.editions[2].stock).toBe(50);
  const id = page.url().split("/").pop()!;
  expect((await api(page, "GET", `/orders/${id}/receipt`)).status).toBe(409);
});
test("T041 T043 concurrent same-key requests reserve once; changed body conflicts", async ({
  page,
}) => {
  const { body } = await preparedOrder(page),
    key = crypto.randomUUID(),
    [a, b] = await Promise.all([
      api<Order>(page, "POST", "/orders", body, key),
      api<Order>(page, "POST", "/orders", body, key),
    ]);
  expect(a.data.id).toBe(b.data.id);
  expect((await firstNft(page)).editions[2].reserved).toBe(2);
  expect(
    (await api(page, "POST", "/orders", { ...body, walletId: "changed" }, key))
      .status,
  ).toBe(409);
  await action(page, "order.resolve", { orderId: a.data.id });
  expect((await firstNft(page)).editions[2].stock).toBe(48);
});
test("T042 timeout recovers the persisted key after refresh and quote expiration", async ({
  page,
}) => {
  await action(page, "scenario.set", { scenario: "order-timeout" });
  await checkout(page);
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Recuperar tentativa de compra" }),
  ).toBeEnabled({ timeout: 12000 });
  const attempt = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("kurio-attempt:collector-a")!),
  );
  await action(page, "clock.advance", { ms: 120_000 });
  await page.reload();
  await page
    .getByRole("button", { name: "Recuperar tentativa de compra" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada!" }),
  ).toBeVisible();
  const order = (
    await api<Order>(
      page,
      "POST",
      "/orders",
      {
        quoteId: attempt.quoteId,
        walletId: attempt.walletId,
        collectorData: attempt.collector,
      },
      attempt.key,
    )
  ).data;
  expect(page.url()).toContain(order.id);
  expect((await firstNft(page)).editions[2].stock).toBe(48);
});
test("T044 two users competing for the last unit cannot oversell", async ({
  page,
}) => {
  await action(page, "nft.change", { available: 2 });
  const other = await page.context().newPage();
  await other.goto("/");
  await login(other, "b");
  await add(other, 2);
  const first = await preparedOrder(page),
    second = await preparedOrder(other);
  const [a, b] = await Promise.all([
    api<Order>(page, "POST", "/orders", first.body, crypto.randomUUID()),
    api<Order>(other, "POST", "/orders", second.body, crypto.randomUUID()),
  ]);
  expect([a.status, b.status].sort()).toEqual([201, 409]);
  expect((await firstNft(page)).editions[2].reserved).toBe(2);
  await other.close();
});
test("T045 expired quote requires a fresh explicit review", async ({
  page,
}) => {
  await checkout(page);
  await action(page, "clock.advance", { ms: 61_000 });
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("cotação expirou");
  await expect(
    page.getByRole("button", { name: "Confirmar compra", exact: true }),
  ).toHaveCount(0);
  expect(
    (await api<CartView>(page, "GET", "/cart")).data.lines[0].quantity,
  ).toBe(2);
});
test("T021 foreign order and receipt are hidden; explicit forbidden scenario", async ({
  page,
}) => {
  const order = await createOrder(page);
  await login(page, "b");
  expect((await api(page, "GET", `/orders/${order.id}`)).status).toBe(404);
  expect((await api(page, "GET", `/orders/${order.id}/receipt`)).status).toBe(
    404,
  );
  await action(page, "scenario.set", { scenario: "forbidden" });
  await page.goto("/account/profile");
  await expect(page.getByRole("alert")).toContainText("permissão");
});
test("T055 T057 price changes invalidate review with and without a delivered event", async ({
  page,
}) => {
  await checkout(page);
  await action(page, "nft.change", { priceEth: "2.19" });
  await expect(
    page.getByRole("button", { name: "Confirmar compra", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("mudou");
  await page
    .getByRole("button", { name: "Revisar compra", exact: true })
    .click();
  await expect(page.locator(".quote-review")).toContainText("4.396 ETH");
  await action(page, "socket.disconnect");
  await expect(page.locator("#main-content")).toHaveAttribute(
    "data-connection",
    "disconnected",
  );
  await action(page, "nft.change", { priceEth: "3.19", dropEvent: true });
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("mudou");
  expect(
    (await api<CartView>(page, "GET", "/cart")).data.lines[0].quantity,
  ).toBe(2);
});
test("T058 T059 duplicate or old events never regress cart values", async ({
  page,
}) => {
  await page.goto("/cart");
  await expect(page.locator("#main-content")).toHaveAttribute(
    "data-connection",
    "connected",
  );
  await action(page, "nft.change", {
    priceEth: "3.19",
    duplicate: true,
    old: true,
  });
  await expect(page.locator(".cart-product>span")).toHaveText("3.19 ETH");
  await page
    .getByRole("button", { name: "Abrir cenários da demonstração" })
    .click();
  await expect(page.getByTestId("socket-status")).toHaveText("connected");
  await expect(page.getByRole("dialog")).toContainText("1 eventos recebidos");
});
test("T060 T061 pending survives disconnected socket, refresh and REST reconciliation", async ({
  page,
}) => {
  await action(page, "scenario.set", { scenario: "pending-disconnect" });
  const order = await createOrder(page);
  await action(page, "socket.disconnect");
  await page.goto(`/orders/${order.id}`);
  await action(page, "order.resolve", { orderId: order.id });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada!" }),
  ).toBeVisible();
  await action(page, "socket.reconnect");
  await page
    .getByRole("button", { name: "Abrir cenários da demonstração" })
    .click();
  await expect(page.getByTestId("socket-status")).toHaveText("connected");
  expect((await firstNft(page)).editions[2].stock).toBe(48);
});
