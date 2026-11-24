import { expect, it } from "vitest";
import { safeReturnTo } from "../../src/lib/return-to";
it("only resumes internal routes and rejects browser URL normalization tricks", () => {
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/login?redirect=/checkout",
    "/register",
    "/\nevil.example",
  ])
    expect(safeReturnTo(value, "https://kurio.example")).toBe("/");
  expect(safeReturnTo("/checkout?step=2#review", "https://kurio.example")).toBe(
    "/checkout?step=2#review",
  );
});
