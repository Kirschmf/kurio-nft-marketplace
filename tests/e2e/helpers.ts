import { expect, type Page } from "@playwright/test";
import type {
  CartView,
  Collector,
  Nft,
  Order,
  Quote,
  Wallet,
} from "../../src/lib/types";

export async function api<T = unknown>(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
  key?: string,
): Promise<{
  status: number;
  data: T;
  error?: { code: string; details?: unknown };
}> {
  await expect(page.locator(".site-header")).toBeAttached();
  return page.evaluate(
    async ({ method, path, body, key }) => {
      const token = sessionStorage.getItem("kurio-session");
      const response = await fetch(`/api${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "X-Demo-Guest-Id": localStorage.getItem("kurio-guest") ?? "",
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      return { status: response.status, ...result };
    },
    { method, path, body, key },
  );
}
export async function boot(page: Page, scenario = "default") {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /SEJA DONO/ })).toBeVisible();
  await api(page, "POST", "/demo/reset", { scenario, seed: 7 });
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem("kurio-guest");
  });
  await page.reload();
  await expect(page.locator(".nft-card").first()).toBeVisible();
}
export async function login(
  page: Page,
  account: "a" | "b" = "a",
  redirect = "/",
) {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill(`collector.${account}@example.test`);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(account === "a" ? "CollectorDemoA!2026" : "CollectorDemoB!2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
export async function add(page: Page, quantity = 1, editionId = "fifty") {
  const result = await api<CartView>(page, "POST", "/cart/items", {
    nftId: "emerald-042",
    editionId,
    quantity,
  });
  expect(result.status).toBe(200);
  return result.data;
}
export async function action(
  page: Page,
  type: string,
  payload: Record<string, unknown> = {},
) {
  const response = await api(page, "POST", "/demo/actions", { type, payload });
  expect(response.status).toBe(200);
}
export async function checkout(page: Page) {
  await page.goto("/checkout");
  await expect(
    page.getByRole("heading", { name: "Perfil do colecionador" }),
  ).toBeVisible();
  const next = page.getByRole("button", { name: "Continuar para carteira" });
  if (page.viewportSize()!.width <= 600) await next.click();
  await page
    .getByRole("button", { name: "Conectar carteira", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Revisar compra", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Revise e confirme" }),
  ).toBeVisible();
}
export async function preparedOrder(page: Page) {
  const wallet = (await api<Wallet[]>(page, "GET", "/wallets")).data[0],
    profile = (
      await api<{
        displayName: string;
        username: string;
        email: string;
        ensName: string;
      }>(page, "GET", "/profile")
    ).data;
  const collector: Collector = {
    displayName: profile.displayName,
    username: profile.username,
    email: profile.email,
    ensName: profile.ensName,
    profileName: profile.username,
    referralCode: "KURIO",
    secondaryIdentifier: "",
    collectorNote: "",
  };
  await api(page, "POST", "/wallet-connections", {
    walletId: wallet.id,
    provider: wallet.provider,
  });
  const cart = (await api<CartView>(page, "GET", "/cart")).data;
  const quote = (
    await api<Quote>(page, "POST", "/quotes", {
      cartVersion: cart.cart.version,
      walletId: wallet.id,
      collectorData: collector,
    })
  ).data;
  return {
    body: { quoteId: quote.id, walletId: wallet.id, collectorData: collector },
    quote,
  };
}
export async function createOrder(page: Page, key = crypto.randomUUID()) {
  const { body } = await preparedOrder(page);
  return (await api<Order>(page, "POST", "/orders", body, key)).data;
}
export async function firstNft(page: Page) {
  return (await api<Nft>(page, "GET", "/nfts/emerald-042")).data;
}
