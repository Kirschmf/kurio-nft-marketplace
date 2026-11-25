import { createServer, loadEnv } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

if (
  (process.env.VITE_API_MODE ??
    loadEnv("production", process.cwd(), "VITE_").VITE_API_MODE) === "remote"
) {
  console.log("Remote API mode: public mock prerender skipped.");
  process.exit(0);
}
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
try {
  const { render, paths } = await server.ssrLoadModule("/src/prerender.tsx");
  let template = await readFile("dist/index.html", "utf8");
  if (!template.includes('<div id="root"></div>'))
    throw new Error("Run vite build before prerendering.");
  template = template.replace(/<!doctype html>/i, "");
  const stylesheet = template.match(
    /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/,
  );
  if (stylesheet) {
    const css = await readFile(resolve("dist", stylesheet[1].slice(1)), "utf8");
    template = template.replace(stylesheet[0], `<style>${css}</style>`);
  }
  for (const path of await paths()) {
    const html = await render(path, template);
    const file = resolve("dist", path.slice(1), "index.html");
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
    if (path !== "/")
      await writeFile(resolve("dist", `${path.slice(1)}.html`), html);
  }
  console.log(
    "Prerendered public catalog and 36 NFT pages from the mock domain.",
  );
} finally {
  await server.close();
}
