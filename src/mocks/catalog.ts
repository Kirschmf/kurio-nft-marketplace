import type { Database } from "../lib/types";
import { toWei } from "../lib/money";
import { fail } from "./domain-error";

export function listCatalog(state: Database, url: URL) {
  const params = url.searchParams,
    q = (params.get("q") ?? "").trim().toLowerCase(),
    selectedCategories = params.getAll("categories"),
    selectedNetworks = params.getAll("networks");
  const sort = params.get("sort") ?? "recent",
    tab = params.get("tab") ?? "all",
    page = Number(params.get("page") ?? 1);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !["recent", "price-asc", "price-desc", "popular"].includes(sort)
  )
    fail(422, "QUERY_INVALID", "Confira os filtros da busca.");
  let min = 0n,
    max: bigint | undefined;
  try {
    if (params.get("minEth")) min = toWei(params.get("minEth")!);
    if (params.get("maxEth")) max = toWei(params.get("maxEth")!);
    if (max !== undefined && min > max) throw new Error();
  } catch {
    fail(422, "PRICE_INVALID", "Confira o intervalo de preço.");
  }
  let items = state.nfts.filter(
    (nft) =>
      (!q ||
        `${nft.name} ${nft.collection} ${nft.attributes.join(" ")}`
          .toLowerCase()
          .includes(q)) &&
      (!selectedCategories.length ||
        selectedCategories.includes(nft.category)) &&
      (!selectedNetworks.length || selectedNetworks.includes(nft.network)) &&
      toWei(nft.editions[2].priceEth) >= min &&
      (max === undefined || toWei(nft.editions[2].priceEth) <= max) &&
      (tab !== "new" || nft.createdAt >= "2026-09-15") &&
      (tab !== "trending" || nft.popularity >= 65),
  );
  if (state.config.scenario === "empty") items = [];
  items.sort((a, b) =>
    sort === "price-asc" || sort === "price-desc"
      ? (toWei(a.editions[2].priceEth) < toWei(b.editions[2].priceEth)
          ? -1
          : toWei(a.editions[2].priceEth) > toWei(b.editions[2].priceEth)
            ? 1
            : a.id.localeCompare(b.id)) * (sort === "price-desc" ? -1 : 1)
      : sort === "popular"
        ? b.popularity - a.popularity
        : b.createdAt.localeCompare(a.createdAt),
  );
  const total = items.length,
    totalPages = Math.max(1, Math.ceil(total / 9)),
    currentPage = Math.min(page, totalPages);
  const facets = {
    categories: {} as Record<string, number>,
    networks: {} as Record<string, number>,
  };
  for (const nft of state.nfts) {
    facets.categories[nft.category] =
      (facets.categories[nft.category] ?? 0) + 1;
    facets.networks[nft.network] = (facets.networks[nft.network] ?? 0) + 1;
  }
  return {
    items: items.slice((currentPage - 1) * 9, currentPage * 9),
    total,
    page: currentPage,
    pageSize: 9,
    totalPages,
    facets,
  };
}
