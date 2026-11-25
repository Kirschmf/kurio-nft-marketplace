import { renderToString } from "react-dom/server";
import { dehydrate, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import {
  createRequestHandler,
  renderSsrHtmlResponse,
  RouterServer,
} from "@tanstack/react-router/ssr/server";
import { queryClient } from "./lib/client";
import { router } from "./router";
import { seed } from "./mocks/fixtures";
import { listCatalog } from "./mocks/catalog";
import type { CatalogParams } from "./lib/types";

export async function render(path: string, template: string) {
  queryClient.clear();
  const state = await seed();
  const entry =
    path === "/"
      ? "/?categories=%5B%5D&networks=%5B%5D&page=1&sort=recent&tab=all"
      : path;
  const params: CatalogParams = {
    categories: [],
    networks: [],
    page: 1,
    sort: "recent",
    tab: "all",
  };
  const catalog = listCatalog(state, new URL("https://kurio.test/api/nfts"));
  queryClient.setQueryData(["catalog", params], catalog);
  queryClient.setQueryData(["catalog", "related"], catalog);
  if (path.startsWith("/nfts/")) {
    const nft = state.nfts.find((value) => value.id === path.split("/")[2]);
    if (nft) queryClient.setQueryData(["nft", nft.id], nft);
    if (nft)
      template = template.replace(
        "</head>",
        `<link rel="preload" as="image" href="${nft.image}" imagesrcset="${nft.image} 450w, ${nft.image.replace(".webp", "-900.webp")} 900w" imagesizes="(max-width: 600px) calc(100vw - 56px), (max-width: 900px) 40vw, 404px" fetchpriority="high"></head>`,
      );
  } else {
    template = template.replace(
      "</head>",
      '<link rel="preload" as="image" href="/assets/emerald.webp" fetchpriority="high"></head>',
    );
  }
  const handler = createRequestHandler({
    request: new Request(`https://kurio.test${entry}`),
    createRouter: () =>
      createRouter({
        routeTree: router.routeTree,
        defaultPreload: "intent",
        scrollRestoration: true,
      }),
  });
  const response = await handler(({ router: serverRouter, responseHeaders }) =>
    renderSsrHtmlResponse({
      router: serverRouter,
      responseHeaders,
      render: () => {
        const markup = renderToString(
          <QueryClientProvider client={queryClient}>
            <RouterServer router={serverRouter} />
          </QueryClientProvider>,
        );
        const data = dehydrate(queryClient, {
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" &&
            ["catalog", "nft"].includes(String(query.queryKey[0])),
        });
        const payload = JSON.stringify({ path, href: entry, data }).replaceAll(
          "<",
          "\\u003c",
        );
        return template.replace(
          '<div id="root"></div>',
          `<div id="root" inert>${markup}</div><script id="kurio-prerender" type="application/json">${payload}</script>`,
        );
      },
    }),
  );
  const html = await response.text();
  if (!response.ok)
    throw new Error(`Prerender failed for ${path}: ${response.status}`);
  queryClient.clear();
  return html;
}

export async function paths() {
  const state = await seed();
  return ["/", ...state.nfts.map((nft) => `/nfts/${nft.id}`)];
}
