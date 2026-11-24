import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "preload-app-entrypoints",
      transformIndexHtml: {
        order: "post",
        handler(_html, context) {
          if (!context.bundle) return [];
          return Object.values(context.bundle)
            .filter(
              (chunk) =>
                chunk.type === "chunk" &&
                ["browser", "router", "common"].includes(chunk.name),
            )
            .map((chunk) => ({
              tag: "link",
              attrs: {
                rel: "modulepreload",
                href: `/${chunk.fileName}`,
                crossorigin: "",
              },
              injectTo: "head" as const,
            }));
        },
      },
    },
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { sourcemap: true, target: "es2022" },
});
