import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { action, add, boot, createOrder, login } from "./helpers";

test("T067 T069 automated semantics and contrast cover every screen", async ({
  page,
}) => {
  test.setTimeout(120000);
  await boot(page);
  await login(page);
  await add(page);
  const order = await createOrder(page);
  await action(page, "order.resolve", {
    orderId: order.id,
    status: "confirmed",
  });
  await add(page);
  for (const route of [
    "/",
    "/nfts/emerald-042",
    "/cart",
    "/checkout",
    "/login",
    "/register",
    "/account/profile",
    "/account/wallets",
    `/orders/${order.id}`,
    "/favorites",
  ]) {
    await page.goto(route);
    await expect(page.locator("#main-content")).not.toBeEmpty();
    await expect(page.locator(".skeleton")).toHaveCount(0);
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      report.violations.map((value) => ({
        id: value.id,
        nodes: value.nodes.map((node) => node.target),
      })),
      route,
    ).toEqual([]);
  }
});
