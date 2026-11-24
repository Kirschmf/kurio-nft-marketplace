import { expect, test } from "@playwright/test";
import { action, api, boot, firstNft } from "./helpers";
import type { CatalogResult } from "../../src/lib/types";

test.beforeEach(async ({ page }) => boot(page));
test("T082 detail tabs expose attributes, honest empty reviews and related navigation", async ({
  page,
}) => {
  await page.goto("/nfts/emerald-042");
  await page.getByRole("tab", { name: "Atributos", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Esmeralda");
  await page
    .getByRole("tab", { name: "Atributos", exact: true })
    .press("ArrowRight");
  await expect(page.getByRole("tabpanel")).toContainText(
    "Ainda não há avaliações",
  );
  const related = page.locator(".related-grid .nft-card-art>a").first();
  const href = await related.getAttribute("href");
  await related.click();
  await expect(page).toHaveURL(new RegExp(href!));
});
test("T001 T005 search, refresh and history use URL and REST parameters", async ({
  page,
}) => {
  const request = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/nfts" &&
      new URL(request.url()).searchParams.get("q") === "Emerald",
  );
  await page
    .getByRole("textbox", { name: "Buscar nome, coleção ou atributo" })
    .fill("Emerald");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await request;
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(4);
  await expect(page).toHaveURL(/q=Emerald/);
  await page.reload();
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(4);
  await page
    .getByRole("textbox", { name: "Buscar nome, coleção ou atributo" })
    .fill("Ivory");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/q=Ivory/);
  await page.goBack();
  await expect(
    page.getByRole("textbox", { name: "Buscar nome, coleção ou atributo" }),
  ).toHaveValue("Emerald");
  await page.goForward();
  await expect(page.locator(".nft-grid .nft-card-name").first()).toContainText(
    "Ivory",
  );
});
test("T002 T004 T083 combined category/network/price filters reset page", async ({
  page,
}, info) => {
  await page.getByRole("button", { name: "Próxima página" }).click();
  await expect(page).toHaveURL(/page=2/);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Filtros", exact: true }).click();
  const scope =
    info.project.name === "mobile"
      ? page.getByRole("dialog")
      : page.locator(".catalog-sidebar");
  await scope.getByRole("checkbox", { name: /Arte digital/ }).check();
  await expect(page).toHaveURL(/page=1/);
  await scope.getByRole("checkbox", { name: /Ethereum/ }).check();
  await scope.getByRole("textbox", { name: "Preço mínimo em ETH" }).fill("1");
  await scope.getByRole("textbox", { name: "Preço máximo em ETH" }).fill("1.5");
  await scope.getByRole("button", { name: "Aplicar", exact: true }).click();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Ver resultados" }).click();
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(2);
  await expect(page).toHaveURL(/categories/);
  await page.reload();
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(2);
});
test("T003 sorting and pagination match API order", async ({ page }) => {
  await page
    .getByRole("combobox", { name: "Ordenar NFTs" })
    .selectOption("price-asc");
  const response = await api<CatalogResult>(
    page,
    "GET",
    "/nfts?sort=price-asc&page=1",
  );
  await expect(page.locator(".nft-grid .nft-card-name").first()).toHaveText(
    response.data.items[0].name,
  );
  await page.getByRole("button", { name: "Próxima página" }).click();
  await expect(page).toHaveURL(/page=2/);
  const next = await api<CatalogResult>(
    page,
    "GET",
    "/nfts?sort=price-asc&page=2",
  );
  await expect(page.locator(".nft-grid .nft-card-name").first()).toHaveText(
    next.data.items[0].name,
  );
});
test("T006 T073 obsolete search response cannot replace the latest result", async ({
  page,
}) => {
  await action(page, "scenario.set", { scenario: "out-of-order" });
  const input = page.getByRole("textbox", {
    name: "Buscar nome, coleção ou atributo",
  });
  await input.fill("Em");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await input.fill("Golden");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.locator(".nft-grid .nft-card-name").first()).toContainText(
    "Golden",
  );
  await expect(
    page.locator(".nft-grid .nft-card-name").filter({ hasNotText: "Golden" }),
  ).toHaveCount(0);
});
test("T007 T008 empty results, malformed parameters and recovery", async ({
  page,
}) => {
  await page.goto("/?q=inexistente");
  await expect(
    page.getByRole("heading", { name: "Nenhum NFT encontrado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver todos os NFTs" }).click();
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(9);
  await page.goto("/?page=-2&maxEth=oops&sort=unknown");
  await expect(page.getByRole("alert")).toContainText("Confira");
  await expect(page).toHaveURL(/page=1/);
});
test("T009 T010 T012 direct detail, editions, gallery, limits and not found", async ({
  page,
}) => {
  await page.goto("/nfts/emerald-042");
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Visualização 2" }).click();
  await expect(
    page.getByRole("button", { name: "Visualização 2" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "1/1", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Aumentar quantidade", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Diminuir quantidade" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "1/10", exact: true }).click();
  await page
    .getByRole("button", { name: "Aumentar quantidade", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Quantidade selecionada" }),
  ).toHaveText("2");
  await page.goto("/nfts/not-a-token");
  await expect(page.getByRole("alert")).toContainText("não está disponível");
});
test("T011 T056 sold-out edition disables purchase via Socket.IO", async ({
  page,
}) => {
  await page.goto("/nfts/emerald-042");
  await expect(
    page.getByRole("button", { name: "Comprar agora" }),
  ).toBeEnabled();
  await action(page, "nft.change", { available: 0 });
  await expect(
    page.getByRole("button", { name: "Comprar agora" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Edição esgotada", { exact: true }),
  ).toBeVisible();
  expect((await firstNft(page)).editions[2].stock).toBe(0);
});
