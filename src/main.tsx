import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { queryClient } from "./lib/client";
import "./styles.css";

async function start() {
  if (import.meta.env.VITE_API_MODE !== "remote") {
    const { startMocks } = await import("./mocks/browser");
    await startMocks();
  }
  // Engine.IO captures WebSocket when imported. Install MSW before loading the router and socket client.
  const { router } = await import("./router");
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>,
  );
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
