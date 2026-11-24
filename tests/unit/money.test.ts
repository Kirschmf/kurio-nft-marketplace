import { describe, expect, it } from "vitest";
import { calculateTotals, fromWei, toWei } from "../../src/lib/money";
import { walletSchema } from "../../src/lib/validation";

describe("ETH amounts", () => {
  it("preserves wei at large amounts and roundtrips", () => {
    const amount = "123456789.000000000000000001";
    expect(fromWei(toWei(amount))).toBe(amount);
  });
  it("rejects floats, negatives and excessive precision at the boundary", () => {
    for (const value of ["1e-7", "-1", "NaN", "0.0000000000000000001"])
      expect(() => toWei(value)).toThrow();
  });
  it("sums and discounts with integer rounding", () => {
    expect(
      calculateTotals(
        [
          { unitPriceEth: "1.19", quantity: 2 },
          { unitPriceEth: "1.39", quantity: 6 },
        ],
        1000,
      ),
    ).toEqual({
      subtotalEth: "10.72",
      discountEth: "1.072",
      networkFeeEth: "0.016",
      totalEth: "9.664",
    });
  });
  it("does not charge a network fee on an empty cart", () => {
    expect(calculateTotals([]).totalEth).toBe("0");
  });
  it("does not round sub-ether digits through Number", () => {
    expect(
      calculateTotals(
        [{ unitPriceEth: "0.000000000000000019", quantity: 3 }],
        1000,
        "0",
      ).totalEth,
    ).toBe("0.000000000000000052");
  });
});
describe("wallet address boundaries", () => {
  const wallet = {
    role: "primary",
    displayName: "Alex",
    nickname: "Main",
    network: "ethereum",
    address: `0x${"a".repeat(40)}`,
    provider: "metamask",
    profileName: "Alex",
    referralCode: "KURIO",
    email: "a@example.test",
    ensName: "alex.eth",
  };
  it("accepts a 20-byte EVM address and rejects malformed values", () => {
    expect(walletSchema.safeParse(wallet).success).toBe(true);
    expect(
      walletSchema.safeParse({ ...wallet, address: "0x123" }).success,
    ).toBe(false);
  });
});
