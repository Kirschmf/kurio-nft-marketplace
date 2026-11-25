import { expect, test } from "@playwright/test";
import { action, add, boot } from "./helpers";

test("T009 T073 public snapshots hydrate without errors and reconcile persisted data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await boot(page);
  await add(page, 2);
  await action(page, "nft.change", { priceEth: "2.19" });
  for (const route of ["/nfts/emerald-042", "/"]) {
    const response = await page.goto(route);
    const html = await response!.text();
    if (html.includes('id="kurio-prerender"')) {
      const payload = JSON.parse(
        html.match(
          /<script id="kurio-prerender" type="application\/json">(.+?)<\/script>/s,
        )![1],
      );
      expect(payload.path).toBe(route);
      expect(payload.data.queries.length).toBeGreaterThan(0);
      expect(
        payload.data.queries.every((query: { queryKey: unknown[] }) =>
          ["catalog", "nft"].includes(String(query.queryKey[0])),
        ),
      ).toBe(true);
      expect(JSON.stringify(payload)).not.toMatch(
        /passwordHash|kurio-session|collector\.a@example/,
      );
    }
    await expect(page.locator("html")).toHaveAttribute(
      "data-network-ready",
      "true",
    );
    await expect(page.locator(".cart-link")).toHaveAttribute(
      "aria-label",
      "Carrinho, 2 itens",
    );
    await expect(
      page
        .locator(route === "/" ? ".nft-grid .nft-card" : ".detail-info")
        .first(),
    ).toContainText("2.19 ETH");
    await expect(page.locator("#main-content")).toHaveAttribute(
      "data-connection",
      "connected",
    );
  }
  expect(errors).toEqual([]);
});
