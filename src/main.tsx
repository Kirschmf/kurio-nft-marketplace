import React from "react";
import ReactDOM from "react-dom/client";
import {
  hydrate,
  QueryClientProvider,
  type DehydratedState,
} from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { queryClient } from "./lib/client";
import { prepareNetwork, waitForPublicPage } from "./lib/network-ready";
import "./styles.css";

async function start() {
  const embedded = document.getElementById("kurio-prerender");
  const initial = (
    embedded ? JSON.parse(embedded.textContent ?? "null") : null
  ) as {
    path: string;
    href: string;
    data: DehydratedState;
  } | null;
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  const canHydrate =
    initial?.path === pathname &&
    !window.location.search &&
    !sessionStorage.getItem("kurio-session");
  if (canHydrate) {
    // A build snapshot must stay stable until its route has hydrated.
    hydrate(queryClient, {
      ...initial.data,
      queries: initial.data.queries.map((query) => ({
        ...query,
        state: { ...query.state, dataUpdatedAt: Date.now() },
      })),
    });
    window.history.replaceState(window.history.state, "", initial.href);
  }
  const network =
    import.meta.env.VITE_API_MODE === "remote"
      ? Promise.resolve()
      : import("./mocks/browser").then(({ startMocks }) => startMocks());
  prepareNetwork(network, canHydrate);
  const { router } = await import("./router");
  const AppRouter = canHydrate
    ? (await import("@tanstack/react-router/ssr/client")).RouterClient
    : RouterProvider;
  const app = (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppRouter router={router} />
      </QueryClientProvider>
    </React.StrictMode>
  );
  const root = document.getElementById("root")!;
  if (canHydrate) ReactDOM.hydrateRoot(root, app);
  else ReactDOM.createRoot(root).render(app);
  await network;
  if (canHydrate) await waitForPublicPage();
  root.removeAttribute("inert");
  document.documentElement.dataset.networkReady = "true";
  if (canHydrate) void queryClient.invalidateQueries();
}
void start().catch((error) => {
  console.error("startup_failed", error);
  const root = document.getElementById("root");
  if (root) {
    root.textContent =
      "Não foi possível iniciar a demonstração. Recarregue a página para tentar novamente.";
    root.setAttribute("role", "alert");
  }
});
